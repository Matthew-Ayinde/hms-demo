'use client'

import { BedDouble, ChefHat, CreditCard, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Modal } from '@/components/modal'
import { VipMark } from '@/components/status'
import { Badge, Button, EmptyState, Field, Input, PageHeader, Panel, Segmented, cn } from '@/components/ui'
import { MENU } from '@/lib/config'
import { fmtDate, fmtTime } from '@/lib/dates'
import { naira } from '@/lib/format'
import { useBalances, useFrontDeskLists, useLookups } from '@/lib/hooks'
import { withTaxes } from '@/lib/pricing'
import { toast, useHotel } from '@/lib/store'
import type { Outlet, PayMethod, TicketLine } from '@/lib/types'

const CATEGORIES = ['All', ...Array.from(new Set(MENU.map((m) => m.category)))]

export default function PosPage() {
  const postTicket = useHotel((s) => s.postTicket)
  const tickets = useHotel((s) => s.tickets)
  const today = useHotel((s) => s.businessDate)
  const nextCheck = useHotel((s) => s.counters.check)
  const { room, guestName } = useLookups()
  const reservations = useHotel((s) => s.reservations)

  const [outlet, setOutlet] = useState<Outlet>('Restaurant')
  const [table, setTable] = useState('4')
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [lines, setLines] = useState<TicketLine[]>([])
  const [sent, setSent] = useState(false)
  const [picker, setPicker] = useState(false)
  const [settle, setSettle] = useState(false)

  const items = useMemo(
    () => MENU.filter((m) => (category === 'All' || m.category === category) && m.name.toLowerCase().includes(query.trim().toLowerCase())),
    [category, query],
  )
  const net = lines.reduce((s, l) => s + l.qty * l.price, 0)
  const taxes = withTaxes(net)
  const count = lines.reduce((s, l) => s + l.qty, 0)

  const add = (itemId: string) => {
    const item = MENU.find((m) => m.id === itemId)!
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === itemId)
      return existing ? prev.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + 1 } : l)) : [...prev, { itemId, name: item.name, qty: 1, price: item.price }]
    })
  }
  const changeQty = (itemId: string, delta: number) =>
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0))

  const clear = () => {
    setLines([])
    setSent(false)
  }

  const finish = (settlement: 'Room' | PayMethod, resId?: string) => {
    const result = postTicket({ outlet, table: outlet === 'Room service' ? undefined : table, lines, settlement, resId })
    if (!result.ok) {
      toast.error('Not posted', result.error)
      return false
    }
    if (settlement === 'Room') {
      const res = reservations.find((r) => r.id === resId)!
      toast.success(`Check #${result.ticket.number} posted to Room ${room(res.roomId)?.number}`, `${naira(net)} net now shows on ${guestName(res.guestId)}'s folio.`)
    } else {
      toast.success(`Check #${result.ticket.number} settled`, `${naira(taxes.total)} by ${settlement}. Receipt printed (simulated).`)
    }
    clear()
    return true
  }

  return (
    <div>
      <PageHeader
        title="Restaurant & bar"
        description="Ring up orders, send them to the kitchen or bar, and settle them or charge them to a guest's room."
        actions={
          <Segmented
            value={outlet}
            onChange={setOutlet}
            items={[
              { value: 'Restaurant', label: 'Restaurant' },
              { value: 'Bar', label: 'Pool bar' },
              { value: 'Room service', label: 'Room service' },
            ]}
          />
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find item" className="w-44 pl-8" />
            </div>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn('h-8 rounded-md px-3 text-[13px] font-medium transition-colors', category === c ? 'bg-ink text-white' : 'border border-line bg-surface text-ink-2 hover:border-line-strong')}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((m) => {
              const inTicket = lines.find((l) => l.itemId === m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => add(m.id)}
                  className={cn(
                    'relative flex min-h-[92px] flex-col justify-between rounded-lg border bg-surface p-3 text-left transition-colors active:scale-[0.99]',
                    inTicket ? 'border-brand' : 'border-line hover:border-line-strong',
                  )}
                >
                  <span className="pr-6 text-[13px] leading-snug font-medium">{m.name}</span>
                  <span className="mt-2 flex items-center justify-between">
                    <span className="num text-[13px] text-ink-2">{naira(m.price)}</span>
                    <span className="text-[10.5px] tracking-wide text-ink-3 uppercase">{m.station}</span>
                  </span>
                  {inTicket && <span className="num absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">{inTicket.qty}</span>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-5">
          <Panel
            title={`Check #${nextCheck}`}
            subtitle={outlet === 'Room service' ? 'Room service order' : `${outlet === 'Bar' ? 'Pool bar' : 'Restaurant'} · table ${table || '—'}`}
            actions={
              outlet !== 'Room service' && (
                <Input value={table} onChange={(e) => setTable(e.target.value)} className="h-7 w-16 text-center" aria-label="Table number" />
              )
            }
          >
            {lines.length ? (
              <ul className="divide-y divide-line">
                {lines.map((l) => (
                  <li key={l.itemId} className="flex items-center gap-2 px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px]">{l.name}</div>
                      <div className="num text-xs text-ink-3">{naira(l.price)} each</div>
                    </div>
                    <div className="flex items-center rounded-md border border-line">
                      <button onClick={() => changeQty(l.itemId, -1)} className="flex size-7 items-center justify-center text-ink-2 hover:text-ink" aria-label="Less">
                        {l.qty === 1 ? <Trash2 className="size-3.5" /> : <Minus className="size-3.5" />}
                      </button>
                      <span className="num w-6 text-center text-[13px] font-medium">{l.qty}</span>
                      <button onClick={() => changeQty(l.itemId, 1)} className="flex size-7 items-center justify-center text-ink-2 hover:text-ink" aria-label="More">
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <span className="num w-20 text-right text-[13px]">{naira(l.qty * l.price)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No items yet" body="Tap menu items to add them to this check." />
            )}
            <dl className="space-y-1 border-t border-line px-4 py-3 text-[13px]">
              <div className="flex justify-between text-ink-2">
                <dt>Subtotal · {count} items</dt>
                <dd className="num">{naira(net)}</dd>
              </div>
              <div className="flex justify-between text-ink-2">
                <dt>Service charge and VAT</dt>
                <dd className="num">{naira(taxes.service + taxes.vat)}</dd>
              </div>
              <div className="flex justify-between pt-1 text-[15px] font-semibold">
                <dt>Total</dt>
                <dd className="num">{naira(taxes.total)}</dd>
              </div>
            </dl>
            <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
              <Button
                disabled={!lines.length || sent}
                onClick={() => {
                  setSent(true)
                  const kitchen = lines.some((l) => MENU.find((m) => m.id === l.itemId)!.station === 'Kitchen')
                  const bar = lines.some((l) => MENU.find((m) => m.id === l.itemId)!.station === 'Bar')
                  toast.info('Order sent', [kitchen && 'Kitchen ticket printed', bar && 'Bar ticket printed'].filter(Boolean).join(' · '))
                }}
              >
                <ChefHat className="size-3.5" /> {sent ? 'Sent' : 'Send order'}
              </Button>
              <Button disabled={!lines.length} onClick={clear} variant="ghost">
                Clear
              </Button>
              <Button disabled={!lines.length} onClick={() => setSettle(true)}>
                <CreditCard className="size-3.5" /> Settle now
              </Button>
              <Button disabled={!lines.length} variant="primary" onClick={() => setPicker(true)}>
                <BedDouble className="size-3.5" /> Post to room
              </Button>
            </div>
          </Panel>

          <Panel title="Recent checks" subtitle={fmtDate(today, 'EEEE d MMM')}>
            {tickets.length ? (
              <ul className="divide-y divide-line">
                {tickets.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                    <span className="num font-medium">#{t.number}</span>
                    <span className="text-xs text-ink-3">
                      {t.outlet} · {fmtTime(t.at)}
                    </span>
                    <span className="ml-auto">
                      {t.settlement === 'Room' ? <Badge tone="brand">Room {room(reservations.find((r) => r.id === t.resId)?.roomId ?? null)?.number}</Badge> : <Badge>{t.settlement}</Badge>}
                    </span>
                    <span className="num w-20 text-right">{naira(withTaxes(t.net).total)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No checks closed yet today" />
            )}
          </Panel>
        </div>
      </div>

      <RoomPicker open={picker} onClose={() => setPicker(false)} total={taxes.total} onConfirm={(resId) => finish('Room', resId) && setPicker(false)} />
      <Modal
        open={settle}
        onClose={() => setSettle(false)}
        size="sm"
        title={`Settle ${naira(taxes.total)}`}
        description="Walk-in diner or a guest paying directly."
      >
        <div className="grid grid-cols-2 gap-2">
          {(['Cash', 'Card', 'Bank transfer', 'Mobile money'] as PayMethod[]).map((m) => (
            <Button
              key={m}
              size="lg"
              onClick={() => {
                if (finish(m)) setSettle(false)
              }}
            >
              {m}
            </Button>
          ))}
        </div>
      </Modal>
    </div>
  )
}

function RoomPicker({ open, onClose, total, onConfirm }: { open: boolean; onClose: () => void; total: number; onConfirm: (resId: string) => void }) {
  if (!open) return null
  return <RoomPickerBody onClose={onClose} total={total} onConfirm={onConfirm} />
}

function RoomPickerBody({ onClose, total, onConfirm }: { onClose: () => void; total: number; onConfirm: (resId: string) => void }) {
  const { inHouse } = useFrontDeskLists()
  const { guest, room } = useLookups()
  const balance = useBalances()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [surname, setSurname] = useState('')

  const list = inHouse
    .filter((r) => `${room(r.roomId)?.number} ${guest(r.guestId).lastName} ${guest(r.guestId).firstName}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (room(a.roomId)?.number ?? '').localeCompare(room(b.roomId)?.number ?? ''))
  const chosen = inHouse.find((r) => r.id === selected)
  const surnameOk = chosen && surname.trim().toLowerCase() === guest(chosen.guestId).lastName.toLowerCase()

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`Post ${naira(total)} to a room`}
      description="Only in-house guests can be charged. Confirm the surname to prevent posting to the wrong room."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!surnameOk} onClick={() => chosen && onConfirm(chosen.id)}>
            Post to Room {chosen ? room(chosen.roomId)?.number : ''}
          </Button>
        </>
      }
    >
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Room number or guest name" className="pl-8" autoFocus />
      </div>
      <ul className="scroll-thin max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line">
        {list.map((r) => {
          const g = guest(r.guestId)
          return (
            <li key={r.id}>
              <button
                onClick={() => {
                  setSelected(r.id)
                  setSurname('')
                }}
                className={cn('flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-sunken', selected === r.id && 'bg-brand-soft hover:bg-brand-soft')}
              >
                <span className="w-10 font-semibold">{room(r.roomId)?.number}</span>
                <span className="flex items-center gap-1.5">
                  {g.firstName} {g.lastName.charAt(0)}. {g.vip && <VipMark />}
                </span>
                <span className="ml-auto text-xs text-ink-3">out {fmtDate(r.checkOut, 'EEE d')}</span>
                <span className="num w-24 text-right text-xs text-ink-3">bal. {naira(balance(r.id).balance)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {chosen && (
        <Field label="Guest surname" hint="Ask the guest to state their surname and sign the docket." error={surname && !surnameOk ? "Doesn't match the guest in this room" : undefined} className="mt-4">
          <Input value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Surname" autoFocus />
        </Field>
      )}
    </Modal>
  )
}
