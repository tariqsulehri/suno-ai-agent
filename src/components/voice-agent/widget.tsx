'use client'

import { useState } from 'react'
import { VoiceAgent } from './index'

interface VoiceAgentWidgetProps {
  tenantId?:    string
  token?:       string
  mode?:        'floating' | 'inline'
  margin?:      'none' | 'sm' | 'md'
}

export function VoiceAgentWidget({
  tenantId,
  token,
  mode = 'floating',
  margin = mode === 'inline' ? 'sm' : 'md',
}: VoiceAgentWidgetProps) {
  const [open, setOpen] = useState(false)
  const [inlineOpen, setInlineOpen] = useState(true)
  const inlinePadding = {
    none: 'p-0',
    sm:   'p-2',
    md:   'p-4 sm:p-6',
  }[margin]
  const floatingOffset = margin === 'none' ? 'bottom-0 right-0' : margin === 'sm' ? 'bottom-2 right-2' : 'bottom-6 right-6'

  if (mode === 'inline') {
    if (!inlineOpen) return null

    const closeInline = () => {
      setInlineOpen(false)
      window.parent?.postMessage({ type: 'voice-agent:close' }, '*')
    }

    return (
      <div className={`min-h-dvh w-full flex items-end justify-end ${inlinePadding}`}>
        <VoiceAgent tenantId={tenantId} token={token} onClose={closeInline} />
      </div>
    )
  }

  return (
    <>
      {/* ── Floating Agent Panel ──────────────────────────────────────────── */}
      {open && (
        <div
          className={`
            fixed ${floatingOffset} z-40
            w-[min(calc(100vw-3rem),440px)]
            max-h-[calc(100dvh-3rem)] overflow-y-auto
            transition-all duration-300 ease-in-out origin-bottom-right
            opacity-100 scale-100 translate-y-0 pointer-events-auto
          `}
        >
          <VoiceAgent tenantId={tenantId} token={token} onClose={() => setOpen(false)} />
        </div>
      )}

      {!open && (
        <button
          id="agent-fab"
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          aria-expanded={open}
          className="
            fixed z-50
            h-14 max-w-[calc(100vw-3rem)] rounded-full shadow-lg
            bg-ms-blue hover:bg-ms-blue-dk text-white
            flex items-center gap-3 px-4
            transition-all duration-200
            ring-4 ring-ms-blue/20 hover:ring-ms-blue/30
            focus:outline-none focus-visible:ring-4
          "
          style={{
            right: margin === 'none' ? 0 : margin === 'sm' ? 8 : 24,
            bottom: margin === 'none' ? 0 : margin === 'sm' ? 8 : 24,
          }}
        >
          <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none"
                 stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <span className="text-sm font-semibold whitespace-nowrap">Chat with us</span>
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none"
               stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </button>
      )}
    </>
  )
}
