'use client'

import { Ban, Download, Search, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { VipMark } from '@/components/status'
import { Badge, Button, EmptyState, Input, PageHeader, Panel, Table, Td, Th, cn } from '@/components/ui'
import { downloadCsv } from '@/lib/csv'
import { fmtDate } from '@/lib/dates'
import { naira, nairaCompact } from '@/lib/format'
import { findDuplicates, guestStats } from '@/lib/guests'
import { toast, useHotel } from '@/lib/store'

type Filter = 'all' | 'vip' | 'corporate' | 'inhouse' | 'duplicates' | 'blacklisted'

export default function GuestsPage() {
  const router = useRouter()
  const guests = useHotel((s) => s.guests)
  const reservations = useHotel((s) => s.reservations)
  const charges = useHotel((s) => s.charges)
  const payments = useHotel((s) => s.payments)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const duplicates = useMemo(() => findDuplicates(guests), [guests])
  const rows = useMemo(
    () =>
      guests
        .map((g) => ({ guest: g, stats: guestStats(g, reservations, charges, payments) }))
        .sort((a, b) => b.stats.spend - a.stats.spend || b.stats.stays - a.stats.stays),
    [guests, reservations, charges, payments],
  )

  const counts = {
    all: rows.length,
    vip: rows.filter((r) => r.guest.vip).length,
    corporate: rows.filter((r) => r.guest.company).length,
    inhouse: rows.filter((r) => r.stats.inHouse).length,
    duplicates: rows.filter((r) => duplicates.has(r.guest.id)).length,
    blacklisted: rows.filter((r) => r.guest.blacklist).length,
  }
  const optedIn = rows.filter((r) => r.guest.marketing).length

  const visible = rows.filter(({ guest: g, stats }) => {
    const q = query.trim().toLowerCase()
    const matches = !q || `${g.firstName} ${g.lastName} ${g.email} ${g.phone} ${g.company ?? ''}`.toLowerCase().includes(q)
    const inFilter =
      filter === 'all' ||
      (filter === 'vip' && g.vip) ||
      (filter === 'corporate' && !!g.company) ||
      (filter === 'inhouse' && !!stats.inHouse) ||
      (filter === 'duplicates' && duplicates.has(g.id)) ||
      (filter === 'blacklisted' && !!g.blacklist)
    return matches && inFilter
  })

  const FILTERS: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All guests' },
    { value: 'vip', label: 'VIP' },
    { value: 'corporate', label: 'Corporate' },
    { value: 'inhouse', label: 'In house' },
    { value: 'duplicates', label: 'Possible duplicates' },
    { value: 'blacklisted', label: 'Blacklisted' },
  ]

  return (
    <div>
      <PageHeader
        title="Guests"
        description="Every guest profile with stay history, spend and preferences. One record per person, shared by every desk."
        actions={
          <Button
            onClick={() => {
              downloadCsv(
                'guest-list.csv',
                ['First name', 'Last name', 'Email', 'Phone', 'Nationality', 'Company', 'VIP', 'Stays', 'Spend on record', 'Marketing consent'],
                rows.filter((r) => !r.guest.anonymised).map(({ guest: g, stats }) => [g.firstName, g.lastName, g.email, g.phone, g.nationality, g.company ?? '', g.vip ? 'Yes' : 'No', stats.stays, stats.spend, g.marketing ? 'Yes' : 'No']),
              )
              toast.success('Guest list exported', 'CSV with marketing consent per guest.')
            }}
          >
            <Download className="size-3.5" /> Export
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-5">
        <Summary label="Profiles" value={counts.all} />
        <Summary label="VIP guests" value={counts.vip} />
        <Summary label="Corporate accounts" value={counts.corporate} />
        <Summary label="Marketing opt-ins" value={optedIn} />
        <Summary label="Possible duplicates" value={counts.duplicates} tone={counts.duplicates ? 'warn' : undefined} />
      </div>

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email, phone or company" className="w-72 pl-8" />
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors',
                  filter === f.value ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-black/[0.035]',
                )}
              >
                {f.label}
                <span className="num text-[11px] text-ink-3">{counts[f.value]}</span>
              </button>
            ))}
          </div>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Guest</Th>
              <Th>Contact</Th>
              <Th>Nationality</Th>
              <Th align="right">Stays</Th>
              <Th>Last stay</Th>
              <Th align="right">Spend on record</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ guest: g, stats }) => (
              <tr key={g.id} onClick={() => router.push(`/guests/${g.id}`)} className="cursor-pointer hover:bg-sunken/70">
                <Td>
                  <div className="flex items-center gap-1.5 font-medium">
                    {g.firstName} {g.lastName}
                    {g.vip && <VipMark />}
                    {g.blacklist && (
                      <span title={g.blacklist.reason} className="inline-flex items-center gap-0.5 rounded bg-danger-soft px-1 text-[10.5px] font-semibold text-danger">
                        <Ban className="size-3" /> BLACKLIST
                      </span>
                    )}
                    {duplicates.has(g.id) && <Badge tone="warn">Duplicate?</Badge>}
                  </div>
                  {g.company && <div className="text-xs text-ink-3">{g.company}</div>}
                </Td>
                <Td>
                  <div className="text-ink-2">{g.phone}</div>
                  <div className="text-xs text-ink-3">{g.email}</div>
                </Td>
                <Td className="text-ink-2">{g.nationality}</Td>
                <Td align="right">{stats.stays}</Td>
                <Td className="text-ink-2">{stats.lastStay ? fmtDate(stats.lastStay, 'd MMM yyyy') : '—'}</Td>
                <Td align="right" className={cn(!stats.spend && 'text-ink-3')} >
                  <span title={naira(stats.spend)}>{stats.spend ? nairaCompact(stats.spend) : '—'}</span>
                </Td>
                <Td>
                  {stats.inHouse ? (
                    <Badge tone="brand">In house</Badge>
                  ) : stats.upcoming ? (
                    <span className="text-xs text-ink-2">Arrives {fmtDate(stats.upcoming.checkIn, 'd MMM')}</span>
                  ) : (
                    <span className="text-xs text-ink-3">—</span>
                  )}
                </Td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <Td colSpan={7}>
                  <EmptyState title="No guests match" body="Try another name, or clear the filter." />
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
        <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-ink-3">
          <Users className="size-3.5" /> Stays include history imported from the old records. Spend covers stays recorded in this system.
        </div>
      </Panel>
    </div>
  )
}

function Summary({ label, value, tone }: { label: string; value: number; tone?: 'warn' }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="text-xs text-ink-3">{label}</div>
      <div className={cn('mt-0.5 text-xl font-semibold', tone === 'warn' && 'text-warn')}>{value}</div>
    </div>
  )
}
