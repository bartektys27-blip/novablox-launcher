import { t } from '@/lib/i18n'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Heart, Loader2, Play, Plus, ThumbsUp, Trash2, Users, Check, Layers } from 'lucide-react'
import clsx from 'clsx'
import { useApp, type CardGame } from '@/store/app'
import { compact, genreName, rating } from '@/lib/format'
import { confirmAction } from '@/store/ui'
import { Badge, Img } from './ui'

export function PlayButton({ game, size = 'md', className }: { game: CardGame; size?: 'sm' | 'md' | 'lg'; className?: string }): JSX.Element {
  const launch = useApp(s => s.launch)
  const launching = useApp(s => s.launching === game.universeId)
  return (
    <button
      onClick={e => { e.stopPropagation(); void launch(game) }}
      disabled={launching}
      className={clsx('btn-primary', size === 'lg' && 'h-14 px-10 text-base rounded-2xl', size === 'sm' && 'h-9 px-3', className)}>
      {launching ? <Loader2 size={size === 'lg' ? 20 : 16} className="animate-spin" /> : <Play size={size === 'lg' ? 20 : 16} fill="currentColor" />}
      {size === 'sm' ? t("Graj") : 'PLAY'}
    </button>
  )
}

/** Graj na wybranym koncie – widoczne przy włączonym trybie wielu okien */
export function PlayAsButton({ game }: { game: CardGame }): JSX.Element | null {
  const multi = useApp(s => s.settings.multiInstance)
  const allAccounts = useApp(s => s.accounts)
  const launch = useApp(s => s.launch)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  const accounts = allAccounts.filter(a => a.mode === 'cookie' && !a.expired)
  if (!multi || accounts.length === 0) return null
  return (
    <div ref={ref} className="relative">
      <button className="btn-secondary h-14 rounded-2xl px-4" title={t("Graj na innym koncie")} onClick={() => setOpen(o => !o)}>
        <Layers size={18} /> {t("Na koncie…")}
      </button>
      {open && (
        <div className="panel absolute bottom-16 right-0 z-30 w-64 p-2">
          <div className="label px-2 pb-1 pt-1">{t("Uruchom w nowym oknie jako")}</div>
          {accounts.map(a => (
            <button key={a.userId} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-fg/10"
              onClick={() => { setOpen(false); void launch(game, a.userId) }}>
              <Play size={14} className="text-accent" fill="currentColor" />
              <span className="flex-1 truncate font-medium">{a.displayName}</span>
              <span className="truncate text-xs text-muted">@{a.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function FavoriteButton({ game, className }: { game: CardGame; className?: string }): JSX.Element {
  const toggle = useApp(s => s.toggleFavorite)
  const fav = useApp(s => s.library.find(g => g.universeId === game.universeId)?.favorite ?? false)
  return (
    <button title={fav ? t("Usuń z ulubionych") : t("Dodaj do ulubionych")}
      onClick={e => { e.stopPropagation(); toggle(game) }}
      className={clsx('grid h-9 w-9 place-items-center rounded-xl backdrop-blur transition hover:scale-110', fav ? 'bg-rose-500/90 text-white' : 'bg-black/50 text-white/90 hover:bg-black/70', className)}>
      <Heart size={16} fill={fav ? 'currentColor' : 'none'} />
    </button>
  )
}

export function LibraryButton({ game, compactLabel }: { game: CardGame; compactLabel?: boolean }): JSX.Element {
  const inLib = useApp(s => s.library.some(g => g.universeId === game.universeId))
  const add = useApp(s => s.addToLibrary)
  const remove = useApp(s => s.removeFromLibrary)
  return (
    <button
      onClick={async e => {
        e.stopPropagation()
        if (!inLib) return add(game)
        if (await confirmAction({ title: t("Usunąć z biblioteki?"), body: t("„{0}” zniknie z Twojej biblioteki i ulubionych. Historia uruchomień zostanie zachowana.", [game.name]), confirmLabel: t("Usuń"), danger: true }))
          remove(game.universeId)
      }}
      className={clsx('btn-secondary', compactLabel && 'h-9 px-3')}
      title={inLib ? t("Usuń z biblioteki") : t("Dodaj do biblioteki")}>
      {inLib ? <Check size={16} className="text-success" /> : <Plus size={16} />}
      {compactLabel ? null : inLib ? t("W bibliotece") : t("Dodaj do biblioteki")}
    </button>
  )
}

interface CardProps {
  game: CardGame
  index?: number
  meta?: ReactNode
  onRemove?(): void
}

export function GameCard({ game, index = 0, meta, onRemove }: CardProps): JSX.Element {
  const openGame = useApp(s => s.openGame)
  const inLib = useApp(s => s.library.some(g => g.universeId === game.universeId))
  const add = useApp(s => s.addToLibrary)
  const r = rating(game.upVotes ?? null, game.downVotes ?? null)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: .96 }}
      transition={{ duration: .3, delay: Math.min(index, 12) * 0.025 }}
      whileHover={{ y: -4 }}
      onClick={() => openGame(game.universeId)}
      className="card card-hover group cursor-pointer overflow-hidden">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Img src={game.thumbnailUrl ?? game.iconUrl} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {game.playing != null && (
            <Badge tone="live"><span className="h-1.5 w-1.5 rounded-full bg-success" />{compact(game.playing)}</Badge>
          )}
          {r != null && <Badge tone="live"><ThumbsUp size={11} />{r}%</Badge>}
        </div>
        <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition group-hover:opacity-100">
          {onRemove && (
            <button title={t("Usuń z biblioteki")} onClick={e => { e.stopPropagation(); onRemove() }}
              className="grid h-9 w-9 place-items-center rounded-xl bg-black/50 text-white/90 backdrop-blur transition hover:scale-110 hover:bg-danger">
              <Trash2 size={15} />
            </button>
          )}
          <FavoriteButton game={game} />
        </div>
        <div className="absolute inset-x-3 bottom-3 flex translate-y-3 gap-2 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <PlayButton game={game} size="sm" className="flex-1" />
          {!inLib && (
            <button title={t("Dodaj do biblioteki")} onClick={e => { e.stopPropagation(); add(game) }}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-white backdrop-blur hover:bg-white/25"><Plus size={16} /></button>
          )}
        </div>
      </div>
      <div className="flex gap-3 p-3.5">
        <Img src={game.iconUrl} className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold leading-tight" title={game.name}>{game.name}</div>
          <div className="mt-1 truncate text-xs text-muted">
            {meta ?? [game.creatorName, game.genre && genreName(game.genre)].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function GameGrid({ games, meta, onRemove }: { games: CardGame[]; meta?(g: CardGame): ReactNode; onRemove?(g: CardGame): void }): JSX.Element {
  return (
    <motion.div layout className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(var(--card-min), 1fr))' }}>
      {games.map((g, i) => (
        <GameCard key={g.universeId} game={g} index={i} meta={meta?.(g)} onRemove={onRemove ? () => onRemove(g) : undefined} />
      ))}
    </motion.div>
  )
}

/** Poziomy rząd kart z przewijaniem strzałkami */
export function GameRow({ games, meta }: { games: CardGame[]; meta?(g: CardGame): ReactNode }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number): void => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <div className="group/row relative">
      <div ref={ref} className="hide-scroll -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2">
        {games.map((g, i) => (
          <div key={g.universeId} className="shrink-0 snap-start" style={{ width: 'calc(var(--card-min) + 20px)' }}>
            <GameCard game={g} index={i} meta={meta?.(g)} />
          </div>
        ))}
      </div>
      {games.length > 3 && (
        <>
          <button onClick={() => scroll(-1)} className="panel absolute -left-4 top-[35%] grid h-10 w-10 place-items-center rounded-full opacity-0 transition group-hover/row:opacity-100 hover:text-accent"><ChevronLeft size={18} /></button>
          <button onClick={() => scroll(1)} className="panel absolute -right-4 top-[35%] grid h-10 w-10 place-items-center rounded-full opacity-0 transition group-hover/row:opacity-100 hover:text-accent"><ChevronRight size={18} /></button>
        </>
      )}
    </div>
  )
}

export function PlayersLabel({ n }: { n: number | null }): JSX.Element {
  return <span className="inline-flex items-center gap-1"><Users size={12} />{n == null ? t("brak danych") : t("{0} gra teraz", [compact(n)])}</span>
}
