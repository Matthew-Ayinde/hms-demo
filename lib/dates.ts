import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'

/** Dates are stored as YYYY-MM-DD strings so they compare lexicographically. */
export const todayISO = () => format(new Date(), 'yyyy-MM-dd')

export const shift = (iso: string, days: number) => format(addDays(parseISO(iso), days), 'yyyy-MM-dd')

export const nightsBetween = (checkIn: string, checkOut: string) =>
  differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn))

export const dateRange = (start: string, count: number) =>
  Array.from({ length: count }, (_, i) => shift(start, i))

export const fmtDate = (iso: string, pattern = 'd MMM') => format(parseISO(iso), pattern)

export const fmtTime = (isoDateTime: string) => format(parseISO(isoDateTime), 'HH:mm')

export const fmtDateTime = (isoDateTime: string) => format(parseISO(isoDateTime), 'd MMM, HH:mm')

export const isWeekend = (iso: string) => {
  const day = parseISO(iso).getDay()
  return day === 5 || day === 6
}
