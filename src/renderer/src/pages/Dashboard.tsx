import { accountModeLabel, t } from '@/lib/i18n'
import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, Clock, Compass, Flame, Gamepad2, Heart, Library, LogIn, Palette, Play, Plus, Rocket, Trash2, User, Star, Hash
} from 'lucide-react'
import type { ActivityType } from '@shared/types'
import { useApp, type CardGame } from '@/store/app'
import { useProfile } from '@/lib/useProfile'
import { pickSort, useDiscover } from '@/lib/useDiscover'
import { greeting, plural, timeAgo } from '@/lib/format'
import { ErrorState, Img, SectionHeader, SkeletonCards } from '@/components/ui'
import { GameRow, PlayButton, PlayersLabel } from '@/components/GameCard'
import { NowPlaying } from '@/components/Playtime'
import { FriendsOnline } from '@/components/FriendsOnline'
import { dur, total } from '@/lib/playtime'

const ACT_ICON: Record<ActivityType, typeof Play> = {
  launch: Play, add: Plus, remove: Trash2, favorite: Heart, unfavorite: Heart, login: LogIn, logout: LogIn
}

export default function Dashboard(): JSX.Element {
  const account = useApp(s => s.account)
  const library = useApp(s => s.library)
  const history = useApp(s => s.history)
  const activity = useApp(s => s.activity)
  const sessions = useApp(s => s.playtime)
  const navigate = useApp(s => s.navigate)
  const openGame = useApp(s => s.openGame)
  const { profile } = useProfile(account?.userId)
  const { sorts, error, loading, load } = useDiscover()

  useEffect(() => { void load() }, [load])

  // Ostatnio uruchomione – unikalne gry z historii
  const recent = useMemo(() => {
    const seen = new Set<number>()
    const out: CardGame[] = []
    for (const h of history) {
      if (seen.has(h.universeId)) continue
      seen.add(h.universeId)
      const lib = library.find(l => l.universeId === h.universeId)
      out.push(lib ?? { universeId: h.universeId, placeId: h.placeId, name: h.name, iconUrl: h.iconUrl, thumbnailUrl: null, playing: null, creatorName: '', genre: '' })
      if (out.length >= 12) break
    }
    return out
  }, [history, library])

  const lastPlayed = recent[0]
  const lastLib = lastPlayed ? library.find(l => l.universeId === lastPlayed.universeId) : undefined
  const favorites = library.filter(g => g.favorite)
  const popular = sorts ? pickSort(sorts, 'popular') : undefined
  const hero = lastLib ?? lastPlayed ?? popular?.games[0]
  const totalLaunches = history.length

  const shortcuts = [
    { label: t("Discover"), desc: t("Odkrywaj gry"), icon: Compass, go: () => navigate('discover') },
    { label: t("My Games"), desc: t("{0} w bibliotece", [plural(library.length, 'gra', 'gry', 'gier')]), icon: Library, go: () => navigate('library') },
    { label: t("Favorites"), desc: t("{0} ulubionych", [favorites.length]), icon: Heart, go: () => navigate('favorites') },
    { label: t("History"), desc: plural(totalLaunches, 'uruchomienie', 'uruchomienia', t("uruchomień")), icon: Clock, go: () => navigate('history') },
    { label: t("Personalizacja"), desc: t("Motywy i tła"), icon: Palette, go: () => { sessionStorage.setItem('nova-settings-tab', 'appearance'); navigate('settings') } },
    { label: t("Profile"), desc: account ? `@${account.username}` : t("Połącz konto"), icon: User, go: () => navigate('profile') }
  ]

  return (
    <div className="space-y-10">
      {/* HERO */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}
        className="relative overflow-hidden rounded-[28px] border border-fg/5">
        <div className="absolute inset-0">
          {hero?.thumbnailUrl && <Img src={hero.thumbnailUrl} className="h-full w-full scale-110 blur-sm" />}
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg/80 to-transparent" />
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-accent/30 blur-[100px]" />
        </div>

        <div className="relative flex min-h-[340px] items-stretch gap-8 p-10">
          <div className="flex flex-1 flex-col justify-center">
            <div className="label text-accent">{greeting()}</div>
            <h1 className="h-display mt-2 text-5xl leading-tight">
              {account ? <>{t("Witaj,")} <span className="text-grad">{account.displayName}</span></> : <>{t("Witaj w")} <span className="text-grad">{t("NovaBlox")}</span></>}
            </h1>
            {account ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span className="rounded-lg bg-fg/5 px-2.5 py-1">@{account.username}</span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-fg/5 px-2.5 py-1"><Hash size={13} />{account.userId}</span>
                <span className="rounded-lg bg-fg/5 px-2.5 py-1">{accountModeLabel(account.mode)}</span>
              </div>
            ) : (
              <p className="mt-3 max-w-lg text-muted">{t("Połącz konto Roblox, aby zobaczyć swój avatar, znajomych i ulubione gry.")}</p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {hero ? (
                <>
                  <PlayButton game={hero} size="lg" className="pulse-ring" />
                  <button onClick={() => openGame(hero.universeId)} className="group flex items-center gap-3 rounded-2xl p-1.5 pr-4 text-left transition hover:bg-fg/5">
                    <Img src={hero.iconUrl} className="h-11 w-11 rounded-xl" />
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted">{lastPlayed ? t("Kontynuuj") : t("Polecane teraz")}</div>
                      <div className="max-w-[260px] truncate font-semibold group-hover:text-accent">{hero.name}</div>
                      {lastLib?.lastPlayed ? <div className="text-xs text-muted">{t("grano")} {timeAgo(lastLib.lastPlayed)}</div> : hero.playing != null && <div className="text-xs text-muted"><PlayersLabel n={hero.playing} /></div>}
                    </div>
                  </button>
                </>
              ) : (
                <button className="btn-primary h-14 rounded-2xl px-8 text-base" onClick={() => navigate('discover')}><Rocket size={19} /> {t("Odkryj gry")}</button>
              )}
              {!account && <button className="btn-secondary h-14 rounded-2xl px-6" onClick={() => navigate('profile')}><LogIn size={17} /> {t("Połącz konto")}</button>}
            </div>
          </div>

          {/* Duży avatar */}
          <div className="relative hidden w-[300px] shrink-0 xl:block">
            <div className="absolute inset-x-6 bottom-0 top-8 rounded-[32px] bg-gradient-to-b from-accent/30 to-accent2/10 blur-2xl" />
            {account ? (
              profile?.avatarUrl ? (
                <motion.img initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .2, type: 'spring' }}
                  src={profile.avatarUrl} draggable={false} className="relative mx-auto h-[300px] w-[300px] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,.6)]" />
              ) : <div className="skeleton relative mx-auto mt-6 h-[260px] w-[220px] rounded-3xl" />
            ) : (
              <div className="relative grid h-full place-items-center"><Gamepad2 size={120} className="text-accent/40" /></div>
            )}
          </div>
        </div>
      </motion.section>

      {account?.expired && (
        <div className="card flex items-center gap-4 border-danger/40 bg-danger/10 p-4">
          <LogIn size={20} className="text-danger" />
          <div className="flex-1 text-sm"><b>{t('Sesja konta wygasła')}</b><div className="text-muted">{t('Zaloguj się ponownie, aby uruchamiać gry na koncie @{0}.', [account.username])}</div></div>
          <button className="btn-primary h-9" onClick={() => { sessionStorage.setItem('nova-settings-tab', 'account'); navigate('settings') }}>{t('Zaloguj ponownie')}</button>
        </div>
      )}

      <NowPlaying />

      {/* SKRÓTY */}
      <section className="grid grid-cols-3 gap-3 2xl:grid-cols-6">
        {shortcuts.map((s, i) => (
          <motion.button key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .05 * i }}
            whileHover={{ y: -3 }} onClick={s.go}
            className="card card-hover group flex items-center gap-3 p-4 text-left">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent transition group-hover:bg-accent-grad group-hover:text-white"><s.icon size={20} /></div>
            <div className="min-w-0"><div className="font-semibold">{s.label}</div><div className="truncate text-xs text-muted">{s.desc}</div></div>
          </motion.button>
        ))}
      </section>

      {/* OSTATNIO URUCHOMIONE */}
      <section>
        <SectionHeader icon={Clock} title={t("Ostatnio uruchomione")} subtitle={t("Gry odpalone z NovaBlox")}
          action={recent.length > 0 && <button className="btn-ghost" onClick={() => navigate('history')}>{t("Historia")}</button>} />
        {recent.length ? <GameRow games={recent} /> : (
          <div className="card flex items-center gap-4 p-6 text-muted"><Play size={20} className="text-accent" />{t("Tu pojawią się gry, które uruchomisz z launchera.")}</div>
        )}
      </section>

      {account && <FriendsOnline />}

      {/* ULUBIONE */}
      <section>
        <SectionHeader icon={Star} title={t("Ulubione")} subtitle={t("Twoje najważniejsze gry")}
          action={favorites.length > 0 && <button className="btn-ghost" onClick={() => navigate('favorites')}>{t("Zobacz wszystkie")}</button>} />
        {favorites.length ? <GameRow games={favorites} /> : (
          <div className="card flex items-center gap-4 p-6 text-muted"><Heart size={20} className="text-accent" />{t("Kliknij serduszko na karcie gry, aby dodać ją do ulubionych.")}</div>
        )}
      </section>

      {/* POPULARNE */}
      <section>
        <SectionHeader icon={Flame} title={popular?.name ?? t("Popularne")} subtitle={t("Na żywo z Roblox")}
          action={<button className="btn-ghost" onClick={() => navigate('discover')}>{t("Discover")}</button>} />
        {error && !sorts ? <ErrorState message={error} onRetry={() => load(true)} />
          : loading && !sorts ? <SkeletonCards count={4} />
          : popular ? <GameRow games={popular.games.slice(0, 16)} /> : null}
      </section>

      {/* AKTYWNOŚĆ + STATYSTYKI */}
      <section className="grid grid-cols-[1fr_340px] gap-6">
        <div>
          <SectionHeader icon={Activity} title={t("Ostatnia aktywność")} />
          <div className="card divide-y divide-fg/5">
            {activity.length === 0 && <div className="p-6 text-muted">{t("Brak aktywności – zacznij od dodania gry do biblioteki.")}</div>}
            {activity.slice(0, 7).map(a => {
              const I = ACT_ICON[a.type]
              return (
                <button key={a.id} disabled={!a.universeId} onClick={() => a.universeId && openGame(a.universeId)}
                  className="flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition enabled:hover:bg-fg/5">
                  {a.iconUrl ? <Img src={a.iconUrl} className="h-9 w-9 rounded-lg" /> : <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent"><I size={16} /></div>}
                  <div className="min-w-0 flex-1 truncate text-sm">{a.text}</div>
                  <I size={14} className="shrink-0 text-muted" />
                  <div className="w-24 shrink-0 text-right text-xs text-muted">{timeAgo(a.at)}</div>
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <SectionHeader icon={Gamepad2} title={t("Twoje statystyki")} />
          <div className="card space-y-4 p-5">
            {[
              [t("Gier w bibliotece"), library.length],
              [t("Ulubionych"), favorites.length],
              [t("Uruchomień z launchera"), totalLaunches],
              [t("Różnych gier zagranych"), new Set(history.map(h => h.universeId)).size],
              [t("Czas gry łącznie"), sessions.length ? dur(total(sessions)) : '—']
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between">
                <span className="text-sm text-muted">{k}</span>
                <span className="h-display text-xl">{v}</span>
              </div>
            ))}
            <p className="border-t border-fg/5 pt-3 text-xs text-muted">{t("Statystyki liczone lokalnie z Twojej aktywności w NovaBlox.")}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
