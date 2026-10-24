'use client'

import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PreviewBanner } from '@/components/preview-banner'
import { Badge, Button, KeyValue, PageHeader, Panel, Table, Td, Th, cn, type Tone } from '@/components/ui'
import { dateRange, fmtDate, isWeekend, shift } from '@/lib/dates'
import { naira, nairaCompact } from '@/lib/format'
import { toast, useHotel } from '@/lib/store'

const HALLS = [
  { id: 'lagoon', name: 'Lagoon Hall', capacity: '250 banquet · 400 theatre' },
  { id: 'palm', name: 'Palm Room', capacity: '60 classroom · 90 theatre' },
  { id: 'board', name: 'Boardroom', capacity: '14 boardroom' },
]

type Status = 'Enquiry' | 'Quote sent' | 'Tentative' | 'Contract signed' | 'Confirmed'
const STATUS_TONE: Record<Status, Tone> = { Enquiry: 'neutral', 'Quote sent': 'info', Tentative: 'warn', 'Contract signed': 'brand', Confirmed: 'ok' }

interface EventSpec {
  id: string
  name: string
  client: string
  hall: string
  start: number
  days: number
  pax: number
  status: Status
  value: number
  paid: number
  times: string
  menu: string
  setup: string
  av: string
}

const EVENTS: EventSpec[] = [
  { id: 'e1', name: 'Kestrel Energy quarterly training', client: 'Kestrel Energy Ltd', hall: 'palm', start: 2, days: 2, pax: 45, status: 'Confirmed', value: 2_850_000, paid: 2_850_000, times: '08:30 – 17:00', menu: 'Breakfast buffet, two tea breaks, working lunch', setup: 'Classroom, 6 tables of 8, trainer table', av: 'Projector, 2 handheld mics, flip charts' },
  { id: 'e2', name: 'Okafor–Bello wedding reception', client: 'Mrs Ngozi Okafor', hall: 'lagoon', start: 6, days: 1, pax: 220, status: 'Contract signed', value: 8_400_000, paid: 4_200_000, times: '16:00 – 23:30', menu: 'Cocktail canapés, three-course plated dinner, cake service', setup: '22 round tables of 10, high table, dance floor', av: 'Stage lighting, PA system, DJ booth power' },
  { id: 'e3', name: 'Fintech founders breakfast', client: 'Lekki Founders Circle', hall: 'board', start: 1, days: 1, pax: 12, status: 'Tentative', value: 360_000, paid: 0, times: '07:30 – 10:00', menu: 'Continental breakfast, fresh juice', setup: 'Boardroom table', av: 'Screen with HDMI, video-call camera' },
  { id: 'e4', name: 'Legal practitioners’ annual dinner', client: 'Victoria Island Law Society', hall: 'lagoon', start: 13, days: 1, pax: 150, status: 'Quote sent', value: 5_250_000, paid: 0, times: '18:30 – 23:00', menu: 'Welcome drinks, buffet dinner, dessert station', setup: '15 round tables of 10, lectern', av: 'Lectern mic, 2 screens, live band power' },
  { id: 'e5', name: 'Product launch rehearsal', client: 'Brightline Telecoms', hall: 'palm', start: 9, days: 1, pax: 30, status: 'Enquiry', value: 900_000, paid: 0, times: '10:00 – 15:00', menu: 'Lunch buffet', setup: 'Theatre, 30 chairs, stage riser', av: 'LED screen, wireless mics' },
]

export default function EventsPage() {
  const today = useHotel((s) => s.businessDate)
  const days = useMemo(() => dateRange(today, 14), [today])
  const [selected, setSelected] = useState(EVENTS[1].id)
  const ev = EVENTS.find((e) => e.id === selected)!
  const pipeline = EVENTS.reduce((s, e) => s + e.value, 0)
  const confirmed = EVENTS.filter((e) => e.status === 'Confirmed' || e.status === 'Contract signed').reduce((s, e) => s + e.value, 0)

  return (
    <div>
      <PageHeader
        title="Events & banquets"
        description="Hall bookings, quotes, banquet event orders and deposit schedules."
        actions={
          <Button variant="primary" onClick={() => toast.info('Event bookings arrive in Phase 3', 'Quotes, contracts and deposit schedules will be created from here.')}>
            <Plus className="size-3.5" /> New enquiry
          </Button>
        }
      />
      <PreviewBanner phase={3} weeks="6–7">
        Sample events to show the layout. In the live system, event deposits post to accounting, banquet orders go to the kitchen and housekeeping, and guest-room blocks for wedding parties link to the reservations calendar.
      </PreviewBanner>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Events, next 14 days" value={String(EVENTS.length)} />
        <Kpi label="Guests expected" value={EVENTS.reduce((s, e) => s + e.pax, 0).toLocaleString('en-NG')} />
        <Kpi label="Confirmed revenue" value={nairaCompact(confirmed)} />
        <Kpi label="Pipeline incl. quotes" value={nairaCompact(pipeline)} />
      </div>

      <Panel title="Hall calendar" subtitle={`${fmtDate(today, 'd MMM')} – ${fmtDate(days[13], 'd MMM yyyy')}`} className="mb-5">
        <div className="scroll-thin overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="flex border-b border-line">
              <div className="w-44 shrink-0 px-4 py-2 text-[11px] font-medium tracking-wide text-ink-3 uppercase">Space</div>
              {days.map((d) => (
                <div key={d} className={cn('flex-1 border-l border-line py-1.5 text-center', d === today ? 'bg-brand-soft' : isWeekend(d) && 'bg-sunken')}>
                  <div className="text-[10.5px] text-ink-3 uppercase">{fmtDate(d, 'EEE')}</div>
                  <div className="text-[13px] font-semibold">{fmtDate(d, 'd')}</div>
                </div>
              ))}
            </div>
            {HALLS.map((h) => (
              <div key={h.id} className="flex border-b border-line last:border-b-0">
                <div className="w-44 shrink-0 px-4 py-2.5">
                  <div className="text-[13px] font-medium">{h.name}</div>
                  <div className="text-[11px] text-ink-3">{h.capacity}</div>
                </div>
                <div className="relative flex flex-1">
                  {days.map((d) => (
                    <div key={d} className={cn('flex-1 border-l border-line/70', d === today ? 'bg-brand-soft/50' : isWeekend(d) && 'bg-sunken/70')} />
                  ))}
                  {EVENTS.filter((e) => e.hall === h.id).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelected(e.id)}
                      style={{ left: `calc(${(e.start / 14) * 100}% + 3px)`, width: `calc(${(e.days / 14) * 100}% - 6px)` }}
                      className={cn(
                        'absolute top-2 bottom-2 overflow-hidden rounded-[5px] px-2 text-left text-xs',
                        e.status === 'Confirmed' || e.status === 'Contract signed' ? 'bg-brand text-white' : 'border border-dashed border-brand-line bg-brand-soft text-brand',
                        selected === e.id && 'ring-2 ring-brass ring-offset-1',
                      )}
                      title={`${e.name} · ${e.status}`}
                    >
                      <span className="block truncate font-medium">{e.name}</span>
                      <span className="block truncate opacity-75">{e.pax} guests</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="px-4 py-2.5 text-xs text-ink-3">Solid = confirmed or contracted. Dashed = enquiry, quote or tentative hold.</p>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Events">
          <Table>
            <thead>
              <tr>
                <Th>Event</Th>
                <Th>Date</Th>
                <Th>Space</Th>
                <Th align="right">Guests</Th>
                <Th>Status</Th>
                <Th align="right">Value</Th>
                <Th align="right">Deposit</Th>
              </tr>
            </thead>
            <tbody>
              {[...EVENTS].sort((a, b) => a.start - b.start).map((e) => (
                <tr key={e.id} onClick={() => setSelected(e.id)} className={cn('cursor-pointer hover:bg-sunken/60', selected === e.id && 'bg-brand-soft/50')}>
                  <Td>
                    <div className="font-medium">{e.name}</div>
                    <div className="text-xs text-ink-3">{e.client}</div>
                  </Td>
                  <Td className="whitespace-nowrap">{fmtDate(shift(today, e.start), 'EEE d MMM')}</Td>
                  <Td className="text-ink-2">{HALLS.find((h) => h.id === e.hall)!.name}</Td>
                  <Td align="right">{e.pax}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
                  </Td>
                  <Td align="right">{nairaCompact(e.value)}</Td>
                  <Td align="right" className={cn(e.paid < e.value * 0.5 && e.status === 'Contract signed' && 'text-warn')}>
                    {e.paid ? `${Math.round((e.paid / e.value) * 100)}%` : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        <Panel title="Banquet event order" subtitle={ev.name}>
          <dl className="px-4 py-2">
            <KeyValue label="Client">{ev.client}</KeyValue>
            <KeyValue label="Date">
              {fmtDate(shift(today, ev.start), 'EEE d MMM yyyy')}
              {ev.days > 1 ? ` + ${ev.days - 1} day` : ''}
            </KeyValue>
            <KeyValue label="Times">{ev.times}</KeyValue>
            <KeyValue label="Space">{HALLS.find((h) => h.id === ev.hall)!.name}</KeyValue>
            <KeyValue label="Guests">{ev.pax}</KeyValue>
            <KeyValue label="Menu">{ev.menu}</KeyValue>
            <KeyValue label="Set-up">{ev.setup}</KeyValue>
            <KeyValue label="AV">{ev.av}</KeyValue>
          </dl>
          <div className="border-t border-line px-4 py-3">
            <div className="mb-2 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Deposit schedule</div>
            {[
              { label: 'On signing (50%)', due: ev.start - 21, amount: ev.value * 0.5 },
              { label: 'Balance (50%)', due: ev.start - 7, amount: ev.value * 0.5 },
            ].map((d, i) => {
              const paid = ev.paid >= ev.value * 0.5 * (i + 1)
              return (
                <div key={d.label} className="flex items-center justify-between py-1 text-[13px]">
                  <span className="text-ink-2">
                    {d.label} · due {fmtDate(shift(today, d.due), 'd MMM')}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="num">{naira(d.amount)}</span>
                    {paid ? <Badge tone="ok">Paid</Badge> : d.due < 0 ? <Badge tone="danger">Overdue</Badge> : <Badge>Due</Badge>}
                  </span>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  )
}
