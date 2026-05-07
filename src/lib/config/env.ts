import { z } from 'zod'

const envSchema = z.object({
  // ── LLM providers — set ONE (Groq is free; OpenAI requires credits) ──────────
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY:   z.string().optional(),

  // ── ElevenLabs TTS — only needed when a tenant uses ttsProvider: "elevenlabs" ─
  ELEVENLABS_API_KEY:  z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default('pNInz6obpgDQGcFmaJgB'),

  // ── Embed security ────────────────────────────────────────────────────────────
  EMBED_AUTH_ENABLED: z.enum(['true', 'false']).default('false'),
}).refine(
  (d) => !!(d.OPENAI_API_KEY || d.GROQ_API_KEY),
  { message: 'Set either OPENAI_API_KEY or GROQ_API_KEY in your .env.local' }
)

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
