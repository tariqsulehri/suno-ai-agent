'use client'

import { useRef } from 'react'
import { useVoiceAgent } from '@/hooks/use-voice-agent'
import { TranscriptPanel }              from './transcript-panel'
import { MicButton }                    from './mic-button'
import { SettingsBar }                  from './settings-bar'
import { TextInput, type TextInputHandle } from './text-input'
import { LeadPanel }                    from './lead-panel'
import { StatusIndicator }              from './status-indicator'
import { AnimatedAvatar }               from './avatar'

interface VoiceAgentProps {
  tenantId?: string
  token?:    string
  onClose?:  () => void
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export function VoiceAgent({ tenantId, token, onClose }: VoiceAgentProps) {
  const textRef = useRef<TextInputHandle>(null)

  const {
    phase, transcript, partialReply, error,
    isRecording,
    language, voice, outputMode, leadData, callSummary,
    agentName, companyName,
    setVoice, setOutputMode, stopPlayback, pressMic, releaseMic, sendText,
  } = useVoiceAgent({ tenantId, token })

  const initials = getInitials(agentName || 'CS')
  const isOnline = phase !== 'connecting' && phase !== 'error' && phase !== 'ended'
  const handleClose = () => {
    stopPlayback()
    onClose?.()
  }

  return (
    <div className="w-full max-w-[440px] flex flex-col gap-4">

      {/* ── Chat window ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden flex flex-col"
           style={{ minHeight: 560, maxHeight: '82vh' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="bg-ms-teal px-5 py-4 flex items-center gap-3 shadow-header shrink-0">
          <div className="shrink-0">
            <AnimatedAvatar phase={phase} size="sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">
              {agentName || 'Support Agent'}
            </p>
            <p className="text-white/70 text-xs truncate">
              {companyName || 'AI Support'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-white/40'}`} />
            <span className="text-white/80 text-xs font-medium">
              {isOnline ? 'Online' : 'Offline'}
            </span>
            {onClose && (
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close chat"
                className="
                  ml-1 w-8 h-8 rounded-full flex items-center justify-center
                  text-white/80 hover:text-white hover:bg-white/15
                  transition-colors focus:outline-none focus-visible:ring-2
                  focus-visible:ring-white/70
                "
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none"
                     stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </header>

        {/* ── Contextual status banner ────────────────────────────────────── */}
        <StatusIndicator phase={phase} />

        {/* ── Error banner ────────────────────────────────────────────────── */}
        {error && phase === 'error' && (
          <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100
                          flex items-start gap-2 shrink-0">
            <svg className="w-4 h-4 text-ms-red mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0zm-7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-1-9a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1z" clipRule="evenodd"/>
            </svg>
            <p className="text-xs text-red-700 leading-relaxed">{error}</p>
          </div>
        )}

        {/* ── Transcript ──────────────────────────────────────────────────── */}
        <TranscriptPanel
          messages={transcript}
          partialReply={partialReply}
          agentName={agentName || 'Agent'}
          agentInitials={initials}
          phase={phase}
        />

        {/* ── Input bar ───────────────────────────────────────────────────── */}
        <div className="border-t border-surface-border bg-white px-4 py-3 shrink-0">

          {/* Push-to-talk hint — shown while recording */}
          {isRecording && (
            <p className="text-[11px] text-ms-red font-medium text-center mb-2 animate-pulse_dot">
              🔴 Recording… release to send
            </p>
          )}

          {/* Row: [TextInput] [OutputToggle] [Mic] [Send] */}
          <div className="flex items-end gap-2">

            {/* Text input — no send button inside */}
            <TextInput ref={textRef} phase={phase} onSend={sendText} />

            {/* Voice / text output toggle */}
            <button
              type="button"
              onClick={() => setOutputMode(outputMode === 'voice' ? 'text' : 'voice')}
              aria-label={outputMode === 'voice' ? 'Switch to text output' : 'Switch to voice output'}
              title={outputMode === 'voice' ? 'Voice output on' : 'Voice output off'}
              className={`
                shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors
                ${outputMode === 'voice'
                  ? 'bg-ms-teal/10 text-ms-teal hover:bg-ms-teal/20'
                  : 'bg-surface text-ms-muted hover:bg-surface-border'}
              `}
            >
              {outputMode === 'voice' ? (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none"
                     stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none"
                     stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              )}
            </button>

            {/* Mic — push-to-talk: hold → record, release → send */}
            <MicButton
              phase={phase}
              isRecording={isRecording}
              onPressDown={pressMic}
              onPressUp={releaseMic}
            />

            {/* Send text message — upward arrow */}
            <button
              type="button"
              onClick={() => textRef.current?.submit()}
              disabled={phase !== 'idle' && phase !== 'error'}
              aria-label="Send message"
              className="
                shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
                bg-ms-teal hover:bg-ms-teal-dk
                disabled:bg-surface disabled:cursor-not-allowed
                transition-colors
              "
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none"
                   stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Settings footer ─────────────────────────────────────────────── */}
        <div className="border-t border-surface-border bg-surface-raised px-4 py-2 shrink-0">
          <SettingsBar language={language} voice={voice} onVoice={setVoice} />
        </div>
      </div>

      {/* ── Lead / Summary panel ────────────────────────────────────────── */}
      <LeadPanel lead={leadData} callSummary={callSummary} />
    </div>
  )
}
