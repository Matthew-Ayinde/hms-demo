'use client'

import { useMemo } from 'react'
import { ROOM_TYPES, USERS } from './config'
import { folioTotals } from './pricing'
import { pendingNights, useHotel, useSession } from './store'
import type { Guest, Reservation, Room, RoomType } from './types'

export function useCurrentUser() {
  const userId = useSession((s) => s.userId)
  return USERS.find((u) => u.id === userId) ?? null
}

export const roomTypeOf = (id: string) => ROOM_TYPES.find((t) => t.id === id) as RoomType

export function useLookups() {
  const guests = useHotel((s) => s.guests)
  const rooms = useHotel((s) => s.rooms)
  return useMemo(() => {
    const guestMap = new Map(guests.map((g) => [g.id, g]))
    const roomMap = new Map(rooms.map((r) => [r.id, r]))
    return {
      guest: (id: string) => guestMap.get(id) as Guest,
      room: (id: string | null) => (id ? roomMap.get(id) : undefined) as Room | undefined,
      guestName: (id: string) => {
        const g = guestMap.get(id)
        return g ? `${g.firstName} ${g.lastName}` : 'Unknown guest'
      },
    }
  }, [guests, rooms])
}

export function useFolio(resId: string) {
  const allCharges = useHotel((s) => s.charges)
  const allPayments = useHotel((s) => s.payments)
  return useMemo(() => {
    const charges = allCharges.filter((c) => c.resId === resId).sort((a, b) => a.time.localeCompare(b.time))
    const payments = allPayments.filter((p) => p.resId === resId).sort((a, b) => a.time.localeCompare(b.time))
    return { charges, payments, totals: folioTotals(charges, payments) }
  }, [allCharges, allPayments, resId])
}

/** Balance per reservation, for list views. */
export function useBalances() {
  const charges = useHotel((s) => s.charges)
  const payments = useHotel((s) => s.payments)
  return useMemo(() => {
    const byRes = new Map<string, { charges: typeof charges; payments: typeof payments }>()
    for (const c of charges) {
      if (!byRes.has(c.resId)) byRes.set(c.resId, { charges: [], payments: [] })
      byRes.get(c.resId)!.charges.push(c)
    }
    for (const p of payments) {
      if (!byRes.has(p.resId)) byRes.set(p.resId, { charges: [], payments: [] })
      byRes.get(p.resId)!.payments.push(p)
    }
    return (resId: string) => {
      const entry = byRes.get(resId)
      return entry ? folioTotals(entry.charges, entry.payments) : folioTotals([], [])
    }
  }, [charges, payments])
}

export interface FrontDeskLists {
  arrivals: Reservation[]
  departures: Reservation[]
  inHouse: Reservation[]
  arrivalsPending: number
  departuresPending: number
}

export function useFrontDeskLists(): FrontDeskLists {
  const reservations = useHotel((s) => s.reservations)
  const today = useHotel((s) => s.businessDate)
  return useMemo(() => {
    const arrivals = reservations.filter(
      (r) => r.checkIn === today && (r.status === 'confirmed' || r.status === 'checked_in'),
    )
    const departures = reservations.filter(
      (r) => r.checkOut === today && (r.status === 'checked_in' || r.status === 'checked_out') && r.checkIn < today,
    )
    const inHouse = reservations.filter((r) => r.status === 'checked_in')
    return {
      arrivals,
      departures,
      inHouse,
      arrivalsPending: arrivals.filter((r) => r.status === 'confirmed').length,
      departuresPending: departures.filter((r) => r.status === 'checked_in').length,
    }
  }, [reservations, today])
}

export function usePendingRoomCharge(res: Reservation | undefined) {
  const today = useHotel((s) => s.businessDate)
  if (!res || res.status !== 'checked_in') return { nights: [] as string[], amount: 0 }
  const nights = pendingNights(res, today)
  return { nights, amount: nights.length * res.rate }
}
