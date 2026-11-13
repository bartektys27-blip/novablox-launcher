import { L } from './i18n'
import { app, safeStorage, shell } from 'electron'
import { createHash, randomBytes } from 'crypto'
import { createServer, type Server } from 'http'
import { join } from 'path'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import type { Account } from '@shared/types'
import { lookupUsername } from './roblox-api'

// Logowanie przez oficjalne Roblox OAuth 2.0 (authorization code + PKCE).
// Launcher NIGDY nie widzi hasła – użytkownik loguje się na stronie roblox.com
// w swojej przeglądarce, a my dostajemy tylko token z zakresami openid+profile.
// Tokeny są szyfrowane przez safeStorage (Windows DPAPI) i nie trafiają do
// zwykłego pliku z danymi.

export const OAUTH_PORT = 47823
export const REDIRECT_URI = `http://localhost:${OAUTH_PORT}/oauth/callback`
const AUTHORIZE = 'https://apis.roblox.com/oauth/v1/authorize'
const TOKEN = 'https://apis.roblox.com/oauth/v1/token'
const REVOKE = 'https://apis.roblox.com/oauth/v1/token/revoke'
const USERINFO = 'https://apis.roblox.com/oauth/v1/userinfo'

interface Tokens { clientId: string; accessToken: string; refreshToken: string; expiresAt: number }

const secureFile = (): string => join(app.getPath('userData'), 'session.bin')
let memoryTokens: Tokens | null = null
let pending: { server: Server; reject: (e: Error) => void } | null = null

const b64url = (buf: Buffer): string => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function saveTokens(t: Tokens | null): void {
  memoryTokens = t
  if (!t) { if (existsSync(secureFile())) unlinkSync(secureFile()); return }
  if (!safeStorage.isEncryptionAvailable()) return // tylko w pamięci, nic na dysku
  writeFileSync(secureFile(), safeStorage.encryptString(JSON.stringify(t)))
}

function loadTokens(): Tokens | null {
  if (memoryTokens) return memoryTokens
  try {
    if (existsSync(secureFile()) && safeStorage.isEncryptionAvailable()) {
      memoryTokens = JSON.parse(safeStorage.decryptString(readFileSync(secureFile()))) as Tokens
    }
  } catch { memoryTokens = null }
  return memoryTokens
}

export function hasSecureSession(): boolean { return !!loadTokens() }

async function tokenRequest(body: Record<string, string>): Promise<Tokens & { raw: Record<string, unknown> }> {
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString()
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new Error(L("Roblox odrzucił logowanie: {0}", [json.error_description ?? json.error ?? res.status]))
  return {
    clientId: body.client_id,
    accessToken: String(json.access_token),
    refreshToken: String(json.refresh_token ?? ''),
    expiresAt: Date.now() + Number(json.expires_in ?? 900) * 1000,
    raw: json
  }
}

async function userInfo(accessToken: string): Promise<{ sub: string; preferred_username?: string; name?: string; nickname?: string }> {
  const res = await fetch(USERINFO, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(L("Nie udało się pobrać profilu ({0})", [res.status]))
  return res.json() as Promise<{ sub: string; preferred_username?: string; name?: string; nickname?: string }>
}

const page = (title: string, text: string, ok: boolean): string => `<!doctype html><html lang="pl"><meta charset="utf-8"><title>NovaBlox</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#0a0a10;color:#eef;font-family:Segoe UI,sans-serif">
<div style="text-align:center;padding:40px 56px;border-radius:24px;background:#14141f;border:1px solid #2a2a3d;box-shadow:0 0 60px ${ok ? '#7c3aed55' : '#f43f5e44'}">
<div style="font-size:44px">${ok ? '✓' : '✕'}</div><h2 style="margin:8px 0">${title}</h2><p style="color:#9aa0c3">${text}</p></div></body></html>`

export function cancelOAuth(): void {
  if (pending) {
    pending.reject(new Error(L("Logowanie anulowane")))
    pending.server.close()
    pending = null
  }
}

export async function loginOAuth(clientId: string): Promise<Account> {
  const id = clientId.trim()
  if (!/^\d{6,}$/.test(id)) throw new Error(L("Podaj poprawny Client ID aplikacji OAuth z Roblox Creator Dashboard"))
  cancelOAuth()

  const verifier = b64url(randomBytes(48))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const state = b64url(randomBytes(24))

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', REDIRECT_URI)
      if (url.pathname !== '/oauth/callback') { res.writeHead(404).end(); return }
      const err = url.searchParams.get('error')
      const got = url.searchParams.get('code')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      if (err || !got || url.searchParams.get('state') !== state) {
        res.end(page(L("Logowanie nieudane"), err === 'access_denied' ? L("Odmówiono dostępu.") : L("Spróbuj ponownie w launcherze."), false))
        finish(); reject(new Error(err === 'access_denied' ? L("Odmówiono dostępu do konta") : L("Nieprawidłowa odpowiedź logowania")))
        return
      }
      res.end(page(L("Połączono z Roblox"), L("Możesz zamknąć tę kartę i wrócić do NovaBlox."), true))
      finish(); resolve(got)
    })
    const timer = setTimeout(() => { finish(); reject(new Error(L("Logowanie wygasło (5 minut)"))) }, 5 * 60_000)
    const finish = (): void => { clearTimeout(timer); server.close(); pending = null }
    server.on('error', e => { finish(); reject(new Error(L("Nie można otworzyć portu {0}: {1}", [OAUTH_PORT, (e as Error).message]))) })
    server.listen(OAUTH_PORT, () => {
      pending = { server, reject: e => { clearTimeout(timer); reject(e) } }
      const url = new URL(AUTHORIZE)
      url.search = new URLSearchParams({
        client_id: id,
        redirect_uri: REDIRECT_URI,
        scope: 'openid profile',
        response_type: 'code',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state
      }).toString()
      void shell.openExternal(url.toString())
    })
  })

  const tokens = await tokenRequest({ grant_type: 'authorization_code', code, client_id: id, code_verifier: verifier })
  const info = await userInfo(tokens.accessToken)
  saveTokens({ clientId: id, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt })
  return {
    mode: 'oauth',
    userId: Number(info.sub),
    username: info.preferred_username ?? info.name ?? String(info.sub),
    displayName: info.nickname ?? info.name ?? info.preferred_username ?? String(info.sub),
    connectedAt: Date.now()
  }
}

// Przy starcie: odświeża token. Zwraca false, gdy sesja wygasła/została cofnięta.
export async function refreshSession(): Promise<boolean> {
  const t = loadTokens()
  if (!t) return false
  if (t.expiresAt - Date.now() > 60_000) return true
  if (!t.refreshToken) { saveTokens(null); return false }
  try {
    const n = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refreshToken, client_id: t.clientId })
    saveTokens({ clientId: t.clientId, accessToken: n.accessToken, refreshToken: n.refreshToken || t.refreshToken, expiresAt: n.expiresAt })
    return true
  } catch (e) {
    // Brak sieci – zostawiamy sesję; odrzucony token – czyścimy
    if (String((e as Error).message).includes('odrzucił')) { saveTokens(null); return false }
    return true
  }
}

export async function connectUsername(username: string): Promise<Account> {
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username.trim())) throw new Error(L("Nazwa użytkownika Roblox ma 3–20 znaków: litery, cyfry i _"))
  const u = await lookupUsername(username)
  return { mode: 'public', userId: u.id, username: u.name, displayName: u.displayName, connectedAt: Date.now() }
}

export async function logout(): Promise<void> {
  const t = loadTokens()
  if (t?.refreshToken) {
    try {
      await fetch(REVOKE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: t.refreshToken, client_id: t.clientId }).toString()
      })
    } catch { /* offline – token i tak usuwamy lokalnie */ }
  }
  saveTokens(null)
}
