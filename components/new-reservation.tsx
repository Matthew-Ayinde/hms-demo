'use client'

import { CircleAlert, CircleCheck, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { findConflict, typeAvailability } from '@/lib/availability'
import { RATE_PLANS, ROOM_TYPES, SOURCES } from '@/lib/config'
import { fmtDate, nightsBetween, shift } from '@/lib/dates'
import { naira, plural } from '@/lib/format'
import { useCurrentUser, useLookups, useRateBook } from '@/lib/hooks'
import { withTaxes } from '@/lib/pricing'
import { quoteStay } from '@/lib/rates'
import { toast, useHotel, type NewReservationInput } from '@/lib/store'
import type { PayMethod, RatePlan, Reservation, RoomTypeId, Source } from '@/lib/types'
import { Modal } from './modal'
import { VipMark } from './status'
import { Button, Field, Input, Segmented, Select, Textarea, cn } from './ui'

export interface NewReservationDefaults {
  roomId?: string
  checkIn?: string
  walkIn?: boolean
}

const PAY_METHODS: PayMethod[] = ['Cash', 'Card', 'Bank transfer', 'Mobile money']

export function NewReservationModal({
  open,
  onClose,
  defaults,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  defaults?: NewReservationDefaults
  onCreated?: (res: Reservation, checkInNow: boolean) => void
}) {
  // Remount the form whenever it opens with new defaults so state starts clean.
  if (!open) return null
  return <ReservationForm key={JSON.stringify(defaults ?? {})} onClose={onClose} defaults={defaults} onCreated={onCreated} />
}

function ReservationForm({
  onClose,
  defaults,
  onCreated,
}: {
  onClose: () => void
  defaults?: NewReservationDefaults
  onCreated?: (res: Reservation, checkInNow: boolean) => void
}) {
  const today = useHotel((s) => s.businessDate)
  const rooms = useHotel((s) => s.rooms)
  const reservations = useHotel((s) => s.reservations)
  const guests = useHotel((s) => s.guests)
  const createReservation = useHotel((s) => s.createReservation)
  const { guestName } = useLookups()

  const presetRoom = rooms.find((r) => r.id === defaults?.roomId)
  const walkIn = !!defaults?.walkIn

  const [guestMode, setGuestMode] = useState<'new' | 'existing'>('new')
  const [query, setQuery] = useState('')
  const [guestId, setGuestId] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [nationality, setNationality] = useState('Nigerian')

  const [checkIn, setCheckIn] = useState(defaults?.checkIn && defaults.checkIn >= today ? defaults.checkIn : today)
  const [checkOut, setCheckOut] = useState(shift(defaults?.checkIn && defaults.checkIn >= today ? defaults.checkIn : today, walkIn ? 1 : 2))
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [typeId, setTypeId] = useState<RoomTypeId>(presetRoom?.typeId ?? 'STD')
  const [roomId, setRoomId] = useState<string>(presetRoom?.id ?? '')
  const [ratePlan, setRatePlan] = useState<RatePlan>('Room only')
  const [source, setSource] = useState<Source>(walkIn ? 'Walk-in' : 'Phone')
  const [eta, setEta] = useState(walkIn ? '' : '15:00')
  const [notes, setNotes] = useState('')
  const [deposit, setDeposit] = useState('')
  const [method, setMethod] = useState<PayMethod>('Cash')
  const [ref, setRef] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const type = ROOM_TYPES.find((t) => t.id === typeId)!
  const nights = nightsBetween(checkIn, checkOut)
  const book = useRateBook()
  const user = useCurrentUser()
  const stay = quoteStay(book, typeId, checkIn, checkOut, ratePlan)
  const rate = stay.average
  const quote = withTaxes(stay.net)
  const ratesVary = new Set(stay.nights.map((n) => n.planPrice)).size > 1
  const depositAmount = Number(deposit.replace(/[^\d]/g, '')) || 0

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return guests.slice(0, 6)
    return guests.filter((g) => `${g.firstName} ${g.lastName} ${g.phone} ${g.email} ${g.company ?? ''}`.toLowerCase().includes(q)).slice(0, 6)
  }, [guests, query])

  const typeRooms = rooms.filter((r) => r.typeId === typeId)
  const roomOptions = typeRooms.map((r) => {
    const clash = nights > 0 ? findConflict(reservations, r.id, checkIn, checkOut) : undefined
    return { room: r, clash }
  })

  const selectedRoom = rooms.find((r) => r.id === roomId)
  const clash = selectedRoom && nights > 0 ? findConflict(reservations, selectedRoom.id, checkIn, checkOut) : undefined
  const typeLeft = nights > 0 ? typeAvailability(rooms, reservations, typeId, checkIn, checkOut) : 0

  let blocker: string | null = null
  if (nights < 1) blocker = 'Check-out must be at least one night after check-in.'
  else if (selectedRoom?.hk === 'ooo') blocker = `Room ${selectedRoom.number} is out of order (${selectedRoom.oooReason}).`
  else if (clash)
    blocker = `Room ${selectedRoom!.number} is already booked for ${guestName(clash.guestId)} from ${fmtDate(clash.checkIn)} to ${fmtDate(clash.checkOut)}. Choose another room or change the dates.`
  else if (!selectedRoom && typeLeft < 1) blocker = `No ${type.name} rooms left for these dates.`

  const chosenGuest = guestMode === 'existing' ? guests.find((g) => g.id === guestId) : undefined
  if (!blocker && chosenGuest?.blacklist && user?.role !== 'manager')
    blocker = `${chosenGuest.firstName} ${chosenGuest.lastName} is on the blacklist: ${chosenGuest.blacklist.reason}. Only a manager can accept this booking.`
  const warnings: string[] = []
  if (chosenGuest?.blacklist && user?.role === 'manager') warnings.push(`Blacklisted guest: ${chosenGuest.blacklist.reason}. Booking as a manager override, which is logged.`)
  if (stay.closed.length) warnings.push(`${type.name} is closed to new bookings on ${stay.closed.map((d) => fmtDate(d)).join(', ')}. Staff can still book, but online channels can't.`)
  if (stay.minStayViolated) warnings.push(`Minimum stay of ${stay.minStay} nights applies from ${fmtDate(checkIn)}. Online channels would refuse this booking.`)

  const guestValid = guestMode === 'existing' ? !!guestId : firstName.trim() && lastName.trim() && phone.trim()
  const canSave = !blocker && guestValid

  const submit = (checkInNow: boolean) => {
    setSubmitted(true)
    if (!canSave) return
    const chosen = guests.find((g) => g.id === guestId)
    const input: NewReservationInput = {
      guest: chosen
        ? { id: chosen.id, firstName: chosen.firstName, lastName: chosen.lastName, phone: chosen.phone, email: chosen.email }
        : { firstName, lastName, phone, email, nationality },
      typeId,
      roomId: roomId || null,
      checkIn,
      checkOut,
      adults,
      children,
      source,
      ratePlan,
      rate,
      eta: eta || undefined,
      notes: notes || undefined,
      payment: depositAmount > 0 ? { method, amount: depositAmount, ref: ref || undefined } : undefined,
    }
    const result = createReservation(input)
    if (!result.ok) {
      toast.error('Booking not saved', result.error)
      return
    }
    toast.success(
      `Reservation ${result.reservation.code} created`,
      email || chosen?.email ? 'Confirmation sent by email and WhatsApp (simulated in this prototype).' : undefined,
    )
    onCreated?.(result.reservation, checkInNow)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={walkIn ? 'Walk-in guest' : 'New reservation'}
      description={walkIn ? 'Register the guest, assign a room and check them in straight away.' : 'Phone, email or corporate booking. Availability is checked as you type.'}
      footer={
        <>
          <span className="mr-auto text-xs text-ink-3">
            {nights > 0 && `${plural(nights, 'night')} · ${naira(quote.total)} incl. service charge and VAT`}
          </span>
          <Button onClick={onClose}>Cancel</Button>
          {walkIn || checkIn === today ? (
            <>
              {!walkIn && <Button onClick={() => submit(false)} disabled={submitted && !canSave}>Save booking</Button>}
              <Button variant="primary" onClick={() => submit(true)} disabled={(submitted && !canSave) || !roomId}>
                Save and check in
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => submit(false)} disabled={submitted && !canSave}>
              Create reservation
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          {/* Guest */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Guest</h3>
              <Segmented
                value={guestMode}
                onChange={(v) => {
                  setGuestMode(v)
                  setGuestId(null)
                }}
                items={[
                  { value: 'new', label: 'New guest' },
                  { value: 'existing', label: 'Returning guest' },
                ]}
              />
            </div>
            {guestMode === 'existing' ? (
              <div>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, phone, email or company" className="pl-8" autoFocus />
                </div>
                <ul className="mt-2 divide-y divide-line rounded-md border border-line">
                  {matches.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => setGuestId(g.id)}
                        className={cn('flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-sunken', guestId === g.id && 'bg-brand-soft hover:bg-brand-soft')}
                      >
                        <span className="font-medium">
                          {g.firstName} {g.lastName}
                        </span>
                        {g.vip && <VipMark />}
                        {g.blacklist && <span className="rounded bg-danger-soft px-1 text-[10.5px] font-semibold text-danger">BLACKLISTED</span>}
                        <span className="text-xs text-ink-3">{g.company ?? g.phone}</span>
                        <span className="ml-auto text-xs text-ink-3">{plural(g.stays, 'stay')}</span>
                        {guestId === g.id && <CircleCheck className="size-4 text-brand" />}
                      </button>
                    </li>
                  ))}
                  {!matches.length && <li className="px-3 py-3 text-xs text-ink-3">No guest found. Switch to “New guest”.</li>}
                </ul>
                {submitted && !guestId && <p className="mt-1 text-xs text-danger">Select a guest profile.</p>}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="First name" error={submitted && !firstName.trim() ? 'Required' : undefined}>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
                </Field>
                <Field label="Last name" error={submitted && !lastName.trim() ? 'Required' : undefined}>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </Field>
                <Field label="Phone (WhatsApp)" error={submitted && !phone.trim() ? 'Required' : undefined}>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 …" />
                </Field>
                <Field label="Email">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
                </Field>
                <Field label="Nationality">
                  <Input value={nationality} onChange={(e) => setNationality(e.target.value)} />
                </Field>
              </div>
            )}
          </section>

          {/* Stay */}
          <section>
            <h3 className="mb-3 text-[13px] font-semibold">Stay</h3>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Check-in">
                <Input
                  type="date"
                  value={checkIn}
                  min={today}
                  disabled={walkIn}
                  onChange={(e) => {
                    const v = e.target.value
                    setCheckIn(v)
                    if (checkOut <= v) setCheckOut(shift(v, 1))
                  }}
                />
              </Field>
              <Field label="Check-out" hint={nights > 0 ? plural(nights, 'night') : undefined}>
                <Input type="date" value={checkOut} min={shift(checkIn, 1)} onChange={(e) => setCheckOut(e.target.value)} />
              </Field>
              <Field label="Adults">
                <Select value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Children">
                <Select value={children} onChange={(e) => setChildren(Number(e.target.value))}>
                  {[0, 1, 2].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Room type">
                <Select
                  value={typeId}
                  onChange={(e) => {
                    setTypeId(e.target.value as RoomTypeId)
                    setRoomId('')
                  }}
                >
                  {ROOM_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · from {naira(book.baseRates[t.id])}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Room" hint={!roomId && nights > 0 ? `${typeLeft} ${type.name} ${typeLeft === 1 ? 'room' : 'rooms'} free — assign later` : undefined}>
                <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                  <option value="">{walkIn ? 'Select a room' : 'Assign later'}</option>
                  {roomOptions.map(({ room, clash: c }) => (
                    <option key={room.id} value={room.id}>
                      {room.number}
                      {room.hk === 'ooo' ? ' — out of order' : c ? ` — booked (${guestName(c.guestId).split(' ')[1]})` : room.hk === 'dirty' ? ' — free, being cleaned' : ' — free'}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Rate plan">
                <Select value={ratePlan} onChange={(e) => setRatePlan(e.target.value as RatePlan)}>
                  {Object.keys(RATE_PLANS).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
              </Field>
            </div>

            {blocker ? (
              <div className="mt-3 flex gap-2.5 rounded-md border border-danger/25 bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">{clash ? 'Double booking prevented' : 'Cannot book'}</p>
                  <p className="mt-0.5 text-[12.5px] text-[#8a1f16]">{blocker}</p>
                </div>
              </div>
            ) : (
              nights > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-ok">
                  <CircleCheck className="size-3.5" />
                  {selectedRoom ? `Room ${selectedRoom.number} is free for ${fmtDate(checkIn)} – ${fmtDate(checkOut)}.` : `${type.name} available for these dates.`}
                </div>
              )
            )}
            {warnings.map((w) => (
              <div key={w} className="mt-2 flex gap-2 rounded-md border border-warn/25 bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                {w}
              </div>
            ))}
          </section>

          {/* Details */}
          <section>
            <h3 className="mb-3 text-[13px] font-semibold">Booking details</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Source">
                <Select value={source} onChange={(e) => setSource(e.target.value as Source)} disabled={walkIn}>
                  {SOURCES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </Field>
              {!walkIn && (
                <Field label="Expected arrival">
                  <Input type="time" value={eta} onChange={(e) => setEta(e.target.value)} />
                </Field>
              )}
              <Field label="Notes" className={walkIn ? 'sm:col-span-2' : ''}>
                <Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Requests, billing instructions…" className="h-8.5 resize-none" />
              </Field>
            </div>
          </section>
        </div>

        {/* Quote */}
        <aside className="h-fit rounded-lg border border-line bg-sunken p-4">
          <h3 className="text-[13px] font-semibold">Price</h3>
          <dl className="mt-3 space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-ink-2">
                {ratesVary ? `${plural(Math.max(nights, 0), 'night')} · avg ${naira(rate)}` : `${naira(rate)} × ${plural(Math.max(nights, 0), 'night')}`}
              </dt>
              <dd className="num">{naira(quote.net)}</dd>
            </div>
            {ratesVary && (
              <ul className="space-y-0.5 border-l-2 border-line pl-2.5 text-xs text-ink-3">
                {stay.nights.map((n) => (
                  <li key={n.date} className="flex justify-between">
                    <span>
                      {fmtDate(n.date, 'EEE d MMM')}
                      {n.season ? ` · ${n.season.name}` : n.weekend ? ' · weekend' : ''}
                      {n.override ? ' · special rate' : ''}
                    </span>
                    <span className="num">{naira(n.planPrice)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-between">
              <dt className="text-ink-2">Service charge 10%</dt>
              <dd className="num">{naira(quote.service)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">VAT 7.5%</dt>
              <dd className="num">{naira(quote.vat)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-semibold">
              <dt>Total</dt>
              <dd className="num">{naira(quote.total)}</dd>
            </div>
          </dl>

          <div className="mt-5 space-y-3 border-t border-line pt-4">
            <Field label="Deposit received" hint={depositAmount ? `Balance at check-out: ${naira(Math.max(quote.total - depositAmount, 0))}` : 'Leave empty if unpaid'}>
              <div className="flex gap-2">
                <Input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="numeric" placeholder="₦0" />
                <Button size="sm" className="h-8.5 shrink-0" onClick={() => setDeposit(String(quote.total))}>
                  Full
                </Button>
              </div>
            </Field>
            {depositAmount > 0 && (
              <>
                <Field label="Method">
                  <Select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
                    {PAY_METHODS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </Select>
                </Field>
                {method !== 'Cash' && (
                  <Field label="Reference">
                    <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Transfer or POS ref." />
                  </Field>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </Modal>
  )
}
