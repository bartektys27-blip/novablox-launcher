import { t } from '@/lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import type { UpdateInfo } from '@shared/types'
import { useApp } from './store/app'
import { useFriends } from './lib/useFriends'
import { Background, OfflineBanner, Sidebar, TitleBar } from './components/Shell'
import { ConfirmDialog, SplashScreen, Toasts, UpdateScreen } from './components/Overlays'
import LoginScreen from './pages/Connect'
import Dashboard from './pages/Dashboard'
import Discover from './pages/Discover'
import Library from './pages/Library'
import History from './pages/History'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import GameDetails from './pages/GameDetails'

const MIN_SPLASH = 1300

export default function App(): JSX.Element {
  const ready = useApp(s => s.ready)
  const init = useApp(s => s.init)
  const route = useApp(s => s.route)
  const account = useApp(s => s.account)
  const onboarded = useApp(s => s.onboarded)
  const animations = useApp(s => s.settings?.animations ?? 'full')
  const setOnline = useApp(s => s.setOnline)
  const [splash, setSplash] = useState(true)
  const [status, setStatus] = useState(t("Wczytywanie danych…"))
  const [fatal, setFatal] = useState<string | null>(null)
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const mainRef = useRef<HTMLDivElement>(null)

  // Start: dane -> sprawdzenie aktualizacji -> interfejs
  useEffect(() => {
    const started = Date.now()
    ;(async () => {
      try {
        await init()
        setStatus(t("Sprawdzanie aktualizacji…"))
        const st = useApp.getState()
        const u = await window.nova.system.checkUpdate().catch(() => null)
        if (u?.status === 'available') {
          // Automatyczna aktualizacja przy starcie: pobierz, zainstaluj i uruchom ponownie
          setStatus(t("Pobieranie aktualizacji {0}…", [u.latest]))
          const off = window.nova.system.onUpdateProgress(p => setStatus(t("Pobieranie aktualizacji {0}… {1}%", [u.latest, Math.round(p.percent)])))
          try {
            await window.nova.system.installUpdate()
            setStatus(t("Instalowanie aktualizacji…"))
            await new Promise(() => {}) // aplikacja zaraz się zamknie i uruchomi ponownie
          } catch {
            off()
            st.notify(t("Dostępna aktualizacja"), t("NovaBlox {0} jest gotowy do pobrania", [u.latest]), 'info', st.settings.notifications.onUpdate)
            if (st.settings.notifications.enabled && st.settings.notifications.onUpdate) setUpdate(u)
          }
        }
        setStatus(t("Gotowe"))
      } catch (e) {
        setFatal((e as Error).message)
      } finally {
        setTimeout(() => setSplash(false), Math.max(0, MIN_SPLASH - (Date.now() - started)))
      }
    })()
  }, [init])

  useEffect(() => {
    const on = (): void => setOnline(true)
    const off = (): void => setOnline(false)
    const upd = (e: Event): void => setUpdate((e as CustomEvent<UpdateInfo>).detail)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    window.addEventListener('nova:update', upd)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('nova:update', upd) }
  }, [setOnline])

  // Status znajomych – odświeżany w tle, gdy konto jest połączone
  const userId = account?.userId
  useEffect(() => {
    if (!ready) return
    if (userId) useFriends.getState().start(userId)
    else useFriends.getState().stop()
  }, [ready, userId])

  // Co 15 minut: odśwież bibliotekę (liczba graczy + alerty aktualizacji ulubionych gier)
  useEffect(() => {
    if (!ready) return
    const id = setInterval(() => void useApp.getState().refreshLibrary(), 15 * 60_000)
    return () => clearInterval(id)
  }, [ready])

  // Przewiń na górę przy zmianie strony
  const key = route.page === 'game' ? `game-${route.universeId}` : route.page
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [key])

  // Nawigacja wstecz: Alt+← lub boczny przycisk myszy
  useEffect(() => {
    const back = useApp.getState().back
    const onKey = (e: KeyboardEvent): void => { if (e.altKey && e.key === 'ArrowLeft') back() }
    const onMouse = (e: MouseEvent): void => { if (e.button === 3) back() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mouseup', onMouse)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mouseup', onMouse) }
  }, [])

  if (fatal) {
    return (
      <div className="grid h-full place-items-center bg-bg p-10 text-center">
        <div><h1 className="h-display text-3xl">{t("Nie udało się uruchomić NovaBlox")}</h1><p className="mt-2 text-muted">{fatal}</p>
          <button className="btn-primary mt-6" onClick={() => location.reload()}>{t("Spróbuj ponownie")}</button></div>
      </div>
    )
  }

  const page = (): JSX.Element => {
    switch (route.page) {
      case 'dashboard': return <Dashboard />
      case 'discover': return <Discover />
      case 'library': return <Library />
      case 'favorites': return <Library favoritesOnly />
      case 'history': return <History />
      case 'profile': return <Profile />
      case 'settings': return <Settings />
      case 'game': return <GameDetails universeId={route.universeId} />
    }
  }

  const showLogin = ready && !account && !onboarded

  return (
    <MotionConfig reducedMotion={animations === 'full' ? 'never' : 'always'}>
      {ready && (
        <div className="relative flex h-full flex-col">
          <Background />
          <TitleBar />
          <OfflineBanner />
          {showLogin ? <LoginScreen /> : (
            <div className="relative z-10 flex min-h-0 flex-1">
              <Sidebar />
              <main ref={mainRef} className="scroll min-w-0 flex-1">
                <AnimatePresence mode="wait">
                  <motion.div key={key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: .22, ease: 'easeOut' }} className="mx-auto max-w-[1600px] px-10 py-8">
                    {page()}
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>
          )}
        </div>
      )}
      <AnimatePresence>{splash && <SplashScreen status={status} />}</AnimatePresence>
      <UpdateScreen info={update} onClose={() => setUpdate(null)} />
      <ConfirmDialog />
      <Toasts />
    </MotionConfig>
  )
}
