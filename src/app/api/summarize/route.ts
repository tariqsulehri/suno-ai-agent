import { NextRequest, NextResponse } from 'next/server'
import { getLLMClient, SUMMARY_MODEL, getProvider } from '@/lib/ai/client'
import { requireEmbedApiAuth, getTenantFromRequest } from '@/lib/security/embed-auth'
import { sendCallSummaryEmail } from '@/lib/email/call-summary'
import { db } from '@/lib/db/client'
import { initVectorTable, upsertReviewVector } from '@/lib/db/vectors'
import { embedReview } from '@/lib/ai/embed'
import type { CallSummary, ChatHistory, LeadData, ReviewData } from '@/types'
export { OPTIONS } from '@/lib/utils/cors'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authError = requireEmbedApiAuth(req)
  if (authError) return authError

  const tenant = getTenantFromRequest(req)

  let messages: ChatHistory
  let lead:   LeadData   = { name: null, email: null, phone: null, company: null, purpose: null }
  let review: ReviewData | null = null
  try {
    const body = await req.json()
    messages = body.messages
    if (body.lead   && typeof body.lead   === 'object') lead   = body.lead
    if (body.review && typeof body.review === 'object') review = body.review
    if (!Array.isArray(messages)) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const conversation = messages.filter((m) => m.content !== '__GREET__')

  if (conversation.length < 2) {
    const briefSummary: CallSummary = {
      summary:   'The call was too brief to summarize.',
      keyPoints: [],
      ...(review ? { review } : {}),
    }
    const briefShopCode = req.headers.get('x-embed-shop') ?? ''
    const email = await sendCallSummaryEmail({ tenant, lead, summary: briefSummary, messages })
    await persistReview({ tenant, lead, review, summary: briefSummary, messages, shopCode: briefShopCode })
    return NextResponse.json({ ...briefSummary, email })
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

  const shopCode = req.headers.get('x-embed-shop') ?? ''

  // Always persist and email regardless of whether LLM succeeded
  const [email] = await Promise.all([
    sendCallSummaryEmail({ tenant, lead, summary, messages }),
    persistReview({ tenant, lead, review, summary, messages, shopCode }),
  ])

  return NextResponse.json({ ...summary, email })
}

// ── Persist to SQLite + embed vector ──────────────────────────────────────────

async function persistReview({
  tenant,
  lead,
  review,
  summary,
  messages,
  shopCode,
}: {
  tenant:    ReturnType<typeof getTenantFromRequest>
  lead:      LeadData
  review:    ReviewData | null
  summary:   CallSummary
  messages:  ChatHistory
  shopCode:  string
}) {
  try {
    if (tenant.agentType !== 'reviews' && tenant.agentType !== 'complaints') return

    initVectorTable()

    const shop = await resolveReviewShop(tenant, shopCode)

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

  } catch (err) {
    console.error('[persist-review]', err)
    throw err
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
