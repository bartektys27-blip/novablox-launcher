import { spawn, execFile, type ChildProcess } from 'child_process'

/**
 * Wiele okien Roblox naraz.
 * Roblox przy starcie sprawdza nazwane obiekty systemowe („singleton”) i zamyka
 * poprzednie okno, jeśli już istnieją. Launcher tworzy je jako pierwszy i trzyma
 * w ukrytym procesie PowerShell – wtedy kolejne okna Roblox nie zamykają się nawzajem.
 * Nie modyfikuje plików ani pamięci Roblox.
 */
let holder: ChildProcess | null = null

const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$m = New-Object System.Threading.Mutex($true, 'ROBLOX_singletonMutex')
$e = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::ManualReset, 'ROBLOX_singletonEvent')
Write-Output 'READY'
try { Wait-Process -Id ${'$'}{PARENT} } catch { }
`

export function isActive(): boolean {
  return !!holder && holder.exitCode === null
}

function robloxRunning(): Promise<boolean> {
  if (process.platform !== 'win32') return Promise.resolve(false)
  return new Promise(resolve => {
    execFile('tasklist', ['/FI', 'IMAGENAME eq RobloxPlayerBeta.exe', '/NH', '/FO', 'CSV'], { windowsHide: true }, (err, out) => resolve(!err && /robloxplayerbeta\.exe/i.test(out)))
  })
}

/** Włącza tryb wielu okien. Zwraca false, gdy Roblox już działał (trzeba go zamknąć). */
export async function enable(): Promise<{ ok: boolean; reason?: 'roblox-running' | 'unsupported' }> {
  if (process.platform !== 'win32') return { ok: false, reason: 'unsupported' }
  if (isActive()) return { ok: true }
  if (await robloxRunning()) return { ok: false, reason: 'roblox-running' }
  const script = SCRIPT.replace('${PARENT}', String(process.pid))
  const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
  holder = p
  p.on('exit', () => { if (holder === p) holder = null })
  const ready = await new Promise<boolean>(resolve => {
    const to = setTimeout(() => resolve(false), 8000)
    p.stdout?.on('data', (d: Buffer) => { if (d.toString().includes('READY')) { clearTimeout(to); resolve(true) } })
    p.on('exit', () => { clearTimeout(to); resolve(false) })
  })
  if (!ready) { disable(); return { ok: false, reason: 'unsupported' } }
  return { ok: true }
}

export function disable(): void {
  if (holder && holder.exitCode === null) holder.kill()
  holder = null
}

/** Zamyka wszystkie okna Roblox (po potwierdzeniu użytkownika) i czeka, aż znikną */
export async function closeRoblox(): Promise<void> {
  if (process.platform !== 'win32') return
  await new Promise<void>(resolve => execFile('taskkill', ['/IM', 'RobloxPlayerBeta.exe', '/F'], { windowsHide: true }, () => resolve()))
  for (let i = 0; i < 20 && (await robloxRunning()); i++) await new Promise(r => setTimeout(r, 250))
  await new Promise(r => setTimeout(r, 500))
}
