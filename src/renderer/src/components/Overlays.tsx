import { t } from '@/lib/i18n'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CircleCheck, Download, Info, Sparkles, X, CircleX, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import type { UpdateInfo } from '@shared/types'
import { useUi } from '@/store/ui'
import { Logo } from './ui'

export function Toasts(): JSX.Element {
  const toasts = useUi(s => s.toasts)
  const dismiss = useUi(s => s.dismiss)
  const icons = { success: CircleCheck, error: CircleX, info: Info }
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-[360px] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map(t => {
          const I = icons[t.kind]
          return (
            <motion.div key={t.id} layout initial={{ opacity: 0, x: 40, scale: .95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40, scale: .95 }}
              className="panel pointer-events-auto flex items-start gap-3 overflow-hidden rounded-2xl p-4 shadow-card">
              <div className={clsx('absolute inset-y-0 left-0 w-1', t.kind === 'success' && 'bg-success', t.kind === 'error' && 'bg-danger', t.kind === 'info' && 'bg-accent-grad')} />
              <I size={19} className={clsx('mt-0.5 shrink-0', t.kind === 'success' && 'text-success', t.kind === 'error' && 'text-danger', t.kind === 'info' && 'text-accent')} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{t.title}</div>
                {t.body && <div className="mt-0.5 text-sm text-muted">{t.body}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-muted hover:text-fg"><X size={15} /></button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export function Modal({ open, onClose, children, width = 460 }: { open: boolean; onClose(): void; children: React.ReactNode; width?: number }): JSX.Element {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}
          className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-6 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: .94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onMouseDown={e => e.stopPropagation()} style={{ width }}
            className="panel relative max-w-full rounded-3xl p-7 shadow-card">
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ConfirmDialog(): JSX.Element {
  const req = useUi(s => s.confirm)
  return (
    <Modal open={!!req} onClose={() => req?.resolve(false)}>
      {req && (
        <>
          <div className={clsx('mb-5 grid h-12 w-12 place-items-center rounded-2xl', req.danger ? 'bg-danger/15 text-danger' : 'bg-accent/15 text-accent')}>
            <AlertTriangle size={22} />
          </div>
          <h3 className="h-display text-2xl">{req.title}</h3>
          <p className="mt-2 text-muted">{req.body}</p>
          <div className="mt-7 flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => req.resolve(false)}>{t("Anuluj")}</button>
            <button autoFocus className={req.danger ? 'btn-danger' : 'btn-primary'} onClick={() => req.resolve(true)}>{req.confirmLabel ?? t("Potwierdź")}</button>
          </div>
        </>
      )}
    </Modal>
  )
}

export function SplashScreen({ status }: { status: string }): JSX.Element {
  return (
    <motion.div exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: .45 }}
      className="drag fixed inset-0 z-[100] grid place-items-center bg-bg">
      <div className="app-bg"><div className="grad" /><div className="noise" /></div>
      <div className="relative flex flex-col items-center">
        <motion.div initial={{ scale: .6, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 16 }}
          className="relative">
          <div className="absolute inset-0 scale-150 rounded-full bg-accent/40 blur-3xl" />
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 12, ease: 'linear' }} className="relative">
            <Logo size={96} />
          </motion.div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25 }} className="mt-8 text-center">
          <div className="h-display text-4xl tracking-wider">{t("NOVA")}<span className="text-grad">{t("BLOX")}</span></div>
          <div className="mt-1 text-xs uppercase tracking-[.35em] text-muted">{t("Premium Launcher")}</div>
        </motion.div>
        <div className="mt-10 h-1 w-56 overflow-hidden rounded-full bg-fg/10">
          <motion.div className="h-full w-1/3 rounded-full bg-accent-grad" animate={{ x: ['-100%', '300%'] }} transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }} />
        </div>
        <div className="mt-4 text-sm text-muted">{status}</div>
      </div>
    </motion.div>
  )
}

export function UpdateScreen({ info, onClose }: { info: UpdateInfo | null; onClose(): void }): JSX.Element {
  const [pct, setPct] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const install = async (): Promise<void> => {
    setErr(null); setPct(0)
    const off = window.nova.system.onUpdateProgress(p => setPct(Math.round(p.percent)))
    try { await window.nova.system.installUpdate() } catch (e) {
      off(); setPct(null); setErr((e as Error).message)
      if (info?.url) void window.nova.system.openExternal(info.url)
    }
  }
  return (
    <Modal open={!!info} onClose={onClose} width={520}>
      {info && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 rounded-t-3xl bg-gradient-to-b from-accent/25 to-transparent" />
          <div className="relative">
            <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-accent-grad text-white shadow-glow"><Sparkles size={26} /></div>
            <div className="label">{t("Dostępna aktualizacja")}</div>
            <h3 className="h-display mt-1 text-3xl">{t("NovaBlox")} {info.latest}</h3>
            <p className="mt-1 text-sm text-muted">{t("Masz wersję")} {info.current}</p>
            {info.notes && (
              <div className="scroll mt-5 max-h-48 whitespace-pre-wrap rounded-2xl bg-fg/5 p-4 text-sm text-muted">{info.notes}</div>
            )}
            {pct !== null && (
              <div className="mt-5">
                <div className="h-2 overflow-hidden rounded-full bg-fg/10"><div className="h-full rounded-full bg-accent-grad transition-all" style={{ width: `${pct}%` }} /></div>
                <div className="mt-2 text-xs text-muted">{pct >= 100 ? t("Instalowanie aktualizacji…") : t("Pobieranie… {0}%", [pct])}</div>
              </div>
            )}
            {err && <div className="mt-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</div>}
            <div className="mt-7 flex justify-end gap-2">
              <button className="btn-secondary" onClick={onClose} disabled={pct !== null}>{t("Później")}</button>
              <button className="btn-primary" onClick={install} disabled={pct !== null}>
                {pct !== null ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {t("Zaktualizuj teraz")}
              </button>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
