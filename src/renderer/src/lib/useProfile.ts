import { create } from 'zustand'
import { useEffect } from 'react'
import type { UserProfile } from '@shared/types'

interface ProfileCache {
  profiles: Record<number, UserProfile>
  errors: Record<number, string>
  load(id: number, force?: boolean): Promise<void>
}

export const useProfiles = create<ProfileCache>((set, get) => ({
  profiles: {},
  errors: {},
  async load(id, force) {
    if (!force && get().profiles[id]) return
    try {
      const p = await window.nova.roblox.profile(id)
      set({ profiles: { ...get().profiles, [id]: p }, errors: { ...get().errors, [id]: '' } })
    } catch (e) {
      set({ errors: { ...get().errors, [id]: (e as Error).message } })
    }
  }
}))

/** Profil Roblox użytkownika (z cache) */
export function useProfile(userId: number | undefined | null): { profile: UserProfile | null; error: string; reload(): void } {
  const profile = useProfiles(s => (userId ? s.profiles[userId] ?? null : null))
  const error = useProfiles(s => (userId ? s.errors[userId] ?? '' : ''))
  const load = useProfiles(s => s.load)
  useEffect(() => { if (userId) void load(userId) }, [userId, load])
  return { profile, error, reload: () => { if (userId) void load(userId, true) } }
}
