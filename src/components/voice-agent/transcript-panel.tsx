'use client'

import { useEffect, useRef } from 'react'
import type { Message } from '@/types'
import type { Phase } from '@/types'
import { AnimatedAvatar } from './avatar'

interface Props {
  messages:      Message[]
  partialReply:  string
  agentName:     string
  agentInitials: string
  phase:         Phase
}

export function TranscriptPanel({ messages, partialReply, agentName, agentInitials, phase }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, partialReply])

  const isEmpty = messages.length === 0 && !partialReply

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4
                    flex flex-col gap-1 min-h-0 bg-surface-hover">

      {/* ── Welcome / empty state ────────────────────────────────────────── */}
      {isEmpty && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 py-6">
          <AnimatedAvatar phase={phase} size="lg" />

          <div className="flex flex-col items-center gap-1.5 text-center px-6">
            {phase === 'connecting' ? (
              <>
                <p className="text-sm font-semibold text-ms-text">Just a moment…</p>
                <p className="text-xs text-ms-muted">Your support agent is getting ready</p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-ms-text">
                  👋 Hi! I&apos;m here to help
                </p>
                <p className="text-xs text-ms-muted leading-relaxed">
                  Ask me anything — type your question below or<br />hold the mic to speak.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {messages.map((msg, i) => {
        const prev = messages[i - 1]
        const showMeta = !prev || prev.role !== msg.role
        return (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            agentInitials={agentInitials}
            showMeta={showMeta}
          />
        )
      })}

      {/* Live streaming reply */}
      {partialReply && (
        <MessageBubble
          role="assistant"
          content={partialReply}
          agentInitials={agentInitials}
          showMeta={messages.length === 0 || messages[messages.length - 1]?.role !== 'assistant'}
          streaming
        />
      )}

      {/* Thinking indicator — show when thinking but no partial reply yet */}
      {phase === 'thinking' && !partialReply && (
        <div className="flex items-end gap-2 mt-1">
          <Avatar initials={agentInitials} />
          <div className="bg-white border border-surface-border rounded-2xl rounded-bl-sm
                          px-4 py-3 shadow-bubble flex items-center gap-1">
            <TypingDots />
          </div>
        </div>
      )}

      <div ref={bottomRef} className="h-1" />
    </div>
  )
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ initials }: { initials: string }) {
  return (
    <div className="w-7 h-7 rounded-full bg-ms-teal flex items-center justify-center
                    text-white text-[10px] font-semibold shrink-0 mb-0.5">
      {initials}
    </div>
  )
}

// ── Typing dots ────────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="typing-dot w-1.5 h-1.5 rounded-full bg-ms-teal animate-typing"
        />
      ))}
    </span>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────────────
interface BubbleProps {
  role:          'user' | 'assistant'
  content:       string
  agentInitials: string
  showMeta:      boolean
  streaming?:    boolean
}

function MessageBubble({ role, content, agentInitials, showMeta, streaming }: BubbleProps) {
  const isAgent = role === 'assistant'

  if (isAgent) {
    return (
      <div className={`flex items-end gap-2 msg-enter ${showMeta ? 'mt-3' : 'mt-0.5'}`}>
        {/* Avatar — only on first in a group */}
        {showMeta ? <Avatar initials={agentInitials} /> : <div className="w-7 shrink-0" />}

        <div className="flex flex-col gap-0.5 max-w-[80%]">
          {showMeta && (
            <span className="text-[11px] text-ms-muted font-medium ml-0.5">Client Support</span>
          )}
          <div className="bg-white border border-surface-border rounded-2xl rounded-bl-sm
                          px-4 py-2.5 shadow-bubble text-sm text-ms-text leading-relaxed">
            {content}
            {streaming && (
              <span className="inline-block w-0.5 h-3.5 bg-ms-blue ml-0.5
                               animate-pulse_dot align-middle rounded-sm" />
            )}
          </div>
        </div>
      </div>
    )
  }

  // User bubble
  return (
    <div className={`flex justify-end msg-enter ${showMeta ? 'mt-3' : 'mt-0.5'}`}>
      <div className="max-w-[80%] flex flex-col items-end gap-0.5">
        {showMeta && (
          <span className="text-[11px] text-ms-muted font-medium mr-0.5">You</span>
        )}
        <div className="bg-ms-blue rounded-2xl rounded-br-sm px-4 py-2.5
                        text-sm text-white leading-relaxed shadow-bubble">
          {content}
        </div>
      </div>
    </div>
  )
}
