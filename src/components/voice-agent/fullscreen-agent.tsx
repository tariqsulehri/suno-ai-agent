'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useVoiceAgent } from '@/hooks/use-voice-agent'
import { AnimatedAvatar }  from './avatar'
import { TextInput, type TextInputHandle } from './text-input'
import { MicButton }       from './mic-button'
import type { Message, Phase } from '@/types'

interface Props { tenantId?: string; token?: string }

export function FullscreenAgent({ tenantId, token }: Props) {
  const textRef       = useRef<TextInputHandle>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  const {
    phase, transcript, partialReply, error,
    isRecording, isPlaying,
    outputMode, setOutputMode,
    agentName, companyName,
    pressMic, releaseMic, sendText, stopPlayback,
  } = useVoiceAgent({ tenantId, token })

  // Track whether user scrolled away from bottom
  const handleScroll = useCallback(() => {
    const el = transcriptRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }, [])

  // Auto-scroll to latest message only when already at bottom
  useEffect(() => {
    if (!isAtBottomRef.current) return
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [transcript, partialReply])

  const statusLabel: Record<Phase, string> = {
    connecting:   'Initialising system…',
    idle:         'Online — How can I assist you?',
    listening:    'Receiving audio signal…',
    transcribing: 'Decoding voice data…',
    thinking:     'Processing request…',
    speaking:     'Transmitting response…',
    ended:        'Session terminated',
    error:        'System error detected',
  }
  const statusColor: Partial<Record<Phase, string>> = {
    listening:  'text-amber-400',
    thinking:   'text-purple-400',
    speaking:   'text-cyan-300',
    error:      'text-red-400',
    ended:      'text-slate-500',
  }

  return (
    <div className="fs-root">

      {/* ════════════ BACKGROUND LAYER ════════════ */}
      <div className="fs-bg" aria-hidden="true">

        {/* Stars */}
        <svg className="fs-stars" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r}
              fill="white" opacity={s.o}
              className={s.twinkle ? 'fs-star-twinkle' : ''}
              style={s.twinkle ? { animationDelay: `${s.td}s`, animationDuration: `${s.dur}s` } : undefined}
            />
          ))}
        </svg>

        {/* Mars planet — bottom right */}
        <div className="fs-mars-wrap">
          <svg viewBox="0 0 500 500" className="fs-mars-svg">
            <defs>
              <radialGradient id="marsBody" cx="38%" cy="35%" r="65%">
                <stop offset="0%"   stopColor="#C85C2A" />
                <stop offset="40%"  stopColor="#A03E18" />
                <stop offset="75%"  stopColor="#7A2C0E" />
                <stop offset="100%" stopColor="#3D1208" />
              </radialGradient>
              <radialGradient id="marsAtm" cx="50%" cy="50%" r="50%">
                <stop offset="75%"  stopColor="transparent" />
                <stop offset="90%"  stopColor="rgba(200,90,30,0.25)" />
                <stop offset="100%" stopColor="rgba(200,90,30,0)" />
              </radialGradient>
              <radialGradient id="marsShine" cx="30%" cy="28%" r="45%">
                <stop offset="0%"   stopColor="rgba(255,200,160,0.18)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              <clipPath id="marsClip"><circle cx="250" cy="250" r="250"/></clipPath>
            </defs>

            {/* Base sphere */}
            <circle cx="250" cy="250" r="250" fill="url(#marsBody)" />

            {/* Surface bands */}
            <ellipse cx="250" cy="200" rx="240" ry="35"
              fill="rgba(160,60,20,0.25)" clipPath="url(#marsClip)" />
            <ellipse cx="250" cy="310" rx="240" ry="28"
              fill="rgba(90,25,8,0.3)" clipPath="url(#marsClip)" />
            <ellipse cx="250" cy="380" rx="240" ry="20"
              fill="rgba(180,70,25,0.2)" clipPath="url(#marsClip)" />

            {/* Craters */}
            {[
              [180,160,28],[320,220,18],[140,290,14],[360,150,10],
              [280,340,22],[90,200,9],[410,300,12],[230,440,16],[350,400,8],
            ].map(([cx,cy,r],i) => (
              <g key={i} clipPath="url(#marsClip)">
                <circle cx={cx} cy={cy} r={r} fill="rgba(50,15,5,0.45)" />
                <circle cx={cx-r*0.25} cy={cy-r*0.25} r={r*0.6}
                  fill="rgba(100,35,12,0.3)" />
                <ellipse cx={cx+r*0.4} cy={cy+r*0.3} rx={r*0.9} ry={r*0.2}
                  fill="rgba(20,5,2,0.3)" />
              </g>
            ))}

            {/* Polar cap */}
            <ellipse cx="250" cy="30" rx="80" ry="30"
              fill="rgba(240,210,190,0.35)" clipPath="url(#marsClip)" />

            {/* Shine */}
            <circle cx="250" cy="250" r="250" fill="url(#marsShine)" />

            {/* Atmosphere rim */}
            <circle cx="250" cy="250" r="250" fill="url(#marsAtm)" />
          </svg>
        </div>

        {/* Atmospheric haze — near Mars */}
        <div className="fs-mars-haze" />

        {/* Nebula clouds */}
        <div className="fs-nebula fs-nebula-1" />
        <div className="fs-nebula fs-nebula-2" />
        <div className="fs-nebula fs-nebula-3" />

        {/* Circuit overlay */}
        <svg className="fs-circuit" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <g stroke="#FF6B35" strokeOpacity="0.06" strokeWidth="1" fill="none">
            <path d="M0 80 H180 V40 H320 V80 H500 V40" />
            <path d="M1200 120 H1020 V60 H880 V120 H700" />
            <path d="M0 700 H160 V760 H300" />
            <path d="M1200 700 H1040 V760 H900" />
            <path d="M80 0 V120 H30 V220" />
            <path d="M1120 0 V120 H1170 V220" />
            <circle cx="320" cy="80"  r="3" fill="#FF6B35" fillOpacity="0.2" stroke="none"/>
            <circle cx="880" cy="120" r="3" fill="#FF6B35" fillOpacity="0.2" stroke="none"/>
            <circle cx="30"  cy="220" r="3" fill="#00D4FF" fillOpacity="0.15" stroke="none"/>
            <circle cx="1170" cy="220" r="3" fill="#00D4FF" fillOpacity="0.15" stroke="none"/>
          </g>
          <g stroke="#00D4FF" strokeOpacity="0.04" strokeWidth="0.8" fill="none">
            <path d="M0 400 H80 V480 H160 V400 H280" />
            <path d="M1200 400 H1120 V480 H1040 V400 H920" />
          </g>
        </svg>
      </div>

      {/* ════════════ CONTENT ════════════ */}
      <div className="fs-content">

        {/* ── HERO / SPACE ZONE (non-work area) ─────────────────────────── */}
        <div className="fs-hero">

          {/* Top HUD bar */}
          <div className="fs-hud-bar">
            <div className="fs-hud-left">
              <span className="fs-hud-dot fs-hud-dot-green" />
              <span className="fs-hud-label">SYS ONLINE</span>
            </div>
            <div className="fs-hud-right">
              <span className="fs-hud-label">ARIA v2.0</span>
              <span className="fs-hud-dot fs-hud-dot-blue" />
            </div>
          </div>

          {/* Company name — always visible, prominent */}
          <div className="fs-company-block">
            <span className="fs-company-name">{companyName || 'AI Support'}</span>
            <span className="fs-company-live">
              <span className="fs-badge-dot" />
              LIVE
            </span>
          </div>

          {/* Avatar */}
          <div className="fs-avatar-wrap">
            <AnimatedAvatar phase={phase} size="lg" />
          </div>

          {/* Agent name */}
          <p className="fs-agent-name">{agentName || 'Support Agent'}</p>

          {/* Status line */}
          <div className="fs-status-row">
            <span className={`fs-status-dot ${
              phase === 'speaking'  ? 'fs-dot-cyan'   :
              phase === 'listening' ? 'fs-dot-amber'  :
              phase === 'thinking'  ? 'fs-dot-purple' :
              phase === 'error'     ? 'fs-dot-red'    : 'fs-dot-green'
            }`} />
            <span className={`fs-status-text ${statusColor[phase] ?? 'text-slate-400'}`}>
              {error && phase === 'error' ? error : statusLabel[phase]}
            </span>
          </div>

          {/* Waveform (speaking) */}
          {(phase === 'speaking' || isPlaying) && (
            <div className="fs-waveform" aria-hidden="true">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="fs-wave-bar"
                     style={{ animationDelay: `${(i * 0.055).toFixed(3)}s` }} />
              ))}
            </div>
          )}
        </div>

        {/* ── CONSOLE ZONE (work area) ───────────────────────────────────── */}
        <div className="fs-console">

          {/* Console top edge */}
          <div className="fs-console-edge" />

          {/* Corner accents */}
          <div className="fs-corner fs-corner-tl" />
          <div className="fs-corner fs-corner-tr" />

          {/* Transcript */}
          <div ref={transcriptRef} onScroll={handleScroll} className="fs-transcript scrollbar-thin">
            {transcript.length === 0 && phase !== 'connecting' && (
              <div className="fs-empty-state">
                <div className="fs-empty-icon">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none"
                       stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" d="M8 12h.01M12 12h.01M16 12h.01
                      M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949
                      L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12
                      c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="fs-empty-text">Awaiting your message…</p>
                <p className="fs-empty-sub">Type below or hold mic to speak</p>
              </div>
            )}

            {transcript.map((msg, i) => (
              <FsBubble key={msg.id} msg={msg}
                        isFirst={i === 0 || transcript[i-1].role !== msg.role} />
            ))}

            {partialReply && (
              <FsBubble
                msg={{ id: '__partial', role: 'assistant', content: partialReply }}
                isFirst={!transcript.length || transcript[transcript.length-1]?.role !== 'assistant'}
                streaming />
            )}
          </div>

          {/* Input bar */}
          <div className="fs-input-bar">
            <div className="fs-input-divider" />

            {isRecording && (
              <p className="fs-rec-hint">● REC — Release to transmit</p>
            )}

            <div className="fs-input-row">

              {/* ── Glowing text box ──────────────────────────────────────── */}
              <div className={`fs-textbox-wrap ${
                phase === 'listening' ? 'fs-textbox-listening' :
                phase === 'speaking'  ? 'fs-textbox-speaking'  : ''}`}>
                <TextInput ref={textRef} phase={phase} onSend={sendText} />
              </div>

              {/* ── Controls cluster (right side) ─────────────────────────── */}
              <div className="fs-controls">

                {/* Speaker */}
                <button type="button"
                  onClick={() => { if (isPlaying) stopPlayback(); setOutputMode(outputMode === 'voice' ? 'text' : 'voice') }}
                  title={outputMode === 'voice' ? 'Voice ON' : 'Voice OFF'}
                  className={`fs-ctrl-btn ${outputMode === 'voice' ? 'fs-ctrl-active-cyan' : ''}`}>
                  {outputMode === 'voice' ? (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none"
                         stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none"
                         stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <line x1="23" y1="9" x2="17" y2="15"/>
                      <line x1="17" y1="9" x2="23" y2="15"/>
                    </svg>
                  )}
                </button>

                {/* Mic */}
                <MicButton phase={phase} isRecording={isRecording}
                           onPressDown={pressMic} onPressUp={releaseMic} />

                {/* Send */}
                <button type="button" onClick={() => textRef.current?.submit()}
                        disabled={phase !== 'idle' && phase !== 'error'}
                        className="fs-send-btn" aria-label="Send">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none"
                       stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Bubble ────────────────────────────────────────────────────────────────────
function FsBubble({ msg, isFirst, streaming }: {
  msg: Message; isFirst: boolean; streaming?: boolean
}) {
  const isAgent = msg.role === 'assistant'
  return (
    <div className={`fs-bubble-row ${isAgent ? 'fs-bubble-left' : 'fs-bubble-right'}
                    ${isFirst ? 'mt-4' : 'mt-1'} msg-enter`}>
      <div className={`fs-bubble ${isAgent ? 'fs-bubble-agent' : 'fs-bubble-user'}`}>
        {msg.content}
        {streaming && <span className="inline-block w-0.5 h-3.5 bg-cyan-400 ml-1
                            animate-pulse_dot align-middle rounded-sm" />}
      </div>
    </div>
  )
}

// ── Star data (static, generated once) ───────────────────────────────────────
const STARS = Array.from({ length: 160 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280
  return {
    x:       (seed % 1200),
    y:       ((seed * 7) % 800),
    r:       ((seed % 5) < 1 ? 1.4 : (seed % 5) < 3 ? 0.9 : 0.5),
    o:       0.2 + (seed % 100) / 130,
    twinkle: seed % 3 === 0,
    td:      (seed % 40) / 10,
    dur:     2 + (seed % 30) / 10,
  }
})
