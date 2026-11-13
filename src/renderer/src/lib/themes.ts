import type { Settings, ThemeId } from '@shared/types'

export interface ThemeDef {
  id: ThemeId
  name: string
  desc: string
  bg: string; surface: string; elevated: string; fg: string; muted: string
  accent: string; accent2: string
}

// Wartości jako "r g b" (dla rgb(var(--x) / alpha) w Tailwind)
export const THEMES: ThemeDef[] = [
  { id: 'nova', name: 'Nova', desc: 'Fiolet i błękit na grafitowym tle', bg: '8 8 13', surface: '17 17 26', elevated: '27 27 40', fg: '238 240 255', muted: '148 152 184', accent: '139 92 246', accent2: '59 130 246' },
  { id: 'midnight', name: 'Midnight', desc: 'Głęboki granat i lodowy błękit', bg: '5 7 15', surface: '13 17 31', elevated: '22 28 48', fg: '232 240 255', muted: '135 150 185', accent: '99 102 241', accent2: '14 165 233' },
  { id: 'aurora', name: 'Aurora', desc: 'Neonowy fiolet przechodzący w róż', bg: '10 6 16', surface: '22 14 32', elevated: '34 22 48', fg: '248 238 255', muted: '170 145 190', accent: '168 85 247', accent2: '236 72 153' },
  { id: 'crimson', name: 'Crimson', desc: 'Agresywna czerwień i bursztyn', bg: '12 7 9', surface: '26 15 18', elevated: '40 22 27', fg: '255 238 240', muted: '185 145 152', accent: '244 63 94', accent2: '251 146 60' },
  { id: 'emerald', name: 'Emerald', desc: 'Szmaragd i cyjan', bg: '5 11 10', surface: '12 24 22', elevated: '19 37 34', fg: '232 255 248', muted: '130 175 165', accent: '16 185 129', accent2: '34 211 238' },
  { id: 'mono', name: 'Graphite', desc: 'Minimalistyczna czerń i biel', bg: '9 9 11', surface: '20 20 23', elevated: '31 31 36', fg: '244 244 246', muted: '150 150 160', accent: '228 228 231', accent2: '113 113 122' }
]

export const ACCENT_PRESETS: [string, string][] = [
  ['#8b5cf6', '#3b82f6'], ['#6366f1', '#06b6d4'], ['#a855f7', '#ec4899'], ['#f43f5e', '#f59e0b'],
  ['#10b981', '#22d3ee'], ['#3b82f6', '#22d3ee'], ['#f97316', '#facc15'], ['#e4e4e7', '#71717a']
]

export const hexToRgb = (hex: string): string => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
export const rgbToHex = (rgb: string): string =>
  '#' + rgb.split(' ').map(n => Number(n).toString(16).padStart(2, '0')).join('')

export function applyTheme(s: Settings): void {
  const t = THEMES.find(x => x.id === s.theme) ?? THEMES[0]
  const r = document.documentElement
  const set = (k: string, v: string): void => r.style.setProperty(k, v)
  set('--bg', t.bg); set('--surface', t.surface); set('--elevated', t.elevated)
  set('--fg', t.fg); set('--muted', t.muted)
  set('--accent', s.accent ? hexToRgb(s.accent) : t.accent)
  set('--accent2', s.accent2 ? hexToRgb(s.accent2) : t.accent2)
  set('--bg-blur', `${s.backgroundBlur}px`)
  set('--bg-dim', String(s.backgroundDim / 100))
  set('--card-min', s.cardSize === 'compact' ? '180px' : s.cardSize === 'large' ? '280px' : '220px')
  r.dataset.card = s.cardStyle
  r.dataset.anim = s.animations
  r.dataset.glow = s.effects.glow ? 'on' : 'off'
  r.dataset.gradients = s.effects.gradients ? 'on' : 'off'
  r.dataset.noise = s.effects.noise ? 'on' : 'off'
}
