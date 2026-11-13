import type { PlaySession } from '@shared/types'
import { getLang, locale, t } from './i18n'

export const dur = (ms: number): string => {
  const m = Math.round(ms / 60_000)
  if (m < 1) return getLang() === 'en' ? t("< 1 min") : t("< 1 min")
  if (m < 60) return t("{0} min", [m])
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? t("{0} h {1} min", [h, r]) : t("{0} h", [h])
}

export const total = (s: PlaySession[]): number => s.reduce((a, x) => a + (x.end - x.start), 0)

export function perGame(sessions: PlaySession[]): { key: string; universeId: number; name: string; iconUrl: string | null; ms: number; count: number }[] {
  const m = new Map<string, { key: string; universeId: number; name: string; iconUrl: string | null; ms: number; count: number }>()
  for (const s of sessions) {
    const key = String(s.universeId || 0)
    const e = m.get(key) ?? { key, universeId: s.universeId, name: s.name || t('Roblox (gra spoza launchera)'), iconUrl: s.iconUrl, ms: 0, count: 0 }
    e.ms += s.end - s.start
    e.count++
    if (s.name) e.name = s.name
    if (s.iconUrl) e.iconUrl = s.iconUrl
    m.set(key, e)
  }
  return [...m.values()].sort((a, b) => b.ms - a.ms)
}

/** Czas gry w kolejnych dniach (ostatnie n dni, od najstarszego) */
export function lastDays(sessions: PlaySession[], n = 7): { label: string; ms: number; date: Date }[] {
  const days: { label: string; ms: number; date: Date }[] = []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    days.push({ label: d.toLocaleDateString(locale(), { weekday: 'short' }), ms: 0, date: d })
  }
  for (const s of sessions) {
    // Rozbij sesję na dni (np. granie przez północ)
    let a = s.start
    while (a < s.end) {
      const dayStart = new Date(a); dayStart.setHours(0, 0, 0, 0)
      const next = dayStart.getTime() + 86_400_000
      const b = Math.min(s.end, next)
      const slot = days.find(d => d.date.getTime() === dayStart.getTime())
      if (slot) slot.ms += b - a
      a = b
    }
  }
  return days
}
