'use client'

import { useState } from 'react'
import type { RoomTypeId } from '@/lib/types'
import { cn } from './ui'

/**
 * Shows /rooms/{std|dlx|exs}.jpg when the client's photos are dropped into
 * public/rooms; otherwise falls back to a flat illustration.
 */
export function RoomVisual({ typeId, className }: { typeId: RoomTypeId; className?: string }) {
  const [failed, setFailed] = useState(false)
  const src = `/rooms/${typeId.toLowerCase()}.jpg`
  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" onError={() => setFailed(true)} className={cn('h-full w-full object-cover', className)} />
    )
  }
  return <RoomIllustration typeId={typeId} className={className} />
}

const WALLS: Record<RoomTypeId, string> = { STD: '#ebe5da', DLX: '#e4e6de', EXS: '#dfe6e3' }

function RoomIllustration({ typeId, className }: { typeId: RoomTypeId; className?: string }) {
  const lagoon = typeId !== 'STD'
  const suite = typeId === 'EXS'
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={cn('h-full w-full', className)} aria-hidden>
      <rect width="400" height="240" fill={WALLS[typeId]} />
      <rect y="176" width="400" height="64" fill="#d5cdbd" />
      <rect y="176" width="400" height="3" fill="#c7beac" />
      {/* window */}
      <g transform={suite ? 'translate(250 34)' : 'translate(262 40)'}>
        <rect width={suite ? 128 : 110} height="104" rx="2" fill="#f7f5ef" />
        <rect x="6" y="6" width={suite ? 116 : 98} height="92" fill={lagoon ? '#cfe0e0' : '#dde3e8'} />
        {lagoon ? (
          <>
            <rect x="6" y="62" width={suite ? 116 : 98} height="36" fill="#9fc0bd" />
            <path d={`M10 72h${suite ? 40 : 30}M30 80h${suite ? 50 : 40}M14 89h${suite ? 36 : 26}`} stroke="#d9e8e6" strokeWidth="2" strokeLinecap="round" />
            <rect x="6" y="56" width={suite ? 116 : 98} height="6" fill="#b9cbb8" />
          </>
        ) : (
          <>
            <rect x="14" y="44" width="16" height="54" fill="#c4ccd3" />
            <rect x="34" y="30" width="20" height="68" fill="#b6bfc8" />
            <rect x="58" y="52" width="14" height="46" fill="#c4ccd3" />
            <rect x="76" y="38" width="22" height="60" fill="#aeb8c2" />
          </>
        )}
        <rect x={suite ? 61 : 52} y="6" width="6" height="92" fill="#f7f5ef" />
        <rect x="-8" y="-6" width="14" height="118" fill="#cbbfa8" opacity="0.7" />
        <rect x={suite ? 122 : 104} y="-6" width="14" height="118" fill="#cbbfa8" opacity="0.7" />
      </g>
      {/* lamp + side table */}
      <g transform={suite ? 'translate(196 112)' : 'translate(214 112)'}>
        <rect x="0" y="34" width="34" height="34" rx="2" fill="#8d7356" />
        <rect x="15" y="10" width="4" height="24" fill="#5f5141" />
        <path d="M5 12h24l-5-18H10z" fill="#f2e6cf" />
      </g>
      {/* bed */}
      <g transform={suite ? 'translate(28 92)' : 'translate(40 92)'}>
        <rect x="0" y="0" width={suite ? 166 : 172} height="62" rx="4" fill="#7c634a" />
        <rect x="-6" y="48" width={suite ? 178 : 184} height="44" rx="5" fill="#f8f6f1" />
        <rect x="-6" y="66" width={suite ? 178 : 184} height="26" rx="4" fill="#efebe3" />
        <rect x="-6" y="72" width={suite ? 178 : 184} height="9" fill="#1e4a41" />
        <rect x="10" y="32" width="58" height="22" rx="6" fill="#ffffff" />
        <rect x={suite ? 96 : 102} y="32" width="58" height="22" rx="6" fill="#ffffff" />
        {typeId !== 'STD' && <rect x={suite ? 62 : 66} y="38" width="40" height="16" rx="5" fill="#c9a874" />}
        <rect x="0" y="92" width="6" height="10" fill="#5f5141" />
        <rect x={suite ? 160 : 166} y="92" width="6" height="10" fill="#5f5141" />
      </g>
      {suite && (
        <g transform="translate(262 146)">
          <rect x="0" y="0" width="112" height="30" rx="6" fill="#8fa79f" />
          <rect x="-4" y="22" width="120" height="24" rx="6" fill="#7d968e" />
          <rect x="4" y="46" width="5" height="10" fill="#5f5141" />
          <rect x="103" y="46" width="5" height="10" fill="#5f5141" />
        </g>
      )}
    </svg>
  )
}
