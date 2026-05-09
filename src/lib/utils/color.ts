/** Convert '#RRGGBB' → '255 255 255' (CSS custom-property channel format). */
export function hexToChannels(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r} ${g} ${b}`
}

/** Darken a #RRGGBB colour by mixing toward black (factor 0–1). */
export function darken(hex: string, f = 0.12): string {
  const ch = (s: string) =>
    Math.round(Math.max(0, parseInt(s, 16) * (1 - f))).toString(16).padStart(2, '0')
  return `#${ch(hex.slice(1, 3))}${ch(hex.slice(3, 5))}${ch(hex.slice(5, 7))}`
}

/** Lighten a #RRGGBB colour by mixing toward white (factor 0=same, 1=white). */
export function lighten(hex: string, f = 0.92): string {
  const ch = (s: string) =>
    Math.round(parseInt(s, 16) + (255 - parseInt(s, 16)) * f).toString(16).padStart(2, '0')
  return `#${ch(hex.slice(1, 3))}${ch(hex.slice(3, 5))}${ch(hex.slice(5, 7))}`
}
