import OpenAI from 'openai'
import { env, requireLLMProvider } from '@/lib/config/env'

// ── Provider detection ────────────────────────────────────────────────────────
// Groq is free and OpenAI-compatible — preferred when GROQ_API_KEY is set.
// Falls back to OpenAI when only OPENAI_API_KEY is present.

export type LLMProvider = 'groq' | 'openai'

export function getProvider(): LLMProvider {
  requireLLMProvider()
  return env.GROQ_API_KEY ? 'groq' : 'openai'
}

// Model names per provider
export const CHAT_MODEL: Record<LLMProvider, string> = {
  groq:   'llama-3.3-70b-versatile',
  openai: 'gpt-4o-mini',       // ~33× cheaper than gpt-4o, more than enough for review chat
}
export const SUMMARY_MODEL: Record<LLMProvider, string> = {
  groq:   'llama-3.1-8b-instant',   // fast + free for short summaries
  openai: 'gpt-4o-mini',
}

// ── Singleton client ──────────────────────────────────────────────────────────
let _client: OpenAI | null = null
let _openaiClient: OpenAI | null = null

export function getLLMClient(apiKey?: string): OpenAI {
  if (apiKey) return new OpenAI({ apiKey })
  requireLLMProvider()
  if (!_client) {
    if (env.GROQ_API_KEY) {
      _client = new OpenAI({
        apiKey:  env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      })
    } else {
      _client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
    }
  }
  return _client
}

export function getOpenAIClient(apiKey?: string): OpenAI {
  const resolvedApiKey = apiKey || env.OPENAI_API_KEY
  if (!resolvedApiKey) {
    throw new Error('OPENAI_API_KEY is required before using OpenAI audio or embedding routes')
  }

  if (apiKey) return new OpenAI({ apiKey })
  if (!_openaiClient) {
    _openaiClient = new OpenAI({ apiKey: resolvedApiKey })
  }
  return _openaiClient
}
