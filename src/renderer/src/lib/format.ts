import { getLang, locale, t } from './i18n'

const nf = new Intl.NumberFormat(locale())
const cf = new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 })

export const fmt = (n: number | null | undefined): string => (n == null ? '—' : nf.format(n))
export const compact = (n: number | null | undefined): string => (n == null ? '—' : cf.format(n))

export function rating(up: number | null, down: number | null): number | null {
  if (up == null || down == null || up + down === 0) return null
  return Math.round((up / (up + down)) * 100)
}

export function timeAgo(ts: number | null | undefined): string {
  if (!ts) return t('nigdy')
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return t('przed chwilą')
  const m = Math.round(s / 60)
  if (m < 60) return t('{0} min temu', [m])
  const h = Math.round(m / 60)
  if (h < 24) return t('{0} godz. temu', [h])
  const d = Math.round(h / 24)
  if (d === 1) return t('wczoraj')
  if (d < 30) return t('{0} dni temu', [d])
  return new Date(ts).toLocaleDateString(locale())
}

export const date = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return t('Dobrej nocy')
  if (h < 12) return t('Dzień dobry')
  if (h < 18) return t('Cześć')
  return t('Dobry wieczór')
}

export const uid = (): string => Math.random().toString(36).slice(2) + Date.now().toString(36)

export const bytes = (n: number): string =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`

/** Genre z API Roblox -> polska nazwa */
const GENRES: Record<string, string> = {
  Action: 'Akcja', Adventure: 'Przygoda', Building: 'Budowanie', Comedy: 'Komedia', Fighting: 'Walka',
  FPS: 'FPS', Horror: 'Horror', Medieval: 'Średniowiecze', Military: 'Militarne', Naval: 'Morskie',
  RPG: 'RPG', 'Sci-Fi': 'Sci-Fi', Sports: 'Sport', 'Town and City': 'Miasto', Western: 'Western',
  Shooter: 'Strzelanki', Simulation: 'Symulacja', Strategy: 'Strategia', Survival: 'Survival',
  Obby: 'Obby', 'Obby & Platformer': 'Obby', Puzzle: 'Łamigłówki', 'Party & Casual': 'Imprezowe',
  'Roleplay & Avatar Sim': 'Roleplay', Social: 'Społecznościowe', Entertainment: 'Rozrywka',
  Education: 'Edukacja', Shopping: 'Zakupy', 'Utility & Other': 'Inne', Racing: 'Wyścigi'
}
export const genreName = (g: string): string => (getLang() === 'en' ? g.replace(' & Platformer', '') : GENRES[g] ?? g)

/** Polska odmiana: plural(5, 'gra', 'gry', 'gier') -> "5 gier" */
export function plural(n: number, one: string, few: string, many: string): string {
  if (getLang() === 'en') {
    const en: Record<string, [string, string]> = { gra: ['game', 'games'], uruchomienie: ['launch', 'launches'] }
    const [o, m] = en[one] ?? [one, many]
    return `${n} ${n === 1 ? o : m}`
  }
  const m10 = n % 10, m100 = n % 100
  const w = n === 1 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many
  return `${n} ${w}`
}
