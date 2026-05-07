import { NextRequest } from 'next/server'
import { streamChatReply, extractSentences } from '@/lib/ai/chat'
import { requireEmbedApiAuth, getTenantFromRequest } from '@/lib/security/embed-auth'
import { db } from '@/lib/db/client'
import type { ChatMessage } from '@/lib/ai/chat'
export { OPTIONS } from '@/lib/utils/cors'

export const dynamic = 'force-dynamic'

/**
 * Streaming chat endpoint — emits Server-Sent Events.
 *
 * Event shapes:
 *   { token: string }                                    — incremental token for live display
 *   { sentence: string }                                 — complete sentence ready for TTS
 *   { done: true, fullText: string, endCall: boolean }   — stream finished
 *   { lead: LeadData }                                   — lead capture update
 *   { review: ReviewData }                               — review classification update
 *   { error: string }                                    — something went wrong
 */
export async function POST(req: NextRequest) {
  const authError = requireEmbedApiAuth(req)
  if (authError) return authError

  const tenant   = getTenantFromRequest(req)
  const shopCode = req.headers.get('x-embed-shop') ?? ''
  const shop     = shopCode
    ? await db.shop.findFirst({ where: { branchCode: shopCode } })
    : null

  let messages: ChatMessage[]
  try {
    const body = await req.json()
    messages = body.messages
    if (!Array.isArray(messages)) throw new Error('messages must be an array')
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }

  const encoder = new TextEncoder()

  function send(payload: object): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
  }

  // Strip hidden tokens + any truncated token debris (e.g. dangling "}]" from cut-off tokens)
  const TOKEN_RE   = /\[(LEAD|REVIEW|END_CALL):([\s\S]*?)\]/g
  function stripTokens(text: string): string {
    return text
      .replace(TOKEN_RE, '')
      .replace(/\[END_CALL\]/g, '')
      .replace(/\s*\}?\]?\s*$/, '')    // remove trailing debris from truncated tokens
      .replace(/\s{2,}/g, ' ')
      .trim()
  }
  function extractToken<T>(text: string, name: string): T | null {
    const re = new RegExp(`\\[${name}:([\\s\\S]*?)\\]`)
    const m  = text.match(re)
    if (!m) return null
    try { return JSON.parse(m[1]) as T } catch { return null }
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await streamChatReply(messages, tenant, shop ?? undefined)

        let accumulated    = ''
        let sentenceBuffer = ''

        for await (const chunk of completion) {
          const token       = chunk.choices[0]?.delta?.content ?? ''
          const finishReason = chunk.choices[0]?.finish_reason

          if (token) {
            accumulated    += token
            sentenceBuffer += token
            controller.enqueue(send({ token }))

            const { sentences, remainder } = extractSentences(sentenceBuffer)
            sentenceBuffer = remainder
            for (const sentence of sentences) {
              const clean = stripTokens(sentence)
              if (clean) controller.enqueue(send({ sentence: clean }))
            }
          }

          if (finishReason === 'stop') {
            const tail = stripTokens(sentenceBuffer.trim())
            if (tail.length > 0) controller.enqueue(send({ sentence: tail }))

            const lead     = extractToken<Record<string, string | null>>(accumulated, 'LEAD')
            const review   = extractToken<Record<string, unknown>>(accumulated, 'REVIEW')
            const endCall  = accumulated.includes('[END_CALL]')
            const cleaned  = stripTokens(accumulated)
            const fullText = cleaned

            if (lead)   controller.enqueue(send({ lead }))
            if (review) controller.enqueue(send({ review }))
            controller.enqueue(send({ done: true, fullText, endCall }))
            controller.close()
          }
        }
      } catch (err) {
        console.error('[chat]', err)
        const msg = String(err).includes('429')
          ? 'OpenAI quota exceeded — please add credits at platform.openai.com'
          : 'Chat failed — please try again'
        controller.enqueue(send({ error: msg }))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
