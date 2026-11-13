import { Users, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { useFriends, presenceColor, presenceLabel, presenceRank } from '@/lib/useFriends'
import { t } from '@/lib/i18n'
import { Img, SectionHeader } from './ui'
import { useApp } from '@/store/app'

export function FriendsOnline(): JSX.Element {
  const { friends, presence, error, loading, refresh, updatedAt } = useFriends()
  const withSession = useApp(s => s.account?.mode === 'cookie')
  const sorted = [...friends].sort((a, b) => presenceRank(presence[a.userId]) - presenceRank(presence[b.userId]))
  const online = sorted.filter(f => presenceRank(presence[f.userId]) < 5)
  return (
    <section>
      <SectionHeader icon={Users} title={t('Znajomi online')} subtitle={updatedAt ? t('{0} z {1} online · odświeżane co minutę', [online.length, friends.length]) : undefined}
        action={<button className="btn-ghost" onClick={() => refresh()}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>} />
      {error && !friends.length ? <div className="card p-5 text-sm text-muted">{t('Nie udało się pobrać statusu znajomych: {0}', [error])}</div>
        : !updatedAt ? <div className="flex gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-28 w-28 rounded-2xl" />)}</div>
        : online.length === 0 ? <div className="card p-5 text-sm text-muted">{friends.length ? t('Nikt ze znajomych nie jest teraz online.') : t('Brak publicznej listy znajomych.')}</div>
        : (
          <div className="hide-scroll flex gap-3 overflow-x-auto pb-1">
            {online.map(f => {
              const p = presence[f.userId]
              return (
                <button key={f.userId} onClick={() => window.nova.system.openExternal(`https://www.roblox.com/users/${f.userId}/profile`)}
                  className="card card-hover w-32 shrink-0 p-3 text-center">
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
        )}
      {!withSession && <p className="mt-2 text-xs text-muted">{t('Roblox bez zalogowania ciasteczkiem pokazuje tylko status – nazwa gry pojawia się, gdy Roblox ją udostępni.')}</p>}
    </section>
  )
}
