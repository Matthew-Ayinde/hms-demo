'use client'

import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, ClipboardList, Trash } from 'lucide-react'
import { useState } from 'react'
import { PreviewBanner } from '@/components/preview-banner'
import { Badge, Button, PageHeader, Panel, Table, Tabs, Td, Th, cn } from '@/components/ui'
import { fmtDate, shift } from '@/lib/dates'
import { naira, nairaCompact } from '@/lib/format'
import { toast, useHotel } from '@/lib/store'

type Store = 'Bar store' | 'Kitchen store' | 'Housekeeping store'

interface Item {
  name: string
  store: Store
  unit: string
  onHand: number
  par: number
  cost: number
  supplier: string
}

const ITEMS: Item[] = [
  { name: 'Star lager 60cl', store: 'Bar store', unit: 'bottle', onHand: 14, par: 48, cost: 950, supplier: 'Beverage distributor, Ikeja' },
  { name: 'Heineken 60cl', store: 'Bar store', unit: 'bottle', onHand: 52, par: 48, cost: 1150, supplier: 'Beverage distributor, Ikeja' },
  { name: 'Guinness stout', store: 'Bar store', unit: 'bottle', onHand: 38, par: 36, cost: 1050, supplier: 'Beverage distributor, Ikeja' },
  { name: 'Hennessy VS 70cl', store: 'Bar store', unit: 'bottle', onHand: 4, par: 6, cost: 42000, supplier: 'Wine & spirits wholesaler' },
  { name: 'Bottled water 75cl', store: 'Bar store', unit: 'pack of 12', onHand: 18, par: 20, cost: 2400, supplier: 'Water depot, Lekki' },
  { name: 'Basmati rice', store: 'Kitchen store', unit: 'bag (25kg)', onHand: 2, par: 6, cost: 68000, supplier: 'Mile 12 market' },
  { name: 'Vegetable oil', store: 'Kitchen store', unit: 'keg (25L)', onHand: 3, par: 4, cost: 62000, supplier: 'Mile 12 market' },
  { name: 'Chicken (whole, frozen)', store: 'Kitchen store', unit: 'kg', onHand: 46, par: 40, cost: 4200, supplier: 'Poultry cold room, Ikorodu' },
  { name: 'Croaker fish', store: 'Kitchen store', unit: 'kg', onHand: 12, par: 15, cost: 6500, supplier: 'Fish market, Epe' },
  { name: 'Tomato paste', store: 'Kitchen store', unit: 'carton', onHand: 5, par: 4, cost: 18500, supplier: 'Mile 12 market' },
  { name: 'Guest toiletry kits', store: 'Housekeeping store', unit: 'kit', onHand: 22, par: 60, cost: 1800, supplier: 'HotelPro Supplies' },
  { name: 'Bath towels', store: 'Housekeeping store', unit: 'piece', onHand: 140, par: 120, cost: 7500, supplier: 'HotelPro Supplies' },
  { name: 'Bed sheets (king)', store: 'Housekeeping store', unit: 'set', onHand: 64, par: 60, cost: 14000, supplier: 'HotelPro Supplies' },
  { name: 'Toilet rolls', store: 'Housekeeping store', unit: 'pack of 10', onHand: 30, par: 25, cost: 3800, supplier: 'Lagos wholesale' },
  { name: 'Room freshener', store: 'Housekeeping store', unit: 'can', onHand: 9, par: 12, cost: 2100, supplier: 'Lagos wholesale' },
]

const MOVES = [
  { day: 0, kind: 'Issue', item: 'Star lager 60cl', qty: -24, note: 'Bar store → Pool bar', by: 'Musa Ibrahim' },
  { day: 0, kind: 'Issue', item: 'Guest toiletry kits', qty: -18, note: 'Daily room set-up', by: 'Joy Akpan' },
  { day: -1, kind: 'Received', item: 'Chicken (whole, frozen)', qty: 40, note: 'GRN-0218 · Poultry cold room', by: 'Store keeper' },
  { day: -1, kind: 'Wastage', item: 'Croaker fish', qty: -2, note: 'Spoiled, cold room door left open', by: 'Head chef' },
  { day: -2, kind: 'Transfer', item: 'Bottled water 75cl', qty: -4, note: 'Bar store → Housekeeping (minibars)', by: 'Store keeper' },
  { day: -2, kind: 'Received', item: 'Heineken 60cl', qty: 48, note: 'GRN-0217 · Beverage distributor', by: 'Store keeper' },
]

const KIND_ICON = { Issue: ArrowUpRight, Received: ArrowDownLeft, Transfer: ArrowRightLeft, Wastage: Trash }

export default function InventoryPage() {
  const today = useHotel((s) => s.businessDate)
  const [store, setStore] = useState<Store | 'All'>('All')
  const items = ITEMS.filter((i) => store === 'All' || i.store === store)
  const low = ITEMS.filter((i) => i.onHand < i.par)
  const value = ITEMS.reduce((s, i) => s + i.onHand * i.cost, 0)

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Stock in each store, reorder alerts, and every movement in and out."
        actions={
          <Button variant="primary" onClick={() => toast.info('Purchase orders arrive in Phase 2', `${low.length} items below par would be grouped into one draft order per supplier.`)}>
            <ClipboardList className="size-3.5" /> Reorder {low.length} low items
          </Button>
        }
      />
      <PreviewBanner phase={2} weeks="4–5">
        Sample stock figures, not linked to the restaurant till yet. In the live system, each sale on the till deducts ingredients by recipe, and stock counts show the variance against expected levels.
      </PreviewBanner>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Stock value" value={nairaCompact(value)} />
        <Kpi label="Items below par" value={String(low.length)} tone="warn" />
        <Kpi label="Wastage this week" value={naira(2 * 6500)} />
        <Kpi label="Last full count" value={fmtDate(shift(today, -6), 'EEE d MMM')} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <Tabs
            value={store}
            onChange={setStore}
            className="px-2"
            items={(['All', 'Bar store', 'Kitchen store', 'Housekeeping store'] as const).map((s) => ({ value: s, label: s, count: s === 'All' ? ITEMS.length : ITEMS.filter((i) => i.store === s).length }))}
          />
          <Table>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Store</Th>
                <Th align="right">On hand</Th>
                <Th align="right">Par</Th>
                <Th>Level</Th>
                <Th align="right">Unit cost</Th>
                <Th align="right">Value</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const ratio = i.onHand / i.par
                return (
                  <tr key={i.name} className="hover:bg-sunken/60">
                    <Td>
                      <div className="font-medium">{i.name}</div>
                      <div className="text-xs text-ink-3">{i.supplier}</div>
                    </Td>
                    <Td className="text-ink-2">{i.store}</Td>
                    <Td align="right">
                      {i.onHand} <span className="text-xs text-ink-3">{i.unit}</span>
                    </Td>
                    <Td align="right" className="text-ink-2">
                      {i.par}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#efede8]">
                          <div className={cn('h-full rounded-full', ratio < 0.5 ? 'bg-danger' : ratio < 1 ? 'bg-[#c98a12]' : 'bg-ok')} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
                        </div>
                        {ratio < 0.5 ? <Badge tone="danger">Reorder now</Badge> : ratio < 1 ? <Badge tone="warn">Low</Badge> : null}
                      </div>
                    </Td>
                    <Td align="right">{naira(i.cost)}</Td>
                    <Td align="right">{naira(i.onHand * i.cost)}</Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </Panel>

        <Panel title="Recent movements" subtitle="Received, issued, transferred and wasted">
          <ul className="divide-y divide-line">
            {MOVES.map((m, idx) => {
              const Icon = KIND_ICON[m.kind as keyof typeof KIND_ICON]
              return (
                <li key={idx} className="flex gap-3 px-4 py-2.5 text-[13px]">
                  <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full', m.qty > 0 ? 'bg-ok-soft text-ok' : m.kind === 'Wastage' ? 'bg-danger-soft text-danger' : 'bg-[#efede8] text-ink-2')}>
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <span className="truncate font-medium">{m.item}</span>
                      <span className={cn('num shrink-0', m.qty > 0 ? 'text-ok' : 'text-ink-2')}>
                        {m.qty > 0 ? '+' : ''}
                        {m.qty}
                      </span>
                    </div>
                    <div className="truncate text-xs text-ink-3">
                      {m.kind} · {m.note} · {m.by} · {fmtDate(shift(today, m.day), 'EEE d MMM')}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="text-xs text-ink-3">{label}</div>
      <div className={cn('mt-1 text-xl font-semibold', tone === 'warn' && 'text-warn')}>{value}</div>
    </div>
  )
}
