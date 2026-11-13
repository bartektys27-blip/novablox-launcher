import { connect, type Socket } from 'net'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { DiscordStatus, PlaytimeStatus } from '@shared/types'
import { loadState } from './store'
import { L } from './i18n'

// Minimalny klient Discord RPC (lokalne IPC – named pipe na Windows,
// gniazdo unix na Linux/macOS). Wysyłamy tylko SET_ACTIVITY.
// Protokół: ramka = [opcode u32 LE][długość u32 LE][JSON].

const OP_HANDSHAKE = 0, OP_FRAME = 1, OP_CLOSE = 2

let sock: Socket | null = null
let ready = false
let connectedClientId = ''
let connecting: Promise<void> | null = null
let lastError: string | null = null
let user: string | null = null
let current: PlaytimeStatus = { running: false, since: null, game: null }
let retryTimer: ReturnType<typeof setTimeout> | null = null

function pipePath(i: number): string {
  if (process.platform === 'win32') return `\\\\?\\pipe\\discord-ipc-${i}`
  const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || '/tmp'
  return join(base, `discord-ipc-${i}`)
}

function encode(op: number, data: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(data))
  const head = Buffer.alloc(8)
  head.writeUInt32LE(op, 0)
  head.writeUInt32LE(json.length, 4)
  return Buffer.concat([head, json])
}

function tryPipe(i: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connect(pipePath(i))
    s.once('connect', () => resolve(s))
    s.once('error', reject)
  })
}

function disconnect(): void {
  ready = false
  connectedClientId = ''
  user = null
  if (sock) { sock.removeAllListeners(); sock.destroy() }
  sock = null
}

async function ensureConnected(clientId: string): Promise<void> {
  if (ready && connectedClientId === clientId) return
  if (connecting) return connecting
  disconnect()
  connecting = (async () => {
    let s: Socket | null = null
    for (let i = 0; i < 10 && !s; i++) { try { s = await tryPipe(i) } catch { /* następny */ } }
    if (!s) throw new Error(L('Discord nie jest uruchomiony'))
    sock = s
    await new Promise<void>((resolve, reject) => {
      let buf = Buffer.alloc(0)
      const timer = setTimeout(() => reject(new Error(L('Discord nie odpowiada'))), 5000)
      s!.on('data', chunk => {
        buf = Buffer.concat([buf, chunk])
        while (buf.length >= 8) {
          const op = buf.readUInt32LE(0), len = buf.readUInt32LE(4)
          if (buf.length < 8 + len) break
          const msg = JSON.parse(buf.subarray(8, 8 + len).toString()) as { cmd?: string; evt?: string; data?: { user?: { username?: string; global_name?: string }; message?: string; code?: number } }
          buf = buf.subarray(8 + len)
          if (op === OP_CLOSE) { clearTimeout(timer); lastError = msg.data?.message ?? L('Discord odrzucił połączenie'); disconnect(); reject(new Error(lastError)); return }
          if (msg.evt === 'READY') {
            clearTimeout(timer)
            ready = true
            connectedClientId = clientId
            user = msg.data?.user?.global_name || msg.data?.user?.username || null
            resolve()
          } else if (msg.evt === 'ERROR') {
            lastError = msg.data?.message ?? 'Discord error'
          }
        }
      })
      s!.on('close', () => { disconnect(); scheduleRetry() })
      s!.on('error', () => { /* obsłużone przez close */ })
      s!.write(encode(OP_HANDSHAKE, { v: 1, client_id: clientId }))
    })
  })()
  try { await connecting; lastError = null } finally { connecting = null }
}

function scheduleRetry(): void {
  if (retryTimer) return
  retryTimer = setTimeout(() => { retryTimer = null; void refresh() }, 20_000)
}

function activity(): Record<string, unknown> | null {
  const s = loadState().settings.discord
  const g = current.game
  if (current.running) {
    const hasGame = !!(g && g.name)
    const a: Record<string, unknown> = {
      details: hasGame ? g!.name.slice(0, 120) : L('Gra w Roblox'),
      state: L('przez NovaBlox'),
      timestamps: current.since ? { start: Math.floor(current.since / 1000) } : undefined,
      assets: {
        large_image: hasGame && g!.iconUrl && /^https:\/\//.test(g!.iconUrl) ? g!.iconUrl : undefined,
        large_text: hasGame ? g!.name.slice(0, 120) : 'Roblox'
      },
      instance: false
    }
    if (s.showButton && hasGame && g!.placeId) a.buttons = [{ label: L('Zagraj też'), url: `https://www.roblox.com/games/${g!.placeId}` }]
    return a
  }
  if (s.showIdle) return { details: L('Wybiera grę'), state: L('w NovaBlox'), instance: false }
  return null
}

async function send(): Promise<void> {
  if (!sock || !ready) return
  sock.write(encode(OP_FRAME, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: activity() }, nonce: randomUUID() }))
}

/** Aktualizuje status w Discordzie zgodnie z ustawieniami i bieżącą sesją gry */
export async function refresh(): Promise<void> {
  const s = loadState().settings.discord
  const id = s.clientId.trim()
  if (!s.enabled || !/^\d{15,22}$/.test(id)) { if (sock) { await clearActivity(); disconnect() } return }
  if (!current.running && !s.showIdle) { await clearActivity(); return }
  try {
    await ensureConnected(id)
    await send()
  } catch (e) {
    lastError = (e as Error).message
    scheduleRetry()
  }
}

async function clearActivity(): Promise<void> {
  if (sock && ready) sock.write(encode(OP_FRAME, { cmd: 'SET_ACTIVITY', args: { pid: process.pid }, nonce: randomUUID() }))
}

export function onPlaytime(status: PlaytimeStatus): void {
  current = status
  void refresh()
}

export async function test(): Promise<DiscordStatus> {
  const s = loadState().settings.discord
  if (!/^\d{15,22}$/.test(s.clientId.trim())) throw new Error(L('Podaj poprawny Application ID z Discord Developer Portal'))
  disconnect()
  await ensureConnected(s.clientId.trim())
  // Krótki podgląd, żeby było widać, że działa
  sock!.write(encode(OP_FRAME, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: { details: L('Test połączenia NovaBlox'), state: L('Działa!'), instance: false } }, nonce: randomUUID() }))
  setTimeout(() => void refresh(), 8000)
  return status()
}

export function status(): DiscordStatus {
  return { connected: ready, user, error: lastError }
}

export function shutdown(): void {
  void clearActivity()
  disconnect()
}
