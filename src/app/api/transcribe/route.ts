import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/ai/transcribe'
import { getLangConfig } from '@/lib/config/language'
import { requireEmbedApiAuth, getTenantFromRequest } from '@/lib/security/embed-auth'
import { normalizeSpeechTranscript } from '@/lib/utils/normalize-speech'
export { OPTIONS } from '@/lib/utils/cors'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authError = requireEmbedApiAuth(req)
  if (authError) return authError

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const audio = formData.get('audio') as File | null
  if (!audio || audio.size === 0) {
    return NextResponse.json({ error: 'No audio file received' }, { status: 400 })
  }

  if (audio.size < 4000) {
    return NextResponse.json({ text: '' })
  }

  try {
    const tenant = getTenantFromRequest(req)
    const lang   = getLangConfig(tenant.languageMode)
    const raw    = await transcribeAudio(audio, lang.whisperCode, tenant.openaiApiKey)
    const text   = normalizeSpeechTranscript(raw)
    return NextResponse.json({ text })
  } catch (err) {
    console.error('[transcribe]', err)
    const message = String(err)
    const isMissingProvider = message.includes('OPENAI_API_KEY')
    const isInvalidProviderKey = message.includes('401') || message.toLowerCase().includes('invalid api key')
    return NextResponse.json(
      {
        error: isInvalidProviderKey
          ? 'Transcription provider API key is invalid'
          : isMissingProvider
            ? 'Transcription provider is not configured'
            : 'Transcription failed',
      },
      { status: isMissingProvider || isInvalidProviderKey ? 503 : 500 }
    )
  }
}
