import { app, BrowserWindow, dialog, ipcMain, nativeImage, net, Notification, protocol, safeStorage, session, shell } from 'electron'
import { join, extname, basename } from 'path'
import { pathToFileURL } from 'url'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs'
import type { AppInfo, ModSlot, PersistedState, PlaySession, RobloxStatus, UpdateInfo } from '@shared/types'
import { loadState, patchState } from './store'
import * as api from './roblox-api'
import * as auth from './auth'
import * as playtime from './playtime'
import * as mods from './mods'
import * as rsession from './roblox-session'
import * as discord from './discord'
import * as multi from './multi'
import { DEFAULT_STATE } from './store'
import { L } from './i18n'
import { autoUpdater } from 'electron-updater'

// Protokół do serwowania własnych teł (obraz/wideo) z folderu danych aplikacji
protocol.registerSchemesAsPrivileged([{ scheme: 'nova-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }])
const bgDir = (): string => join(app.getPath('userData'), 'backgrounds')

const isDev = !app.isPackaged && !!process.env.ELECTRON_RENDERER_URL
const iconPath = join(__dirname, '../../resources/icon.png')
let win: BrowserWindow | null = null

// Jedna instancja launchera
if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
})
app.setAppUserModelId('com.novablox.launcher')

function createWindow(): void {
  const startHidden = process.argv.includes('--hidden')
  win = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 1080,
    minHeight: 680,
    frame: false,
    show: false,
    backgroundColor: '#08080d',
    title: 'NovaBlox',
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.once('ready-to-show', () => {
    if (startHidden) win?.minimize()
    else win?.show()
  })
  win.on('maximize', () => win?.webContents.send('window:maximized', true))
  win.on('unmaximize', () => win?.webContents.send('window:maximized', false))

  // Linki zewnętrzne otwieramy w przeglądarce systemowej
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://') && !(isDev && url.startsWith(process.env.ELECTRON_RENDERER_URL!))) e.preventDefault()
  })

  if (isDev) void win.loadURL(process.env.ELECTRON_RENDERER_URL!)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

// ---------- IPC ----------
type Handler = (...args: never[]) => unknown
function handle(channel: string, fn: Handler): void {
  ipcMain.handle(channel, async (_e, ...args) => {
    try { return { ok: true, data: await (fn as (...a: unknown[]) => unknown)(...args) } }
    catch (err) { return { ok: false, error: (err as Error).message || String(err) } }
  })
}

const isPos = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0

handle('store:get', () => loadState())
handle('store:patch', (partial: Partial<PersistedState>) => patchState(partial))

handle('auth:loginOAuth', (clientId: string) => auth.loginOAuth(String(clientId)))
handle('auth:cancelOAuth', () => auth.cancelOAuth())
handle('auth:connectUsername', (u: string) => auth.connectUsername(String(u)))
handle('auth:logout', () => auth.logout())
handle('auth:loginRoblox', async () => {
  const acc = await rsession.loginWithRoblox(win)
  // Aktywne konto ustawiamy od razu tutaj, żeby kolejne zapytania (np. znajomi) miały sesję
  patchState({ account: acc, accounts: [acc, ...loadState().accounts.filter(a => a.userId !== acc.userId)] })
  return acc
})
handle('auth:cancelRobloxLogin', () => rsession.cancelLogin())
handle('auth:removeAccount', (id: number) => { if (!isPos(id)) throw new Error(L('Złe ID')); return rsession.removeAccount(id) })
handle('auth:switchAccount', async (id: number) => {
  const acc = loadState().accounts.find(a => a.userId === id)
  if (!acc) throw new Error(L('Nie znaleziono konta'))
  const next = acc.mode === 'cookie' ? { ...acc, expired: !(await rsession.validate(id)) } : acc
  patchState({ account: next, accounts: loadState().accounts.map(a => (a.userId === id ? next : a)) })
  return next
})
handle('auth:hasSecureSession', () => auth.hasSecureSession())

handle('roblox:status', (): RobloxStatus => {
  const handler = app.getApplicationNameForProtocol('roblox://') || null
  return { installed: !!handler, handler }
})
handle('roblox:launch', async (placeId: number, asUserId?: number) => {
  if (!isPos(placeId)) throw new Error(L("Nieprawidłowe ID gry"))
  if (!app.getApplicationNameForProtocol('roblox://') && process.platform === 'win32') {
    throw new Error(L("Roblox nie jest zainstalowany. Pobierz go ze strony roblox.com/download"))
  }
  mods.applyBeforeLaunch()
  noteLaunch(placeId)
  if (await launchAsAccount(placeId, null, isPos(asUserId) ? asUserId : undefined)) return
  await shell.openExternal(`roblox://experiences/start?placeId=${placeId}`)
  if (loadState().settings.minimizeOnLaunch) win?.minimize()
})
handle('roblox:joinServer', async (placeId: number, serverId: string) => {
  if (!isPos(placeId) || !/^[0-9a-f-]{20,64}$/i.test(String(serverId))) throw new Error(L('Nieprawidłowy serwer'))
  if (!app.getApplicationNameForProtocol('roblox://') && process.platform === 'win32') {
    throw new Error(L('Roblox nie jest zainstalowany. Pobierz go ze strony roblox.com/download'))
  }
  mods.applyBeforeLaunch()
  noteLaunch(placeId)
  if (await launchAsAccount(placeId, String(serverId))) return
  await shell.openExternal(`roblox://experiences/start?placeId=${placeId}&gameInstanceId=${serverId}`)
  if (loadState().settings.minimizeOnLaunch) win?.minimize()
})
handle('roblox:servers', (placeId: number, cursor: string | null, order: 'Asc' | 'Desc') => {
  if (!isPos(placeId)) throw new Error(L('Złe ID'))
  return api.getServers(placeId, cursor ? String(cursor) : null, order === 'Asc' ? 'Asc' : 'Desc')
})
handle('roblox:multiStatus', () => ({ active: multi.isActive(), supported: process.platform === 'win32' }))
handle('roblox:setMulti', async (enabled: boolean) => {
  if (!enabled) { multi.disable(); patchState({ settings: { ...loadState().settings, multiInstance: false } }); return { active: false } }
  patchState({ settings: { ...loadState().settings, multiInstance: true } })
  const r = await multi.enable()
  return { active: r.ok, reason: r.reason }
})
handle('roblox:restartForMulti', async () => {
  await multi.closeRoblox()
  const r = await multi.enable()
  if (!r.ok) throw new Error(L('Nie udało się włączyć trybu wielu okien'))
  return true
})
handle('roblox:presence', (ids: number[]) => api.getPresence((ids ?? []).filter(isPos), cookieFor(loadState().account?.userId)))
handle('roblox:playtimeStatus', () => playtime.status())

handle('discord:status', () => discord.status())
handle('discord:test', () => discord.test())
handle('discord:refresh', async () => { await discord.refresh(); return discord.status() })
handle('mods:pickFile', (slot: ModSlot) => mods.pickFile(win, slot))
handle('mods:removeFile', (slot: ModSlot) => mods.removeFile(slot))
handle('mods:apply', () => mods.apply())
handle('mods:restore', () => mods.restore())
handle('mods:status', () => mods.status())

handle('backup:export', async () => {
  const d = new Date().toISOString().slice(0, 10)
  const res = await dialog.showSaveDialog(win!, {
    title: L('Zapisz kopię zapasową'),
    defaultPath: join(app.getPath('documents'), `NovaBlox-backup-${d}.json`),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (res.canceled || !res.filePath) return null
  const st = loadState()
  const bgLocal = st.settings.backgroundImage?.startsWith('nova-media://')
  const data = { ...st, settings: { ...st.settings, backgroundImage: bgLocal ? null : st.settings.backgroundImage, backgroundType: bgLocal ? 'image' : st.settings.backgroundType } }
  writeFileSync(res.filePath, JSON.stringify({ format: 'novablox-backup', version: 1, appVersion: app.getVersion(), exportedAt: new Date().toISOString(), data }, null, 2))
  return res.filePath
})
handle('backup:import', async () => {
  const res = await dialog.showOpenDialog(win!, { title: L('Wczytaj kopię zapasową'), properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] })
  const file = res.filePaths[0]
  if (res.canceled || !file) return null
  let parsed: { format?: string; data?: Partial<PersistedState> }
  try { parsed = JSON.parse(readFileSync(file, 'utf8')) } catch { throw new Error(L('To nie jest poprawny plik JSON')) }
  if (parsed.format !== 'novablox-backup' || !parsed.data) throw new Error(L('Ten plik nie jest kopią zapasową NovaBlox'))
  const d = parsed.data
  const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback)
  // Konta z sesją działają tylko, jeśli ich zaszyfrowana sesja jest na tym komputerze
  const usable = (a: { mode: string; userId: number } | null | undefined): boolean =>
    !!a && (a.mode === 'public' || (a.mode === 'cookie' && rsession.hasCookie(a.userId)) || (a.mode === 'oauth' && auth.hasSecureSession()))
  let account = usable(d.account) ? d.account! : null
  const accounts = arr<PersistedState['accounts'][number]>(d.accounts, d.account ? [d.account] : []).filter(usable)
  if (!account && accounts.length) account = accounts[0]
  const next: PersistedState = {
    ...DEFAULT_STATE,
    settings: { ...DEFAULT_STATE.settings, ...(d.settings ?? {}), effects: { ...DEFAULT_STATE.settings.effects, ...(d.settings?.effects ?? {}) }, notifications: { ...DEFAULT_STATE.settings.notifications, ...(d.settings?.notifications ?? {}) } },
    library: arr(d.library, []),
    history: arr(d.history, []),
    activity: arr(d.activity, []),
    notifications: arr(d.notifications, []),
    playtime: arr(d.playtime, []),
    account,
    accounts,
    oauthClientId: typeof d.oauthClientId === 'string' ? d.oauthClientId : '',
    onboarded: true,
    mods: loadState().mods
  }
  patchState(next)
  return next
})

/** Gdy aktywne jest konto zalogowane przez Roblox – uruchom grę biletem tego konta */
async function launchAsAccount(placeId: number, jobId: string | null, asUserId?: number): Promise<boolean> {
  const st = loadState()
  const acc = asUserId ? st.accounts.find(a => a.userId === asUserId) : st.account
  if (asUserId && (acc?.mode !== 'cookie' || !rsession.hasCookie(asUserId))) throw new Error(L('To konto nie ma zapisanej sesji Roblox – zaloguj je przez „Logowanie Roblox”'))
  if (acc?.mode !== 'cookie' || !rsession.hasCookie(acc.userId)) return false
  if (st.settings.multiInstance && !multi.isActive()) {
    const r = await multi.enable()
    if (!r.ok && r.reason === 'roblox-running') throw new Error('MULTI_RUNNING:' + L('Tryb wielu okien: zamknij wszystkie okna Roblox i uruchom grę ponownie'))
  }
  try {
    await rsession.launchWithAccount(acc.userId, placeId, jobId, uri => shell.openExternal(uri))
  } catch (e) {
    if ((e as Error).message === L('Sesja konta wygasła – zaloguj się ponownie w Ustawienia → Konto')) {
      const expired = { ...acc, expired: true }
      const cur = loadState()
      patchState({ ...(cur.account?.userId === acc.userId ? { account: expired } : {}), accounts: cur.accounts.map(a => (a.userId === acc.userId ? expired : a)) })
      win?.webContents.send('account:expired', acc.userId)
    }
    throw e
  }
  if (loadState().settings.minimizeOnLaunch) win?.minimize()
  return true
}

/** Ciasteczko aktywnego konta – tylko dla jego własnych danych */
function cookieFor(userId: number | undefined): string | null {
  const acc = loadState().account
  return acc?.mode === 'cookie' && acc.userId === userId ? rsession.getCookie(acc.userId) : null
}

function noteLaunch(placeId: number): void {
  const g = loadState().library.find(x => x.placeId === placeId)
  const h = loadState().history.find(x => x.placeId === placeId)
  const src = g ?? h
  playtime.notePendingLaunch({ universeId: src?.universeId ?? 0, placeId, name: src?.name ?? '', iconUrl: src?.iconUrl ?? null })
}
handle('roblox:resolveInput', (input: string) => api.resolveInput(String(input)))
handle('roblox:games', (ids: number[]) => api.getGames((ids ?? []).filter(isPos)))
handle('roblox:details', (id: number) => { if (!isPos(id)) throw new Error(L("Złe ID")); return api.getDetails(id) })
handle('roblox:discoverSorts', () => api.discoverSorts())
handle('roblox:search', (q: string) => api.searchGames(String(q).slice(0, 80)))
handle('roblox:profile', (id: number) => { if (!isPos(id)) throw new Error(L("Złe ID")); return api.getProfile(id) })
handle('roblox:friends', (id: number) => { if (!isPos(id)) throw new Error(L("Złe ID")); return api.getFriends(id, cookieFor(id)) })
handle('roblox:userFavorites', (id: number) => { if (!isPos(id)) throw new Error(L("Złe ID")); return api.getUserFavorites(id) })

handle('system:info', (): AppInfo => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  platform: `${process.platform} ${process.arch}`,
  userData: app.getPath('userData'),
  safeStorage: safeStorage.isEncryptionAvailable(),
  redirectUri: auth.REDIRECT_URI
}))

const cmpVer = (a: string, b: string): number => {
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0)
  return 0
}

// Auto-aktualizacje: electron-updater + GitHub Releases (latest.yml)
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.on('download-progress', p => win?.webContents.send('update:progress', { percent: p.percent, transferred: p.transferred, total: p.total }))
let pendingVersion = ''

handle('system:checkUpdate', async (): Promise<UpdateInfo> => {
  const current = app.getVersion()
  let repo = ''
  try { repo = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf8')).novablox?.updateRepo ?? '' } catch { /* brak */ }
  if (!repo) return { status: 'not-configured', current }
  try {
    if (app.isPackaged) {
      const r = await autoUpdater.checkForUpdates()
      const latest = r?.updateInfo?.version
      if (latest && cmpVer(latest, current) > 0) {
        pendingVersion = latest
        const notes = typeof r!.updateInfo.releaseNotes === 'string' ? r!.updateInfo.releaseNotes.replace(/<[^>]+>/g, '') : ''
        return { status: 'available', current, latest, url: `https://github.com/${repo}/releases/latest`, notes }
      }
      return { status: 'up-to-date', current, latest }
    }
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
    if (res.status === 404) return { status: 'up-to-date', current }
    if (!res.ok) throw new Error(L("GitHub: {0}", [res.status]))
    const r = (await res.json()) as { tag_name: string; html_url: string; body?: string }
    return cmpVer(r.tag_name, current) > 0
      ? { status: 'available', current, latest: r.tag_name.replace(/^v/, ''), url: r.html_url, notes: r.body ?? '' }
      : { status: 'up-to-date', current, latest: r.tag_name.replace(/^v/, '') }
  } catch (e) {
    return { status: 'error', current, error: (e as Error).message }
  }
})

handle('system:installUpdate', async () => {
  if (!app.isPackaged) throw new Error(L("Automatyczna instalacja działa tylko w zainstalowanej wersji (EXE)"))
  if (!pendingVersion) {
    const r = await autoUpdater.checkForUpdates()
    if (!r?.updateInfo?.version || cmpVer(r.updateInfo.version, app.getVersion()) <= 0) throw new Error(L("Brak nowej wersji"))
  }
  await autoUpdater.downloadUpdate()
  setTimeout(() => autoUpdater.quitAndInstall(true, true), 600)
})

handle('system:setAutoStart', (enabled: boolean, minimized: boolean) => {
  if (!app.isPackaged) throw new Error(L("Autostart działa tylko w zainstalowanej wersji (EXE)"))
  app.setLoginItemSettings({ openAtLogin: !!enabled, args: minimized ? ['--hidden'] : [] })
  return app.getLoginItemSettings().openAtLogin
})

handle('system:notify', (title: string, body: string) => {
  if (!Notification.isSupported()) return
  new Notification({ title: String(title), body: String(body), icon: iconPath }).show()
})

handle('system:clearCache', async () => {
  const freed = api.clearApiCache()
  const before = await session.defaultSession.getCacheSize()
  await session.defaultSession.clearCache()
  return { freedBytes: freed + before }
})

handle('system:openExternal', async (url: string) => {
  if (!/^https:\/\/([a-z0-9-]+\.)*(roblox\.com|github\.com|discord\.com)\//i.test(String(url))) throw new Error(L("Niedozwolony adres"))
  await shell.openExternal(url)
})

handle('system:pickBackground', async () => {
  const res = await dialog.showOpenDialog(win!, {
    title: L('Wybierz tło launchera'),
    properties: ['openFile'],
    filters: [
      { name: L('Obrazy i wideo'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm'] }
    ]
  })
  const file = res.filePaths[0]
  if (res.canceled || !file) return null
  const ext = extname(file).slice(1).toLowerCase()
  const type: 'image' | 'video' = ext === 'mp4' || ext === 'webm' ? 'video' : 'image'
  const limit = type === 'video' ? 150 : 20
  if (statSync(file).size > limit * 1024 * 1024) throw new Error(L('Plik jest za duży (maks. {0} MB)', [limit]))
  mkdirSync(bgDir(), { recursive: true })
  for (const old of readdirSync(bgDir())) { try { unlinkSync(join(bgDir(), old)) } catch { /* w użyciu */ } }
  const name = `bg-${Date.now()}.${ext}`
  copyFileSync(file, join(bgDir(), name))
  return { url: `nova-media://bg/${name}`, type }
})

handle('system:online', () => net.isOnline())

ipcMain.on('window:minimize', () => win?.minimize())
ipcMain.on('window:toggleMaximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()))
ipcMain.on('window:close', () => win?.close())

app.whenReady().then(async () => {
  protocol.handle('nova-media', req => {
    const u = new URL(req.url)
    const name = basename(decodeURIComponent(u.pathname))
    const file = join(bgDir(), name)
    if (u.host !== 'bg' || !existsSync(file)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString(), { headers: req.headers })
  })
  playtime.startTracking(e => {
    if (e.type === 'session') patchState({ playtime: [...loadState().playtime, e.session].slice(-3000) })
    if (e.type === 'status') discord.onPlaytime(e.status)
    win?.webContents.send('playtime:event', e)
  })
  void discord.refresh()
  // Odśwież sesję OAuth; jeśli wygasła, przełącz konto na wylogowane
  const st = loadState()
  if (st.account?.mode === 'oauth') {
    const ok = await auth.refreshSession()
    if (!ok) patchState({ account: null })
  }
  if (st.account?.mode === 'cookie' && !(await rsession.validate(st.account.userId))) {
    const expired = { ...st.account, expired: true }
    patchState({ account: expired, accounts: st.accounts.map(a => (a.userId === expired.userId ? expired : a)) })
  }
  if (loadState().settings.multiInstance) void multi.enable()
  createWindow()
})
app.on('before-quit', () => {
  multi.disable()
  discord.shutdown()
  playtime.flush((s: PlaySession) => patchState({ playtime: [...loadState().playtime, s].slice(-3000) }))
})
app.on('window-all-closed', () => app.quit())
