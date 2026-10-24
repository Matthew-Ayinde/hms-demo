import { Eye } from 'lucide-react'

/** Marks a screen as a design preview of a later-phase module. */
export function PreviewBanner({ phase, weeks, children }: { phase: 2 | 3; weeks: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 flex gap-3 rounded-lg border border-info/20 bg-info-soft px-4 py-3 text-[13px] text-info">
      <Eye className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">
          Preview · Phase {phase} module, delivered in weeks {weeks}
        </p>
        <p className="mt-0.5 text-[12.5px] text-[#2b4f7a]">{children}</p>
      </div>
    </div>
  )
}
