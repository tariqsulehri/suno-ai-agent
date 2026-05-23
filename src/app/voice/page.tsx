import { isEmbedAuthEnabled } from '@/lib/security/embed-auth'
import { VoiceAgentWidget } from '@/components/voice-agent/widget'
import { NexusAgent }       from '@/components/voice-agent/nexus-agent'
import { ThemeProvider, type ThemeColors, type VoiceThemeName } from '@/components/voice-agent/theme-provider'
import { hexToChannels, darken, lighten } from '@/lib/utils/color'
import { AUTH_COOKIE, verifySessionToken } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'

interface VoicePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function isHex(v: unknown): v is string {
  return typeof v === 'string' && HEX_RE.test(v)
}

const THEMES: VoiceThemeName[] = ['nexus', 'daylight', 'emerald', 'ember']
function isThemeName(value: unknown): value is VoiceThemeName {
  return typeof value === 'string' && THEMES.includes(value as VoiceThemeName)
}

function buildThemeStyle(primary: string, dk: string, lt: string, md: string): string {
  return (
    `:root{` +
    `--va-primary:${hexToChannels(primary)};` +
    `--va-primary-dk:${hexToChannels(dk)};` +
    `--va-primary-lt:${hexToChannels(lt)};` +
    `--va-primary-md:${hexToChannels(md)};` +
    `--nx-accent:${primary};` +
    `--nx-accent-rgb:${hexToChannels(primary)}` +
    `}`
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function VoicePage({ searchParams }: VoicePageProps) {
  const params = (await searchParams) ?? {}
  const cookieStore = await cookies()
  const session = await verifySessionToken(cookieStore.get(AUTH_COOKIE)?.value)
  if (session?.role !== 'agent' || !session.shopId) redirect('/agent-login?from=%2Fvoice')

  const shop = await db.shop.findUnique({ where: { id: session.shopId } })
  if (!shop) redirect('/agent-login?from=%2Fvoice')

  const tenantId = session.tenantId ?? 'outlet-reviews'
  const token = undefined
  const shopCode = shop.branchCode ?? shop.tenantId
  const modeParam = typeof params.mode === 'string' ? params.mode : undefined
  const launcherParam = typeof params.launcher === 'string' ? params.launcher : undefined
  const marginParam = typeof params.margin === 'string' ? params.margin : undefined
  const theme = isThemeName(params.theme) ? params.theme : 'nexus'
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
  const mainStyle = primary
    ? ({ '--nx-accent': primary, '--nx-accent-rgb': hexToChannels(primary) } as CSSProperties)
    : undefined

  // ─────────────────────────────────────────────────────────────────────────

  if (isEmbedAuthEnabled() && !session) {
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
      <ThemeProvider initial={initialTheme} theme={theme} />

      <main className="min-h-dvh bg-surface" data-va-theme={theme} style={mainStyle}>
        {mode === 'fullscreen' ? (
          <NexusAgent tenantId={tenantId} token={token} shopCode={shopCode} />
        ) : (
          <VoiceAgentWidget tenantId={tenantId} token={token}
                            shopCode={shopCode}
                            mode={mode as 'floating' | 'inline'} margin={margin} />
        )}
      </main>
    </>
  )
}
