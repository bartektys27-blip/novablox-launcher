import { locale, t } from '@/lib/i18n'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, Compass, Play, Search, Trash2, Loader2, CalendarDays } from 'lucide-react'
import type { HistoryEntry } from '@shared/types'
import { useApp } from '@/store/app'
import { confirmAction } from '@/store/ui'
import { EmptyState, Img, PageHeader, Stat } from '@/components/ui'
import { PlaytimeOverview } from '@/components/Playtime'

function dayLabel(ts: number): string {
  const d = new Date(ts); d.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return t("Dzisiaj")
  if (diff === 1) return t("Wczoraj")
  return d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function History(): JSX.Element {
  const history = useApp(s => s.history)
  const sessions = useApp(s => s.playtime)
  const library = useApp(s => s.library)
  const clear = useApp(s => s.clearHistory)
  const openGame = useApp(s => s.openGame)
  const launch = useApp(s => s.launch)
  const launching = useApp(s => s.launching)
  const navigate = useApp(s => s.navigate)
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const list = history.filter(h => !q || h.name.toLowerCase().includes(q.toLowerCase()))
    const map = new Map<string, HistoryEntry[]>()
    for (const h of list) {
      const k = dayLabel(h.launchedAt)
      map.set(k, [...(map.get(k) ?? []), h])
    }
    return [...map.entries()]
  }, [history, q])

  const top = useMemo(() => {
    const c = new Map<number, { e: HistoryEntry; n: number }>()
    for (const h of history) c.set(h.universeId, { e: c.get(h.universeId)?.e ?? h, n: (c.get(h.universeId)?.n ?? 0) + 1 })
    return [...c.values()].sort((a, b) => b.n - a.n)[0]
  }, [history])

  const replay = (h: HistoryEntry): void => {
    const lib = library.find(l => l.universeId === h.universeId)
    void launch(lib ?? { universeId: h.universeId, placeId: h.placeId, name: h.name, iconUrl: h.iconUrl, thumbnailUrl: null, playing: null, creatorName: '', genre: '' })
  }

  return (
    <div>
      <PageHeader title={t("History")} subtitle={t("Wszystkie gry uruchomione z NovaBlox")}>
        <button className="btn-secondary" disabled={!history.length}
          onClick={async () => { if (await confirmAction({ title: t("Wyczyścić historię?"), body: t("Usuniesz całą historię uruchomień. Biblioteka i ulubione pozostaną bez zmian."), confirmLabel: t("Wyczyść"), danger: true })) clear() }}>
          <Trash2 size={15} /> {t("Wyczyść historię")}
        </button>
      </PageHeader>

      <div className="mb-10"><PlaytimeOverview sessions={sessions} /></div>

      {history.length === 0 ? (
        <EmptyState icon={Clock} title={t("Brak historii")} text={t("Gdy uruchomisz grę przyciskiem PLAY, pojawi się tutaj razem z datą i godziną.")}
          action={<button className="btn-primary" onClick={() => navigate('discover')}><Compass size={16} /> {t("Znajdź grę")}</button>} />
      ) : (
        <>
          <div className="mb-8 grid grid-cols-3 gap-4">
            <Stat icon={Play} label={t("Uruchomień")} value={history.length} />
            <Stat icon={CalendarDays} label={t("Dni z grą")} value={new Set(history.map(h => new Date(h.launchedAt).toDateString())).size} />
            <Stat icon={Clock} label={t("Najczęściej")} value={<span className="block truncate text-lg">{top ? `${top.e.name} (${top.n}×)` : '—'}</span>} />
          </div>

          <div className="relative mb-6 w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input h-10 pl-10" placeholder={t("Szukaj w historii…")} value={q} onChange={e => setQ(e.target.value)} />
          </div>

          <div className="space-y-8">
            {groups.map(([day, items]) => (
              <section key={day}>
                <div className="label mb-3 capitalize">{day}</div>
                <div className="relative space-y-2 pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-fg/10">
                  {items.map((h, i) => (
                    <motion.div key={h.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * .02 }}
                      className="card card-hover group relative flex items-center gap-4 p-3 pr-4">
                      <span className="absolute -left-[22px] h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-bg" />
                      <button onClick={() => openGame(h.universeId)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                        <Img src={h.iconUrl} className="h-12 w-12 shrink-0 rounded-xl" />
                        <div className="min-w-0">
                          <div className="truncate font-semibold group-hover:text-accent">{h.name}</div>
                          <div className="text-xs text-muted">{new Date(h.launchedAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </button>
                      <button className="btn-secondary h-9" disabled={launching === h.universeId} onClick={() => replay(h)}>
                        {launching === h.universeId ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />} {t("Zagraj ponownie")}
                      </button>
                    </motion.div>
                  ))}
                </div>
              </section>
            ))}
            {groups.length === 0 && <div className="text-muted">{t("Brak wyników dla „")}{q}”.</div>}
          </div>
        </>
      )}
    </div>
  )
}
