import type { NextConfig } from 'next'

// Known production + local-dev origins that are allowed to embed the /voice page.
// Override at deploy time with ALLOWED_FRAME_ANCESTORS (comma-separated list).
const DEFAULT_FRAME_ANCESTORS = [
  "'self'",
  'https://ai-script-web-site.vercel.app',
  'https://www.aiscripto.com',
  'https://aiscripto.com',
  // POS — Point of Solutions
  'https://pos.net.pk',
  'https://www.pos.net.pk',
  'https://tariqsulehri.github.io',
  // Local dev
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:3000',
].join(' ')

function buildFrameAncestors(): string {
  const raw = process.env.ALLOWED_FRAME_ANCESTORS?.trim()
  if (!raw) return DEFAULT_FRAME_ANCESTORS
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .join(' ')
}

const frameAncestors = buildFrameAncestors()

const nextConfig: NextConfig = {
  // Native Node addons must not be bundled by webpack
  serverExternalPackages: [
    'better-sqlite3',
    'sqlite-vec',
    '@prisma/adapter-better-sqlite3',
  ],

  async headers() {
    return [
      {
        // Apply to all API routes
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          // Prevent Cloudflare / nginx from buffering SSE streams
          { key: 'X-Accel-Buffering', value: 'no' },
          { key: 'Cache-Control', value: 'no-cache, no-transform' },

        ],
      },
      {
        // Allow embedding the voice page in approved parent sites.
        source: '/voice',
        headers: [
          { key: 'Content-Security-Policy', value: `frame-ancestors ${frameAncestors};` },
          { key: 'Permissions-Policy', value: 'microphone=(self)' },
        ],
      },
    ]
  },
}

export default nextConfig
