'use client'

import type { Phase } from '@/types'

interface AvatarProps {
  phase: Phase
  size?: 'sm' | 'lg'
  color?: string
}

export function AnimatedAvatar({ phase, size = 'lg', color = '#00F5FF' }: AvatarProps) {
  const isSpeaking  = phase === 'speaking'
  const isListening = phase === 'listening' || phase === 'transcribing'
  const isThinking  = phase === 'thinking'
  const dim         = size === 'lg' ? 160 : 44

  return (
    <div className="relative flex items-center justify-center select-none"
         style={{ width: dim, height: dim }}>

      {/* ── Ambient glow backdrop ─────────────────────────────────────────── */}
      {size === 'lg' && (
        <div className="absolute inset-0 rounded-full pointer-events-none"
             style={{
               background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`,
               filter: 'blur(24px)',
               transform: 'scale(2.0)',
             }} />
      )}

      {/* ── Orbital hex rings ─────────────────────────────────────────────── */}
      {size === 'lg' && <>
        <div className={`absolute robot26-hex-ring robot26-ring-1
          ${isSpeaking ? 'robot26-spin-fast' : 'robot26-spin-slow'}`}
          style={{
            width: dim + 36, height: dim + 36,
            borderColor: color + 'BB',
            boxShadow: `0 0 18px ${color}77, 0 0 36px ${color}33, inset 0 0 14px ${color}22`,
          }} />
        <div className={`absolute robot26-hex-ring robot26-ring-2
          ${isListening ? 'robot26-spin-fast' : 'robot26-spin-slow'}`}
          style={{
            width: dim + 64, height: dim + 64,
            animationDirection: 'reverse',
            borderColor: color + '66',
            boxShadow: `0 0 22px ${color}44, 0 0 50px ${color}22`,
          }} />
      </>}

      {/* ── Pulse rings (speaking) ────────────────────────────────────────── */}
      {isSpeaking && size === 'lg' && [1, 2, 3].map(n => (
        <div key={n} className={`absolute rounded-full robot26-pulse robot26-pulse-${n}`}
             style={{ width: dim, height: dim, borderColor: color + '80' }} />
      ))}

      {/* ── Listen ring ──────────────────────────────────────────────────── */}
      {isListening && size === 'lg' && (
        <div className="absolute rounded-full robot26-listen-ring"
             style={{ width: dim, height: dim, borderColor: color + '88' }} />
      )}

      {/* ── Corner scan particles ─────────────────────────────────────────── */}
      {size === 'lg' && ['tl', 'tr', 'bl', 'br'].map(pos => (
        <div key={pos} className={`absolute robot26-corner-node robot26-corner-${pos}
          ${isSpeaking || isListening ? 'robot26-node-active' : ''}`}
             style={
               isSpeaking || isListening
                 ? { background: color, boxShadow: `0 0 8px ${color}` }
                 : { background: color + '55' }
             } />
      ))}

      {/* ── Main SVG ──────────────────────────────────────────────────────── */}
      <div className={`relative z-10
        ${isSpeaking  ? 'robot26-bob-speak'  :
          isListening ? 'robot26-bob-listen' :
          isThinking  ? 'robot26-bob-think'  : 'robot26-float'}`}
        style={{ width: dim, height: dim }}>

        <svg viewBox="0 0 160 160" width={dim} height={dim} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="r26bg" cx="50%" cy="30%" r="70%">
              <stop offset="0%"  stopColor="#0C1A30"/>
              <stop offset="100%" stopColor="#050C1C"/>
            </radialGradient>
            <linearGradient id="r26head" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"  stopColor="#162840"/>
              <stop offset="50%" stopColor="#0D1D32"/>
              <stop offset="100%" stopColor="#071320"/>
            </linearGradient>
            <linearGradient id="r26edge" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"  stopColor={color}    stopOpacity="0.9"/>
              <stop offset="50%" stopColor="#0066FF"  stopOpacity="0.5"/>
              <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.8"/>
            </linearGradient>
            <linearGradient id="r26visor" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"  stopColor="#001833"/>
              <stop offset="50%" stopColor="#002244"/>
              <stop offset="100%" stopColor="#001833"/>
            </linearGradient>
            <radialGradient id="r26glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor={color} stopOpacity="0.45"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </radialGradient>
            <filter id="r26blur" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="r26glow2" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.5" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <clipPath id="r26headClip">
              <path d="M55,22 L105,22 L122,38 L128,80 L122,118 L105,130
                       L55,130  L38,118  L32,80   L38,38 Z"/>
            </clipPath>
          </defs>

          {/* ── Base circle ───────────────────────────────────────────────── */}
          <circle cx="80" cy="80" r="80" fill="url(#r26bg)"/>

          {/* ── Glow behind head ──────────────────────────────────────────── */}
          <ellipse cx="80" cy="80" rx="52" ry="58" fill="url(#r26glow)"
                   className={isSpeaking ? 'robot26-glow-pulse' : ''}/>

          {/* ── Head body ─────────────────────────────────────────────────── */}
          <path d="M55,22 L105,22 L122,38 L128,80 L122,118 L105,130
                   L55,130  L38,118  L32,80   L38,38 Z"
                fill="url(#r26head)" />

          {/* ── Edge glow outline ─────────────────────────────────────────── */}
          <path d="M55,22 L105,22 L122,38 L128,80 L122,118 L105,130
                   L55,130  L38,118  L32,80   L38,38 Z"
                fill="none" stroke="url(#r26edge)" strokeWidth="1.2"
                filter="url(#r26blur)"
                className={isSpeaking || isListening ? 'robot26-edge-pulse' : ''}/>

          {/* ── Surface grid ──────────────────────────────────────────────── */}
          <g clipPath="url(#r26headClip)" stroke={color} strokeOpacity="0.07"
             strokeWidth="0.6" fill="none">
            {[35, 50, 65, 80, 95, 110, 125].map(y => (
              <line key={y} x1="30" y1={y} x2="130" y2={y}/>
            ))}
            {[40, 55, 70, 85, 100, 115].map(x => (
              <line key={x} x1={x} y1="20" x2={x} y2="132"/>
            ))}
          </g>

          {/* ── Antenna ───────────────────────────────────────────────────── */}
          <line x1="80" y1="22" x2="80" y2="8"
                stroke={color} strokeWidth="1.8" strokeOpacity="0.85"/>
          <rect x="75" y="4" width="10" height="5" rx="2"
                fill="#071320" stroke={color} strokeWidth="1" strokeOpacity="0.90"/>
          <rect x="77" y="5" width="6" height="3" rx="1"
                fill={color} fillOpacity="1.0" filter="url(#r26blur)"
                className="robot26-antenna"/>

          {/* ── Side vents ────────────────────────────────────────────────── */}
          {[72, 80, 88].map(y => (
            <g key={y}>
              <line x1="33" y1={y} x2="40" y2={y}
                    stroke={color} strokeWidth="1.2" strokeOpacity="0.55"/>
              <line x1="120" y1={y} x2="127" y2={y}
                    stroke={color} strokeWidth="1.2" strokeOpacity="0.55"/>
            </g>
          ))}

          {/* ── Forehead data strip ───────────────────────────────────────── */}
          <rect x="48" y="30" width="64" height="6" rx="2"
                fill="#060E1C" stroke={color} strokeWidth="0.8" strokeOpacity="0.55"/>
          {[51, 59, 67, 75, 83, 91, 99].map((x, i) => (
            <rect key={i} x={x} y="31.5" width="5" height="3" rx="1"
                  fill={color}
                  fillOpacity={[0.7, 0.3, 0.5, 0.8, 0.2, 0.6, 0.4][i]}/>
          ))}

          {/* ── VISOR ─────────────────────────────────────────────────────── */}
          <rect x="40" y="54" width="80" height="26" rx="5"
                fill="#010812" stroke={color} strokeWidth="1.2" strokeOpacity="0.75"/>
          <rect x="41" y="55" width="78" height="24" rx="4"
                fill="url(#r26visor)"/>
          <rect x="41" y="55" width="78" height="8" rx="4"
                fill="white" fillOpacity="0.025"/>

          {/* IDLE — scan line */}
          {!isSpeaking && !isListening && !isThinking && (
            <g filter="url(#r26blur)">
              <rect x="41" y="63" width="78" height="1.5" rx="0.5"
                    fill={color} fillOpacity="0.35"/>
              <rect className="robot26-scan-line" x="41" y="55" width="10" height="24" rx="2"
                    fill={color} fillOpacity="0.40"/>
            </g>
          )}

          {/* SPEAKING — oscilloscope wave */}
          {isSpeaking && (
            <g filter="url(#r26blur)" clipPath="url(#r26headClip)">
              <polyline className="robot26-wave-line"
                points="41,67 49,58 57,72 65,60 73,68 81,56 89,70 97,62 105,67 113,59 119,67"
                fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
              <polyline className="robot26-wave-line robot26-wave-2"
                points="41,67 49,72 57,61 65,70 73,58 81,68 89,56 97,67 105,62 113,70 119,66"
                fill="none" stroke="#7C3AED" strokeWidth="1" strokeLinecap="round"
                strokeOpacity="0.5"/>
            </g>
          )}

          {/* LISTENING — spectrum bars */}
          {isListening && (
            <g filter="url(#r26blur)">
              {[44, 51, 58, 65, 72, 79, 86, 93, 100, 107, 114].map((x, i) => (
                <rect key={i} x={x} y="55" width="4" height="24" rx="2"
                      fill={color} fillOpacity="0.12"/>
              ))}
              {[44, 51, 58, 65, 72, 79, 86, 93, 100, 107, 114].map((x, i) => (
                <rect key={i} x={x} className="robot26-listen-bar"
                      y="55" width="4" height="24" rx="2"
                      fill={color}
                      style={{ animationDelay: `${i * 0.08}s`,
                               transformOrigin: `${x + 2}px 79px` }}/>
              ))}
            </g>
          )}

          {/* THINKING — loading segments */}
          {isThinking && (
            <g filter="url(#r26blur)">
              <rect x="44" y="62" width="72" height="4" rx="2"
                    fill="#0D1F35"/>
              <rect className="robot26-think-load" x="44" y="62" width="20" height="4" rx="2"
                    fill={color}/>
              {[44, 56, 68, 80, 92, 104].map((x, i) => (
                <rect key={i} x={x} y="62" width="9" height="4" rx="1"
                      fill={color} fillOpacity="0.2"
                      className="robot26-think-seg"
                      style={{ animationDelay: `${i * 0.15}s` }}/>
              ))}
            </g>
          )}

          {/* ── Visor corner brackets ─────────────────────────────────────── */}
          {[[40, 54], [116, 54], [40, 77], [116, 77]].map(([x, y], i) => (
            <g key={i} stroke={color} strokeWidth="1" strokeOpacity="0.5" fill="none">
              <path d={
                i === 0 ? `M${x + 6},${y} H${x} V${y + 6}` :
                i === 1 ? `M${x - 6},${y} H${x} V${y + 6}` :
                i === 2 ? `M${x + 6},${y + 3} H${x} V${y - 3}` :
                          `M${x - 6},${y + 3} H${x} V${y - 3}`
              }/>
            </g>
          ))}

          {/* ── Cheek panels ─────────────────────────────────────────────── */}
          <rect x="34" y="86" width="18" height="22" rx="3"
                fill="#0A1628" stroke={color} strokeWidth="0.8" strokeOpacity="0.45"/>
          <rect x="108" y="86" width="18" height="22" rx="3"
                fill="#0A1628" stroke={color} strokeWidth="0.8" strokeOpacity="0.45"/>
          {[89, 95, 101].map(y => (
            <g key={y}>
              <line x1="37" y1={y} x2="49" y2={y}
                    stroke={color} strokeWidth="1" strokeOpacity="0.40"/>
              <line x1="111" y1={y} x2="123" y2={y}
                    stroke={color} strokeWidth="1" strokeOpacity="0.40"/>
            </g>
          ))}

          {/* ── Lower display (mouth area) ────────────────────────────────── */}
          <rect x="50" y="94" width="60" height="18" rx="3"
                fill="#03080F" stroke={color} strokeWidth="0.5" strokeOpacity="0.25"/>

          {/* Idle mouth — LED strip curve */}
          {!isSpeaking && !isThinking && !isListening && (
            <path d="M56,106 Q80,112 104,106"
                  stroke={color} strokeWidth="2" fill="none"
                  strokeLinecap="round" strokeOpacity="0.90"
                  filter="url(#r26blur)"/>
          )}

          {/* Speaking mouth — eq bars */}
          {isSpeaking && (
            <g filter="url(#r26blur)">
              {[54, 61, 68, 75, 82, 89, 96, 103].map((x, i) => (
                <rect key={i} x={x} y="95" width="4" height="16" rx="2"
                      fill={color}
                      className="robot26-eq-bar"
                      style={{ animationDelay: `${i * 0.06}s`,
                               transformOrigin: `${x + 2}px 111px` }}/>
              ))}
            </g>
          )}

          {/* Thinking mouth — dots */}
          {isThinking && (
            <g filter="url(#r26blur)">
              {[65, 80, 95].map((cx, i) => (
                <circle key={i} cx={cx} cy="103" r="4"
                        fill="#7C3AED"
                        className="robot26-think-dot"
                        style={{ animationDelay: `${i * 0.28}s` }}/>
              ))}
            </g>
          )}

          {/* Listening mouth — scan */}
          {isListening && (
            <rect className="robot26-mouth-scan" x="53" y="98" width="14" height="10" rx="2"
                  fill={color} fillOpacity="0.8" filter="url(#r26blur)"/>
          )}

          {/* ── Corner screws ─────────────────────────────────────────────── */}
          {[[40, 30], [120, 30], [40, 128], [120, 128]].map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r="3.5" fill="#071320"
                      stroke={color} strokeWidth="0.8" strokeOpacity="0.60"/>
              <line x1={cx - 1.5} y1={cy} x2={cx + 1.5} y2={cy}
                    stroke={color} strokeWidth="0.7" strokeOpacity="0.70"/>
              <line x1={cx} y1={cy - 1.5} x2={cx} y2={cy + 1.5}
                    stroke={color} strokeWidth="0.7" strokeOpacity="0.70"/>
            </g>
          ))}

          {/* ── Neck joint ────────────────────────────────────────────────── */}
          <rect x="64" y="130" width="32" height="10" rx="3"
                fill="#070F1F" stroke={color} strokeWidth="0.6" strokeOpacity="0.3"/>
          <rect x="70" y="132" width="20" height="2" rx="1"
                fill={color} fillOpacity="0.2"/>
          <rect x="68" y="135" width="24" height="2" rx="1"
                fill={color} fillOpacity="0.12"/>

          {/* ── Shoulder hints ────────────────────────────────────────────── */}
          <path d="M32,145 Q80,138 128,145" stroke="#0D1E35" strokeWidth="8"
                fill="none" strokeLinecap="round"/>
          <path d="M32,145 Q80,138 128,145" stroke={color} strokeWidth="0.6"
                fill="none" strokeLinecap="round" strokeOpacity="0.2"/>

        </svg>
      </div>
    </div>
  )
}
