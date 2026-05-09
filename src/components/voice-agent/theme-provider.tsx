'use client'

import { useEffect } from 'react'
import { hexToChannels, darken, lighten } from '@/lib/utils/color'

export interface ThemeColors {
  primary?:   string  // hex, e.g. '#007bff'
  primaryDk?: string
  primaryLt?: string
  primaryMd?: string
}

export type VoiceThemeName = 'nexus' | 'daylight' | 'emerald' | 'ember'

function applyTheme(colors: ThemeColors) {
  const root = document.documentElement
  const set = (varName: string, hex: string) => {
    const ch = hexToChannels(hex)
    root.style.setProperty(varName, ch)
  }

  if (colors.primary) {
    set('--va-primary',    colors.primary)
    set('--va-primary-dk', colors.primaryDk ?? darken(colors.primary, 0.12))
    set('--va-primary-lt', colors.primaryLt ?? lighten(colors.primary, 0.92))
    set('--va-primary-md', colors.primaryMd ?? lighten(colors.primary, 0.80))
    root.style.setProperty('--nx-accent', colors.primary)
    root.style.setProperty('--nx-accent-rgb', hexToChannels(colors.primary))
  } else {
    if (colors.primaryDk) set('--va-primary-dk', colors.primaryDk)
    if (colors.primaryLt) set('--va-primary-lt', colors.primaryLt)
    if (colors.primaryMd) set('--va-primary-md', colors.primaryMd)
  }
}

function applyThemeName(theme?: string) {
  if (!theme) return
  if (!['nexus', 'daylight', 'emerald', 'ember'].includes(theme)) return
  document.documentElement.dataset.vaTheme = theme
}

// Derive the parent page origin from document.referrer so postMessage can be
// targeted rather than broadcast to '*'.
function resolveParentOrigin(): string {
  const ref = document.referrer
  if (!ref) return '*'
  try { return new URL(ref).origin } catch { return '*' }
}

export function ThemeProvider({ initial, theme }: { initial?: ThemeColors; theme?: VoiceThemeName }) {
  useEffect(() => {
    applyThemeName(theme)

    // Apply server-derived theme (no-op if server already injected <style>)
    if (initial) applyTheme(initial)

    const parentOrigin = resolveParentOrigin()

    // Tell parent we're ready — it can reply with voice-agent:theme
    window.parent?.postMessage({ type: 'voice-agent:ready' }, parentOrigin)

    function onMessage(e: MessageEvent) {
      // Reject messages from unexpected origins when we know the parent origin.
      if (parentOrigin !== '*' && e.origin !== parentOrigin) return

      if (e.data?.type === 'voice-agent:set-theme') {
        applyThemeName(e.data.theme)
      }
      if (e.data?.type === 'voice-agent:theme' && e.data.colors) {
        applyThemeName(e.data.theme)
        applyTheme(e.data.colors as ThemeColors)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Intentionally runs once on mount: theme is injected server-side via <style>
  // before hydration; re-running on prop change would cause a second flash.

  return null
}
