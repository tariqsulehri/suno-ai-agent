import { NextRequest, NextResponse } from 'next/server'
import { getLLMClient, SUMMARY_MODEL, getProvider } from '@/lib/ai/client'
import { requireEmbedApiAuth, getTenantFromRequest } from '@/lib/security/embed-auth'
import { getSessionFromRequest } from '@/lib/auth/session'
import { sendCallSummaryEmail } from '@/lib/email/call-summary'
import { sendEscalationAlert } from '@/lib/email/escalation'
import { db } from '@/lib/db/client'
import { initVectorTable, upsertReviewVector } from '@/lib/db/vectors'
import { embedReview } from '@/lib/ai/embed'
import { getTenantById } from '@/lib/tenants/registry'
import type { CallSummary, ChatHistory, LeadData, ReviewData } from '@/types'
export { OPTIONS } from '@/lib/utils/cors'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  const sessionTenant = session?.role === 'agent' && session.tenantId
    ? getTenantById(session.tenantId)
    : null

  const authError = sessionTenant ? null : requireEmbedApiAuth(req)
  if (authError) return authError

  const tenant = sessionTenant ?? getTenantFromRequest(req)

  let messages: ChatHistory
  let lead:   LeadData   = { name: null, email: null, phone: null, company: null, purpose: null }
  let review: ReviewData | null = null
  let quick  = false
  try {
    const body = await req.json()
    messages = body.messages
    if (body.lead   && typeof body.lead   === 'object') lead   = body.lead
    if (body.review && typeof body.review === 'object') review = body.review
    if (body.quick  === true) quick = true
    if (!Array.isArray(messages)) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const shopCode = req.headers.get('x-embed-shop') ?? ''
  const shopId = session?.role === 'agent' ? session.shopId : null
  const conversation = messages.filter((m) => m.content !== '__GREET__')

  // quick=true: positive feedback — save to DB but skip LLM + email (no follow-up needed)
  if (quick) {
    const quickSummary: CallSummary = {
      summary:   review?.subcategory
        ? `Positive feedback: ${review.subcategory}.`
        : 'Customer left positive feedback.',
      keyPoints: [],
      ...(review ? { review } : {}),
    }
    const ticket = await persistReview({ tenant, lead, review, summary: quickSummary, messages, shopCode, shopId })
    return NextResponse.json({ ...quickSummary, ticket, email: null })
  }

  if (conversation.length < 1) {
    const briefSummary: CallSummary = {
      summary:   'The call was too brief to summarize.',
      keyPoints: [],
      ...(review ? { review } : {}),
    }
    const email = await sendCallSummaryEmail({ tenant, lead, summary: briefSummary, messages })
    const ticket = await persistReview({ tenant, lead, review, summary: briefSummary, messages, shopCode, shopId })
    return NextResponse.json({ ...briefSummary, ticket, email })
  }

  const agentLabel = tenant.agentName
  const transcript = conversation
    .map((m) => `${m.role === 'user' ? 'Customer' : agentLabel}: ${m.content}`)
    .join('\n')

  const isReviewAgent = tenant.agentType === 'reviews' || tenant.agentType === 'complaints'

  const systemPrompt = isReviewAgent
    ? `You are a feedback summarizer. Given a conversation transcript between a customer and ${agentLabel} (a feedback agent for ${tenant.companyName}), return a JSON object with:
- "summary": a 2-3 sentence narrative recap of the customer's feedback
- "keyPoints": an array of 3-5 concise points capturing what the customer said

Return only valid JSON: { "summary": "...", "keyPoints": ["...", "..."] }`
    : `You are a call summarizer. Given a conversation transcript between a visitor and ${agentLabel} (an AI agent for ${tenant.companyName}), return a JSON object with:
- "summary": a 2-3 sentence narrative recap of the discussion
- "keyPoints": an array of 3-5 concise bullet-point strings

Return only valid JSON: { "summary": "...", "keyPoints": ["...", "..."] }`

  const openai   = getLLMClient(tenant.openaiApiKey)
  const provider = getProvider()

  // Fallback used when LLM summarization fails — still saves the raw review data
  const fallbackSummary: CallSummary = {
    summary:   review?.subcategory
      ? `Customer ${review.sentiment ?? 'feedback'}: ${review.subcategory}.`
      : 'Call summary unavailable.',
    keyPoints: [],
    ...(review ? { review } : {}),
  }

  let summary = fallbackSummary

  try {
    const completion = await openai.chat.completions.create({
      model:           SUMMARY_MODEL[provider],
      max_tokens:      500,
      temperature:     0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: transcript },
      ],
    })

    const raw    = completion.choices[0].message.content ?? '{}'
    const parsed = JSON.parse(raw)

    summary = {
      summary:   parsed.summary   ?? fallbackSummary.summary,
      keyPoints: parsed.keyPoints ?? [],
      ...(review ? { review } : {}),
    }
  } catch (err) {
    console.error('[summarize] LLM failed — saving with fallback summary:', err)
  }

  // Always persist and email regardless of whether LLM succeeded
  const email = await sendCallSummaryEmail({ tenant, lead, summary, messages })
  const ticket = await persistReview({ tenant, lead, review, summary, messages, shopCode, shopId })

  return NextResponse.json({ ...summary, ticket, email })
}

// ── Persist to SQLite + embed vector ──────────────────────────────────────────

function classifyTicket(review: ReviewData | null) {
  const sentiment = review?.sentiment
  if (sentiment !== 'complaint' && sentiment !== 'negative' && sentiment !== 'suggestion') return null

  const urgentCategory = review?.category === 'facility' || review?.category === 'behavioral'
  const urgentText = `${review?.subcategory ?? ''} ${(review?.items ?? []).join(' ')}`.toLowerCase()
  const urgentTerms = ['hygiene', 'dirty', 'unsafe', 'harassment', 'injury', 'poison', 'refund', 'manager', 'rude']

  const urgent = sentiment === 'complaint' && (
    review?.rating === 1 ||
    urgentCategory ||
    urgentTerms.some((term) => urgentText.includes(term))
  )
  const priority = urgent ? 'urgent' : sentiment === 'complaint' || review?.rating === 2 ? 'high' : 'normal'
  const prefix = sentiment === 'suggestion' ? 'SUG' : sentiment === 'negative' ? 'NEG' : 'CMP'
  const dueHours = priority === 'urgent' ? 4 : priority === 'high' ? 24 : 72
  const slaDueAt = new Date(Date.now() + dueHours * 60 * 60 * 1000)

  return {
    id: `${prefix}-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    type: sentiment,
    priority,
    slaDueAt,
  }
}

async function persistReview({
  tenant,
  lead,
  review,
  summary,
  messages,
  shopCode,
  shopId,
}: {
  tenant:    ReturnType<typeof getTenantFromRequest>
  lead:      LeadData
  review:    ReviewData | null
  summary:   CallSummary
  messages:  ChatHistory
  shopCode:  string
  shopId:    string | null
}): Promise<CallSummary['ticket']> {
  try {
    if (tenant.agentType !== 'reviews' && tenant.agentType !== 'complaints') return null

    initVectorTable()

    const shop = shopId
      ? await db.shop.findUnique({ where: { id: shopId } })
      : await resolveReviewShop(tenant, shopCode)
    if (!shop) throw new Error('Authenticated shop not found')
    const ticket = classifyTicket(review)

    // Save structured review row
    const created = await db.review.create({
      data: {
        shopId:      shop.id,
        sentiment:   review?.sentiment   ?? null,
        category:    review?.category    ?? null,
        subcategory: review?.subcategory ?? null,
        rating:      review?.rating      ?? null,
        items:       review?.items       ? JSON.stringify(review.items) : null,
        summary:     summary.summary,
        keyPoints:   JSON.stringify(summary.keyPoints),
        transcript:  JSON.stringify(messages),
        ticketId:       ticket?.id ?? null,
        ticketType:     ticket?.type ?? null,
        ticketPriority: ticket?.priority ?? null,
        slaDueAt:       ticket?.slaDueAt ?? null,
      },
    })

    // Save optional contact info — auto-fill company from shop
    if (lead.name || lead.email || lead.phone) {
      await db.lead.create({
        data: {
          reviewId: created.id,
          name:     lead.name,
          email:    lead.email,
          phone:    lead.phone,
        },
      })
    }

    // Generate and store embedding vector (non-blocking, non-fatal)
    embedReview(review, summary.summary, summary.keyPoints, tenant.openaiApiKey)
      .then((vec) => upsertReviewVector(created.id, vec))
      .catch((err) => console.error('[embed]', err))

    // Fire escalation alert for complaints / low-rated negatives (non-blocking)
    const isEscalation =
      review?.sentiment === 'complaint' ||
      (review?.sentiment === 'negative' && review.rating !== null && review.rating <= 2)
    if (isEscalation) {
      sendEscalationAlert({
        tenant,
        lead,
        review,
        shopName: shop.name,
        summary:  summary.summary,
      }).catch((err) => console.error('[escalation]', err))
    }

    return ticket ? { ...ticket, slaDueAt: ticket.slaDueAt.toISOString() } : null
  } catch (err) {
    console.error('[persist-review]', err)
    return null
  }
}

async function resolveReviewShop(
  tenant: ReturnType<typeof getTenantFromRequest>,
  shopCode: string
) {
  const branchCode = shopCode.trim() || null

  if (branchCode) {
    const byBranch = await db.shop.findFirst({ where: { tenantId: tenant.id, branchCode } })
    if (byBranch) return byBranch
  }

  const byTenant = await db.shop.findFirst({ where: { tenantId: tenant.id } })
  if (byTenant) {
    if (branchCode && !byTenant.branchCode) {
      return db.shop.update({
        where: { tenantId: tenant.id },
        data:  { branchCode },
      })
    }
    return byTenant
  }

  return db.shop.create({
    data: {
      tenantId:    tenant.id,
      name:        branchCode ? `${tenant.companyName} ${branchCode}` : tenant.companyName,
      branchCode,
    },
  })
}
