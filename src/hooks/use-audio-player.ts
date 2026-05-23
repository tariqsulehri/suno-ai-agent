'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface UseAudioPlayerOptions {
  requestHeaders?: Record<string, string>
  onPlaybackStart?: () => void
  onPlaybackEnd?:   () => void
  onPlaybackError?: (message: string) => void
}

interface UseAudioPlayerReturn {
  isPlaying:  boolean
  enqueue:    (text: string) => void
  stopAll:    () => void
}

/**
 * Sentence-pipeline audio player.
 *
 * Maintains an ordered queue of text sentences.
 * For each sentence it:
 *   1. Fetches audio from /api/speak
 *   2. Plays it immediately via HTML Audio
 *   3. Advances to the next sentence when done
 *
 * This creates a low-latency pipeline: the first sentence plays while
 * subsequent sentences are still being fetched.
 */
export function useAudioPlayer({
  requestHeaders,
  onPlaybackStart,
  onPlaybackEnd,
  onPlaybackError,
}: UseAudioPlayerOptions): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false)

  const queueRef      = useRef<string[]>([])
  const playingRef    = useRef(false)
  const currentAudio  = useRef<HTMLAudioElement | null>(null)
  const abortRef      = useRef(false)
  const fetchCtrlRef  = useRef(new AbortController())
  const requestHeadersRef = useRef<Record<string, string>>(requestHeaders ?? {})
  const onPlaybackErrorRef = useRef(onPlaybackError)
  requestHeadersRef.current = requestHeaders ?? {}
  onPlaybackErrorRef.current = onPlaybackError

  const fetchBlob = useCallback(async (text: string): Promise<Blob | null> => {
    const ctrl = new AbortController()
    fetchCtrlRef.current = ctrl
    try {
      const res = await fetch('/api/speak', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...requestHeadersRef.current },
        body:    JSON.stringify({ text }),
        signal:  ctrl.signal,
      })
      if (!res.ok || ctrl.signal.aborted) {
        let message = `Speech playback failed (${res.status})`
        try {
          const data = await res.json()
          if (typeof data?.error === 'string') message = data.error
        } catch {}
        onPlaybackErrorRef.current?.(message)
        return null
      }
      return await res.blob()
    } catch {
      return null
    }
  }, [])

  const processQueue = useCallback(async () => {
    if (playingRef.current) return
    if (queueRef.current.length === 0) return

    playingRef.current = true
    abortRef.current   = false
    setIsPlaying(true)
    onPlaybackStart?.()

    // Prefetch the first sentence immediately
    let prefetched: Promise<Blob | null> = fetchBlob(queueRef.current[0])

    while (queueRef.current.length > 0 && !abortRef.current) {
      queueRef.current.shift()  // advance queue; blob already prefetched above

      // Wait for the already-in-flight fetch (started either above or at end of last iteration)
      const blob = await prefetched
      if (abortRef.current) break
      if (!blob) continue

      // Kick off the NEXT sentence fetch while we play the current one
      if (queueRef.current.length > 0) {
        prefetched = fetchBlob(queueRef.current[0])
      }

      const url = URL.createObjectURL(blob)
      await new Promise<void>((resolve) => {
        const audio = new Audio(url)
        currentAudio.current = audio

        audio.onended = () => {
          URL.revokeObjectURL(url)
          currentAudio.current = null
          resolve()
        }
        audio.onerror = () => {
          URL.revokeObjectURL(url)
          currentAudio.current = null
          resolve()
        }

        audio.play().catch(resolve)
      })
    }

    playingRef.current = false
    setIsPlaying(false)
    onPlaybackEnd?.()
  }, [fetchBlob, onPlaybackStart, onPlaybackEnd])

  const enqueue = useCallback(
    (text: string) => {
      if (!text.trim()) return
      queueRef.current.push(text)
      processQueue()
    },
    [processQueue]
  )

  const stopAll = useCallback(() => {
    fetchCtrlRef.current.abort()
    abortRef.current = true
    queueRef.current = []

    if (currentAudio.current) {
      currentAudio.current.pause()
      currentAudio.current = null
    }

    playingRef.current = false
    setIsPlaying(false)
  }, [])

  useEffect(() => stopAll, [stopAll])

  return { isPlaying, enqueue, stopAll }
}
