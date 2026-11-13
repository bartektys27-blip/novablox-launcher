import { t } from '@/lib/i18n'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Flame, TrendingUp, Sparkles, Map, Factory, Building2, Ghost, Swords, TentTree, Footprints, Sword, Search, X, RefreshCw, ArrowDownWideNarrow, Info, Layers
} from 'lucide-react'
import clsx from 'clsx'
import type { GameInfo } from '@shared/types'
import { useApp } from '@/store/app'
import { pickSort, useDiscover } from '@/lib/useDiscover'
import { useAsync } from '@/lib/useAsync'
import { EmptyState, ErrorState, PageHeader, SkeletonCards } from '@/components/ui'
import { GameGrid } from '@/components/GameCard'

type Cat =
  | { id: string; label: string; icon: typeof Flame; kind: 'sort'; sort: 'popular' | 'most-played' | 'new' }
  | { id: string; label: string; icon: typeof Flame; kind: 'search'; query: string }
  | { id: string; label: string; icon: typeof Flame; kind: 'roblox'; sortId: string }

const CATS: Cat[] = [
  { id: 'popular', label: t("Popularne"), icon: Flame, kind: 'sort', sort: 'popular' },
  { id: 'most', label: t("Najczęściej grane"), icon: TrendingUp, kind: 'sort', sort: 'most-played' },
  { id: 'new', label: t("Nowe gry"), icon: Sparkles, kind: 'sort', sort: 'new' },
  { id: 'adventure', label: t("Przygodowe"), icon: Map, kind: 'search', query: 'adventure' },
  { id: 'sim', label: t("Symulatory"), icon: Factory, kind: 'search', query: 'simulator' },
  { id: 'tycoon', label: t("Tycoon"), icon: Building2, kind: 'search', query: 'tycoon' },
  { id: 'horror', label: t("Horror"), icon: Ghost, kind: 'search', query: 'horror' },
  { id: 'rpg', label: t("RPG"), icon: Swords, kind: 'search', query: 'rpg' },
  { id: 'survival', label: t("Survival"), icon: TentTree, kind: 'search', query: 'survival' },
  { id: 'obby', label: t("Obby"), icon: Footprints, kind: 'search', query: 'obby' },
  { id: 'fighting', label: t("Fighting"), icon: Sword, kind: 'search', query: 'fighting' }
]

type SortMode = 'default' | 'players' | 'rating'

export default function Discover(): JSX.Element {
  const globalQuery = useApp(s => s.searchQuery)
  const setGlobalQuery = useApp(s => s.setSearch)
  const [catId, setCatId] = useState('popular')
  const [query, setQuery] = useState(globalQuery)
  const [active, setActive] = useState(globalQuery)
  const [sortMode, setSortMode] = useState<SortMode>('default')
  const discover = useDiscover()

  useEffect(() => { void discover.load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Wyszukiwanie z górnego paska
  useEffect(() => { if (globalQuery) { setQuery(globalQuery); setActive(globalQuery) } }, [globalQuery])

  const robloxCats: Cat[] = useMemo(() => {
    if (!discover.sorts) return []
    const used = new Set([pickSort(discover.sorts, 'popular'), pickSort(discover.sorts, 'most-played'), pickSort(discover.sorts, 'new')].filter(Boolean).map(s => s!.id))
    return discover.sorts.filter(s => !used.has(s.id)).map(s => ({ id: 'rbx:' + s.id, label: s.name, icon: Layers, kind: 'roblox' as const, sortId: s.id }))
  }, [discover.sorts])

  const cat = [...CATS, ...robloxCats].find(c => c.id === catId) ?? CATS[0]
  const searchTerm = active || (cat.kind === 'search' ? cat.query : '')

  const search = useAsync<GameInfo[] | null>(
    () => (searchTerm ? window.nova.roblox.search(searchTerm) : Promise.resolve(null)),
    [searchTerm]
  )

  let games: GameInfo[] | null = null
  let loading = false
  let error: string | null = null
  let source = ''
  let missing = false

  if (searchTerm) {
    games = search.data; loading = search.loading; error = search.error
    source = active ? t("Wyniki wyszukiwania Roblox dla „{0}”", [active]) : t("Wyniki wyszukiwania Roblox dla frazy „{0}”", [searchTerm])
  } else {
    loading = discover.loading && !discover.sorts
    error = discover.sorts ? null : discover.error
    if (discover.sorts) {
      const s = cat.kind === 'sort' ? pickSort(discover.sorts, cat.sort) : cat.kind === 'roblox' ? discover.sorts.find(x => x.id === cat.sortId) : undefined
      if (s) { games = s.games; source = `Lista Roblox: ${s.name}` } else { games = []; missing = true }
    }
  }

  const sorted = useMemo(() => {
    if (!games) return null
    const g = [...games]
    if (sortMode === 'players') g.sort((a, b) => (b.playing ?? -1) - (a.playing ?? -1))
    if (sortMode === 'rating') {
      const r = (x: GameInfo): number => (x.upVotes != null && x.downVotes != null && x.upVotes + x.downVotes > 0 ? x.upVotes / (x.upVotes + x.downVotes) : -1)
      g.sort((a, b) => r(b) - r(a))
    }
    return g
  }, [games, sortMode])

  const submit = (): void => { setActive(query.trim()); setGlobalQuery(query.trim()) }
  const clear = (): void => { setQuery(''); setActive(''); setGlobalQuery('') }

  return (
    <div>
      <PageHeader title={t("Discover")} subtitle={t("Odkrywaj gry z oficjalnych list i wyszukiwarki Roblox")}>
        <button className="btn-secondary" onClick={() => (searchTerm ? search.reload() : discover.load(true))}>
          <RefreshCw size={15} className={clsx((loading || discover.loading) && 'animate-spin')} /> {t("Odśwież")}
        </button>
      </PageHeader>

      <div className="relative mb-6">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder={t("Wyszukaj dowolną grę Roblox i naciśnij Enter…")} className="input h-14 rounded-2xl pl-12 pr-36 text-base" />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
          {(query || active) && <button className="btn-ghost h-10" onClick={clear}><X size={16} /></button>}
          <button className="btn-primary h-10" onClick={submit} disabled={!query.trim()}>{t("Szukaj")}</button>
        </div>
      </div>

      {!active && (
        <div className="hide-scroll -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
          {[...CATS, ...robloxCats].map(c => (
            <button key={c.id} onClick={() => setCatId(c.id)} className={clsx('chip', c.id === catId && 'chip-active')}>
              <c.icon size={15} />{c.label}
            </button>
          ))}
        </div>
      )}

      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted">
          <Info size={14} className="shrink-0" /><span className="truncate">{source || t("Ładowanie list Roblox…")}</span>
          {sorted && <span className="shrink-0 rounded-md bg-fg/10 px-1.5 py-0.5 text-[11px]">{sorted.length}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ArrowDownWideNarrow size={16} className="text-muted" />
          <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)} className="input h-9 w-auto pr-8">
            <option value="default">{t("Kolejność Roblox")}</option>
            <option value="players">{t("Najwięcej graczy teraz")}</option>
            <option value="rating">{t("Najwyżej oceniane")}</option>
          </select>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={searchTerm + catId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .2 }}>
          {error ? <ErrorState message={error} onRetry={() => (searchTerm ? search.reload() : discover.load(true))} />
            : loading || !sorted ? <SkeletonCards count={12} />
            : missing ? <EmptyState icon={Sparkles} title={t("Roblox nie udostępnia teraz tej listy")} text={t("Ta kategoria pojawi się, gdy Roblox opublikuje odpowiednią listę gier. Spróbuj innych kategorii lub wyszukiwarki.")} />
            : sorted.length === 0 ? <EmptyState icon={Search} title={t("Brak wyników")} text={t("Roblox nie znalazł gier dla tego zapytania. Spróbuj innej frazy.")} action={<button className="btn-secondary" onClick={clear}>{t("Wyczyść wyszukiwanie")}</button>} />
            : <GameGrid games={sorted} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
