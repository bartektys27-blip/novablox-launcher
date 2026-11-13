import { create } from 'zustand'
import type { Friend, FriendPresence, GameInfo } from '@shared/types'
import { useApp } from '@/store/app'
import { t } from './i18n'

interface FriendsState {
  userId: number | null
  friends: Friend[]
  presence: Record<number, FriendPresence>
  /** gry, w które grają znajomi (universeId -> info) */
  games: Record<number, GameInfo>
  error: string | null
  loading: boolean
  updatedAt: number
  start(userId: number): void
  stop(): void
  refresh(): Promise<void>
}

let timer: ReturnType<typeof setInterval> | null = null
const POLL = 60_000

/** Lista znajomych + ich status online (odświeżany co minutę) */
export const useFriends = create<FriendsState>((set, get) => ({
  userId: null,
  friends: [],
  presence: {},
  games: {},
  error: null,
  loading: false,
  updatedAt: 0,

  start(userId) {
    if (get().userId === userId && timer) return
    get().stop()
    set({ userId, friends: [], presence: {}, error: null })
    void get().refresh()
    timer = setInterval(() => void get().refresh(), POLL)
  },
  stop() {
    if (timer) clearInterval(timer)
    timer = null
    set({ userId: null })
  },
  async refresh() {
    const { userId } = get()
    if (!userId) return
    set({ loading: true })
    try {
      let friends = get().friends
      if (!friends.length || Date.now() - get().updatedAt > 10 * 60_000) friends = await window.nova.roblox.friends(userId)
      const list = await window.nova.roblox.presence(friends.map(f => f.userId))
      const prev = get().presence
      const next: Record<number, FriendPresence> = {}
      for (const p of list) next[p.userId] = p

      // Powiadomienie, gdy znajomy wchodzi online (pomijamy pierwsze wczytanie)
      const app = useApp.getState()
      const ns = app.settings.notifications
      if (Object.keys(prev).length && ns.enabled && ns.onFriendOnline) {
        for (const p of list) {
          const before = prev[p.userId]?.type ?? 'offline'
          if (before === 'offline' && (p.type === 'online' || p.type === 'in-game')) {
            const f = friends.find(x => x.userId === p.userId)
            if (f) app.notify(t('Znajomy online'), p.type === 'in-game' ? t('{0} właśnie gra w Roblox', [f.displayName]) : t('{0} jest teraz online', [f.displayName]), 'info', true)
          }
        }
      }
      // Nazwy i ikony gier, w które grają znajomi
      const known = get().games
      const missing = [...new Set(list.filter(p => p.type === 'in-game' && p.universeId && !known[p.universeId]).map(p => p.universeId!))]
      let games = known
      if (missing.length) {
        try {
          const info = await window.nova.roblox.games(missing)
          games = { ...known }
          for (const g of info) games[g.universeId] = g
        } catch { /* nazwa gry opcjonalna */ }
      }
      set({ friends, presence: next, games, error: null, updatedAt: Date.now() })
    } catch (e) {
      set({ error: (e as Error).message })
    } finally {
      set({ loading: false })
    }
  }
}))

export const presenceRank = (p?: FriendPresence): number =>
  !p ? 9 : p.type === 'in-game' ? 0 : p.type === 'in-studio' ? 1 : p.type === 'online' ? 2 : 5

export function presenceLabel(p?: FriendPresence): string {
  if (!p) return t('Offline')
  switch (p.type) {
    case 'in-game': {
      const name = friendGame(p)?.name || p.location
      return name ? t('Gra: {0}', [name]) : t('W grze')
    }
    case 'in-studio': return t('W Roblox Studio')
    case 'online': return t('Online')
    default: return t('Offline')
  }
}

export const presenceColor = (p?: FriendPresence): string =>
  !p ? 'bg-fg/30' : p.type === 'in-game' ? 'bg-success' : p.type === 'in-studio' ? 'bg-warn' : p.type === 'online' ? 'bg-accent2' : 'bg-fg/30'

/** Gra, w którą gra znajomy (jeśli Roblox udostępnia ją w statusie) */
export function friendGame(p?: FriendPresence): GameInfo | null {
  if (!p || p.type !== 'in-game' || !p.universeId) return null
  return useFriends.getState().games[p.universeId] ?? null
}
