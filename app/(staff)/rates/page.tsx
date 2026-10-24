'use client'

import { ChevronLeft, ChevronRight, Lock, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Modal } from '@/components/modal'
import { Badge, Button, EmptyState, Field, Input, PageHeader, Panel, Select, Table, Tabs, Td, Th, cn } from '@/components/ui'
import { typeAvailability } from '@/lib/availability'
import { RATE_PLANS, ROOM_TYPES } from '@/lib/config'
import { dateRange, fmtDate, shift } from '@/lib/dates'
import { naira, plural } from '@/lib/format'
import { useRateBook } from '@/lib/hooks'
import { priceFor } from '@/lib/rates'
import { toast, useHotel } from '@/lib/store'
import type { RatePlan, RoomTypeId } from '@/lib/types'

type Tab = 'calendar' | 'types' | 'seasons' | 'promos'
const DAYS = 14

export default function RatesPage() {
  const [tab, setTab] = useState<Tab>('calendar')
  return (
    <div>
      <PageHeader
        title="Rooms & rates"
        description="Prices, restrictions and offers. Changes apply straight away to the booking website and to new bookings at the front desk."
      />
      <Panel>
        <Tabs
          value={tab}
          onChange={setTab}
          className="px-2"
          items={[
            { value: 'calendar', label: 'Rate calendar' },
            { value: 'types', label: 'Room types' },
            { value: 'seasons', label: 'Seasons & weekends' },
            { value: 'promos', label: 'Promo codes' },
          ]}
        />
        {tab === 'calendar' && <RateCalendar />}
        {tab === 'types' && <RoomTypes />}
        {tab === 'seasons' && <Seasons />}
        {tab === 'promos' && <Promos />}
      </Panel>
    </div>
  )
}

/* ---------- Rate calendar ---------- */

function RateCalendar() {
  const today = useHotel((s) => s.businessDate)
  const rooms = useHotel((s) => s.rooms)
  const reservations = useHotel((s) => s.reservations)
  const book = useRateBook()
  const [start, setStart] = useState(today)
  const [editing, setEditing] = useState<{ typeId: RoomTypeId; date: string } | null>(null)
  const [bulk, setBulk] = useState(false)
  const days = useMemo(() => dateRange(start, DAYS), [start])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center rounded-md border border-line-strong bg-surface">
          <button className="flex size-8 items-center justify-center text-ink-2 hover:text-ink disabled:opacity-40" disabled={start <= today} onClick={() => setStart(shift(start, -7))} aria-label="Previous week">
            <ChevronLeft className="size-4" />
          </button>
          <button className="h-8 border-x border-line px-3 text-[13px] font-medium" onClick={() => setStart(today)}>
            Today
          </button>
          <button className="flex size-8 items-center justify-center text-ink-2 hover:text-ink" onClick={() => setStart(shift(start, 7))} aria-label="Next week">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <span className="text-[13px] font-medium">
          {fmtDate(start, 'd MMM')} – {fmtDate(days[DAYS - 1], 'd MMM yyyy')}
        </span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brass-soft ring-1 ring-brass/40" /> Season</span>
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-brass" /> Special rate</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-danger-soft ring-1 ring-danger/30" /> Closed to new bookings</span>
        </div>
        <Button className="ml-auto" onClick={() => setBulk(true)}>
          <SlidersHorizontal className="size-3.5" /> Bulk update
        </Button>
      </div>

      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-44 border-b border-line bg-sunken px-4 py-2 text-left text-[11.5px] font-medium tracking-wide text-ink-3 uppercase">Room type</th>
              {days.map((d) => {
                const season = book.seasons.find((s) => s.start <= d && s.end >= d)
                return (
                  <th key={d} className={cn('border-b border-l border-line px-1 py-1.5 text-center font-normal', d === today ? 'bg-brand-soft' : 'bg-sunken')}>
                    <div className={cn('text-[11px] uppercase', d === today ? 'font-semibold text-brand' : 'text-ink-3')}>{fmtDate(d, 'EEE')}</div>
                    <div className="text-[13px] font-semibold text-ink">{fmtDate(d, 'd MMM')}</div>
                    <div className="h-3.5 truncate text-[10px] text-brass" title={season?.name}>
                      {season?.name ?? ''}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ROOM_TYPES.map((type) => (
              <tr key={type.id}>
                <td className="sticky left-0 z-10 border-b border-line bg-surface px-4 py-2 align-top">
                  <div className="font-medium">{type.name}</div>
                  <div className="text-xs text-ink-3">Base {naira(book.baseRates[type.id])}</div>
                </td>
                {days.map((d) => {
                  const p = priceFor(book, type.id, d)
                  const left = typeAvailability(rooms, reservations, type.id, d, shift(d, 1))
                  return (
                    <td key={d} className="border-b border-l border-line p-0">
                      <button
                        onClick={() => setEditing({ typeId: type.id, date: d })}
                        className={cn(
                          'relative block w-full px-1.5 py-2 text-center transition-colors hover:bg-brand-soft/70',
                          p.stopSell ? 'bg-danger-soft/70' : p.season ? 'bg-brass-soft/60' : p.weekend && 'bg-sunken',
                        )}
                        title={`${type.name} · ${fmtDate(d, 'EEE d MMM')}: ${naira(p.price)}${p.override ? ' (special rate)' : ''}${p.stopSell ? ' · closed' : ''}${p.minStay > 1 ? ` · min ${p.minStay} nights` : ''}`}
                      >
                        {p.override && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-brass" />}
                        <div className={cn('num text-[13px] font-semibold', p.stopSell && 'text-ink-3 line-through')}>{(p.price / 1000).toFixed(p.price % 1000 ? 1 : 0)}k</div>
                        <div className={cn('num text-[10.5px]', left <= 1 ? 'font-medium text-danger' : 'text-ink-3')}>{left} left</div>
                        <div className="h-3.5 text-[10px] font-medium">
                          {p.stopSell ? <span className="text-danger">Closed</span> : p.minStay > 1 ? <span className="text-warn">Min {p.minStay}n</span> : ''}
                        </div>
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-3 text-xs text-ink-3">
        Prices are room-only, per night, before service charge and VAT. Bed & breakfast adds {naira(8000)} and the corporate rate takes 15% off. Click a day to change it.
      </p>

      {editing && <DayEditor key={`${editing.typeId}${editing.date}`} typeId={editing.typeId} date={editing.date} onClose={() => setEditing(null)} />}
      {bulk && <BulkEditor onClose={() => setBulk(false)} />}
    </div>
  )
}

function DayEditor({ typeId, date, onClose }: { typeId: RoomTypeId; date: string; onClose: () => void }) {
  const book = useRateBook()
  const setDayRules = useHotel((s) => s.setDayRules)
  const p = priceFor(book, typeId, date)
  const type = ROOM_TYPES.find((t) => t.id === typeId)!
  const [price, setPrice] = useState(String(p.price))
  const [stopSell, setStopSell] = useState(p.stopSell)
  const [minStay, setMinStay] = useState(p.minStay)
  const value = Number(price.replace(/[^\d]/g, '')) || 0

  const save = () => {
    setDayRules([typeId], [date], { price: value && value !== p.derived ? value : null, stopSell, minStay })
    toast.success('Rate saved', `${type.name} · ${fmtDate(date, 'EEE d MMM')} · ${naira(value || p.derived)}${stopSell ? ' · closed' : ''}`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`${type.name} · ${fmtDate(date, 'EEEE d MMM')}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!value}>
            Save
          </Button>
        </>
      }
    >
      <div className="mb-4 space-y-1 rounded-md bg-sunken px-3 py-2.5 text-[12.5px] text-ink-2">
        <div className="flex justify-between">
          <span>Base rate</span>
          <span className="num">{naira(book.baseRates[typeId])}</span>
        </div>
        {p.weekend && (
          <div className="flex justify-between">
            <span>Weekend uplift</span>
            <span className="num">+{Math.round(book.weekendUplift * 100)}%</span>
          </div>
        )}
        {p.season && (
          <div className="flex justify-between">
            <span>{p.season.name}</span>
            <span className="num">
              {p.season.adjust > 0 ? '+' : ''}
              {Math.round(p.season.adjust * 100)}%
            </span>
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-1 font-medium text-ink">
          <span>Standard price for this day</span>
          <span className="num">{naira(p.derived)}</span>
        </div>
      </div>
      <div className="space-y-3">
        <Field label="Price for this day (₦, room only)" hint={value !== p.derived ? 'Special rate. It overrides the standard price.' : 'Matches the standard price.'}>
          <div className="flex gap-2">
            <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" autoFocus />
            <Button className="shrink-0" onClick={() => setPrice(String(p.derived))}>
              Use standard
            </Button>
          </div>
        </Field>
        <Field label="Minimum stay for arrivals on this day">
          <Select value={minStay} onChange={(e) => setMinStay(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 7].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? 'No minimum' : `${n} nights`}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-start gap-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={stopSell} onChange={(e) => setStopSell(e.target.checked)} className="mt-0.5 accent-brand" />
          <span>
            Close to new bookings (stop-sell)
            <span className="block text-xs text-ink-3">Hides the room type online for this night. Front desk can still book it.</span>
          </span>
        </label>
      </div>
    </Modal>
  )
}

type BulkAction = 'price' | 'adjust' | 'close' | 'open' | 'minstay' | 'reset'

function BulkEditor({ onClose }: { onClose: () => void }) {
  const today = useHotel((s) => s.businessDate)
  const setDayRules = useHotel((s) => s.setDayRules)
  const [types, setTypes] = useState<RoomTypeId[]>(['STD', 'DLX', 'EXS'])
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(shift(today, 6))
  const [action, setAction] = useState<BulkAction>('adjust')
  const [amount, setAmount] = useState('10')
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])

  const span = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1)
  const dates = dateRange(from, span).filter((d) => weekdays.includes(new Date(`${d}T12:00:00`).getDay()))
  const n = Number(amount.replace(/[^\d.-]/g, '')) || 0
  const valid = types.length > 0 && dates.length > 0 && (!['price', 'adjust', 'minstay'].includes(action) || n !== 0)

  const apply = () => {
    const rule =
      action === 'price' ? { price: n } : action === 'adjust' ? { adjustPct: n } : action === 'close' ? { stopSell: true } : action === 'open' ? { stopSell: false } : action === 'minstay' ? { minStay: n } : { price: null, stopSell: false, minStay: 1 }
    setDayRules(types, dates, rule)
    toast.success('Rates updated', `${plural(dates.length, 'day')} × ${plural(types.length, 'room type')}`)
    onClose()
  }

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <Modal
      open
      onClose={onClose}
      title="Bulk update"
      description="Change many days and room types at once, for example raising weekend prices for a conference."
      footer={
        <>
          <span className="mr-auto text-xs text-ink-3">{plural(dates.length * types.length, 'day-rate')} will change</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={apply} disabled={!valid}>
            Apply
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Room types</span>
          <div className="flex flex-wrap gap-3">
            {ROOM_TYPES.map((t) => (
              <label key={t.id} className="flex items-center gap-1.5 text-[13px]">
                <input type="checkbox" checked={types.includes(t.id)} onChange={(e) => setTypes(e.target.checked ? [...types, t.id] : types.filter((x) => x !== t.id))} className="accent-brand" />
                {t.name}
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <Input type="date" value={from} min={today} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Days of the week</span>
          <div className="flex flex-wrap gap-1">
            {DOW.map((d, i) => (
              <button
                key={d}
                onClick={() => setWeekdays(weekdays.includes(i) ? weekdays.filter((x) => x !== i) : [...weekdays, i])}
                className={cn('h-7 w-11 rounded border text-xs font-medium', weekdays.includes(i) ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink-3')}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Change">
            <Select value={action} onChange={(e) => setAction(e.target.value as BulkAction)}>
              <option value="adjust">Adjust price by %</option>
              <option value="price">Set a fixed price</option>
              <option value="minstay">Set minimum stay</option>
              <option value="close">Close to new bookings</option>
              <option value="open">Reopen for sale</option>
              <option value="reset">Reset to standard</option>
            </Select>
          </Field>
          {['price', 'adjust', 'minstay'].includes(action) && (
            <Field label={action === 'price' ? 'Price (₦)' : action === 'adjust' ? 'Percent (use − to lower)' : 'Nights'}>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
            </Field>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ---------- Room types ---------- */

function RoomTypes() {
  const rooms = useHotel((s) => s.rooms)
  const baseRates = useHotel((s) => s.baseRates)
  const setBaseRate = useHotel((s) => s.setBaseRate)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-3">
      {ROOM_TYPES.map((t) => {
        const typeRooms = rooms.filter((r) => r.typeId === t.id)
        const draft = drafts[t.id] ?? String(baseRates[t.id])
        const value = Number(draft.replace(/[^\d]/g, '')) || 0
        return (
          <div key={t.id} className="rounded-lg border border-line p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">{t.name}</h3>
              <span className="text-xs text-ink-3">{t.id}</span>
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {t.bed} · {t.size} m² · up to {t.capacity} guests · {t.view}
            </p>
            <div className="mt-4 flex items-end gap-2">
              <Field label="Base rate per night (₦)" className="flex-1">
                <Input value={draft} onChange={(e) => setDrafts({ ...drafts, [t.id]: e.target.value })} inputMode="numeric" />
              </Field>
              <Button
                variant="primary"
                disabled={!value || value === baseRates[t.id]}
                onClick={() => {
                  setBaseRate(t.id, value)
                  toast.success(`${t.name} base rate updated`, `Now ${naira(value)}. Days with a special rate keep their price.`)
                }}
              >
                Save
              </Button>
            </div>
            <dl className="mt-4 space-y-1 border-t border-line pt-3 text-[12.5px]">
              {(Object.keys(RATE_PLANS) as RatePlan[]).map((plan) => (
                <div key={plan} className="flex justify-between">
                  <dt className="text-ink-2">{plan}</dt>
                  <dd className="num">{naira(RATE_PLANS[plan].adjust(baseRates[t.id]))}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{plural(typeRooms.length, 'room')}</div>
              <div className="flex flex-wrap gap-1">
                {typeRooms.map((r) => (
                  <span key={r.id} className={cn('rounded border px-1.5 py-0.5 text-xs', r.hk === 'ooo' ? 'border-danger/30 text-danger' : 'border-line text-ink-2')} title={r.hk === 'ooo' ? r.oooReason : undefined}>
                    {r.number}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Seasons ---------- */

function Seasons() {
  const today = useHotel((s) => s.businessDate)
  const seasons = useHotel((s) => s.seasons)
  const weekendUplift = useHotel((s) => s.weekendUplift)
  const setWeekendUplift = useHotel((s) => s.setWeekendUplift)
  const addSeason = useHotel((s) => s.addSeason)
  const removeSeason = useHotel((s) => s.removeSeason)
  const [uplift, setUplift] = useState(String(Math.round(weekendUplift * 100)))
  const [form, setForm] = useState({ name: '', start: shift(today, 14), end: shift(today, 20), adjust: '20' })
  const formValid = form.name.trim() && form.end >= form.start && Number(form.adjust)

  return (
    <div className="grid gap-5 p-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="h-fit rounded-lg border border-line p-4">
        <h3 className="text-[13px] font-semibold">Weekend pricing</h3>
        <p className="mt-1 text-xs text-ink-3">Added to every Friday and Saturday night, on top of the base rate.</p>
        <div className="mt-3 flex items-end gap-2">
          <Field label="Uplift (%)" className="flex-1">
            <Input value={uplift} onChange={(e) => setUplift(e.target.value)} inputMode="numeric" />
          </Field>
          <Button
            variant="primary"
            disabled={Number(uplift) / 100 === weekendUplift}
            onClick={() => {
              setWeekendUplift((Number(uplift) || 0) / 100)
              toast.success('Weekend pricing saved')
            }}
          >
            Save
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-line">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-[13px] font-semibold">Seasons</h3>
          <p className="text-xs text-ink-3">Date ranges that raise or lower every price, for festive periods, conferences or quiet months.</p>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Season</Th>
              <Th>Dates</Th>
              <Th align="right">Adjustment</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={s.id}>
                <Td className="font-medium">
                  {s.name} {s.end < today && <Badge>Ended</Badge>}
                </Td>
                <Td className="text-ink-2">
                  {fmtDate(s.start, 'd MMM yyyy')} – {fmtDate(s.end, 'd MMM yyyy')}
                </Td>
                <Td align="right" className={s.adjust > 0 ? 'text-ok' : 'text-danger'}>
                  {s.adjust > 0 ? '+' : ''}
                  {Math.round(s.adjust * 100)}%
                </Td>
                <Td align="right">
                  <button
                    onClick={() => {
                      removeSeason(s.id)
                      toast.success(`${s.name} removed`)
                    }}
                    className="rounded p-1 text-ink-3 hover:bg-danger-soft hover:text-danger"
                    aria-label={`Remove ${s.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </Td>
              </tr>
            ))}
            {!seasons.length && (
              <tr>
                <Td colSpan={4}>
                  <EmptyState title="No seasons yet" />
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
        <div className="grid items-end gap-2 border-t border-line bg-sunken p-4 sm:grid-cols-[minmax(0,1.4fr)_1fr_1fr_90px_auto]">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Christmas & New Year" />
          </Field>
          <Field label="Start">
            <Input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          </Field>
          <Field label="End">
            <Input type="date" value={form.end} min={form.start} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </Field>
          <Field label="± %">
            <Input value={form.adjust} onChange={(e) => setForm({ ...form, adjust: e.target.value })} />
          </Field>
          <Button
            variant="primary"
            disabled={!formValid}
            onClick={() => {
              addSeason({ name: form.name.trim(), start: form.start, end: form.end, adjust: Number(form.adjust) / 100 })
              toast.success(`${form.name.trim()} added`, 'Prices on the rate calendar and booking website updated.')
              setForm({ ...form, name: '' })
            }}
          >
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Promo codes ---------- */

function Promos() {
  const today = useHotel((s) => s.businessDate)
  const promos = useHotel((s) => s.promos)
  const addPromo = useHotel((s) => s.addPromo)
  const togglePromo = useHotel((s) => s.togglePromo)
  const [form, setForm] = useState({ code: '', percent: '10', validUntil: shift(today, 30), note: '' })
  const [error, setError] = useState('')

  return (
    <div>
      <Table>
        <thead>
          <tr>
            <Th>Code</Th>
            <Th>Discount</Th>
            <Th>Valid until</Th>
            <Th align="right">Times used</Th>
            <Th>Note</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {promos.map((p) => {
            const expired = p.validUntil < today
            return (
              <tr key={p.code}>
                <Td className="font-mono text-[12.5px] font-semibold">{p.code}</Td>
                <Td>{p.percent}% off room rate</Td>
                <Td className="text-ink-2">{fmtDate(p.validUntil, 'd MMM yyyy')}</Td>
                <Td align="right">{p.uses}</Td>
                <Td className="text-ink-2">{p.note ?? '—'}</Td>
                <Td>{expired ? <Badge>Expired</Badge> : p.active ? <Badge tone="ok" dot>Active</Badge> : <Badge tone="warn" dot>Paused</Badge>}</Td>
                <Td align="right">
                  {!expired && (
                    <Button size="sm" variant="ghost" onClick={() => togglePromo(p.code)}>
                      {p.active ? 'Pause' : 'Activate'}
                    </Button>
                  )}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </Table>
      <div className="grid items-end gap-2 bg-sunken p-4 sm:grid-cols-[1fr_90px_1fr_minmax(0,1.4fr)_auto]">
        <Field label="New code" error={error || undefined}>
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. WEEKEND15" className="font-mono uppercase" />
        </Field>
        <Field label="% off">
          <Input value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} inputMode="numeric" />
        </Field>
        <Field label="Valid until">
          <Input type="date" value={form.validUntil} min={today} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
        </Field>
        <Field label="Note">
          <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Who it's for" />
        </Field>
        <Button
          variant="primary"
          disabled={!form.code || !(Number(form.percent) > 0 && Number(form.percent) <= 50)}
          onClick={() => {
            const result = addPromo({ code: form.code, percent: Number(form.percent), validUntil: form.validUntil, active: true, note: form.note || undefined })
            if (!result.ok) return setError(result.error)
            setError('')
            toast.success(`${form.code} created`, 'Guests can use it on the booking website now.')
            setForm({ ...form, code: '', note: '' })
          }}
        >
          <Plus className="size-3.5" /> Create
        </Button>
      </div>
      <p className="flex items-center gap-1.5 px-4 py-3 text-xs text-ink-3">
        <Lock className="size-3" /> Discounts are capped at 50%. Larger discounts need a manual rate and manager approval.
      </p>
    </div>
  )
}
