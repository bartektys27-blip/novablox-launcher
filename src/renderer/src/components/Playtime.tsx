import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Gamepad2, Timer, TrendingUp, CalendarDays } from 'lucide-react'
import type { PlaySession } from '@shared/types'
import { useApp } from '@/store/app'
import { dur, lastDays, perGame, total } from '@/lib/playtime'
import { t } from '@/lib/i18n'
import { Img, SectionHeader, Stat } from './ui'

export function NowPlaying(): JSX.Element | null {
  const st = useApp(s => s.playStatus)
  const openGame = useApp(s => s.openGame)
  if (!st.running) return null
  const g = st.game
  return (
    <motion.button initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      onClick={() => g?.universeId && openGame(g.universeId)}
      className="card flex w-full items-center gap-4 border-success/30 bg-success/5 p-4 text-left">
      <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-success" /></span>
      {g?.iconUrl ? <Img src={g.iconUrl} className="h-10 w-10 rounded-xl" /> : <Gamepad2 size={22} className="text-success" />}
      <div className="flex-1">
        <div className="text-sm font-semibold">{t('Teraz grasz')}{g?.name ? `: ${g.name}` : ''}</div>
        <div className="text-xs text-muted">{t('Sesja trwa od {0}', [new Date(st.since ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })])}</div>
      </div>
      <Timer size={18} className="text-success" />
    </motion.button>
  )
}

export function PlaytimeOverview({ sessions, compact = false }: { sessions: PlaySession[]; compact?: boolean }): JSX.Element {
  const openGame = useApp(s => s.openGame)
  const days = useMemo(() => lastDays(sessions, 7), [sessions])
  const games = useMemo(() => perGame(sessions), [sessions])
  const max = Math.max(1, ...days.map(d => d.ms))
  const week = days.reduce((a, d) => a + d.ms, 0)

  return (
    <section>
      <SectionHeader icon={Timer} title={t('Czas gry')} subtitle={t('Liczony automatycznie, gdy Roblox jest uruchomiony')} />
      {!compact && (
        <div className="mb-4 grid grid-cols-3 gap-4">
          <Stat icon={Timer} label={t('Łącznie')} value={dur(total(sessions))} />
          <Stat icon={CalendarDays} label={t('Ostatnie 7 dni')} value={dur(week)} />
          <Stat icon={TrendingUp} label={t('Sesji')} value={sessions.length} />
        </div>
      )}
      <div className="grid grid-cols-[1fr_360px] gap-4">
        <div className="card p-5">
          <div className="label mb-4">{t('Ostatnie 7 dni')}</div>
          <div className="flex h-44 items-end gap-3">
            {days.map((d, i) => (
              <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="text-[11px] text-muted opacity-0 transition group-hover:opacity-100">{d.ms ? dur(d.ms) : ''}</div>
                <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(d.ms ? 6 : 2, (d.ms / max) * 100)}%` }} transition={{ delay: i * .04, type: 'spring', stiffness: 160, damping: 20 }}
                  className={d.ms ? 'w-full rounded-lg bg-accent-grad shadow-glow' : 'w-full rounded-lg bg-fg/10'} />
                <div className="text-xs capitalize text-muted">{d.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <div className="label mb-3">{t('Najdłużej grane')}</div>
          {games.length === 0 ? <p className="text-sm text-muted">{t('Uruchom grę przez NovaBlox – czas pojawi się tu po zakończeniu sesji.')}</p> : (
            <div className="space-y-2.5">
              {games.slice(0, 5).map(g => (
                <button key={g.key} disabled={!g.universeId} onClick={() => g.universeId && openGame(g.universeId)} className="flex w-full items-center gap-3 rounded-xl p-1 text-left transition enabled:hover:bg-fg/5">
                  {g.iconUrl ? <Img src={g.iconUrl} className="h-9 w-9 shrink-0 rounded-lg" /> : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-fg/10"><Gamepad2 size={16} /></div>}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{g.name}</div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-fg/10"><div className="h-full rounded-full bg-accent-grad" style={{ width: `${(g.ms / games[0].ms) * 100}%` }} /></div>
                  </div>
                  <div className="shrink-0 text-right text-sm font-semibold">{dur(g.ms)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
