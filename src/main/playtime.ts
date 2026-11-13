import { execFile } from 'child_process'
import { existsSync } from 'fs'
import type { PlaySession, PlaytimeStatus } from '@shared/types'

// Licznik czasu gry: co 5 s sprawdzamy, czy działa proces RobloxPlayerBeta.exe.
// Sesję przypisujemy do gry uruchomionej ostatnio z launchera (jeśli Roblox
// wystartował niedługo po kliknięciu PLAY).

type Game = NonNullable<PlaytimeStatus['game']>
type Emit = (e: { type: 'status'; status: PlaytimeStatus } | { type: 'session'; session: PlaySession }) => void

const POLL_MS = 5000
const ATTRIBUTION_MS = 3 * 60_000
const MIN_SESSION_MS = 30_000

let pending: { game: Game; at: number } | null = null
let current: { since: number; game: Game | null } | null = null
let timer: ReturnType<typeof setInterval> | null = null

function isRobloxRunning(): Promise<boolean> {
  // Hak testowy (tylko automatyczne testy): obecność pliku = Roblox działa
  const fake = process.env.NOVABLOX_TEST_ROBLOX_RUNNING_FILE
  if (fake) return Promise.resolve(existsSync(fake))
  if (process.platform !== 'win32') return Promise.resolve(false)
  return new Promise(resolve => {
    execFile('tasklist', ['/FI', 'IMAGENAME eq RobloxPlayerBeta.exe', '/NH', '/FO', 'CSV'], { windowsHide: true }, (err, out) => {
      resolve(!err && /robloxplayerbeta\.exe/i.test(out))
    })
  })
}

export function notePendingLaunch(game: Game): void {
  pending = { game, at: Date.now() }
  // Gra uruchomiona z launchera, gdy Roblox już działa – przełącz przypisanie
  if (current && Date.now() - current.since > 5000) current.game = game
}

export function status(): PlaytimeStatus {
  return { running: !!current, since: current?.since ?? null, game: current?.game ?? null }
}

export function startTracking(emit: Emit): void {
  if (timer) return
  const tick = async (): Promise<void> => {
    const running = await isRobloxRunning()
    if (running && !current) {
      const game = pending && Date.now() - pending.at < ATTRIBUTION_MS ? pending.game : null
      current = { since: Date.now(), game }
      pending = null
      emit({ type: 'status', status: status() })
    } else if (!running && current) {
      const end = Date.now()
      if (end - current.since >= MIN_SESSION_MS) {
        const g = current.game
        emit({
          type: 'session',
          session: {
            id: Math.random().toString(36).slice(2) + end.toString(36),
            universeId: g?.universeId ?? 0,
            placeId: g?.placeId ?? 0,
            name: g?.name ?? '',
            iconUrl: g?.iconUrl ?? null,
            start: current.since,
            end
          }
        })
      }
      current = null
      emit({ type: 'status', status: status() })
    }
  }
  void tick()
  timer = setInterval(() => void tick(), POLL_MS)
}

/** Zapisz trwającą sesję przy zamykaniu launchera */
export function flush(emitSession: (s: PlaySession) => void): void {
  if (!current) return
  const end = Date.now()
  if (end - current.since >= MIN_SESSION_MS) {
    const g = current.game
    emitSession({ id: 'f' + end.toString(36), universeId: g?.universeId ?? 0, placeId: g?.placeId ?? 0, name: g?.name ?? '', iconUrl: g?.iconUrl ?? null, start: current.since, end })
  }
  current = null
}
