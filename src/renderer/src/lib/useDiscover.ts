import { create } from 'zustand'
import type { DiscoverSort } from '@shared/types'

interface DiscoverCache {
  sorts: DiscoverSort[] | null
  error: string | null
  loading: boolean
  loadedAt: number
  load(force?: boolean): Promise<void>
}

/** Listy gier z Roblox Explore – wspólny cache dla Dashboardu i Discover */
export const useDiscover = create<DiscoverCache>((set, get) => ({
  sorts: null,
  error: null,
  loading: false,
  loadedAt: 0,
  async load(force) {
    const s = get()
    if (s.loading) return
    if (!force && s.sorts && Date.now() - s.loadedAt < 5 * 60_000) return
    set({ loading: true, error: null })
    try {
      const sorts = await window.nova.roblox.discoverSorts()
      set({ sorts, loadedAt: Date.now() })
    } catch (e) {
      set({ error: (e as Error).message })
    } finally {
      set({ loading: false })
    }
  }
}))

const find = (sorts: DiscoverSort[], re: RegExp): DiscoverSort | undefined =>
  sorts.find(s => re.test(s.id) || re.test(s.name))

/** Dopasowanie kategorii launchera do list udostępnianych przez Roblox */
export function pickSort(sorts: DiscoverSort[], kind: 'popular' | 'most-played' | 'new'): DiscoverSort | undefined {
  if (kind === 'popular') return find(sorts, /trending|popular|top.?rated/i) ?? sorts[0]
  if (kind === 'most-played') return find(sorts, /playing.?now|most.?engag|most.?played|top.?playing|top.?earning/i) ?? sorts[1]
  return find(sorts, /up.?and.?coming|new|rising|fresh/i)
}
