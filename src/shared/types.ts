// Typy współdzielone między procesem głównym, preloadem i interfejsem

export interface GameInfo {
  universeId: number
  placeId: number
  name: string
  description: string
  creatorName: string
  creatorType: string
  creatorId: number
  playing: number | null
  visits: number | null
  maxPlayers: number | null
  favorites: number | null
  upVotes: number | null
  downVotes: number | null
  genre: string
  created: string | null
  updated: string | null
  iconUrl: string | null
  thumbnailUrl: string | null
}

export interface GameDetails extends GameInfo {
  thumbnails: string[]
}

export interface LibraryGame {
  universeId: number
  placeId: number
  name: string
  description: string
  creatorName: string
  genre: string
  iconUrl: string | null
  thumbnailUrl: string | null
  playing: number | null
  addedAt: number
  favorite: boolean
  lastPlayed: number | null
  playCount: number
  /** ostatnia znana data aktualizacji gry (do alertów o update) */
  knownUpdated?: string | null
}

export interface HistoryEntry {
  id: string
  universeId: number
  placeId: number
  name: string
  iconUrl: string | null
  launchedAt: number
}

export type ActivityType = 'launch' | 'add' | 'remove' | 'favorite' | 'unfavorite' | 'login' | 'logout'
export interface ActivityEntry {
  id: string
  type: ActivityType
  text: string
  universeId?: number
  iconUrl?: string | null
  at: number
}

export interface AppNotification {
  id: string
  title: string
  body: string
  kind: 'info' | 'success' | 'warning' | 'error'
  at: number
  read: boolean
}

export type ThemeId = 'nova' | 'midnight' | 'aurora' | 'crimson' | 'emerald' | 'mono'
export type CardStyle = 'glass' | 'solid' | 'outline'
export type CardSize = 'compact' | 'default' | 'large'
export type AnimationLevel = 'full' | 'reduced' | 'off'
export type Language = 'pl' | 'en'
export type BgAnimation = 'none' | 'aurora' | 'stars' | 'grid'

export interface Settings {
  theme: ThemeId
  accent: string | null
  accent2: string | null
  backgroundImage: string | null
  backgroundType: 'image' | 'video'
  backgroundAnimation: BgAnimation
  backgroundBlur: number
  backgroundDim: number
  cardStyle: CardStyle
  cardSize: CardSize
  animations: AnimationLevel
  effects: { glow: boolean; gradients: boolean; noise: boolean }
  notifications: { enabled: boolean; onLaunch: boolean; onUpdate: boolean; system: boolean; onGameUpdate: boolean; onFriendOnline: boolean }
  language: Language
  discord: { enabled: boolean; clientId: string; showIdle: boolean; showButton: boolean }
  autoStart: boolean
  startMinimized: boolean
  minimizeOnLaunch: boolean
  /** wiele okien Roblox naraz (np. dwa konta) */
  multiInstance: boolean
  lastPage: PageId
}

export interface PlaySession {
  id: string
  universeId: number
  placeId: number
  name: string
  iconUrl: string | null
  start: number
  end: number
}

export interface PlaytimeStatus {
  running: boolean
  since: number | null
  game: { universeId: number; placeId: number; name: string; iconUrl: string | null } | null
}

export interface ServerInfo {
  id: string
  playing: number
  maxPlayers: number
  ping: number | null
  fps: number | null
}

export interface ServerPage { servers: ServerInfo[]; nextCursor: string | null }

export type PresenceType = 'offline' | 'online' | 'in-game' | 'in-studio' | 'invisible'
export interface FriendPresence {
  userId: number
  type: PresenceType
  location: string
  universeId: number | null
  placeId: number | null
  /** miejsce + instancja serwera – do dołączenia do znajomego (gdy Roblox je udostępnia) */
  joinPlaceId: number | null
  gameId: string | null
  lastOnline: string | null
}

export type ModSlot = 'font' | 'death' | 'jump' | 'land' | 'footsteps'
export interface ModConfig {
  enabled: boolean
  files: Partial<Record<ModSlot, string>>
}
export interface ModStatus { robloxFound: boolean; versions: number; applied: boolean; lastError: string | null }

export interface DiscordStatus { connected: boolean; user: string | null; error: string | null }

export interface Account {
  mode: 'oauth' | 'public' | 'cookie'
  expired?: boolean
  userId: number
  username: string
  displayName: string
  connectedAt: number
}

export interface PersistedState {
  settings: Settings
  library: LibraryGame[]
  history: HistoryEntry[]
  activity: ActivityEntry[]
  notifications: AppNotification[]
  account: Account | null
  accounts: Account[]
  oauthClientId: string
  onboarded: boolean
  playtime: PlaySession[]
  mods: ModConfig
}

export type PageId = 'dashboard' | 'discover' | 'library' | 'favorites' | 'history' | 'profile' | 'settings'

export interface UserProfile {
  userId: number
  username: string
  displayName: string
  description: string
  created: string | null
  hasVerifiedBadge: boolean
  avatarUrl: string | null
  headshotUrl: string | null
  friendsCount: number | null
  followersCount: number | null
  followingsCount: number | null
  profileUrl: string
}

export interface Friend {
  userId: number
  username: string
  displayName: string
  headshotUrl: string | null
}

export interface DiscoverSort {
  id: string
  name: string
  games: GameInfo[]
}

export interface RobloxStatus {
  installed: boolean
  handler: string | null
}

export interface UpdateInfo {
  status: 'not-configured' | 'up-to-date' | 'available' | 'error'
  current: string
  latest?: string
  url?: string
  notes?: string
  error?: string
}

export interface AppInfo {
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  userData: string
  safeStorage: boolean
  redirectUri: string
}

export interface NovaApi {
  store: {
    get(): Promise<PersistedState>
    patch(partial: Partial<PersistedState>): Promise<void>
  }
  auth: {
    loginOAuth(clientId: string): Promise<Account>
    cancelOAuth(): Promise<void>
    connectUsername(username: string): Promise<Account>
    loginRoblox(): Promise<Account>
    cancelRobloxLogin(): Promise<void>
    removeAccount(userId: number): Promise<void>
    switchAccount(userId: number): Promise<Account>
    logout(): Promise<void>
    hasSecureSession(): Promise<boolean>
  }
  roblox: {
    status(): Promise<RobloxStatus>
    launch(placeId: number, asUserId?: number): Promise<void>
    multiStatus(): Promise<{ active: boolean; supported: boolean }>
    restartForMulti(): Promise<boolean>
    setMulti(enabled: boolean): Promise<{ active: boolean; reason?: 'roblox-running' | 'unsupported' }>
    resolveInput(input: string): Promise<GameInfo>
    games(universeIds: number[]): Promise<GameInfo[]>
    details(universeId: number): Promise<GameDetails>
    discoverSorts(): Promise<DiscoverSort[]>
    search(query: string): Promise<GameInfo[]>
    profile(userId: number): Promise<UserProfile>
    friends(userId: number): Promise<Friend[]>
    userFavorites(userId: number): Promise<GameInfo[]>
    servers(placeId: number, cursor: string | null, order: 'Asc' | 'Desc'): Promise<ServerPage>
    joinServer(placeId: number, serverId: string): Promise<void>
    presence(userIds: number[]): Promise<FriendPresence[]>
    onPlaytime(cb: (e: { type: 'status'; status: PlaytimeStatus } | { type: 'session'; session: PlaySession }) => void): () => void
    playtimeStatus(): Promise<PlaytimeStatus>
  }
  mods: {
    pickFile(slot: ModSlot): Promise<string | null>
    removeFile(slot: ModSlot): Promise<void>
    apply(): Promise<ModStatus>
    restore(): Promise<ModStatus>
    status(): Promise<ModStatus>
  }
  discord: {
    status(): Promise<DiscordStatus>
    test(): Promise<DiscordStatus>
    refresh(): Promise<DiscordStatus>
  }
  backup: {
    exportData(): Promise<string | null>
    importData(): Promise<PersistedState | null>
  }
  system: {
    info(): Promise<AppInfo>
    checkUpdate(): Promise<UpdateInfo>
    installUpdate(): Promise<void>
    onUpdateProgress(cb: (p: { percent: number; transferred: number; total: number }) => void): () => void
    setAutoStart(enabled: boolean, minimized: boolean): Promise<boolean>
    notify(title: string, body: string): Promise<void>
    clearCache(): Promise<{ freedBytes: number }>
    openExternal(url: string): Promise<void>
    pickBackground(): Promise<{ url: string; type: 'image' | 'video' } | null>
    online(): Promise<boolean>
  }
  window: {
    minimize(): void
    toggleMaximize(): void
    close(): void
    onMaximizeChange(cb: (maximized: boolean) => void): () => void
  }
}
