'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { findConflict, typeAvailability } from './availability'
import { HOTEL, HOTEL_DEFAULTS, ROOM_TYPES, SCREEN_LABELS, ROLE_LABEL, type HotelSettings } from './config'
import { dateRange, fmtDate, nightsBetween, shift, todayISO } from './dates'
import { naira } from './format'
import { folioTotals, nightlyRate } from './pricing'
import { buildSeed, type HotelData } from './seed'
import type {
  AuditEntry,
  Charge,
  Dept,
  Guest,
  Module,
  Outlet,
  PayMethod,
  PosTicket,
  Promo,
  RatePlan,
  Reservation,
  Role,
  RoomTypeId,
  Season,
  Source,
  TicketLine,
} from './types'

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

export interface PaymentInput {
  method: PayMethod
  amount: number
  ref?: string
}

export interface NewReservationInput {
  guest: { id?: string; firstName: string; lastName: string; phone: string; email: string; nationality?: string; marketing?: boolean }
  typeId: RoomTypeId
  roomId: string | null
  checkIn: string
  checkOut: string
  adults: number
  children: number
  source: Source
  ratePlan: RatePlan
  rate?: number
  eta?: string
  notes?: string
  payment?: PaymentInput
  extras?: { dept: Dept; desc: string; amount: number }[]
  promoCode?: string
  createdBy?: string
}

export interface CheckInInput {
  roomId: string
  idType: string
  idNumber: string
  idFile?: string
  signature: string
  payment?: PaymentInput
}

interface Actions {
  reset: () => void
  ensureFresh: () => void
  createReservation: (input: NewReservationInput) => Result<{ reservation: Reservation }>
  moveReservation: (id: string, roomId: string | null, checkIn?: string) => Result<{ message: string }>
  cancelReservation: (id: string, reason: string, fee: number) => void
  checkIn: (id: string, input: CheckInInput) => Result
  addCharge: (resId: string, input: { dept: Dept; desc: string; amount: number }) => void
  voidCharge: (chargeId: string, reason: string, approvedBy: string) => void
  addPayments: (resId: string, items: PaymentInput[]) => void
  checkOut: (resId: string) => Result<{ invoiceNo: string }>
  postTicket: (input: {
    outlet: Outlet
    table?: string
    lines: TicketLine[]
    settlement: 'Room' | PayMethod
    resId?: string
  }) => Result<{ ticket: PosTicket }>
  startTask: (id: string) => void
  completeTask: (id: string) => void
  reportIssue: (roomId: string, issue: string, blocksRoom: boolean) => void
  returnToService: (roomId: string) => void
  runNightAudit: () => Result<{ posted: number }>
  // Guests
  updateGuest: (id: string, patch: Partial<Pick<Guest, 'firstName' | 'lastName' | 'phone' | 'email' | 'nationality' | 'company' | 'preferences' | 'notes' | 'marketing'>>) => void
  setVip: (id: string, vip: boolean) => void
  setBlacklist: (id: string, reason: string | null) => void
  mergeGuests: (keepId: string, dropId: string) => void
  anonymiseGuest: (id: string) => void
  // Rates
  setBaseRate: (typeId: RoomTypeId, rate: number) => void
  setDayRules: (typeIds: RoomTypeId[], dates: string[], rule: { price?: number | null; adjustPct?: number; stopSell?: boolean; minStay?: number }) => void
  setWeekendUplift: (value: number) => void
  addSeason: (season: Omit<Season, 'id'>) => void
  removeSeason: (id: string) => void
  addPromo: (promo: Omit<Promo, 'uses'>) => Result
  togglePromo: (code: string) => void
  // Settings
  updateSettings: (patch: Partial<HotelSettings>) => void
  setPermission: (route: string, role: Role, allowed: boolean) => void
  setVoidApproval: (required: boolean) => void
}

export type HotelState = HotelData & Actions

const EMPTY: HotelData = {
  businessDate: '',
  nightAuditDone: false,
  rooms: [],
  guests: [],
  reservations: [],
  charges: [],
  payments: [],
  tasks: [],
  audit: [],
  history: [],
  tickets: [],
  counters: { reservation: 0, check: 0, invoice: 0, id: 0 },
  baseRates: { STD: 0, DLX: 0, EXS: 0 },
  weekendUplift: 0,
  seasons: [],
  dayRules: {},
  promos: [],
  settings: {},
  permissions: {},
  voidNeedsApproval: true,
}

const DATA_KEYS = Object.keys(EMPTY) as (keyof HotelData)[]

export const STORAGE_KEY = 'hms-demo-data-v2'

/** Applies saved property settings onto the shared HOTEL object every screen reads from. */
function applySettings(settings: Partial<HotelSettings>) {
  Object.assign(HOTEL, structuredClone(HOTEL_DEFAULTS), settings)
}

const nowIso = () => new Date().toISOString()

/** Room nights that still need posting before the guest can leave. */
export function pendingNights(res: Reservation, businessDate: string) {
  const due = dateRange(res.checkIn, nightsBetween(res.checkIn, res.checkOut)).filter(
    (n) => n < businessDate && !res.postedNights.includes(n),
  )
  if (due.length === 0 && res.postedNights.length === 0 && res.checkIn === businessDate) return [businessDate]
  return due
}

export const useSession = create<{ userId: string | null; login: (id: string) => void; logout: () => void }>()(
  persist(
    (set) => ({
      userId: null,
      login: (userId) => set({ userId }),
      logout: () => set({ userId: null }),
    }),
    { name: 'hms-demo-session', storage: createJSONStorage(() => sessionStorage), skipHydration: true },
  ),
)

const actor = () => useSession.getState().userId ?? 'system'

export const useHotel = create<HotelState>()(
  persist(
    (set, get) => {
      const id = (prefix: string) => {
        const n = get().counters.id + 1
        set((s) => ({ counters: { ...s.counters, id: n } }))
        return `${prefix}${n}`
      }

      const log = (module: Module, action: string, detail: string, ref?: string, userId = actor()) => {
        const entry: AuditEntry = { id: id('a'), at: nowIso(), userId, module, action, detail, ref }
        set((s) => ({ audit: [entry, ...s.audit] }))
      }

      const guestName = (guestId: string) => {
        const g = get().guests.find((x) => x.id === guestId)
        return g ? `${g.firstName} ${g.lastName}` : 'Unknown guest'
      }

      const roomNo = (roomId: string | null) => get().rooms.find((r) => r.id === roomId)?.number ?? '—'

      const conflictMessage = (roomId: string, clash: Reservation) =>
        `Room ${roomNo(roomId)} is already booked for ${guestName(clash.guestId)} (${fmtDate(clash.checkIn)} – ${fmtDate(clash.checkOut)}). Double booking prevented.`

      const recordPayments = (resId: string, items: PaymentInput[], by = actor()) => {
        const valid = items.filter((p) => p.amount > 0)
        if (!valid.length) return
        const rows = valid.map((p) => ({ id: id('p'), resId, time: nowIso(), method: p.method, amount: Math.round(p.amount), ref: p.ref, by }))
        set((s) => ({ payments: [...s.payments, ...rows] }))
        const res = get().reservations.find((r) => r.id === resId)
        const total = rows.reduce((sum, p) => sum + p.amount, 0)
        const split = rows.length > 1 ? ` (${rows.map((p) => `${p.method} ${naira(p.amount)}`).join(' + ')})` : ` by ${rows[0].method}`
        log('Billing', 'Payment received', `${naira(total)}${split} · ${res ? guestName(res.guestId) : ''}`, res?.code, by)
      }

      const postRoomNight = (res: Reservation, night: string, by: string) => {
        const charge: Charge = {
          id: id('c'),
          resId: res.id,
          date: night,
          time: nowIso(),
          dept: 'Room',
          desc: `Room ${roomNo(res.roomId)} · ${res.ratePlan}`,
          amount: res.rate,
          by,
        }
        set((s) => ({
          charges: [...s.charges, charge],
          reservations: s.reservations.map((r) => (r.id === res.id ? { ...r, postedNights: [...r.postedNights, night] } : r)),
        }))
      }

      return {
        ...EMPTY,

        reset: () => {
          set({ ...buildSeed(todayISO()) })
          applySettings({})
        },

        ensureFresh: () => {
          if (!get().rooms.length || get().businessDate !== todayISO()) get().reset()
        },

        createReservation: (input) => {
          const state = get()
          const nights = nightsBetween(input.checkIn, input.checkOut)
          if (nights < 1) return { ok: false, error: 'Check-out must be at least one night after check-in.' }

          if (input.roomId) {
            const room = state.rooms.find((r) => r.id === input.roomId)
            if (room?.hk === 'ooo') return { ok: false, error: `Room ${room.number} is out of order and can't be sold.` }
            const clash = findConflict(state.reservations, input.roomId, input.checkIn, input.checkOut)
            if (clash) return { ok: false, error: conflictMessage(input.roomId, clash) }
          } else if (typeAvailability(state.rooms, state.reservations, input.typeId, input.checkIn, input.checkOut) < 1) {
            const typeName = ROOM_TYPES.find((t) => t.id === input.typeId)!.name
            return { ok: false, error: `No ${typeName} rooms left for those dates.` }
          }

          let guestId = input.guest.id
          if (!guestId) {
            const guest: Guest = {
              id: id('g'),
              firstName: input.guest.firstName.trim(),
              lastName: input.guest.lastName.trim(),
              phone: input.guest.phone,
              email: input.guest.email,
              nationality: input.guest.nationality ?? 'Nigerian',
              stays: 0,
              preferences: [],
              marketing: input.guest.marketing,
            }
            guestId = guest.id
            set((s) => ({ guests: [...s.guests, guest] }))
          }

          const type = ROOM_TYPES.find((t) => t.id === input.typeId)!
          const createdBy = input.createdBy ?? actor()
          const reservation: Reservation = {
            id: id('res'),
            code: `${HOTEL.codePrefix}-${get().counters.reservation}`,
            guestId,
            typeId: input.typeId,
            roomId: input.roomId,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            adults: input.adults,
            children: input.children,
            status: 'confirmed',
            source: input.source,
            ratePlan: input.ratePlan,
            rate: input.rate ?? nightlyRate(type, input.ratePlan),
            eta: input.eta,
            notes: input.notes,
            createdAt: nowIso(),
            createdBy,
            postedNights: [],
          }
          set((s) => ({
            reservations: [...s.reservations, reservation],
            counters: { ...s.counters, reservation: s.counters.reservation + 1 },
            promos: input.promoCode ? s.promos.map((p) => (p.code === input.promoCode ? { ...p, uses: p.uses + 1 } : p)) : s.promos,
          }))
          log(
            'Reservations',
            createdBy === 'web' ? 'Online booking' : 'Reservation created',
            `${guestName(guestId)} · ${type.name}${input.roomId ? ` · Room ${roomNo(input.roomId)}` : ''} · ${fmtDate(input.checkIn)} – ${fmtDate(input.checkOut)} (${nights} ${nights === 1 ? 'night' : 'nights'}) · ${input.source}`,
            reservation.code,
            createdBy,
          )
          if (input.extras?.length) {
            const extras: Charge[] = input.extras.map((x) => ({
              id: id('c'),
              resId: reservation.id,
              date: input.checkIn,
              time: nowIso(),
              dept: x.dept,
              desc: x.desc,
              amount: x.amount,
              by: createdBy,
            }))
            set((s) => ({ charges: [...s.charges, ...extras] }))
          }
          if (input.payment) recordPayments(reservation.id, [input.payment], createdBy)
          return { ok: true, reservation }
        },

        moveReservation: (resId, roomId, checkIn) => {
          const state = get()
          const res = state.reservations.find((r) => r.id === resId)
          if (!res) return { ok: false, error: 'Reservation not found.' }
          if (res.status === 'checked_out' || res.status === 'cancelled')
            return { ok: false, error: 'Closed reservations cannot be moved.' }

          const nights = nightsBetween(res.checkIn, res.checkOut)
          const newIn = checkIn ?? res.checkIn
          const newOut = shift(newIn, nights)

          if (res.status === 'checked_in') {
            if (newIn !== res.checkIn) return { ok: false, error: 'Guest is in house — dates are locked. You can only move rooms.' }
            if (!roomId) return { ok: false, error: 'An in-house guest must stay assigned to a room.' }
          }
          if (newIn < state.businessDate && res.status === 'confirmed')
            return { ok: false, error: 'A booking cannot be moved into the past.' }

          if (roomId) {
            const room = state.rooms.find((r) => r.id === roomId)!
            if (room.hk === 'ooo') return { ok: false, error: `Room ${room.number} is out of order (${room.oooReason}).` }
            const clash = findConflict(state.reservations, roomId, newIn, newOut, res.id)
            if (clash) return { ok: false, error: conflictMessage(roomId, clash) }
          }

          const room = state.rooms.find((r) => r.id === roomId)
          const fromRoom = res.roomId
          set((s) => ({
            reservations: s.reservations.map((r) =>
              r.id === resId ? { ...r, roomId, checkIn: newIn, checkOut: newOut, typeId: room?.typeId ?? r.typeId } : r,
            ),
            rooms:
              res.status === 'checked_in' && fromRoom && fromRoom !== roomId
                ? s.rooms.map((r) => (r.id === fromRoom ? { ...r, hk: 'dirty' } : r))
                : s.rooms,
          }))

          const upgrade = room && room.typeId !== res.typeId ? ` (room type changed to ${ROOM_TYPES.find((t) => t.id === room.typeId)!.name})` : ''
          const parts: string[] = []
          if (fromRoom !== roomId) parts.push(roomId ? `Room ${roomNo(fromRoom)} → ${roomNo(roomId)}` : `Unassigned from Room ${roomNo(fromRoom)}`)
          if (newIn !== res.checkIn) parts.push(`dates ${fmtDate(res.checkIn)} → ${fmtDate(newIn)}`)
          if (!parts.length) return { ok: true, message: 'No change' }
          const message = `${guestName(res.guestId)}: ${parts.join(', ')}${upgrade}`
          log(res.status === 'checked_in' ? 'Front desk' : 'Reservations', res.status === 'checked_in' ? 'Room move' : 'Reservation amended', message, res.code)
          return { ok: true, message }
        },

        cancelReservation: (resId, reason, fee) => {
          const res = get().reservations.find((r) => r.id === resId)
          if (!res) return
          if (fee > 0) {
            set((s) => ({
              charges: [
                ...s.charges,
                { id: id('c'), resId, date: s.businessDate, time: nowIso(), dept: 'Cancellation', desc: 'Late cancellation fee (1 night)', amount: fee, by: actor() },
              ],
            }))
          }
          set((s) => ({ reservations: s.reservations.map((r) => (r.id === resId ? { ...r, status: 'cancelled', cancelReason: reason } : r)) }))
          log('Reservations', 'Booking cancelled', `${guestName(res.guestId)} · ${reason}${fee ? ` · fee ${naira(fee)}` : ' · no fee'}`, res.code)
        },

        checkIn: (resId, input) => {
          const state = get()
          const res = state.reservations.find((r) => r.id === resId)
          if (!res || res.status !== 'confirmed') return { ok: false, error: 'Only confirmed bookings can be checked in.' }
          if (res.checkIn > state.businessDate) return { ok: false, error: `This booking arrives on ${fmtDate(res.checkIn, 'd MMM yyyy')}.` }
          const clash = findConflict(state.reservations, input.roomId, res.checkIn, res.checkOut, res.id)
          if (clash) return { ok: false, error: conflictMessage(input.roomId, clash) }
          const room = state.rooms.find((r) => r.id === input.roomId)!
          set((s) => ({
            reservations: s.reservations.map((r) =>
              r.id === resId
                ? { ...r, status: 'checked_in', roomId: input.roomId, typeId: room.typeId, checkedInAt: nowIso(), signature: input.signature, idFile: input.idFile }
                : r,
            ),
            guests: s.guests.map((g) => (g.id === res.guestId ? { ...g, idType: input.idType, idNumber: input.idNumber } : g)),
          }))
          log('Front desk', 'Check-in', `${guestName(res.guestId)} checked in to Room ${room.number} · ID ${input.idType} verified · signature captured`, res.code)
          if (input.payment) recordPayments(resId, [input.payment])
          return { ok: true }
        },

        addCharge: (resId, input) => {
          const res = get().reservations.find((r) => r.id === resId)
          if (!res) return
          set((s) => ({
            charges: [...s.charges, { id: id('c'), resId, date: s.businessDate, time: nowIso(), dept: input.dept, desc: input.desc, amount: Math.round(input.amount), by: actor() }],
          }))
          log('Billing', 'Charge posted', `${input.dept}: ${input.desc} ${naira(input.amount)} · ${guestName(res.guestId)}`, res.code)
        },

        voidCharge: (chargeId, reason, approvedBy) => {
          const charge = get().charges.find((c) => c.id === chargeId)
          if (!charge || charge.void) return
          const res = get().reservations.find((r) => r.id === charge.resId)
          set((s) => ({
            charges: s.charges.map((c) => (c.id === chargeId ? { ...c, void: { reason, by: actor(), approvedBy, at: nowIso() } } : c)),
          }))
          const approver = approvedBy === actor() ? '' : ` · approved by manager`
          log('Billing', 'Charge voided', `${charge.desc} ${naira(charge.amount)} · reason: ${reason}${approver}`, res?.code)
        },

        addPayments: (resId, items) => recordPayments(resId, items),

        checkOut: (resId) => {
          const state = get()
          const res = state.reservations.find((r) => r.id === resId)
          if (!res || res.status !== 'checked_in') return { ok: false, error: 'Only in-house guests can be checked out.' }
          for (const night of pendingNights(res, state.businessDate)) postRoomNight(res, night, actor())
          const after = get()
          const totals = folioTotals(
            after.charges.filter((c) => c.resId === resId),
            after.payments.filter((p) => p.resId === resId),
          )
          if (totals.balance > 0) return { ok: false, error: `Outstanding balance of ${naira(totals.balance)} must be settled first.` }

          const invoiceNo = `INV-${String(after.counters.invoice).padStart(6, '0')}`
          set((s) => ({
            reservations: s.reservations.map((r) =>
              r.id === resId ? { ...r, status: 'checked_out', checkedOutAt: nowIso(), invoiceNo, checkOut: r.checkOut > s.businessDate ? s.businessDate : r.checkOut } : r,
            ),
            rooms: s.rooms.map((r) => (r.id === res.roomId ? { ...r, hk: 'dirty' } : r)),
            guests: s.guests.map((g) => (g.id === res.guestId ? { ...g, stays: g.stays + 1 } : g)),
            tasks: [
              ...s.tasks,
              { id: `t-${s.counters.id + 1}`, roomId: res.roomId!, type: 'Departure clean', assignee: 'u-hk', status: 'todo', createdAt: nowIso(), note: 'Guest just checked out.' },
            ],
            counters: { ...s.counters, invoice: s.counters.invoice + 1, id: s.counters.id + 1 },
          }))
          log('Front desk', 'Check-out', `${guestName(res.guestId)} checked out of Room ${roomNo(res.roomId)} · invoice ${invoiceNo} · room sent to housekeeping`, res.code)
          return { ok: true, invoiceNo }
        },

        postTicket: (input) => {
          const net = input.lines.reduce((sum, l) => sum + l.qty * l.price, 0)
          if (!input.lines.length) return { ok: false, error: 'The ticket is empty.' }
          const state = get()
          const number = state.counters.check
          let res: Reservation | undefined
          if (input.settlement === 'Room') {
            res = state.reservations.find((r) => r.id === input.resId && r.status === 'checked_in')
            if (!res) return { ok: false, error: 'Choose an in-house guest to charge.' }
          }
          const items = input.lines.reduce((sum, l) => sum + l.qty, 0)
          const ticket: PosTicket = {
            id: id('k'),
            number,
            outlet: input.outlet,
            table: input.table,
            lines: input.lines,
            net,
            settlement: input.settlement,
            resId: res?.id,
            at: nowIso(),
            by: actor(),
          }
          const dept: Dept = input.outlet === 'Bar' ? 'Bar' : input.outlet === 'Room service' ? 'Room service' : 'Restaurant'
          set((s) => ({
            tickets: [ticket, ...s.tickets],
            counters: { ...s.counters, check: s.counters.check + 1 },
            charges: res
              ? [...s.charges, { id: id('c'), resId: res.id, date: s.businessDate, time: nowIso(), dept, desc: `${input.outlet} · Check #${number} (${items} ${items === 1 ? 'item' : 'items'})`, amount: net, by: actor(), ref: `#${number}` }]
              : s.charges,
          }))
          log(
            'POS',
            res ? 'Posted to room' : 'Bill settled',
            res
              ? `Check #${number} · ${naira(net)} net posted to Room ${roomNo(res.roomId)} (${guestName(res.guestId)})`
              : `Check #${number} · ${input.outlet}${input.table ? ` table ${input.table}` : ''} · paid by ${input.settlement}`,
            res?.code ?? `#${number}`,
          )
          return { ok: true, ticket }
        },

        startTask: (taskId) => {
          const task = get().tasks.find((t) => t.id === taskId)
          if (!task || task.status !== 'todo') return
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status: 'in_progress', startedAt: nowIso() } : t)) }))
          log('Housekeeping', 'Cleaning started', `Room ${roomNo(task.roomId)} · ${task.type}`)
        },

        completeTask: (taskId) => {
          const task = get().tasks.find((t) => t.id === taskId)
          if (!task || task.status === 'done') return
          const hk = task.type === 'Inspection' ? 'inspected' : 'clean'
          set((s) => ({
            tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status: 'done', doneAt: nowIso(), startedAt: t.startedAt ?? nowIso() } : t)),
            rooms: s.rooms.map((r) => (r.id === task.roomId && r.hk !== 'ooo' ? { ...r, hk } : r)),
          }))
          log('Housekeeping', task.type === 'Inspection' ? 'Inspection passed' : 'Room cleaned', `Room ${roomNo(task.roomId)} is now ${hk === 'inspected' ? 'inspected and ready' : 'clean'}`)
        },

        reportIssue: (roomId, issue, blocksRoom) => {
          set((s) => ({ rooms: s.rooms.map((r) => (r.id === roomId && blocksRoom ? { ...r, hk: 'ooo', oooReason: issue } : r)) }))
          log('Maintenance', blocksRoom ? 'Room out of order' : 'Fault reported', `Room ${roomNo(roomId)}: ${issue}${blocksRoom ? ' · room blocked from sale' : ''}`)
        },

        returnToService: (roomId) => {
          set((s) => ({ rooms: s.rooms.map((r) => (r.id === roomId ? { ...r, hk: 'dirty', oooReason: undefined } : r)) }))
          set((s) => ({
            tasks: [...s.tasks, { id: `t-${s.counters.id + 1}`, roomId, type: 'Departure clean', assignee: 'u-hk', status: 'todo', createdAt: nowIso(), note: 'Back from maintenance — full clean before sale.' }],
            counters: { ...s.counters, id: s.counters.id + 1 },
          }))
          log('Maintenance', 'Returned to service', `Room ${roomNo(roomId)} repaired · sent to housekeeping`)
        },

        runNightAudit: () => {
          const state = get()
          if (state.nightAuditDone) return { ok: false, error: 'Night audit has already run for this business date.' }
          const inHouse = state.reservations.filter(
            (r) => r.status === 'checked_in' && r.checkIn <= state.businessDate && r.checkOut > state.businessDate && !r.postedNights.includes(state.businessDate),
          )
          for (const res of inHouse) postRoomNight(res, state.businessDate, 'system')
          set({ nightAuditDone: true })
          const pendingArrivals = state.reservations.filter((r) => r.status === 'confirmed' && r.checkIn === state.businessDate).length
          log(
            'System',
            'Night audit closed',
            `Business date ${state.businessDate} closed · ${inHouse.length} room charges posted${pendingArrivals ? ` · ${pendingArrivals} arrivals not yet checked in` : ''}`,
            state.businessDate,
          )
          return { ok: true, posted: inHouse.length }
        },

        /* ---------- Guests ---------- */

        updateGuest: (guestId, patch) => {
          set((s) => ({ guests: s.guests.map((g) => (g.id === guestId ? { ...g, ...patch } : g)) }))
          const fields = Object.keys(patch).join(', ')
          log('Guests', 'Profile updated', `${guestName(guestId)} · ${fields}`)
        },

        setVip: (guestId, vip) => {
          set((s) => ({ guests: s.guests.map((g) => (g.id === guestId ? { ...g, vip } : g)) }))
          log('Guests', vip ? 'Marked VIP' : 'VIP removed', guestName(guestId))
        },

        setBlacklist: (guestId, reason) => {
          set((s) => ({
            guests: s.guests.map((g) =>
              g.id === guestId ? { ...g, blacklist: reason ? { reason, at: nowIso(), by: actor() } : undefined } : g,
            ),
          }))
          log('Guests', reason ? 'Guest blacklisted' : 'Blacklist removed', `${guestName(guestId)}${reason ? ` · ${reason}` : ''}`)
        },

        mergeGuests: (keepId, dropId) => {
          const keep = get().guests.find((g) => g.id === keepId)
          const drop = get().guests.find((g) => g.id === dropId)
          if (!keep || !drop) return
          const moved = get().reservations.filter((r) => r.guestId === dropId).length
          set((s) => ({
            reservations: s.reservations.map((r) => (r.guestId === dropId ? { ...r, guestId: keepId } : r)),
            guests: s.guests
              .filter((g) => g.id !== dropId)
              .map((g) =>
                g.id === keepId
                  ? {
                      ...g,
                      stays: g.stays + drop.stays,
                      preferences: Array.from(new Set([...g.preferences, ...drop.preferences])),
                      vip: g.vip || drop.vip,
                      company: g.company ?? drop.company,
                      idType: g.idType ?? drop.idType,
                      idNumber: g.idNumber ?? drop.idNumber,
                      notes: [g.notes, drop.notes, `Merged with duplicate profile (${drop.email}).`].filter(Boolean).join('\n'),
                    }
                  : g,
              ),
          }))
          log('Guests', 'Profiles merged', `${drop.firstName} ${drop.lastName} (${drop.email}) merged into ${keep.firstName} ${keep.lastName} · ${moved} ${moved === 1 ? 'booking' : 'bookings'} moved`)
        },

        anonymiseGuest: (guestId) => {
          const name = guestName(guestId)
          set((s) => ({
            guests: s.guests.map((g) =>
              g.id === guestId
                ? { ...g, firstName: 'Deleted', lastName: `guest ${g.id.toUpperCase()}`, phone: '—', email: '—', idType: undefined, idNumber: undefined, preferences: [], notes: undefined, marketing: false, vip: false, anonymised: true }
                : g,
            ),
          }))
          log('Guests', 'Personal data erased', `${name}: contact details, ID and preferences removed on request (NDPA). Financial records kept for tax.`)
        },

        /* ---------- Rates ---------- */

        setBaseRate: (typeId, rate) => {
          const before = get().baseRates[typeId]
          set((s) => ({ baseRates: { ...s.baseRates, [typeId]: Math.round(rate) } }))
          log('Rates', 'Base rate changed', `${ROOM_TYPES.find((t) => t.id === typeId)!.name}: ${naira(before)} → ${naira(rate)}`)
        },

        setDayRules: (typeIds, dates, rule) => {
          set((s) => {
            const dayRules = { ...s.dayRules }
            for (const typeId of typeIds)
              for (const date of dates) {
                const key = `${typeId}|${date}`
                const next = { ...dayRules[key] }
                if (rule.price === null) delete next.price
                else if (rule.price !== undefined) next.price = Math.round(rule.price)
                if (rule.adjustPct !== undefined) {
                  const base = next.price ?? s.baseRates[typeId]
                  next.price = Math.round((base * (1 + rule.adjustPct / 100)) / 500) * 500
                }
                if (rule.stopSell !== undefined) next.stopSell = rule.stopSell || undefined
                if (rule.minStay !== undefined) next.minStay = rule.minStay > 1 ? rule.minStay : undefined
                const empty = next.price === undefined && !next.stopSell && !next.minStay
                if (empty) delete dayRules[key]
                else dayRules[key] = next
              }
            return { dayRules }
          })
          const parts: string[] = []
          if (rule.price === null) parts.push('price reset to standard')
          else if (rule.price !== undefined) parts.push(`price ${naira(rule.price)}`)
          if (rule.adjustPct !== undefined) parts.push(`price ${rule.adjustPct > 0 ? '+' : ''}${rule.adjustPct}%`)
          if (rule.stopSell !== undefined) parts.push(rule.stopSell ? 'closed to new bookings' : 'reopened for sale')
          if (rule.minStay !== undefined) parts.push(`minimum stay ${rule.minStay}`)
          const span = dates.length === 1 ? fmtDate(dates[0]) : `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`
          log('Rates', 'Rates updated', `${typeIds.join(', ')} · ${span} · ${parts.join(', ')}`)
        },

        setWeekendUplift: (value) => {
          set({ weekendUplift: value })
          log('Rates', 'Weekend pricing', `Friday and Saturday uplift set to ${Math.round(value * 100)}%`)
        },

        addSeason: (season) => {
          set((s) => ({ seasons: [...s.seasons, { ...season, id: `se${s.counters.id + 1}` }], counters: { ...s.counters, id: s.counters.id + 1 } }))
          log('Rates', 'Season added', `${season.name} · ${fmtDate(season.start)} – ${fmtDate(season.end)} · ${season.adjust > 0 ? '+' : ''}${Math.round(season.adjust * 100)}%`)
        },

        removeSeason: (seasonId) => {
          const season = get().seasons.find((s) => s.id === seasonId)
          set((s) => ({ seasons: s.seasons.filter((x) => x.id !== seasonId) }))
          if (season) log('Rates', 'Season removed', season.name)
        },

        addPromo: (promo) => {
          const code = promo.code.trim().toUpperCase()
          if (!/^[A-Z0-9]{4,16}$/.test(code)) return { ok: false, error: 'Use 4–16 letters or numbers, no spaces.' }
          if (get().promos.some((p) => p.code === code)) return { ok: false, error: `${code} already exists.` }
          set((s) => ({ promos: [{ ...promo, code, uses: 0 }, ...s.promos] }))
          log('Rates', 'Promo code created', `${code} · ${promo.percent}% off room rate · valid until ${fmtDate(promo.validUntil, 'd MMM yyyy')}`)
          return { ok: true }
        },

        togglePromo: (code) => {
          const promo = get().promos.find((p) => p.code === code)
          set((s) => ({ promos: s.promos.map((p) => (p.code === code ? { ...p, active: !p.active } : p)) }))
          if (promo) log('Rates', promo.active ? 'Promo paused' : 'Promo activated', code)
        },

        /* ---------- Settings ---------- */

        updateSettings: (patch) => {
          const settings = { ...get().settings, ...patch }
          set({ settings })
          applySettings(settings)
          log('Settings', 'Property settings saved', Object.keys(patch).filter((k) => k !== 'managerPin').join(', ') + (patch.managerPin ? ' · manager PIN changed' : ''))
        },

        setPermission: (route, role, allowed) => {
          set((s) => {
            const current = s.permissions[route] ?? []
            const next = allowed ? Array.from(new Set([...current, role])) : current.filter((r) => r !== role)
            return { permissions: { ...s.permissions, [route]: next } }
          })
          log('Settings', allowed ? 'Access granted' : 'Access removed', `${ROLE_LABEL[role]} · ${SCREEN_LABELS[route] ?? route}`)
        },

        setVoidApproval: (required) => {
          set({ voidNeedsApproval: required })
          log('Settings', 'Approval rule changed', required ? 'Voids now need a manager PIN' : 'Front desk can void charges without approval')
        },
      }
    },
    {
      name: STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) as unknown as HotelData,
    },
  ),
)

// Keep the shared HOTEL object in step with saved settings, including after rehydration and cross-tab sync.
useHotel.subscribe((s, prev) => {
  if (s.settings !== prev.settings) applySettings(s.settings)
})

/* ---------- Toasts (not persisted) ---------- */

export type ToastTone = 'success' | 'error' | 'info'
export interface Toast {
  id: number
  tone: ToastTone
  title: string
  body?: string
}

let toastSeq = 0
export const useToasts = create<{ toasts: Toast[]; push: (t: Omit<Toast, 'id'>) => void; dismiss: (id: number) => void }>()((set) => ({
  toasts: [],
  push: (t) => {
    const toastId = ++toastSeq
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id: toastId }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== toastId) })), t.tone === 'error' ? 6500 : 4500)
  },
  dismiss: (toastId) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== toastId) })),
}))

export const toast = {
  success: (title: string, body?: string) => useToasts.getState().push({ tone: 'success', title, body }),
  error: (title: string, body?: string) => useToasts.getState().push({ tone: 'error', title, body }),
  info: (title: string, body?: string) => useToasts.getState().push({ tone: 'info', title, body }),
}
