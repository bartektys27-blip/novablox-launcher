import { locale, t } from '@/lib/i18n'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, CalendarPlus, ChevronLeft, ChevronRight, Clock, ExternalLink, Eye, Heart, RefreshCw, ThumbsUp, Users, UserRound, Tag, Star, Play, History as HistoryIcon
} from 'lucide-react'
import { useApp } from '@/store/app'
import { useAsync } from '@/lib/useAsync'
import { compact, date, fmt, genreName, rating, timeAgo } from '@/lib/format'
import { ErrorState, Img, Stat } from '@/components/ui'
import { FavoriteButton, LibraryButton, PlayAsButton, PlayButton } from '@/components/GameCard'
import { ServerList } from '@/components/Servers'
import { dur, total } from '@/lib/playtime'

export default function GameDetails({ universeId }: { universeId: number }): JSX.Element {
  const back = useApp(s => s.back)
  const lib = useApp(s => s.library.find(g => g.universeId === universeId))
  const history = useApp(s => s.history)
  const allSessions = useApp(s => s.playtime)
  const sessions = useMemo(() => allSessions.filter(x => x.universeId === universeId), [allSessions, universeId])
  const plays = useMemo(() => history.filter(h => h.universeId === universeId), [history, universeId])
  const { data: g, error, loading, reload } = useAsync(() => window.nova.roblox.details(universeId), [universeId])
  const [shot, setShot] = useState(0)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => { setShot(0); setExpanded(false) }, [universeId])
  useEffect(() => {
    if (!g || g.thumbnails.length < 2) return
    const t = setInterval(() => setShot(s => (s + 1) % g.thumbnails.length), 6000)
    return () => clearInterval(t)
  }, [g])

  // Gdy brak sieci – pokaż dane z biblioteki
  const fallback = !g && lib ? lib : null

  if (error && !fallback) {
    return (
      <div>
        <button className="btn-ghost mb-6" onClick={back}><ArrowLeft size={16} /> {t("Wróć")}</button>
        <ErrorState message={error} onRetry={reload} />
      </div>
    )
  }

  if (loading && !g && !fallback) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-[420px] rounded-[28px]" />
        <div className="grid grid-cols-4 gap-4">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl2" />)}</div>
      </div>
    )
  }

  const game = g ?? {
    ...fallback!, visits: null, maxPlayers: null, favorites: null, upVotes: null, downVotes: null, created: null, updated: null,
    creatorType: '', creatorId: 0, thumbnails: fallback!.thumbnailUrl ? [fallback!.thumbnailUrl] : []
  }
  const shots = game.thumbnails.length ? game.thumbnails : [game.thumbnailUrl].filter(Boolean) as string[]
  const r = rating(game.upVotes, game.downVotes)
  const lastPlay = plays[0]?.launchedAt ?? null

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <button className="btn-ghost -ml-3" onClick={back}><ArrowLeft size={16} /> {t("Wróć")}</button>
        <div className="flex gap-2">
          {error && <span className="self-center text-xs text-warn">{t("Tryb offline – dane z biblioteki")}</span>}
          <button className="btn-ghost" onClick={reload}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> {t("Odśwież")}</button>
        </div>
      </div>

      {/* Baner z galerią */}
      <section className="relative h-[440px] overflow-hidden rounded-[28px] border border-fg/5">
        <AnimatePresence mode="popLayout">
          <motion.div key={shots[shot] ?? 'none'} initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: .7 }} className="absolute inset-0">
            <Img src={shots[shot]} className="h-full w-full" />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/70 to-transparent" />

        {shots.length > 1 && (
          <>
            <button onClick={() => setShot(s => (s - 1 + shots.length) % shots.length)} className="panel absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full hover:text-accent"><ChevronLeft /></button>
            <button onClick={() => setShot(s => (s + 1) % shots.length)} className="panel absolute right-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full hover:text-accent"><ChevronRight /></button>
            <div className="absolute right-8 top-6 flex gap-1.5">
              {shots.map((_, i) => <button key={i} onClick={() => setShot(i)} className={`h-1.5 rounded-full transition-all ${i === shot ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`} />)}
            </div>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-end gap-6 p-8">
          <Img src={game.iconUrl} className="h-32 w-32 shrink-0 rounded-3xl border-2 border-white/10 shadow-card" />
          <div className="min-w-0 flex-1">
            {game.genre && <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-accent/25 px-3 py-1 text-xs font-semibold text-white backdrop-blur"><Tag size={12} />{genreName(game.genre)}</div>}
            <h1 className="h-display truncate text-5xl drop-shadow-lg">{game.name}</h1>
            <div className="mt-2 flex items-center gap-2 text-muted"><UserRound size={15} />{game.creatorName || t("Nieznany twórca")}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <FavoriteButton game={game} className="!h-14 !w-14 !rounded-2xl border border-white/10" />
            <LibraryButton game={game} />
            <PlayAsButton game={game} />
            <PlayButton game={game} size="lg" />
          </div>
        </div>
      </section>

      {/* Statystyki z Roblox */}
      <section className="mt-6 grid grid-cols-3 gap-4 xl:grid-cols-6">
        <Stat icon={Users} label={t("Gra teraz")} value={fmt(game.playing)} />
        <Stat icon={Eye} label={t("Odwiedziny")} value={compact(game.visits)} hint={fmt(game.visits)} />
        <Stat icon={ThumbsUp} label={t("Ocena")} value={r == null ? '—' : `${r}%`} hint={game.upVotes != null ? `${fmt(game.upVotes)} 👍 / ${fmt(game.downVotes)} 👎` : undefined} />
        <Stat icon={Star} label={t("Ulubione")} value={compact(game.favorites)} hint={fmt(game.favorites)} />
        <Stat icon={Users} label={t("Serwer")} value={game.maxPlayers ? `${game.maxPlayers} os.` : '—'} />
        <Stat icon={CalendarPlus} label={t("Aktualizacja")} value={<span className="text-lg">{game.updated ? timeAgo(new Date(game.updated).getTime()) : '—'}</span>} />
      </section>

      <section className="mt-6 grid grid-cols-[1fr_340px] gap-6">
        <div className="card p-6">
          <h2 className="h-display mb-3 text-xl">{t("Opis")}</h2>
          {game.description ? (
            <>
              <p className={`select-text whitespace-pre-line text-[15px] leading-relaxed text-fg/80 ${expanded ? '' : 'line-clamp-[10]'}`}>{game.description}</p>
              {game.description.length > 600 && <button className="mt-3 text-sm font-semibold text-accent" onClick={() => setExpanded(e => !e)}>{expanded ? t("Zwiń") : t("Pokaż więcej")}</button>}
            </>
          ) : <p className="text-muted">{t("Twórca nie dodał opisu.")}</p>}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="label mb-4">{t("Twoja aktywność")}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted">{t("Uruchomień")}</span><span className="font-semibold">{plays.length}</span></div>
              <div className="flex justify-between"><span className="text-muted">{t("Czas gry")}</span><span className="font-semibold">{sessions.length ? dur(total(sessions)) : '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted">{t("Ostatnio")}</span><span className="font-semibold">{timeAgo(lastPlay)}</span></div>
              <div className="flex justify-between"><span className="text-muted">{t("W bibliotece od")}</span><span className="font-semibold">{lib ? new Date(lib.addedAt).toLocaleDateString(locale()) : '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted">{t("Ulubiona")}</span><span className="font-semibold">{lib?.favorite ? <Heart size={15} className="inline text-rose-500" fill="currentColor" /> : 'nie'}</span></div>
            </div>
            {plays.length > 0 && (
              <div className="mt-4 border-t border-fg/5 pt-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs text-muted"><HistoryIcon size={12} />{t("Ostatnie uruchomienia")}</div>
                {plays.slice(0, 4).map(p => <div key={p.id} className="flex items-center gap-2 py-1 text-xs text-muted"><Play size={10} className="text-accent" />{new Date(p.launchedAt).toLocaleString(locale())}</div>)}
              </div>
            )}
          </div>
          <div className="card space-y-3 p-5 text-sm">
            <h3 className="label mb-1">{t("Informacje")}</h3>
            <div className="flex justify-between"><span className="text-muted">{t("Utworzono")}</span><span>{date(game.created)}</span></div>
            <div className="flex justify-between"><span className="text-muted">{t("Zaktualizowano")}</span><span>{date(game.updated)}</span></div>
            <div className="flex justify-between"><span className="text-muted">{t("Place ID")}</span><span className="select-text font-mono">{game.placeId}</span></div>
            <div className="flex justify-between"><span className="text-muted">{t("Universe ID")}</span><span className="select-text font-mono">{game.universeId}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted">{t("Status Roblox")}</span><span className="inline-flex items-center gap-1.5"><Clock size={13} />{g ? t("na żywo") : 'zapisane'}</span></div>
            <button className="btn-secondary mt-2 w-full" onClick={() => window.nova.system.openExternal(`https://www.roblox.com/games/${game.placeId}`)}>
              <ExternalLink size={15} /> {t("Otwórz na roblox.com")}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <ServerList placeId={game.placeId} universeId={game.universeId} name={game.name} iconUrl={game.iconUrl} />
      </section>
    </div>
  )
}
