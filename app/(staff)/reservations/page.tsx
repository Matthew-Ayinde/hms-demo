'use client'

import { ChevronLeft, ChevronRight, Crown, Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { CheckInModal } from '@/components/check-in'
import { NewReservationModal, type NewReservationDefaults } from '@/components/new-reservation'
import { ReservationDrawer } from '@/components/reservation-drawer'
import { Button, PageHeader, cn } from '@/components/ui'
import { occupiedOn } from '@/lib/availability'
import { HOTEL, ROOM_TYPES } from '@/lib/config'
import { dateRange, fmtDate, isWeekend, nightsBetween, shift } from '@/lib/dates'
import { naira } from '@/lib/format'
import { useLookups } from '@/lib/hooks'
import { toast, useHotel } from '@/lib/store'
import type { Reservation } from '@/lib/types'

const COL = 76
const DAYS = 14
const ROOM_COL = 168

export default function ReservationsPage() {
  const today = useHotel((s) => s.businessDate)
  const rooms = useHotel((s) => s.rooms)
  const reservations = useHotel((s) => s.reservations)
  const moveReservation = useHotel((s) => s.moveReservation)
  const { guest } = useLookups()

  const [start, setStart] = useState(() => shift(today, -2))
  const [openRes, setOpenRes] = useState<string | null>(null)
  const [newDefaults, setNewDefaults] = useState<NewReservationDefaults | null>(null)
  const [checkInId, setCheckInId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{ id: string; grabOffset: number } | null>(null)
  const [hover, setHover] = useState<{ row: string; day: number } | null>(null)
  const [flashRow, setFlashRow] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const days = useMemo(() => dateRange(start, DAYS), [start])
  const end = days[DAYS - 1]
  const sellable = rooms.filter((r) => r.hk !== 'ooo').length

  const visible = useMemo(
    () => reservations.filter((r) => r.status !== 'cancelled' && r.checkIn <= shift(end, 1) && r.checkOut >= start),
    [reservations, start, end],
  )
  const byRoom = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    for (const r of visible) if (r.roomId) map.set(r.roomId, [...(map.get(r.roomId) ?? []), r])
    return map
  }, [visible])
  const unassigned = visible.filter((r) => !r.roomId && r.status === 'confirmed')

  const flash = (rowId: string) => {
    setFlashRow(rowId)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashRow(null), 1900)
  }

  const handleDrop = (roomId: string, dayIdx: number) => {
    if (!dragging) return
    const res = reservations.find((r) => r.id === dragging.id)
    setDragging(null)
    setHover(null)
    if (!res) return
    const newIn = res.status === 'checked_in' ? res.checkIn : shift(days[dayIdx], -dragging.grabOffset)
    if (newIn === res.checkIn && roomId === res.roomId) return
    const result = moveReservation(res.id, roomId, newIn)
    if (!result.ok) {
      flash(roomId)
      toast.error('Move blocked', result.error)
    } else {
      toast.success('Reservation updated', result.message)
    }
  }

  const occupancy = days.map((d) => occupiedOn(reservations, d))

  return (
    <div>
      <PageHeader
        title="Reservations"
        description="Drag a booking to move it to another room or other dates. Click an empty cell to create a booking."
        actions={
          <>
            <div className="flex items-center rounded-md border border-line-strong bg-surface">
              <button className="flex size-8 items-center justify-center text-ink-2 hover:text-ink" onClick={() => setStart(shift(start, -7))} aria-label="Previous week">
                <ChevronLeft className="size-4" />
              </button>
              <button className="h-8 border-x border-line px-3 text-[13px] font-medium" onClick={() => setStart(shift(today, -2))}>
                Today
              </button>
              <button className="flex size-8 items-center justify-center text-ink-2 hover:text-ink" onClick={() => setStart(shift(start, 7))} aria-label="Next week">
                <ChevronRight className="size-4" />
              </button>
            </div>
            <Button variant="primary" onClick={() => setNewDefaults({})}>
              <Plus className="size-4" /> New reservation
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-2">
        <span className="font-medium text-ink">
          {fmtDate(start, 'd MMM')} – {fmtDate(end, 'd MMM yyyy')}
        </span>
        <Legend className="bg-brand" label="In house" />
        <Legend className="border border-brand-line bg-brand-soft" label="Confirmed" />
        <Legend className="bg-[#e9e6df]" label="Checked out" />
        <Legend className="hatch border border-line" label="Out of order" />
        <span className="flex items-center gap-1.5">
          <Crown className="size-3 text-brass" /> VIP
        </span>
      </div>

      <div className="scroll-thin overflow-x-auto rounded-card border border-line bg-surface">
        <div style={{ width: ROOM_COL + COL * DAYS }} className="relative select-none">
          {/* Header */}
          <div className="sticky top-0 z-20 flex border-b border-line bg-surface">
            <div style={{ width: ROOM_COL }} className="sticky left-0 z-10 flex shrink-0 items-end border-r border-line bg-surface px-3 pb-2 text-[11px] font-medium tracking-wide text-ink-3 uppercase">
              Room
            </div>
            {days.map((d, i) => {
              const isToday = d === today
              return (
                <div key={d} style={{ width: COL }} className={cn('shrink-0 border-r border-line px-2 py-2 text-center last:border-r-0', isToday ? 'bg-brand-soft' : isWeekend(d) && 'bg-sunken')}>
                  <div className={cn('text-[11px] uppercase', isToday ? 'font-semibold text-brand' : 'text-ink-3')}>{fmtDate(d, 'EEE')}</div>
                  <div className={cn('text-[15px] leading-tight font-semibold', isToday ? 'text-brand' : 'text-ink')}>{fmtDate(d, 'd')}</div>
                  <div className="num mt-0.5 text-[10.5px] text-ink-3" title={`${occupancy[i]} of ${sellable} rooms sold`}>
                    {Math.round((occupancy[i] / sellable) * 100)}%
                  </div>
                </div>
              )
            })}
          </div>

          {/* Unassigned */}
          {unassigned.length > 0 && (
            <>
              <GroupHeader label="Unassigned" meta={`${unassigned.length} ${unassigned.length === 1 ? 'booking' : 'bookings'} waiting for a room — drag onto a room`} warn />
              {unassigned.map((r) => (
                <Row key={r.id} label={<span className="text-warn">Unassigned</span>} sub={ROOM_TYPES.find((t) => t.id === r.typeId)!.name} days={days} today={today}>
                  <Bar res={r} start={start} guestLabel={label(guest(r.guestId))} vip={!!guest(r.guestId).vip} onOpen={() => setOpenRes(r.id)} onDragStart={(offset) => setDragging({ id: r.id, grabOffset: offset })} onDragEnd={() => setDragging(null)} dimmed={dragging?.id === r.id} />
                </Row>
              ))}
            </>
          )}

          {ROOM_TYPES.map((type) => {
            const typeRooms = rooms.filter((r) => r.typeId === type.id)
            return (
              <div key={type.id}>
                <GroupHeader label={type.name} meta={`${typeRooms.length} rooms · rack rate ${naira(type.rate)}`} />
                {typeRooms.map((room) => (
                  <Row
                    key={room.id}
                    label={room.number}
                    sub={room.hk === 'ooo' ? 'Out of order' : room.hk === 'dirty' ? 'Dirty' : room.hk === 'inspected' ? 'Inspected' : 'Clean'}
                    subTone={room.hk === 'ooo' ? 'text-danger' : room.hk === 'dirty' ? 'text-warn' : 'text-ink-3'}
                    days={days}
                    today={today}
                    flash={flashRow === room.id}
                    hoverDay={hover?.row === room.id ? hover.day : null}
                    onCellClick={(i) => {
                      if (days[i] < today || room.hk === 'ooo') return
                      setNewDefaults({ roomId: room.id, checkIn: days[i] })
                    }}
                    onCellDragOver={(i) => dragging && (hover?.row !== room.id || hover.day !== i) && setHover({ row: room.id, day: i })}
                    onCellDrop={(i) => handleDrop(room.id, i)}
                  >
                    {room.hk === 'ooo' && (
                      <div className="hatch absolute inset-y-1.5 right-1 left-1 flex items-center rounded border border-line px-2 text-[11.5px] text-ink-2">
                        <span className="truncate rounded bg-surface/90 px-1">Out of order · {room.oooReason}</span>
                      </div>
                    )}
                    {(byRoom.get(room.id) ?? []).map((r) => (
                      <Bar
                        key={r.id}
                        res={r}
                        start={start}
                        guestLabel={label(guest(r.guestId))}
                        vip={!!guest(r.guestId).vip}
                        onOpen={() => setOpenRes(r.id)}
                        onDragStart={(offset) => setDragging({ id: r.id, grabOffset: offset })}
                        onDragEnd={() => {
                          setDragging(null)
                          setHover(null)
                        }}
                        dimmed={dragging?.id === r.id}
                      />
                    ))}
                  </Row>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-3">
        Percentages show rooms sold per night. Bars start at check-in ({HOTEL.checkInTime}) and end at check-out ({HOTEL.checkOutTime}), so a departure and an
        arrival can share a day.
      </p>

      <ReservationDrawer resId={openRes} onClose={() => setOpenRes(null)} />
      <NewReservationModal
        open={!!newDefaults}
        defaults={newDefaults ?? undefined}
        onClose={() => setNewDefaults(null)}
        onCreated={(res, now) => now && setCheckInId(res.id)}
      />
      <CheckInModal resId={checkInId} onClose={() => setCheckInId(null)} />
    </div>
  )
}

const label = (g: { firstName: string; lastName: string }) => `${g.lastName}, ${g.firstName[0]}.`

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2.5 w-4 rounded-sm', className)} />
      {label}
    </span>
  )
}

function GroupHeader({ label, meta, warn }: { label: string; meta: string; warn?: boolean }) {
  return (
    <div className={cn('sticky left-0 flex h-8 items-center gap-2 border-b border-line px-3 text-xs', warn ? 'bg-warn-soft/60' : 'bg-sunken')}>
      <span className="font-semibold text-ink">{label}</span>
      <span className="text-ink-3">{meta}</span>
    </div>
  )
}

function Row({
  label,
  sub,
  subTone = 'text-ink-3',
  days,
  today,
  children,
  flash,
  hoverDay,
  onCellClick,
  onCellDragOver,
  onCellDrop,
}: {
  label: React.ReactNode
  sub: string
  subTone?: string
  days: string[]
  today: string
  children: React.ReactNode
  flash?: boolean
  hoverDay?: number | null
  onCellClick?: (i: number) => void
  onCellDragOver?: (i: number) => void
  onCellDrop?: (i: number) => void
}) {
  return (
    <div className={cn('flex h-11 border-b border-line last:border-b-0', flash && 'animate-flash')}>
      <div style={{ width: ROOM_COL }} className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-line bg-surface px-3">
        <span className="text-[13px] font-semibold">{label}</span>
        <span className={cn('truncate text-[11px]', subTone)}>{sub}</span>
      </div>
      <div className="relative flex">
        {days.map((d, i) => (
          <div
            key={d}
            style={{ width: COL }}
            onClick={() => onCellClick?.(i)}
            onDragOver={(e) => {
              if (!onCellDrop) return
              e.preventDefault()
              onCellDragOver?.(i)
            }}
            onDrop={(e) => {
              e.preventDefault()
              onCellDrop?.(i)
            }}
            className={cn(
              'h-full shrink-0 border-r border-line/70 last:border-r-0',
              d === today ? 'bg-brand-soft/50' : isWeekend(d) && 'bg-sunken/70',
              onCellClick && d >= today && 'cursor-pointer hover:bg-brand-soft/70',
              hoverDay === i && 'bg-brand-soft',
            )}
          />
        ))}
        {children}
      </div>
    </div>
  )
}

function Bar({
  res,
  start,
  guestLabel,
  vip,
  onOpen,
  onDragStart,
  onDragEnd,
  dimmed,
}: {
  res: Reservation
  start: string
  guestLabel: string
  vip: boolean
  onOpen: () => void
  onDragStart: (grabOffset: number) => void
  onDragEnd: () => void
  dimmed?: boolean
}) {
  const startIdx = nightsBetween(start, res.checkIn)
  const endIdx = nightsBetween(start, res.checkOut)
  const left = Math.max((startIdx + 0.5) * COL, 0)
  const right = Math.min((endIdx + 0.5) * COL, DAYS * COL)
  if (right <= 0 || left >= DAYS * COL) return null
  const nights = nightsBetween(res.checkIn, res.checkOut)
  const draggable = res.status === 'confirmed' || res.status === 'checked_in'

  const style =
    res.status === 'checked_in'
      ? 'bg-brand text-white hover:bg-brand-hover'
      : res.status === 'confirmed'
        ? 'border border-brand-line bg-brand-soft text-brand hover:border-brand'
        : 'bg-[#e9e6df] text-ink-3'

  return (
    <button
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', res.id)
        const rect = e.currentTarget.getBoundingClientRect()
        const clippedLeftNights = Math.max(0, -(startIdx + 0.5))
        onDragStart(Math.floor((e.clientX - rect.left) / COL + clippedLeftNights + 0.5))
      }}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      title={`${res.code} · ${guestLabel} · ${fmtDate(res.checkIn)} – ${fmtDate(res.checkOut)} · ${res.source}`}
      style={{ left: left + 2, width: right - left - 4 }}
      className={cn(
        'absolute top-1.5 bottom-1.5 flex items-center gap-1 overflow-hidden rounded-[5px] px-2 text-left text-xs transition-[opacity,background-color]',
        style,
        draggable && 'cursor-grab active:cursor-grabbing',
        dimmed && 'opacity-40',
      )}
    >
      {vip && <Crown className={cn('size-3 shrink-0', res.status === 'checked_in' ? 'text-[#e9d9b8]' : 'text-brass')} />}
      <span className="truncate font-medium">{guestLabel}</span>
      <span className={cn('shrink-0 text-[11px]', res.status === 'checked_in' ? 'text-white/65' : 'opacity-70')}>{nights}n</span>
    </button>
  )
}
