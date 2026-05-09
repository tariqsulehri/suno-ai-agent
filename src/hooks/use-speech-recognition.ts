'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

// ── Minimal Web Speech API types (not in default TS lib) ──────────────────────
interface SR {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start():  void
  stop():   void
  abort():  void
  onstart:  (() => void) | null
  onresult: ((ev: SREvent) => void) | null
  onerror:  ((ev: { error: string }) => void) | null
  onend:    (() => void) | null
}
interface SRResult  { readonly isFinal: boolean; [i: number]: { readonly transcript: string } }
interface SREvent   { readonly resultIndex: number; readonly results: { readonly length: number; [i: number]: SRResult } }
type      SRWindow  = Window & { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }

// ── BCP 47 language codes ─────────────────────────────────────────────────────
const LANG_MAP: Record<string, string> = {
  english:    'en-US',
  urdu:       'ur-PK',
  hindi:      'hi-IN',
  arabic:     'ar-SA',
  spanish:    'es-ES',
  french:     'fr-FR',
  german:     'de-DE',
  chinese:    'zh-CN',
  japanese:   'ja-JP',
  portuguese: 'pt-BR',
  turkish:    'tr-TR',
  russian:    'ru-RU',
  italian:    'it-IT',
  dutch:      'nl-NL',
  korean:     'ko-KR',
  bengali:    'bn-BD',
  punjabi:    'pa-IN',
}

// ── Options / Return ──────────────────────────────────────────────────────────
interface Options {
  enabled?:     boolean
  language?:    string
  onTranscript: (text: string) => void
  onError?:     (message: string) => void
}

export interface UseSpeechRecognitionReturn {
  isRecording:  boolean
  hasSpeech:    boolean
  isSupported:  boolean
  /** Live partial transcript shown while the user speaks */
  liveText:     string
  start: () => Promise<void>
  stop:  () => void
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useSpeechRecognition({
  enabled      = true,
  language     = 'English',
  onTranscript,
  onError,
}: Options): UseSpeechRecognitionReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [hasSpeech,   setHasSpeech]   = useState(false)
  const [liveText,    setLiveText]     = useState('')

  const recRef       = useRef<SR | null>(null)
  const finalTextRef = useRef('')

  // Computed after mount so server and client start with the same value (false)
  const [isSupported, setIsSupported] = useState(false)
  useEffect(() => {
    setIsSupported(
      !!((window as SRWindow).SpeechRecognition ?? (window as SRWindow).webkitSpeechRecognition)
    )
  }, [])

  // On unmount: null all handlers BEFORE aborting so Chrome's internal speech
  // service message channel is closed immediately rather than left in an
  // "awaiting async response" state — which is what generates the
  // "message channel closed" console error.
  useEffect(() => {
    return () => {
      const rec = recRef.current
      if (!rec) return
      rec.onstart  = null
      rec.onresult = null
      rec.onerror  = null
      rec.onend    = null   // prevent onTranscript firing after unmount
      try { rec.abort() } catch { /* ignore */ }
      recRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const start = useCallback(async () => {
    if (!enabled || !isSupported) return

    const Ctor = (window as SRWindow).SpeechRecognition
               ?? (window as SRWindow).webkitSpeechRecognition!

    const rec = new Ctor()
    recRef.current       = rec
    finalTextRef.current = ''

    rec.lang            = LANG_MAP[language.toLowerCase()] ?? 'en-US'
    rec.continuous      = true    // record until stop() is called
    rec.interimResults  = true    // stream partials for live display
    rec.maxAlternatives = 1

    rec.onstart = () => {
      setIsRecording(true)
      setHasSpeech(false)
      setLiveText('')
    }

    rec.onresult = (ev: SREvent) => {
      setHasSpeech(true)
      let interim = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]
        if (r.isFinal) {
          finalTextRef.current += r[0].transcript + ' '
        } else {
          interim += r[0].transcript
        }
      }
      setLiveText((finalTextRef.current + interim).trimStart())
    }

    rec.onerror = (ev: { error: string }) => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') return
      onError?.(ev.error)
      setIsRecording(false)
      setHasSpeech(false)
      setLiveText('')
    }

    rec.onend = () => {
      setIsRecording(false)
      setHasSpeech(false)
      setLiveText('')
      const text = finalTextRef.current.trim()
      if (text) onTranscript(text)
      recRef.current = null
    }

    rec.start()
  }, [enabled, isSupported, language, onTranscript, onError])

  return { isRecording, hasSpeech, isSupported, liveText, start, stop }
}
