import { nightsBetween } from './dates'
import { folioTotals } from './pricing'
import type { Charge, Guest, Payment, Reservation, Source } from './types'

const phoneKey = (phone: string) => phone.replace(/\D/g, '').slice(-10)
const nameKey = (g: Guest) => `${g.firstName} ${g.lastName}`.trim().toLowerCase()

/** Profiles that share a phone number or an exact full name. */
export function findDuplicates(guests: Guest[]) {
  const map = new Map<string, string[]>()
  const live = guests.filter((g) => !g.anonymised)
  for (const a of live)
    for (const b of live) {
      if (a.id === b.id) continue
      const samePhone = phoneKey(a.phone).length === 10 && phoneKey(a.phone) === phoneKey(b.phone)
      if (samePhone || nameKey(a) === nameKey(b)) map.set(a.id, [...(map.get(a.id) ?? []), b.id])
    }
  return map
}

export interface GuestStats {
  stays: number
  nights: number
  spend: number
  lastStay?: string
  upcoming?: Reservation
  inHouse?: Reservation
  topSource?: Source
}

/** Lifetime figures: imported stays plus everything recorded in this system. */
export function guestStats(guest: Guest, reservations: Reservation[], charges: Charge[], payments: Payment[]): GuestStats {
  const own = reservations.filter((r) => r.guestId === guest.id && r.status !== 'cancelled')
  const completed = own.filter((r) => r.status === 'checked_out')
  const spend = own
    .filter((r) => r.status !== 'confirmed')
    .reduce((sum, r) => sum + folioTotals(charges.filter((c) => c.resId === r.id), payments.filter((p) => p.resId === r.id)).total, 0)
  const sources = new Map<Source, number>()
  for (const r of own) sources.set(r.source, (sources.get(r.source) ?? 0) + 1)
  return {
    stays: guest.stays + completed.length,
    nights: own.filter((r) => r.status !== 'confirmed').reduce((s, r) => s + nightsBetween(r.checkIn, r.checkOut), 0),
    spend,
    lastStay: completed.map((r) => r.checkOut).sort().at(-1),
    upcoming: own.filter((r) => r.status === 'confirmed').sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0],
    inHouse: own.find((r) => r.status === 'checked_in'),
    topSource: [...sources.entries()].sort((a, b) => b[1] - a[1])[0]?.[0],
  }
}
