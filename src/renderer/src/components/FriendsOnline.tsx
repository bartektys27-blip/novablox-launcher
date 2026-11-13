import { useState } from 'react'
import { Users, RefreshCw, Gamepad2, LogIn, Loader2, ExternalLink } from 'lucide-react'
import clsx from 'clsx'
import type { Friend, FriendPresence, GameInfo } from '@shared/types'
import { useFriends, presenceColor, presenceLabel, presenceRank } from '@/lib/useFriends'
import { t } from '@/lib/i18n'
import { Img, SectionHeader } from './ui'
import { useApp } from '@/store/app'
import { toast } from '@/store/ui'

interface GameGroup {
  key: string
  universeId: number | null
  placeId: number | null
  name: string
  game: GameInfo | null
  players: { friend: Friend; p: FriendPresence }[]
}

/** Znajomi online + w co grają (pogrupowani po grze) */
export function FriendsOnline(): JSX.Element {
  const { friends, presence, games, error, loading, refresh, updatedAt } = useFriends()
  const withSession = useApp(s => s.account?.mode === 'cookie')
  const openGame = useApp(s => s.openGame)
  const [joining, setJoining] = useState<number | null>(null)

  const sorted = [...friends].sort((a, b) => presenceRank(presence[a.userId]) - presenceRank(presence[b.userId]))
  const online = sorted.filter(f => presenceRank(presence[f.userId]) < 5)

  // Grupowanie grających znajomych po grze
  const groups: GameGroup[] = []
  const rest: Friend[] = []
  for (const f of online) {
    const p = presence[f.userId]
    if (p?.type !== 'in-game') { rest.push(f); continue }
    const game = p.universeId ? games[p.universeId] ?? null : null
    const name = game?.name || p.location || ''
    const key = p.universeId ? `u${p.universeId}` : name ? `n${name}` : `f${f.userId}`
    let g = groups.find(x => x.key === key)
    if (!g) groups.push((g = { key, universeId: p.universeId, placeId: p.placeId, name, game, players: [] }))
    g.players.push({ friend: f, p })
  }
  groups.sort((a, b) => b.players.length - a.players.length)

  const join = async (friend: Friend, p: FriendPresence, g: GameGroup): Promise<void> => {
    const placeId = p.joinPlaceId ?? p.placeId
    if (!placeId) return
    setJoining(friend.userId)
    try {
      if (p.gameId) await window.nova.roblox.joinServer(placeId, p.gameId)
      else await window.nova.roblox.launch(placeId)
      toast.success(p.gameId ? t('Dołączanie do {0}…', [friend.displayName]) : t('Uruchamianie gry…'), g.name || undefined)
    } catch (e) {
      toast.error(t('Nie udało się dołączyć'), (e as Error).message)
    } finally { setJoining(null) }
  }

  const profile = (f: Friend): void => void window.nova.system.openExternal(`https://www.roblox.com/users/${f.userId}/profile`)

  return (
    <section>
      <SectionHeader icon={Users} title={t('Znajomi online')} subtitle={updatedAt ? t('{0} z {1} online · odświeżane co minutę', [online.length, friends.length]) : undefined}
        action={<button className="btn-ghost" onClick={() => refresh()}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>} />
      {error && !friends.length ? <div className="card p-5 text-sm text-muted">{t('Nie udało się pobrać statusu znajomych: {0}', [error])}</div>
        : !updatedAt ? <div className="flex gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-28 w-28 rounded-2xl" />)}</div>
        : online.length === 0 ? <div className="card p-5 text-sm text-muted">{friends.length ? t('Nikt ze znajomych nie jest teraz online.') : t('Brak publicznej listy znajomych.')}</div>
        : (
          <div className="space-y-4">
            {groups.length > 0 && (
              <div>
                <div className="label mb-2 flex items-center gap-2"><Gamepad2 size={13} /> {t('Grają teraz')}</div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {groups.map(g => (
                    <div key={g.key} className="card relative overflow-hidden p-4">
                      {g.game?.thumbnailUrl && <img src={g.game.thumbnailUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15 blur-sm" />}
                      <div className="relative flex items-center gap-3">
                        <Img src={g.game?.iconUrl ?? null} className="h-14 w-14 shrink-0 rounded-xl" fallback={<Gamepad2 size={18} />} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{g.name || t('Ukryta gra')}</div>
                          <div className="text-xs text-muted">{t('Znajomych w grze: {0}', [g.players.length])}{g.game?.playing != null && ` · ${t('{0} gra teraz', [g.game.playing.toLocaleString()])}`}</div>
                        </div>
                        {g.universeId && <button className="btn-ghost h-9 px-3" title={t('Szczegóły gry')} onClick={() => openGame(g.universeId!)}><ExternalLink size={15} /></button>}
                      </div>
                      <div className="relative mt-3 space-y-1.5">
                        {g.players.map(({ friend, p }) => (
                          <div key={friend.userId} className="flex items-center gap-2 rounded-xl bg-fg/5 p-1.5 pr-2">
                            <button onClick={() => profile(friend)} className="relative shrink-0">
                              <Img src={friend.headshotUrl} className="h-8 w-8 rounded-lg" fallback={<Users size={14} />} />
                              <span className={clsx('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-surface', presenceColor(p))} />
                            </button>
                            <button onClick={() => profile(friend)} className="min-w-0 flex-1 truncate text-left text-sm font-medium">{friend.displayName}</button>
                            {(p.joinPlaceId ?? p.placeId) && (
                              <button className="btn-primary h-7 px-2.5 text-xs" disabled={joining !== null} onClick={() => join(friend, p, g)}
                                title={p.gameId ? t('Dołącz na ten sam serwer') : t('Uruchom tę grę')}>
                                {joining === friend.userId ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />} {p.gameId ? t('Dołącz') : t('Graj')}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {rest.length > 0 && (
              <div>
                {groups.length > 0 && <div className="label mb-2">{t('Online')}</div>}
                <div className="hide-scroll flex gap-3 overflow-x-auto pb-1">
                  {rest.map(f => {
                    const p = presence[f.userId]
                    return (
                      <button key={f.userId} onClick={() => profile(f)} className="card card-hover w-32 shrink-0 p-3 text-center">
                        <div className="relative mx-auto h-16 w-16">
                          <Img src={f.headshotUrl} className="h-16 w-16 rounded-2xl" fallback={<Users size={18} />} />
                          <span className={clsx('absolute -bottom-1 -right-1 h-4 w-4 rounded-full ring-4 ring-surface', presenceColor(p))} />
                        </div>
                        <div className="mt-2 truncate text-sm font-semibold">{f.displayName}</div>
                        <div className="truncate text-[11px] text-muted" title={presenceLabel(p)}>{presenceLabel(p)}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      {!withSession && <p className="mt-2 text-xs text-muted">{t('Roblox bez zalogowania ciasteczkiem pokazuje tylko status – nazwa gry pojawia się, gdy Roblox ją udostępni.')}</p>}
    </section>
  )
}
