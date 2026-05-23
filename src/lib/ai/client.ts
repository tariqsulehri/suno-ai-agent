import OpenAI from 'openai'
import { env, requireLLMProvider } from '@/lib/config/env'

// ── OpenAI model configuration ────────────────────────────────────────────────
// The MVP uses OpenAI explicitly for chat, summaries, speech, transcription,
// and embeddings. No alternate OpenAI-compatible provider is selected from env.

export const CHAT_MODEL = 'gpt-4o-mini'
export const SUMMARY_MODEL = 'gpt-4o-mini'

// ── Singleton client ──────────────────────────────────────────────────────────
let _client: OpenAI | null = null

export function getLLMClient(apiKey?: string): OpenAI {
  if (apiKey) return new OpenAI({ apiKey })
  requireLLMProvider()
  if (!_client) {
    _client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
  }
  return _client
}

// Keep old name as alias so other files don't need changes yet
export const getOpenAIClient = getLLMClient
