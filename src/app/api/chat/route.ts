import { NextRequest } from 'next/server'
import { streamChatReply, extractSentences } from '@/lib/ai/chat'
import { requireEmbedApiAuth, getTenantFromRequest } from '@/lib/security/embed-auth'
import { db } from '@/lib/db/client'
import { getSessionFromRequest } from '@/lib/auth/session'
import { getTenantById } from '@/lib/tenants/registry'
import type { ChatMessage } from '@/lib/ai/chat'
import type { TenantConfig } from '@/lib/tenants/types'
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
  const session = await getSessionFromRequest(req)
  const sessionTenant = session?.role === 'agent' && session.tenantId
    ? getTenantById(session.tenantId)
    : null

  const authError = sessionTenant ? null : requireEmbedApiAuth(req)
  if (authError) return authError

  const tenant   = sessionTenant ?? getTenantFromRequest(req)
  const shopCode = req.headers.get('x-embed-shop') ?? ''
  const shop     = session?.role === 'agent' && session.shopId
    ? await db.shop.findUnique({ where: { id: session.shopId } })
    : await resolveShopForChat(tenant, shopCode)

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
  function findJsonToken(text: string, name: string): { value: string; start: number; end: number } | null {
    const marker = `[${name}:`
    const start = text.indexOf(marker)
    if (start < 0) return null

    const jsonStart = text.indexOf('{', start + marker.length)
    if (jsonStart < 0) return null

    let depth = 0
    let inString = false
    let escaped = false

    for (let i = jsonStart; i < text.length; i++) {
      const ch = text[i]

      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = inString
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue

      if (ch === '{') depth++
      if (ch === '}') {
        depth--
        if (depth === 0) {
          const close = text[i + 1] === ']' ? i + 2 : i + 1
          return { value: text.slice(jsonStart, i + 1), start, end: close }
        }
      }
    }

    return null
  }

  function stripTokens(text: string): string {
    let cleaned = text
    for (const name of ['LEAD', 'REVIEW']) {
      let token = findJsonToken(cleaned, name)
      while (token) {
        cleaned = `${cleaned.slice(0, token.start)}${cleaned.slice(token.end)}`
        token = findJsonToken(cleaned, name)
      }
    }
    return cleaned
      .replace(/\[END_CALL\]/g, '')
      .replace(/\s*\}?\]?\s*$/, '')    // remove trailing debris from truncated tokens
      .replace(/\s{2,}/g, ' ')
      .trim()
  }
  function extractToken<T>(text: string, name: string): T | null {
    const token = findJsonToken(text, name)
    if (!token) return null
    try { return JSON.parse(token.value) as T } catch { return null }
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await streamChatReply(messages, tenant, shop ?? undefined)

        let accumulated    = ''
        let sentenceBuffer = ''
        let finalEmitted   = false

        function emitFinal() {
          if (finalEmitted) return
          finalEmitted = true
          const tail = stripTokens(sentenceBuffer.trim())
          if (tail.length > 0) controller.enqueue(send({ sentence: tail }))
          const lead    = extractToken<Record<string, string | null>>(accumulated, 'LEAD')
          const review  = extractToken<Record<string, unknown>>(accumulated, 'REVIEW')
          const endCall = accumulated.includes('[END_CALL]')
          const cleaned = stripTokens(accumulated)
          if (lead)   controller.enqueue(send({ lead }))
          if (review) controller.enqueue(send({ review }))
          controller.enqueue(send({ done: true, fullText: cleaned, endCall }))
          controller.close()
        }

        for await (const chunk of completion) {
          const token        = chunk.choices[0]?.delta?.content ?? ''
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

          // Emit done on any finish reason (stop, length, content_filter, etc.)
          if (finishReason) emitFinal()
        }

        // Fallback: stream exhausted without a finish_reason chunk
        emitFinal()
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

async function resolveShopForChat(tenant: TenantConfig, shopCode: string) {
  try {
    return shopCode
      ? await db.shop.findFirst({ where: { tenantId: tenant.id, branchCode: shopCode } })
          ?? await db.shop.findFirst({ where: { tenantId: tenant.id } })
      : await db.shop.findFirst({ where: { tenantId: tenant.id } })
  } catch (err) {
    console.error('[chat] Shop lookup skipped:', err)
    return null
  }
}
