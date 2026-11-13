import { t } from '@/lib/i18n'
import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ImageOff, RefreshCw, type LucideIcon } from 'lucide-react'
import clsx from 'clsx'

export function Logo({ size = 28 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="8" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgb(var(--accent))" />
          <stop offset="1" stopColor="rgb(var(--accent2))" />
        </linearGradient>
      </defs>
      <path d="M32 3 57 17.5v29L32 61 7 46.5v-29L32 3Z" fill="url(#lg)" />
      <path d="M32 3 57 17.5v29L32 61 7 46.5v-29L32 3Z" stroke="white" strokeOpacity=".25" strokeWidth="2" />
      <path d="M22 44V20l20 24V20" stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Img({ src, alt = '', className, fallback }: { src: string | null | undefined; alt?: string; className?: string; fallback?: ReactNode }): JSX.Element {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  if (!src || failed) {
    return (
      <div className={clsx('grid place-items-center bg-gradient-to-br from-accent/30 to-accent2/20 text-fg/60', className)}>
        {fallback ?? <ImageOff size={22} />}
      </div>
    )
  }
  return (
    <div className={clsx('relative overflow-hidden', className)}>
      {!loaded && <div className="skeleton absolute inset-0" />}
      <img src={src} alt={alt} draggable={false} onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
        className={clsx('h-full w-full object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')} />
    </div>
  )
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange(v: boolean): void; disabled?: boolean }): JSX.Element {
  return (
    <button role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
      className={clsx('relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40', checked ? 'bg-accent-grad' : 'bg-fg/15')}>
      <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 35 }}
        className={clsx('absolute top-1 h-4 w-4 rounded-full bg-white shadow', checked ? 'right-1' : 'left-1')} />
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange, id }: { value: T; options: { value: T; label: string; icon?: LucideIcon }[]; onChange(v: T): void; id: string }): JSX.Element {
  return (
    <div className="inline-flex rounded-xl bg-fg/5 p-1 border border-fg/5">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={clsx('relative flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium transition-colors', value === o.value ? 'text-white' : 'text-muted hover:text-fg')}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-accent-grad" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          {o.icon && <o.icon size={14} className="relative" />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function SectionHeader({ title, subtitle, action, icon: Icon }: { title: string; subtitle?: string; action?: ReactNode; icon?: LucideIcon }): JSX.Element {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {Icon && <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent"><Icon size={18} /></div>}
        <div>
          <h2 className="h-display text-xl">{title}</h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }): JSX.Element {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="h-display text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }): JSX.Element {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="card flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-3xl bg-accent/40 blur-2xl" />
        <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-accent-grad text-white shadow-glow"><Icon size={34} /></div>
      </div>
      <h3 className="h-display text-2xl">{title}</h3>
      <p className="mt-2 max-w-md text-muted">{text}</p>
      {action && <div className="mt-6 flex gap-2">{action}</div>}
    </motion.div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?(): void }): JSX.Element {
  return (
    <div className="card flex items-center gap-4 border-danger/30 p-5">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger/15 text-danger"><AlertTriangle size={20} /></div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{t("Nie udało się wczytać danych")}</div>
        <div className="truncate text-sm text-muted">{message}</div>
      </div>
      {onRetry && <button className="btn-secondary" onClick={onRetry}><RefreshCw size={15} /> {t("Ponów")}</button>}
    </div>
  )
}

export function Stat({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: ReactNode; hint?: string }): JSX.Element {
  return (
    <div className="card p-4" title={hint}>
      <div className="flex items-center gap-2 text-muted"><Icon size={15} /><span className="label !tracking-[.1em]">{label}</span></div>
      <div className="mt-2 h-display text-2xl">{value}</div>
    </div>
  )
}

export function SkeletonCards({ count = 6 }: { count?: number }): JSX.Element {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(var(--card-min), 1fr))' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="skeleton aspect-[16/10]" />
          <div className="space-y-2 p-4"><div className="skeleton h-4 w-3/4 rounded" /><div className="skeleton h-3 w-1/2 rounded" /></div>
        </div>
      ))}
    </div>
  )
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' | 'live' }): JSX.Element {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur',
      tone === 'accent' && 'bg-accent/25 text-white',
      tone === 'live' && 'bg-black/55 text-white',
      tone === 'default' && 'bg-fg/10 text-fg/80')}>
      {children}
    </span>
  )
}
