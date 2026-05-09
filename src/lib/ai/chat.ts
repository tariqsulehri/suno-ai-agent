import { getLLMClient, CHAT_MODEL, getProvider } from './client'
import { buildSystemPrompt } from '@/lib/config/prompt'
import { detectLanguage } from '@/lib/utils/detect-language'
import type { TenantConfig } from '@/lib/tenants/types'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

/**
 * Returns a streaming OpenAI chat completion for the given tenant.
 * The caller is responsible for consuming the stream.
 */
interface ShopInfo { name: string; city?: string | null; address?: string | null }

export async function streamChatReply(
  messages: ChatMessage[],
  tenant: TenantConfig,
  shop?: ShopInfo
) {
  const client   = getLLMClient()
  const provider = getProvider()

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  const detectedLanguage = lastUserMsg
    ? detectLanguage(lastUserMsg.content, tenant.supportedLanguages) ?? undefined
    : undefined

  const systemPrompt = buildSystemPrompt(tenant, detectedLanguage, shop)

  return client.chat.completions.create({
    model:       CHAT_MODEL[provider],
    max_tokens:  280,   // 2 visible sentences (~80 tokens) + hidden tokens (~180 tokens)
    temperature: 0.5,   // lower = more consistent, less rambling
    stream:      true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  })
}

/**
 * Split accumulated text into complete sentences and a leftover remainder.
 * Fires on: . ! ? and common multilingual sentence-ending punctuation.
 */
export function extractSentences(text: string): {
  sentences: string[]
  remainder: string
} {
  const sentences: string[] = []
  const pattern = /[^.!?।؟。！？]+[.!?।؟。！？]+(\s|$)/g
  let match: RegExpExecArray | null
  let lastIndex = 0

  while ((match = pattern.exec(text)) !== null) {
    const sentence = match[0].trim()
    if (sentence.length >= 8) sentences.push(sentence)
    lastIndex = pattern.lastIndex
  }

  return {
    sentences,
    remainder: text.slice(lastIndex).trimStart(),
  }
}
