'use client'

import { useRef, useEffect, useState, useCallback, type CSSProperties } from 'react'
import { useVoiceAgent }    from '@/hooks/use-voice-agent'
import { useTypingSound }   from '@/hooks/use-typing-sound'
import { AnimatedAvatar }   from './avatar'
import type { Phase }       from '@/types'
import type { VoiceThemeName } from './theme-provider'

// ── End-state messages per sentiment ──────────────────────────────────────────
const END_MSG: Record<string, string> = {
  positive:   'That genuinely made our day — thank you for taking the time!',
  negative:   'Your feedback has been sent to our team.',
  complaint:  'Your complaint has been sent to our Customer Excellence Team.',
  suggestion: 'Your suggestion has been sent to our team.',
}

// ── Mood palette ───────────────────────────────────────────────────────────────
const MOOD_COLOR: Record<string, string> = {
  positive:   '#10B981',
  negative:   '#F59E0B',
  complaint:  '#F43F5E',
  suggestion: '#6366F1',
}
const DEFAULT_COLOR = '#00E5FF'
const mc = (s: string | null) => (s ? MOOD_COLOR[s] ?? DEFAULT_COLOR : DEFAULT_COLOR)

const MOOD_LABEL: Record<string, string> = {
  positive:   'Positive Experience',
  negative:   'Negative Feedback',
  complaint:  'Formal Complaint',
  suggestion: 'Customer Suggestion',
}

// ── Theme system ───────────────────────────────────────────────────────────────
const THEMES: VoiceThemeName[] = ['nexus', 'daylight', 'emerald', 'ember']

// ── Status copy ────────────────────────────────────────────────────────────────
const STATUS: Record<Phase, string> = {
  connecting:   'Starting up — please wait a moment…',
  idle:         'Ready — press the button and speak',
  listening:    'Listening — speak clearly, we are recording',
  transcribing: 'Processing your voice — please wait…',
  thinking:     'Preparing your response — please wait…',
  speaking:     'Agent is speaking — please listen',
  ended:        'Session complete — thank you',
  error:        'Something went wrong — please try again',
}

// ── Public interface ───────────────────────────────────────────────────────────
interface Props { tenantId?: string; token?: string; shopCode?: string }

const RECORDING_LIMIT_SECS = 60

function formatClock(totalSecs: number): string {
  const safe = Math.max(0, totalSecs)
  const mm = Math.floor(safe / 60)
  const ss = (safe % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

// Session wrapper — remounts NexusAgentInner on reset to avoid a full page reload.
export function NexusAgent(props: Props) {
  const [sessionKey, setSessionKey] = useState(0)
  const handleReset = useCallback(() => setSessionKey(k => k + 1), [])

  // Chrome extensions that react to microphone / SpeechRecognition activity
  // (Grammarly, Google Translate, Speechify, etc.) use chrome.runtime messaging
  // internally. When their service-worker channel closes during React re-renders
  // Chrome logs an "Uncaught (in promise)" to the active tab's console even
  // though the error originates entirely inside the extension, not our code.
  // Intercepting unhandledrejection lets us suppress that noise while the
  // voice agent is mounted without masking any errors from our own code.
  useEffect(() => {
    function suppressExtensionChannelNoise(e: PromiseRejectionEvent) {
      const msg: string = e.reason?.message ?? ''
      if (
        msg.includes('message channel closed') ||
        msg.includes('listener indicated an asynchronous response')
      ) {
        e.preventDefault()
      }
    }
    window.addEventListener('unhandledrejection', suppressExtensionChannelNoise)
    return () => window.removeEventListener('unhandledrejection', suppressExtensionChannelNoise)
  }, [])

  return <NexusAgentInner key={sessionKey} {...props} onReset={handleReset} />
}

// ── Inner component ────────────────────────────────────────────────────────────
function NexusAgentInner({ tenantId, token, shopCode, onReset }: Props & { onReset: () => void }) {
  // Shop validation is handled server-side (resolveReviewShop in /api/summarize).
  // A missing shopCode is the only case where we block the UI.
  const validShop = Boolean(shopCode)

  const {
    phase, transcript, partialReply, error,
    isRecording, isPlaying,
    agentName, companyName,
    language, setLanguage,
    reviewData, leadData, callSummary,
    toggleMic, endCall,
  } = useVoiceAgent({
    tenantId,
    token,
    shopCode,
    defaultOutputMode: 'voice',
    continuousRecording: true,
    webSpeech: false,
    browserTts: false,
  })

  const transcriptRef = useRef<HTMLDivElement>(null)
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const endTimerRef    = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const resetTickRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idleTimerRef   = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const endCallRef     = useRef(endCall)
  const toggleMicRef   = useRef(toggleMic)

  const [recordSecs,           setRecordSecs]           = useState(0)
  const [endStep,              setEndStep]              = useState<'sending' | 'confirmed' | null>(null)
  const [resetSecs,            setResetSecs]            = useState(5)
  const [themeColor,           setThemeColor]           = useState(DEFAULT_COLOR)
  const [showIncompletePrompt, setShowIncompletePrompt] = useState(false)
  const [callTimedOut,         setCallTimedOut]         = useState(false)
  // Status-text fade: track displayed text separately so we can cross-fade
  const [statusText,           setStatusText]           = useState('')
  const [statusOpacity,        setStatusOpacity]        = useState(1)
  const sessionRef = useRef(`CX-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`)

  useEffect(() => {
    endCallRef.current = endCall
    toggleMicRef.current = toggleMic
  }, [endCall, toggleMic])

  // Sync --nx-accent → themeColor and data-va-theme → activeTheme via MutationObserver.
  // The observer covers both direct attribute changes and postMessage-driven style updates
  // (ThemeProvider calls root.style.setProperty which triggers the 'style' attribute watch).
  useEffect(() => {
    const readAccent = () => {
      const root  = document.documentElement
      const value = getComputedStyle(root).getPropertyValue('--nx-accent').trim()
      if (/^#[0-9a-fA-F]{6}$/.test(value)) setThemeColor(value)
      const t = root.dataset.vaTheme
      if (t && !THEMES.includes(t as VoiceThemeName)) root.dataset.vaTheme = 'nexus'
    }

    readAccent()
    const observer = new MutationObserver(readAccent)
    observer.observe(document.documentElement, {
      attributes:     true,
      attributeFilter: ['style', 'data-va-theme'],
    })
    return () => observer.disconnect()
  }, [])

  // Auto-scroll transcript
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [transcript, partialReply])

  // Session countdown — hard cap for the full interaction.
  // Resets only when phase returns to 'connecting' (new session).

  // Per-turn recording cap — prevents unlimited speech, but submits the turn
  // to the agent instead of ending the whole call.
  useEffect(() => {
    if (!isRecording) {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current)
        recordTimerRef.current = null
      }
      setRecordSecs(0)
      return
    }

    setRecordSecs(0)
    recordTimerRef.current = setInterval(() => {
      setRecordSecs((s) => {
        if (s >= RECORDING_LIMIT_SECS - 1) {
          if (recordTimerRef.current) {
            clearInterval(recordTimerRef.current)
            recordTimerRef.current = null
          }
          toggleMicRef.current()
          return RECORDING_LIMIT_SECS
        }
        return s + 1
      })
    }, 1000)

    return () => {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current)
        recordTimerRef.current = null
      }
    }
  }, [isRecording])

  // Typing sound — fires blips as agent reply streams in
  const { onTextGrow } = useTypingSound(true)
  useEffect(() => { onTextGrow(partialReply) }, [partialReply, onTextGrow])

  // Interval only decrements — never calls onReset() inside a state updater
  // (calling a parent setState inside a child updater violates React's rules).
  function startResetCountdown() {
    setResetSecs(5)
    resetTickRef.current = setInterval(() => {
      setResetSecs(s => Math.max(0, s - 1))
    }, 1000)
  }

  // onReset fires in an effect (post-render), not inside the updater
  useEffect(() => {
    if (resetSecs === 0 && endStep === 'confirmed') {
      if (resetTickRef.current) { clearInterval(resetTickRef.current); resetTickRef.current = null }
      onReset()
    }
  }, [resetSecs, endStep, onReset])

  // Step 1 — flip to end screen only AFTER agent stops speaking.
  // phase='ended' while isPlaying=true means the final sentence is still playing.
  // We wait for isPlaying→false before showing the sending/confirmed screen so
  // there is no jarring cut while the agent is still mid-sentence.
  useEffect(() => {
    if (phase !== 'ended') return
    if (isPlaying) return                  // wait — agent still talking
    const isPositive = reviewData.sentiment === 'positive'
    if (isPositive) {
      endTimerRef.current = setTimeout(() => {
        setEndStep('confirmed')
        startResetCountdown()
      }, 400)
    } else {
      setEndStep('sending')
      // Safety fallback: if API never responds, advance after 12 s
      endTimerRef.current = setTimeout(() => {
        setEndStep((s) => {
          if (s === 'sending') { startResetCountdown(); return 'confirmed' }
          return s
        })
      }, 12_000)
    }
    return () => {
      if (endTimerRef.current)  clearTimeout(endTimerRef.current)
      if (resetTickRef.current) clearInterval(resetTickRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isPlaying])

  // P3-A: save failed — cancel the 12 s fallback so we never auto-confirm a failure
  useEffect(() => {
    if (phase === 'error' && endStep === 'sending') {
      if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null }
    }
  }, [phase, endStep])

  // Step 2 — callSummary arrives from API: hold 2.5 s then show confirmed.
  useEffect(() => {
    if (endStep !== 'sending' || !callSummary) return
    if (endTimerRef.current) clearTimeout(endTimerRef.current)  // cancel fallback
    endTimerRef.current = setTimeout(() => {
      setEndStep('confirmed')
      startResetCountdown()
    }, 2500)
    return () => { if (endTimerRef.current) clearTimeout(endTimerRef.current) }
  }, [callSummary, endStep])

  // Dismiss incomplete prompt automatically if the user picks up the mic again
  useEffect(() => {
    if (phase !== 'idle') setShowIncompletePrompt(false)
  }, [phase])

  // Idle timeout — restart the session if the user is silent for 60 s.
  // Timer resets each time phase leaves 'idle' (user starts speaking / agent responds).
  useEffect(() => {
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null }
    if (phase !== 'idle' || endStep !== null) return
    idleTimerRef.current = setTimeout(() => setCallTimedOut(true), 60_000)
    return () => { if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null } }
  }, [phase, endStep])

  // Auto-restart 3 s after timeout notice is shown.
  useEffect(() => {
    if (!callTimedOut) return
    const t = setTimeout(() => { setCallTimedOut(false); onReset() }, 3_000)
    return () => clearTimeout(t)
  }, [callTimedOut, onReset])

  // Status-text cross-fade: fade out → swap text → fade in on every phase change.
  useEffect(() => {
    const next = error && phase === 'error' ? error : STATUS[phase]
    setStatusOpacity(0)
    const t = setTimeout(() => { setStatusText(next); setStatusOpacity(1) }, 130)
    return () => clearTimeout(t)
  }, [phase, error])

  const color = reviewData.sentiment ? mc(reviewData.sentiment) : themeColor
  const ended = phase === 'ended'
  const busy  = phase === 'thinking' || phase === 'transcribing' || phase === 'connecting'

  const recordingRemaining = RECORDING_LIMIT_SECS - recordSecs
  const recordingCountdown = formatClock(recordingRemaining)

  // SVG progress arc — depletes as time is used
  const R    = 68
  const CIRC = 2 * Math.PI * R
  const dash = CIRC * (recordSecs / RECORDING_LIMIT_SECS)
  const agentInitial = (agentName || 'AI').trim().charAt(0).toUpperCase()
  const spokenTurns = transcript.filter((m) => m.role === 'user').length
  const hasCustomerTurn = spokenTurns > 0
  const branchLabel = shopCode ? shopCode.toUpperCase() : 'Global'
  const ticket = callSummary?.ticket ?? null
  const handleManualEnd = useCallback(() => {
    // Already ending — nothing to do
    if (phase === 'ended' || endStep !== null) return

    // During processing or recording: abort and end immediately — always honour the request
    if (busy || isRecording) {
      endCall()
      return
    }

    // Nothing spoken yet → just restart (no data to save)
    if (!hasCustomerTurn) {
      onReset()
      return
    }

    // User has spoken but agent hasn't classified the request yet → warn before ending
    if (!reviewData.sentiment) {
      setShowIncompletePrompt(true)
      return
    }

    // Context is clear → end and process normally
    endCall()
  }, [busy, endCall, endStep, hasCustomerTurn, isRecording, onReset, phase, reviewData.sentiment])

  return (
    <div className="nx-root">

      {/* ── Animated background ─────────────────────────────────────────── */}
      <NxBg />

      {/* ════ SHOP NOT CONFIGURED ════════════════════════════════════════ */}
      {!validShop && (
        <div className="nx-shop-required">
          <div className="nx-shop-card">
            <div className="nx-shop-icon">AI</div>
            <h2 className="nx-shop-title">Agent Not Available</h2>
            <p className="nx-shop-body">
              This agent has not been configured for your location.
              Please contact your administrator.
            </p>
          </div>
        </div>
      )}

      {/* ════ STEP 1: SENDING (or save-failed) ══════════════════════════ */}
      {/* P2-D: keyed off endStep, not 'ended', so save errors show here  */}
      {validShop && endStep === 'sending' && (
        <div className="nx-end-screen">
          {phase === 'error' ? (
            /* ── Save failed — show error in context, never auto-confirm ── */
            <div className="nx-conf-card" style={{ borderColor: '#F43F5E33' }}>
              <div className="nx-conf-icon" style={{ borderColor: '#F43F5E50', color: '#F43F5E' }}>
                <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none"
                     stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h1 className="nx-conf-title" style={{ color: '#F43F5E' }}>Save Failed</h1>
              <p className="nx-conf-msg">{error ?? 'Your feedback could not be saved. Please try again.'}</p>
              <button className="nx-new-btn" onClick={onReset}
                      style={{ borderColor: '#F43F5E50', color: '#F43F5E' }}>
                Start New Session
              </button>
            </div>
          ) : (
            /* ── Normal sending animation ── */
            <>
              <div className="nx-send-wrap">
                <div className="nx-send-ring nx-sr1" style={{ borderColor: color }} />
                <div className="nx-send-ring nx-sr2" style={{ borderColor: color }} />
                <div className="nx-send-ring nx-sr3" style={{ borderColor: color }} />
                <div className="nx-send-orb"
                     style={{
                       background: `radial-gradient(circle at 35% 30%, ${color}55, ${color}18 60%, ${color}06)`,
                       boxShadow:  `0 0 0 2px ${color}40, 0 0 50px ${color}28`,
                     }}>
                  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none"
                       stroke={color} strokeWidth={1.8} strokeLinecap="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </div>
              </div>
              <p className="nx-send-title">Routing conversation packet</p>
              <p className="nx-send-sub">Securing transcript, classification, and contact details</p>
              <div className="nx-send-dots">
                <span style={{ background: color }} />
                <span style={{ background: color }} />
                <span style={{ background: color }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ════ STEP 2: CONFIRMED ══════════════════════════════════════════ */}
      {validShop && ended && endStep === 'confirmed' && (
        <div className="nx-end-screen">
          <div className="nx-conf-card">

            <div className="nx-conf-icon" style={{ borderColor: color + '50', color }}>
              <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none"
                   stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="nx-conf-title" style={{ color }}>
              {reviewData.sentiment === 'positive' ? 'Thank you' : 'Feedback captured'}
            </h1>

            <p className="nx-conf-msg">
              {END_MSG[reviewData.sentiment ?? ''] ?? 'Your message has been sent to our team.'}
            </p>

            {reviewData.sentiment !== 'positive' && (
              <p className="nx-conf-sub">
                {ticket
                  ? 'The responsible team has the ticket, transcript, and contact context.'
                  : 'The responsible team has the conversation context.'}
              </p>
            )}

            {ticket && (
              <div className="nx-ticket-card" style={{ borderColor: color + '36' }}>
                <span className="nx-ticket-label">Ticket ID</span>
                <strong style={{ color }}>{ticket.id}</strong>
                <div className="nx-ticket-meta">
                  <span>{ticket.type}</span>
                  <span>{ticket.priority} priority</span>
                </div>
              </div>
            )}

            <div className="nx-route-list">
              <span>Transcript secured</span>
              <span>Insight classified</span>
              <span>{ticket ? 'Ticket created' : reviewData.sentiment === 'positive' ? 'Experience logged' : 'Team routing prepared'}</span>
            </div>

            <div className="nx-ref-code">
              <span>{ticket ? 'Session reference' : 'Reference'}</span>
              <strong>{ticket?.id ?? sessionRef.current}</strong>
            </div>

            {reviewData.sentiment !== 'positive' && (leadData.name || leadData.phone) && (
              <div className="nx-conf-contact" style={{ borderColor: color + '30' }}>
                {leadData.name  && <span style={{ color }}>{leadData.name}</span>}
                {leadData.phone && <span className="nx-ty-phone">{leadData.phone}</span>}
              </div>
            )}

            {reviewData.sentiment && (
              <span className="nx-ty-badge"
                    style={{ background: color + '18', color, borderColor: color + '40' }}>
                {MOOD_LABEL[reviewData.sentiment]}
              </span>
            )}

            <button className="nx-new-btn" onClick={onReset}
                    style={{ borderColor: color + '50', color }}>
              New Message
            </button>

            <p className="nx-reset-hint">
              Auto-reset in <span style={{ color }}>{resetSecs}s</span>
            </p>
          </div>
        </div>
      )}

      {/* ════ MAIN UI ══════════════════════════════════════════════════════ */}
      {/* P2-D: gate on endStep===null, not !ended, so error phase after a save  */}
      {/* failure stays on the end screen rather than regressing to voice UI.    */}
      {validShop && endStep === null && (
        <div className="nx-content relative">

          {/* ── Error banner ────────────────────────────────────────────── */}
          {phase === 'error' && error && (
            <div className="nx-err-banner">
              {error.includes('quota') || error.includes('429')
                ? <>Service limit reached — please try again later</>
                : <>{error}</>}
            </div>
          )}

          {/* ── Idle-timeout overlay ─────────────────────────────────────── */}
          {callTimedOut && (
            <div className="absolute inset-0 z-50 flex items-center justify-center"
                 style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}>
              <div className="flex flex-col items-center gap-3 px-8 py-7 rounded-2xl border text-center"
                   style={{ background: 'var(--nx-surface, #0f1923)', borderColor: color + '40', maxWidth: '320px' }}>
                <svg viewBox="0 0 24 24" className="w-10 h-10 opacity-60" fill="none"
                     stroke={color} strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <p className="text-sm font-black text-white">Session Timed Out</p>
                <p className="text-xs font-semibold" style={{ color: color + 'cc' }}>
                  No activity detected for 60 seconds. Starting a new session…
                </p>
              </div>
            </div>
          )}

          {/* ── Incomplete-request prompt ─────────────────────────────────── */}
          {showIncompletePrompt && (
            <div className="absolute inset-0 z-50 flex items-center justify-center"
                 style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}>
              <div className="flex flex-col gap-4 px-8 py-7 rounded-2xl border"
                   style={{ background: 'var(--nx-surface, #0f1923)', borderColor: color + '40', maxWidth: '320px', width: '100%' }}>
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-black text-white">Request Incomplete</p>
                  <p className="text-xs font-semibold leading-relaxed" style={{ color: color + 'bb' }}>
                    Your feedback has not been fully captured yet. Please share your experience so
                    we can route it to the right team.
                  </p>
                  <p className="text-xs font-semibold leading-relaxed text-slate-400 mt-1">
                    Would you still like to end the call?
                  </p>
                </div>
                <div className="flex gap-3 mt-1">
                  <button
                    onClick={() => { setShowIncompletePrompt(false); endCall() }}
                    className="flex-1 rounded-xl py-2.5 text-xs font-black text-white border transition-colors hover:opacity-80"
                    style={{ borderColor: '#F43F5E55', background: '#F43F5E18', color: '#F43F5E' }}
                  >
                    Yes, End Call
                  </button>
                  <button
                    onClick={() => setShowIncompletePrompt(false)}
                    className="flex-1 rounded-xl py-2.5 text-xs font-black border transition-colors hover:opacity-80"
                    style={{ borderColor: color + '55', background: color + '14', color }}
                  >
                    No, Continue
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Header ──────────────────────────────────────────────────── */}
          <header className="nx-header">
            <div className="nx-hdr-l">
              <span className="nx-brand-mark" style={{ borderColor: color + '55', color }}>
                {agentInitial}
              </span>
              <span className="nx-hdr-copy">
                <span className="nx-company">{companyName || 'Customer Experience'}</span>
                <span className="nx-hdr-tag">AI Voice Agent</span>
              </span>
            </div>

            <div className="nx-hdr-actions">
              <div className="nx-lang-toggle">
                <button
                  className={`nx-lang-btn ${language.toLowerCase() === 'english' ? 'nx-lang-active' : ''}`}
                  onClick={() => setLanguage('English')}
                  disabled={isRecording}
                  aria-pressed={language.toLowerCase() === 'english'}
                >EN</button>
                <button
                  className={`nx-lang-btn ${language.toLowerCase() === 'urdu' ? 'nx-lang-active' : ''}`}
                  onClick={() => setLanguage('Urdu')}
                  disabled={isRecording}
                  aria-pressed={language.toLowerCase() === 'urdu'}
                >اردو</button>
              </div>

              <button className="nx-header-end-btn" onClick={handleManualEnd} aria-label="End call">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
                     stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.95.35 1.88.66 2.76a2 2 0 0 1-.45 2.11L8 9.86a16 16 0 0 0 6.14 6.14l1.27-1.27a2 2 0 0 1 2.11-.45c.88.31 1.81.53 2.76.66A2 2 0 0 1 22 16.92z" />
                  <path d="m2 2 20 20" />
                </svg>
                <span>End Call</span>
              </button>
            </div>
          </header>

          <div className="nx-main-grid">
            <section className="nx-agent-rail">
              <section className="nx-agent-panel" style={{ borderColor: color + '26', transition: 'border-color 0.5s ease' }}>
                <div className="nx-agent-topline">
                  <div className="nx-agent-meta">
                    <span className="nx-agent-kicker">Experience Intelligence</span>
                    <h1>{agentName || 'Review Agent'}</h1>
                    <p>{branchLabel} secure voice session</p>
                  </div>
                </div>
                <div className="nx-agent-metrics">
                  <span>
                    <strong>{isRecording ? recordingCountdown : formatClock(RECORDING_LIMIT_SECS)}</strong>
                    turn cap
                  </span>
                  <span>
                    <strong>{spokenTurns}</strong>
                    turns
                  </span>
                  <span>
                    <strong>{language.toUpperCase().slice(0, 2)}</strong>
                    lang
                  </span>
                </div>
              </section>

              <div className="nx-orb-section">
                <div className="nx-avatar-wrap">
                  <AnimatedAvatar phase={phase} color={color} size="md" />
                </div>

                <p className="nx-agent-name">Live AI operator</p>
                {/* Cross-fade status text so phase transitions don't hard-cut */}
                <p className="nx-status-txt" role="status" aria-live="polite"
                   style={{ opacity: statusOpacity, transition: 'opacity 0.13s ease' }}>
                  {statusText || STATUS[phase]}
                </p>
              </div>

              {reviewData.sentiment && (
                <div className="nx-mood"
                     style={{ background: color + '12', borderColor: color + '28', transition: 'background 0.5s ease, border-color 0.5s ease' }}>
                  <span className="nx-mood-dot" style={{ background: color, boxShadow: `0 0 8px ${color}`, transition: 'background 0.5s ease, box-shadow 0.5s ease' }} />
                  <span style={{ color, fontSize: '0.73rem', fontWeight: 600, transition: 'color 0.5s ease' }}>
                    {MOOD_LABEL[reviewData.sentiment]}
                  </span>
                </div>
              )}

              <div className="nx-btn-zone">
                <div className="nx-btn-wrap">

                  {isRecording && (
                    <>
                      <div className="nx-wr nx-wr1" style={{ borderColor: color }} />
                      <div className="nx-wr nx-wr2" style={{ borderColor: color }} />
                      <div className="nx-wr nx-wr3" style={{ borderColor: color }} />
                    </>
                  )}

                  {isRecording && (
                    <svg className="nx-arc" viewBox="0 0 150 150">
                      <circle cx="75" cy="75" r={R}
                        fill="none" stroke={color} strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeDasharray={`${CIRC - dash} ${dash}`}
                        transform="rotate(-90 75 75)"
                        opacity="0.82" />
                    </svg>
                  )}

                  <button
                    onClick={toggleMic}
                    disabled={busy}
                    className={`nx-btn ${isRecording ? 'nx-btn-rec' : busy ? 'nx-btn-busy' : 'nx-btn-idle'}`}
                    style={isRecording ? ({ '--nx-rec-color': color } as CSSProperties) : undefined}
                    aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                  >
                    {isRecording ? (
                      <>
                        <span className="nx-rec-spectrum" aria-hidden>
                          {[0, 1, 2, 3, 4].map((i) => <span key={i} />)}
                        </span>
                        <svg viewBox="0 0 24 24" className="nx-bi nx-stop-icon">
                          <rect x="6" y="6" width="12" height="12" rx="3" fill="white" />
                        </svg>
                      </>
                    ) : busy ? (
                      <div className="nx-spin" style={{ borderTopColor: color }} />
                    ) : (
                      <svg viewBox="0 0 24 24" className="nx-bi" fill="none"
                           stroke="white" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8"  y1="23" x2="16" y2="23" />
                      </svg>
                    )}

                    {isRecording && (
                      <span className="nx-recdot" style={{ background: color }} />
                    )}
                  </button>
                </div>

                {isRecording && (
                  <div className="nx-countdown-badge" style={{ borderColor: color + '55', color }}>
                    <span className="nx-countdown-time">{recordingCountdown}</span>
                    <span className="nx-countdown-sub">turn left</span>
                  </div>
                )}

                <p className="nx-btn-lbl">
                  {isRecording             ? 'Recording active · tap to send'
                   : phase === 'transcribing' ? 'Processing your voice — please wait…'
                   : phase === 'thinking'     ? 'Preparing your response — please wait…'
                   : phase === 'connecting'   ? 'Starting up — please wait…'
                   : phase === 'speaking'     ? 'Agent is speaking — please listen'
                   : 'Press the button to start speaking'}
                </p>

                <div className="nx-end-policy">
                  <span className="nx-close-cue">Say thanks or goodbye to close</span>
                </div>

              </div>
            </section>

            <section className="nx-conversation-panel" style={{ borderColor: color + '26', transition: 'border-color 0.5s ease' }}>
              <div className="nx-conversation-head">
                <span>Live conversation</span>
                <span>
                  {phase === 'error'        ? 'Error — please retry'
                   : phase === 'transcribing' ? 'Processing…'
                   : phase === 'thinking'     ? 'Thinking…'
                   : phase === 'connecting'   ? 'Starting up…'
                   : 'Live'}
                </span>
              </div>

              {/* Processing notice — always rendered, fades in/out so there's no layout jump */}
              {(() => {
                const isProcessing = phase === 'transcribing' || phase === 'thinking'
                return (
                  <div className="flex items-center gap-2.5 px-4 py-2.5 border-b overflow-hidden"
                       style={{
                         borderColor:    color + '22',
                         background:     color + '0a',
                         maxHeight:      isProcessing ? '48px' : '0px',
                         opacity:        isProcessing ? 1 : 0,
                         paddingTop:     isProcessing ? undefined : 0,
                         paddingBottom:  isProcessing ? undefined : 0,
                         transition:     'max-height 0.3s ease, opacity 0.25s ease, padding 0.3s ease',
                       }}>
                    <span className="flex gap-1 shrink-0">
                      {[0, 150, 300].map((delay) => (
                        <span key={delay} className="block w-1.5 h-1.5 rounded-full animate-bounce"
                              style={{ background: color, animationDelay: `${delay}ms`, transition: 'background 0.5s ease' }} />
                      ))}
                    </span>
                    <p className="text-xs font-semibold" style={{ color, transition: 'color 0.5s ease' }}>
                      {phase === 'transcribing'
                        ? 'Processing your voice — please wait…'
                        : 'Preparing your response — please wait…'}
                    </p>
                  </div>
                )
              })()}

              <div ref={transcriptRef} className="nx-transcript scrollbar-thin">
                {transcript.length === 0 && phase !== 'connecting' && (
                  <div className="nx-empty">
                    <p className="nx-empty-t">Voice channel standing by</p>
                    <p className="nx-empty-s">Press the button and speak naturally</p>
                  </div>
                )}

                {transcript.map((msg, i) => {
                  const isAgent = msg.role === 'assistant'
                  const isFirst = i === 0 || transcript[i - 1].role !== msg.role
                  return (
                    <div key={msg.id}
                         className={`nx-row ${isAgent ? 'nx-row-l' : 'nx-row-r'} ${isFirst ? 'nx-first' : ''}`}>
                      <div className={`nx-bubble ${isAgent ? 'nx-bbl-a' : 'nx-bbl-u'}`}
                           style={!isAgent ? { borderColor: color + '38' } : {}}>
                        {msg.content}
                      </div>
                    </div>
                  )
                })}

                {partialReply && (
                  <div className="nx-row nx-row-l nx-first">
                    <div className="nx-bubble nx-bbl-a">
                      {partialReply}
                      <span className="nx-cursor" style={{ background: color }} />
                    </div>
                  </div>
                )}
              </div>

              {(leadData.name || leadData.phone) && (
                <div className="nx-chip">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0"
                       fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>{[leadData.name, leadData.phone].filter(Boolean).join(' · ')}</span>
                </div>
              )}
            </section>
          </div>

        </div>
      )}
    </div>
  )
}

function NxBg() {
  return (
    <div className="nx-bg" aria-hidden>
      <div className="nx-grid" />
      <div className="nx-scanline" />
      <div className="nx-orbit nx-o1"><span /></div>
      <div className="nx-orbit nx-o2"><span /></div>
      <div className="nx-data-lane nx-dl1" />
      <div className="nx-data-lane nx-dl2" />
      <div className="nx-blob nx-b1" />
      <div className="nx-blob nx-b2" />
      <div className="nx-blob nx-b3" />
    </div>
  )
}
