'use client'

import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './ui'

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  side = false,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Slide-over panel anchored to the right edge. */
  side?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

  return createPortal(
    <div className={cn('fixed inset-0 z-50 flex', side ? 'justify-end' : 'items-start justify-center overflow-y-auto p-4 sm:p-8')}>
      <div className="fixed inset-0 bg-[#1b1a17]/35" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'relative flex w-full flex-col bg-surface shadow-[0_24px_60px_-20px_rgba(27,26,23,0.35)] outline-none',
          side ? 'h-full max-w-lg border-l border-line' : cn('my-auto rounded-xl border border-line', widths[size]),
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-1.5 rounded-md p-1.5 text-ink-3 hover:bg-black/[0.04] hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </header>
        <div className={cn('px-5 py-4', side && 'flex-1 overflow-y-auto')}>{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-sunken px-5 py-3 rounded-b-xl">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
