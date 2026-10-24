'use client'

import { ArrowLeft, BedDouble, Check, Loader2, Lock, Maximize2, MessageCircle, Mountain, Users } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { RoomVisual } from '@/components/room-visual'
import { Button, Field, Input, Select, Textarea, cn } from '@/components/ui'
import { typeAvailability } from '@/lib/availability'
import { HOTEL, ROOM_TYPES } from '@/lib/config'
import { fmtDate, nightsBetween, shift } from '@/lib/dates'
import { naira, plural } from '@/lib/format'
import { useRateBook } from '@/lib/hooks'
import { withTaxes } from '@/lib/pricing'
import { promoValid, quoteStay } from '@/lib/rates'
import { useHotel } from '@/lib/store'
import type { RatePlan, Reservation, RoomType } from '@/lib/types'

type Step = 'rooms' | 'details' | 'pay' | 'done'

const EXTRAS = [
  { id: 'pickup', label: 'Airport pickup (MMIA)', desc: 'Driver meets you at arrivals with a name board', amount: 25000, dept: 'Transport' as const },
  { id: 'early', label: 'Early check-in from 10:00', desc: 'Room guaranteed ready on arrival', amount: 15000, dept: 'Other' as const },
]

interface Selection {
  type: RoomType
  plan: RatePlan
}

export default function BookingPage() {
  const today = useHotel((s) => s.businessDate)
  const rooms = useHotel((s) => s.rooms)
  const reservations = useHotel((s) => s.reservations)
  const createReservation = useHotel((s) => s.createReservation)

  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(shift(today, 2))
  const [adults, setAdults] = useState(2)
  const [step, setStep] = useState<Step>('rooms')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [extras, setExtras] = useState<string[]>([])
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', arrival: '15:00', requests: '', marketing: false })
  const [payMode, setPayMode] = useState<'full' | 'deposit'>('full')
  const [touched, setTouched] = useState(false)
  const [paying, setPaying] = useState(false)
  const [booking, setBooking] = useState<Reservation | null>(null)
  const [paidAmount, setPaidAmount] = useState(0)

  const nights = Math.max(nightsBetween(checkIn, checkOut), 0)
  const availability = useMemo(
    () => Object.fromEntries(ROOM_TYPES.map((t) => [t.id, nights ? typeAvailability(rooms, reservations, t.id, checkIn, checkOut) : 0])),
    [rooms, reservations, checkIn, checkOut, nights],
  )

  const book = useRateBook()
  const promos = useHotel((s) => s.promos)
  const [promoInput, setPromoInput] = useState('')
  const [promoCode, setPromoCode] = useState<string | null>(null)
  const [promoError, setPromoError] = useState('')
  const promo = promos.find((p) => p.code === promoCode)
  const stay = selection ? quoteStay(book, selection.type.id, checkIn, checkOut, selection.plan, promo) : null
  const rate = stay?.average ?? 0
  const ratesVary = !!stay && new Set(stay.nights.map((n) => n.planPrice)).size > 1

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase()
    const found = promos.find((p) => p.code === code)
    if (!promoValid(found, today)) {
      setPromoCode(null)
      setPromoError(found ? 'This code has expired.' : "We don't recognise that code.")
      return
    }
    setPromoCode(code)
    setPromoError('')
  }
  const extrasNet = EXTRAS.filter((e) => extras.includes(e.id)).reduce((s, e) => s + e.amount, 0)
  const totals = withTaxes((stay?.net ?? 0) + extrasNet)
  const depositAmount = withTaxes(rate + extrasNet).total
  const dueNow = payMode === 'full' ? totals.total : depositAmount

  const formErrors = {
    firstName: !form.firstName.trim(),
    lastName: !form.lastName.trim(),
    email: !/^\S+@\S+\.\S+$/.test(form.email),
    phone: form.phone.replace(/\D/g, '').length < 10,
  }
  const formValid = !Object.values(formErrors).some(Boolean)

  const pay = async () => {
    if (!selection) return
    setPaying(true)
    await new Promise((r) => setTimeout(r, 1600))
    const ref = `PSK-T${Math.floor(10_000_000 + Math.random() * 89_999_999)}`
    const result = createReservation({
      guest: { firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone, marketing: form.marketing },
      typeId: selection.type.id,
      roomId: null,
      checkIn,
      checkOut,
      adults,
      children: 0,
      source: 'Website',
      ratePlan: selection.plan,
      rate,
      promoCode: promo?.code,
      eta: form.arrival,
      notes: [form.requests, promo && `Promo ${promo.code} (−${promo.percent}%)`].filter(Boolean).join(' · ') || undefined,
      extras: EXTRAS.filter((e) => extras.includes(e.id)).map((e) => ({ dept: e.dept, desc: e.label, amount: e.amount })),
      payment: { method: 'Paystack', amount: dueNow, ref },
      createdBy: 'web',
    })
    setPaying(false)
    if (result.ok) {
      setBooking(result.reservation)
      setPaidAmount(dueNow)
      setStep('done')
      window.scrollTo({ top: 0 })
    }
  }

  return (
    <div className="min-h-screen flex-1 bg-[#faf8f4]">
      {/* Site header */}
      <header className="border-b border-[#e8e2d6] bg-[#faf8f4]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-sm bg-brand font-serif text-sm text-[#e9d9b8] italic">{HOTEL.codePrefix}</span>
            <span className="font-serif text-[19px] text-ink">{HOTEL.name}</span>
          </div>
          <nav className="hidden items-center gap-7 text-[13px] text-ink-2 md:flex">
            <span>Rooms & suites</span>
            <span>Dining</span>
            <span>Meetings</span>
            <span>Contact</span>
          </nav>
          <a href={`tel:${HOTEL.phone}`} className="hidden text-[13px] text-ink-2 sm:block">
            {HOTEL.phone}
          </a>
        </div>
      </header>

      {step !== 'done' && (
        <section className="relative overflow-hidden bg-brand text-[#f1eadc]">
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]" preserveAspectRatio="none" viewBox="0 0 800 200" aria-hidden>
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d={`M0 ${40 + i * 14} Q 200 ${30 + i * 14}, 400 ${40 + i * 14} T 800 ${40 + i * 14}`} fill="none" stroke="#f1eadc" strokeWidth="1" />
            ))}
          </svg>
          <div className="relative mx-auto max-w-6xl px-4 pt-10 pb-8 sm:px-6">
            <p className="text-xs tracking-[0.14em] text-[#f1eadc]/60 uppercase">{HOTEL.tagline}</p>
            <h1 className="mt-2 max-w-xl font-serif text-[32px] leading-tight sm:text-[40px]">Book direct and get our best rate, guaranteed.</h1>
            <div className="mt-7 grid gap-px overflow-hidden rounded-lg bg-[#e8e2d6] text-ink sm:grid-cols-[1fr_1fr_0.7fr_auto]">
              <label className="bg-white px-4 py-2.5">
                <span className="block text-[11px] font-medium tracking-wide text-ink-3 uppercase">Check-in</span>
                <input
                  type="date"
                  value={checkIn}
                  min={today}
                  onChange={(e) => {
                    setCheckIn(e.target.value)
                    if (checkOut <= e.target.value) setCheckOut(shift(e.target.value, 1))
                    setStep('rooms')
                  }}
                  className="w-full bg-transparent text-[15px] font-medium outline-none"
                />
              </label>
              <label className="bg-white px-4 py-2.5">
                <span className="block text-[11px] font-medium tracking-wide text-ink-3 uppercase">Check-out</span>
                <input
                  type="date"
                  value={checkOut}
                  min={shift(checkIn, 1)}
                  onChange={(e) => {
                    setCheckOut(e.target.value)
                    setStep('rooms')
                  }}
                  className="w-full bg-transparent text-[15px] font-medium outline-none"
                />
              </label>
              <label className="bg-white px-4 py-2.5">
                <span className="block text-[11px] font-medium tracking-wide text-ink-3 uppercase">Guests</span>
                <select value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="w-full bg-transparent text-[15px] font-medium outline-none">
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {plural(n, 'adult')}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center bg-white px-4 py-2.5 text-[13px] text-ink-2">
                {nights > 0 ? plural(nights, 'night') : 'Choose dates'}
              </div>
            </div>
          </div>
        </section>
      )}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {step === 'rooms' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="font-serif text-2xl">Choose your room</h2>
              <span className="text-[13px] text-ink-3">
                {fmtDate(checkIn, 'EEE d MMM')} – {fmtDate(checkOut, 'EEE d MMM')} · prices per night, before tax
              </span>
            </div>
            {ROOM_TYPES.map((type) => {
              const left = availability[type.id]
              const fits = type.capacity >= adults
              const rules = quoteStay(book, type.id, checkIn, checkOut, 'Room only')
              const restricted = rules.closed.length > 0 || rules.minStayViolated
              const soldOut = left < 1 || !fits || restricted
              return (
                <article key={type.id} className={cn('grid overflow-hidden rounded-xl border border-[#e8e2d6] bg-white md:grid-cols-[300px_minmax(0,1fr)]', soldOut && 'opacity-60')}>
                  <div className="aspect-[16/10] bg-sunken md:aspect-auto md:h-full">
                    <RoomVisual typeId={type.id} />
                  </div>
                  <div className="flex flex-col p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-serif text-[22px] leading-tight">{type.name}</h3>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
                          <span className="flex items-center gap-1"><Maximize2 className="size-3" /> {type.size} m²</span>
                          <span className="flex items-center gap-1"><BedDouble className="size-3" /> {type.bed}</span>
                          <span className="flex items-center gap-1"><Users className="size-3" /> Up to {type.capacity}</span>
                          <span className="flex items-center gap-1"><Mountain className="size-3" /> {type.view}</span>
                        </div>
                      </div>
                      {!soldOut && left <= 2 && <span className="rounded bg-[#fbeee9] px-2 py-0.5 text-xs font-medium text-[#a2391b]">Only {left} left</span>}
                      {left < 1 && <span className="rounded bg-sunken px-2 py-0.5 text-xs font-medium text-ink-3">Sold out for these dates</span>}
                      {left >= 1 && !fits && <span className="rounded bg-sunken px-2 py-0.5 text-xs font-medium text-ink-3">Not suitable for {adults} guests</span>}
                      {left >= 1 && fits && rules.closed.length > 0 && (
                        <span className="rounded bg-sunken px-2 py-0.5 text-xs font-medium text-ink-3">Not available on {rules.closed.map((d) => fmtDate(d)).join(', ')}</span>
                      )}
                      {left >= 1 && fits && !rules.closed.length && rules.minStayViolated && (
                        <span className="rounded bg-sunken px-2 py-0.5 text-xs font-medium text-ink-3">Minimum {rules.minStay} nights from {fmtDate(checkIn)}</span>
                      )}
                    </div>
                    <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">{type.description}</p>
                    <p className="mt-2 text-xs text-ink-3">{type.amenities.join(' · ')}</p>
                    <div className="mt-4 divide-y divide-[#efeae0] border-t border-[#efeae0]">
                      {(['Room only', 'Bed & breakfast'] as RatePlan[]).map((plan) => {
                        const q = quoteStay(book, type.id, checkIn, checkOut, plan)
                        const varies = new Set(q.nights.map((n) => n.planPrice)).size > 1
                        return (
                          <div key={plan} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                            <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                              <div className="text-[13.5px] font-medium">{plan}</div>
                              <div className="text-xs text-ink-3">
                                {plan === 'Bed & breakfast' ? 'Buffet breakfast for two · ' : ''}Free cancellation until 48 hours before arrival
                              </div>
                            </div>
                            <div className="ml-auto text-right sm:ml-0">
                              <div className="num text-[17px] font-semibold">
                                {varies && <span className="mr-1 text-[11.5px] font-normal text-ink-3">avg</span>}
                                {naira(q.average || book.baseRates[type.id])}
                              </div>
                              <div className="num text-[11.5px] text-ink-3">{nights ? `${naira(withTaxes(q.net).total)} total incl. taxes` : ''}</div>
                            </div>
                            <Button
                              variant="primary"
                              disabled={soldOut || !nights}
                              onClick={() => {
                                setSelection({ type, plan })
                                setStep('details')
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                              }}
                            >
                              Select
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {(step === 'details' || step === 'pay') && selection && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <button onClick={() => setStep(step === 'pay' ? 'details' : 'rooms')} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
                <ArrowLeft className="size-3.5" /> {step === 'pay' ? 'Back to your details' : 'Change room'}
              </button>

              {step === 'details' ? (
                <div className="space-y-6">
                  <section className="rounded-xl border border-[#e8e2d6] bg-white p-5">
                    <h2 className="font-serif text-xl">Your details</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <Field label="First name" error={touched && formErrors.firstName ? 'Required' : undefined}>
                        <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoComplete="given-name" />
                      </Field>
                      <Field label="Last name" error={touched && formErrors.lastName ? 'Required' : undefined}>
                        <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} autoComplete="family-name" />
                      </Field>
                      <Field label="Email" error={touched && formErrors.email ? 'Enter a valid email' : undefined} hint="Your confirmation is sent here">
                        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
                      </Field>
                      <Field label="Phone (WhatsApp)" error={touched && formErrors.phone ? 'Enter a valid phone number' : undefined} hint="For arrival updates on WhatsApp">
                        <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+234 …" autoComplete="tel" />
                      </Field>
                      <Field label="Estimated arrival">
                        <Select value={form.arrival} onChange={(e) => setForm({ ...form, arrival: e.target.value })}>
                          {['12:00', '14:00', '15:00', '17:00', '19:00', '21:00', '23:00'].map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Special requests" className="sm:col-span-2">
                        <Textarea rows={2} value={form.requests} onChange={(e) => setForm({ ...form, requests: e.target.value })} placeholder="e.g. high floor, cot for a baby, celebrating an anniversary" />
                      </Field>
                    </div>
                  </section>

                  <section className="rounded-xl border border-[#e8e2d6] bg-white p-5">
                    <h2 className="font-serif text-xl">Add to your stay</h2>
                    <div className="mt-3 divide-y divide-[#efeae0]">
                      {EXTRAS.map((x) => (
                        <label key={x.id} className="flex cursor-pointer items-center gap-3 py-3">
                          <input
                            type="checkbox"
                            checked={extras.includes(x.id)}
                            onChange={(e) => setExtras(e.target.checked ? [...extras, x.id] : extras.filter((id) => id !== x.id))}
                            className="size-4 accent-brand"
                          />
                          <span className="flex-1">
                            <span className="block text-[13.5px] font-medium">{x.label}</span>
                            <span className="text-xs text-ink-3">{x.desc}</span>
                          </span>
                          <span className="num text-[13.5px]">{naira(x.amount)}</span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-[#e8e2d6] bg-white p-5">
                    <h2 className="font-serif text-xl">Promo code</h2>
                    <div className="mt-3 flex max-w-sm gap-2">
                      <Input value={promoInput} onChange={(e) => setPromoInput(e.target.value)} placeholder="e.g. DIRECT10" className="uppercase" />
                      <Button onClick={applyPromo} disabled={!promoInput.trim()}>
                        Apply
                      </Button>
                    </div>
                    {promoError && <p className="mt-1.5 text-xs text-danger">{promoError}</p>}
                    {promo && <p className="mt-1.5 text-xs text-ok">{promo.code} applied: {promo.percent}% off the room rate.</p>}
                  </section>

                  <label className="flex items-start gap-2 text-[12.5px] text-ink-2">
                    <input type="checkbox" checked={form.marketing} onChange={(e) => setForm({ ...form, marketing: e.target.checked })} className="mt-0.5 accent-brand" />
                    Send me occasional offers from {HOTEL.name}. You can unsubscribe at any time. We handle your data in line with the NDPA.
                  </label>

                  <Button
                    size="lg"
                    variant="primary"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setTouched(true)
                      if (formValid) {
                        setStep('pay')
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }
                    }}
                  >
                    Continue to payment
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <section className="rounded-xl border border-[#e8e2d6] bg-white p-5">
                    <h2 className="font-serif text-xl">How would you like to pay?</h2>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {(
                        [
                          ['full', 'Pay in full now', naira(totals.total), 'Nothing to pay at the hotel'],
                          ['deposit', 'Pay first night now', naira(depositAmount), `Balance of ${naira(totals.total - depositAmount)} at check-in`],
                        ] as const
                      ).map(([mode, label, amount, sub]) => (
                        <button
                          key={mode}
                          onClick={() => setPayMode(mode)}
                          className={cn('rounded-lg border p-3.5 text-left', payMode === mode ? 'border-brand bg-brand-soft ring-1 ring-brand' : 'border-line hover:border-line-strong')}
                        >
                          <div className="flex items-center justify-between text-[13.5px] font-medium">
                            {label}
                            {payMode === mode && <Check className="size-4 text-brand" />}
                          </div>
                          <div className="num mt-1 text-lg font-semibold">{amount}</div>
                          <div className="text-xs text-ink-3">{sub}</div>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-xl border border-[#e8e2d6] bg-white">
                    <div className="flex items-center justify-between border-b border-line bg-sunken px-5 py-3">
                      <span className="flex items-center gap-2 text-[13px] font-medium">
                        <Lock className="size-3.5 text-ok" /> Secure card payment · Paystack
                      </span>
                      <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[11px] font-medium text-warn">Test mode</span>
                    </div>
                    <div className="space-y-3 p-5">
                      <Field label="Card number">
                        <Input defaultValue="4084 0840 8408 4081" className="num font-mono" />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Expiry">
                          <Input defaultValue="12 / 29" className="font-mono" />
                        </Field>
                        <Field label="CVV">
                          <Input defaultValue="408" className="font-mono" />
                        </Field>
                      </div>
                      <Button size="lg" variant="primary" className="w-full" disabled={paying} onClick={pay}>
                        {paying ? (
                          <>
                            <Loader2 className="size-4 animate-spin" /> Processing payment…
                          </>
                        ) : (
                          `Pay ${naira(dueNow)}`
                        )}
                      </Button>
                      <p className="text-center text-xs text-ink-3">
                        Prototype: no money moves. The live build connects to Paystack or Flutterwave, with Stripe for international cards.
                      </p>
                    </div>
                  </section>
                </div>
              )}
            </div>

            <aside className="h-fit overflow-hidden rounded-xl border border-[#e8e2d6] bg-white lg:sticky lg:top-6">
              <div className="aspect-[16/9]">
                <RoomVisual typeId={selection.type.id} />
              </div>
              <div className="p-5">
                <h3 className="font-serif text-lg">{selection.type.name}</h3>
                <p className="text-xs text-ink-3">
                  {selection.plan} · {plural(adults, 'adult')}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 border-y border-line py-3 text-[13px]">
                  <div>
                    <div className="text-xs text-ink-3">Check-in</div>
                    <div className="font-medium">{fmtDate(checkIn, 'EEE d MMM')}</div>
                    <div className="text-xs text-ink-3">from {HOTEL.checkInTime}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-3">Check-out</div>
                    <div className="font-medium">{fmtDate(checkOut, 'EEE d MMM')}</div>
                    <div className="text-xs text-ink-3">by {HOTEL.checkOutTime}</div>
                  </div>
                </div>
                <dl className="mt-3 space-y-1.5 text-[13px]">
                  <div className="flex justify-between">
                    <dt className="text-ink-2">
                      {ratesVary ? `Room, ${plural(nights, 'night')}` : `${naira(stay?.nights[0]?.planPrice ?? 0)} × ${plural(nights, 'night')}`}
                    </dt>
                    <dd className="num">{naira(stay?.gross ?? 0)}</dd>
                  </div>
                  {ratesVary && (
                    <ul className="space-y-0.5 border-l-2 border-line pl-2.5 text-xs text-ink-3">
                      {stay!.nights.map((n) => (
                        <li key={n.date} className="flex justify-between">
                          <span>{fmtDate(n.date, 'EEE d MMM')}</span>
                          <span className="num">{naira(n.planPrice)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {promo && stay && (
                    <div className="flex justify-between text-ok">
                      <dt>
                        {promo.code} · {promo.percent}% off
                      </dt>
                      <dd className="num">{naira(-stay.discount)}</dd>
                    </div>
                  )}
                  {EXTRAS.filter((e) => extras.includes(e.id)).map((e) => (
                    <div key={e.id} className="flex justify-between">
                      <dt className="text-ink-2">{e.label}</dt>
                      <dd className="num">{naira(e.amount)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between">
                    <dt className="text-ink-2">Service charge 10%</dt>
                    <dd className="num">{naira(totals.service)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-2">VAT 7.5%</dt>
                    <dd className="num">{naira(totals.vat)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line pt-2 text-[15px] font-semibold">
                    <dt>Total</dt>
                    <dd className="num">{naira(totals.total)}</dd>
                  </div>
                </dl>
              </div>
            </aside>
          </div>
        )}

        {step === 'done' && booking && selection && (
          <div className="mx-auto max-w-2xl">
            <div className="rounded-xl border border-[#e8e2d6] bg-white p-6 sm:p-8">
              <span className="flex size-10 items-center justify-center rounded-full bg-ok-soft text-ok">
                <Check className="size-5" strokeWidth={2.5} />
              </span>
              <h1 className="mt-4 font-serif text-[28px] leading-tight">You&apos;re booked, {form.firstName}.</h1>
              <p className="mt-1.5 text-[14px] text-ink-2">
                Booking reference <span className="font-semibold text-ink">{booking.code}</span>. We&apos;ve sent the confirmation to {form.email} and to WhatsApp.
              </p>

              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line py-5 text-[13.5px] sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-ink-3">Room</dt>
                  <dd className="font-medium">{selection.type.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-3">Dates</dt>
                  <dd className="font-medium">
                    {fmtDate(checkIn, 'd MMM')} – {fmtDate(checkOut, 'd MMM')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-3">Guests</dt>
                  <dd className="font-medium">{plural(adults, 'adult')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-3">Paid now</dt>
                  <dd className="num font-medium">{naira(paidAmount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-3">Due at hotel</dt>
                  <dd className="num font-medium">{naira(totals.total - paidAmount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-3">Arrival</dt>
                  <dd className="font-medium">from {form.arrival}</dd>
                </div>
              </dl>

              <div className="mt-6">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-3">
                  <MessageCircle className="size-3.5" /> WhatsApp message sent to {form.phone}
                </div>
                <div className="max-w-sm rounded-lg rounded-tl-none bg-[#e7f4e4] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#1f2a1d]">
                  Hello {form.firstName}, your stay at {HOTEL.name} is confirmed ✓
                  <br />
                  Ref: {booking.code}
                  <br />
                  {selection.type.name}, {fmtDate(checkIn, 'd MMM')} – {fmtDate(checkOut, 'd MMM')}
                  <br />
                  Check-in from {HOTEL.checkInTime}. Reply to this chat for anything you need before you arrive.
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setStep('rooms')
                    setSelection(null)
                    setBooking(null)
                    setExtras([])
                    setTouched(false)
                    setForm({ firstName: '', lastName: '', email: '', phone: '', arrival: '15:00', requests: '', marketing: false })
                  }}
                >
                  Make another booking
                </Button>
                <Link href="/reservations">
                  <Button variant="subtle">See it in the staff calendar →</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[#e8e2d6] py-6 text-center text-xs text-ink-3">
        {HOTEL.address} · {HOTEL.email}
        <div className="mt-1">Best rate guaranteed when you book direct · Payments secured by Paystack</div>
      </footer>
    </div>
  )
}
