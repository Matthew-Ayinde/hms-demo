export type Role = 'manager' | 'frontdesk' | 'housekeeping' | 'restaurant'

export interface StaffUser {
  id: string
  name: string
  title: string
  role: Role
  initials: string
}

export type RoomTypeId = 'STD' | 'DLX' | 'EXS'

export interface RoomType {
  id: RoomTypeId
  name: string
  rate: number
  capacity: number
  bed: string
  size: number
  view: string
  amenities: string[]
  description: string
}

/** Housekeeping status. Occupancy is derived from reservations, never stored on the room. */
export type HkStatus = 'clean' | 'dirty' | 'inspected' | 'ooo'

export interface Room {
  id: string
  number: string
  typeId: RoomTypeId
  floor: number
  hk: HkStatus
  oooReason?: string
}

export interface Guest {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string
  nationality: string
  company?: string
  vip?: boolean
  /** Stays before this system went live (imported history). */
  stays: number
  preferences: string[]
  blacklist?: { reason: string; at: string; by: string }
  marketing?: boolean
  notes?: string
  anonymised?: boolean
  idType?: string
  idNumber?: string
}

export type ResStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
export type Source = 'Website' | 'Phone' | 'Walk-in' | 'Booking.com' | 'Expedia' | 'Corporate'
export type RatePlan = 'Room only' | 'Bed & breakfast' | 'Corporate'

export interface Reservation {
  id: string
  code: string
  guestId: string
  typeId: RoomTypeId
  roomId: string | null
  checkIn: string
  checkOut: string
  adults: number
  children: number
  status: ResStatus
  source: Source
  ratePlan: RatePlan
  /** Net nightly rate, before service charge and VAT. */
  rate: number
  eta?: string
  notes?: string
  createdAt: string
  createdBy: string
  checkedInAt?: string
  checkedOutAt?: string
  signature?: string
  idFile?: string
  /** Business dates whose room charge has been posted by night audit. */
  postedNights: string[]
  invoiceNo?: string
  cancelReason?: string
}

export type Dept =
  | 'Room'
  | 'Restaurant'
  | 'Bar'
  | 'Room service'
  | 'Laundry'
  | 'Minibar'
  | 'Transport'
  | 'Cancellation'
  | 'Other'

export interface Charge {
  id: string
  resId: string
  date: string
  time: string
  dept: Dept
  desc: string
  /** Net amount; service charge and VAT are applied at folio level. */
  amount: number
  by: string
  ref?: string
  void?: { reason: string; by: string; approvedBy: string; at: string }
}

export type PayMethod = 'Cash' | 'Card' | 'Bank transfer' | 'Mobile money' | 'Paystack' | 'City ledger'

export interface Payment {
  id: string
  resId: string
  time: string
  method: PayMethod
  amount: number
  ref?: string
  by: string
}

export type TaskType = 'Departure clean' | 'Stay-over' | 'Inspection'
export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface Task {
  id: string
  roomId: string
  type: TaskType
  assignee: string
  status: TaskStatus
  createdAt: string
  startedAt?: string
  doneAt?: string
  note?: string
}

export type Module =
  | 'Reservations'
  | 'Front desk'
  | 'Billing'
  | 'POS'
  | 'Housekeeping'
  | 'Maintenance'
  | 'Guests'
  | 'Rates'
  | 'Settings'
  | 'System'

export interface AuditEntry {
  id: string
  at: string
  userId: string
  module: Module
  action: string
  detail: string
  ref?: string
}

export interface HistoryDay {
  date: string
  roomsSold: number
  roomRevenue: number
  fnbRevenue: number
  otherRevenue: number
  bySource: Record<Source, number>
}

export type Outlet = 'Restaurant' | 'Bar' | 'Room service'

export interface MenuItem {
  id: string
  name: string
  category: string
  station: 'Kitchen' | 'Bar'
  price: number
}

export interface TicketLine {
  itemId: string
  name: string
  qty: number
  price: number
}

export interface PosTicket {
  id: string
  number: number
  outlet: Outlet
  table?: string
  lines: TicketLine[]
  net: number
  settlement: 'Room' | PayMethod
  resId?: string
  at: string
  by: string
}

export interface Season {
  id: string
  name: string
  start: string
  end: string
  /** Fractional adjustment, e.g. 0.15 = +15%. */
  adjust: number
}

/** Per room type, per date restrictions and overrides. */
export interface DayRule {
  price?: number
  stopSell?: boolean
  minStay?: number
}

export interface Promo {
  code: string
  percent: number
  validUntil: string
  uses: number
  active: boolean
  note?: string
}

export interface StockAlert {
  item: string
  store: string
  onHand: number
  par: number
  unit: string
}
