import type { MenuItem, Role, RoomType, Source, StaffUser, StockAlert } from './types'

/**
 * Everything client-specific lives here. Swap the name, contact details and
 * rates for the client's real ones before the demo.
 */
export const HOTEL = {
  name: 'Lagoon View Hotel',
  shortName: 'Lagoon View',
  tagline: 'Victoria Island, Lagos',
  address: '14 Ozumba Mbadiwe Avenue, Victoria Island, Lagos',
  phone: '+234 802 555 0147',
  email: 'reservations@lagoonview.ng',
  website: 'lagoonview.ng',
  tin: '21874563-0001',
  rcNumber: 'RC 1482297',
  codePrefix: 'LV',
  serviceRate: 0.1,
  vatRate: 0.075,
  checkInTime: '14:00',
  checkOutTime: '12:00',
  /** Manager PIN used to approve voids and discounts in the demo. */
  managerPin: '2580',
  bank: { name: 'Zenith Bank', account: '1014 882 731', accountName: 'Lagoon View Hotels Ltd' },
}

export const ROOM_TYPES: RoomType[] = [
  {
    id: 'STD',
    name: 'Standard Room',
    rate: 35000,
    capacity: 2,
    bed: 'Queen bed',
    size: 22,
    view: 'City view',
    amenities: ['Air conditioning', 'Wi-Fi', '43" smart TV', 'Work desk', 'Rain shower'],
    description: 'A quiet, well-planned room for short business stays, with a queen bed and a proper desk.',
  },
  {
    id: 'DLX',
    name: 'Deluxe King',
    rate: 50000,
    capacity: 3,
    bed: 'King bed',
    size: 30,
    view: 'Partial lagoon view',
    amenities: ['Air conditioning', 'Wi-Fi', '50" smart TV', 'Minibar', 'Bathtub', 'Nespresso machine'],
    description: 'More space and a king bed, with partial views across the lagoon from the upper floors.',
  },
  {
    id: 'EXS',
    name: 'Executive Suite',
    rate: 85000,
    capacity: 3,
    bed: 'King bed + lounge',
    size: 48,
    view: 'Lagoon view',
    amenities: ['Separate lounge', 'Lagoon view', 'Minibar', 'Bathtub', 'Executive lounge access', 'Late check-out'],
    description: 'A separate lounge and bedroom on the top floor, with lounge access and guaranteed late check-out.',
  },
]

export const RATE_PLANS = {
  'Room only': { label: 'Room only', adjust: (rate: number) => rate },
  'Bed & breakfast': { label: 'Bed & breakfast', adjust: (rate: number) => rate + 8000 },
  Corporate: { label: 'Corporate', adjust: (rate: number) => Math.round(rate * 0.85) },
} as const

export const SOURCES: Source[] = ['Website', 'Phone', 'Walk-in', 'Booking.com', 'Expedia', 'Corporate']

export const USERS: StaffUser[] = [
  { id: 'u-gm', name: 'Adaeze Okafor', title: 'General Manager', role: 'manager', initials: 'AO' },
  { id: 'u-fd', name: 'Tunde Bakare', title: 'Front Office Agent', role: 'frontdesk', initials: 'TB' },
  { id: 'u-hk', name: 'Grace Eze', title: 'Room Attendant', role: 'housekeeping', initials: 'GE' },
  { id: 'u-pos', name: 'Musa Ibrahim', title: 'Restaurant Cashier', role: 'restaurant', initials: 'MI' },
]

/** Housekeeping staff who receive tasks but don't sign in to the demo. */
export const ATTENDANTS = [
  { id: 'u-hk', name: 'Grace Eze' },
  { id: 'hk-2', name: 'Blessing Udo' },
  { id: 'hk-3', name: 'Chinedu Obi' },
  { id: 'hk-sup', name: 'Joy Akpan (Supervisor)' },
]

export const SYSTEM_ACTORS: Record<string, string> = {
  system: 'System · Night audit',
  web: 'Booking engine',
}

export function actorName(id: string) {
  return (
    USERS.find((u) => u.id === id)?.name ??
    ATTENDANTS.find((a) => a.id === id)?.name ??
    SYSTEM_ACTORS[id] ??
    id
  )
}

export const ROLE_LABEL: Record<Role, string> = {
  manager: 'Management',
  frontdesk: 'Front office',
  housekeeping: 'Housekeeping',
  restaurant: 'Restaurant & bar',
}

export const ROLE_HOME: Record<Role, string> = {
  manager: '/dashboard',
  frontdesk: '/front-desk',
  housekeeping: '/housekeeping',
  restaurant: '/pos',
}

export const ROUTE_ACCESS: Record<string, Role[]> = {
  '/dashboard': ['manager', 'frontdesk'],
  '/reservations': ['manager', 'frontdesk'],
  '/front-desk': ['manager', 'frontdesk'],
  '/folio': ['manager', 'frontdesk'],
  '/housekeeping': ['manager', 'frontdesk', 'housekeeping'],
  '/pos': ['manager', 'restaurant'],
  '/reports': ['manager'],
  '/audit': ['manager'],
}

export const MENU: MenuItem[] = [
  { id: 'm1', name: 'Jollof rice & grilled chicken', category: 'Mains', station: 'Kitchen', price: 6500 },
  { id: 'm2', name: 'Fried rice & turkey', category: 'Mains', station: 'Kitchen', price: 7500 },
  { id: 'm3', name: 'Pounded yam & egusi', category: 'Mains', station: 'Kitchen', price: 8000 },
  { id: 'm4', name: 'Grilled croaker fish & chips', category: 'Mains', station: 'Kitchen', price: 14500 },
  { id: 'm5', name: 'Beef burger & fries', category: 'Mains', station: 'Kitchen', price: 8500 },
  { id: 'm6', name: 'Club sandwich', category: 'Light bites', station: 'Kitchen', price: 7000 },
  { id: 'm7', name: 'Peppered snail', category: 'Light bites', station: 'Kitchen', price: 6000 },
  { id: 'm8', name: 'Chicken suya platter', category: 'Light bites', station: 'Kitchen', price: 5500 },
  { id: 'm9', name: 'Goat meat pepper soup', category: 'Soups', station: 'Kitchen', price: 5000 },
  { id: 'm10', name: 'Catfish pepper soup', category: 'Soups', station: 'Kitchen', price: 6500 },
  { id: 'm11', name: 'Star lager 60cl', category: 'Beer', station: 'Bar', price: 1800 },
  { id: 'm12', name: 'Heineken 60cl', category: 'Beer', station: 'Bar', price: 2200 },
  { id: 'm13', name: 'Guinness stout', category: 'Beer', station: 'Bar', price: 2000 },
  { id: 'm14', name: 'Chapman', category: 'Soft drinks', station: 'Bar', price: 3000 },
  { id: 'm15', name: 'Coke / Fanta / Sprite', category: 'Soft drinks', station: 'Bar', price: 1000 },
  { id: 'm16', name: 'Bottled water 75cl', category: 'Soft drinks', station: 'Bar', price: 600 },
  { id: 'm17', name: 'Fresh orange juice', category: 'Soft drinks', station: 'Bar', price: 2500 },
  { id: 'm18', name: 'Hennessy VS (shot)', category: 'Spirits', station: 'Bar', price: 4500 },
  { id: 'm19', name: 'Glass of house red', category: 'Spirits', station: 'Bar', price: 4000 },
]

export const STOCK_ALERTS: StockAlert[] = [
  { item: 'Star lager 60cl', store: 'Bar store', onHand: 14, par: 48, unit: 'bottles' },
  { item: 'Guest toiletry kits', store: 'Housekeeping store', onHand: 22, par: 60, unit: 'kits' },
  { item: 'Basmati rice', store: 'Kitchen store', onHand: 2, par: 6, unit: 'bags (25kg)' },
]
