import { NextRequest, NextResponse } from 'next/server'
import { getLLMClient, SUMMARY_MODEL } from '@/lib/ai/client'
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

  // P2-A: if the agent's tenant was removed from the registry, fail explicitly
  if (session?.role === 'agent' && session.tenantId && !sessionTenant) {
    return NextResponse.json({ error: 'Agent configuration not found — contact your administrator' }, { status: 400 })
  }

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
    try {
      const ticket = await persistReview({ tenant, lead, review, summary: quickSummary, messages, shopCode, shopId })
      return NextResponse.json({ ...quickSummary, ticket, email: null })
    } catch (err) {
      console.error('[summarize quick persist]', err)
      return NextResponse.json({ error: String((err as Error).message ?? 'Save failed') }, { status: 500 })
    }
  }

  if (conversation.length < 1) {
    const briefSummary: CallSummary = {
      summary:   'The call was too brief to summarize.',
      keyPoints: [],
      ...(review ? { review } : {}),
    }
    let email = null
    try { email = await sendCallSummaryEmail({ tenant, lead, summary: briefSummary, messages }) }
    catch (err) { console.error('[summarize brief email]', err) }
    try {
      const ticket = await persistReview({ tenant, lead, review, summary: briefSummary, messages, shopCode, shopId })
      return NextResponse.json({ ...briefSummary, ticket, email })
    } catch (err) {
      console.error('[summarize brief persist]', err)
      return NextResponse.json({ error: String((err as Error).message ?? 'Save failed') }, { status: 500 })
    }
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

  const openai = getLLMClient(tenant.openaiApiKey)

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
      model:           SUMMARY_MODEL,
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

  // Email is non-fatal — failure is logged but doesn't block the DB save
  let email = null
  try { email = await sendCallSummaryEmail({ tenant, lead, summary, messages }) }
  catch (err) { console.error('[summarize email]', err) }

  // P1-A: DB persist failure is fatal — return 500 so the client shows an error
  try {
    const ticket = await persistReview({ tenant, lead, review, summary, messages, shopCode, shopId })
    return NextResponse.json({ ...summary, ticket, email })
  } catch (err) {
    console.error('[summarize persist]', err)
    return NextResponse.json({ error: String((err as Error).message ?? 'Save failed') }, { status: 500 })
  }
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
  if (tenant.agentType !== 'reviews' && tenant.agentType !== 'complaints') return null

  initVectorTable()

  // P1-A: errors now propagate — callers wrap in try/catch and return 500
  const shop = shopId
    ? await db.shop.findUnique({ where: { id: shopId } })
    : await resolveReviewShop(tenant, shopCode)
  if (!shop) throw new Error('Shop not found — please contact your administrator')

  const ticket = classifyTicket(review)

  // P3-C: strip synthetic __GREET__ turn from stored transcript
  const cleanMessages = messages.filter((m) => m.content !== '__GREET__')

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
      transcript:  JSON.stringify(cleanMessages),
      ticketId:       ticket?.id ?? null,
      ticketType:     ticket?.type ?? null,
      ticketPriority: ticket?.priority ?? null,
      slaDueAt:       ticket?.slaDueAt ?? null,
    },
  })

  // Always persist a lead record — fill placeholder defaults for any missing fields
  // so the dashboard never shows empty rows and exports stay consistent.
  await db.lead.create({
    data: {
      reviewId: created.id,
      name:     lead.name  || 'Unknown',
      email:    lead.email || 'unknown@email.com',
      phone:    lead.phone || null,
    },
  })

  // Non-blocking, non-fatal background tasks
  embedReview(review, summary.summary, summary.keyPoints, tenant.openaiApiKey)
    .then((vec) => upsertReviewVector(created.id, vec))
    .catch((err) => console.error('[embed]', err))

  const isEscalation =
    review?.sentiment === 'complaint' ||
    (review?.sentiment === 'negative' && review.rating !== null && review.rating <= 2)
  if (isEscalation) {
    sendEscalationAlert({ tenant, lead, review, shopName: shop.name, summary: summary.summary })
      .catch((err) => console.error('[escalation]', err))
  }

  return ticket ? { ...ticket, slaDueAt: ticket.slaDueAt.toISOString() } : null
}

async function resolveReviewShop(
  tenant: ReturnType<typeof getTenantFromRequest>,
  shopCode: string
) {
  const branchCode = shopCode.trim() || null

  // P1-C / P3-B: try exact branchCode match first, then fall back to the tenant's shop.
  // Never auto-create — unknown codes return null and the caller throws a 500.
  if (branchCode) {
    const byBranch = await db.shop.findFirst({ where: { tenantId: tenant.id, branchCode } })
    if (byBranch) return byBranch
  }

  return db.shop.findFirst({ where: { tenantId: tenant.id } })
}
