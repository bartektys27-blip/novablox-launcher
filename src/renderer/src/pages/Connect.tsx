import { t } from '@/lib/i18n'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, AtSign, ExternalLink, KeyRound, Loader2, Lock, ShieldCheck, Info, ChevronDown, LogIn } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'
import { toast } from '@/store/ui'
import { Logo, Segmented } from '@/components/ui'

/** Formularz połączenia konta – używany na ekranie startowym, w profilu i ustawieniach */
export function ConnectAccount({ onDone }: { onDone?(): void }): JSX.Element {
  const [mode, setMode] = useState<'roblox' | 'oauth' | 'public'>('roblox')
  const clientId = useApp(s => s.oauthClientId)
  const setClientId = useApp(s => s.setClientId)
  const addAccount = useApp(s => s.addAccount)
  const logActivity = useApp(s => s.logActivity)
  const notify = useApp(s => s.notify)
  const [cid, setCid] = useState(clientId)
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [help, setHelp] = useState(!clientId)
  const [redirect, setRedirect] = useState('http://localhost:47823/oauth/callback')

  useEffect(() => { window.nova.system.info().then(i => setRedirect(i.redirectUri)).catch(() => {}) }, [])

  const finish = (a: Awaited<ReturnType<typeof window.nova.auth.connectUsername>>): void => {
    addAccount(a)
    logActivity('login', a.mode !== 'public' ? t("Zalogowano jako @{0}", [a.username]) : t("Połączono profil @{0}", [a.username]))
    notify(t("Konto połączone"), t("Witaj, {0}!", [a.displayName]), 'success')
    toast.success(t("Połączono z Roblox"), `@${a.username}`)
    onDone?.()
  }

  const oauth = async (): Promise<void> => {
    setBusy(true)
    setClientId(cid.trim())
    try { finish(await window.nova.auth.loginOAuth(cid.trim())) }
    catch (e) { toast.error('Logowanie nieudane', (e as Error).message) }
    finally { setBusy(false) }
  }
  const robloxLogin = async (): Promise<void> => {
    setBusy(true)
    try { finish(await window.nova.auth.loginRoblox()) }
    catch (e) { if ((e as Error).message !== t('Logowanie anulowane')) toast.error('Logowanie nieudane', (e as Error).message) }
    finally { setBusy(false) }
  }
  const byName = async (): Promise<void> => {
    setBusy(true)
    try { finish(await window.nova.auth.connectUsername(username)) }
    catch (e) { toast.error('Nie udało się połączyć', (e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div>
      <Segmented id="connect" value={mode} onChange={v => !busy && setMode(v)} options={[
        { value: 'roblox', label: t("Logowanie Roblox"), icon: LogIn },
        { value: 'oauth', label: t("OAuth"), icon: ShieldCheck },
        { value: 'public', label: t("Nazwa użytkownika"), icon: AtSign }
      ]} />

      <AnimatePresence mode="wait">
        {mode === 'roblox' ? (
          <motion.div key="r" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-5 space-y-4">
            <p className="text-sm text-muted">{t("Otworzy się okno Roblox. Klucze dostępu i weryfikacja dwuetapowa tam działają.")}</p>
            <ul className="space-y-1.5 text-sm text-muted">
              <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-success" />{t("Gry uruchomią się na tym koncie – nie musisz być zalogowany w aplikacji Roblox.")}</li>
              <li className="flex gap-2"><Lock size={15} className="mt-0.5 shrink-0 text-success" />{t("Sesja jest szyfrowana przez Windows i zostaje tylko na tym komputerze.")}</li>
              <li className="flex gap-2"><Info size={15} className="mt-0.5 shrink-0 text-accent" />{t("Możesz dodać kilka kont i przełączać się między nimi.")}</li>
            </ul>
            {busy ? (
              <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4">
                <Loader2 className="animate-spin text-accent" size={20} />
                <div className="flex-1 text-sm"><b>{t("Zaloguj się w oknie Roblox.")}</b><div className="text-muted">{t("Okno zamknie się samo po zalogowaniu.")}</div></div>
                <button className="btn-secondary h-9" onClick={() => window.nova.auth.cancelRobloxLogin()}>{t("Anuluj")}</button>
              </div>
            ) : (
              <button className="h-12 w-full rounded-2xl bg-white text-base font-semibold text-black transition hover:bg-white/90 active:scale-[.98]" onClick={robloxLogin}>
                <span className="inline-flex items-center gap-2"><ExternalLink size={17} />{t("Otwórz logowanie Roblox")}</span>
              </button>
            )}
            <p className="text-xs text-muted">{t("Nigdy nie udostępniaj nikomu pliku z danymi launchera – zawiera Twoją sesję Roblox.")}</p>
          </motion.div>
        ) : mode === 'oauth' ? (
          <motion.div key="o" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-5 space-y-4">
            <p className="text-sm text-muted">
              {t("Oficjalne logowanie OAuth 2.0. Logujesz się na stronie")} <b className="text-fg">{t("roblox.com")}</b> {t("w swojej przeglądarce – launcher nigdy nie widzi hasła, a token jest szyfrowany przez Windows.")}
            </p>
            <div>
              <label className="label mb-2 block">{t("Client ID aplikacji OAuth")}</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input pl-10 font-mono" placeholder={t("np. 1234567890123456789")} value={cid} onChange={e => setCid(e.target.value.replace(/\D/g, ''))} disabled={busy} />
              </div>
            </div>

            <button onClick={() => setHelp(h => !h)} className="flex w-full items-center gap-2 text-left text-sm font-medium text-accent">
              <Info size={15} /> {t("Skąd wziąć Client ID?")}
              <ChevronDown size={15} className={clsx('ml-auto transition', help && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {help && (
                <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="list-decimal space-y-1.5 overflow-hidden rounded-2xl bg-fg/5 py-4 pl-9 pr-4 text-sm text-muted">
                  <li>{t("Otwórz")} <button className="text-accent underline" onClick={() => window.nova.system.openExternal('https://create.roblox.com/dashboard/credentials')}>{t("Creator Dashboard → Credentials")}</button> {t("i wybierz")} <b className="text-fg">{t("OAuth 2.0 Apps → Create")}</b>.</li>
                  <li>{t("Dodaj Redirect URL:")} <code className="select-text rounded bg-black/40 px-1.5 py-0.5 text-fg">{redirect}</code></li>
                  <li>{t("Zaznacz uprawnienia")} <b className="text-fg">{t("openid")}</b> {t("i")} <b className="text-fg">{t("profile")}</b>{t(", zapisz aplikację.")}</li>
                  <li>{t("Skopiuj")} <b className="text-fg">{t("Client ID")}</b> {t("i wklej powyżej. Client Secret nie jest potrzebny (PKCE).")}</li>
                </motion.ol>
              )}
            </AnimatePresence>

            {busy ? (
              <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4">
                <Loader2 className="animate-spin text-accent" size={20} />
                <div className="flex-1 text-sm"><b>{t("Dokończ logowanie w przeglądarce.")}</b><div className="text-muted">{t("Po zatwierdzeniu wrócisz tu automatycznie.")}</div></div>
                <button className="btn-secondary h-9" onClick={() => window.nova.auth.cancelOAuth()}>{t("Anuluj")}</button>
              </div>
            ) : (
              <button className="btn-primary h-12 w-full text-base" disabled={cid.length < 6} onClick={oauth}>
                <ExternalLink size={17} /> {t("Zaloguj przez Roblox")}
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div key="p" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-5 space-y-4">
            <p className="text-sm text-muted">
              {t("Szybkie połączenie bez logowania. Launcher pobierze")} <b className="text-fg">{t("publiczny profil")}</b> {t("(avatar, opis, znajomi, ulubione gry). To nie jest uwierzytelnienie – nie podawaj tu hasła.")}
            </p>
            <div>
              <label className="label mb-2 block">{t("Nazwa użytkownika Roblox")}</label>
              <div className="relative">
                <AtSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input pl-10" placeholder={t("np. Builderman")} value={username} disabled={busy}
                  onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && username.length >= 3 && byName()} />
              </div>
            </div>
            <button className="btn-primary h-12 w-full text-base" disabled={busy || username.trim().length < 3} onClick={byName}>
              {busy ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />} {t("Połącz profil")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {mode !== 'roblox' && (
        <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-fg/5 p-3.5 text-xs text-muted">
          <Lock size={14} className="mt-0.5 shrink-0 text-accent" />
          {t("Gry uruchamiają się w oficjalnej aplikacji Roblox, na koncie zalogowanym w Roblox. Połączenie z launcherem służy do wyświetlania Twojego profilu i nie daje dostępu do konta.")}
        </div>
      )}
    </div>
  )
}

export default function LoginScreen(): JSX.Element {
  const finishOnboarding = useApp(s => s.finishOnboarding)
  return (
    <div className="scroll relative z-10 flex min-h-0 flex-1 p-8">
      <div className="m-auto grid w-full max-w-[1080px] grid-cols-[1.1fr_1fr] gap-10 py-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .5 }} className="flex flex-col justify-center">
          <Logo size={64} />
          <h1 className="h-display mt-8 text-6xl leading-[1.02]">{t("Twój Roblox.")}<br /><span className="text-grad">{t("Na nowym poziomie.")}</span></h1>
          <p className="mt-5 max-w-md text-lg text-muted">{t("Biblioteka gier, odkrywanie hitów, historia i profil – w jednym, szybkim launcherze.")}</p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
            {[[t("Biblioteka"), t("Twoje gry pod ręką")], [t("Discover"), t("Prawdziwe listy Roblox")], [t("1 klik"), t("Graj od razu")]].map(([a, b]) => (
              <div key={a} className="card p-3.5"><div className="h-display text-lg text-grad">{a}</div><div className="text-xs text-muted">{b}</div></div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: .1 }}
          className="panel relative rounded-[28px] p-8 shadow-card">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 rounded-t-[28px] bg-gradient-to-b from-accent/20 to-transparent" />
          <h2 className="h-display text-3xl">{t("Połącz konto Roblox")}</h2>
          <p className="mb-6 mt-1 text-muted">{t("Wybierz sposób połączenia.")}</p>
          <ConnectAccount onDone={finishOnboarding} />
          <button className="btn-ghost mt-4 w-full" onClick={finishOnboarding}>{t("Pomiń – połączę później")}</button>
        </motion.div>
      </div>
    </div>
  )
}
