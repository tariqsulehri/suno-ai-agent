import { z } from 'zod'

const envSchema = z.object({
  // ── OpenAI — required for chat, speech synthesis, and transcription ─────────
  OPENAI_API_KEY: z.string().optional(),

  // ── ElevenLabs TTS — only needed when a tenant uses ttsProvider: "elevenlabs" ─
  ELEVENLABS_API_KEY:  z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default('pNInz6obpgDQGcFmaJgB'),

  // ── Embed security ────────────────────────────────────────────────────────────
  EMBED_AUTH_ENABLED: z.enum(['true', 'false']).default('false'),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const root   = result.error.flatten().formErrors
    const lines  = [
      ...Object.entries(errors).map(([k, v]) => `  ${k}: ${v?.join(', ')}`),
      ...root,
    ]
    throw new Error(`\n[env] Invalid environment variables:\n${lines.join('\n')}\n`)
  }
  return result.data
}

export const env = validateEnv()

export function hasLLMProvider(config: Env = env): boolean {
  return Boolean(config.OPENAI_API_KEY)
}

export function requireLLMProvider(config: Env = env): void {
  if (!hasLLMProvider(config)) {
    throw new Error('Set OPENAI_API_KEY before using AI routes')
  }
}
