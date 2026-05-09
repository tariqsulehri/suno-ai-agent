'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useVoiceAgent } from '@/hooks/use-voice-agent'
import { AnimatedAvatar } from './avatar'
import type { Phase } from '@/types'
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
  positive:   '😊 Positive Experience',
  negative:   '😐 Negative Feedback',
  complaint:  '🚨 Formal Complaint',
  suggestion: '💡 Suggestion',
}

// ── Theme system ───────────────────────────────────────────────────────────────
const THEMES: VoiceThemeName[] = ['nexus', 'daylight', 'emerald', 'ember']

const THEME_ACCENTS: Record<VoiceThemeName, string> = {
  nexus:    '#00E5FF',
  daylight: '#2563EB',
  emerald:  '#10B981',
  ember:    '#F97316',
}

const THEME_LABELS: Record<VoiceThemeName, string> = {
  nexus:    'Nexus',
  daylight: 'Daylight',
  emerald:  'Emerald',
  ember:    'Ember',
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

// ── Public interface ───────────────────────────────────────────────────────────
interface Props { tenantId?: string; token?: string; shopCode?: string }

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
const VALID_SHOPS = ['shop1', 'shop2', 'shop3', 'shop4']

function NexusAgentInner({ tenantId, token, shopCode, onReset }: Props & { onReset: () => void }) {
  const validShop = !!(shopCode && VALID_SHOPS.includes(shopCode.toLowerCase()))

  const {
    phase, transcript, partialReply, error,
    isRecording,
    agentName, companyName,
    language, setLanguage,
    reviewData, leadData, callSummary,
    toggleMic, endCall,
  } = useVoiceAgent({ tenantId, token, shopCode, defaultOutputMode: 'voice', webSpeech: false, browserTts: false })

  const transcriptRef = useRef<HTMLDivElement>(null)
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const endTimerRef   = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const resetTickRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const MAX = 60

  const [recSecs,     setRecSecs]    = useState(0)
  const [endStep,     setEndStep]    = useState<'sending' | 'confirmed' | null>(null)
  const [resetSecs,   setResetSecs]  = useState(5)
  const [themeColor,  setThemeColor] = useState(DEFAULT_COLOR)
  const [activeTheme, setActiveTheme] = useState<VoiceThemeName>(() => {
    if (typeof document !== 'undefined') {
      const t = document.documentElement.dataset.vaTheme
      if (t && THEMES.includes(t as VoiceThemeName)) return t as VoiceThemeName
    }
    return 'nexus'
  })

  // Sync --nx-accent → themeColor and data-va-theme → activeTheme via MutationObserver.
  // The observer covers both direct attribute changes and postMessage-driven style updates
  // (ThemeProvider calls root.style.setProperty which triggers the 'style' attribute watch).
  useEffect(() => {
    const readAccent = () => {
      const root  = document.documentElement
      const value = getComputedStyle(root).getPropertyValue('--nx-accent').trim()
      if (/^#[0-9a-fA-F]{6}$/.test(value)) setThemeColor(value)
      const t = root.dataset.vaTheme
      if (t && THEMES.includes(t as VoiceThemeName)) setActiveTheme(t as VoiceThemeName)
    }

    readAccent()
    const observer = new MutationObserver(readAccent)
    observer.observe(document.documentElement, {
      attributes:     true,
      attributeFilter: ['style', 'data-va-theme'],
    })
    return () => observer.disconnect()
  }, [])

  // In-page theme switcher
  const handleThemeChange = useCallback((t: VoiceThemeName) => {
    document.documentElement.dataset.vaTheme = t
    setActiveTheme(t)
    // MutationObserver fires readAccent → updates themeColor automatically
  }, [])

  // Auto-scroll transcript
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [transcript, partialReply])

  // Recording countdown — auto-stops at 60 s
  useEffect(() => {
    if (isRecording) {
      setRecSecs(0)
      timerRef.current = setInterval(() => {
        setRecSecs(s => {
          if (s >= MAX - 1) { toggleMic(); return MAX }
          return s + 1
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setRecSecs(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRecording, toggleMic])

  function startResetCountdown() {
    setResetSecs(5)
    resetTickRef.current = setInterval(() => {
      setResetSecs(s => {
        if (s <= 1) {
          clearInterval(resetTickRef.current!)
          resetTickRef.current = null
          onReset()
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  // Step 1 — phase transitions to 'ended': show sending screen (or skip for positive).
  useEffect(() => {
    if (phase !== 'ended') return
    const isPositive = reviewData.sentiment === 'positive'
    if (isPositive) {
      // Positive: no send needed — go straight to confirmed after a brief settle
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
  }, [phase])

  // Step 2 — callSummary arrives from API: hold 2.5 s then show confirmed.
  useEffect(() => {
    if (endStep !== 'sending' || !callSummary) return
    if (endTimerRef.current) clearTimeout(endTimerRef.current)  // cancel fallback
    endTimerRef.current = setTimeout(() => {
      setEndStep('confirmed')
      startResetCountdown()
    }, 2500)
    return () => { if (endTimerRef.current) clearTimeout(endTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callSummary, endStep])

  const color = reviewData.sentiment ? mc(reviewData.sentiment) : themeColor
  const ended = phase === 'ended'
  const busy  = phase === 'thinking' || phase === 'transcribing' || phase === 'connecting'

  // MM:SS — counts down from 1:00 to 0:00
  const remaining = MAX - recSecs
  const mm        = Math.floor(remaining / 60)
  const ss        = (remaining % 60).toString().padStart(2, '0')
  const countdown = `${mm}:${ss}`

  // SVG progress arc — depletes as time is used
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
            <div className="nx-shop-icon">⚙️</div>
            <h2 className="nx-shop-title">Agent Not Available</h2>
            <p className="nx-shop-body">
              This agent has not been configured for your location.
              Please contact your administrator.
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

            <h1 className="nx-conf-title" style={{ color }}>
              {reviewData.sentiment === 'positive' ? 'Thank you!' : 'Sent!'}
            </h1>

            <p className="nx-conf-msg">
              {END_MSG[reviewData.sentiment ?? ''] ?? 'Your message has been sent to our team.'}
            </p>

            {reviewData.sentiment !== 'positive' && (
              <p className="nx-conf-sub">We will reach out to you shortly.</p>
            )}

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
      {validShop && !ended && (
        <div className="nx-content">

          {/* ── Error banner ────────────────────────────────────────────── */}
          {phase === 'error' && error && (
            <div className="nx-err-banner">
              {error.includes('quota') || error.includes('429')
                ? <>⚡ Service limit reached — please try again later</>
                : <>⚠️ {error}</>}
            </div>
          )}

          {/* ── Header ──────────────────────────────────────────────────── */}
          <header className="nx-header">
            <div className="nx-hdr-l">
              <span className="nx-live-dot" />
              <span className="nx-company">{companyName || 'Customer Experience'}</span>
            </div>

            {/* Theme picker */}
            <div className="nx-theme-picker" role="group" aria-label="Select theme">
              {THEMES.map(t => (
                <button
                  key={t}
                  className={`nx-theme-dot${activeTheme === t ? ' nx-theme-dot-active' : ''}`}
                  style={{ background: THEME_ACCENTS[t] }}
                  onClick={() => handleThemeChange(t)}
                  aria-label={`${THEME_LABELS[t]} theme`}
                  aria-pressed={activeTheme === t}
                  title={THEME_LABELS[t]}
                />
              ))}
            </div>

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
          </header>

          {/* ── Agent avatar ─────────────────────────────────────────────── */}
          <div className="nx-orb-section">
            <div className="nx-avatar-wrap">
              <AnimatedAvatar phase={phase} color={color} />
            </div>

            <p className="nx-agent-name">{agentName || 'Review Agent'}</p>
            <p className="nx-status-txt" role="status" aria-live="polite">
              {error && phase === 'error' ? error : STATUS[phase]}
            </p>
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
                style={isRecording ? {
                  background: `radial-gradient(circle at 38% 30%, ${color}CC 0%, ${color}66 50%, ${color}22 100%)`,
                  boxShadow:  `0 0 0 3px ${color}DD, 0 0 0 9px ${color}30, 0 0 60px ${color}77, 0 14px 44px rgba(0,0,0,0.70)`,
                } : {}}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {isRecording ? (
                  <svg viewBox="0 0 24 24" className="nx-bi">
                    <rect x="6" y="6" width="12" height="12" rx="3" fill="white" />
                  </svg>
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
                <span className="nx-countdown-time">{countdown}</span>
                <span className="nx-countdown-sub">remaining</span>
              </div>
            )}

            <p className="nx-btn-lbl">
              {isRecording         ? 'Press to stop recording'
               : busy              ? 'Please wait…'
               : phase === 'speaking' ? 'Agent is responding…'
               : 'Press to record your review'}
            </p>

            {/* End Call — shown only after the customer has spoken at least once */}
            {transcript.some((m) => m.role === 'user') && (
              <button className="nx-end-btn" onClick={endCall} aria-label="End call">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
                     stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.42 19.42 0 013.07 8.72 19.79 19.79 0 01.36 .54 2 2 0 012.18 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.16 9.9a16 16 0 004.52 3.41z"/>
                  <line x1="23" y1="1" x2="1" y2="23"/>
                </svg>
                End Call
              </button>
            )}
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
    o:    0.06 + (s % 35) / 280,
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
