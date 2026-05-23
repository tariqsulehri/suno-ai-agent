'use client'

import { useReducer, useCallback, useEffect, useRef, useState } from 'react'
import { useAudioRecorder }      from './use-audio-recorder'
import { useAudioPlayer }        from './use-audio-player'
import { useSpeechSynthesis }    from './use-speech-synthesis'
import { useSpeechRecognition }  from './use-speech-recognition'
import type {
  Phase,
  VoiceAgentState,
  VoiceAgentAction,
  Message,
  ChatHistory,
  OpenAIVoice,
  LeadData,
  ReviewData,
  CallSummary,
} from '@/types'

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

// ── Reducer ────────────────────────────────────────────────────────────────────
function reducer(state: VoiceAgentState, action: VoiceAgentAction): VoiceAgentState {
  switch (action.type) {
    case 'CONNECTED':
      return { ...state, phase: 'idle' }

    case 'START_LISTENING':
      return { ...state, phase: 'listening', error: null }

    case 'STOP_LISTENING':
      return { ...state, phase: 'transcribing' }

    case 'TRANSCRIBED': {
      const msg: Message = { id: uid(), role: 'user', content: action.text }
      return {
        ...state,
        phase:        'thinking',
        transcript:   [...state.transcript, msg],
        partialReply: '',
      }
    }

    case 'STREAM_TOKEN':
      return { ...state, partialReply: state.partialReply + action.token }

    case 'REPLY_COMPLETE': {
      const msg: Message = { id: uid(), role: 'assistant', content: action.fullText }
      return {
        ...state,
        phase:        action.endCall ? 'ended' : 'speaking',
        transcript:   action.fullText ? [...state.transcript, msg] : state.transcript,
        partialReply: '',
      }
    }

    case 'LEAD_UPDATE':
      return { ...state, leadData: { ...state.leadData, ...action.lead } }

    case 'REVIEW_UPDATE':
      return { ...state, reviewData: { ...state.reviewData, ...action.review } }

    case 'CALL_SUMMARY':
      return { ...state, callSummary: action.summary }

    case 'SPEAKING_DONE':
      return { ...state, phase: 'idle' }

    case 'ERROR':
      return { ...state, phase: 'error', error: action.message }

    default:
      return state
  }
}

const EMPTY_LEAD: LeadData     = { name: null, email: null, phone: null, company: null, purpose: null }
const EMPTY_REVIEW: ReviewData = { sentiment: null, category: null, subcategory: null, rating: null, items: null }

const initialState: VoiceAgentState = {
  phase:        'connecting',
  transcript:   [],
  partialReply: '',
  error:        null,
  leadData:     EMPTY_LEAD,
  reviewData:   EMPTY_REVIEW,
  callSummary:  null,
}

// ── Public interface ───────────────────────────────────────────────────────────
export interface UseVoiceAgentOptions {
  tenantId?:            string
  token?:               string
  shopCode?:            string  // which shop/branch this agent is deployed at
  defaultOutputMode?:   'voice' | 'text'
  continuousRecording?: boolean
  webSpeech?:           boolean
  browserTts?:          boolean
}

export interface UseVoiceAgentReturn {
  phase:              Phase
  transcript:         Message[]
  partialReply:       string
  error:              string | null
  isRecording:        boolean
  hasSpeech:          boolean
  isPlaying:          boolean
  language:           string
  voice:              OpenAIVoice
  outputMode:         'voice' | 'text'
  leadData:           LeadData
  reviewData:         ReviewData
  callSummary:        CallSummary | null
  agentName:          string
  companyName:        string
  liveTranscript:     string
  webSpeechSupported: boolean
  setVoice:        (v: OpenAIVoice) => void
  setOutputMode:   (m: 'voice' | 'text') => void
  setLanguage:     (lang: string) => void
  stopPlayback: () => void
  toggleMic:    () => void
  pressMic:     () => void
  releaseMic:   () => void
  sendText:     (text: string) => void
  endCall:      () => void
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useVoiceAgent({
  tenantId,
  token,
  shopCode,
  defaultOutputMode   = 'text',
  continuousRecording = false,
  webSpeech           = false,
  browserTts          = false,
}: UseVoiceAgentOptions = {}): UseVoiceAgentReturn {
  const [state, dispatch]     = useReducer(reducer, initialState)
  const [voice, setVoice]     = useState<OpenAIVoice>('nova')
  const [language, setLang]   = useState('English')
  const [agentName, setAgent] = useState('Agent')
  const [companyName, setCompany] = useState('')
  const [outputMode, setOutputModeState] = useState<'voice' | 'text'>(defaultOutputMode)
  const [embedHeaders, setEmbedHeaders]  = useState<Record<string, string>>({})
  const embedHeadersRef = useRef<Record<string, string>>({})

  // Single abort controller for all in-flight network requests.
  // Aborted on unmount and replaced before each new chat stream.
  const networkAbortRef = useRef(new AbortController())

  const voiceRef = useRef<OpenAIVoice>('nova')
  const handleSetVoice = useCallback((v: OpenAIVoice) => {
    voiceRef.current = v
    setVoice(v)
  }, [])

  const outputModeRef = useRef<'voice' | 'text'>(defaultOutputMode)
  const setOutputMode = useCallback((m: 'voice' | 'text') => {
    outputModeRef.current = m
    setOutputModeState(m)
  }, [])

  const historyRef = useRef<ChatHistory>([])
  const stateRef   = useRef(state)
  stateRef.current = state
  const leadRef    = useRef<LeadData>(EMPTY_LEAD)
  const reviewRef  = useRef<ReviewData>(EMPTY_REVIEW)

  // When the user clicks End Call while audio is playing, we don't cut mid-sentence.
  // Instead we set this flag and let onPlaybackEnd complete the transition.
  const endPendingRef = useRef(false)
  const endAfterRecordingRef = useRef(false)

  function onPlaybackEnd() {
    if (endPendingRef.current) {
      endPendingRef.current = false
      completeEndCall()
    } else if (stateRef.current.phase === 'speaking') {
      dispatch({ type: 'SPEAKING_DONE' })
    }
  }

  // ── TTS: API audio player (OpenAI/ElevenLabs) ────────────────────────────────
  const apiPlayer = useAudioPlayer({
    requestHeaders: embedHeaders,
    onPlaybackEnd,
    onPlaybackError: (message) => dispatch({ type: 'ERROR', message }),
  })

  // ── TTS: Browser SpeechSynthesis (free, no API) ───────────────────────────────
  const browserPlayer = useSpeechSynthesis({
    language,
    onPlaybackEnd,
  })

  // Use the right player based on flag
  const { isPlaying, enqueue, stopAll } = browserTts ? browserPlayer : apiPlayer

  // Ref-tracked playing state so streamChat can read it synchronously inside async callbacks.
  // Updated on every render — always reflects latest isPlaying without stale closure.
  const isPlayingRef = useRef(false)
  isPlayingRef.current = isPlaying

  // ── SSE chat stream ───────────────────────────────────────────────────────────
  async function streamChat(messages: ChatHistory, dispatchFn: typeof dispatch | null) {
    // Cancel any previous stream and arm a fresh signal for this one.
    networkAbortRef.current.abort()
    networkAbortRef.current = new AbortController()
    const { signal } = networkAbortRef.current

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...embedHeadersRef.current },
        body:    JSON.stringify({ messages }),
        signal,
      })

      if (!res.ok) throw new Error(`Chat failed (${res.status})`)
      if (!res.body) throw new Error('No response body from /api/chat')

      const reader     = res.body.getReader()
      const decoder    = new TextDecoder()
      let   lineBuffer = ''
      let   receivedDone = false

      async function handleStreamPart(part: string) {
        if (!part.startsWith('data: ')) return
        let event: Record<string, unknown>
        try { event = JSON.parse(part.slice(6)) } catch { return }

        if (event.error) {
          dispatchFn?.({ type: 'ERROR', message: String(event.error) })
          receivedDone = true
          return
        }
        if (event.token)    dispatchFn?.({ type: 'STREAM_TOKEN', token: String(event.token) })
        if (event.sentence) { if (outputModeRef.current === 'voice') enqueue(String(event.sentence)) }
        if (event.lead) {
          leadRef.current = { ...leadRef.current, ...(event.lead as LeadData) }
          dispatchFn?.({ type: 'LEAD_UPDATE', lead: event.lead as LeadData })
        }
        if (event.review) {
          reviewRef.current = { ...reviewRef.current, ...(event.review as ReviewData) }
          dispatchFn?.({ type: 'REVIEW_UPDATE', review: event.review as ReviewData })
        }
        if (event.done) {
          receivedDone = true
          const fullText  = String(event.fullText ?? '')
          const endCall   = Boolean(event.endCall)
          const isPositive = reviewRef.current.sentiment === 'positive'
          historyRef.current.push({ role: 'assistant', content: fullText })

          if (endCall) {
            // Positive: save to DB but skip LLM summarization (no follow-up needed)
            // Others:   full LLM summary + email + DB persist
            await saveCallSummary(dispatchFn, isPositive)
          }

          dispatchFn?.({ type: 'REPLY_COMPLETE', fullText, endCall })

          if (outputModeRef.current === 'text' && !endCall) {
            dispatchFn?.({ type: 'SPEAKING_DONE' })
          } else if (outputModeRef.current === 'voice' && !endCall && !isPlayingRef.current) {
            // Race condition guard: audio already finished before this done event arrived.
            // onPlaybackEnd already fired (phase was not 'speaking' then), so we must
            // dispatch SPEAKING_DONE here or the phase will be stuck at 'speaking'.
            dispatchFn?.({ type: 'SPEAKING_DONE' })
          }
        }
      }

      async function drainBufferedParts(includeTail = false) {
        const parts = lineBuffer.split('\n\n')
        lineBuffer  = parts.pop() ?? ''
        for (const part of parts) await handleStreamPart(part)
        if (includeTail && lineBuffer.trim()) {
          await handleStreamPart(lineBuffer.trim())
          lineBuffer = ''
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (signal.aborted) break

        if (value) lineBuffer += decoder.decode(value, { stream: !done })
        if (done) lineBuffer += decoder.decode()

        await drainBufferedParts(done)
        if (done) break
      }

      // Stream closed without a done event — unblock the UI so the user can retry
      if (!receivedDone && !signal.aborted) {
        dispatchFn?.({ type: 'ERROR', message: 'Response incomplete — please try again.' })
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      dispatchFn?.({ type: 'ERROR', message: String(err) })
    }
  }

  // quick=true  → skip LLM summarization, just persist to DB (used for positive reviews)
  // quick=false → full LLM summary + persist + email (used for complaints/negative/suggestion)
  async function saveCallSummary(dispatchFn: typeof dispatch | null, quick = false) {
    const lead   = leadRef.current
    const review = reviewRef.current

    try {
      const res = await fetch('/api/summarize', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...embedHeadersRef.current },
        body:    JSON.stringify({ messages: historyRef.current, lead, review, quick }),
        signal:  networkAbortRef.current.signal,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(String(data?.error ?? 'Call save failed'))

      dispatchFn?.({ type: 'CALL_SUMMARY', summary: data as CallSummary })
      console.log('[Call Report]', JSON.stringify({ lead, review, ...data }, null, 2))
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      console.error('[summarize]', err)
      dispatchFn?.({ type: 'ERROR', message: 'Call ended, but saving failed. Please retry before closing.' })
    }
  }

  // ── Web Speech API path ───────────────────────────────────────────────────────
  // Called when browser recognition returns the final transcript — no API call needed
  const onSpeechTranscript = useCallback((text: string) => {
    if (!text.trim()) { dispatch({ type: 'CONNECTED' }); return }
    dispatch({ type: 'STOP_LISTENING' })
    dispatch({ type: 'TRANSCRIBED', text })
    historyRef.current.push({ role: 'user', content: text })
    streamChat(historyRef.current, dispatch)
  // streamChat uses only refs/stable values — safe with empty deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const speechRec = useSpeechRecognition({
    enabled:      webSpeech,
    language,
    onTranscript: onSpeechTranscript,
    onError:      (msg) => dispatch({ type: 'ERROR', message: msg }),
  })

  // ── MediaRecorder + Whisper path ──────────────────────────────────────────────
  const audioRec = useAudioRecorder({
    enabled:    !webSpeech,            // disabled when using Web Speech
    continuous: continuousRecording,
    onAudioReady: async (blob) => {
      dispatch({ type: 'STOP_LISTENING' })
      const endAfterTranscription = endAfterRecordingRef.current
      endAfterRecordingRef.current = false
      await processAudio(blob, { endAfterTranscription })
    },
  })

  async function processAudio(blob: Blob, options: { endAfterTranscription?: boolean } = {}) {
    const form = new FormData()
    form.append('audio', blob, 'audio.webm')
    let userText: string
    try {
      const res  = await fetch('/api/transcribe', {
        method: 'POST', headers: embedHeadersRef.current, body: form,
        signal: networkAbortRef.current.signal,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(String(data?.error ?? 'Transcription failed'))
      userText   = data.text ?? ''
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      dispatch({ type: 'ERROR', message: String((err as Error).message || 'Transcription failed. Please try again.') })
      return
    }
    if (!userText.trim()) {
      if (options.endAfterTranscription) completeEndCall()
      else dispatch({ type: 'CONNECTED' })
      return
    }
    dispatch({ type: 'TRANSCRIBED', text: userText })
    historyRef.current.push({ role: 'user', content: userText })
    if (options.endAfterTranscription) {
      completeEndCall()
      return
    }
    await streamChat(historyRef.current, dispatch)
  }

  // ── Unified recording state (from whichever path is active) ──────────────────
  const isRecording = webSpeech ? speechRec.isRecording : audioRec.isRecording
  const hasSpeech   = webSpeech ? speechRec.hasSpeech   : audioRec.hasSpeech
  const startRec    = webSpeech ? speechRec.start        : audioRec.start
  const stopRec     = webSpeech ? speechRec.stop         : audioRec.stop

  // ── Boot ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const parent = document.referrer || ''
    const headers: Record<string, string> = {}
    const resolvedTenant = tenantId ?? new URLSearchParams(window.location.search).get('tenant') ?? ''
    const resolvedToken  = token    ?? new URLSearchParams(window.location.search).get('token')  ?? ''
    const resolvedShop = shopCode ?? new URLSearchParams(window.location.search).get('shop') ?? ''
    if (resolvedTenant) headers['x-embed-tenant'] = resolvedTenant
    if (resolvedToken)  headers['x-embed-token']  = resolvedToken
    if (parent)         headers['x-embed-parent']  = parent
    if (resolvedShop)   headers['x-embed-shop']   = resolvedShop
    embedHeadersRef.current = headers
    setEmbedHeaders(headers)

    // Always create a fresh controller on mount so a previously-aborted signal
    // (e.g. from React Strict Mode double-invoke cleanup) never blocks the boot fetch.
    const bootController = new AbortController()
    networkAbortRef.current = bootController

    let cancelled = false

    async function boot() {
      try {
        const cfg = await fetch('/api/config', { headers, signal: bootController.signal }).then((r) => r.json())
        if (!cancelled && cfg.voice)       handleSetVoice(cfg.voice as OpenAIVoice)
        // 'Auto' means the tenant supports multiple languages — default mic to English
        if (!cancelled && cfg.language)    setLang(cfg.language === 'Auto' ? 'English' : cfg.language)
        if (!cancelled && cfg.agentName)   setAgent(cfg.agentName)
        if (!cancelled && cfg.companyName) setCompany(cfg.companyName)
        if (cfg.greeting && !cancelled) {
          const greetingText = cfg.greeting as string
          dispatch({ type: 'REPLY_COMPLETE', fullText: greetingText, endCall: false })
          if (outputModeRef.current === 'voice') enqueue(greetingText)
          else dispatch({ type: 'SPEAKING_DONE' })
          historyRef.current.push({ role: 'assistant', content: greetingText })
        } else {
          await streamChat([{ role: 'user', content: '__GREET__' }], cancelled ? null : dispatch)
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        if (!cancelled) dispatch({ type: 'ERROR', message: String(err) })
      }
    }

    boot()
    return () => {
      cancelled = true
      bootController.abort()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Text send ─────────────────────────────────────────────────────────────────
  const sendText = useCallback((text: string) => {
    const phase = stateRef.current.phase
    if (!text.trim()) return
    if (phase !== 'idle' && phase !== 'error') return
    dispatch({ type: 'TRANSCRIBED', text })
    historyRef.current.push({ role: 'user', content: text })
    streamChat(historyRef.current, dispatch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Mic controls ─────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    const phase = stateRef.current.phase
    if (phase === 'speaking' || phase === 'thinking') {
      stopAll()
      dispatch({ type: 'CONNECTED' })
      return
    }
    if (isRecording) { stopRec(); return }
    if (phase === 'idle' || phase === 'error') {
      dispatch({ type: 'START_LISTENING' })
      startRec().catch((err) => dispatch({ type: 'ERROR', message: String(err) }))
    }
  }, [isRecording, startRec, stopRec, stopAll])

  const pressMic = useCallback(() => {
    const phase = stateRef.current.phase
    if (phase !== 'idle' && phase !== 'error') return
    dispatch({ type: 'START_LISTENING' })
    startRec().catch((err) => dispatch({ type: 'ERROR', message: String(err) }))
  }, [startRec])

  const releaseMic = useCallback(() => {
    if (!isRecording) return
    stopRec()
  }, [isRecording, stopRec])

  // ── Manual end-call ───────────────────────────────────────────────────────────
  // Stops mic + playback, aborts any in-flight request, transitions to 'ended'
  // Called once audio has finished (or immediately if nothing is playing).
  // Transitions to 'ended' and fires the backend save.
  function completeEndCall() {
    stopAll()
    dispatch({ type: 'REPLY_COMPLETE', fullText: '', endCall: true })
    const hasUserTurn = historyRef.current.some(
      (m) => m.role === 'user' && m.content !== '__GREET__'
    )
    if (hasUserTurn) {
      networkAbortRef.current = new AbortController()
      saveCallSummary(dispatch)
    }
  }

  // If the agent is mid-sentence, let it finish speaking before transitioning.
  // We only kill the LLM stream (no new text) — existing audio plays to completion.
  const endCall = useCallback(() => {
    if (isRecording) {
      endAfterRecordingRef.current = true
      stopRec()
      return
    }
    networkAbortRef.current.abort()          // stop any incoming LLM stream

    if (isPlayingRef.current) {
      endPendingRef.current = true           // onPlaybackEnd will call completeEndCall
    } else {
      completeEndCall()
    }
  // completeEndCall / saveCallSummary only touch refs — stable across renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, stopRec])

  return {
    phase:              state.phase,
    transcript:         state.transcript,
    partialReply:       state.partialReply,
    error:              state.error,
    isRecording,
    hasSpeech,
    isPlaying,
    language,
    voice,
    outputMode,
    leadData:           state.leadData,
    reviewData:         state.reviewData,
    callSummary:        state.callSummary,
    agentName,
    companyName,
    liveTranscript:     speechRec.liveText,
    webSpeechSupported: speechRec.isSupported,
    setVoice:           handleSetVoice,
    setOutputMode,
    setLanguage:        setLang,
    stopPlayback:       stopAll,
    toggleMic,
    pressMic,
    releaseMic,
    sendText,
    endCall,
  }
}
