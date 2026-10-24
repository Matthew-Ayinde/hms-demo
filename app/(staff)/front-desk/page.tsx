'use client'

import { ArrowRight, Plus, Search, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CheckInModal } from '@/components/check-in'
import { NewReservationModal, type NewReservationDefaults } from '@/components/new-reservation'
import { ReservationDrawer } from '@/components/reservation-drawer'
import { RoomStateBadge, SourceLabel, VipMark } from '@/components/status'
import { Badge, Button, EmptyState, Input, PageHeader, Panel, Table, Tabs, Td, Th, cn } from '@/components/ui'
import { ROOM_TYPES } from '@/lib/config'
import { fmtDate, fmtTime, nightsBetween } from '@/lib/dates'
import { naira } from '@/lib/format'
import { roomTypeOf, useBalances, useFrontDeskLists, useLookups } from '@/lib/hooks'
import { stayQuote } from '@/lib/pricing'
import { isReady, occupants, roomState, ROOM_STATE_META, type RoomState } from '@/lib/rooms'
import { useHotel } from '@/lib/store'
import type { Reservation } from '@/lib/types'

type Tab = 'arrivals' | 'departures' | 'inhouse' | 'rooms'

export default function FrontDeskPage() {
  const today = useHotel((s) => s.businessDate)
  const rooms = useHotel((s) => s.rooms)
  const reservations = useHotel((s) => s.reservations)
  const lists = useFrontDeskLists()
  const balance = useBalances()
  const { guest, guestName, room } = useLookups()

  const [tab, setTab] = useState<Tab>('arrivals')
  const [query, setQuery] = useState('')
  const [openRes, setOpenRes] = useState<string | null>(null)
  const [checkInId, setCheckInId] = useState<string | null>(null)
  const [newDefaults, setNewDefaults] = useState<NewReservationDefaults | null>(null)

  const occ = useMemo(() => occupants(reservations), [reservations])
  const roomsReady = rooms.filter((r) => !occ.has(r.id) && isReady(r)).length
  const roomsDirty = rooms.filter((r) => !occ.has(r.id) && r.hk === 'dirty').length

  const filter = (list: Reservation[]) => {
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) => `${guestName(r.guestId)} ${r.code} ${room(r.roomId)?.number ?? ''}`.toLowerCase().includes(q))
  }

  const guestCell = (r: Reservation) => {
    const g = guest(r.guestId)
    return (
      <button onClick={() => setOpenRes(r.id)} className="group text-left">
        <span className="flex items-center gap-1.5 font-medium text-ink group-hover:text-brand">
          {g.firstName} {g.lastName} {g.vip && <VipMark />}
        </span>
        <span className="text-xs text-ink-3">
          {r.code}
          {g.company ? ` · ${g.company}` : ''}
        </span>
      </button>
    )
  }

  return (
    <div>
      <PageHeader
        title="Front desk"
        description={`${fmtDate(today, 'EEEE d MMMM')} · check-in from 14:00, check-out by 12:00`}
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Guest, booking or room" className="w-56 pl-8" />
            </div>
            <Button onClick={() => setNewDefaults({})}>
              <Plus className="size-4" /> Reservation
            </Button>
            <Button variant="primary" onClick={() => setNewDefaults({ walkIn: true })}>
              <UserPlus className="size-4" /> Walk-in
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-5">
        <Summary label="Arrivals" value={`${lists.arrivals.length - lists.arrivalsPending} / ${lists.arrivals.length}`} sub={`${lists.arrivalsPending} still to arrive`} />
        <Summary label="Departures" value={`${lists.departures.length - lists.departuresPending} / ${lists.departures.length}`} sub={`${lists.departuresPending} still to check out`} />
        <Summary label="In house" value={String(lists.inHouse.length)} sub={`${lists.inHouse.reduce((s, r) => s + r.adults + r.children, 0)} guests`} />
        <Summary label="Rooms ready" value={String(roomsReady)} sub="Vacant, clean or inspected" />
        <Summary label="Rooms dirty" value={String(roomsDirty)} sub="Vacant, waiting for housekeeping" tone={roomsDirty ? 'warn' : undefined} />
      </div>

      <Panel>
        <Tabs
          value={tab}
          onChange={setTab}
          className="px-2"
          items={[
            { value: 'arrivals', label: 'Arrivals', count: lists.arrivalsPending },
            { value: 'departures', label: 'Departures', count: lists.departuresPending },
            { value: 'inhouse', label: 'In house', count: lists.inHouse.length },
            { value: 'rooms', label: 'Room status' },
          ]}
        />

        {tab === 'arrivals' && (
          <Table>
            <thead>
              <tr>
                <Th>Guest</Th>
                <Th>Room</Th>
                <Th>Stay</Th>
                <Th>ETA</Th>
                <Th>Source</Th>
                <Th align="right">Due on arrival</Th>
                <Th align="right" />
              </tr>
            </thead>
            <tbody>
              {filter(lists.arrivals)
                .sort((a, b) => Number(b.status === 'confirmed') - Number(a.status === 'confirmed') || (a.eta ?? '').localeCompare(b.eta ?? ''))
                .map((r) => {
                  const rm = room(r.roomId)
                  const quote = stayQuote(r.rate, nightsBetween(r.checkIn, r.checkOut))
                  const due = Math.max(quote.total - balance(r.id).paid, 0)
                  const arrived = r.status === 'checked_in'
                  return (
                    <tr key={r.id} className={cn(arrived && 'bg-sunken/60')}>
                      <Td>{guestCell(r)}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          {rm ? <span className="font-medium">{rm.number}</span> : <Badge tone="warn">Not assigned</Badge>}
                          {rm && !arrived && (isReady(rm) ? <Badge tone="ok" dot>Ready</Badge> : <Badge tone="warn" dot>Not ready</Badge>)}
                        </div>
                        <div className="text-xs text-ink-3">{roomTypeOf(r.typeId).name}</div>
                      </Td>
                      <Td>
                        <div>{nightsBetween(r.checkIn, r.checkOut)} nights</div>
                        <div className="text-xs text-ink-3">until {fmtDate(r.checkOut, 'EEE d MMM')}</div>
                      </Td>
                      <Td className="num">{arrived ? <span className="text-ink-3">In at {fmtTime(r.checkedInAt!)}</span> : (r.eta ?? '—')}</Td>
                      <Td>
                        <SourceLabel source={r.source} />
                      </Td>
                      <Td align="right">{arrived ? <span className="text-ink-3">—</span> : due ? naira(due) : <span className="text-ok">Prepaid</span>}</Td>
                      <Td align="right">
                        {arrived ? (
                          <Badge tone="brand">Checked in</Badge>
                        ) : (
                          <Button size="sm" variant="primary" onClick={() => setCheckInId(r.id)}>
                            Check in
                          </Button>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              {!filter(lists.arrivals).length && (
                <tr>
                  <Td colSpan={7}>
                    <EmptyState title="No arrivals match" />
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        )}

        {tab === 'departures' && (
          <Table>
            <thead>
              <tr>
                <Th>Guest</Th>
                <Th>Room</Th>
                <Th>Stayed</Th>
                <Th>Source</Th>
                <Th align="right">Balance</Th>
                <Th align="right" />
              </tr>
            </thead>
            <tbody>
              {filter(lists.departures).map((r) => {
                const b = balance(r.id)
                const done = r.status === 'checked_out'
                return (
                  <tr key={r.id} className={cn(done && 'bg-sunken/60')}>
                    <Td>{guestCell(r)}</Td>
                    <Td className="font-medium">{room(r.roomId)?.number}</Td>
                    <Td>
                      {fmtDate(r.checkIn)} – {fmtDate(r.checkOut)}
                      <div className="text-xs text-ink-3">{nightsBetween(r.checkIn, r.checkOut)} nights</div>
                    </Td>
                    <Td>
                      <SourceLabel source={r.source} />
                    </Td>
                    <Td align="right" className={cn(!done && b.balance > 0 && 'font-medium text-danger')}>
                      {done ? <span className="text-ink-3">Settled</span> : b.balance > 0 ? naira(b.balance) : <span className="text-ok">Paid</span>}
                    </Td>
                    <Td align="right">
                      {done ? (
                        <span className="text-xs text-ink-3">
                          {r.invoiceNo} · out at {fmtTime(r.checkedOutAt!)}
                        </span>
                      ) : (
                        <Link href={`/folio/${r.id}`}>
                          <Button size="sm" variant="primary">
                            Check out <ArrowRight className="size-3.5" />
                          </Button>
                        </Link>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}

        {tab === 'inhouse' && (
          <Table>
            <thead>
              <tr>
                <Th>Room</Th>
                <Th>Guest</Th>
                <Th>Arrived</Th>
                <Th>Departs</Th>
                <Th>Rate</Th>
                <Th align="right">Balance</Th>
                <Th align="right" />
              </tr>
            </thead>
            <tbody>
              {filter(lists.inHouse)
                .sort((a, b) => (room(a.roomId)?.number ?? '').localeCompare(room(b.roomId)?.number ?? ''))
                .map((r) => {
                  const b = balance(r.id)
                  return (
                    <tr key={r.id}>
                      <Td>
                        <span className="font-semibold">{room(r.roomId)?.number}</span>
                        <div className="text-xs text-ink-3">{roomTypeOf(r.typeId).name}</div>
                      </Td>
                      <Td>{guestCell(r)}</Td>
                      <Td>{fmtDate(r.checkIn, 'EEE d MMM')}</Td>
                      <Td>
                        {r.checkOut === today ? <Badge tone="warn">Today</Badge> : fmtDate(r.checkOut, 'EEE d MMM')}
                      </Td>
                      <Td>
                        {naira(r.rate)}
                        <div className="text-xs text-ink-3">{r.ratePlan}</div>
                      </Td>
                      <Td align="right" className={cn(b.balance > 0 && 'text-danger')}>
                        {naira(b.balance)}
                      </Td>
                      <Td align="right">
                        <Link href={`/folio/${r.id}`} className="text-[13px] font-medium text-brand hover:underline">
                          Folio
                        </Link>
                      </Td>
                    </tr>
                  )
                })}
            </tbody>
          </Table>
        )}

        {tab === 'rooms' && <RoomBoard onOpen={setOpenRes} />}
      </Panel>

      <ReservationDrawer resId={openRes} onClose={() => setOpenRes(null)} />
      <CheckInModal resId={checkInId} onClose={() => setCheckInId(null)} />
      <NewReservationModal
        open={!!newDefaults}
        defaults={newDefaults ?? undefined}
        onClose={() => setNewDefaults(null)}
        onCreated={(res, now) => now && setCheckInId(res.id)}
      />
    </div>
  )
}

function Summary({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'warn' }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="text-xs text-ink-3">{label}</div>
      <div className={cn('mt-0.5 text-xl font-semibold', tone === 'warn' && 'text-warn')}>{value}</div>
      <div className="text-[11.5px] text-ink-3">{sub}</div>
    </div>
  )
}

function RoomBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const rooms = useHotel((s) => s.rooms)
  const reservations = useHotel((s) => s.reservations)
  const today = useHotel((s) => s.businessDate)
  const { guest } = useLookups()
  const occ = useMemo(() => occupants(reservations), [reservations])
  const arriving = useMemo(() => {
    const map = new Map<string, Reservation>()
    for (const r of reservations) if (r.status === 'confirmed' && r.checkIn === today && r.roomId) map.set(r.roomId, r)
    return map
  }, [reservations, today])

  const counts = rooms.reduce<Record<RoomState, number>>(
    (acc, r) => {
      acc[roomState(r, occ.get(r.id))]++
      return acc
    },
    { vacant_clean: 0, inspected: 0, vacant_dirty: 0, occupied: 0, occupied_dirty: 0, ooo: 0 },
  )

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
        {(Object.keys(counts) as RoomState[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <RoomStateBadge state={s} short /> {counts[s]}
          </span>
        ))}
      </div>
      {[1, 2, 3].map((floor) => (
        <div key={floor} className="mb-4 last:mb-0">
          <div className="mb-2 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Floor {floor}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
            {rooms
              .filter((r) => r.floor === floor)
              .map((r) => {
                const occupant = occ.get(r.id)
                const arrival = arriving.get(r.id)
                const state = roomState(r, occupant)
                const linked = occupant ?? arrival
                const tone = ROOM_STATE_META[state].tone
                return (
                  <button
                    key={r.id}
                    disabled={!linked}
                    onClick={() => linked && onOpen(linked.id)}
                    className={cn(
                      'rounded-lg border border-line bg-surface p-2.5 text-left transition-colors enabled:hover:border-line-strong',
                      tone === 'warn' && 'border-l-[3px] border-l-[#c98a12]',
                      tone === 'danger' && 'border-l-[3px] border-l-danger',
                      tone === 'info' && 'border-l-[3px] border-l-info',
                      (tone === 'ok' || tone === 'brand') && 'border-l-[3px] border-l-ok',
                    )}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-[15px] font-semibold">{r.number}</span>
                      <span className="text-[11px] text-ink-3">{ROOM_TYPES.find((t) => t.id === r.typeId)!.id}</span>
                    </div>
                    <div className="mt-1 truncate text-[11.5px] text-ink-2">{ROOM_STATE_META[state].label}</div>
                    <div className="mt-0.5 truncate text-[11.5px] text-ink-3">
                      {occupant
                        ? `${guest(occupant.guestId).lastName}${occupant.checkOut === today ? ' · due out' : ''}`
                        : arrival
                          ? `Arriving: ${guest(arrival.guestId).lastName}`
                          : r.hk === 'ooo'
                            ? r.oooReason?.split('—')[0]
                            : ' '}
                    </div>
                  </button>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
