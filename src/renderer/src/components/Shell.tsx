import { t } from '@/lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell, BellOff, CheckCheck, Clock, Compass, Copy, Gamepad2, Heart, LayoutDashboard, Library, Maximize2,
  Minus, Search, Settings, Trash2, User, WifiOff, X, CircleCheck, AlertTriangle, Info, CircleX, LogIn
} from 'lucide-react'
import clsx from 'clsx'
import type { PageId } from '@shared/types'
import { useApp } from '@/store/app'
import { useProfile } from '@/lib/useProfile'
import { timeAgo } from '@/lib/format'
import { Img, Logo } from './ui'

function Stars(): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  const anim = useApp(s => s.settings.animations)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    let raf = 0
    const resize = (): void => { c.width = window.innerWidth; c.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const stars = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() * .8 + .2, tw: Math.random() * Math.PI * 2 }))
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().split(' ').join(',')
    const draw = (t: number): void => {
      ctx.clearRect(0, 0, c.width, c.height)
      for (const s of stars) {
        if (anim === 'full') { s.y -= 0.00012 * s.z; if (s.y < 0) { s.y = 1; s.x = Math.random() } }
        const a = 0.35 + 0.45 * Math.abs(Math.sin(t / 1400 + s.tw))
        ctx.fillStyle = s.z > .85 ? `rgba(${accent},${a})` : `rgba(255,255,255,${a * s.z})`
        ctx.beginPath(); ctx.arc(s.x * c.width, s.y * c.height, s.z * 1.6, 0, Math.PI * 2); ctx.fill()
      }
      if (anim !== 'off') raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [anim])
  return <canvas ref={ref} className="absolute inset-0" />
}

export function Background(): JSX.Element {
  const img = useApp(s => s.settings.backgroundImage)
  const type = useApp(s => s.settings.backgroundType)
  const animation = useApp(s => s.settings.backgroundAnimation)
  const anim = useApp(s => s.settings.animations)
  return (
    <div className="app-bg">
      {img && type === 'video' && (
        <video key={img} src={img} className="img object-cover" style={{ width: 'calc(100% + 120px)', height: 'calc(100% + 120px)' }}
          autoPlay={anim !== 'off'} loop muted playsInline />
      )}
      {img && type !== 'video' && <div className="img" style={{ backgroundImage: `url("${img}")` }} />}
      {img && <div className="dim" />}
      <div className="grad" />
      {animation === 'aurora' && <div className="bg-aurora"><span /><span /><span /></div>}
      {animation === 'stars' && <Stars />}
      {animation === 'grid' && <div className="bg-grid"><div /></div>}
      <div className="noise" />
    </div>
  )
}

const NAV: { id: PageId; label: string; icon: typeof Compass }[] = [
  { id: 'dashboard', label: t("Dashboard"), icon: LayoutDashboard },
  { id: 'discover', label: t("Discover"), icon: Compass },
  { id: 'library', label: t("My Games"), icon: Library },
  { id: 'favorites', label: t("Favorites"), icon: Heart },
  { id: 'history', label: t("History"), icon: Clock },
  { id: 'profile', label: t("Profile"), icon: User },
  { id: 'settings', label: t("Settings"), icon: Settings }
]

export function Sidebar(): JSX.Element {
  const route = useApp(s => s.route)
  const navigate = useApp(s => s.navigate)
  const libCount = useApp(s => s.library.length)
  const favCount = useApp(s => s.library.filter(g => g.favorite).length)
  const roblox = useApp(s => s.roblox)
  const active = route.page === 'game' ? route.from : route.page
  const counts: Partial<Record<PageId, number>> = { library: libCount, favorites: favCount }

  return (
    <aside className="relative z-10 flex w-[232px] shrink-0 flex-col border-r border-fg/5 bg-bg/40 px-3 pb-4 pt-3 backdrop-blur-xl">
      <div className="label px-3 pb-2 pt-2">{t("Menu")}</div>
      <nav className="flex flex-col gap-1">
        {NAV.map(n => {
          const on = active === n.id
          return (
            <button key={n.id} onClick={() => navigate(n.id)}
              className={clsx('group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors', on ? 'text-fg' : 'text-muted hover:bg-fg/5 hover:text-fg')}>
              {on && (
                <motion.div layoutId="nav-active" transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  className="absolute inset-0 rounded-xl border border-accent/30 bg-gradient-to-r from-accent/25 to-accent2/10">
                  <div className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent-grad shadow-glow" />
                </motion.div>
              )}
              <n.icon size={18} className={clsx('relative transition', on ? 'text-accent' : 'group-hover:text-fg')} />
              <span className="relative flex-1 text-left">{n.label}</span>
              {!!counts[n.id] && <span className="relative rounded-md bg-fg/10 px-1.5 py-0.5 text-[11px] text-muted">{counts[n.id]}</span>}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto">
        <div className="card p-3.5">
          <div className="flex items-center gap-2.5">
            <div className={clsx('relative grid h-9 w-9 place-items-center rounded-xl', roblox?.installed ? 'bg-success/15 text-success' : 'bg-warn/15 text-warn')}>
              <Gamepad2 size={18} />
              <span className={clsx('absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface', roblox?.installed ? 'bg-success' : 'bg-warn')} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{t("Roblox")}</div>
              <div className="truncate text-xs text-muted">{roblox == null ? t("Sprawdzam…") : roblox.installed ? t("Gotowy do gry") : t("Nie zainstalowano")}</div>
            </div>
          </div>
          {roblox && !roblox.installed && (
            <button className="btn-secondary mt-3 h-8 w-full text-xs" onClick={() => window.nova.system.openExternal('https://www.roblox.com/download')}>{t("Pobierz Roblox")}</button>
          )}
        </div>
      </div>
    </aside>
  )
}

function NotificationsPanel({ onClose }: { onClose(): void }): JSX.Element {
  const items = useApp(s => s.notifications)
  const clear = useApp(s => s.clearNotifications)
  const markRead = useApp(s => s.markNotificationsRead)
  const enabled = useApp(s => s.settings.notifications.enabled)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = setTimeout(markRead, 1200)
    const onDoc = (e: MouseEvent): void => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', onDoc)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDoc) }
  }, [markRead, onClose])
  const icon = { success: CircleCheck, warning: AlertTriangle, info: Info, error: CircleX }
  const tone = { success: 'text-success', warning: 'text-warn', info: 'text-accent', error: 'text-danger' }
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: -8, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: .97 }}
      transition={{ duration: .16 }}
      className="panel no-drag absolute right-0 top-12 z-50 w-[380px] overflow-hidden rounded-2xl shadow-card">
      <div className="flex items-center justify-between border-b border-fg/5 px-4 py-3">
        <div className="font-semibold">{t("Powiadomienia")}</div>
        <div className="flex gap-1">
          <button className="btn-ghost h-8 px-2 text-xs" onClick={markRead} title={t("Oznacz jako przeczytane")}><CheckCheck size={14} /></button>
          <button className="btn-ghost h-8 px-2 text-xs" onClick={clear} disabled={!items.length} title={t("Wyczyść")}><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="scroll max-h-[420px]">
        {!enabled && <div className="flex items-center gap-2 bg-warn/10 px-4 py-2 text-xs text-warn"><BellOff size={13} /> {t("Powiadomienia są wyłączone w ustawieniach")}</div>}
        {items.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted"><Bell className="mx-auto mb-3 opacity-40" size={28} />{t("Brak powiadomień")}</div>
        ) : items.map(n => {
          const I = icon[n.kind]
          return (
            <div key={n.id} className={clsx('flex gap-3 border-b border-fg/5 px-4 py-3', !n.read && 'bg-accent/5')}>
              <I size={18} className={clsx('mt-0.5 shrink-0', tone[n.kind])} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{n.title}</div>
                <div className="text-sm text-muted">{n.body}</div>
                <div className="mt-1 text-[11px] text-muted/70">{timeAgo(n.at)}</div>
              </div>
              {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

export function TitleBar(): JSX.Element {
  const [q, setQ] = useState('')
  const [bell, setBell] = useState(false)
  const [max, setMax] = useState(false)
  const unread = useApp(s => s.notifications.filter(n => !n.read).length)
  const account = useApp(s => s.account)
  const navigate = useApp(s => s.navigate)
  const setSearch = useApp(s => s.setSearch)
  const { profile } = useProfile(account?.userId)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => window.nova.window.onMaximizeChange(setMax), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault(); inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submit = (): void => {
    if (!q.trim()) return
    setSearch(q.trim())
    navigate('discover')
    useApp.setState({ route: { page: 'discover' } })
  }

  return (
    <header className="drag relative z-20 flex h-16 shrink-0 items-center gap-4 border-b border-fg/5 bg-bg/50 pl-5 backdrop-blur-xl">
      <div className="flex w-[200px] items-center gap-2.5">
        <Logo size={30} />
        <div className="leading-none">
          <div className="h-display text-[17px] tracking-wide">{t("NOVA")}<span className="text-grad">{t("BLOX")}</span></div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[.2em] text-muted">{t("Launcher")}</div>
        </div>
      </div>

      <div className="no-drag relative w-full max-w-[480px]">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder={t("Szukaj gier na Roblox…")} className="input h-10 pl-10 pr-16" />
        {q ? (
          <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"><X size={15} /></button>
        ) : (
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-fg/10 px-1.5 py-0.5 text-[10px] text-muted">{t("Ctrl K")}</kbd>
        )}
      </div>

      <div className="flex-1" />

      <div className="no-drag relative flex items-center gap-2">
        <button onClick={() => setBell(b => !b)} className={clsx('btn-icon btn-ghost relative', bell && 'bg-fg/10 text-fg')} title={t("Powiadomienia")}>
          <Bell size={18} />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent-grad px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
        </button>
        <AnimatePresence>{bell && <NotificationsPanel onClose={() => setBell(false)} />}</AnimatePresence>

        <button onClick={() => navigate('profile')} title={account ? `@${account.username}` : t("Połącz konto Roblox")}
          className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-3 transition hover:bg-fg/5">
          {account ? (
            <Img src={profile?.headshotUrl} className="h-9 w-9 rounded-xl ring-2 ring-accent/50" fallback={<User size={16} />} />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-fg/10"><LogIn size={16} /></div>
          )}
          <div className="max-w-[130px] text-left leading-tight">
            <div className="truncate text-sm font-semibold">{account ? account.displayName : t("Gość")}</div>
            <div className="truncate text-[11px] text-muted">{account ? `@${account.username}` : t("Zaloguj się")}</div>
          </div>
        </button>
      </div>

      <div className="no-drag flex h-full items-stretch border-l border-fg/5">
        <button onClick={() => window.nova.window.minimize()} className="grid w-12 place-items-center text-muted transition hover:bg-fg/5 hover:text-fg" title={t("Minimalizuj")}><Minus size={16} /></button>
        <button onClick={() => window.nova.window.toggleMaximize()} className="grid w-12 place-items-center text-muted transition hover:bg-fg/5 hover:text-fg" title={max ? t("Przywróć") : t("Maksymalizuj")}>{max ? <Copy size={13} /> : <Maximize2 size={14} />}</button>
        <button onClick={() => window.nova.window.close()} className="grid w-12 place-items-center text-muted transition hover:bg-danger hover:text-white" title={t("Zamknij")}><X size={17} /></button>
      </div>
    </header>
  )
}

export function OfflineBanner(): JSX.Element {
  const online = useApp(s => s.online)
  return (
    <AnimatePresence>
      {!online && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          className="relative z-10 overflow-hidden border-b border-warn/20 bg-warn/10">
          <div className="flex items-center gap-2.5 px-6 py-2 text-sm text-warn">
            <WifiOff size={15} />
            <span className="font-semibold">{t("Brak połączenia z internetem.")}</span>
            <span className="text-warn/80">{t("Wyświetlam zapisane dane – odkrywanie gier i profile wrócą po odzyskaniu połączenia.")}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
