import { create } from 'zustand'
import type {
  Account, ActivityEntry, ActivityType, AppNotification, GameInfo, HistoryEntry, LibraryGame,
  ModConfig, PageId, PersistedState, PlaySession, PlaytimeStatus, RobloxStatus, Settings
} from '@shared/types'
import { getLang, setLang, t } from '@/lib/i18n'
import { applyTheme } from '@/lib/themes'
import { uid } from '@/lib/format'
import { confirmAction, toast } from './ui'

export type Route = { page: PageId } | { page: 'game'; universeId: number; from: PageId }

export type CardGame = Pick<GameInfo, 'universeId' | 'placeId' | 'name' | 'iconUrl' | 'thumbnailUrl' | 'playing' | 'creatorName' | 'genre'> &
  Partial<Pick<GameInfo, 'upVotes' | 'downVotes' | 'description'>>

interface AppState extends PersistedState {
  ready: boolean
  route: Route
  stack: Route[]
  online: boolean
  roblox: RobloxStatus | null
  searchQuery: string
  launching: number | null
  playStatus: PlaytimeStatus

  addSession(s: PlaySession): void
  clearPlaytime(): void
  setMods(m: ModConfig): void

  init(): Promise<void>
  navigate(page: PageId): void
  openGame(universeId: number): void
  back(): void
  setSearch(q: string): void
  setOnline(v: boolean): void

  setSettings(p: Partial<Settings>): void
  setAccount(a: Account | null): void
  addAccount(a: Account): void
  switchAccount(userId: number): Promise<void>
  removeAccount(userId: number): Promise<void>
  setClientId(id: string): void
  finishOnboarding(): void

  isInLibrary(universeId: number): boolean
  addToLibrary(g: CardGame, favorite?: boolean): void
  removeFromLibrary(universeId: number): void
  toggleFavorite(g: CardGame): void
  refreshLibrary(): Promise<void>
  launch(g: CardGame, asUserId?: number): Promise<void>
  clearHistory(): void
  clearLibrary(): void

  notify(title: string, body: string, kind?: AppNotification['kind'], system?: boolean): void
  markNotificationsRead(): void
  clearNotifications(): void
  logActivity(type: ActivityType, text: string, g?: CardGame): void
}

// playtime zapisuje proces główny (działa też, gdy okno jest zamykane)
const PERSIST_KEYS: (keyof PersistedState)[] = ['settings', 'library', 'history', 'activity', 'notifications', 'account', 'accounts', 'oauthClientId', 'onboarded', 'mods']

let saveTimer: ReturnType<typeof setTimeout> | null = null
let dirty: Partial<PersistedState> = {}
function persist(p: Partial<PersistedState>): void {
  dirty = { ...dirty, ...p }
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const payload = dirty
    dirty = {}
    window.nova.store.patch(payload).catch(e => toast.error('Nie udało się zapisać danych', (e as Error).message))
  }, 250)
}

const toLibrary = (g: CardGame, favorite = false): LibraryGame => ({
  universeId: g.universeId,
  placeId: g.placeId,
  name: g.name,
  description: g.description ?? '',
  creatorName: g.creatorName,
  genre: g.genre,
  iconUrl: g.iconUrl,
  thumbnailUrl: g.thumbnailUrl,
  playing: g.playing,
  addedAt: Date.now(),
  favorite,
  lastPlayed: null,
  playCount: 0
})

export const useApp = create<AppState>((set, get) => {
  // Każda zmiana trwałych pól jest automatycznie zapisywana
  const update = (p: Partial<AppState>): void => {
    set(p)
    const toSave: Partial<PersistedState> = {}
    for (const k of PERSIST_KEYS) if (k in p) (toSave as Record<string, unknown>)[k] = (p as Record<string, unknown>)[k]
    if (Object.keys(toSave).length) persist(toSave)
  }

  return {
    settings: undefined as unknown as Settings,
    library: [], history: [], activity: [], notifications: [],
    account: null, accounts: [], oauthClientId: '', onboarded: false,
    playtime: [], mods: { enabled: false, files: {} },
    playStatus: { running: false, since: null, game: null },
    ready: false,
    route: { page: 'dashboard' },
    stack: [],
    online: navigator.onLine,
    roblox: null,
    searchQuery: '',
    launching: null,

    async init() {
      const st = await window.nova.store.get()
      // Język zapisany w danych (np. po imporcie) różni się od bieżącego – przeładuj
      if ((st.settings.language ?? 'pl') !== getLang()) { setLang(st.settings.language ?? 'pl'); location.reload(); return }
      applyTheme(st.settings)
      set({ ...st, route: { page: st.settings.lastPage ?? 'dashboard' }, ready: true })
      window.nova.roblox.status().then(roblox => set({ roblox })).catch(() => {})
      window.nova.system.online().then(online => set({ online })).catch(() => {})
      window.nova.roblox.playtimeStatus().then(playStatus => set({ playStatus })).catch(() => {})
      window.nova.roblox.onPlaytime(e => {
        if (e.type === 'status') set({ playStatus: e.status })
        else get().addSession(e.session)
      })
      void get().refreshLibrary()
    },

    navigate(page) {
      const { route, settings } = get()
      if (route.page === page) return
      set({ route: { page }, stack: [] })
      update({ settings: { ...settings, lastPage: page } })
    },
    openGame(universeId) {
      const { route, stack } = get()
      const from: PageId = route.page === 'game' ? route.from : route.page
      set({ route: { page: 'game', universeId, from }, stack: [...stack, route].slice(-20) })
    },
    back() {
      const { stack, route } = get()
      const prev = stack[stack.length - 1]
      if (prev) set({ route: prev, stack: stack.slice(0, -1) })
      else if (route.page === 'game') set({ route: { page: route.from } })
    },
    setSearch(q) { set({ searchQuery: q }) },
    setOnline(v) { set({ online: v }) },

    addSession(s) { set({ playtime: [...get().playtime, s].slice(-3000) }) },
    clearPlaytime() { set({ playtime: [] }); void window.nova.store.patch({ playtime: [] }) },
    setMods(mods) { update({ mods }) },

    setSettings(p) {
      const settings = { ...get().settings, ...p }
      applyTheme(settings)
      update({ settings })
    },
    setAccount(account) { update({ account }) },
    addAccount(a) {
      const accounts = [a, ...get().accounts.filter(x => x.userId !== a.userId)]
      update({ account: a, accounts })
    },
    async switchAccount(userId) {
      try {
        const a = await window.nova.auth.switchAccount(userId)
        update({ account: a, accounts: get().accounts.map(x => (x.userId === userId ? a : x)) })
        if (a.expired) toast.error(t('Sesja konta wygasła'), t('Zaloguj się ponownie na to konto'))
        else toast.success(t('Przełączono konto'), `@${a.username}`)
      } catch (e) { toast.error(t('Nie udało się przełączyć konta'), (e as Error).message) }
    },
    async removeAccount(userId) {
      const a = get().accounts.find(x => x.userId === userId)
      if (a?.mode === 'cookie') await window.nova.auth.removeAccount(userId).catch(() => {})
      if (a?.mode === 'oauth') await window.nova.auth.logout().catch(() => {})
      const accounts = get().accounts.filter(x => x.userId !== userId)
      const account = get().account?.userId === userId ? accounts[0] ?? null : get().account
      update({ accounts, account })
      if (a) get().logActivity('logout', t('Usunięto konto @{0}', [a.username]))
    },
    setClientId(oauthClientId) { update({ oauthClientId }) },
    finishOnboarding() { update({ onboarded: true }) },

    isInLibrary(id) { return get().library.some(g => g.universeId === id) },

    addToLibrary(g, favorite = false) {
      if (get().isInLibrary(g.universeId)) return
      update({ library: [toLibrary(g, favorite), ...get().library] })
      get().logActivity('add', t("Dodano „{0}” do biblioteki", [g.name]), g)
      toast.success(t("Dodano do biblioteki"), g.name)
    },
    removeFromLibrary(id) {
      const g = get().library.find(x => x.universeId === id)
      update({ library: get().library.filter(x => x.universeId !== id) })
      if (g) {
        get().logActivity('remove', t("Usunięto „{0}” z biblioteki", [g.name]), g)
        toast.info(t("Usunięto z biblioteki"), g.name)
      }
    },
    toggleFavorite(g) {
      const lib = get().library
      const existing = lib.find(x => x.universeId === g.universeId)
      if (!existing) {
        update({ library: [toLibrary(g, true), ...lib] })
        get().logActivity('favorite', t("„{0}” w ulubionych", [g.name]), g)
        toast.success(t("Dodano do ulubionych"), g.name)
        return
      }
      const fav = !existing.favorite
      update({ library: lib.map(x => (x.universeId === g.universeId ? { ...x, favorite: fav } : x)) })
      get().logActivity(fav ? 'favorite' : 'unfavorite', fav ? t("„{0}” w ulubionych", [g.name]) : t("Usunięto „{0}” z ulubionych", [g.name]), g)
      toast.info(fav ? t("Dodano do ulubionych") : t("Usunięto z ulubionych"), g.name)
    },

    async refreshLibrary() {
      const lib = get().library
      if (!lib.length) return
      try {
        const fresh = await window.nova.roblox.games(lib.map(g => g.universeId))
        const map = new Map(fresh.map(f => [f.universeId, f]))
        const ns = get().settings.notifications
        const updated: LibraryGame[] = []
        update({
          library: get().library.map(g => {
            const f = map.get(g.universeId)
            if (!f) return g
            // Alert: ulubiona gra dostała aktualizację od ostatniego sprawdzenia
            if (g.favorite && g.knownUpdated && f.updated && Date.parse(f.updated) > Date.parse(g.knownUpdated)) updated.push(g)
            return { ...g, name: f.name, description: f.description, creatorName: f.creatorName, genre: f.genre, iconUrl: f.iconUrl ?? g.iconUrl, thumbnailUrl: f.thumbnailUrl ?? g.thumbnailUrl, playing: f.playing, knownUpdated: f.updated ?? g.knownUpdated ?? null }
          })
        })
        if (ns.enabled && ns.onGameUpdate) {
          for (const g of updated) get().notify(t('Aktualizacja gry'), t('„{0}” dostała nową aktualizację', [g.name]), 'info', true)
        }
      } catch { /* offline – zostają zapisane dane */ }
    },

    async launch(g, asUserId) {
      if (get().launching) return
      set({ launching: g.universeId })
      try {
        await window.nova.roblox.launch(g.placeId, asUserId)
        const now = Date.now()
        const entry: HistoryEntry = { id: uid(), universeId: g.universeId, placeId: g.placeId, name: g.name, iconUrl: g.iconUrl, launchedAt: now }
        update({
          history: [entry, ...get().history].slice(0, 500),
          library: get().library.map(x => (x.universeId === g.universeId ? { ...x, lastPlayed: now, playCount: x.playCount + 1 } : x))
        })
        get().logActivity('launch', t("Uruchomiono „{0}”", [g.name]), g)
        const s = get().settings.notifications
        if (s.enabled && s.onLaunch) get().notify(t("Uruchamianie gry"), t("{0} otwiera się w Roblox", [g.name]), 'success', true)
        toast.success(t("Uruchamianie…"), t("{0} otworzy się w aplikacji Roblox", [g.name]))
      } catch (e) {
        const msg = (e as Error).message
        if (msg.startsWith('MULTI_RUNNING:')) {
          set({ launching: null })
          const ok = await confirmAction({
            title: t("Roblox jest już otwarty"),
            body: t("Żeby grać na kilku kontach naraz, Roblox musi wystartować po włączeniu trybu wielu okien. Zamknąć otwarte okna Roblox i uruchomić grę ponownie? Niezapisany postęp w grze może przepaść."),
            confirmLabel: t("Zamknij Roblox i uruchom"),
            danger: true
          })
          if (!ok) return
          try { await window.nova.roblox.restartForMulti() } catch (err) { toast.error(t("Nie udało się uruchomić gry"), (err as Error).message); return }
          return get().launch(g, asUserId)
        }
        toast.error(t("Nie udało się uruchomić gry"), msg)
        // sesja konta mogła wygasnąć – odśwież stan konta z dysku
        window.nova.store.get().then(st => set({ account: st.account, accounts: st.accounts })).catch(() => {})
      } finally {
        setTimeout(() => set({ launching: null }), 1500)
      }
    },

    clearHistory() { update({ history: [] }); toast.info(t("Historia wyczyszczona")) },
    clearLibrary() { update({ library: [] }); toast.info(t("Biblioteka wyczyszczona")) },

    notify(title, body, kind = 'info', system = false) {
      const n: AppNotification = { id: uid(), title, body, kind, at: Date.now(), read: false }
      update({ notifications: [n, ...get().notifications].slice(0, 100) })
      const s = get().settings.notifications
      if (system && s.enabled && s.system) window.nova.system.notify(title, body).catch(() => {})
    },
    markNotificationsRead() {
      if (get().notifications.some(n => !n.read)) update({ notifications: get().notifications.map(n => ({ ...n, read: true })) })
    },
    clearNotifications() { update({ notifications: [] }) },

    logActivity(type, text, g) {
      const a: ActivityEntry = { id: uid(), type, text, at: Date.now(), universeId: g?.universeId, iconUrl: g?.iconUrl ?? null }
      update({ activity: [a, ...get().activity].slice(0, 200) })
    }
  }
})
