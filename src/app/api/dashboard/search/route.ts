import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { initVectorTable, searchSimilarReviews } from '@/lib/db/vectors'
import { embedQuery } from '@/lib/ai/embed'
import { getOpenAIClient } from '@/lib/ai/client'
import { env } from '@/lib/config/env'

export const dynamic = 'force-dynamic'

/**
 * POST /api/dashboard/search
 * Body: { query: string, limit?: number }
 *
 * 1. Embeds the natural language query
 * 2. Finds top-K similar reviews via sqlite-vec
 * 3. Fetches full review rows from SQLite
 * 4. Asks GPT to synthesise a human-readable answer
 *
 * Returns: { answer: string, sources: Review[] }
 */
export async function POST(req: NextRequest) {
  let query: string
  let limit: number

  try {
    const body = await req.json()
    query = String(body.query ?? '').trim()
    limit = Math.min(Number(body.limit ?? 5), 20)
    if (!query) throw new Error()
  } catch {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  try {
    initVectorTable()

    // Embed the manager's question
    const queryVec = await embedQuery(query)

    // Vector similarity search → top review IDs
    const hits = searchSimilarReviews(queryVec, limit)
    if (hits.length === 0) {
      return NextResponse.json({
        answer:  'No reviews found matching your question.',
        sources: [],
      })
    }

    const reviewIds = hits.map((h) => h.review_id)

    // Fetch full rows for context
    const reviews = await db.review.findMany({
      where:   { id: { in: reviewIds } },
      include: { shop: true, lead: true },
      orderBy: { createdAt: 'desc' },
    })

    // Build context for GPT
    const context = reviews.map((r, i) => {
      const kp = (() => { try { return JSON.parse(r.keyPoints ?? '[]') } catch { return [] } })()
      return [
        `[Review ${i + 1}]`,
        `Shop: ${r.shop.name}`,
        `Sentiment: ${r.sentiment ?? 'unknown'} | Category: ${r.category ?? 'unknown'} | Rating: ${r.rating ?? 'N/A'}/5`,
        `Summary: ${r.summary}`,
        kp.length ? `Key points: ${kp.join('; ')}` : '',
      ].filter(Boolean).join('\n')
    }).join('\n\n')

    // GPT synthesises a direct answer
    const openai = getOpenAIClient(env.OPENAI_API_KEY)
    const completion = await openai.chat.completions.create({
      model:       'gpt-4o-mini',
      max_tokens:  400,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You are a customer feedback analyst. Given review data from outlet shops, answer the manager\'s question concisely and accurately. Base your answer only on the provided reviews. Be direct and actionable.',
        },
        {
          role: 'user',
          content: `Manager's question: ${query}\n\nReview data:\n${context}`,
        },
      ],
    })

    const answer = completion.choices[0].message.content ?? ''

    // Return clean source list (no raw transcript)
    const sources = reviews.map((r) => ({
      id:          r.id,
      shop:        r.shop.name,
      sentiment:   r.sentiment,
      category:    r.category,
      subcategory: r.subcategory,
      rating:      r.rating,
      summary:     r.summary,
      keyPoints:   (() => { try { return JSON.parse(r.keyPoints ?? '[]') } catch { return [] } })(),
      customer:    r.lead ? { name: r.lead.name, phone: r.lead.phone } : null,
      createdAt:   r.createdAt,
    }))

    return NextResponse.json({ answer, sources })

  } catch (err) {
    console.error('[search]', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
