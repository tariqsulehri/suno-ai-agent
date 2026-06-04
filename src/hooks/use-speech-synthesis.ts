'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

// BCP 47 language codes — same map as use-speech-recognition
const LANG_MAP: Record<string, string> = {
  english: 'en-US', urdu: 'ur-PK',   hindi: 'hi-IN',   arabic: 'ar-SA',
  spanish: 'es-ES', french: 'fr-FR',  german: 'de-DE',  chinese: 'zh-CN',
  japanese: 'ja-JP', portuguese: 'pt-BR', turkish: 'tr-TR', russian: 'ru-RU',
  italian: 'it-IT', dutch: 'nl-NL',   korean: 'ko-KR',  bengali: 'bn-BD',
  punjabi: 'pa-IN',
}

interface Options {
  /** Friendly language name e.g. 'English'. Default 'English'. */
  language?:      string
  onPlaybackEnd?: () => void
}

interface Return {
  isPlaying:   boolean
  enqueue:     (text: string) => void
  stopAll:     () => void
}

export function useSpeechSynthesis({ language = 'English', onPlaybackEnd }: Options): Return {
  const [isPlaying, setIsPlaying] = useState(false)

  const queueRef   = useRef<string[]>([])
  const busyRef    = useRef(false)
  const abortRef   = useRef(false)
  const langCode   = LANG_MAP[language.toLowerCase()] ?? 'en-US'

  // Chrome bug: voices load asynchronously; wait for them before first speak
  const [voicesReady, setVoicesReady] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const load = () => setVoicesReady(speechSynthesis.getVoices().length > 0)
    load()
    speechSynthesis.addEventListener('voiceschanged', load)
    return () => speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  const processNext = useCallback(() => {
    if (busyRef.current || abortRef.current) return
    if (queueRef.current.length === 0) {
      setIsPlaying(false)
      onPlaybackEnd?.()
      return
    }

    const text = queueRef.current.shift()!
    if (!text.trim()) { processNext(); return }

    busyRef.current = true
    setIsPlaying(true)

    const utt  = new SpeechSynthesisUtterance(text)
    utt.lang   = langCode
    utt.rate   = 1.05
    utt.pitch  = 1.0

    // Pick a matching voice if available
    const voices = speechSynthesis.getVoices()
    const match  = voices.find(v => v.lang.startsWith(langCode.split('-')[0]))
    if (match) utt.voice = match

    utt.onend = () => {
      busyRef.current = false
      if (!abortRef.current) processNext()
    }
    utt.onerror = () => {
      busyRef.current = false
      if (!abortRef.current) processNext()
    }

    speechSynthesis.speak(utt)
  }, [langCode, onPlaybackEnd])

  const enqueue = useCallback((text: string) => {
    if (!text.trim()) return
    queueRef.current.push(text)
    // Defer until voices are loaded (Chrome)
    if (voicesReady) {
      processNext()
    } else {
      const wait = setInterval(() => {
        if (speechSynthesis.getVoices().length > 0) {
          clearInterval(wait)
          processNext()
        }
      }, 50)
    }
  }, [voicesReady, processNext])

  const stopAll = useCallback(() => {
    abortRef.current = true
    queueRef.current = []
    busyRef.current  = false
    speechSynthesis.cancel()
    setIsPlaying(false)
    // Reset abort flag after a tick so future enqueues work
    setTimeout(() => { abortRef.current = false }, 0)
  }, [])

  // Cancel on unmount
  useEffect(() => () => { speechSynthesis.cancel() }, [])

  return { isPlaying, enqueue, stopAll }
}
