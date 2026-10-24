import { HOTEL, RATE_PLANS } from './config'
import type { Charge, Payment, RatePlan, RoomType } from './types'

export interface TaxBreakdown {
  net: number
  service: number
  vat: number
  total: number
}

/** Service charge is applied to the net amount, then VAT to net + service. */
export function withTaxes(net: number): TaxBreakdown {
  const service = Math.round(net * HOTEL.serviceRate)
  const vat = Math.round((net + service) * HOTEL.vatRate)
  return { net, service, vat, total: net + service + vat }
}

export function nightlyRate(type: RoomType, plan: RatePlan) {
  return RATE_PLANS[plan].adjust(type.rate)
}

export function stayQuote(rate: number, nights: number, extras = 0) {
  return { rate, nights, roomNet: rate * nights, extras, ...withTaxes(rate * nights + extras) }
}

export function folioTotals(charges: Charge[], payments: Payment[]) {
  const active = charges.filter((c) => !c.void)
  const taxes = withTaxes(active.reduce((sum, c) => sum + c.amount, 0))
  const paid = payments.reduce((sum, p) => sum + p.amount, 0)
  return { ...taxes, paid, balance: taxes.total - paid }
}
