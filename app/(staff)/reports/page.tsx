'use client'

import { Download, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { RankedBars, SERIES, TrendChart } from '@/components/charts'
import { Button, PageHeader, Panel, Segmented, Table, Td, Th } from '@/components/ui'
import { HOTEL, SOURCES } from '@/lib/config'
import { downloadCsv } from '@/lib/csv'
import { fmtDate } from '@/lib/dates'
import { naira, nairaCompact, pct } from '@/lib/format'
import { toast, useHotel } from '@/lib/store'

type Range = '7' | '14' | '30'

export default function ReportsPage() {
  const history = useHotel((s) => s.history)
  const rooms = useHotel((s) => s.rooms)
  const [range, setRange] = useState<Range>('30')
  const inventory = rooms.length

  const days = useMemo(() => history.slice(-Number(range)), [history, range])

  const kpi = useMemo(() => {
    const sold = days.reduce((s, d) => s + d.roomsSold, 0)
    const roomRev = days.reduce((s, d) => s + d.roomRevenue, 0)
    const fnb = days.reduce((s, d) => s + d.fnbRevenue, 0)
    const other = days.reduce((s, d) => s + d.otherRevenue, 0)
    const available = inventory * days.length
    return { sold, roomRev, fnb, other, total: roomRev + fnb + other, occ: sold / available, adr: roomRev / sold, revpar: roomRev / available }
  }, [days, inventory])

  const occSeries = days.map((d) => ({ date: d.date, value: d.roomsSold / inventory }))
  const adrSeries = days.map((d) => ({ date: d.date, value: Math.round(d.roomRevenue / d.roomsSold) }))
  const bySource = SOURCES.map((s) => ({ label: s, value: days.reduce((sum, d) => sum + d.bySource[s], 0) })).sort((a, b) => b.value - a.value)
  const byDept = [
    { label: 'Rooms', value: kpi.roomRev },
    { label: 'Food & beverage', value: kpi.fnb },
    { label: 'Other', value: kpi.other },
  ]

  const exportCsv = () => {
    downloadCsv(
      `${HOTEL.codePrefix.toLowerCase()}-daily-revenue-${days[0].date}-to-${days[days.length - 1].date}.csv`,
      ['Date', 'Rooms sold', 'Occupancy %', 'ADR', 'RevPAR', 'Room revenue', 'F&B revenue', 'Other revenue', 'Total revenue'],
      days.map((d) => [
        d.date,
        d.roomsSold,
        ((d.roomsSold / inventory) * 100).toFixed(1),
        Math.round(d.roomRevenue / d.roomsSold),
        Math.round(d.roomRevenue / inventory),
        d.roomRevenue,
        d.fnbRevenue,
        d.otherRevenue,
        d.roomRevenue + d.fnbRevenue + d.otherRevenue,
      ]),
    )
    toast.success('Report exported', 'Daily revenue CSV downloaded. It opens in Excel or Google Sheets.')
  }

  return (
    <div className="print-area">
      <PageHeader
        title="Reports"
        description={`${fmtDate(days[0].date, 'd MMM')} – ${fmtDate(days[days.length - 1].date, 'd MMM yyyy')} · closed days up to last night's audit · ${inventory} rooms`}
        actions={
          <>
            <Segmented
              value={range}
              onChange={setRange}
              items={[
                { value: '7', label: '7 days' },
                { value: '14', label: '14 days' },
                { value: '30', label: '30 days' },
              ]}
            />
            <Button onClick={() => window.print()} className="no-print">
              <Printer className="size-3.5" /> PDF
            </Button>
            <Button variant="primary" onClick={exportCsv} className="no-print">
              <Download className="size-3.5" /> Export CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Occupancy" value={pct(kpi.occ, 1)} hint={`${kpi.sold} room nights sold`} />
        <Kpi label="ADR" value={naira(kpi.adr)} hint="Average daily rate" />
        <Kpi label="RevPAR" value={naira(kpi.revpar)} hint="Revenue per available room" />
        <Kpi label="Room revenue" value={nairaCompact(kpi.roomRev)} hint={`${pct(kpi.roomRev / kpi.total)} of total`} />
        <Kpi label="Total revenue" value={nairaCompact(kpi.total)} hint="Net of VAT and service charge" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Occupancy" subtitle="Rooms sold ÷ rooms available, per night" bodyClassName="px-3 pt-3 pb-1">
          <TrendChart data={occSeries} format={(v) => pct(v)} label="Occupancy" domain={[0, 1]} />
        </Panel>
        <Panel title="Average daily rate" subtitle="Room revenue ÷ rooms sold, per night" bodyClassName="px-3 pt-3 pb-1">
          <TrendChart data={adrSeries} format={nairaCompact} label="ADR" color={SERIES[1]} domain={[40000, 65000]} />
        </Panel>
        <Panel title="Revenue by department" subtitle="Net revenue for the period" bodyClassName="px-4 py-4">
          <RankedBars data={byDept} format={nairaCompact} />
        </Panel>
        <Panel title="Room revenue by booking source" subtitle="Direct channels avoid 15–18% OTA commission" bodyClassName="px-4 py-4">
          <RankedBars data={bySource} format={nairaCompact} />
        </Panel>
      </div>

      <Panel title="Daily revenue report" subtitle="The same figures as the CSV export" className="mt-5">
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th align="right">Sold</Th>
              <Th align="right">Occ.</Th>
              <Th align="right">ADR</Th>
              <Th align="right">RevPAR</Th>
              <Th align="right">Rooms</Th>
              <Th align="right">F&amp;B</Th>
              <Th align="right">Other</Th>
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((d) => (
              <tr key={d.date} className="hover:bg-sunken/60">
                <Td className="whitespace-nowrap">{fmtDate(d.date, 'EEE d MMM')}</Td>
                <Td align="right">{d.roomsSold}</Td>
                <Td align="right">{pct(d.roomsSold / inventory)}</Td>
                <Td align="right">{naira(d.roomRevenue / d.roomsSold)}</Td>
                <Td align="right">{naira(d.roomRevenue / inventory)}</Td>
                <Td align="right">{naira(d.roomRevenue)}</Td>
                <Td align="right">{naira(d.fnbRevenue)}</Td>
                <Td align="right">{naira(d.otherRevenue)}</Td>
                <Td align="right" className="font-medium">
                  {naira(d.roomRevenue + d.fnbRevenue + d.otherRevenue)}
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-sunken font-semibold">
              <Td>Total</Td>
              <Td align="right">{kpi.sold}</Td>
              <Td align="right">{pct(kpi.occ, 1)}</Td>
              <Td align="right">{naira(kpi.adr)}</Td>
              <Td align="right">{naira(kpi.revpar)}</Td>
              <Td align="right">{naira(kpi.roomRev)}</Td>
              <Td align="right">{naira(kpi.fnb)}</Td>
              <Td align="right">{naira(kpi.other)}</Td>
              <Td align="right">{naira(kpi.total)}</Td>
            </tr>
          </tfoot>
        </Table>
      </Panel>
    </div>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3.5">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 text-[24px] leading-none font-semibold tracking-tight">{value}</div>
      <div className="mt-2 text-xs text-ink-3">{hint}</div>
    </div>
  )
}
