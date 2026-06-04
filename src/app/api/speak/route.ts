import { NextRequest, NextResponse } from 'next/server'
import { synthesizeSpeech } from '@/lib/ai/tts'
import { isInvalidApiKeyError, isMissingProviderError, isQuotaError } from '@/lib/ai/errors'
import { getVoiceForLanguage } from '@/lib/config/voice'
import { detectLanguage } from '@/lib/utils/detect-language'
import { requireEmbedApiAuth, getTenantFromRequest } from '@/lib/security/embed-auth'
import { getSessionFromRequest } from '@/lib/auth/session'
import { getTenantById } from '@/lib/tenants/registry'
import type { SpeakRequest } from '@/types'
export { OPTIONS } from '@/lib/utils/cors'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Agent sessions bypass embed auth (same pattern as /api/chat and /api/config)
  const session = await getSessionFromRequest(req)
  const sessionTenant = session?.role === 'agent' && session.tenantId
    ? getTenantById(session.tenantId)
    : null

  const authError = sessionTenant ? null : requireEmbedApiAuth(req)
  if (authError) return authError

  let body: SpeakRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { text } = body

  if (!text?.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  try {
    const tenant           = sessionTenant ?? getTenantFromRequest(req)
    const detectedLanguage = detectLanguage(text, tenant.supportedLanguages)
    const resolvedVoice    = getVoiceForLanguage(detectedLanguage, tenant)
    const resolvedProvider = tenant.ttsProvider

    const audioBuffer = await synthesizeSpeech(text, resolvedVoice, resolvedProvider, tenant.openaiApiKey)

    return new Response(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type':   'audio/mpeg',
        'Content-Length': String(audioBuffer.length),
        'Cache-Control':  'no-store',
        'X-TTS-Provider': resolvedProvider,
        'X-TTS-Voice':    resolvedVoice,
      },
    })
  } catch (err) {
    console.error('[speak]', err)
    const isQuota = isQuotaError(err)
    const isInvalidKey = isInvalidApiKeyError(err)
    const isMissingProvider =
      isMissingProviderError(err, 'OPENAI_API_KEY') ||
      isMissingProviderError(err, 'ELEVENLABS_API_KEY')

    return NextResponse.json(
      {
        error: isInvalidKey
          ? 'OpenAI API key is invalid'
          : isMissingProvider
            ? 'TTS provider is not configured'
            : isQuota
              ? 'TTS quota exceeded'
              : 'TTS failed',
      },
      { status: isInvalidKey ? 401 : isQuota || isMissingProvider ? 503 : 500 }
    )
  }
}
