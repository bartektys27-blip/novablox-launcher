import { app, dialog, type BrowserWindow } from 'electron'
import { basename, extname, join, relative, dirname } from 'path'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'fs'
import type { ModSlot, ModStatus } from '@shared/types'
import { loadState } from './store'
import { L } from './i18n'

// Mody Roblox: własna czcionka i dźwięki. Pliki kopiujemy do folderu wersji
// Roblox (content/...). Oryginały trafiają do kopii zapasowej, więc wszystko
// można przywrócić. Roblox nadpisuje pliki przy aktualizacji – dlatego mody
// są nakładane ponownie przed każdym uruchomieniem gry.

const SOUND_TARGETS: Record<Exclude<ModSlot, 'font'>, string> = {
  death: 'content/sounds/ouch.ogg',
  jump: 'content/sounds/action_jump.mp3',
  land: 'content/sounds/action_jump_land.mp3',
  footsteps: 'content/sounds/action_footsteps_plastic.mp3'
}
const FONT_NAME = 'NovaBloxFont'

const modsDir = (): string => join(app.getPath('userData'), 'mods')
const backupRoot = (): string => join(modsDir(), 'backup')
let lastError: string | null = null

export function robloxVersionDirs(): string[] {
  const local = process.env.LOCALAPPDATA || ''
  const roots = [
    process.env.NOVABLOX_ROBLOX_VERSIONS || '',
    join(local, 'Roblox', 'Versions'),
    'C:\\Program Files (x86)\\Roblox\\Versions',
    'C:\\Program Files\\Roblox\\Versions'
  ].filter(Boolean)
  const out: string[] = []
  for (const root of roots) {
    let entries: string[] = []
    try { entries = readdirSync(root) } catch { continue }
    for (const name of entries) {
      const dir = join(root, name)
      try { if (statSync(dir).isDirectory() && existsSync(join(dir, 'RobloxPlayerBeta.exe'))) out.push(dir) } catch { /* pomiń */ }
    }
  }
  return out
}

function modFile(slot: ModSlot): string | null {
  try {
    const f = readdirSync(modsDir()).find(n => n.startsWith(slot + '.'))
    return f ? join(modsDir(), f) : null
  } catch { return null }
}

export async function pickFile(win: BrowserWindow | null, slot: ModSlot): Promise<string | null> {
  const isFont = slot === 'font'
  const res = await dialog.showOpenDialog(win!, {
    title: isFont ? L('Wybierz czcionkę') : L('Wybierz dźwięk'),
    properties: ['openFile'],
    filters: isFont ? [{ name: L('Czcionki'), extensions: ['ttf', 'otf'] }] : [{ name: L('Dźwięki'), extensions: ['ogg', 'mp3', 'wav'] }]
  })
  const src = res.filePaths[0]
  if (res.canceled || !src) return null
  if (statSync(src).size > 20 * 1024 * 1024) throw new Error(L('Plik jest za duży (maks. 20 MB)'))
  mkdirSync(modsDir(), { recursive: true })
  const old = modFile(slot)
  if (old) unlinkSync(old)
  copyFileSync(src, join(modsDir(), slot + extname(src).toLowerCase()))
  return basename(src)
}

export function removeFile(slot: ModSlot): void {
  const f = modFile(slot)
  if (f) unlinkSync(f)
}

/** Kopia oryginału (tylko raz na wersję) */
function backup(versionDir: string, rel: string): void {
  const src = join(versionDir, rel)
  const dst = join(backupRoot(), basename(versionDir), rel)
  if (existsSync(src) && !existsSync(dst)) {
    mkdirSync(dirname(dst), { recursive: true })
    copyFileSync(src, dst)
  }
}

function restoreOne(versionDir: string, rel: string): void {
  const b = join(backupRoot(), basename(versionDir), rel)
  if (existsSync(b)) copyFileSync(b, join(versionDir, rel))
}

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

function restoreVersion(versionDir: string): void {
  const b = join(backupRoot(), basename(versionDir))
  if (existsSync(b)) for (const f of walk(b)) copyFileSync(f, join(versionDir, relative(b, f)))
  const fontsDir = join(versionDir, 'content', 'fonts')
  try { for (const n of readdirSync(fontsDir)) if (n.startsWith(FONT_NAME)) unlinkSync(join(fontsDir, n)) } catch { /* brak */ }
}

function applyVersion(versionDir: string, files: Partial<Record<ModSlot, string>>): void {
  for (const [slot, rel] of Object.entries(SOUND_TARGETS) as [ModSlot, string][]) {
    const f = files[slot] ? modFile(slot) : null
    if (f) {
      backup(versionDir, rel)
      mkdirSync(dirname(join(versionDir, rel)), { recursive: true })
      copyFileSync(f, join(versionDir, rel))
    } else restoreOne(versionDir, rel)
  }

  const familiesDir = join(versionDir, 'content', 'fonts', 'families')
  const families = existsSync(familiesDir) ? readdirSync(familiesDir).filter(n => n.endsWith('.json')) : []
  const font = files.font ? modFile('font') : null
  if (font) {
    const name = FONT_NAME + extname(font)
    copyFileSync(font, join(versionDir, 'content', 'fonts', name))
    for (const fam of families) {
      const rel = join('content', 'fonts', 'families', fam)
      backup(versionDir, rel)
      // Zawsze zaczynamy od oryginału, żeby nie nawarstwiać zmian
      const original = join(backupRoot(), basename(versionDir), rel)
      const json = JSON.parse(readFileSync(existsSync(original) ? original : join(versionDir, rel), 'utf8')) as { faces?: { assetId?: string }[] }
      for (const face of json.faces ?? []) face.assetId = `rbxasset://fonts/${name}`
      writeFileSync(join(versionDir, rel), JSON.stringify(json, null, 2))
    }
  } else {
    for (const fam of families) restoreOne(versionDir, join('content', 'fonts', 'families', fam))
  }
}

export function status(): ModStatus {
  const st = loadState().mods
  const dirs = robloxVersionDirs()
  return { robloxFound: dirs.length > 0, versions: dirs.length, applied: st.enabled && Object.values(st.files).some(Boolean), lastError }
}

export function apply(): ModStatus {
  const st = loadState().mods
  lastError = null
  const dirs = robloxVersionDirs()
  try {
    for (const d of dirs) {
      if (st.enabled) applyVersion(d, st.files)
      else restoreVersion(d)
    }
  } catch (e) {
    lastError = (e as Error).message
    throw new Error(L('Nie udało się nałożyć modów: {0}', [(e as Error).message]))
  }
  return status()
}

export function restore(): ModStatus {
  lastError = null
  for (const d of robloxVersionDirs()) restoreVersion(d)
  try { rmSync(backupRoot(), { recursive: true, force: true }) } catch { /* ignoruj */ }
  return status()
}

/** Wywoływane przed uruchomieniem gry – błąd modów nie blokuje gry */
export function applyBeforeLaunch(): void {
  if (!loadState().mods.enabled) return
  try { apply() } catch { /* lastError zapisany */ }
}
