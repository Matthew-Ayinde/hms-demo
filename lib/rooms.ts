import type { Reservation, Room } from './types'
import type { Tone } from '@/components/ui'

export type RoomState = 'vacant_clean' | 'inspected' | 'vacant_dirty' | 'occupied' | 'occupied_dirty' | 'ooo'

export const ROOM_STATE_META: Record<RoomState, { label: string; short: string; tone: Tone }> = {
  vacant_clean: { label: 'Vacant · Clean', short: 'Clean', tone: 'ok' },
  inspected: { label: 'Vacant · Inspected', short: 'Inspected', tone: 'brand' },
  vacant_dirty: { label: 'Vacant · Dirty', short: 'Dirty', tone: 'warn' },
  occupied: { label: 'Occupied', short: 'Occupied', tone: 'info' },
  occupied_dirty: { label: 'Occupied · Service due', short: 'Service due', tone: 'info' },
  ooo: { label: 'Out of order', short: 'Out of order', tone: 'danger' },
}

export function roomState(room: Room, occupant: Reservation | undefined): RoomState {
  if (room.hk === 'ooo') return 'ooo'
  if (occupant) return room.hk === 'dirty' ? 'occupied_dirty' : 'occupied'
  if (room.hk === 'dirty') return 'vacant_dirty'
  if (room.hk === 'inspected') return 'inspected'
  return 'vacant_clean'
}

/** Map of roomId → in-house reservation. */
export function occupants(reservations: Reservation[]) {
  const map = new Map<string, Reservation>()
  for (const r of reservations) if (r.status === 'checked_in' && r.roomId) map.set(r.roomId, r)
  return map
}

export const isReady = (room: Room) => room.hk === 'clean' || room.hk === 'inspected'
