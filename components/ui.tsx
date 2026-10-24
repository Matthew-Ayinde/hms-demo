'use client'

import clsx, { type ClassValue } from 'clsx'
import { forwardRef } from 'react'

export const cn = (...v: ClassValue[]) => clsx(v)

/* ---------- Button ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type ButtonSize = 'sm' | 'md' | 'lg'

const buttonBase =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-sunken',
  ghost: 'text-ink-2 hover:bg-black/[0.04] hover:text-ink',
  danger: 'bg-danger text-white hover:bg-[#9a1d14]',
  subtle: 'bg-brand-soft text-brand hover:bg-brand-line/60',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8.5 px-3 text-[13px]',
  lg: 'h-11 px-5 text-sm',
}

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...props} />
})

/* ---------- Badge ---------- */

export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger' | 'info' | 'brass'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-[#efede8] text-ink-2',
  brand: 'bg-brand-soft text-brand',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  brass: 'bg-brass-soft text-brass',
}

const dotClasses: Record<Tone, string> = {
  neutral: 'bg-ink-3',
  brand: 'bg-brand',
  ok: 'bg-ok',
  warn: 'bg-[#c98a12]',
  danger: 'bg-danger',
  info: 'bg-info',
  brass: 'bg-brass',
}

export function Badge({ tone = 'neutral', dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex h-5 items-center gap-1.5 rounded px-1.5 text-[11.5px] font-medium whitespace-nowrap', toneClasses[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full', dotClasses[tone])} />}
      {children}
    </span>
  )
}

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', dotClasses[tone], className)} />
}

/* ---------- Panel ---------- */

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('rounded-card border border-line bg-surface', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-[13px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

/* ---------- Page header ---------- */

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ---------- Form controls ---------- */

const controlBase =
  'w-full rounded-md border border-line-strong bg-surface px-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:bg-sunken disabled:text-ink-3'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(controlBase, 'h-8.5', className)} {...props} />
})

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(controlBase, 'h-8.5 pr-7', className)} {...props}>
      {children}
    </select>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(controlBase, 'py-2', className)} {...props} />
})

export function Field({ label, hint, error, children, className }: { label: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-3">{hint}</span> : null}
    </label>
  )
}

/* ---------- Tabs ---------- */

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T
  onChange: (v: T) => void
  items: { value: T; label: React.ReactNode; count?: number }[]
  className?: string
}) {
  return (
    <div role="tablist" className={cn('flex gap-1 border-b border-line', className)}>
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors',
              active ? 'border-brand text-ink' : 'border-transparent text-ink-3 hover:text-ink-2',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn('num rounded px-1.5 text-[11px]', active ? 'bg-brand-soft text-brand' : 'bg-[#efede8] text-ink-3')}>{item.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-md border border-line-strong bg-surface p-0.5">
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'h-7 rounded px-2.5 text-xs font-medium transition-colors',
            value === item.value ? 'bg-brand text-white' : 'text-ink-2 hover:text-ink',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Misc ---------- */

export function Avatar({ initials, size = 'md', tone = 'brand' }: { initials: string; size?: 'sm' | 'md' | 'lg'; tone?: 'brand' | 'neutral' | 'brass' }) {
  const sizes = { sm: 'size-6 text-[10px]', md: 'size-8 text-xs', lg: 'size-10 text-sm' }
  const tones = { brand: 'bg-brand-soft text-brand', neutral: 'bg-[#efede8] text-ink-2', brass: 'bg-brass-soft text-brass' }
  return <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', sizes[size], tones[tone])}>{initials}</span>
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-xs text-ink-3">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function KeyValue({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5 text-[13px]', className)}>
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  )
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className={cn('w-full border-collapse text-[13px]', className)}>{children}</table>
    </div>
  )
}

export function Th({ children, className, align = 'left' }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) {
  return (
    <th className={cn('border-b border-line bg-sunken px-4 py-2 text-[11.5px] font-medium tracking-wide whitespace-nowrap text-ink-3 uppercase', align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>
      {children}
    </th>
  )
}

export function Td({ children, className, align = 'left', colSpan }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center'; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn('border-b border-line px-4 py-2.5 align-middle', align === 'right' && 'num text-right', align === 'center' && 'text-center', className)}>
      {children}
    </td>
  )
}
