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
    const isQuota = String(err).includes('429')
    const isMissingProvider = String(err).includes('OPENAI_API_KEY') || String(err).includes('ELEVENLABS_API_KEY')
    return NextResponse.json(
      { error: isMissingProvider ? 'TTS provider is not configured' : isQuota ? 'TTS quota exceeded' : 'TTS failed' },
      { status: isQuota || isMissingProvider ? 503 : 500 }
    )
  }
}
