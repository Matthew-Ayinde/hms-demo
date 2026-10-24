import { RATE_PLANS } from './config'
import { dateRange, isWeekend, nightsBetween } from './dates'
import type { DayRule, Promo, RatePlan, RoomTypeId, Season } from './types'

export interface RateBook {
  baseRates: Record<RoomTypeId, number>
  weekendUplift: number
  seasons: Season[]
  dayRules: Record<string, DayRule>
}

export const ruleKey = (typeId: RoomTypeId, date: string) => `${typeId}|${date}`

export const seasonFor = (seasons: Season[], date: string) => seasons.find((s) => s.start <= date && s.end >= date)

const roundTo500 = (n: number) => Math.round(n / 500) * 500

/** Room-only price for one night, with how it was derived. */
export function priceFor(book: RateBook, typeId: RoomTypeId, date: string) {
  const rule = book.dayRules[ruleKey(typeId, date)]
  const season = seasonFor(book.seasons, date)
  const weekend = isWeekend(date)
  const derived = roundTo500(book.baseRates[typeId] * (1 + (weekend ? book.weekendUplift : 0)) * (1 + (season?.adjust ?? 0)))
  return {
    price: rule?.price ?? derived,
    derived,
    override: rule?.price !== undefined,
    season,
    weekend,
    stopSell: !!rule?.stopSell,
    minStay: rule?.minStay ?? 1,
  }
}

/** Prices every night of a stay for a rate plan, and checks restrictions. */
export function quoteStay(book: RateBook, typeId: RoomTypeId, checkIn: string, checkOut: string, plan: RatePlan, promo?: Promo) {
  const count = Math.max(nightsBetween(checkIn, checkOut), 0)
  const nights = dateRange(checkIn, count).map((date) => {
    const p = priceFor(book, typeId, date)
    return { date, ...p, planPrice: RATE_PLANS[plan].adjust(p.price) }
  })
  const gross = nights.reduce((s, n) => s + n.planPrice, 0)
  const discount = promo ? Math.round((gross * promo.percent) / 100) : 0
  const net = gross - discount
  const closed = nights.filter((n) => n.stopSell).map((n) => n.date)
  const minStay = nights[0]?.minStay ?? 1
  return {
    nights,
    count,
    gross,
    discount,
    net,
    /** Average nightly rate stored on the reservation. */
    average: count ? Math.round(net / count) : 0,
    closed,
    minStay,
    minStayViolated: count > 0 && count < minStay,
  }
}

export function promoValid(promo: Promo | undefined, today: string) {
  return !!promo && promo.active && promo.validUntil >= today
}
