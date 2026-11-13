import { create } from 'zustand'
import { t } from '@/lib/i18n'

export interface Toast { id: number; kind: 'success' | 'error' | 'info'; title: string; body?: string }
interface ConfirmReq {
  title: string
  body: string
  confirmLabel?: string
  danger?: boolean
  resolve(v: boolean): void
}

interface UiState {
  toasts: Toast[]
  confirm: ConfirmReq | null
  push(t: Omit<Toast, 'id'>): void
  dismiss(id: number): void
}

let seq = 0
export const useUi = create<UiState>((set, get) => ({
  toasts: [],
  confirm: null,
  push(t) {
    const id = ++seq
    set({ toasts: [...get().toasts, { ...t, id }].slice(-4) })
    setTimeout(() => get().dismiss(id), t.kind === 'error' ? 6000 : 3500)
  },
  dismiss(id) { set({ toasts: get().toasts.filter(t => t.id !== id) }) }
}))

export const toast = {
  // Tytuły tłumaczone tutaj, więc działa też dla komunikatów przekazanych jako zmienne
  success: (title: string, body?: string) => useUi.getState().push({ kind: 'success', title: t(title), body: body && t(body) }),
  error: (title: string, body?: string) => useUi.getState().push({ kind: 'error', title: t(title), body: body && t(body) }),
  info: (title: string, body?: string) => useUi.getState().push({ kind: 'info', title: t(title), body: body && t(body) })
}

/** Okno potwierdzenia przed ważnymi operacjami */
export function confirmAction(opts: Omit<ConfirmReq, 'resolve'>): Promise<boolean> {
  return new Promise(resolve => {
    useUi.setState({
      confirm: {
        ...opts,
        resolve: v => { useUi.setState({ confirm: null }); resolve(v) }
      }
    })
  })
}
