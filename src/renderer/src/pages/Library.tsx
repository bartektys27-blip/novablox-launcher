import { locale, t } from '@/lib/i18n'
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Compass, Heart, LayoutGrid, Library as LibIcon, Link2, List, Loader2, Plus, Search, Trash2, Clock } from 'lucide-react'
import clsx from 'clsx'
import type { LibraryGame } from '@shared/types'
import { useApp } from '@/store/app'
import { confirmAction, toast } from '@/store/ui'
import { compact, genreName, plural, timeAgo } from '@/lib/format'
import { EmptyState, Img, PageHeader, Segmented } from '@/components/ui'
import { FavoriteButton, GameGrid, PlayButton } from '@/components/GameCard'
import { Modal } from '@/components/Overlays'

type SortKey = 'recent' | 'added' | 'name' | 'players' | 'plays'

function AddGameModal({ open, onClose }: { open: boolean; onClose(): void }): JSX.Element {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const add = useApp(s => s.addToLibrary)
  const isIn = useApp(s => s.isInLibrary)
  const submit = async (): Promise<void> => {
    setBusy(true)
    try {
      const g = await window.nova.roblox.resolveInput(value)
      if (isIn(g.universeId)) toast.info(t("Ta gra jest już w bibliotece"), g.name)
      else add(g)
      setValue('')
      onClose()
    } catch (e) { toast.error('Nie udało się dodać gry', (e as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} width={520}>
      <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent"><Link2 size={22} /></div>
      <h3 className="h-display text-2xl">{t("Dodaj grę z linku")}</h3>
      <p className="mt-1 text-sm text-muted">{t("Wklej adres gry z roblox.com (np. roblox.com/games/920587237/…) albo jej Place ID.")}</p>
      <input autoFocus className="input mt-5" placeholder={t("https://www.roblox.com/games/…")} value={value}
        onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && value.trim() && !busy && submit()} />
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>{t("Anuluj")}</button>
        <button className="btn-primary" disabled={!value.trim() || busy} onClick={submit}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {t("Dodaj")}</button>
      </div>
    </Modal>
  )
}

function ListView({ games, onRemove }: { games: LibraryGame[]; onRemove(g: LibraryGame): void }): JSX.Element {
  const openGame = useApp(s => s.openGame)
  return (
    <div className="card divide-y divide-fg/5 overflow-hidden">
      <AnimatePresence initial={false}>
        {games.map(g => (
          <motion.div key={g.universeId} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
            onClick={() => openGame(g.universeId)} className="group flex cursor-pointer items-center gap-4 px-4 py-3 transition hover:bg-fg/5">
            <Img src={g.iconUrl} className="h-14 w-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold group-hover:text-accent">{g.name}</div>
              <div className="truncate text-xs text-muted">{[g.creatorName, g.genre && genreName(g.genre)].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="w-28 text-right text-sm"><div className="text-fg">{compact(g.playing)}</div><div className="text-[11px] text-muted">{t("gra teraz")}</div></div>
            <div className="w-28 text-right text-sm"><div className="text-fg">{g.playCount}×</div><div className="text-[11px] text-muted">{t("uruchomień")}</div></div>
            <div className="w-32 text-right text-xs text-muted">{g.lastPlayed ? timeAgo(g.lastPlayed) : t("nie grano")}</div>
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <FavoriteButton game={g} className="!bg-fg/10 !text-fg" />
              <button title={t("Usuń")} onClick={() => onRemove(g)} className="grid h-9 w-9 place-items-center rounded-xl bg-fg/10 transition hover:bg-danger hover:text-white"><Trash2 size={15} /></button>
              <PlayButton game={g} size="sm" />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default function Library({ favoritesOnly = false }: { favoritesOnly?: boolean }): JSX.Element {
  const library = useApp(s => s.library)
  const remove = useApp(s => s.removeFromLibrary)
  const toggleFavorite = useApp(s => s.toggleFavorite)
  const navigate = useApp(s => s.navigate)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [genre, setGenre] = useState('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [adding, setAdding] = useState(false)

  const base = favoritesOnly ? library.filter(g => g.favorite) : library
  const genres = useMemo(() => [...new Set(base.map(g => g.genre).filter(Boolean))].sort(), [base])

  const games = useMemo(() => {
    let g = base.filter(x => (genre === 'all' || x.genre === genre) && (!q || x.name.toLowerCase().includes(q.toLowerCase()) || x.creatorName.toLowerCase().includes(q.toLowerCase())))
    const by: Record<SortKey, (a: LibraryGame, b: LibraryGame) => number> = {
      recent: (a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0) || b.addedAt - a.addedAt,
      added: (a, b) => b.addedAt - a.addedAt,
      name: (a, b) => a.name.localeCompare(b.name, locale()),
      players: (a, b) => (b.playing ?? -1) - (a.playing ?? -1),
      plays: (a, b) => b.playCount - a.playCount
    }
    g = [...g].sort(by[sort])
    return g
  }, [base, genre, q, sort])

  const askRemove = async (g: LibraryGame): Promise<void> => {
    if (favoritesOnly) { toggleFavorite(g); return }
    if (await confirmAction({ title: t("Usunąć grę z biblioteki?"), body: t("„{0}” zniknie z biblioteki i ulubionych. Historia uruchomień zostanie zachowana.", [g.name]), confirmLabel: t("Usuń"), danger: true }))
      remove(g.universeId)
  }

  const title = favoritesOnly ? t("Favorites") : t("My Games")
  const subtitle = favoritesOnly ? `Ulubione: ${plural(base.length, 'gra', 'gry', 'gier')}` : t("{0} w Twojej bibliotece", [plural(base.length, 'gra', 'gry', 'gier')])

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle}>
        {!favoritesOnly && <button className="btn-secondary" onClick={() => setAdding(true)}><Link2 size={15} /> {t("Dodaj z linku")}</button>}
        <button className="btn-primary" onClick={() => navigate('discover')}><Compass size={15} /> {t("Odkrywaj gry")}</button>
      </PageHeader>

      {base.length === 0 ? (
        favoritesOnly ? (
          <EmptyState icon={Heart} title={t("Nie masz jeszcze ulubionych")} text={t("Kliknij serduszko na dowolnej karcie gry, a pojawi się tutaj – gotowa do odpalenia jednym kliknięciem.")}
            action={<><button className="btn-primary" onClick={() => navigate('discover')}><Compass size={16} /> {t("Przeglądaj Discover")}</button><button className="btn-secondary" onClick={() => navigate('library')}>{t("Moja biblioteka")}</button></>} />
        ) : (
          <EmptyState icon={LibIcon} title={t("Twoja biblioteka jest pusta")} text={t("Dodaj gry z sekcji Discover albo wklej link do gry z roblox.com. Wszystko zostaje zapisane lokalnie.")}
            action={<><button className="btn-primary" onClick={() => navigate('discover')}><Compass size={16} /> {t("Odkrywaj gry")}</button><button className="btn-secondary" onClick={() => setAdding(true)}><Link2 size={16} /> {t("Dodaj z linku")}</button></>} />
        )
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-72">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input h-10 pl-10" placeholder={t("Szukaj w bibliotece…")} value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <select className="input h-10 w-auto pr-8" value={sort} onChange={e => setSort(e.target.value as SortKey)}>
              <option value="recent">{t("Ostatnio grane")}</option>
              <option value="added">{t("Ostatnio dodane")}</option>
              <option value="name">{t("Nazwa A–Z")}</option>
              <option value="players">{t("Najwięcej graczy teraz")}</option>
              <option value="plays">{t("Najczęściej uruchamiane")}</option>
            </select>
            <div className="flex-1" />
            <Segmented<'grid' | 'list'> id={`view-${favoritesOnly}`} value={view} onChange={setView} options={[{ value: 'grid', label: t("Siatka"), icon: LayoutGrid }, { value: 'list', label: t("Lista"), icon: List }]} />
          </div>

          {genres.length > 0 && (
            <div className="hide-scroll mb-6 flex gap-2 overflow-x-auto pb-1">
              <button className={clsx('chip', genre === 'all' && 'chip-active')} onClick={() => setGenre('all')}>{t("Wszystkie")} <span className="opacity-60">{base.length}</span></button>
              {genres.map(g => (
                <button key={g} className={clsx('chip', genre === g && 'chip-active')} onClick={() => setGenre(g)}>
                  {genreName(g)} <span className="opacity-60">{base.filter(x => x.genre === g).length}</span>
                </button>
              ))}
            </div>
          )}

          {games.length === 0 ? (
            <EmptyState icon={Search} title={t("Nic nie pasuje")} text={t("Zmień wyszukiwaną frazę lub kategorię.")} action={<button className="btn-secondary" onClick={() => { setQ(''); setGenre('all') }}>{t("Wyczyść filtry")}</button>} />
          ) : view === 'grid' ? (
            <GameGrid games={games} onRemove={g => askRemove(g as LibraryGame)}
              meta={g => { const l = g as LibraryGame; return l.lastPlayed ? <span className="inline-flex items-center gap-1"><Clock size={11} />{timeAgo(l.lastPlayed)} · {l.playCount}×</span> : undefined }} />
          ) : (
            <ListView games={games} onRemove={askRemove} />
          )}
        </>
      )}
      <AddGameModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}
