import { dateRange, nightsBetween } from './dates'
import type { Reservation, Room, RoomTypeId } from './types'

const HOLDS_ROOM: Reservation['status'][] = ['confirmed', 'checked_in']

/** Two stays clash when each starts before the other ends. Check-out day is free for a new arrival. */
export const overlaps = (aIn: string, aOut: string, bIn: string, bOut: string) => aIn < bOut && aOut > bIn

export function findConflict(
  reservations: Reservation[],
  roomId: string,
  checkIn: string,
  checkOut: string,
  ignoreId?: string,
) {
  return reservations.find(
    (r) =>
      r.id !== ignoreId &&
      r.roomId === roomId &&
      HOLDS_ROOM.includes(r.status) &&
      overlaps(checkIn, checkOut, r.checkIn, r.checkOut),
  )
}

/** Specific rooms that are free for the whole stay (not out of order, no clashing booking). */
export function freeRooms(
  rooms: Room[],
  reservations: Reservation[],
  checkIn: string,
  checkOut: string,
  typeId?: RoomTypeId,
  ignoreId?: string,
) {
  return rooms.filter(
    (room) =>
      (!typeId || room.typeId === typeId) &&
      room.hk !== 'ooo' &&
      !findConflict(reservations, room.id, checkIn, checkOut, ignoreId),
  )
}

/**
 * Sellable inventory for a room type: for each night, sellable rooms minus every
 * booking of that type (assigned or not). The stay is limited by its tightest night.
 */
export function typeAvailability(
  rooms: Room[],
  reservations: Reservation[],
  typeId: RoomTypeId,
  checkIn: string,
  checkOut: string,
) {
  const sellable = rooms.filter((r) => r.typeId === typeId && r.hk !== 'ooo').length
  const nights = dateRange(checkIn, Math.max(1, nightsBetween(checkIn, checkOut)))
  return Math.min(
    ...nights.map(
      (night) =>
        sellable -
        reservations.filter(
          (r) => r.typeId === typeId && HOLDS_ROOM.includes(r.status) && r.checkIn <= night && r.checkOut > night,
        ).length,
    ),
  )
}

/** Rooms occupied on a given night (any type). */
export function occupiedOn(reservations: Reservation[], night: string) {
  return reservations.filter((r) => HOLDS_ROOM.includes(r.status) && r.checkIn <= night && r.checkOut > night).length
}
