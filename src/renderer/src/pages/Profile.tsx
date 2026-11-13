import { accountModeLabel, t } from '@/lib/i18n'
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { BadgeCheck, CalendarDays, Clock, Copy, ExternalLink, Hash, Heart, LogOut, RefreshCw, ShieldCheck, Star, UserPlus, Users, AtSign } from 'lucide-react'
import { useApp, type CardGame } from '@/store/app'
import { useProfile } from '@/lib/useProfile'
import { useAsync } from '@/lib/useAsync'
import { confirmAction, toast } from '@/store/ui'
import { date, fmt } from '@/lib/format'
import { EmptyState, ErrorState, Img, SectionHeader, SkeletonCards } from '@/components/ui'
import { GameRow } from '@/components/GameCard'
import { ConnectAccount } from './Connect'
import { useFriends, presenceColor, presenceLabel, presenceRank } from '@/lib/useFriends'
import clsx from 'clsx'

export function useLogout(): () => Promise<void> {
  const removeAccount = useApp(s => s.removeAccount)
  return async () => {
    const acc = useApp.getState().account
    if (!acc) return
    const body = acc.mode === 'cookie'
      ? t('Konto @{0} zostanie usunięte z launchera, a jego sesja unieważniona w Roblox. Biblioteka, historia i ustawienia pozostaną na tym komputerze.', [acc.username])
      : t('Launcher usunie zapisaną sesję i dane profilu. Biblioteka, historia i ustawienia pozostaną na tym komputerze.')
    if (!(await confirmAction({ title: t('Wylogować się?'), body, confirmLabel: t('Wyloguj'), danger: true }))) return
    await removeAccount(acc.userId)
    toast.info(t('Wylogowano'))
  }
}

export default function Profile(): JSX.Element {
  const account = useApp(s => s.account)
  const library = useApp(s => s.library)
  const history = useApp(s => s.history)
  const { profile, error, reload } = useProfile(account?.userId)
  const logout = useLogout()
  const friends = useAsync(() => (account ? window.nova.roblox.friends(account.userId) : Promise.resolve([])), [account?.userId])
  const presence = useFriends(s => s.presence)
  const robloxFavs = useAsync(() => (account ? window.nova.roblox.userFavorites(account.userId) : Promise.resolve([])), [account?.userId])

  const recent = useMemo(() => {
    const seen = new Set<number>(); const out: CardGame[] = []
    for (const h of history) {
      if (seen.has(h.universeId)) continue
      seen.add(h.universeId)
      out.push(library.find(l => l.universeId === h.universeId) ?? { universeId: h.universeId, placeId: h.placeId, name: h.name, iconUrl: h.iconUrl, thumbnailUrl: null, playing: null, creatorName: '', genre: '' })
    }
    return out.slice(0, 12)
  }, [history, library])

  if (!account) {
    return (
      <div className="mx-auto max-w-[560px] pt-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-accent-grad text-white shadow-glow"><UserPlus size={34} /></div>
          <h1 className="h-display text-4xl">{t("Połącz konto Roblox")}</h1>
          <p className="mt-2 text-muted">{t("Zobacz swój avatar, opis, znajomych i ulubione gry prosto w launcherze.")}</p>
        </div>
        <div className="panel rounded-[28px] p-7"><ConnectAccount /></div>
      </div>
    )
  }

  const copyId = (): void => { void navigator.clipboard.writeText(String(account.userId)); toast.success(t("Skopiowano User ID"), String(account.userId)) }
  const favs = library.filter(g => g.favorite)

  return (
    <div className="space-y-10">
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[28px] border border-fg/5">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/30 via-surface to-accent2/20" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent2/30 blur-[120px]" />
        <div className="relative flex items-end gap-8 p-10">
          <div className="relative h-56 w-56 shrink-0">
            <div className="absolute inset-4 rounded-full bg-accent/40 blur-3xl" />
            {profile?.avatarUrl ? <img src={profile.avatarUrl} draggable={false} className="relative h-full w-full object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,.55)]" /> : <div className="skeleton relative h-full w-full rounded-3xl" />}
          </div>
          <div className="min-w-0 flex-1 pb-2">
            <div className="flex items-center gap-2">
              <h1 className="h-display truncate text-5xl">{profile?.displayName ?? account.displayName}</h1>
              {profile?.hasVerifiedBadge && <BadgeCheck className="shrink-0 text-accent2" size={30} />}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/30 px-3 py-1.5"><AtSign size={14} />{profile?.username ?? account.username}</span>
              <button onClick={copyId} className="inline-flex items-center gap-1.5 rounded-lg bg-black/30 px-3 py-1.5 transition hover:bg-black/50" title={t("Kopiuj User ID")}><Hash size={14} />{account.userId}<Copy size={12} className="opacity-60" /></button>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/30 px-3 py-1.5"><CalendarDays size={14} />{t("Na Roblox od")} {date(profile?.created)}</span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/30 px-3 py-1.5"><ShieldCheck size={14} />{accountModeLabel(account.mode)}</span>
            </div>
            <div className="mt-6 flex gap-8">
              {[[t("Znajomi"), profile?.friendsCount], [t("Obserwujący"), profile?.followersCount], [t("Obserwowani"), profile?.followingsCount]].map(([k, v]) => (
                <div key={k as string}><div className="h-display text-3xl">{fmt(v as number | null | undefined)}</div><div className="text-xs uppercase tracking-wider text-muted">{k}</div></div>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 pb-2">
            <button className="btn-primary" onClick={() => window.nova.system.openExternal(profile?.profileUrl ?? `https://www.roblox.com/users/${account.userId}/profile`)}><ExternalLink size={15} /> {t("Profil na Roblox")}</button>
            <button className="btn-secondary" onClick={() => { reload(); friends.reload(); robloxFavs.reload() }}><RefreshCw size={15} /> {t("Odśwież")}</button>
            <button className="btn-ghost text-danger hover:!text-danger" onClick={logout}><LogOut size={15} /> {t("Wyloguj")}</button>
          </div>
        </div>
      </motion.section>

      {error && !profile && <ErrorState message={error} onRetry={reload} />}

      <section className="grid grid-cols-[1fr_380px] gap-6">
        <div className="card p-6">
          <h2 className="h-display mb-3 text-xl">{t("O mnie")}</h2>
          {profile?.description ? <p className="select-text whitespace-pre-line text-fg/80">{profile.description}</p> : <p className="text-muted">{profile ? t("Ten użytkownik nie ma opisu.") : t("Wczytywanie…")}</p>}
        </div>
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="h-display text-xl">{t("Znajomi")}</h2>
            <span className="text-sm text-muted">{fmt(profile?.friendsCount)}</span>
          </div>
          {friends.error ? <p className="text-sm text-muted">{t("Roblox nie udostępnił listy znajomych (")}{friends.error}).</p>
            : friends.loading ? <div className="grid grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton aspect-square rounded-2xl" />)}</div>
            : !friends.data?.length ? <p className="text-sm text-muted">{t("Brak publicznych znajomych.")}</p>
            : (
              <div className="scroll grid max-h-[260px] grid-cols-4 gap-3 pr-1">
                {[...friends.data].sort((a, b) => presenceRank(presence[a.userId]) - presenceRank(presence[b.userId])).map(f => (
                  <button key={f.userId} title={`${f.displayName} (@${f.username}) · ${presenceLabel(presence[f.userId])}`} onClick={() => window.nova.system.openExternal(`https://www.roblox.com/users/${f.userId}/profile`)} className="group text-center">
                    <div className="relative">
                      <Img src={f.headshotUrl} className="aspect-square w-full rounded-2xl bg-fg/5 transition group-hover:ring-2 group-hover:ring-accent" fallback={<Users size={18} />} />
                      <span className={clsx('absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full ring-[3px] ring-surface', presenceColor(presence[f.userId]))} />
                    </div>
                    <div className="mt-1 truncate text-[11px] text-muted group-hover:text-fg">{f.displayName}</div>
                  </button>
                ))}
              </div>
            )}
        </div>
      </section>

      <section>
        <SectionHeader icon={Star} title={t("Ulubione na Roblox")} subtitle={t("Publiczna lista ulubionych z profilu Roblox")} />
        {robloxFavs.error ? <ErrorState message={robloxFavs.error} onRetry={robloxFavs.reload} />
          : robloxFavs.loading ? <SkeletonCards count={4} />
          : robloxFavs.data?.length ? <GameRow games={robloxFavs.data} />
          : <div className="card p-6 text-muted">{t("Brak publicznych ulubionych gier na profilu Roblox.")}</div>}
      </section>

      <section>
        <SectionHeader icon={Heart} title={t("Ulubione w NovaBlox")} />
        {favs.length ? <GameRow games={favs} /> : <div className="card p-6 text-muted">{t("Brak ulubionych w launcherze.")}</div>}
      </section>

      <section>
        <SectionHeader icon={Clock} title={t("Ostatnio grane")} subtitle={t("Uruchomione z NovaBlox")} />
        {recent.length ? <GameRow games={recent} /> : <EmptyState icon={Clock} title={t("Jeszcze nic")} text={t("Uruchom grę z launchera, aby pojawiła się tutaj.")} />}
      </section>
    </div>
  )
}
