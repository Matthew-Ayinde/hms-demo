'use client'

import { CircleAlert, Globe, Link2, RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { PreviewBanner } from '@/components/preview-banner'
import { Badge, Button, PageHeader, Panel, Table, Td, Th, cn } from '@/components/ui'
import { typeAvailability } from '@/lib/availability'
import { ROOM_TYPES } from '@/lib/config'
import { dateRange, fmtDate } from '@/lib/dates'
import { naira, nairaCompact, pct } from '@/lib/format'
import { useRateBook } from '@/lib/hooks'
import { priceFor } from '@/lib/rates'
import { toast, useHotel } from '@/lib/store'
import type { Source } from '@/lib/types'

const CHANNELS: { name: string; source?: Source; commission: number; live: boolean; mapping: Record<string, string> }[] = [
  { name: 'Hotel website', source: 'Website', commission: 0.015, live: true, mapping: { STD: 'Standard Room', DLX: 'Deluxe King', EXS: 'Executive Suite' } },
  { name: 'Booking.com', source: 'Booking.com', commission: 0.17, live: false, mapping: { STD: 'Standard Queen Room', DLX: 'Deluxe King Room', EXS: 'Executive Suite with Lagoon View' } },
  { name: 'Expedia', source: 'Expedia', commission: 0.18, live: false, mapping: { STD: 'Standard Room, 1 Queen Bed', DLX: 'Deluxe Room, 1 King Bed', EXS: 'Executive Suite' } },
  { name: 'Airbnb', commission: 0.15, live: false, mapping: { STD: '—', DLX: 'Lagoon-side king room', EXS: 'Executive suite on the lagoon' } },
]

/** Simulated OTA display prices: mostly at parity, with two deliberate undercuts to show the alert. */
const OTA_DRIFT: Record<string, number> = { 'Expedia|DLX|2': -0.04, 'Booking.com|EXS|4': -0.06 }

export default function ChannelsPage() {
  const today = useHotel((s) => s.businessDate)
  const history = useHotel((s) => s.history)
  const rooms = useHotel((s) => s.rooms)
  const reservations = useHotel((s) => s.reservations)
  const book = useRateBook()
  const days = useMemo(() => dateRange(today, 7), [today])

  const revenue = (source?: Source) => (source ? history.reduce((s, h) => s + h.bySource[source], 0) : 0)
  const total = history.reduce((s, h) => s + h.roomRevenue, 0)
  const commission = CHANNELS.filter((c) => c.name !== 'Hotel website').reduce((s, c) => s + revenue(c.source) * c.commission, 0)

  const parity = days.flatMap((d, i) =>
    ROOM_TYPES.flatMap((t) => {
      const direct = priceFor(book, t.id, d).price
      return ['Booking.com', 'Expedia'].map((ch) => {
        const drift = OTA_DRIFT[`${ch}|${t.id}|${i}`] ?? 0
        return { date: d, type: t, channel: ch, direct, ota: Math.round((direct * (1 + drift)) / 100) * 100, under: drift < 0 }
      })
    }),
  )
  const alerts = parity.filter((p) => p.under)

  return (
    <div>
      <PageHeader
        title="Channel manager"
        description="One place to manage prices and availability on every booking site, so the hotel never sells the same room twice."
        actions={
          <Button onClick={() => toast.info('Sync arrives in Phase 3', 'Rates and availability will push to each channel within a few minutes of any change.')}>
            <RefreshCw className="size-3.5" /> Sync now
          </Button>
        }
      />
      <PreviewBanner phase={3} weeks="6–7">
        The OTA connections aren&apos;t live yet. Revenue figures come from the last 30 days of bookings, and website prices come from your live rate calendar. In Phase 3 we connect through a certified channel-manager partner for two-way sync.
      </PreviewBanner>

      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {CHANNELS.map((c) => {
          const rev = revenue(c.source)
          return (
            <div key={c.name} className="rounded-card border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold">
                  {c.live ? <Globe className="size-4 text-brand" /> : <Link2 className="size-4 text-ink-3" />}
                  {c.name}
                </span>
                {c.live ? <Badge tone="ok" dot>Live</Badge> : <Badge>Phase 3</Badge>}
              </div>
              <dl className="mt-3 space-y-1 text-[12.5px]">
                <div className="flex justify-between">
                  <dt className="text-ink-3">Room revenue, 30 days</dt>
                  <dd className="num font-medium">{rev ? nairaCompact(rev) : '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-3">Share of rooms revenue</dt>
                  <dd className="num">{rev ? pct(rev / total) : '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-3">{c.live ? 'Payment fee' : 'Commission'}</dt>
                  <dd className="num">{pct(c.commission, c.commission < 0.1 ? 1 : 0)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-3">Cost, 30 days</dt>
                  <dd className="num">{rev ? naira(rev * c.commission) : '—'}</dd>
                </div>
              </dl>
            </div>
          )
        })}
      </div>

      <div className="mb-5 rounded-card border border-brass/25 bg-brass-soft px-4 py-3 text-[13px] text-[#6d5126]">
        <span className="font-medium">{naira(commission)}</span> paid in OTA commission over the last 30 days. Every booking moved from an OTA to the hotel website saves 15–18% of the room rate.
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel
          title="Rate parity, next 7 days"
          subtitle="Your website price compared with what each OTA shows guests"
          actions={alerts.length > 0 && <Badge tone="danger">{alerts.length} alerts</Badge>}
        >
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Room type</Th>
                <Th>Channel</Th>
                <Th align="right">Website</Th>
                <Th align="right">OTA shows</Th>
                <Th>Parity</Th>
              </tr>
            </thead>
            <tbody>
              {[...alerts, ...parity.filter((p) => !p.under && p.channel === 'Booking.com').slice(0, 8)].map((p) => (
                <tr key={`${p.date}${p.type.id}${p.channel}`} className={cn(p.under && 'bg-danger-soft/40')}>
                  <Td className="whitespace-nowrap">{fmtDate(p.date, 'EEE d MMM')}</Td>
                  <Td>{p.type.name}</Td>
                  <Td>{p.channel}</Td>
                  <Td align="right">{naira(p.direct)}</Td>
                  <Td align="right" className={cn(p.under && 'font-medium text-danger')}>
                    {naira(p.ota)}
                  </Td>
                  <Td>
                    {p.under ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-danger">
                        <CircleAlert className="size-3.5" /> OTA cheaper by {naira(p.direct - p.ota)}
                      </span>
                    ) : (
                      <Badge tone="ok">In parity</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="px-4 py-3 text-xs text-ink-3">An OTA showing a lower price usually means a promotion was switched on in its extranet. The live system alerts the manager by email the moment it happens.</p>
        </Panel>

        <div className="space-y-5">
          <Panel title="Availability that would be sent" subtitle="Rooms left per night, from the live calendar">
            <Table>
              <thead>
                <tr>
                  <Th>Type</Th>
                  {days.map((d) => (
                    <Th key={d} align="center">
                      {fmtDate(d, 'EEE')}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROOM_TYPES.map((t) => (
                  <tr key={t.id}>
                    <Td className="font-medium">{t.id}</Td>
                    {days.map((d) => {
                      const left = typeAvailability(rooms, reservations, t.id, d, dateRange(d, 2)[1])
                      const closed = priceFor(book, t.id, d).stopSell
                      return (
                        <Td key={d} align="center" className={cn(closed ? 'text-danger' : left <= 1 && 'font-medium text-warn')}>
                          {closed ? '×' : left}
                        </Td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="px-4 py-2.5 text-xs text-ink-3">× = closed to new bookings on the rate calendar.</p>
          </Panel>

          <Panel title="Room mapping" subtitle="How each channel names your room types">
            <Table>
              <thead>
                <tr>
                  <Th>Channel</Th>
                  <Th>Deluxe King maps to</Th>
                </tr>
              </thead>
              <tbody>
                {CHANNELS.map((c) => (
                  <tr key={c.name}>
                    <Td className="font-medium">{c.name}</Td>
                    <Td className="text-ink-2">{c.mapping.DLX}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        </div>
      </div>
    </div>
  )
}
