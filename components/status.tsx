'use client'

import { Crown } from 'lucide-react'
import { ROOM_STATE_META, type RoomState } from '@/lib/rooms'
import type { ResStatus, Source } from '@/lib/types'
import { Badge, type Tone } from './ui'

export function RoomStateBadge({ state, short }: { state: RoomState; short?: boolean }) {
  const meta = ROOM_STATE_META[state]
  return (
    <Badge tone={meta.tone} dot>
      {short ? meta.short : meta.label}
    </Badge>
  )
}

const RES_META: Record<ResStatus, { label: string; tone: Tone }> = {
  confirmed: { label: 'Confirmed', tone: 'neutral' },
  checked_in: { label: 'In house', tone: 'brand' },
  checked_out: { label: 'Checked out', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

export function ResStatusBadge({ status }: { status: ResStatus }) {
  const meta = RES_META[status]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

const SOURCE_TONE: Record<Source, string> = {
  Website: 'text-brand',
  Phone: 'text-ink-2',
  'Walk-in': 'text-ink-2',
  'Booking.com': 'text-[#1f4f9e]',
  Expedia: 'text-[#7a5a00]',
  Corporate: 'text-brass',
}

export function SourceLabel({ source }: { source: Source }) {
  return <span className={`text-xs font-medium ${SOURCE_TONE[source]}`}>{source}</span>
}

export function VipMark({ className = '' }: { className?: string }) {
  return (
    <span title="VIP guest" className={`inline-flex items-center gap-0.5 rounded bg-brass-soft px-1 text-[10.5px] font-semibold tracking-wide text-brass ${className}`}>
      <Crown className="size-3" strokeWidth={2.2} />
      VIP
    </span>
  )
}
