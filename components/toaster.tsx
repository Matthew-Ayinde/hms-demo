'use client'

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useToasts } from '@/lib/store'
import { cn } from './ui'

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info }
const ICON_TONE = { success: 'text-ok', error: 'text-danger', info: 'text-info' }

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div className="no-print pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.tone]
        return (
          <div
            key={t.id}
            className={cn(
              'animate-toast pointer-events-auto flex gap-3 rounded-lg border bg-surface px-3.5 py-3 shadow-[0_12px_32px_-12px_rgba(27,26,23,0.3)]',
              t.tone === 'error' ? 'border-danger/30' : 'border-line',
            )}
          >
            <Icon className={cn('mt-px size-4 shrink-0', ICON_TONE[t.tone])} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{t.body}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="-mt-0.5 -mr-1 h-fit rounded p-0.5 text-ink-3 hover:text-ink" aria-label="Dismiss">
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
