'use client'

import { useRef, useCallback, useEffect } from 'react'

// Synthesizes a short digital blip using Web Audio API — no audio files needed.
// Plays one blip per character chunk as the agent reply streams in.

const MIN_INTERVAL_MS = 38   // throttle: at most one blip per 38ms
const BASE_FREQ       = 180  // Hz — low digital click
const FREQ_JITTER     = 40   // ± random variance so it doesn't drone
const DURATION        = 0.028 // seconds per blip
const GAIN            = 0.07  // very quiet — ambient, not intrusive

export function useTypingSound(enabled = true) {
  const ctxRef      = useRef<AudioContext | null>(null)
  const lastFiredAt = useRef(0)
  const prevLenRef  = useRef(0)

  // Lazily create AudioContext on first use (browsers block creation before gesture)
  function getCtx(): AudioContext | null {
    if (!enabled) return null
    if (!ctxRef.current) {
      try {
        ctxRef.current = new AudioContext()
      } catch {
        return null
      }
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume().catch(() => {})
    }
    return ctxRef.current
  }

  const playBlip = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return

    const now = performance.now()
    if (now - lastFiredAt.current < MIN_INTERVAL_MS) return
    lastFiredAt.current = now

    const t    = ctx.currentTime
    const freq = BASE_FREQ + (Math.random() * FREQ_JITTER * 2 - FREQ_JITTER)

    // Oscillator — main click tone
    const osc = ctx.createOscillator()
    osc.type  = 'square'
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + DURATION)

    // Gain envelope — fast attack, exponential decay
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(GAIN, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + DURATION)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + DURATION)
  }, [enabled])  // eslint-disable-line react-hooks/exhaustive-deps

  // Call this with the current partialReply string each render.
  // Fires a blip when new characters have arrived since last call.
  const onTextGrow = useCallback((text: string) => {
    if (!enabled || !text) { prevLenRef.current = 0; return }
    if (text.length > prevLenRef.current) {
      playBlip()
    }
    prevLenRef.current = text.length
  }, [enabled, playBlip])

  // Reset length tracking when text clears (new reply starting)
  useEffect(() => {
    return () => { prevLenRef.current = 0 }
  }, [])

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {})
      ctxRef.current = null
    }
  }, [])

  return { onTextGrow }
}
