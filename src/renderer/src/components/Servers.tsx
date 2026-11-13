import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Gauge, Loader2, LogIn, RefreshCw, Server, Signal, Users, Zap, ArrowDownUp } from 'lucide-react'
import clsx from 'clsx'
import type { ServerInfo } from '@shared/types'
import { useApp } from '@/store/app'
import { toast } from '@/store/ui'
import { t } from '@/lib/i18n'
import { ErrorState } from './ui'

export function ServerList({ placeId, universeId, name, iconUrl }: { placeId: number; universeId: number; name: string; iconUrl: string | null }): JSX.Element {
  const [servers, setServers] = useState<ServerInfo[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [order, setOrder] = useState<'Desc' | 'Asc'>('Desc')
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState<string | null>(null)

  const load = useCallback(async (reset: boolean, c: string | null = null) => {
    reset ? setLoading(true) : setMore(true)
    setError(null)
    try {
      const page = await window.nova.roblox.servers(placeId, reset ? null : c, order)
      setServers(s => (reset ? page.servers : [...s, ...page.servers.filter(n => !s.some(o => o.id === n.id))]))
      setCursor(page.nextCursor)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false); setMore(false) }
  }, [placeId, order])

  useEffect(() => { void load(true) }, [load])

  const join = async (s: ServerInfo): Promise<void> => {
    setJoining(s.id)
    try {
      await window.nova.roblox.joinServer(placeId, s.id)
      // zapis w historii tak samo jak zwykłe PLAY (bez ponownego uruchamiania)
      useApp.getState().logActivity('launch', t('Dołączono do serwera „{0}”', [name]), { universeId, placeId, name, iconUrl, thumbnailUrl: null, playing: null, creatorName: '', genre: '' })
      useApp.setState(st => ({
        history: [{ id: Math.random().toString(36).slice(2), universeId, placeId, name, iconUrl, launchedAt: Date.now() }, ...st.history].slice(0, 500),
        library: st.library.map(x => (x.universeId === universeId ? { ...x, lastPlayed: Date.now(), playCount: x.playCount + 1 } : x))
      }))
      void window.nova.store.patch({ history: useApp.getState().history, library: useApp.getState().library })
      toast.success(t('Dołączanie do serwera…'), t('{0} otworzy się w aplikacji Roblox', [name]))
    } catch (e) { toast.error(t('Nie udało się dołączyć'), (e as Error).message) }
    finally { setTimeout(() => setJoining(null), 1500) }
  }

  const open = servers.filter(s => s.playing < s.maxPlayers)
  const leastFull = [...open].sort((a, b) => a.playing - b.playing)[0]
  const bestPing = [...open].filter(s => s.ping != null).sort((a, b) => (a.ping ?? 9e9) - (b.ping ?? 9e9))[0]

  return (
    <div className="card p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5"><Server size={18} className="text-accent" /><h2 className="h-display text-xl">{t('Serwery publiczne')}</h2>
          {!loading && <span className="rounded-md bg-fg/10 px-1.5 py-0.5 text-xs text-muted">{servers.length}{cursor ? '+' : ''}</span>}</div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary h-9" disabled={!leastFull || !!joining} onClick={() => leastFull && join(leastFull)}><Users size={15} />{t('Najmniej graczy')}</button>
          <button className="btn-secondary h-9" disabled={!bestPing || !!joining} onClick={() => bestPing && join(bestPing)}><Zap size={15} />{t('Najlepszy ping')}</button>
          <button className="btn-ghost h-9" onClick={() => setOrder(o => (o === 'Desc' ? 'Asc' : 'Desc'))} title={t('Zmień kolejność')}><ArrowDownUp size={15} />{order === 'Desc' ? t('Najpełniejsze') : t('Najpustsze')}</button>
          <button className="btn-ghost h-9" onClick={() => load(true)}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={() => load(true)} />
        : loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
        : servers.length === 0 ? <p className="py-6 text-center text-muted">{t('Brak publicznych serwerów – w tej chwili nikt nie gra.')}</p>
        : (
          <>
            <div className="space-y-2">
              {servers.map((s, i) => {
                const pct = Math.min(100, Math.round((s.playing / Math.max(1, s.maxPlayers)) * 100))
                const full = s.playing >= s.maxPlayers
                return (
                  <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * .02 }}
                    className="flex items-center gap-4 rounded-xl bg-fg/[.04] px-4 py-2.5 transition hover:bg-fg/[.07]">
                    <div className="w-40 shrink-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold"><Users size={14} className="text-muted" />{s.playing} / {s.maxPlayers}</div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fg/10"><div className={clsx('h-full rounded-full', full ? 'bg-danger' : pct > 80 ? 'bg-warn' : 'bg-accent-grad')} style={{ width: `${pct}%` }} /></div>
                    </div>
                    <div className="flex w-28 items-center gap-1.5 text-sm"><Signal size={14} className={clsx(s.ping == null ? 'text-muted' : s.ping < 80 ? 'text-success' : s.ping < 150 ? 'text-warn' : 'text-danger')} />{s.ping != null ? t("{0} ms", [s.ping]) : '—'}</div>
                    <div className="flex w-24 items-center gap-1.5 text-sm text-muted"><Gauge size={14} />{s.fps != null ? t("{0} FPS", [Math.round(s.fps)]) : '—'}</div>
                    <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted/70" title={s.id}>{s.id}</div>
                    <button className="btn-primary h-9 px-4" disabled={full || joining === s.id} onClick={() => join(s)}>
                      {joining === s.id ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}{full ? t('Pełny') : t('Dołącz')}
                    </button>
                  </motion.div>
                )
              })}
            </div>
            {cursor && <button className="btn-secondary mt-4 w-full" disabled={more} onClick={() => load(false, cursor)}>{more ? <Loader2 size={15} className="animate-spin" /> : null}{t('Wczytaj więcej serwerów')}</button>}
            <p className="mt-3 text-xs text-muted">{t('Ping i FPS podaje Roblox dla każdego serwera. Jeśli serwer zdąży się zamknąć, Roblox połączy Cię z innym.')}</p>
          </>
        )}
    </div>
  )
}
