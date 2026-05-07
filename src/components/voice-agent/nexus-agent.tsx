'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useVoiceAgent } from '@/hooks/use-voice-agent'
import { AnimatedAvatar } from './avatar'
import type { Phase } from '@/types'

// ── End-state messages per sentiment ──────────────────────────────────────────
const END_MSG: Record<string, string> = {
  complaint:  'Your complaint has been sent to our Customer Excellence Team.',
  suggestion: 'Your suggestion has been sent to our team.',
  negative:   'Your feedback has been sent to our team.',
  positive:   'Your feedback has been sent to our team. Thank you!',
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
  positive:   '😊 Positive Experience',
  negative:   '😐 Negative Feedback',
  complaint:  '🚨 Formal Complaint',
  suggestion: '💡 Suggestion',
}

// ── Status copy ────────────────────────────────────────────────────────────────
const STATUS: Record<Phase, string> = {
  connecting:   'Connecting to agent…',
  idle:         'Ready — press the button to speak',
  listening:    'Listening… speak now',
  transcribing: 'Analysing your voice…',
  thinking:     'Processing your feedback…',
  speaking:     'Agent is responding…',
  ended:        'Session complete',
  error:        'Connection error — please retry',
}

// ── Main component ─────────────────────────────────────────────────────────────
const VALID_SHOPS = ['shop1', 'shop2', 'shop3', 'shop4']

interface Props { tenantId?: string; token?: string; shopCode?: string }

export function NexusAgent({ tenantId, token, shopCode }: Props) {
  // All hooks must run unconditionally — shop guard is a conditional render below
  const validShop = !!(shopCode && VALID_SHOPS.includes(shopCode.toLowerCase()))

  const {
    phase, transcript, partialReply, error,
    isRecording,
    setOutputMode,
    agentName, companyName,
    language, setLanguage,
    reviewData, leadData,
    liveTranscript, webSpeechSupported,
    toggleMic,
  } = useVoiceAgent({ tenantId, token, shopCode, defaultOutputMode: 'voice', webSpeech: true, browserTts: false })

  const transcriptRef = useRef<HTMLDivElement>(null)
  const [recSecs,   setRecSecs]   = useState(0)
  const [endStep,   setEndStep]   = useState<'sending' | 'confirmed' | null>(null)
  const [resetSecs, setResetSecs] = useState(5)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const endTimerRef = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const MAX = 60

  // Ensure voice output (belt-and-suspenders alongside defaultOutputMode)
  useEffect(() => { setOutputMode('voice') }, [setOutputMode])

  // Auto-scroll transcript
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [transcript, partialReply])

  // Countdown timer — stops ONLY when user presses stop OR 60 s elapses
  useEffect(() => {
    if (isRecording) {
      setRecSecs(0)
      timerRef.current = setInterval(() => {
        setRecSecs(s => {
          if (s >= MAX - 1) { toggleMic(); return MAX }   // auto-stop at 60 s
          return s + 1
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setRecSecs(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRecording, toggleMic])

  // End-call flow: sending → confirmed → reset
  useEffect(() => {
    if (phase !== 'ended') return
    setEndStep('sending')

    // Step 1 → Step 2: show "Sending…" for 2.5 s then "Confirmed"
    endTimerRef.current = setTimeout(() => {
      setEndStep('confirmed')
      setResetSecs(5)


      // Countdown then reload for next customer
      let c = 5
      const tick = setInterval(() => {
        c--
        setResetSecs(c)
        if (c <= 0) {
          clearInterval(tick)
          window.location.reload()
        }
      }, 1000)
    }, 5000)

    return () => { if (endTimerRef.current) clearTimeout(endTimerRef.current) }
  }, [phase])

  const handleNewMessage = useCallback(() => window.location.reload(), [])

  const color   = mc(reviewData.sentiment)
  const ended   = phase === 'ended'
  const busy    = phase === 'thinking' || phase === 'transcribing' || phase === 'connecting'

  // MM:SS countdown — counts DOWN from 1:00 to 0:00
  const remaining = MAX - recSecs
  const mm  = Math.floor(remaining / 60)
  const ss  = (remaining % 60).toString().padStart(2, '0')
  const countdown = `${mm}:${ss}`

  // SVG progress arc — fills as time is used
  const R    = 68
  const CIRC = 2 * Math.PI * R
  const dash = CIRC * (recSecs / MAX)

  return (
    <div className="nx-root">

      {/* ── Animated background ─────────────────────────────────────────── */}
      <NxBg />

      {/* ════ SHOP NOT CONFIGURED ════════════════════════════════════════ */}
      {!validShop && (
        <div className="nx-shop-required">
          <div className="nx-shop-card">
            <div className="nx-shop-icon">🏪</div>
            <h2 className="nx-shop-title">Please provide proper shop</h2>
            <p className="nx-shop-body">
              This agent must be linked to a shop before it can accept reviews.
            </p>
            <p className="nx-shop-hint">
              Add <code>?shop=shop1</code> (or shop2, shop3, shop4) to the URL.
            </p>
          </div>
        </div>
      )}

      {/* ════ STEP 1: SENDING ════════════════════════════════════════════ */}
      {validShop && ended && endStep === 'sending' && (
        <div className="nx-end-screen">
          <div className="nx-send-wrap">
            <div className="nx-send-ring nx-sr1" style={{ borderColor: color }} />
            <div className="nx-send-ring nx-sr2" style={{ borderColor: color }} />
            <div className="nx-send-ring nx-sr3" style={{ borderColor: color }} />
            <div className="nx-send-orb" style={{ background: `radial-gradient(circle at 35% 30%, ${color}55, ${color}18 60%, ${color}06)`, boxShadow: `0 0 0 2px ${color}40, 0 0 50px ${color}28` }}>
              <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none"
                   stroke={color} strokeWidth={1.8} strokeLinecap="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </div>
          </div>
          <p className="nx-send-title">Sending to our team</p>
          <div className="nx-send-dots">
            <span style={{ background: color }} />
            <span style={{ background: color }} />
            <span style={{ background: color }} />
          </div>
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

            <h1 className="nx-conf-title" style={{ color }}>Sent!</h1>

            <p className="nx-conf-msg">
              {END_MSG[reviewData.sentiment ?? ''] ?? 'Your message has been sent to our team.'}
            </p>

            <p className="nx-conf-sub">
              We will reach out to you shortly.
            </p>

            {(leadData.name || leadData.phone) && (
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

            <button className="nx-new-btn" onClick={handleNewMessage}
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
      {validShop && !ended && (
        <div className="nx-content">

          {/* ── Quota / error banner ────────────────────────────────────── */}
          {phase === 'error' && error && (
            <div className="nx-err-banner">
              {error.includes('quota') || error.includes('429')
                ? <>⚡ OpenAI quota exceeded — <a href="https://platform.openai.com/account/billing" target="_blank" rel="noreferrer" className="underline">add credits</a> to continue</>
                : <>⚠️ {error}</>}
            </div>
          )}

          {/* ── Header ──────────────────────────────────────────────────── */}
          <header className="nx-header">
            <div className="nx-hdr-l">
              <span className="nx-live-dot" />
              <span className="nx-company">{companyName || 'Customer Experience'}</span>
            </div>
            <div className="nx-lang-toggle">
              <button
                className={`nx-lang-btn ${language.toLowerCase() === 'english' ? 'nx-lang-active' : ''}`}
                onClick={() => setLanguage('English')}
                disabled={isRecording}
              >EN</button>
              <button
                className={`nx-lang-btn ${language.toLowerCase() === 'urdu' ? 'nx-lang-active' : ''}`}
                onClick={() => setLanguage('Urdu')}
                disabled={isRecording}
              >اردو</button>
            </div>
          </header>

          {/* ── Agent avatar ─────────────────────────────────────────────── */}
          <div className="nx-orb-section">
            <AnimatedAvatar phase={phase} color={color} />

            <p className="nx-agent-name">{agentName || 'Review Agent'}</p>
            <p className="nx-status-txt">
              {error && phase === 'error' ? error : STATUS[phase]}
            </p>

            {/* Live transcript subtitle while user speaks */}
            {isRecording && liveTranscript && (
              <p className="nx-live-txt" style={{ borderColor: color + '35', color: color + 'CC' }}>
                {liveTranscript.length > 80
                  ? '…' + liveTranscript.slice(-80)
                  : liveTranscript}
              </p>
            )}

            {/* Browser not supported warning */}
            {!webSpeechSupported && (
              <p className="nx-unsupported">
                ⚠️ Voice input requires Chrome or Edge
              </p>
            )}
          </div>

          {/* ── Mood indicator ───────────────────────────────────────────── */}
          {reviewData.sentiment && (
            <div className="nx-mood"
                 style={{ background: color + '12', borderColor: color + '28' }}>
              <span className="nx-mood-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
              <span style={{ color, fontSize: '0.73rem', fontWeight: 600 }}>
                {MOOD_LABEL[reviewData.sentiment]}
              </span>
            </div>
          )}

          {/* ── Transcript ───────────────────────────────────────────────── */}
          <div ref={transcriptRef} className="nx-transcript scrollbar-thin">
            {transcript.length === 0 && phase !== 'connecting' && (
              <div className="nx-empty">
                <p className="nx-empty-t">Your voice matters</p>
                <p className="nx-empty-s">Press the button below to share your experience</p>
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

          {/* ── Contact captured chip ────────────────────────────────────── */}
          {(leadData.name || leadData.phone) && (
            <div className="nx-chip">
              <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0"
                   fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{[leadData.name, leadData.phone].filter(Boolean).join(' · ')}</span>
            </div>
          )}

          {/* ── Record button zone ───────────────────────────────────────── */}
          <div className="nx-btn-zone">
            <div className="nx-btn-wrap">

              {/* Sci-fi wave rings (recording) */}
              {isRecording && (
                <>
                  <div className="nx-wr nx-wr1" style={{ borderColor: color }} />
                  <div className="nx-wr nx-wr2" style={{ borderColor: color }} />
                  <div className="nx-wr nx-wr3" style={{ borderColor: color }} />
                </>
              )}

              {/* Countdown arc */}
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

              {/* The button */}
              <button
                onClick={toggleMic}
                disabled={busy}
                className={`nx-btn ${isRecording ? 'nx-btn-rec' : busy ? 'nx-btn-busy' : 'nx-btn-idle'}`}
                style={isRecording ? {
                  background: `radial-gradient(circle at 38% 30%, ${color}44 0%, ${color}16 55%, ${color}06 100%)`,
                  boxShadow: `0 0 0 2px ${color}50, 0 0 55px ${color}28, 0 10px 36px rgba(0,0,0,0.55)`,
                } : {}}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {isRecording ? (
                  /* Stop square */
                  <svg viewBox="0 0 24 24" className="nx-bi">
                    <rect x="6" y="6" width="12" height="12" rx="3" fill="white" />
                  </svg>
                ) : busy ? (
                  /* Spinner */
                  <div className="nx-spin" style={{ borderTopColor: color }} />
                ) : (
                  /* Mic */
                  <svg viewBox="0 0 24 24" className="nx-bi" fill="none"
                       stroke="white" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8"  y1="23" x2="16" y2="23" />
                  </svg>
                )}

                {/* Pulsing record indicator */}
                {isRecording && (
                  <span className="nx-recdot" style={{ background: color }} />
                )}
              </button>
            </div>

            {/* Countdown badge — shown above label when recording */}
            {isRecording && (
              <div className="nx-countdown-badge" style={{ borderColor: color + '55', color }}>
                <span className="nx-countdown-time">{countdown}</span>
                <span className="nx-countdown-sub">remaining</span>
              </div>
            )}

            {/* Label */}
            <p className="nx-btn-lbl">
              {isRecording    ? 'Press to stop recording'
               : busy         ? 'Please wait…'
               : phase === 'speaking' ? 'Agent is responding…'
               : 'Press to record your review'}
            </p>
          </div>

        </div>
      )}
    </div>
  )
}

// ── Robot particle background ──────────────────────────────────────────────────
const ROBOTS = Array.from({ length: 38 }, (_, i) => {
  const s = (i * 7919 + 6271) % 65536
  return {
    x:    s % 100,
    y:    (s * 3) % 100,
    size: s % 5 < 1 ? 16 : s % 5 < 3 ? 11 : 8,
    o:    0.06 + (s % 35) / 280,     // very subtle — 0.06 … 0.19
    t:    s % 3 === 0,
    d:    (s % 40) / 10,
    dur:  3.5 + (s % 30) / 10,
  }
})

function NxBg() {
  return (
    <div className="nx-bg" aria-hidden>
      <div className="nx-grid" />
      <div className="nx-blob nx-b1" />
      <div className="nx-blob nx-b2" />
      <div className="nx-blob nx-b3" />
      {ROBOTS.map((r, i) => (
        <div key={i}
             className={`nx-robot-bg ${r.t ? 'nx-robot-t' : ''}`}
             style={{
               left:              `${r.x}%`,
               top:               `${r.y}%`,
               fontSize:          `${r.size}px`,
               opacity:           r.o,
               animationDelay:    `${r.d}s`,
               animationDuration: `${r.dur}s`,
             }}>
          🤖
        </div>
      ))}
    </div>
  )
}
