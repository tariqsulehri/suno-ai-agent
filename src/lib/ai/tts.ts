import { getOpenAIClient } from './client'
import { env } from '@/lib/config/env'
import type { OpenAIVoice } from '@/types'

/**
 * Convert text to speech audio (MP3).
 * Both voice and provider are resolved from tenant config by the caller.
 */
export async function synthesizeSpeech(
  text: string,
  voice: string = 'nova',
  provider: 'openai' | 'elevenlabs' = 'openai',
  openaiApiKey?: string
): Promise<Buffer> {
  const normalized = normalizeForSpeech(text)
  if (provider === 'elevenlabs') return synthesizeElevenLabs(normalized)
  return synthesizeOpenAI(normalized, voice as OpenAIVoice, openaiApiKey)
}

// ── Pronunciation normalization ────────────────────────────────────────────────
const PRONUNCIATION_MAP: [RegExp, string][] = [
  [/support agent/gi, 'Support Agent'],
  [/\btkxel\b/gi, 'Teksel'],
]

function normalizeForSpeech(text: string): string {
  return PRONUNCIATION_MAP.reduce(
    (t, [pattern, replacement]) => t.replace(pattern, replacement),
    text
  )
}

// ── OpenAI TTS ─────────────────────────────────────────────────────────────────
async function synthesizeOpenAI(text: string, voice: OpenAIVoice, apiKey?: string): Promise<Buffer> {
  if (!apiKey && !env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for speech synthesis.')
  }
  const client = getOpenAIClient(apiKey)
  const response = await client.audio.speech.create({
    model: 'tts-1',
    voice,
    input: text,
    speed: 1.0,
  })
  return Buffer.from(await response.arrayBuffer())
}

// ── ElevenLabs TTS ─────────────────────────────────────────────────────────────
async function synthesizeElevenLabs(text: string): Promise<Buffer> {
  if (!env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is missing. Add it to .env.local or set ttsProvider to "openai".')
  }

  const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js')
  const { Readable } = await import('stream')

  const client = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY })

  const audioStream = await client.textToSpeech.convert(env.ELEVENLABS_VOICE_ID, {
    text,
    modelId: 'eleven_multilingual_v2',
    voiceSettings: {
      stability:        0.45,
      similarityBoost:  0.80,
      style:            0.35,
      useSpeakerBoost:  true,
    },
  })

  const readable =
    audioStream instanceof Readable
      ? audioStream
      : Readable.fromWeb(audioStream as Parameters<typeof Readable.fromWeb>[0])

  const chunks: Buffer[] = []
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
  }
  return Buffer.concat(chunks)
}
