import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import type { PersistedState, Settings } from '@shared/types'

// Lokalne dane launchera trzymamy w jednym pliku JSON (zapis atomowy).
// Dane są małe (biblioteka, historia, ustawienia), więc SQLite byłby tu zbędnym
// natywnym modułem utrudniającym budowanie. Sekrety (tokeny) są w osobnym,
// zaszyfrowanym pliku – patrz auth.ts.

export const DEFAULT_SETTINGS: Settings = {
  theme: 'nova',
  accent: null,
  accent2: null,
  backgroundImage: null,
  backgroundType: 'image',
  backgroundAnimation: 'none',
  backgroundBlur: 24,
  backgroundDim: 70,
  cardStyle: 'glass',
  cardSize: 'default',
  animations: 'full',
  effects: { glow: true, gradients: true, noise: true },
  notifications: { enabled: true, onLaunch: true, onUpdate: true, system: true, onGameUpdate: true, onFriendOnline: false },
  language: 'pl',
  discord: { enabled: false, clientId: '', showIdle: false, showButton: true },
  autoStart: false,
  startMinimized: false,
  minimizeOnLaunch: false,
  multiInstance: false,
  lastPage: 'dashboard'
}

export const DEFAULT_STATE: PersistedState = {
  settings: DEFAULT_SETTINGS,
  library: [],
  history: [],
  activity: [],
  notifications: [],
  account: null,
  accounts: [],
  oauthClientId: '',
  onboarded: false,
  playtime: [],
  mods: { enabled: false, files: {} }
}

const file = (): string => join(app.getPath('userData'), 'novablox-state.json')
let cache: PersistedState | null = null

export function loadState(): PersistedState {
  if (cache) return cache
  try {
    if (existsSync(file())) {
      const raw = JSON.parse(readFileSync(file(), 'utf8')) as Partial<PersistedState>
      cache = {
        ...DEFAULT_STATE,
        ...raw,
        settings: {
          ...DEFAULT_SETTINGS,
          ...(raw.settings ?? {}),
          effects: { ...DEFAULT_SETTINGS.effects, ...(raw.settings?.effects ?? {}) },
          notifications: { ...DEFAULT_SETTINGS.notifications, ...(raw.settings?.notifications ?? {}) },
          discord: { ...DEFAULT_SETTINGS.discord, ...(raw.settings?.discord ?? {}) }
        },
        mods: { ...DEFAULT_STATE.mods, ...(raw.mods ?? {}) },
        // migracja z 1.0/1.1: jedno konto -> lista kont
        accounts: raw.accounts ?? (raw.account ? [raw.account] : [])
      }
      return cache
    }
  } catch (err) {
    console.error('Uszkodzony plik stanu, używam domyślnych', err)
    try { renameSync(file(), file() + '.broken') } catch { /* ignoruj */ }
  }
  cache = structuredClone(DEFAULT_STATE)
  return cache
}

export function patchState(partial: Partial<PersistedState>): void {
  const next = { ...loadState(), ...partial }
  cache = next
  mkdirSync(app.getPath('userData'), { recursive: true })
  const tmp = file() + '.tmp'
  writeFileSync(tmp, JSON.stringify(next))
  renameSync(tmp, file())
}
