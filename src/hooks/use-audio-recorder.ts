'use client'

import { useRef, useState, useCallback } from 'react'

interface UseAudioRecorderOptions {
  /** When false the hook is a no-op — start/stop do nothing. Default true. */
  enabled?: boolean
  /** RMS level below which silence is declared (0–128 scale). Default 3. */
  silenceThreshold?: number
  /**
   * Milliseconds of silence that triggers auto-stop AFTER speech has been
   * detected. Default 1000ms. Ignored when continuous=true.
   */
  silenceAfterSpeech?: number
  /**
   * Milliseconds to wait for the user to START speaking before auto-stopping.
   * Ignored when continuous=true.
   */
  preSpeechTimeout?: number
  /**
   * When true: records indefinitely until stop() is called externally.
   * VAD auto-stop is disabled. Speech activity is still tracked for UI feedback.
   */
  continuous?: boolean
  onAudioReady: (blob: Blob) => void
}

interface UseAudioRecorderReturn {
  isRecording: boolean
  hasSpeech:   boolean
  start: () => Promise<void>
  stop:  () => void
}

export function useAudioRecorder({
  enabled            = true,
  silenceThreshold   = 3,
  silenceAfterSpeech = 1000,
  preSpeechTimeout   = 3000,
  continuous         = false,
  onAudioReady,
}: UseAudioRecorderOptions): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [hasSpeech,   setHasSpeech]   = useState(false)

  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current)
      vadTimerRef.current = null
    }
    audioCtxRef.current?.close()
    audioCtxRef.current = null

    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      mediaRecRef.current.stop()
    }
    setIsRecording(false)
    setHasSpeech(false)
  }, [])

  const start = useCallback(async () => {
    if (!enabled) return     // no-op when disabled (e.g. when using Web Speech API)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      throw new Error('Microphone access denied. Please allow microphone in browser settings.')
    }

    chunksRef.current = []

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const rec = new MediaRecorder(stream, { mimeType })
    mediaRecRef.current = rec

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunksRef.current, { type: mimeType })
      onAudioReady(blob)
    }

    rec.start(100)
    setIsRecording(true)
    setHasSpeech(false)

    // ── Speech activity detection (AudioContext + analyser) ────────────────────
    const audioCtx = new AudioContext()
    audioCtxRef.current = audioCtx

    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 512

    const src = audioCtx.createMediaStreamSource(stream)
    src.connect(analyser)

    const data = new Uint8Array(analyser.fftSize)

    if (continuous) {
      // ── Continuous mode: only track speech activity for UI, never auto-stop ──
      vadTimerRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(data)
        const rms = Math.sqrt(
          data.reduce((sum, v) => sum + (v - 128) ** 2, 0) / data.length
        )
        if (rms >= silenceThreshold) setHasSpeech(true)
      }, 100)
    } else {
      // ── Two-tier VAD: auto-stop on silence ────────────────────────────────────
      let speechDetected = false
      let silentMs       = 0
      let waitedMs       = 0

      vadTimerRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(data)
        const rms = Math.sqrt(
          data.reduce((sum, v) => sum + (v - 128) ** 2, 0) / data.length
        )

        if (rms >= silenceThreshold) {
          if (!speechDetected) {
            speechDetected = true
            setHasSpeech(true)
          }
          silentMs = 0
        } else {
          if (!speechDetected) {
            waitedMs += 100
            if (waitedMs >= preSpeechTimeout) stop()
          } else {
            silentMs += 100
            if (silentMs >= silenceAfterSpeech) stop()
          }
        }
      }, 100)
    }
  }, [enabled, silenceThreshold, silenceAfterSpeech, preSpeechTimeout, continuous, onAudioReady, stop])

  return { isRecording, hasSpeech, start, stop }
}
