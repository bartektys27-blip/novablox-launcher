import { L } from './i18n'
import { randomUUID } from 'crypto'
import type { DiscoverSort, Friend, GameDetails, GameInfo, UserProfile } from '@shared/types'

// Wszystkie zapytania do Roblox idą z procesu głównego (brak problemów z CORS,
// jeden cache). Korzystamy wyłącznie z publicznych endpointów Roblox – żadne
// statystyki nie są generowane lokalnie.

export class ApiError extends Error {
  constructor(message: string, public status?: number) { super(message) }
}

const memo = new Map<string, { at: number; value: unknown }>()
const SESSION_ID = randomUUID()

export function clearApiCache(): number {
  let bytes = 0
  for (const v of memo.values()) bytes += JSON.stringify(v.value ?? null).length
  memo.clear()
  return bytes
}

async function request<T>(url: string, init: RequestInit = {}, ttlMs = 60_000): Promise<T> {
  const key = (init.method ?? 'GET') + ' ' + url + ' ' + (init.body ?? '')
  const hit = memo.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T

  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 12_000)
    try {
      const res = await fetch(url, {
        ...init,
        signal: ctrl.signal,
        headers: { Accept: 'application/json', ...(init.headers ?? {}) }
      })
      if (res.status === 429 || res.status >= 500) {
        lastErr = new ApiError(res.status === 429 ? L("Roblox ogranicza liczbę zapytań – spróbuj za chwilę") : L("Serwer Roblox zwrócił błąd {0}", [res.status]), res.status)
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)))
        continue
      }
      if (!res.ok) throw new ApiError(L("Roblox zwrócił błąd {0}", [res.status]), res.status)
      const json = (await res.json()) as T
      memo.set(key, { at: Date.now(), value: json })
      return json
    } catch (err) {
      lastErr = err
      if (err instanceof ApiError && err.status && err.status < 500 && err.status !== 429) throw err
      if ((err as Error).name === 'AbortError') lastErr = new ApiError(L("Przekroczono czas oczekiwania na Roblox"))
      else if (!(err instanceof ApiError)) lastErr = new ApiError(L("Brak połączenia z serwerami Roblox"))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr instanceof Error ? lastErr : new ApiError(L("Nieznany błąd sieci"))
}

const chunk = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// ---------- Gry ----------

interface RawGame {
  id: number
  rootPlaceId: number
  name: string
  description: string | null
  creator?: { id: number; name: string; type: string }
  playing?: number
  visits?: number
  maxPlayers?: number
  created?: string
  updated?: string
  genre?: string
  genre_l1?: string
  favoritedCount?: number
}

async function thumbMap(universeIds: number[], kind: 'icon' | 'thumb'): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  for (const part of chunk(universeIds, 50)) {
    try {
      if (kind === 'icon') {
        const r = await request<{ data: { targetId: number; imageUrl: string | null; state: string }[] }>(
          `https://thumbnails.roblox.com/v1/games/icons?universeIds=${part.join(',')}&returnPolicy=PlaceHolder&size=256x256&format=Png&isCircular=false`, {}, 10 * 60_000)
        for (const d of r.data ?? []) if (d.imageUrl) map.set(d.targetId, d.imageUrl)
      } else {
        const r = await request<{ data: { universeId: number; thumbnails: { imageUrl: string | null }[] }[] }>(
          `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${part.join(',')}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`, {}, 10 * 60_000)
        for (const d of r.data ?? []) {
          const url = d.thumbnails?.[0]?.imageUrl
          if (url) map.set(d.universeId, url)
        }
      }
    } catch { /* miniatury są opcjonalne */ }
  }
  return map
}

async function voteMap(universeIds: number[]): Promise<Map<number, { up: number; down: number }>> {
  const map = new Map<number, { up: number; down: number }>()
  for (const part of chunk(universeIds, 50)) {
    try {
      const r = await request<{ data: { id: number; upVotes: number; downVotes: number }[] }>(
        `https://games.roblox.com/v1/games/votes?universeIds=${part.join(',')}`)
      for (const d of r.data ?? []) map.set(d.id, { up: d.upVotes, down: d.downVotes })
    } catch { /* głosy są opcjonalne */ }
  }
  return map
}

export async function getGames(universeIds: number[], withVotes = false): Promise<GameInfo[]> {
  const ids = [...new Set(universeIds.filter(n => Number.isInteger(n) && n > 0))]
  if (!ids.length) return []
  const raw: RawGame[] = []
  for (const part of chunk(ids, 50)) {
    const r = await request<{ data: RawGame[] }>(`https://games.roblox.com/v1/games?universeIds=${part.join(',')}`)
    raw.push(...(r.data ?? []))
  }
  const [icons, thumbs, votes] = await Promise.all([
    thumbMap(ids, 'icon'),
    thumbMap(ids, 'thumb'),
    withVotes ? voteMap(ids) : Promise.resolve(new Map<number, { up: number; down: number }>())
  ])
  const byId = new Map(raw.map(g => [g.id, g]))
  return ids.flatMap(id => {
    const g = byId.get(id)
    if (!g) return []
    const v = votes.get(id)
    const info: GameInfo = {
      universeId: g.id,
      placeId: g.rootPlaceId,
      name: g.name,
      description: g.description ?? '',
      creatorName: g.creator?.name ?? '',
      creatorType: g.creator?.type ?? '',
      creatorId: g.creator?.id ?? 0,
      playing: num(g.playing),
      visits: num(g.visits),
      maxPlayers: num(g.maxPlayers),
      favorites: num(g.favoritedCount),
      upVotes: v ? v.up : null,
      downVotes: v ? v.down : null,
      genre: (g.genre_l1 && g.genre_l1 !== 'All' ? g.genre_l1 : g.genre && g.genre !== 'All' ? g.genre : '') || '',
      created: g.created ?? null,
      updated: g.updated ?? null,
      iconUrl: icons.get(id) ?? null,
      thumbnailUrl: thumbs.get(id) ?? null
    }
    return [info]
  })
}

export async function placeToUniverse(placeId: number): Promise<number> {
  const r = await request<{ universeId: number | null }>(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`, {}, 24 * 3600_000)
  if (!r.universeId) throw new ApiError(L("Nie znaleziono gry o tym ID"))
  return r.universeId
}

export async function resolveInput(input: string): Promise<GameInfo> {
  const s = input.trim()
  const m = s.match(/games\/(\d+)/i) || s.match(/placeId=(\d+)/i) || s.match(/^(\d{3,})$/)
  if (!m) throw new ApiError(L("Wklej link do gry z roblox.com albo jej ID (Place ID)"))
  const universeId = await placeToUniverse(Number(m[1]))
  const [game] = await getGames([universeId], true)
  if (!game) throw new ApiError(L("Nie udało się pobrać informacji o grze"))
  return game
}

export async function getDetails(universeId: number): Promise<GameDetails> {
  const [game] = await getGames([universeId], true)
  if (!game) throw new ApiError(L("Ta gra nie istnieje lub jest niedostępna"))
  let thumbnails: string[] = []
  try {
    const r = await request<{ data: { thumbnails: { imageUrl: string | null }[] }[] }>(
      `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&countPerUniverse=10&defaults=true&size=768x432&format=Png&isCircular=false`, {}, 10 * 60_000)
    thumbnails = (r.data?.[0]?.thumbnails ?? []).map(t => t.imageUrl).filter((u): u is string => !!u)
  } catch { /* opcjonalne */ }
  if (!thumbnails.length && game.thumbnailUrl) thumbnails = [game.thumbnailUrl]
  return { ...game, thumbnails }
}

// Endpointy explore/search nie mają oficjalnej dokumentacji schematu,
// dlatego wyciągamy z nich tylko universeId (bezpiecznie, rekurencyjnie),
// a wszystkie dane gry pobieramy z udokumentowanego games.roblox.com.
function collectUniverseIds(node: unknown, out: number[] = [], depth = 0): number[] {
  if (depth > 8 || node == null) return out
  if (Array.isArray(node)) { for (const n of node) collectUniverseIds(n, out, depth + 1); return out }
  if (typeof node === 'object') {
    const o = node as Record<string, unknown>
    const id = o.universeId ?? (o.contentType === 'Game' ? o.contentId : undefined)
    if (typeof id === 'number' && id > 0) out.push(id)
    for (const v of Object.values(o)) if (v && typeof v === 'object') collectUniverseIds(v, out, depth + 1)
  }
  return out
}

interface RawSort { sortId?: string; sortDisplayName?: string; topic?: string; contentType?: string; games?: unknown[] }

export async function discoverSorts(): Promise<DiscoverSort[]> {
  const r = await request<{ sorts?: RawSort[] }>(
    `https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=${SESSION_ID}&device=computer&country=all`, {}, 5 * 60_000)
  const sorts = (r.sorts ?? []).filter(s => s.sortId && (s.contentType ?? 'Games') === 'Games').slice(0, 14)
  const result: DiscoverSort[] = []
  for (const s of sorts) {
    let ids = [...new Set(collectUniverseIds(s.games ?? []))]
    if (!ids.length) {
      try {
        const c = await request<unknown>(
          `https://apis.roblox.com/explore-api/v1/get-sort-content?sessionId=${SESSION_ID}&sortId=${encodeURIComponent(s.sortId!)}&device=computer&country=all`, {}, 5 * 60_000)
        ids = [...new Set(collectUniverseIds(c))]
      } catch { /* pomiń tę kategorię */ }
    }
    if (!ids.length) continue
    const games = await getGames(ids.slice(0, 30), true)
    if (games.length) result.push({ id: s.sortId!, name: s.sortDisplayName || s.topic || s.sortId!, games })
  }
  if (!result.length) throw new ApiError(L("Roblox nie zwrócił żadnych list gier"))
  return result
}

export async function searchGames(query: string): Promise<GameInfo[]> {
  const q = query.trim()
  if (!q) return []
  const r = await request<unknown>(
    `https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(q)}&sessionId=${SESSION_ID}&pageType=all`, {}, 5 * 60_000)
  const ids = [...new Set(collectUniverseIds(r))].slice(0, 40)
  return getGames(ids, true)
}

// ---------- Użytkownicy ----------

export async function lookupUsername(username: string): Promise<{ id: number; name: string; displayName: string }> {
  const r = await request<{ data: { id: number; name: string; displayName: string }[] }>(
    'https://users.roblox.com/v1/usernames/users',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernames: [username.trim()], excludeBannedUsers: true }) },
    0)
  const u = r.data?.[0]
  if (!u) throw new ApiError(L("Nie znaleziono użytkownika „{0}”", [username.trim()]))
  return u
}

async function avatarUrls(userIds: number[], type: 'avatar' | 'avatar-headshot', size: string): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  for (const part of chunk(userIds, 100)) {
    try {
      const r = await request<{ data: { targetId: number; imageUrl: string | null }[] }>(
        `https://thumbnails.roblox.com/v1/users/${type}?userIds=${part.join(',')}&size=${size}&format=Png&isCircular=false`, {}, 10 * 60_000)
      for (const d of r.data ?? []) if (d.imageUrl) map.set(d.targetId, d.imageUrl)
    } catch { /* opcjonalne */ }
  }
  return map
}

async function count(url: string): Promise<number | null> {
  try { return num((await request<{ count: number }>(url, {}, 5 * 60_000)).count) } catch { return null }
}

export async function getProfile(userId: number): Promise<UserProfile> {
  const u = await request<{ id: number; name: string; displayName: string; description: string; created: string; hasVerifiedBadge: boolean }>(
    `https://users.roblox.com/v1/users/${userId}`, {}, 5 * 60_000)
  const [full, head, friendsCount, followersCount, followingsCount] = await Promise.all([
    avatarUrls([userId], 'avatar', '720x720'),
    avatarUrls([userId], 'avatar-headshot', '150x150'),
    count(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
    count(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
    count(`https://friends.roblox.com/v1/users/${userId}/followings/count`)
  ])
  return {
    userId: u.id,
    username: u.name,
    displayName: u.displayName,
    description: u.description ?? '',
    created: u.created ?? null,
    hasVerifiedBadge: !!u.hasVerifiedBadge,
    avatarUrl: full.get(userId) ?? null,
    headshotUrl: head.get(userId) ?? null,
    friendsCount,
    followersCount,
    followingsCount,
    profileUrl: `https://www.roblox.com/users/${userId}/profile`
  }
}

export async function getFriends(userId: number, cookie: string | null = null): Promise<Friend[]> {
  let ids: number[] = []
  if (cookie) {
    // Z sesją Roblox lista znajomych jest dostępna (bez niej Roblox zwraca 403)
    const { authed } = await import('./roblox-session')
    const res = await authed(`https://friends.roblox.com/v1/users/${userId}/friends/find?limit=50`, cookie)
    if (res.ok) {
      const j = (await res.json()) as { PageItems?: { id: number }[] }
      ids = (j.PageItems ?? []).map(f => f.id)
    }
    if (!ids.length) {
      const r2 = await authed(`https://friends.roblox.com/v1/users/${userId}/friends`, cookie)
      if (r2.ok) ids = (((await r2.json()) as { data?: { id: number }[] }).data ?? []).map(f => f.id)
      else if (!res.ok) throw new ApiError(L('Roblox zwrócił błąd {0}', [res.status]), res.status)
    }
  } else try {
    const r = await request<{ data: { id: number }[] }>(`https://friends.roblox.com/v1/users/${userId}/friends`, {}, 5 * 60_000)
    ids = (r.data ?? []).map(f => f.id)
  } catch {
    const r = await request<{ PageItems?: { id: number }[]; data?: { id: number }[] }>(
      `https://friends.roblox.com/v1/users/${userId}/friends/find?limit=50`, {}, 5 * 60_000)
    ids = (r.PageItems ?? r.data ?? []).map(f => f.id)
  }
  ids = ids.filter(Boolean).slice(0, 60)
  if (!ids.length) return []
  // Szczegóły (nazwy) pobieramy hurtowo, bo lista znajomych może zawierać same ID
  const users = await request<{ data: { id: number; name: string; displayName: string }[] }>(
    'https://users.roblox.com/v1/users',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: ids, excludeBannedUsers: true }) },
    5 * 60_000)
  const heads = await avatarUrls(ids, 'avatar-headshot', '150x150')
  return (users.data ?? []).map(u => ({ userId: u.id, username: u.name, displayName: u.displayName, headshotUrl: heads.get(u.id) ?? null }))
}

export async function getUserFavorites(userId: number): Promise<GameInfo[]> {
  const r = await request<{ data: { id: number }[] }>(
    `https://games.roblox.com/v2/users/${userId}/favorite/games?limit=25&sortOrder=Desc`, {}, 5 * 60_000)
  return getGames((r.data ?? []).map(g => g.id))
}

// ---------- Serwery publiczne ----------

export async function getServers(placeId: number, cursor: string | null, order: 'Asc' | 'Desc'): Promise<import('@shared/types').ServerPage> {
  const q = new URLSearchParams({ sortOrder: order, limit: '25', excludeFullGames: 'false' })
  if (cursor) q.set('cursor', cursor)
  const r = await request<{ data: { id: string; playing?: number; maxPlayers: number; ping?: number; fps?: number }[]; nextPageCursor: string | null }>(
    `https://games.roblox.com/v1/games/${placeId}/servers/Public?${q}`, {}, 15_000)
  return {
    servers: (r.data ?? []).map(s => ({ id: s.id, playing: s.playing ?? 0, maxPlayers: s.maxPlayers, ping: num(s.ping), fps: num(s.fps) })),
    nextCursor: r.nextPageCursor ?? null
  }
}

// ---------- Obecność znajomych ----------
// Bez ciasteczka sesji Roblox zwraca status (online / w grze / w Studio),
// ale zwykle ukrywa, w jakiej grze ktoś jest. Pokazujemy to, co Roblox zwróci.

const PRESENCE = ['offline', 'online', 'in-game', 'in-studio', 'invisible'] as const

export async function getPresence(userIds: number[], cookie: string | null = null): Promise<import('@shared/types').FriendPresence[]> {
  const ids = [...new Set(userIds.filter(n => Number.isInteger(n) && n > 0))].slice(0, 100)
  if (!ids.length) return []
  type PR = { userPresences: { userId: number; userPresenceType: number; lastLocation?: string; universeId?: number | null; placeId?: number | null; rootPlaceId?: number | null; gameId?: string | null; lastOnline?: string }[] }
  let r: PR
  if (cookie) {
    const { authed } = await import('./roblox-session')
    const res = await authed('https://presence.roblox.com/v1/presence/users', cookie, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: ids }) })
    if (!res.ok) throw new ApiError(L('Roblox zwrócił błąd {0}', [res.status]), res.status)
    r = (await res.json()) as PR
  } else r = await request<{ userPresences: { userId: number; userPresenceType: number; lastLocation?: string; universeId?: number | null; placeId?: number | null; rootPlaceId?: number | null; gameId?: string | null; lastOnline?: string }[] }>(
    'https://presence.roblox.com/v1/presence/users',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: ids }) },
    30_000)
  return (r.userPresences ?? []).map(p => ({
    userId: p.userId,
    type: PRESENCE[p.userPresenceType] ?? 'offline',
    location: p.lastLocation ?? '',
    universeId: p.universeId ?? null,
    placeId: p.rootPlaceId ?? p.placeId ?? null,
    joinPlaceId: p.placeId ?? null,
    gameId: p.gameId ?? null,
    lastOnline: p.lastOnline ?? null
  }))
}
