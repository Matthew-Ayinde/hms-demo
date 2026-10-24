'use client'

import { AlertTriangle, ArrowRight, BedDouble, Crown, MoonStar, Package, Receipt, Wrench } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ChartLegend, RevenueChart, SERIES } from '@/components/charts'
import { Modal } from '@/components/modal'
import { RoomStateBadge, VipMark } from '@/components/status'
import { Avatar, Badge, Button, PageHeader, Panel, cn } from '@/components/ui'
import { occupiedOn } from '@/lib/availability'
import { HOTEL, STOCK_ALERTS, USERS, actorName } from '@/lib/config'
import { fmtDate, fmtTime, shift } from '@/lib/dates'
import { naira, nairaCompact, plural } from '@/lib/format'
import { useBalances, useCurrentUser, useFrontDeskLists, useLookups } from '@/lib/hooks'
import { isReady, occupants, roomState, ROOM_STATE_META, type RoomState } from '@/lib/rooms'
import { toast, useHotel } from '@/lib/store'

export default function DashboardPage() {
  const user = useCurrentUser()!
  const today = useHotel((s) => s.businessDate)
  const rooms = useHotel((s) => s.rooms)
  const reservations = useHotel((s) => s.reservations)
  const charges = useHotel((s) => s.charges)
  const history = useHotel((s) => s.history)
  const audit = useHotel((s) => s.audit)
  const auditDone = useHotel((s) => s.nightAuditDone)
  const runNightAudit = useHotel((s) => s.runNightAudit)
  const lists = useFrontDeskLists()
  const balance = useBalances()
  const { guest, room } = useLookups()
  const [auditOpen, setAuditOpen] = useState(false)

  const sellable = rooms.filter((r) => r.hk !== 'ooo').length
  const soldTonight = occupiedOn(reservations, today)
  const occupancy = soldTonight / sellable
  const lastWeek = history.find((h) => h.date === shift(today, -7))
  const lastWeekOcc = lastWeek ? lastWeek.roomsSold / 23 : null

  const todayCharges = charges.filter((c) => c.date === today && !c.void)
  const revenueToday = todayCharges.reduce((s, c) => s + c.amount, 0)
  const roomRevenueTonight = reservations
    .filter((r) => (r.status === 'checked_in' || r.status === 'confirmed') && r.checkIn <= today && r.checkOut > today)
    .reduce((s, r) => s + r.rate, 0)
  const adrTonight = soldTonight ? roomRevenueTonight / soldTonight : 0

  const revenueSeries = useMemo(
    () => history.map((h) => ({ date: h.date, rooms: h.roomRevenue, fnb: h.fnbRevenue, other: h.otherRevenue })),
    [history],
  )
  const thirtyDayTotal = revenueSeries.reduce((s, d) => s + d.rooms + d.fnb + d.other, 0)

  const occ = useMemo(() => occupants(reservations), [reservations])
  const stateCounts = rooms.reduce<Record<RoomState, number>>(
    (acc, r) => {
      acc[roomState(r, occ.get(r.id))]++
      return acc
    },
    { occupied: 0, occupied_dirty: 0, vacant_clean: 0, inspected: 0, vacant_dirty: 0, ooo: 0 },
  )

  const alerts = useMemo(() => {
    const list: { tone: 'danger' | 'warn' | 'brass' | 'neutral'; icon: typeof Crown; text: string; href?: string }[] = []
    for (const r of lists.departures.filter((d) => d.status === 'checked_in')) {
      const b = balance(r.id).balance
      if (b > 0) list.push({ tone: 'danger', icon: Receipt, text: `${guest(r.guestId).firstName} ${guest(r.guestId).lastName} (Room ${room(r.roomId)?.number}) departs today owing ${naira(b)}`, href: `/folio/${r.id}` })
    }
    for (const r of lists.arrivals.filter((a) => a.status === 'confirmed')) {
      const g = guest(r.guestId)
      const rm = room(r.roomId)
      if (g.vip) list.push({ tone: 'brass', icon: Crown, text: `VIP arrival: ${g.firstName} ${g.lastName}, ETA ${r.eta ?? 'today'}${rm ? ` · Room ${rm.number} ${isReady(rm) ? 'ready' : 'not ready'}` : ''}`, href: '/front-desk' })
      if (!rm) list.push({ tone: 'warn', icon: BedDouble, text: `${g.firstName} ${g.lastName} arrives today with no room assigned`, href: '/reservations' })
      else if (!isReady(rm)) list.push({ tone: 'warn', icon: BedDouble, text: `Room ${rm.number} not ready for ${g.firstName} ${g.lastName} (ETA ${r.eta ?? '—'})`, href: '/housekeeping' })
    }
    for (const r of rooms.filter((x) => x.hk === 'ooo')) list.push({ tone: 'neutral', icon: Wrench, text: `Room ${r.number} out of order: ${r.oooReason}`, href: '/housekeeping' })
    for (const s of STOCK_ALERTS) list.push({ tone: 'neutral', icon: Package, text: `Low stock: ${s.item} — ${s.onHand} ${s.unit} in ${s.store} (par ${s.par})` })
    return list
  }, [lists, balance, guest, room, rooms])

  const pendingAudit = reservations.filter((r) => r.status === 'checked_in' && r.checkIn <= today && r.checkOut > today && !r.postedNights.includes(today))

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${user.name.split(' ')[0]}`}
        description={`${HOTEL.name} · ${fmtDate(today, 'EEEE d MMMM yyyy')}`}
        actions={
          user.role === 'manager' && (
            <Button onClick={() => setAuditOpen(true)} disabled={auditDone}>
              <MoonStar className="size-3.5" /> {auditDone ? 'Night audit closed' : 'Run night audit'}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Occupancy tonight"
          value={`${Math.round(occupancy * 100)}%`}
          sub={`${soldTonight} of ${sellable} rooms`}
          delta={lastWeekOcc !== null ? Math.round((occupancy - lastWeekOcc) * 100) : undefined}
          deltaLabel="pts vs last week"
        />
        <Stat label="Arrivals" value={`${lists.arrivalsPending}`} sub={`${lists.arrivals.length - lists.arrivalsPending} of ${lists.arrivals.length} checked in`} href="/front-desk" />
        <Stat label="Departures" value={`${lists.departuresPending}`} sub={`${lists.departures.length - lists.departuresPending} of ${lists.departures.length} checked out`} href="/front-desk" />
        <Stat label="ADR tonight" value={nairaCompact(adrTonight)} sub={`Room revenue ${nairaCompact(roomRevenueTonight)}`} />
        <Stat label="Posted today" value={nairaCompact(revenueToday)} sub={`${plural(todayCharges.length, 'charge')} · net of tax`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel
          title="Revenue · last 30 days"
          subtitle={`${naira(thirtyDayTotal)} net · closed days up to last night's audit`}
          actions={user.role === 'manager' && <Link href="/reports" className="text-xs font-medium text-brand hover:underline">Reports</Link>}
          bodyClassName="px-4 pt-3 pb-2"
        >
          <ChartLegend
            items={[
              { label: 'Rooms', color: SERIES[0] },
              { label: 'Food & beverage', color: SERIES[1] },
              { label: 'Other', color: SERIES[2] },
            ]}
          />
          <div className="mt-2">
            <RevenueChart data={revenueSeries} height={250} />
          </div>
        </Panel>

        <Panel title="Needs attention" subtitle={plural(alerts.length, 'item')}>
          <ul className="scroll-thin max-h-[318px] divide-y divide-line overflow-y-auto">
            {alerts.map((a, i) => {
              const body = (
                <div className="flex items-start gap-2.5 px-4 py-2.5 text-[13px]">
                  <a.icon
                    className={cn(
                      'mt-0.5 size-3.5 shrink-0',
                      a.tone === 'danger' ? 'text-danger' : a.tone === 'warn' ? 'text-warn' : a.tone === 'brass' ? 'text-brass' : 'text-ink-3',
                    )}
                  />
                  <span className="text-ink-2">{a.text}</span>
                  {a.href && <ArrowRight className="mt-0.5 ml-auto size-3.5 shrink-0 text-ink-3" />}
                </div>
              )
              return <li key={i}>{a.href ? <Link href={a.href} className="block hover:bg-sunken">{body}</Link> : body}</li>
            })}
          </ul>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Arrivals today" actions={<Link href="/front-desk" className="text-xs font-medium text-brand hover:underline">Front desk</Link>}>
          <ul className="divide-y divide-line">
            {lists.arrivals.map((r) => {
              const g = guest(r.guestId)
              const rm = room(r.roomId)
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                  <span className="num w-11 text-xs text-ink-3">{r.status === 'checked_in' ? fmtTime(r.checkedInAt!) : (r.eta ?? '—')}</span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-medium">
                      {g.firstName} {g.lastName}
                    </span>
                    {g.vip && <VipMark />}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-ink-3">{rm ? rm.number : 'No room'}</span>
                    {r.status === 'checked_in' ? <Badge tone="brand">In</Badge> : rm && isReady(rm) ? <Badge tone="ok">Ready</Badge> : <Badge tone="warn">Not ready</Badge>}
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel title="Rooms right now" subtitle={`${rooms.length} rooms · ${sellable} sellable`}>
          <div className="px-4 py-4">
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
              {(Object.keys(stateCounts) as RoomState[]).map((s) =>
                stateCounts[s] ? (
                  <div
                    key={s}
                    style={{ flex: stateCounts[s] }}
                    className={cn(
                      ROOM_STATE_META[s].tone === 'info' && (s === 'occupied' ? 'bg-info' : 'bg-info/50'),
                      ROOM_STATE_META[s].tone === 'ok' && 'bg-ok',
                      ROOM_STATE_META[s].tone === 'brand' && 'bg-brand',
                      ROOM_STATE_META[s].tone === 'warn' && 'bg-[#c98a12]',
                      ROOM_STATE_META[s].tone === 'danger' && 'bg-danger',
                    )}
                  />
                ) : null,
              )}
            </div>
            <ul className="mt-4 space-y-2">
              {(Object.keys(stateCounts) as RoomState[]).map((s) => (
                <li key={s} className="flex items-center justify-between text-[13px]">
                  <RoomStateBadge state={s} />
                  <span className="num font-medium">{stateCounts[s]}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel title="Recent activity" actions={user.role === 'manager' && <Link href="/audit" className="text-xs font-medium text-brand hover:underline">Audit log</Link>} className="lg:col-span-2 xl:col-span-1">
          <ul className="divide-y divide-line">
            {audit.slice(0, 7).map((a) => {
              const u = USERS.find((x) => x.id === a.userId)
              return (
                <li key={a.id} className="flex gap-3 px-4 py-2.5">
                  <Avatar initials={u?.initials ?? 'SY'} size="sm" tone={u ? 'brand' : 'neutral'} />
                  <div className="min-w-0 flex-1 text-[12.5px]">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-ink">{a.action}</span>
                      <span className="num shrink-0 text-[11px] text-ink-3">{fmtTime(a.at)}</span>
                    </div>
                    <div className="truncate text-ink-3">
                      {actorName(a.userId)} · {a.detail}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      <Modal
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        size="sm"
        title="Run night audit"
        description={`Closes business date ${fmtDate(today, 'EEE d MMM yyyy')}`}
        footer={
          <>
            <Button onClick={() => setAuditOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                const result = runNightAudit()
                setAuditOpen(false)
                if (result.ok) toast.success('Night audit closed', `${plural(result.posted, 'room charge')} posted to guest folios.`)
                else toast.error('Night audit', result.error)
              }}
            >
              Run audit
            </Button>
          </>
        }
      >
        <ul className="space-y-2 text-[13px] text-ink-2">
          <li className="flex gap-2">
            <span className="text-ink-3">1.</span> Post tonight&apos;s room charge to {plural(pendingAudit.length, 'in-house folio')} ({naira(pendingAudit.reduce((s, r) => s + r.rate, 0))} net)
          </li>
          <li className="flex gap-2">
            <span className="text-ink-3">2.</span> Flag {plural(lists.arrivalsPending, 'arrival')} not yet checked in as possible no-shows
          </li>
          <li className="flex gap-2">
            <span className="text-ink-3">3.</span> Lock today&apos;s figures for the daily revenue report
          </li>
        </ul>
        {lists.arrivalsPending > 0 && (
          <p className="mt-4 flex gap-2 rounded-md bg-warn-soft px-3 py-2 text-xs text-warn">
            <AlertTriangle className="size-3.5 shrink-0" /> In a live hotel this runs after midnight. In the demo you can run it at any time.
          </p>
        )}
      </Modal>
    </div>
  )
}

function Stat({ label, value, sub, delta, deltaLabel, href }: { label: string; value: string; sub: string; delta?: number; deltaLabel?: string; href?: string }) {
  const content = (
    <div className={cn('h-full rounded-card border border-line bg-surface px-4 py-3.5', href && 'transition-colors hover:border-line-strong')}>
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 text-[26px] leading-none font-semibold tracking-tight">{value}</div>
      <div className="mt-2 text-xs text-ink-3">
        {delta !== undefined ? (
          <>
            <span className={cn('font-medium', delta >= 0 ? 'text-ok' : 'text-danger')}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}
            </span>{' '}
            {deltaLabel} · {sub}
          </>
        ) : (
          sub
        )}
      </div>
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}
