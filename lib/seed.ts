import { parseISO } from 'date-fns'
import { HOTEL, ROOM_TYPES, ROUTE_ACCESS, type HotelSettings } from './config'
import { dateRange, isWeekend, nightsBetween, shift } from './dates'
import { withTaxes } from './pricing'
import type {
  AuditEntry,
  Charge,
  DayRule,
  Dept,
  Guest,
  HistoryDay,
  HkStatus,
  Payment,
  PayMethod,
  Promo,
  RatePlan,
  Reservation,
  ResStatus,
  Room,
  Role,
  RoomTypeId,
  Season,
  Source,
  Task,
} from './types'

export interface HotelData {
  businessDate: string
  nightAuditDone: boolean
  rooms: Room[]
  guests: Guest[]
  reservations: Reservation[]
  charges: Charge[]
  payments: Payment[]
  tasks: Task[]
  audit: AuditEntry[]
  history: HistoryDay[]
  tickets: import('./types').PosTicket[]
  counters: { reservation: number; check: number; invoice: number; id: number }
  baseRates: Record<RoomTypeId, number>
  weekendUplift: number
  seasons: Season[]
  dayRules: Record<string, DayRule>
  promos: Promo[]
  settings: Partial<HotelSettings>
  permissions: Record<string, Role[]>
  voidNeedsApproval: boolean
}

/** Deterministic PRNG so every reset produces the same history. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ROOM_LAYOUT: [string, RoomTypeId][] = [
  ['101', 'STD'], ['102', 'STD'], ['103', 'STD'], ['104', 'STD'], ['105', 'STD'], ['106', 'STD'], ['107', 'DLX'], ['108', 'DLX'],
  ['201', 'STD'], ['202', 'STD'], ['203', 'STD'], ['204', 'STD'], ['205', 'DLX'], ['206', 'DLX'], ['207', 'DLX'], ['208', 'DLX'],
  ['301', 'DLX'], ['302', 'DLX'], ['303', 'DLX'], ['304', 'DLX'], ['305', 'EXS'], ['306', 'EXS'], ['307', 'EXS'], ['308', 'EXS'],
]

const HK_OVERRIDES: Record<string, HkStatus> = {
  '103': 'dirty',
  '104': 'dirty',
  '204': 'dirty',
  '303': 'dirty',
  '205': 'dirty',
  '306': 'dirty',
  '307': 'inspected',
  '304': 'ooo',
}

const GUESTS: Guest[] = [
  { id: 'g1', firstName: 'Daniel', lastName: 'Mensah', phone: '+233 24 418 2290', email: 'd.mensah@gmail.com', nationality: 'Ghanaian', stays: 1, preferences: ['Late check-out if possible'], idType: 'Passport', idNumber: 'G2281934' },
  { id: 'g2', firstName: 'Sarah', lastName: 'Whitfield', phone: '+44 7700 900412', email: 'sarah.whitfield@outlook.com', nationality: 'British', stays: 0, preferences: ['Non-smoking', 'Extra pillows'], idType: 'Passport', idNumber: '553019824' },
  { id: 'g3', firstName: 'Ibrahim', lastName: 'Musa', phone: '+234 803 221 7745', email: 'ibmusa@yahoo.com', nationality: 'Nigerian', stays: 3, preferences: [], idType: 'NIN slip', idNumber: '28817362514' },
  { id: 'g4', firstName: 'Chiamaka', lastName: 'Nwosu', phone: '+234 809 774 1203', email: 'chiamaka@nwosulegal.com', nationality: 'Nigerian', vip: true, stays: 6, preferences: ['High floor', 'Still water on arrival', 'Quiet room away from lift'], idType: "Driver's licence", idNumber: 'LAG-AKW-77213' },
  { id: 'g5', firstName: 'Oluwaseun', lastName: 'Adeyemi', phone: '+234 806 553 0981', email: 'seun.adeyemi@kestrelenergy.ng', nationality: 'Nigerian', company: 'Kestrel Energy Ltd', stays: 9, preferences: ['Corporate rate', 'Invoice to company'], idType: 'Company ID', idNumber: 'KEL-0442' },
  { id: 'g6', firstName: 'Emeka', lastName: 'Okonkwo', phone: '+234 802 119 6640', email: 'emeka.okonkwo@gmail.com', nationality: 'Nigerian', stays: 2, preferences: [], idType: 'NIN slip', idNumber: '30182746551' },
  { id: 'g7', firstName: 'Fatima', lastName: 'Bello', phone: '+234 815 330 2287', email: 'fatimabello@hotmail.com', nationality: 'Nigerian', stays: 0, preferences: ['Halal meals'], idType: 'International passport', idNumber: 'B03318472' },
  { id: 'g8', firstName: 'Michael', lastName: 'Brennan', phone: '+1 617 555 0193', email: 'mbrennan@atlasgrid.com', nationality: 'American', stays: 1, preferences: ['Airport transfer'], idType: 'Passport', idNumber: '674402918' },
  { id: 'g9', firstName: 'Ngozi', lastName: 'Eze', phone: '+234 817 004 5512', email: 'ngozi.eze@gmail.com', nationality: 'Nigerian', stays: 4, preferences: ['Ground floor'], idType: 'NIN slip', idNumber: '22910483376' },
  { id: 'g10', firstName: 'Pierre', lastName: 'Lambert', phone: '+33 6 12 44 80 19', email: 'p.lambert@orange.fr', nationality: 'French', stays: 0, preferences: ['French-speaking staff'], idType: 'Passport', idNumber: '19AV22871' },
  { id: 'g11', firstName: 'Kunle', lastName: 'Ogunleye', phone: '+234 805 661 9024', email: 'kunle.o@kestrelenergy.ng', nationality: 'Nigerian', company: 'Kestrel Energy Ltd', stays: 5, preferences: ['Long stay', 'Weekly laundry'], idType: 'Company ID', idNumber: 'KEL-0519' },
  { id: 'g12', firstName: 'Halima', lastName: 'Sule', phone: '+234 810 448 7731', email: 'halima.sule@gmail.com', nationality: 'Nigerian', stays: 1, preferences: [], idType: 'NIN slip', idNumber: '19284736501' },
  { id: 'g13', firstName: 'Folake', lastName: 'Adebayo', phone: '+234 803 990 1146', email: 'folake@adebayoarchitects.com', nationality: 'Nigerian', vip: true, stays: 8, preferences: ['Lagoon view', 'Fresh fruit in room', 'Feather-free pillows'], idType: 'International passport', idNumber: 'A11938205' },
  { id: 'g14', firstName: 'Tobi', lastName: 'Akinola', phone: '+234 816 225 4409', email: 'tobi.akinola@gmail.com', nationality: 'Nigerian', stays: 0, preferences: [] },
  { id: 'g15', firstName: 'Aisha', lastName: 'Abubakar', phone: '+234 802 773 0182', email: 'aisha.abubakar@gmail.com', nationality: 'Nigerian', stays: 0, preferences: [] },
  { id: 'g16', firstName: 'Yusuf', lastName: 'Danjuma', phone: '+234 807 330 9921', email: 'ydanjuma@gmail.com', nationality: 'Nigerian', stays: 2, preferences: ['Twin beds'] },
  { id: 'g17', firstName: 'Amaka', lastName: 'Obi', phone: '+234 813 552 7740', email: 'amaka.obi@gmail.com', nationality: 'Nigerian', stays: 1, preferences: [] },
  { id: 'g18', firstName: 'Rachel', lastName: 'Osei', phone: '+233 20 771 4432', email: 'rachel.osei@gmail.com', nationality: 'Ghanaian', stays: 0, preferences: [] },
  { id: 'g19', firstName: 'Bayo', lastName: 'Adekunle', phone: '+234 802 441 0087', email: 'bayo.adekunle@gmail.com', nationality: 'Nigerian', stays: 3, preferences: [] },
  { id: 'g20', firstName: 'Elena', lastName: 'Petrova', phone: '+49 151 2233 8841', email: 'elena.petrova@gmx.de', nationality: 'German', stays: 0, preferences: ['Vegetarian'] },
  { id: 'g21', firstName: 'Chidi', lastName: 'Anyanwu', phone: '+234 806 118 2205', email: 'chidi.anyanwu@kestrelenergy.ng', nationality: 'Nigerian', company: 'Kestrel Energy Ltd', stays: 2, preferences: [] },
  { id: 'g22', firstName: 'Hannah', lastName: 'Koenig', phone: '+41 79 334 12 09', email: 'hkoenig@bluewin.ch', nationality: 'Swiss', stays: 0, preferences: [] },
  { id: 'g23', firstName: 'Segun', lastName: 'Afolabi', phone: '+234 809 662 3381', email: 'segun.afolabi@gmail.com', nationality: 'Nigerian', stays: 1, preferences: [] },
  { id: 'g24', firstName: 'Zainab', lastName: 'Lawal', phone: '+234 818 207 6654', email: 'zainab.lawal@gmail.com', nationality: 'Nigerian', stays: 0, preferences: [] },
  { id: 'g25', firstName: 'Victor', lastName: 'Eze', phone: '+234 803 774 5520', email: 'victor.eze@gmail.com', nationality: 'Nigerian', stays: 0, preferences: [] },
  { id: 'g26', firstName: 'Lola', lastName: 'Martins', phone: '+234 805 210 9937', email: 'lola.martins@gmail.com', nationality: 'Nigerian', stays: 2, preferences: [] },
  { id: 'g27', firstName: 'James', lastName: 'Okafor', phone: '+234 812 900 3346', email: 'james.okafor@gmail.com', nationality: 'Nigerian', stays: 0, preferences: [] },
  { id: 'g28', firstName: 'Mariam', lastName: 'Yusuf', phone: '+234 806 334 7782', email: 'mariam.yusuf@gmail.com', nationality: 'Nigerian', stays: 0, preferences: [] },
  { id: 'g29', firstName: 'Ifeoma', lastName: 'Chukwu', phone: '+234 803 118 4420', email: 'ifeoma.chukwu@gmail.com', nationality: 'Nigerian', stays: 1, preferences: [] },
  { id: 'g30', firstName: 'Thomas', lastName: 'Reid', phone: '+44 7911 123456', email: 't.reid@reidconsult.co.uk', nationality: 'British', stays: 0, preferences: [] },
  { id: 'g31', firstName: 'Bisi', lastName: 'Lawal', phone: '+234 802 556 1023', email: 'bisi.lawal@gmail.com', nationality: 'Nigerian', stays: 2, preferences: [] },
  { id: 'g32', firstName: 'Kelechi', lastName: 'Nnaji', phone: '+234 816 772 3305', email: 'kelechi.nnaji@gmail.com', nationality: 'Nigerian', stays: 0, preferences: [] },
  { id: 'g33', firstName: 'Adebola', lastName: 'Ogunbiyi', phone: '+234 809 112 4478', email: 'bola.ogunbiyi@gmail.com', nationality: 'Nigerian', stays: 1, preferences: [] },
  { id: 'g34', firstName: 'Samuel', lastName: 'Owusu', phone: '+233 24 667 1092', email: 's.owusu@gmail.com', nationality: 'Ghanaian', stays: 0, preferences: [] },
  { id: 'g35', firstName: 'Olivia', lastName: 'Hartmann', phone: '+49 160 552 7718', email: 'o.hartmann@web.de', nationality: 'German', stays: 0, preferences: ['Quiet room'] },
  { id: 'g36', firstName: 'Nnamdi', lastName: 'Okeke', phone: '+234 803 559 2210', email: 'nnamdi.okeke@gmail.com', nationality: 'Nigerian', stays: 3, preferences: [] },
  { id: 'g37', firstName: 'Bukola', lastName: 'Alade', phone: '+234 806 220 1934', email: 'bukola.alade@gmail.com', nationality: 'Nigerian', stays: 0, preferences: [] },
  { id: 'g38', firstName: 'David', lastName: 'Clarke', phone: '+44 7700 900877', email: 'dclarke@clarkeassoc.co.uk', nationality: 'British', stays: 0, preferences: [] },
  { id: 'g39', firstName: 'Ifeanyi', lastName: 'Umeh', phone: '+234 805 442 0193', email: 'ifeanyi.umeh@kestrelenergy.ng', nationality: 'Nigerian', company: 'Kestrel Energy Ltd', stays: 4, preferences: [] },
  { id: 'g40', firstName: 'Marco', lastName: 'Bianchi', phone: '+39 347 112 9083', email: 'marco.bianchi@libero.it', nationality: 'Italian', stays: 0, preferences: [] },
  { id: 'g41', firstName: 'Temitope', lastName: 'Ajayi', phone: '+234 802 980 3375', email: 'tope.ajayi@gmail.com', nationality: 'Nigerian', vip: true, stays: 5, preferences: ['Lagoon view'] },
  { id: 'g42', firstName: 'Grace', lastName: 'Okoro', phone: '+234 813 664 2290', email: 'grace.okoro@gmail.com', nationality: 'Nigerian', stays: 1, preferences: [] },
  { id: 'g43', firstName: 'Kofi', lastName: 'Boateng', phone: '+233 50 118 2245', email: 'kofi.boateng@gmail.com', nationality: 'Ghanaian', stays: 0, preferences: [] },
  { id: 'g44', firstName: 'Usman', lastName: 'Garba', phone: '+234 806 773 1188', email: 'usman.garba@gmail.com', nationality: 'Nigerian', stays: 2, preferences: [] },
  { id: 'g45', firstName: 'Chioma', lastName: 'Eze', phone: '+234 809 440 7726', email: 'chioma.eze@gmail.com', nationality: 'Nigerian', stays: 0, preferences: [] },
  // Same person as g4, booked once by phone with a personal email: shows up as a possible duplicate.
  { id: 'g47', firstName: 'Chiamaka', lastName: 'Nwosu', phone: '0809 774 1203', email: 'chiamaka.nwosu@gmail.com', nationality: 'Nigerian', stays: 2, preferences: ['Extra towels'] },
  { id: 'g48', firstName: 'Peter', lastName: 'Adamu', phone: '+234 807 115 6623', email: 'p.adamu@yahoo.com', nationality: 'Nigerian', stays: 1, preferences: [], blacklist: { reason: 'Left without settling a ₦145,000 bill (Room 206, March 2026)', at: '2026-03-14T09:30:00', by: 'u-gm' } },
  { id: 'g46', firstName: 'Ahmed', lastName: 'Saleh', phone: '+971 50 334 8812', email: 'a.saleh@gulfline.ae', nationality: 'Emirati', stays: 0, preferences: [] },
]

interface ResSpec {
  guest: string
  room: string | null
  type: RoomTypeId
  in: number
  out: number
  status: ResStatus
  source: Source
  plan?: RatePlan
  adults?: number
  children?: number
  eta?: string
  notes?: string
  /** 'full' = whole stay prepaid, number = fixed amount. */
  paid?: { method: PayMethod; amount: number | 'full' | 'night'; ref?: string }
  extras?: { day: number; dept: Dept; desc: string; amount: number }[]
}

const RESERVATIONS: ResSpec[] = [
  // Departing today
  { guest: 'g1', room: '203', type: 'STD', in: -3, out: 0, status: 'checked_in', source: 'Booking.com', notes: 'Pay at hotel (Booking.com)',
    extras: [
      { day: -2, dept: 'Restaurant', desc: 'Restaurant · Check #1031', amount: 18500 },
      { day: -1, dept: 'Bar', desc: 'Pool bar · Check #1036', amount: 9000 },
      { day: -1, dept: 'Laundry', desc: 'Laundry · 4 items', amount: 6000 },
    ] },
  { guest: 'g2', room: '302', type: 'DLX', in: -2, out: 0, status: 'checked_in', source: 'Website', plan: 'Bed & breakfast',
    paid: { method: 'Paystack', amount: 60000, ref: 'PSK-T88213004' },
    extras: [
      { day: -2, dept: 'Room service', desc: 'Room service · Check #1029', amount: 12000 },
      { day: -1, dept: 'Minibar', desc: 'Minibar · 2 items', amount: 3500 },
    ] },
  { guest: 'g3', room: '106', type: 'STD', in: -1, out: 0, status: 'checked_in', source: 'Walk-in', paid: { method: 'Cash', amount: 'full' } },
  // Staying over
  { guest: 'g4', room: '306', type: 'EXS', in: -2, out: 2, status: 'checked_in', source: 'Phone', notes: 'VIP — GM welcome amenity delivered',
    paid: { method: 'Bank transfer', amount: 200000, ref: 'TRF/ZEN/77120' },
    extras: [
      { day: -2, dept: 'Transport', desc: 'Airport pickup (MMIA)', amount: 25000 },
      { day: -1, dept: 'Room service', desc: 'Room service · Check #1037', amount: 15500 },
    ] },
  { guest: 'g5', room: '205', type: 'DLX', in: -4, out: 1, status: 'checked_in', source: 'Corporate', plan: 'Corporate', notes: 'Bill to Kestrel Energy Ltd (city ledger)',
    extras: [
      { day: -3, dept: 'Restaurant', desc: 'Restaurant · Check #1018', amount: 22000 },
      { day: -2, dept: 'Laundry', desc: 'Laundry · 6 items', amount: 8500 },
    ] },
  { guest: 'g6', room: '101', type: 'STD', in: -1, out: 3, status: 'checked_in', source: 'Website', paid: { method: 'Paystack', amount: 'full', ref: 'PSK-T88207731' } },
  { guest: 'g7', room: '207', type: 'DLX', in: -1, out: 1, status: 'checked_in', source: 'Booking.com' },
  { guest: 'g8', room: '308', type: 'EXS', in: -3, out: 4, status: 'checked_in', source: 'Expedia', paid: { method: 'Card', amount: 300000, ref: 'POS-AUTH 448210' },
    extras: [
      { day: -3, dept: 'Bar', desc: 'Lobby bar · Check #1022', amount: 14000 },
      { day: -1, dept: 'Restaurant', desc: 'Restaurant · Check #1034', amount: 26500 },
    ] },
  { guest: 'g9', room: '102', type: 'STD', in: -2, out: 1, status: 'checked_in', source: 'Phone', paid: { method: 'Cash', amount: 100000 } },
  { guest: 'g10', room: '301', type: 'DLX', in: -1, out: 2, status: 'checked_in', source: 'Booking.com' },
  { guest: 'g11', room: '201', type: 'STD', in: -1, out: 6, status: 'checked_in', source: 'Corporate', plan: 'Corporate', paid: { method: 'Bank transfer', amount: 150000, ref: 'TRF/GTB/30981' },
    extras: [{ day: -1, dept: 'Laundry', desc: 'Laundry · 9 items', amount: 12000 }] },
  { guest: 'g12', room: '108', type: 'DLX', in: -2, out: 3, status: 'checked_in', source: 'Website', paid: { method: 'Paystack', amount: 'full', ref: 'PSK-T88199420' } },
  // Arriving today
  { guest: 'g13', room: '307', type: 'EXS', in: 0, out: 3, status: 'confirmed', source: 'Website', eta: '14:00', adults: 2, notes: 'VIP — anniversary. Fruit plate and card in room.',
    paid: { method: 'Paystack', amount: 'night', ref: 'PSK-T88231195' } },
  { guest: 'g14', room: '104', type: 'STD', in: 0, out: 2, status: 'confirmed', source: 'Phone', eta: '16:30' },
  { guest: 'g15', room: '206', type: 'DLX', in: 0, out: 1, status: 'confirmed', source: 'Booking.com', eta: '19:00' },
  { guest: 'g16', room: null, type: 'STD', in: 0, out: 2, status: 'confirmed', source: 'Phone', eta: '21:00', notes: 'Requested twin beds' },
  // Future
  { guest: 'g17', room: '202', type: 'STD', in: 1, out: 4, status: 'confirmed', source: 'Website', paid: { method: 'Paystack', amount: 'full', ref: 'PSK-T88240017' } },
  { guest: 'g18', room: '303', type: 'DLX', in: 2, out: 5, status: 'confirmed', source: 'Booking.com' },
  { guest: 'g19', room: '105', type: 'STD', in: 3, out: 6, status: 'confirmed', source: 'Phone' },
  { guest: 'g20', room: '305', type: 'EXS', in: 4, out: 7, status: 'confirmed', source: 'Expedia' },
  { guest: 'g21', room: '207', type: 'DLX', in: 2, out: 4, status: 'confirmed', source: 'Corporate', plan: 'Corporate' },
  { guest: 'g22', room: '107', type: 'DLX', in: 5, out: 9, status: 'confirmed', source: 'Website', paid: { method: 'Paystack', amount: 'night', ref: 'PSK-T88241102' } },
  { guest: 'g23', room: '104', type: 'STD', in: 3, out: 5, status: 'confirmed', source: 'Phone' },
  { guest: 'g24', room: '306', type: 'EXS', in: 5, out: 8, status: 'confirmed', source: 'Website', paid: { method: 'Paystack', amount: 'night', ref: 'PSK-T88241388' } },
  { guest: 'g25', room: '208', type: 'DLX', in: 1, out: 3, status: 'confirmed', source: 'Booking.com' },
  { guest: 'g26', room: '101', type: 'STD', in: 6, out: 9, status: 'confirmed', source: 'Phone' },
  { guest: 'g27', room: null, type: 'DLX', in: 1, out: 3, status: 'confirmed', source: 'Booking.com', notes: 'OTA booking — assign room' },
  { guest: 'g28', room: null, type: 'STD', in: 2, out: 4, status: 'confirmed', source: 'Expedia', notes: 'OTA booking — assign room' },
  { guest: 'g44', room: '102', type: 'STD', in: 4, out: 8, status: 'confirmed', source: 'Phone' },
  { guest: 'g46', room: '205', type: 'DLX', in: 5, out: 8, status: 'confirmed', source: 'Booking.com' },
  { guest: 'g39', room: '206', type: 'DLX', in: 6, out: 9, status: 'confirmed', source: 'Corporate', plan: 'Corporate' },
  { guest: 'g45', room: '303', type: 'DLX', in: 6, out: 9, status: 'confirmed', source: 'Website', paid: { method: 'Paystack', amount: 'night', ref: 'PSK-T88242210' } },
  { guest: 'g37', room: '103', type: 'STD', in: 7, out: 10, status: 'confirmed', source: 'Website', paid: { method: 'Paystack', amount: 'full', ref: 'PSK-T88242517' } },
  { guest: 'g40', room: '302', type: 'DLX', in: 7, out: 12, status: 'confirmed', source: 'Expedia' },
  { guest: 'g38', room: '204', type: 'STD', in: 8, out: 11, status: 'confirmed', source: 'Booking.com' },
  { guest: 'g41', room: '307', type: 'EXS', in: 8, out: 10, status: 'confirmed', source: 'Phone', notes: 'VIP — returning guest' },
  { guest: 'g42', room: '202', type: 'STD', in: 9, out: 13, status: 'confirmed', source: 'Website' },
  { guest: 'g43', room: '208', type: 'DLX', in: 10, out: 12, status: 'confirmed', source: 'Booking.com' },
  { guest: 'g47', room: '301', type: 'DLX', in: 11, out: 13, status: 'confirmed', source: 'Phone', notes: 'Booked by phone — check for existing profile' },
  // More in-house guests so tonight reads like a normal Saturday
  { guest: 'g33', room: '105', type: 'STD', in: -1, out: 2, status: 'checked_in', source: 'Phone', paid: { method: 'Cash', amount: 50000 } },
  { guest: 'g34', room: '208', type: 'DLX', in: -2, out: 1, status: 'checked_in', source: 'Booking.com' },
  { guest: 'g35', room: '305', type: 'EXS', in: -1, out: 3, status: 'checked_in', source: 'Expedia', paid: { method: 'Card', amount: 'full', ref: 'POS-AUTH 451187' } },
  { guest: 'g36', room: '202', type: 'STD', in: -2, out: 1, status: 'checked_in', source: 'Website', paid: { method: 'Paystack', amount: 'full', ref: 'PSK-T88201164' },
    extras: [{ day: -1, dept: 'Restaurant', desc: 'Restaurant · Check #1035', amount: 13500 }] },
  // Recent departures and a cancellation
  { guest: 'g29', room: '103', type: 'STD', in: -4, out: -1, status: 'checked_out', source: 'Website', paid: { method: 'Paystack', amount: 'full', ref: 'PSK-T88170023' } },
  { guest: 'g30', room: '204', type: 'STD', in: -3, out: -1, status: 'checked_out', source: 'Booking.com', paid: { method: 'Card', amount: 'full', ref: 'POS-AUTH 440913' } },
  { guest: 'g31', room: '303', type: 'DLX', in: -5, out: -1, status: 'checked_out', source: 'Phone', paid: { method: 'Bank transfer', amount: 'full', ref: 'TRF/ACC/11873' } },
  { guest: 'g32', room: '202', type: 'STD', in: 4, out: 6, status: 'cancelled', source: 'Website' },
]

export function buildSeed(today: string): HotelData {
  const rand = mulberry32(20261024)
  const now = Date.now()
  const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString()
  let idSeq = 1
  const nextId = (prefix: string) => `${prefix}${idSeq++}`

  const rooms: Room[] = ROOM_LAYOUT.map(([number, typeId]) => ({
    id: `r${number}`,
    number,
    typeId,
    floor: Number(number[0]),
    hk: HK_OVERRIDES[number] ?? 'clean',
    oooReason: number === '304' ? 'AC compressor fault — technician booked' : undefined,
  }))

  const reservations: Reservation[] = []
  const charges: Charge[] = []
  const payments: Payment[] = []
  let resCounter = 24811

  for (const spec of RESERVATIONS) {
    const type = ROOM_TYPES.find((t) => t.id === spec.type)!
    const plan = spec.plan ?? 'Room only'
    const rate = plan === 'Corporate' ? Math.round(type.rate * 0.85) : plan === 'Bed & breakfast' ? type.rate + 8000 : type.rate
    const checkIn = shift(today, spec.in)
    const checkOut = shift(today, spec.out)
    const id = nextId('res')
    const roomNo = spec.room
    const posted: string[] = []

    if (spec.status === 'checked_in' || spec.status === 'checked_out') {
      for (const night of dateRange(checkIn, nightsBetween(checkIn, checkOut))) {
        if (night >= today) break
        posted.push(night)
        charges.push({
          id: nextId('c'),
          resId: id,
          date: night,
          time: `${night}T23:55:00`,
          dept: 'Room',
          desc: `Room ${roomNo} · ${plan}`,
          amount: rate,
          by: 'system',
        })
      }
    }
    for (const extra of spec.extras ?? []) {
      const date = shift(today, extra.day)
      charges.push({ id: nextId('c'), resId: id, date, time: `${date}T20:${String(10 + idSeq).slice(-2)}:00`, dept: extra.dept, desc: extra.desc, amount: extra.amount, by: extra.dept === 'Laundry' ? 'u-fd' : 'u-pos' })
    }

    if (spec.paid) {
      const nights = nightsBetween(checkIn, checkOut)
      const extrasNet = (spec.extras ?? []).reduce((s, e) => s + e.amount, 0)
      const amount =
        spec.paid.amount === 'full'
          ? withTaxes(rate * nights + extrasNet).total
          : spec.paid.amount === 'night'
            ? withTaxes(rate).total
            : spec.paid.amount
      const paidDate = shift(today, Math.min(spec.in, 0) - (spec.status === 'confirmed' ? 3 : 0))
      payments.push({ id: nextId('p'), resId: id, time: `${paidDate}T11:20:00`, method: spec.paid.method, amount, ref: spec.paid.ref, by: spec.paid.method === 'Paystack' ? 'web' : 'u-fd' })
    }

    reservations.push({
      id,
      code: `${HOTEL.codePrefix}-${resCounter++}`,
      guestId: spec.guest,
      typeId: spec.type,
      roomId: roomNo ? `r${roomNo}` : null,
      checkIn,
      checkOut,
      adults: spec.adults ?? (spec.type === 'STD' ? 1 : 2),
      children: spec.children ?? 0,
      status: spec.status,
      source: spec.source,
      ratePlan: plan,
      rate,
      eta: spec.eta,
      notes: spec.notes,
      createdAt: `${shift(today, Math.min(spec.in, 0) - 6)}T10:00:00`,
      createdBy: spec.source === 'Website' ? 'web' : 'u-fd',
      checkedInAt: spec.status !== 'confirmed' && spec.status !== 'cancelled' ? `${checkIn}T15:10:00` : undefined,
      checkedOutAt: spec.status === 'checked_out' ? `${checkOut}T11:40:00` : undefined,
      postedNights: posted,
      invoiceNo: spec.status === 'checked_out' ? `INV-${String(8840 + reservations.length).padStart(6, '0')}` : undefined,
      cancelReason: spec.status === 'cancelled' ? 'Guest changed travel plans' : undefined,
    })
  }

  const tasks: Task[] = [
    { id: nextId('t'), roomId: 'r104', type: 'Departure clean', assignee: 'u-hk', status: 'todo', createdAt: hoursAgo(3), note: 'Arrival today, ETA 16:30. Clean first.' },
    { id: nextId('t'), roomId: 'r204', type: 'Departure clean', assignee: 'u-hk', status: 'in_progress', createdAt: hoursAgo(3), startedAt: hoursAgo(0.4) },
    { id: nextId('t'), roomId: 'r103', type: 'Departure clean', assignee: 'hk-2', status: 'todo', createdAt: hoursAgo(3) },
    { id: nextId('t'), roomId: 'r306', type: 'Stay-over', assignee: 'u-hk', status: 'todo', createdAt: hoursAgo(3), note: 'VIP. Replace still water, guest prefers service after 11:00.' },
    { id: nextId('t'), roomId: 'r205', type: 'Stay-over', assignee: 'hk-3', status: 'todo', createdAt: hoursAgo(3) },
    { id: nextId('t'), roomId: 'r303', type: 'Departure clean', assignee: 'hk-3', status: 'todo', createdAt: hoursAgo(3) },
    { id: nextId('t'), roomId: 'r107', type: 'Inspection', assignee: 'hk-sup', status: 'todo', createdAt: hoursAgo(2), note: 'Cleaned yesterday evening, needs sign-off.' },
  ]

  const history: HistoryDay[] = dateRange(shift(today, -30), 30).map((date) => {
    const weekend = isWeekend(date)
    const sunday = parseISO(date).getDay() === 0
    const occ = Math.min(0.96, 0.58 + (weekend ? 0.22 : sunday ? 0.04 : 0) + rand() * 0.14)
    const roomsSold = Math.round(occ * 23)
    const adr = Math.round((48500 + rand() * 6500 + (weekend ? 3500 : 0)) / 100) * 100
    const roomRevenue = roomsSold * adr
    const fnbRevenue = Math.round((roomRevenue * (0.24 + rand() * 0.09) + (weekend ? 180000 * rand() : 0)) / 500) * 500
    const otherRevenue = Math.round((roomRevenue * (0.035 + rand() * 0.03)) / 500) * 500
    const weights: Record<Source, number> = {
      Website: 0.22 + rand() * 0.06,
      'Booking.com': 0.26 + rand() * 0.06,
      Expedia: 0.07 + rand() * 0.03,
      Phone: 0.15 + rand() * 0.04,
      'Walk-in': 0.09 + rand() * 0.04,
      Corporate: 0.12 + rand() * 0.04,
    }
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
    const bySource = Object.fromEntries(
      Object.entries(weights).map(([k, w]) => [k, Math.round((roomRevenue * w) / totalWeight)]),
    ) as Record<Source, number>
    return { date, roomsSold, roomRevenue, fnbRevenue, otherRevenue, bySource }
  })

  const yesterday = shift(today, -1)
  const postedLastNight = charges.filter((c) => c.dept === 'Room' && c.date === yesterday).length
  const byCode = (guestId: string) => reservations.find((r) => r.guestId === guestId)!.code

  const audit = ([
    { id: nextId('a'), at: hoursAgo(9.5), userId: 'system', module: 'System', action: 'Night audit closed', detail: `Business date ${yesterday} closed · ${postedLastNight} room charges posted`, ref: yesterday },
    { id: nextId('a'), at: hoursAgo(7.2), userId: 'web', module: 'Reservations', action: 'Online booking', detail: `New booking for Hannah Koenig · Deluxe King · deposit via Paystack`, ref: byCode('g22') },
    { id: nextId('a'), at: hoursAgo(5.1), userId: 'u-gm', module: 'Maintenance', action: 'Room out of order', detail: 'Room 304 blocked: AC compressor fault — technician booked' },
    { id: nextId('a'), at: hoursAgo(4.4), userId: 'u-fd', module: 'Front desk', action: 'Check-out', detail: 'Bisi Lawal checked out of Room 303 · balance settled', ref: byCode('g31') },
    { id: nextId('a'), at: hoursAgo(4.0), userId: 'u-fd', module: 'Reservations', action: 'Booking cancelled', detail: 'Kelechi Nnaji cancelled · outside 48h window, no fee', ref: byCode('g32') },
    { id: nextId('a'), at: hoursAgo(3.1), userId: 'u-gm', module: 'Housekeeping', action: 'Tasks assigned', detail: '7 housekeeping tasks assigned for today' },
    { id: nextId('a'), at: hoursAgo(1.6), userId: 'u-pos', module: 'POS', action: 'Void approved', detail: 'Check #1040: 1 × Heineken 60cl voided (wrong item) · approved by Adaeze Okafor' },
    { id: nextId('a'), at: hoursAgo(0.4), userId: 'u-hk', module: 'Housekeeping', action: 'Cleaning started', detail: 'Room 204 · Departure clean' },
  ] satisfies AuditEntry[]).reverse()

  return {
    businessDate: today,
    nightAuditDone: false,
    rooms,
    // Roughly two in three guests opted in to marketing when they first booked.
    guests: GUESTS.map((g, i) => ({ ...g, marketing: g.marketing ?? i % 3 !== 2 })),
    reservations,
    charges,
    payments,
    tasks,
    audit,
    history,
    tickets: [],
    counters: { reservation: resCounter, check: 1043, invoice: 8851, id: idSeq + 1000 },
    baseRates: { STD: 35000, DLX: 50000, EXS: 85000 },
    weekendUplift: 0.1,
    seasons: [
      { id: 'se1', name: 'Trade fair week', start: shift(today, 5), end: shift(today, 9), adjust: 0.15 },
      { id: 'se2', name: 'Festive peak', start: `${today.slice(0, 4)}-12-18`, end: `${Number(today.slice(0, 4)) + 1}-01-03`, adjust: 0.35 },
    ],
    dayRules: {
      [`EXS|${shift(today, 1)}`]: { price: 95000 },
      [`STD|${shift(today, 6)}`]: { stopSell: true },
      [`STD|${shift(today, 7)}`]: { stopSell: true },
      [`DLX|${shift(today, 5)}`]: { minStay: 2 },
      [`EXS|${shift(today, 5)}`]: { minStay: 2 },
    },
    promos: [
      { code: 'DIRECT10', percent: 10, validUntil: shift(today, 60), uses: 14, active: true, note: 'Website exclusive' },
      { code: 'KESTREL15', percent: 15, validUntil: shift(today, 200), uses: 9, active: true, note: 'Kestrel Energy staff' },
      { code: 'RAINY20', percent: 20, validUntil: shift(today, -12), uses: 31, active: false, note: 'Rainy-season campaign (ended)' },
    ],
    settings: {},
    permissions: structuredClone(ROUTE_ACCESS),
    voidNeedsApproval: true,
  }
}
