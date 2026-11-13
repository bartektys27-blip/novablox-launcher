import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> { data: T | null; error: string | null; loading: boolean; reload(): void }

/** Pobiera dane i zwraca stan ładowania/błędu z możliwością ponowienia */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const live = useRef(0)

  useEffect(() => {
    const id = ++live.current
    setLoading(true)
    setError(null)
    fn()
      .then(d => { if (id === live.current) setData(d) })
      .catch(e => { if (id === live.current) setError((e as Error).message) })
      .finally(() => { if (id === live.current) setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick(t => t + 1), [])
  return { data, error, loading, reload }
}
