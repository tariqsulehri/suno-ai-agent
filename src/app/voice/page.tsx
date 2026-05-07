import { isEmbedAuthEnabled, validateEmbedQuery } from '@/lib/security/embed-auth'
import { VoiceAgentWidget } from '@/components/voice-agent/widget'
import { NexusAgent }       from '@/components/voice-agent/nexus-agent'
import { ThemeProvider, type ThemeColors } from '@/components/voice-agent/theme-provider'

interface VoicePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

// ── Theme helpers (server-side, no browser APIs) ──────────────────────────────

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function isHex(v: unknown): v is string {
  return typeof v === 'string' && HEX_RE.test(v)
}

function hexToChannels(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r} ${g} ${b}`
}

function darken(hex: string, f = 0.12): string {
  const ch = (s: string) => Math.round(Math.max(0, parseInt(s, 16) * (1 - f))).toString(16).padStart(2, '0')
  return `#${ch(hex.slice(1, 3))}${ch(hex.slice(3, 5))}${ch(hex.slice(5, 7))}`
}

function lighten(hex: string, f = 0.92): string {
  const ch = (s: string) => Math.round(parseInt(s, 16) + (255 - parseInt(s, 16)) * f).toString(16).padStart(2, '0')
  return `#${ch(hex.slice(1, 3))}${ch(hex.slice(3, 5))}${ch(hex.slice(5, 7))}`
}

function buildThemeStyle(primary: string, dk: string, lt: string, md: string): string {
  return (
    `:root{` +
    `--va-primary:${hexToChannels(primary)};` +
    `--va-primary-dk:${hexToChannels(dk)};` +
    `--va-primary-lt:${hexToChannels(lt)};` +
    `--va-primary-md:${hexToChannels(md)}` +
    `}`
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function VoicePage({ searchParams }: VoicePageProps) {
  const params = (await searchParams) ?? {}
  const tenantId = typeof params.tenant === 'string' ? params.tenant : undefined
  const token    = typeof params.token  === 'string' ? params.token  : undefined
  const shopCode = typeof params.shop   === 'string' ? params.shop   : undefined
  const modeParam = typeof params.mode === 'string' ? params.mode : undefined
  const launcherParam = typeof params.launcher === 'string' ? params.launcher : undefined
  const marginParam = typeof params.margin === 'string' ? params.margin : undefined
  const mode = modeParam === 'fullscreen' ? 'fullscreen'
             : modeParam === 'floating' || launcherParam === 'true' ? 'floating'
             : modeParam === 'inline' ? 'inline'
             : 'fullscreen' // default
  const margin = marginParam === 'none' || marginParam === 'sm' || marginParam === 'md' ? marginParam : undefined

  // ── Theme params (validated hex strings only) ──────────────────────────────
  const rawPrimary = typeof params.primaryColor === 'string' ? params.primaryColor : undefined
  const primary = isHex(rawPrimary) ? rawPrimary : null
  const primaryDk = isHex(params.primaryDkColor) ? params.primaryDkColor : primary ? darken(primary) : null
  const primaryLt = isHex(params.primaryLtColor) ? params.primaryLtColor : primary ? lighten(primary, 0.92) : null
  const primaryMd = isHex(params.primaryMdColor) ? params.primaryMdColor : primary ? lighten(primary, 0.80) : null

  const themeStyle: string | null =
    primary ? buildThemeStyle(primary, primaryDk!, primaryLt!, primaryMd!) : null

  const initialTheme: ThemeColors | undefined = primary
    ? { primary, primaryDk: primaryDk ?? undefined, primaryLt: primaryLt ?? undefined, primaryMd: primaryMd ?? undefined }
    : undefined

  // ─────────────────────────────────────────────────────────────────────────

  const auth = validateEmbedQuery(tenantId, token)

  if (isEmbedAuthEnabled() && !auth.ok) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-surface p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-card p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-ms-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-base font-semibold text-ms-text mb-1">Access Denied</h1>
          <p className="text-sm text-ms-sub">
            This link is invalid or has expired. Please contact support for a valid access link.
          </p>
        </div>
      </main>
    )
  }

  return (
    <>
      {/* Zero-FOUC theme injection — applied before JS hydrates */}
      {themeStyle && <style dangerouslySetInnerHTML={{ __html: themeStyle }} />}

      {/* Listens for voice-agent:theme postMessage from the parent page */}
      <ThemeProvider initial={initialTheme} />

      <main className="min-h-dvh bg-surface">
        {mode === 'fullscreen' ? (
          <NexusAgent tenantId={tenantId} token={token} shopCode={shopCode} />
        ) : (
          <VoiceAgentWidget tenantId={tenantId} token={token}
                            mode={mode as 'floating' | 'inline'} margin={margin} />
        )}
      </main>
    </>
  )
}
