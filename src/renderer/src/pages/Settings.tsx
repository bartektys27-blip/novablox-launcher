import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell, Check, Database, Image as ImageIcon, Info, Loader2, Monitor, Palette, RefreshCw, Rocket, Sparkles, Trash2, User, Wand2,
  ExternalLink, LogOut, ShieldCheck, Github, CircleCheck, AlertTriangle, Layers, Gauge, Zap,
  Languages, Puzzle, Type, Volume2, Upload, Download, Film, Timer, X, UserPlus, MessageCircle, KeyRound
} from 'lucide-react'
import clsx from 'clsx'
import type { Account as AccountT, DiscordStatus, AnimationLevel, AppInfo, BgAnimation, CardSize, CardStyle, Language, ModSlot, ModStatus, UpdateInfo } from '@shared/types'
import { accountModeLabel, locale, setLang, t } from '@/lib/i18n'
import { useApp } from '@/store/app'
import { confirmAction, toast } from '@/store/ui'
import { ACCENT_PRESETS, THEMES, rgbToHex } from '@/lib/themes'
import { bytes } from '@/lib/format'
import { DEFAULT_SETTINGS_UI } from '@/lib/defaults'
import { useProfiles } from '@/lib/useProfile'
import { useDiscover } from '@/lib/useDiscover'
import { Img, Logo, PageHeader, Segmented, Toggle } from '@/components/ui'
import { Modal } from '@/components/Overlays'
import { ConnectAccount } from './Connect'

type Tab = 'general' | 'appearance' | 'mods' | 'discord' | 'account' | 'notifications' | 'data' | 'about'
const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: 'general', label: t("Ogólne"), icon: Monitor },
  { id: 'appearance', label: t("Personalizacja"), icon: Palette },
  { id: 'mods', label: t("Mody Roblox"), icon: Puzzle },
  { id: 'discord', label: t('Discord'), icon: MessageCircle },
  { id: 'account', label: t("Konto"), icon: User },
  { id: 'notifications', label: t("Powiadomienia"), icon: Bell },
  { id: 'data', label: t("Dane i pamięć"), icon: Database },
  { id: 'about', label: t("O aplikacji"), icon: Info }
]

function Row({ title, desc, children }: { title: string; desc?: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-fg/5 py-4 last:border-0">
      <div className="min-w-0"><div className="font-medium">{title}</div>{desc && <div className="mt-0.5 text-sm text-muted">{desc}</div>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Palette; children: ReactNode }): JSX.Element {
  return (
    <div className="card p-6">
      <div className="mb-2 flex items-center gap-2.5"><Icon size={17} className="text-accent" /><h3 className="h-display text-lg">{title}</h3></div>
      {children}
    </div>
  )
}

function General(): JSX.Element {
  const s = useApp(st => st.settings)
  const set = useApp(st => st.setSettings)
  const [busy, setBusy] = useState(false)
  const autostart = async (enabled: boolean, minimized = s.startMinimized): Promise<void> => {
    setBusy(true)
    try {
      const real = await window.nova.system.setAutoStart(enabled, minimized)
      set({ autoStart: real, startMinimized: minimized })
      toast.success(real ? t("Autostart włączony") : t("Autostart wyłączony"))
    } catch (e) { toast.error('Nie udało się zmienić autostartu', (e as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <div className="space-y-5">
      <Card title={t("Język")} icon={Languages}>
        <Row title={t("Język aplikacji")} desc={t("Zmiana języka uruchamia ponownie interfejs.")}>
          <Segmented<Language> id="lang" value={s.language} onChange={async v => {
            if (v === s.language) return
            set({ language: v })
            await window.nova.store.patch({ settings: { ...s, language: v } })
            setLang(v)
            location.reload()
          }} options={[{ value: 'pl', label: t("Polski") }, { value: 'en', label: t("English") }]} />
        </Row>
      </Card>
      <Card title={t("Uruchamianie")} icon={Rocket}>
        <Row title={t("Uruchamiaj NovaBlox razem z Windows")} desc={t("Launcher wystartuje automatycznie po zalogowaniu do systemu.")}>
          <Toggle checked={s.autoStart} disabled={busy} onChange={v => autostart(v)} />
        </Row>
        <Row title={t("Startuj zminimalizowany")} desc={t("Przy autostarcie okno nie będzie się wyskakiwać.")}>
          <Toggle checked={s.startMinimized} disabled={busy || !s.autoStart} onChange={v => autostart(true, v)} />
        </Row>
        <Row title={t("Minimalizuj po uruchomieniu gry")} desc={t("Okno launchera schowa się, gdy odpalisz grę.")}>
          <Toggle checked={s.minimizeOnLaunch} onChange={v => set({ minimizeOnLaunch: v })} />
        </Row>
      </Card>
      <Card title={t("Nawigacja")} icon={Layers}>
        <Row title={t("Pamiętaj ostatnio otwartą sekcję")} desc={t("Po ponownym uruchomieniu wrócisz tam, gdzie skończyłeś. Ostatnia sekcja jest zapisywana automatycznie.")}>
          <span className="inline-flex items-center gap-1.5 text-sm text-success"><Check size={15} />{t("Aktywne")}</span>
        </Row>
        <Row title={t("Skrót wyszukiwania")} desc={t("Naciśnij Ctrl + K albo /, aby od razu szukać gier.")}>
          <kbd className="rounded-lg border border-fg/10 px-2 py-1 text-xs text-muted">{t("Ctrl K")}</kbd>
        </Row>
      </Card>
    </div>
  )
}

function Appearance(): JSX.Element {
  const s = useApp(st => st.settings)
  const set = useApp(st => st.setSettings)
  const theme = THEMES.find(t => t.id === s.theme) ?? THEMES[0]
  const a1 = s.accent ?? rgbToHex(theme.accent)
  const a2 = s.accent2 ?? rgbToHex(theme.accent2)

  const pickBg = async (): Promise<void> => {
    try {
      const bg = await window.nova.system.pickBackground()
      if (bg) { set({ backgroundImage: bg.url, backgroundType: bg.type }); toast.success(bg.type === 'video' ? t('Ustawiono animowane tło') : t('Ustawiono nowe tło')) }
    } catch (e) { toast.error('Nie udało się wczytać pliku', (e as Error).message) }
  }

  return (
    <div className="space-y-5">
      <Card title={t("Motyw")} icon={Palette}>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {THEMES.map(th => {
            const on = th.id === s.theme
            return (
              <motion.button key={th.id} whileHover={{ y: -3 }} onClick={() => set({ theme: th.id, accent: null, accent2: null })}
                className={clsx('relative overflow-hidden rounded-2xl border-2 p-4 text-left transition', on ? 'border-accent' : 'border-transparent')}
                style={{ background: `linear-gradient(140deg, rgb(${th.surface}), rgb(${th.bg}))` }}>
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl" style={{ background: `rgb(${th.accent} / .6)` }} />
                <div className="relative flex gap-1.5">
                  {[th.accent, th.accent2, th.elevated].map(c => <span key={c} className="h-5 w-5 rounded-full ring-1 ring-white/10" style={{ background: `rgb(${c})` }} />)}
                </div>
                <div className="relative mt-6 font-display text-lg font-bold" style={{ color: `rgb(${th.fg})` }}>{th.name}</div>
                <div className="relative text-xs" style={{ color: `rgb(${th.muted})` }}>{t(th.desc)}</div>
                {on && <div className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-accent-grad text-white"><Check size={14} /></div>}
              </motion.button>
            )
          })}
        </div>
      </Card>

      <Card title={t("Kolory akcentu")} icon={Wand2}>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {ACCENT_PRESETS.map(([c1, c2]) => {
            const on = s.accent === c1 && s.accent2 === c2
            return (
              <button key={c1 + c2} onClick={() => set({ accent: c1, accent2: c2 })} title={`${c1} → ${c2}`}
                className={clsx('relative h-11 w-11 rounded-xl transition hover:scale-110', on && 'ring-2 ring-white ring-offset-2 ring-offset-bg')}
                style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                {on && <Check size={16} className="absolute inset-0 m-auto text-white" />}
              </button>
            )
          })}
        </div>
        <Row title={t("Kolor główny")} desc={t("Przyciski, aktywne elementy, poświata.")}>
          <label className="flex cursor-pointer items-center gap-2"><span className="font-mono text-xs text-muted">{a1}</span>
            <input type="color" value={a1} onChange={e => set({ accent: e.target.value, accent2: a2 })} className="h-9 w-12 cursor-pointer rounded-lg border border-fg/10 bg-transparent" /></label>
        </Row>
        <Row title={t("Kolor dodatkowy")} desc={t("Drugi kolor gradientów.")}>
          <label className="flex cursor-pointer items-center gap-2"><span className="font-mono text-xs text-muted">{a2}</span>
            <input type="color" value={a2} onChange={e => set({ accent: a1, accent2: e.target.value })} className="h-9 w-12 cursor-pointer rounded-lg border border-fg/10 bg-transparent" /></label>
        </Row>
        <Row title={t("Kolory motywu")} desc={t("Wróć do kolorów wybranego motywu.")}><button className="btn-secondary h-9" disabled={!s.accent && !s.accent2} onClick={() => set({ accent: null, accent2: null })}>{t("Przywróć")}</button></Row>
      </Card>

      <Card title={t("Animowane tło")} icon={Film}>
        <Row title={t("Efekt w tle")} desc={t("Animacja nakładana na tło aplikacji.")}>
          <Segmented<BgAnimation> id="bganim" value={s.backgroundAnimation} onChange={v => set({ backgroundAnimation: v })} options={[{ value: 'none', label: t("Brak") }, { value: 'aurora', label: t("Zorza") }, { value: 'stars', label: t("Gwiazdy") }, { value: 'grid', label: t("Siatka neon") }]} />
        </Row>
      </Card>

      <Card title={t("Własne tło")} icon={ImageIcon}>
        <p className="mt-1 text-sm text-muted">{t("Obraz (PNG, JPG, WEBP, GIF) albo wideo (MP4, WEBM) – wideo odtwarza się w pętli bez dźwięku.")}</p>
        <div className="mt-3 flex items-center gap-4">
          <div className="relative h-28 w-48 overflow-hidden rounded-2xl border border-fg/10 bg-fg/5">
            {s.backgroundImage ? (s.backgroundType === 'video'
              ? <video src={s.backgroundImage} className="h-full w-full object-cover" autoPlay loop muted playsInline />
              : <Img src={s.backgroundImage} className="h-full w-full" />) : <div className="grid h-full place-items-center text-xs text-muted">{t("Brak tła")}</div>}
          </div>
          <div className="flex flex-col gap-2">
            <button className="btn-primary" onClick={pickBg}><ImageIcon size={15} /> {t("Wybierz obraz lub wideo…")}</button>
            <button className="btn-secondary" disabled={!s.backgroundImage} onClick={() => set({ backgroundImage: null, backgroundType: 'image' })}><Trash2 size={15} /> {t("Usuń tło")}</button>
          </div>
        </div>
        <Row title={t("Rozmycie tła")} desc={t("{0}px", [s.backgroundBlur])}>
          <input type="range" min={0} max={60} value={s.backgroundBlur} onChange={e => set({ backgroundBlur: +e.target.value })} className="w-56 accent-[rgb(var(--accent))]" />
        </Row>
        <Row title={t("Przyciemnienie tła")} desc={`${s.backgroundDim}%`}>
          <input type="range" min={0} max={95} value={s.backgroundDim} onChange={e => set({ backgroundDim: +e.target.value })} className="w-56 accent-[rgb(var(--accent))]" />
        </Row>
      </Card>

      <Card title={t("Wygląd kart")} icon={Layers}>
        <Row title={t("Styl kart")} desc={t("Szkło z rozmyciem, pełne tło lub sam kontur.")}>
          <Segmented<CardStyle> id="cardstyle" value={s.cardStyle} onChange={v => set({ cardStyle: v })} options={[{ value: 'glass', label: t("Szkło") }, { value: 'solid', label: t("Pełne") }, { value: 'outline', label: t("Kontur") }]} />
        </Row>
        <Row title={t("Rozmiar kart")} desc={t("Ile gier mieści się w jednym rzędzie.")}>
          <Segmented<CardSize> id="cardsize" value={s.cardSize} onChange={v => set({ cardSize: v })} options={[{ value: 'compact', label: t("Małe") }, { value: 'default', label: t("Średnie") }, { value: 'large', label: t("Duże") }]} />
        </Row>
      </Card>

      <Card title={t("Efekty i animacje")} icon={Sparkles}>
        <Row title={t("Animacje")} desc={t("Pełne, ograniczone (bez ruchu) lub wyłączone.")}>
          <Segmented<AnimationLevel> id="anim" value={s.animations} onChange={v => set({ animations: v })} options={[{ value: 'full', label: t("Pełne"), icon: Zap }, { value: 'reduced', label: t("Ograniczone"), icon: Gauge }, { value: 'off', label: t("Wyłączone") }]} />
        </Row>
        <Row title={t("Neonowa poświata")} desc={t("Świecenie kart i przycisków po najechaniu.")}><Toggle checked={s.effects.glow} onChange={v => set({ effects: { ...s.effects, glow: v } })} /></Row>
        <Row title={t("Gradienty tła")} desc={t("Kolorowe światła w tle aplikacji.")}><Toggle checked={s.effects.gradients} onChange={v => set({ effects: { ...s.effects, gradients: v } })} /></Row>
        <Row title={t("Tekstura ziarna")} desc={t("Subtelny szum nadający głębię.")}><Toggle checked={s.effects.noise} onChange={v => set({ effects: { ...s.effects, noise: v } })} /></Row>
        <Row title={t("Przywróć domyślny wygląd")} desc={t("Motyw Nova, bez tła, pełne animacje.")}>
          <button className="btn-secondary h-9" onClick={async () => { if (await confirmAction({ title: t("Przywrócić domyślny wygląd?"), body: t("Motyw, kolory, tło, karty i efekty wrócą do ustawień fabrycznych."), confirmLabel: t("Przywróć") })) { set(DEFAULT_SETTINGS_UI); toast.success(t("Przywrócono domyślny wygląd")) } }}>{t("Przywróć")}</button>
        </Row>
      </Card>
    </div>
  )
}

function AccountRow({ acc, active }: { acc: AccountT; active: boolean }): JSX.Element {
  const profile = useProfiles(s => s.profiles[acc.userId])
  const load = useProfiles(s => s.load)
  const switchAccount = useApp(s => s.switchAccount)
  const removeAccount = useApp(s => s.removeAccount)
  useEffect(() => { void load(acc.userId) }, [acc.userId, load])
  return (
    <div className={clsx('flex items-center gap-4 rounded-2xl p-3 transition', active ? 'bg-accent/10 ring-1 ring-accent/40' : 'bg-fg/[.04] hover:bg-fg/[.07]')}>
      <Img src={profile?.headshotUrl} className="h-12 w-12 rounded-xl" fallback={<User size={18} />} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{acc.displayName}</span>
          {active && <span className="rounded-md bg-accent-grad px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">{t('Aktywne')}</span>}
          {acc.expired && <span className="rounded-md bg-danger/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-danger">{t('Sesja wygasła')}</span>}
        </div>
        <div className="truncate text-xs text-muted">@{acc.username} · {accountModeLabel(acc.mode)}</div>
      </div>
      {!active && <button className="btn-secondary h-9" onClick={() => switchAccount(acc.userId)}>{t('Przełącz')}</button>}
      <button className="btn-ghost h-9 px-2.5 hover:!text-danger" title={t('Usuń konto')} onClick={async () => {
        const body = acc.mode === 'cookie'
          ? t('Konto @{0} zostanie usunięte z launchera, a jego sesja unieważniona w Roblox. Biblioteka, historia i ustawienia pozostaną na tym komputerze.', [acc.username])
          : t('Konto @{0} zostanie usunięte z launchera.', [acc.username])
        if (await confirmAction({ title: t('Usunąć konto?'), body, confirmLabel: t('Usuń'), danger: true })) { await removeAccount(acc.userId); toast.info(t('Usunięto konto'), `@${acc.username}`) }
      }}><Trash2 size={15} /></button>
    </div>
  )
}

function Account(): JSX.Element {
  const account = useApp(s => s.account)
  const accounts = useApp(s => s.accounts)
  const [adding, setAdding] = useState(false)
  return (
    <div className="space-y-5">
      <Card title={t('Konta Roblox')} icon={User}>
        {accounts.length > 0 ? (
          <div className="mt-4 space-y-2">
            {accounts.map(a => <AccountRow key={a.userId} acc={a} active={a.userId === account?.userId} />)}
          </div>
        ) : <p className="mt-2 text-sm text-muted">{t('Nie masz jeszcze połączonego konta.')}</p>}
        <button className="btn-primary mt-4" onClick={() => setAdding(true)}><UserPlus size={15} /> {t('Dodaj konto')}</button>
        {account?.mode === 'cookie' && <p className="mt-3 text-xs text-muted">{t('Gry uruchamiają się na aktywnym koncie – nie musisz być zalogowany w aplikacji Roblox.')}</p>}
      </Card>

      <Modal open={adding} onClose={() => { setAdding(false); void window.nova.auth.cancelRobloxLogin() }} width={540}>
        <button className="absolute right-5 top-5 text-muted hover:text-fg" onClick={() => { setAdding(false); void window.nova.auth.cancelRobloxLogin() }}><X size={18} /></button>
        <h3 className="h-display text-2xl">{t('Dodaj konto')}</h3>
        <p className="mb-5 mt-1 text-sm text-muted">{t('Sesje są szyfrowane i zostają na tym komputerze.')}</p>
        <ConnectAccount onDone={() => setAdding(false)} />
      </Modal>

      <Card title={t("Bezpieczeństwo")} icon={ShieldCheck}>
        <ul className="mt-2 space-y-2 text-sm text-muted">
          <li>{t('• Logowanie przez Roblox odbywa się na oficjalnej stronie roblox.com – launcher nie widzi Twojego hasła.')}</li>
          <li>{t('• Sesja (ciasteczko) jest szyfrowana przez Windows i wysyłana wyłącznie do serwerów roblox.com.')}</li>
          <li>{t('• Usunięcie konta wylogowuje tę sesję również w Roblox.')}</li>
          <li>{t('• Nigdy nie udostępniaj nikomu folderu danych NovaBlox ani plików z sesją.')}</li>
        </ul>
      </Card>
    </div>
  )
}

function Discord(): JSX.Element {
  const s = useApp(st => st.settings)
  const set = useApp(st => st.setSettings)
  const d = s.discord
  const [cid, setCid] = useState(d.clientId)
  const [status, setStatus] = useState<DiscordStatus | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { window.nova.discord.status().then(setStatus).catch(() => {}) }, [])

  const save = async (p: Partial<typeof d>): Promise<void> => {
    const next = { ...s, discord: { ...d, ...p } }
    set({ discord: next.discord })
    await window.nova.store.patch({ settings: next })
    try { setStatus(await window.nova.discord.refresh()) } catch { /* status pokaże błąd */ }
  }
  const test = async (): Promise<void> => {
    setBusy(true)
    await save({ clientId: cid.trim() })
    try { setStatus(await window.nova.discord.test()); await save({ clientId: cid.trim(), enabled: true }); toast.success(t('Połączono z Discordem'), t('Sprawdź swój profil na Discordzie')) }
    catch (e) { toast.error(t('Nie udało się połączyć z Discordem'), (e as Error).message); setStatus(await window.nova.discord.status()) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <Card title={t('Discord Rich Presence')} icon={MessageCircle}>
        <p className="mt-1 text-sm text-muted">{t('Na Twoim profilu Discord znajomi zobaczą, w jaką grę Roblox grasz, od jak dawna, z ikoną gry i przyciskiem „Zagraj też”.')}</p>
        <Row title={t('Włącz status na Discordzie')} desc={t('Działa, gdy aplikacja Discord jest uruchomiona na tym komputerze.')}>
          <Toggle checked={d.enabled} disabled={!/^\d{15,22}$/.test(d.clientId)} onChange={v => save({ enabled: v })} />
        </Row>
        <Row title={t('Pokazuj status także bez gry')} desc={t('„Wybiera grę w NovaBlox”, gdy launcher jest otwarty.')}>
          <Toggle checked={d.showIdle} disabled={!d.enabled} onChange={v => save({ showIdle: v })} />
        </Row>
        <Row title={t('Przycisk „Zagraj też”')} desc={t('Znajomi mogą jednym kliknięciem otworzyć stronę gry.')}>
          <Toggle checked={d.showButton} disabled={!d.enabled} onChange={v => save({ showButton: v })} />
        </Row>
        <div className={clsx('mt-2 flex items-center gap-2 rounded-xl p-3 text-sm', status?.connected ? 'bg-success/10 text-success' : status?.error ? 'bg-warn/10 text-warn' : 'bg-fg/5 text-muted')}>
          {status?.connected ? <CircleCheck size={16} /> : <Info size={16} />}
          {status?.connected ? t('Połączono z Discordem{0}', [status.user ? ` (${status.user})` : '']) : status?.error ? status.error : t('Nie połączono')}
        </div>
      </Card>

      <Card title={t('Application ID')} icon={KeyRound}>
        <p className="mt-1 text-sm text-muted">{t('Discord wymaga własnej aplikacji. Jej nazwa pojawi się jako „Gra w …” – nazwij ją np. Roblox albo NovaBlox.')}</p>
        <div className="mt-4 flex gap-2">
          <input className="input font-mono" placeholder={t('np. 1234567890123456789')} value={cid} onChange={e => setCid(e.target.value.replace(/\D/g, ''))} />
          <button className="btn-primary" disabled={busy || !/^\d{15,22}$/.test(cid)} onClick={test}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}{t('Zapisz i testuj')}</button>
        </div>
        <ol className="mt-4 list-decimal space-y-1.5 rounded-2xl bg-fg/5 py-4 pl-9 pr-4 text-sm text-muted">
          <li>{t('Otwórz')} <button className="text-accent underline" onClick={() => window.nova.system.openExternal('https://discord.com/developers/applications')}>Discord Developer Portal</button> {t('i kliknij')} <b className="text-fg">New Application</b>.</li>
          <li>{t('Wpisz nazwę (np. Roblox), zaakceptuj warunki i kliknij Create.')}</li>
          <li>{t('Skopiuj Application ID ze strony General Information i wklej powyżej.')}</li>
        </ol>
      </Card>
    </div>
  )
}

function Notifications(): JSX.Element {
  const s = useApp(st => st.settings)
  const set = useApp(st => st.setSettings)
  const notify = useApp(st => st.notify)
  const clear = useApp(st => st.clearNotifications)
  const count = useApp(st => st.notifications.length)
  const n = s.notifications
  const upd = (p: Partial<typeof n>): void => set({ notifications: { ...n, ...p } })
  return (
    <Card title={t("Powiadomienia")} icon={Bell}>
      <Row title={t("Włącz powiadomienia")} desc={t("Główny przełącznik dla wszystkich powiadomień.")}><Toggle checked={n.enabled} onChange={v => upd({ enabled: v })} /></Row>
      <Row title={t("Powiadomienia systemowe Windows")} desc={t("Pokazuj dymki w centrum akcji Windows.")}><Toggle checked={n.system} disabled={!n.enabled} onChange={v => upd({ system: v })} /></Row>
      <Row title={t("Uruchomienie gry")} desc={t("Informacja, gdy gra otwiera się w Roblox.")}><Toggle checked={n.onLaunch} disabled={!n.enabled} onChange={v => upd({ onLaunch: v })} /></Row>
      <Row title={t("Aktualizacje ulubionych gier")} desc={t("Powiadomienie, gdy ulubiona gra dostanie update (sprawdzane co 15 minut).")}>
        <Toggle checked={n.onGameUpdate} disabled={!n.enabled} onChange={v => upd({ onGameUpdate: v })} />
      </Row>
      <Row title={t("Znajomi online")} desc={t("Powiadomienie, gdy znajomy wejdzie do Roblox (wymaga połączonego konta).")}>
        <Toggle checked={n.onFriendOnline} disabled={!n.enabled} onChange={v => upd({ onFriendOnline: v })} />
      </Row>
      <Row title={t("Aktualizacje launchera")} desc={t("Ekran z informacją o nowej wersji przy starcie.")}><Toggle checked={n.onUpdate} disabled={!n.enabled} onChange={v => upd({ onUpdate: v })} /></Row>
      <Row title={t("Test")} desc={t("Wyślij przykładowe powiadomienie.")}>
        <button className="btn-secondary h-9" disabled={!n.enabled} onClick={() => { notify(t("Powiadomienia działają"), t("Tak będą wyglądać powiadomienia NovaBlox."), 'success', true); toast.success(t("Wysłano powiadomienie testowe")) }}><Bell size={15} /> {t("Wyślij test")}</button>
      </Row>
      <Row title={t("Historia powiadomień")} desc={t("{0} zapisanych", [count])}><button className="btn-secondary h-9" disabled={!count} onClick={() => { clear(); toast.info(t("Wyczyszczono powiadomienia")) }}><Trash2 size={15} /> {t("Wyczyść")}</button></Row>
    </Card>
  )
}

function Data(): JSX.Element {
  const st = useApp()
  const reloadDiscover = useDiscover(s => s.load)
  const [busy, setBusy] = useState(false)
  const ask = (title: string, body: string, label = t("Usuń")): Promise<boolean> => confirmAction({ title, body, confirmLabel: label, danger: true })
  return (
    <div className="space-y-5">
    <Card title={t("Kopia zapasowa")} icon={Download}>
      <Row title={t("Eksportuj dane")} desc={t("Zapisz bibliotekę, ulubione, historię, czas gry i ustawienia do pliku JSON.")}>
        <button className="btn-primary h-9" onClick={async () => {
          try { const f = await window.nova.backup.exportData(); if (f) toast.success(t('Zapisano kopię zapasową'), f) }
          catch (e) { toast.error('Błąd', (e as Error).message) }
        }}><Download size={15} /> {t("Eksportuj")}</button>
      </Row>
      <Row title={t("Importuj dane")} desc={t("Wczytaj kopię zapasową. Obecne dane zostaną zastąpione.")}>
        <button className="btn-secondary h-9" onClick={async () => {
          if (!(await ask(t("Zaimportować kopię zapasową?"), t("Biblioteka, historia, czas gry i ustawienia zostaną zastąpione danymi z pliku."), t("Wybierz plik")))) return
          try {
            const st2 = await window.nova.backup.importData()
            if (st2) { setLang(st2.settings.language); toast.success(t('Zaimportowano dane')); setTimeout(() => location.reload(), 700) }
          } catch (e) { toast.error('Nie udało się zaimportować', (e as Error).message) }
        }}><Upload size={15} /> {t("Importuj")}</button>
      </Row>
      <p className="mt-2 text-xs text-muted">{t("Kopia nie zawiera tokenów logowania ani plików własnego tła i modów.")}</p>
    </Card>
    <Card title={t("Dane i pamięć podręczna")} icon={Database}>
      <Row title={t("Wyczyść pamięć podręczną")} desc={t("Usuwa zapisane odpowiedzi Roblox i obrazy. Dane pobiorą się ponownie.")}>
        <button className="btn-secondary h-9" disabled={busy} onClick={async () => {
          if (!(await ask(t("Wyczyścić pamięć podręczną?"), t("Miniatury i listy gier zostaną pobrane ponownie. Biblioteka i ustawienia nie zostaną zmienione."), t("Wyczyść")))) return
          setBusy(true)
          try {
            const r = await window.nova.system.clearCache()
            useProfiles.setState({ profiles: {}, errors: {} })
            void reloadDiscover(true)
            toast.success(t("Pamięć podręczna wyczyszczona"), t("Zwolniono {0}", [bytes(r.freedBytes)]))
          } catch (e) { toast.error('Błąd', (e as Error).message) } finally { setBusy(false) }
        }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} {t("Wyczyść")}</button>
      </Row>
      <Row title={t("Historia uruchomień")} desc={t("{0} wpisów", [st.history.length])}>
        <button className="btn-secondary h-9" disabled={!st.history.length} onClick={async () => { if (await ask(t("Wyczyścić historię?"), t("Usuniesz wszystkie wpisy historii uruchomień."))) st.clearHistory() }}><Trash2 size={15} /> {t("Wyczyść")}</button>
      </Row>
      <Row title={t("Aktywność")} desc={t("{0} wpisów na Dashboardzie", [st.activity.length])}>
        <button className="btn-secondary h-9" disabled={!st.activity.length} onClick={async () => { if (await ask(t("Wyczyścić aktywność?"), t("Lista „Ostatnia aktywność” będzie pusta."))) { useApp.setState({ activity: [] }); void window.nova.store.patch({ activity: [] }); toast.info(t("Aktywność wyczyszczona")) } }}><Trash2 size={15} /> {t("Wyczyść")}</button>
      </Row>
      <Row title={t("Czas gry")} desc={t('{0} zapisanych sesji', [st.playtime.length])}>
        <button className="btn-secondary h-9" disabled={!st.playtime.length} onClick={async () => { if (await ask(t("Wyczyścić czas gry?"), t("Usuniesz wszystkie zapisane sesje i statystyki czasu gry."))) { st.clearPlaytime(); toast.info(t('Wyczyszczono czas gry')) } }}><Timer size={15} /> {t("Wyczyść")}</button>
      </Row>
      <Row title={t("Biblioteka gier")} desc={t('{0} gier, w tym {1} ulubionych', [st.library.length, st.library.filter(g => g.favorite).length])}>
        <button className="btn-danger h-9" disabled={!st.library.length} onClick={async () => { if (await ask(t("Usunąć całą bibliotekę?"), t("Wszystkie gry i ulubione zostaną usunięte z launchera. Tej operacji nie można cofnąć."), t("Usuń wszystko"))) st.clearLibrary() }}><Trash2 size={15} /> {t("Usuń wszystko")}</button>
      </Row>
    </Card>
    </div>
  )
}

const MOD_SLOTS: { slot: ModSlot; title: string; desc: string; icon: typeof Type }[] = [
  { slot: 'font', title: t("Czcionka"), desc: t("Własna czcionka (TTF/OTF) dla całego interfejsu gry."), icon: Type },
  { slot: 'death', title: t("Dźwięk śmierci"), desc: t("Np. klasyczne „oof” – plik OGG lub MP3."), icon: Volume2 },
  { slot: 'jump', title: t("Dźwięk skoku"), desc: t("Odtwarzany przy skoku postaci."), icon: Volume2 },
  { slot: 'land', title: t("Dźwięk lądowania"), desc: t("Odtwarzany po wylądowaniu."), icon: Volume2 },
  { slot: 'footsteps', title: t("Dźwięk kroków"), desc: t("Kroki na plastikowej powierzchni."), icon: Volume2 }
]

function Mods(): JSX.Element {
  const mods = useApp(s => s.mods)
  const setMods = useApp(s => s.setMods)
  const [status, setStatus] = useState<ModStatus | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { window.nova.mods.status().then(setStatus).catch(() => {}) }, [])

  const save = async (next: typeof mods, applyNow = true): Promise<void> => {
    setMods(next)
    await window.nova.store.patch({ mods: next })
    if (!applyNow) return
    try { setStatus(await window.nova.mods.apply()) } catch (e) { toast.error(t('Błąd modów'), (e as Error).message) }
  }
  const pick = async (slot: ModSlot): Promise<void> => {
    try {
      const name = await window.nova.mods.pickFile(slot)
      if (name) { await save({ ...mods, files: { ...mods.files, [slot]: name } }); toast.success(t('Dodano plik moda'), name) }
    } catch (e) { toast.error(t('Nie udało się dodać pliku'), (e as Error).message) }
  }
  const remove = async (slot: ModSlot): Promise<void> => {
    await window.nova.mods.removeFile(slot)
    const files = { ...mods.files }; delete files[slot]
    await save({ ...mods, files })
  }

  return (
    <div className="space-y-5">
      <Card title={t("Mody Roblox")} icon={Puzzle}>
        <Row title={t("Włącz mody")} desc={t("Pliki są nakładane na Roblox przed każdym uruchomieniem gry z NovaBlox (Roblox kasuje je przy swoich aktualizacjach).")}>
          <Toggle checked={mods.enabled} onChange={v => save({ ...mods, enabled: v })} />
        </Row>
        <div className={clsx('mt-2 flex items-center gap-2 rounded-xl p-3 text-sm', status?.robloxFound ? 'bg-success/10 text-success' : 'bg-warn/10 text-warn')}>
          {status?.robloxFound ? <CircleCheck size={16} /> : <AlertTriangle size={16} />}
          {status == null ? t('Sprawdzam instalację Roblox…') : status.robloxFound ? t('Znaleziono Roblox (wersje: {0})', [status.versions]) : t('Nie znaleziono folderu Roblox – zainstaluj Roblox z roblox.com')}
          {status?.lastError && <span className="ml-2 text-danger">{status.lastError}</span>}
        </div>
      </Card>

      <Card title={t("Pliki modów")} icon={Volume2}>
        {MOD_SLOTS.map(m => (
          <Row key={m.slot} title={m.title} desc={mods.files[m.slot] ? <span className="text-accent">{mods.files[m.slot]}</span> : m.desc}>
            <div className="flex gap-2">
              {mods.files[m.slot] && <button className="btn-ghost h-9" title={t('Usuń')} onClick={() => remove(m.slot)}><X size={15} /></button>}
              <button className="btn-secondary h-9" onClick={() => pick(m.slot)}><Upload size={15} />{mods.files[m.slot] ? t('Zmień') : t('Wybierz plik')}</button>
            </div>
          </Row>
        ))}
      </Card>

      <Card title={t("Narzędzia")} icon={Wand2}>
        <Row title={t("Zastosuj teraz")} desc={t("Nałóż mody na Roblox bez uruchamiania gry.")}>
          <button className="btn-primary h-9" disabled={busy || !mods.enabled} onClick={async () => { setBusy(true); try { setStatus(await window.nova.mods.apply()); toast.success(t('Mody nałożone')) } catch (e) { toast.error(t('Błąd modów'), (e as Error).message) } finally { setBusy(false) } }}><Check size={15} /> {t("Zastosuj")}</button>
        </Row>
        <Row title={t("Przywróć oryginalny Roblox")} desc={t("Cofnij wszystkie zmiany w plikach Roblox i wyłącz mody.")}>
          <button className="btn-secondary h-9" disabled={busy} onClick={async () => {
            if (!(await confirmAction({ title: t('Przywrócić oryginalne pliki Roblox?'), body: t('Czcionki i dźwięki wrócą do domyślnych, a mody zostaną wyłączone. Twoje pliki modów zostaną zachowane.'), confirmLabel: t('Przywróć') }))) return
            setBusy(true)
            try { await save({ ...mods, enabled: false }, false); setStatus(await window.nova.mods.restore()); toast.success(t('Przywrócono oryginalny Roblox')) } catch (e) { toast.error(t('Błąd'), (e as Error).message) } finally { setBusy(false) }
          }}><RefreshCw size={15} /> {t("Przywróć")}</button>
        </Row>
        <p className="mt-2 text-xs text-muted">{t("Mody zmieniają tylko pliki dźwięków i czcionek w Twoim folderze Roblox (tak jak Bloxstrap). Nie ingerują w kod gry. Dźwięki z innych gier mogą być chronione prawem autorskim – używaj własnych lub darmowych plików.")}</p>
      </Card>
    </div>
  )
}

function About(): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [upd, setUpd] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState(false)
  useEffect(() => { window.nova.system.info().then(setInfo).catch(() => {}) }, [])
  const check = async (): Promise<void> => {
    setChecking(true)
    try {
      const u = await window.nova.system.checkUpdate()
      setUpd(u)
      if (u.status === 'available') window.dispatchEvent(new CustomEvent('nova:update', { detail: u }))
    } catch (e) { toast.error('Błąd sprawdzania', (e as Error).message) } finally { setChecking(false) }
  }
  return (
    <div className="space-y-5">
      <div className="card relative overflow-hidden p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative flex items-center gap-6">
          <Logo size={84} />
          <div className="flex-1">
            <div className="h-display text-4xl">{t("NOVA")}<span className="text-grad">{t("BLOX")}</span></div>
            <div className="text-muted">{t("Premium launcher do Roblox · wersja")} {info?.version ?? '…'}</div>
          </div>
          <button className="btn-primary" onClick={check} disabled={checking}>{checking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} {t("Sprawdź aktualizacje")}</button>
        </div>
        <AnimatePresence>
          {upd && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="relative mt-6">
              <div className={clsx('flex items-center gap-3 rounded-2xl p-4 text-sm',
                upd.status === 'up-to-date' && 'bg-success/10 text-success', upd.status === 'available' && 'bg-accent/15 text-fg',
                upd.status === 'error' && 'bg-danger/10 text-danger', upd.status === 'not-configured' && 'bg-warn/10 text-warn')}>
                {upd.status === 'up-to-date' ? <CircleCheck size={18} /> : upd.status === 'available' ? <Sparkles size={18} /> : <AlertTriangle size={18} />}
                <div className="flex-1">
                  {upd.status === 'up-to-date' && t("Masz najnowszą wersję ({0}).", [upd.current])}
                  {upd.status === 'available' && t("Dostępna jest wersja {0}.", [upd.latest])}
                  {upd.status === 'error' && t("Nie udało się sprawdzić aktualizacji: {0}", [upd.error])}
                  {upd.status === 'not-configured' && <>{t("Kanał aktualizacji nie jest skonfigurowany. Ustaw repozytorium GitHub w polu")} <code>{t("novablox.updateRepo")}</code> {t("w package.json i wydawaj nowe wersje jako GitHub Releases.")}</>}
                </div>
                {upd.status === 'available' && <button className="btn-primary h-9" onClick={() => window.dispatchEvent(new CustomEvent('nova:update', { detail: upd }))}>{t("Zaktualizuj")}</button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Card title={t("Informacje techniczne")} icon={Info}>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          {info && ([
            [t("Wersja"), info.version], [t("Electron"), info.electron], [t("Chromium"), info.chrome], ['Node.js', info.node],
            [t("System"), info.platform], [t("Szyfrowanie sesji"), info.safeStorage ? t("dostępne (DPAPI)") : t("niedostępne")],
            [t("Redirect OAuth"), info.redirectUri], [t("Dane aplikacji"), info.userData]
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-fg/5 p-3"><div className="text-xs text-muted">{k}</div><div className="select-text truncate font-mono text-[13px]" title={v}>{v}</div></div>
          ))}
        </div>
      </Card>
      <Card title={t("Informacje prawne")} icon={Github}>
        <p className="mt-2 text-sm text-muted">{t("NovaBlox to niezależny projekt fanowski, niepowiązany z Roblox Corporation. „Roblox” jest znakiem towarowym Roblox Corporation. Dane gier i profili pochodzą z publicznych API Roblox i są wyświetlane bez modyfikacji.")}</p>
        <div className="mt-4 flex gap-2">
          <button className="btn-secondary" onClick={() => window.nova.system.openExternal('https://www.roblox.com/info/terms')}><ExternalLink size={15} /> {t("Warunki Roblox")}</button>
          <button className="btn-secondary" onClick={() => window.nova.system.openExternal('https://create.roblox.com/docs/cloud/auth/oauth2-overview')}><ExternalLink size={15} /> {t("O Roblox OAuth")}</button>
        </div>
      </Card>
    </div>
  )
}

export default function Settings(): JSX.Element {
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('nova-settings-tab') as Tab) || 'general')
  useEffect(() => {
    const on = (e: Event): void => setTab((e as CustomEvent<Tab>).detail)
    window.addEventListener('nova:settings-tab', on)
    const pending = sessionStorage.getItem('nova-settings-tab-next') as Tab | null
    if (pending) { setTab(pending); sessionStorage.removeItem('nova-settings-tab-next') }
    return () => window.removeEventListener('nova:settings-tab', on)
  }, [])
  useEffect(() => { sessionStorage.setItem('nova-settings-tab', tab) }, [tab])

  return (
    <div>
      <PageHeader title={t("Settings")} subtitle={t("Dostosuj NovaBlox do siebie")} />
      <div className="grid grid-cols-[230px_1fr] gap-6">
        <div className="card h-fit space-y-1 p-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={clsx('relative flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition', tab === t.id ? 'text-fg' : 'text-muted hover:bg-fg/5 hover:text-fg')}>
              {tab === t.id && <motion.span layoutId="settings-tab" className="absolute inset-0 rounded-xl bg-accent/15 ring-1 ring-accent/30" />}
              <t.icon size={17} className={clsx('relative', tab === t.id && 'text-accent')} /><span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: .18 }}>
            {tab === 'general' && <General />}
            {tab === 'appearance' && <Appearance />}
            {tab === 'mods' && <Mods />}
            {tab === 'discord' && <Discord />}
            {tab === 'account' && <Account />}
            {tab === 'notifications' && <Notifications />}
            {tab === 'data' && <Data />}
            {tab === 'about' && <About />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
