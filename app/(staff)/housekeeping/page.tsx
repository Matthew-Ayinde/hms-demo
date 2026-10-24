'use client'

import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { Check, Clock, Play, Wrench } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/modal'
import { RoomStateBadge } from '@/components/status'
import { Badge, Button, EmptyState, Field, Input, PageHeader, Segmented, Select, cn } from '@/components/ui'
import { actorName } from '@/lib/config'
import { fmtTime } from '@/lib/dates'
import { roomTypeOf, useCurrentUser, useLookups } from '@/lib/hooks'
import { occupants, roomState } from '@/lib/rooms'
import { toast, useHotel } from '@/lib/store'
import type { Reservation, Room, Task } from '@/lib/types'

type View = 'mine' | 'all' | 'rooms'

const ISSUES = ['AC not cooling', 'Leaking tap or shower', 'TV not working', 'Light bulb out', 'Door lock fault', 'Blocked drain']

export default function HousekeepingPage() {
  const user = useCurrentUser()!
  const tasks = useHotel((s) => s.tasks)
  const rooms = useHotel((s) => s.rooms)
  const reservations = useHotel((s) => s.reservations)
  const today = useHotel((s) => s.businessDate)
  const [view, setView] = useState<View>(user.role === 'housekeeping' ? 'mine' : 'all')
  const [issueRoom, setIssueRoom] = useState<Room | null>(null)
  const [, tick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const occ = useMemo(() => occupants(reservations), [reservations])
  const arrivals = useMemo(() => {
    const map = new Map<string, Reservation>()
    for (const r of reservations) if (r.status === 'confirmed' && r.checkIn === today && r.roomId) map.set(r.roomId, r)
    return map
  }, [reservations, today])

  const scoped = view === 'mine' ? tasks.filter((t) => t.assignee === 'u-hk') : tasks
  const open = scoped
    .filter((t) => t.status !== 'done')
    .sort((a, b) => {
      const rank = (t: Task) => (t.status === 'in_progress' ? 0 : arrivals.has(t.roomId) ? 1 : 2)
      return rank(a) - rank(b) || a.roomId.localeCompare(b.roomId)
    })
  const done = scoped.filter((t) => t.status === 'done').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  const progress = scoped.length ? done.length / scoped.length : 0

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Housekeeping"
        description={view === 'mine' ? `${user.role === 'housekeeping' ? user.name : 'Grace Eze'} · today's assignments` : 'All attendants · changes appear on the front desk straight away'}
        actions={
          <Segmented
            value={view}
            onChange={setView}
            items={[
              { value: 'mine', label: 'My tasks' },
              { value: 'all', label: 'All tasks' },
              { value: 'rooms', label: 'Rooms' },
            ]}
          />
        }
      />

      {view !== 'rooms' ? (
        <>
          <div className="mb-4 rounded-card border border-line bg-surface px-4 py-3">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-medium">
                {done.length} of {scoped.length} rooms done
              </span>
              <span className="text-xs text-ink-3">{open.filter((t) => arrivals.has(t.roomId)).length} with guests arriving today</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-soft">
              <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {open.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                room={rooms.find((r) => r.id === task.roomId)!}
                occupant={occ.get(task.roomId)}
                arrival={arrivals.get(task.roomId)}
                onIssue={(r) => setIssueRoom(r)}
              />
            ))}
          </div>
          {!open.length && (
            <div className="rounded-card border border-line bg-surface">
              <EmptyState title="All rooms done" body="New tasks appear here automatically when guests check out." />
            </div>
          )}

          {done.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Completed today</h2>
              <ul className="divide-y divide-line rounded-card border border-line bg-surface">
                {done.map((t) => {
                  const room = rooms.find((r) => r.id === t.roomId)!
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                      <Check className="size-4 text-ok" />
                      <span className="w-10 font-semibold">{room.number}</span>
                      <span className="text-ink-2">{t.type}</span>
                      <span className="ml-auto text-xs text-ink-3">
                        {actorName(t.assignee)} · {fmtTime(t.doneAt!)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      ) : (
        <RoomsList onIssue={setIssueRoom} />
      )}

      <IssueModal key={issueRoom?.id} room={issueRoom} onClose={() => setIssueRoom(null)} />
    </div>
  )
}

function TaskCard({ task, room, occupant, arrival, onIssue }: { task: Task; room: Room; occupant?: Reservation; arrival?: Reservation; onIssue: (r: Room) => void }) {
  const startTask = useHotel((s) => s.startTask)
  const completeTask = useHotel((s) => s.completeTask)
  const { guest } = useLookups()
  const type = roomTypeOf(room.typeId)
  const inProgress = task.status === 'in_progress'

  return (
    <article className={cn('rounded-card border bg-surface p-4', inProgress ? 'border-brand ring-1 ring-brand/20' : 'border-line')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] leading-none font-semibold tracking-tight">{room.number}</span>
            <span className="text-xs text-ink-3">
              {type.name} · Floor {room.floor}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={task.type === 'Inspection' ? 'brand' : task.type === 'Stay-over' ? 'info' : 'neutral'}>{task.type}</Badge>
            {arrival && <Badge tone="warn">Arrival {arrival.eta ?? 'today'}</Badge>}
            {occupant && guest(occupant.guestId).vip && <Badge tone="brass">VIP in room</Badge>}
            {occupant && <span className="text-xs text-ink-3">Occupied · {guest(occupant.guestId).lastName}</span>}
            {!occupant && <span className="text-xs text-ink-3">Vacant</span>}
          </div>
        </div>
        <span className="text-right text-xs text-ink-3">{actorName(task.assignee)}</span>
      </div>

      {task.note && <p className="mt-3 rounded-md bg-sunken px-3 py-2 text-[12.5px] text-ink-2">{task.note}</p>}

      {inProgress && task.startedAt && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-brand">
          <Clock className="size-3.5" /> Started {formatDistanceToNowStrict(parseISO(task.startedAt))} ago
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {task.status === 'todo' && task.type !== 'Inspection' && (
          <Button
            size="lg"
            className="flex-1"
            onClick={() => {
              startTask(task.id)
              toast.info(`Room ${room.number} · cleaning started`)
            }}
          >
            <Play className="size-4" /> Start cleaning
          </Button>
        )}
        {(inProgress || task.type === 'Inspection') && (
          <Button
            size="lg"
            variant="primary"
            className="flex-1"
            onClick={() => {
              completeTask(task.id)
              toast.success(
                task.type === 'Inspection' ? `Room ${room.number} inspected` : `Room ${room.number} is clean`,
                arrival ? `Front desk can now check in ${guest(arrival.guestId).firstName} ${guest(arrival.guestId).lastName}.` : 'Front desk and calendar updated.',
              )
            }}
          >
            <Check className="size-4" /> {task.type === 'Inspection' ? 'Pass inspection' : 'Mark clean'}
          </Button>
        )}
        <Button size="lg" variant="ghost" onClick={() => onIssue(room)} title="Report a fault" className="px-3">
          <Wrench className="size-4" />
        </Button>
      </div>
    </article>
  )
}

function RoomsList({ onIssue }: { onIssue: (r: Room) => void }) {
  const rooms = useHotel((s) => s.rooms)
  const reservations = useHotel((s) => s.reservations)
  const returnToService = useHotel((s) => s.returnToService)
  const user = useCurrentUser()!
  const occ = useMemo(() => occupants(reservations), [reservations])

  return (
    <ul className="divide-y divide-line rounded-card border border-line bg-surface">
      {rooms.map((room) => (
        <li key={room.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
          <span className="w-10 font-semibold">{room.number}</span>
          <span className="w-28 text-xs text-ink-3">{roomTypeOf(room.typeId).name}</span>
          <RoomStateBadge state={roomState(room, occ.get(room.id))} />
          {room.hk === 'ooo' && <span className="text-xs text-ink-3">{room.oooReason}</span>}
          <span className="ml-auto flex gap-1">
            {room.hk === 'ooo' && user.role === 'manager' ? (
              <Button
                size="sm"
                onClick={() => {
                  returnToService(room.id)
                  toast.success(`Room ${room.number} returned to service`, 'A full clean has been assigned before it goes back on sale.')
                }}
              >
                Return to service
              </Button>
            ) : (
              room.hk !== 'ooo' && (
                <Button size="sm" variant="ghost" onClick={() => onIssue(room)}>
                  <Wrench className="size-3.5" /> Report fault
                </Button>
              )
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

function IssueModal({ room, onClose }: { room: Room | null; onClose: () => void }) {
  const reportIssue = useHotel((s) => s.reportIssue)
  const [issue, setIssue] = useState(ISSUES[0])
  const [other, setOther] = useState('')
  const [block, setBlock] = useState(false)
  if (!room) return null
  const text = issue === 'Other' ? other.trim() : issue

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Report a fault · Room ${room.number}`}
      description="Creates a maintenance ticket. Blocking the room takes it off sale until it's fixed."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!text}
            onClick={() => {
              reportIssue(room.id, text, block)
              toast.success('Fault reported', block ? `Room ${room.number} is out of order and blocked on the calendar.` : `Maintenance notified about Room ${room.number}.`)
              onClose()
            }}
          >
            Send to maintenance
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Issue">
          <Select value={issue} onChange={(e) => setIssue(e.target.value)}>
            {[...ISSUES, 'Other'].map((i) => (
              <option key={i}>{i}</option>
            ))}
          </Select>
        </Field>
        {issue === 'Other' && (
          <Field label="Describe the fault">
            <Input value={other} onChange={(e) => setOther(e.target.value)} autoFocus />
          </Field>
        )}
        <label className="flex items-start gap-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} className="mt-0.5 accent-brand" />
          Block room from sale (out of order)
        </label>
        <p className="text-xs text-ink-3">The maintenance team gets a WhatsApp alert (simulated in this prototype).</p>
      </div>
    </Modal>
  )
}
