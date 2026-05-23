import OpenAI from 'openai'
import { env, requireLLMProvider } from '@/lib/config/env'

// The MVP uses OpenAI explicitly for chat, summaries, speech, transcription,
// and embeddings. No alternate OpenAI-compatible provider is selected from env.
export const CHAT_MODEL = 'gpt-4o-mini'
export const SUMMARY_MODEL = 'gpt-4o-mini'

let _client: OpenAI | null = null
let _openaiClient: OpenAI | null = null

export function getLLMClient(apiKey?: string): OpenAI {
  if (apiKey) return new OpenAI({ apiKey })
  requireLLMProvider()
  if (!_client) {
    _client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
  }
  return _client
}

export function getOpenAIClient(apiKey?: string): OpenAI {
  const resolvedApiKey = apiKey || env.OPENAI_API_KEY
  if (!resolvedApiKey) {
    throw new Error('OPENAI_API_KEY is required before using OpenAI routes')
  }

  if (apiKey) return new OpenAI({ apiKey })
  if (!_openaiClient) {
    _openaiClient = new OpenAI({ apiKey: resolvedApiKey })
  }
  return _openaiClient
}
