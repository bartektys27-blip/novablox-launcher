import { app, BrowserWindow, safeStorage, session } from 'electron'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import type { Account } from '@shared/types'
import { L } from './i18n'

// Logowanie przez oficjalną stronę roblox.com w osobnym oknie.
// Hasło wpisujesz na stronie Roblox (działa 2FA i klucze dostępu) – launcher
// go nie widzi. Po zalogowaniu zapisujemy tylko ciasteczko sesji, zaszyfrowane
// przez Windows (DPAPI). Ciasteczko nigdy nie trafia do interfejsu ani poza
// domeny roblox.com.

const vaultFile = (): string => join(app.getPath('userData'), 'accounts.bin')
let vault: Record<string, string> | null = null

function loadVault(): Record<string, string> {
  if (vault) return vault
  vault = {}
  try {
    if (existsSync(vaultFile()) && safeStorage.isEncryptionAvailable()) {
      vault = JSON.parse(safeStorage.decryptString(readFileSync(vaultFile()))) as Record<string, string>
    }
  } catch { vault = {} }
  return vault
}

function saveVault(): void {
  const v = loadVault()
  if (!Object.keys(v).length) { if (existsSync(vaultFile())) unlinkSync(vaultFile()); return }
  writeFileSync(vaultFile(), safeStorage.encryptString(JSON.stringify(v)))
}

export const getCookie = (userId: number | undefined | null): string | null => (userId ? loadVault()[String(userId)] ?? null : null)
export const hasCookie = (userId: number): boolean => !!getCookie(userId)

const ALLOWED = /^https:\/\/([a-z0-9-]+\.)*(roblox\.com|rbxcdn\.com|arkoselabs\.com|funcaptcha\.com|hcaptcha\.com|roblox\.qq\.com)(\/|$)/i

/** Zapytanie do API Roblox z sesją użytkownika (obsługuje token CSRF) */
export async function authed(url: string, cookie: string, init: RequestInit = {}): Promise<Response> {
  if (!/^https:\/\/([a-z0-9-]+\.)*roblox\.com\//i.test(url)) throw new Error(L('Niedozwolony adres'))
  const headers = (csrf?: string): Record<string, string> => ({
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
    Cookie: `.ROBLOSECURITY=${cookie}`,
    ...(csrf ? { 'x-csrf-token': csrf } : {})
  })
  let res = await fetch(url, { ...init, headers: headers() })
  const csrf = res.headers.get('x-csrf-token')
  if (res.status === 403 && csrf) res = await fetch(url, { ...init, headers: headers(csrf) })
  return res
}

async function whoAmI(cookie: string): Promise<{ id: number; name: string; displayName: string }> {
  const res = await authed('https://users.roblox.com/v1/users/authenticated', cookie)
  if (res.status === 401) throw new Error(L('Sesja konta wygasła – zaloguj się ponownie w Ustawienia → Konto'))
  if (!res.ok) throw new Error(L('Roblox zwrócił błąd {0}', [res.status]))
  return res.json() as Promise<{ id: number; name: string; displayName: string }>
}

let loginWin: BrowserWindow | null = null

export function cancelLogin(): void { loginWin?.close() }

export function loginWithRoblox(parent: BrowserWindow | null): Promise<Account> {
  if (!safeStorage.isEncryptionAvailable()) return Promise.reject(new Error(L('Szyfrowanie Windows jest niedostępne – nie mogę bezpiecznie zapisać sesji')))
  cancelLogin()
  const partition = `rbx-login-${randomUUID()}` // tymczasowa sesja, bez zapisu na dysku
  const ses = session.fromPartition(partition)
  ses.setUserAgent(session.defaultSession.getUserAgent().replace(/\s(Electron|NovaBlox|novablox-launcher)\/\S+/gi, ''))

  return new Promise<Account>((resolve, reject) => {
    let done = false
    const w = new BrowserWindow({
      width: 500, height: 760, parent: parent ?? undefined, modal: !!parent, autoHideMenuBar: true,
      title: L('Logowanie Roblox'), backgroundColor: '#ffffff',
      webPreferences: { partition, contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    loginWin = w

    w.webContents.setWindowOpenHandler(({ url }) => {
      if (ALLOWED.test(url)) void w.loadURL(url)
      return { action: 'deny' }
    })
    w.webContents.on('will-navigate', (e, url) => { if (!ALLOWED.test(url)) e.preventDefault() })

    const finish = async (cookie: string): Promise<void> => {
      if (done) return
      done = true
      try {
        const me = await whoAmI(cookie)
        loadVault()[String(me.id)] = cookie
        saveVault()
        resolve({ mode: 'cookie', userId: me.id, username: me.name, displayName: me.displayName, connectedAt: Date.now() })
      } catch (e) {
        reject(e)
      } finally {
        // Czyścimy tymczasową sesję okna (bez wylogowania – ciasteczko ma działać dalej)
        ses.cookies.removeAllListeners('changed')
        void ses.clearStorageData()
        if (!w.isDestroyed()) w.close()
      }
    }

    ses.cookies.on('changed', (_e, c, _cause, removed) => {
      if (!removed && c.name === '.ROBLOSECURITY' && /roblox\.com$/i.test(c.domain ?? '') && c.value) void finish(c.value)
    })
    w.on('closed', () => {
      loginWin = null
      if (!done) { done = true; reject(new Error(L('Logowanie anulowane'))) }
    })
    void w.loadURL('https://www.roblox.com/login')
  })
}

/** Usuwa konto z launchera i unieważnia jego sesję w Roblox */
export async function removeAccount(userId: number): Promise<void> {
  const cookie = getCookie(userId)
  if (cookie) {
    try { await authed('https://auth.roblox.com/v2/logout', cookie, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }) } catch { /* offline */ }
  }
  delete loadVault()[String(userId)]
  saveVault()
}

export async function validate(userId: number): Promise<boolean> {
  const cookie = getCookie(userId)
  if (!cookie) return false
  try {
    const res = await authed('https://users.roblox.com/v1/users/authenticated', cookie)
    return res.status !== 401
  } catch { return true } // brak sieci ≠ wygasła sesja
}

/** Uruchamia grę na koncie z launchera (jak przycisk „Graj” na roblox.com) */
export async function launchWithAccount(userId: number, placeId: number, jobId: string | null, open: (uri: string) => Promise<void>): Promise<void> {
  const cookie = getCookie(userId)
  if (!cookie) throw new Error(L('Sesja konta wygasła – zaloguj się ponownie w Ustawienia → Konto'))
  const res = await authed('https://auth.roblox.com/v1/authentication-ticket', cookie, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Referer: 'https://www.roblox.com/', RBXAuthenticationNegotiation: '1' },
    body: '{}'
  })
  if (res.status === 401) throw new Error(L('Sesja konta wygasła – zaloguj się ponownie w Ustawienia → Konto'))
  const ticket = res.headers.get('rbx-authentication-ticket')
  if (!ticket) throw new Error(L('Roblox nie wydał biletu logowania ({0})', [res.status]))
  const tracker = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const launcher = jobId
    ? `https://www.roblox.com/Game/PlaceLauncher.ashx?request=RequestGameJob&browserTrackerId=${tracker}&placeId=${placeId}&gameId=${jobId}&isPlayTogetherGame=false&isTeleport=true`
    : `https://www.roblox.com/Game/PlaceLauncher.ashx?request=RequestGame&browserTrackerId=${tracker}&placeId=${placeId}&isPlayTogetherGame=false`
  const uri = `roblox-player:1+launchmode:play+gameinfo:${ticket}+launchtime:${Date.now()}+placelauncherurl:${encodeURIComponent(launcher)}+browsertrackerid:${tracker}+robloxLocale:pl_pl+gameLocale:pl_pl+channel:+LaunchExp:InApp`
  await open(uri)
}
