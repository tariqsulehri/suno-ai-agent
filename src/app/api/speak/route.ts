import { NextRequest, NextResponse } from 'next/server'
import { synthesizeSpeech } from '@/lib/ai/tts'
import { getVoiceForLanguage } from '@/lib/config/voice'
import { detectLanguage } from '@/lib/utils/detect-language'
import { requireEmbedApiAuth, getTenantFromRequest } from '@/lib/security/embed-auth'
import type { SpeakRequest } from '@/types'
export { OPTIONS } from '@/lib/utils/cors'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authError = requireEmbedApiAuth(req)
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
    const tenant           = getTenantFromRequest(req)
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
    const message = String(err)
    const isQuota = message.includes('429')
    const isMissingProvider = message.includes('OPENAI_API_KEY') || message.includes('ELEVENLABS_API_KEY')
    const isInvalidProviderKey = message.includes('401') || message.toLowerCase().includes('invalid api key')
    return NextResponse.json(
      {
        error: isInvalidProviderKey
          ? 'TTS provider API key is invalid'
          : isMissingProvider
            ? 'TTS provider is not configured'
            : isQuota
              ? 'TTS quota exceeded'
              : 'TTS failed',
      },
      { status: isQuota || isMissingProvider || isInvalidProviderKey ? 503 : 500 }
    )
  }
}
