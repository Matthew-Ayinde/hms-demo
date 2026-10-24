'use client'

import { ArrowLeft, Ban, Crown, Download, GitMerge, Pencil, Plus, ShieldCheck, Trash2, TriangleAlert, X } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { actorName } from '@/lib/config'
import { downloadJson } from '@/lib/csv'
import { fmtDate, nightsBetween } from '@/lib/dates'
import { naira, plural } from '@/lib/format'
import { roomTypeOf, useBalances, useCurrentUser, useLookups } from '@/lib/hooks'
import { findDuplicates, guestStats } from '@/lib/guests'
import { stayQuote } from '@/lib/pricing'
import { toast, useHotel } from '@/lib/store'
import type { Guest } from '@/lib/types'
import { Modal } from './modal'
import { ReservationDrawer } from './reservation-drawer'
import { ResStatusBadge, SourceLabel, VipMark } from './status'
import { Avatar, Badge, Button, EmptyState, Field, Input, KeyValue, Panel, Table, Td, Textarea, Th, cn } from './ui'

export function GuestProfile() {
  const { id } = useParams<{ id: string }>()
  const guest = useHotel((s) => s.guests.find((g) => g.id === id))
  if (!guest) {
    return (
      <Panel>
        <EmptyState
          title="Guest not found"
          body="This profile was merged into another one, or the demo data was reset."
          action={
            <Link href="/guests">
              <Button>All guests</Button>
            </Link>
          }
        />
      </Panel>
    )
  }
  return <Profile key={guest.id} guest={guest} />
}

type ModalKind = 'edit' | 'blacklist' | 'merge' | 'erase' | null

function Profile({ guest: g }: { guest: Guest }) {
  const user = useCurrentUser()!
  const guests = useHotel((s) => s.guests)
  const reservations = useHotel((s) => s.reservations)
  const charges = useHotel((s) => s.charges)
  const payments = useHotel((s) => s.payments)
  const setVip = useHotel((s) => s.setVip)
  const setBlacklist = useHotel((s) => s.setBlacklist)
  const updateGuest = useHotel((s) => s.updateGuest)
  const balance = useBalances()
  const { room } = useLookups()

  const [modal, setModal] = useState<ModalKind>(null)
  const [openRes, setOpenRes] = useState<string | null>(null)
  const [newPref, setNewPref] = useState('')
  const [notes, setNotes] = useState(g.notes ?? '')

  const stats = useMemo(() => guestStats(g, reservations, charges, payments), [g, reservations, charges, payments])
  const stays = reservations.filter((r) => r.guestId === g.id).sort((a, b) => b.checkIn.localeCompare(a.checkIn))
  const dupIds = findDuplicates(guests).get(g.id) ?? []
  const dup = guests.find((x) => x.id === dupIds[0])
  const isManager = user.role === 'manager'
  const active = stays.some((r) => r.status === 'confirmed' || r.status === 'checked_in')

  const addPreference = () => {
    const p = newPref.trim()
    if (!p || g.preferences.includes(p)) return
    updateGuest(g.id, { preferences: [...g.preferences, p] })
    setNewPref('')
  }

  return (
    <div>
      <Link href="/guests" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3.5" /> Guests
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Avatar initials={`${g.firstName[0]}${g.lastName[0]}`} size="lg" tone={g.vip ? 'brass' : 'brand'} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-[-0.01em]">
                {g.firstName} {g.lastName}
              </h1>
              {g.vip && <VipMark />}
              {g.blacklist && <Badge tone="danger">Blacklisted</Badge>}
              {stats.inHouse && <Badge tone="brand">In house · Room {room(stats.inHouse.roomId)?.number}</Badge>}
              {g.anonymised && <Badge>Personal data erased</Badge>}
            </div>
            <p className="mt-0.5 text-[13px] text-ink-2">
              {g.nationality}
              {g.company ? ` · ${g.company}` : ''} · {plural(stats.stays, 'stay')}
              {stats.lastStay ? ` · last stayed ${fmtDate(stats.lastStay, 'd MMM yyyy')}` : ''}
            </p>
          </div>
        </div>
        {!g.anonymised && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setModal('edit')}>
              <Pencil className="size-3.5" /> Edit
            </Button>
            <Button
              onClick={() => {
                setVip(g.id, !g.vip)
                toast.success(g.vip ? 'VIP flag removed' : `${g.firstName} marked as VIP`, g.vip ? undefined : 'Front desk and housekeeping now see the VIP flag.')
              }}
            >
              <Crown className="size-3.5" /> {g.vip ? 'Remove VIP' : 'Mark VIP'}
            </Button>
            {isManager &&
              (g.blacklist ? (
                <Button
                  onClick={() => {
                    setBlacklist(g.id, null)
                    toast.success('Removed from blacklist')
                  }}
                >
                  <ShieldCheck className="size-3.5" /> Remove from blacklist
                </Button>
              ) : (
                <Button variant="ghost" className="text-danger hover:text-danger" onClick={() => setModal('blacklist')}>
                  <Ban className="size-3.5" /> Blacklist
                </Button>
              ))}
          </div>
        )}
      </div>

      {g.blacklist && (
        <div className="mb-4 flex gap-2.5 rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-3 text-[13px] text-danger">
          <Ban className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Do not accept bookings without a manager&apos;s approval</p>
            <p className="mt-0.5 text-[12.5px] text-[#8a1f16]">
              {g.blacklist.reason} · added by {actorName(g.blacklist.by)} on {fmtDate(g.blacklist.at.slice(0, 10), 'd MMM yyyy')}
            </p>
          </div>
        </div>
      )}

      {dup && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-warn/25 bg-warn-soft px-3.5 py-3 text-[13px] text-warn">
          <TriangleAlert className="size-4 shrink-0" />
          <span className="flex-1">
            <span className="font-medium">Possible duplicate profile:</span> {dup.firstName} {dup.lastName} · {dup.email} · {dup.phone}
          </span>
          <Button size="sm" onClick={() => setModal('merge')}>
            <GitMerge className="size-3.5" /> Review and merge
          </Button>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Stays" value={String(stats.stays)} hint={g.stays ? `${g.stays} from earlier records` : 'All in this system'} />
        <Stat label="Nights on record" value={String(stats.nights)} />
        <Stat label="Spend on record" value={naira(stats.spend)} hint="Incl. service charge and VAT" />
        <Stat label="Average per night" value={stats.nights ? naira(stats.spend / stats.nights) : '—'} />
        <Stat label="Books mostly via" value={stats.topSource ?? '—'} />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Stay history" subtitle={plural(stays.length, 'booking')}>
          <Table>
            <thead>
              <tr>
                <Th>Booking</Th>
                <Th>Dates</Th>
                <Th>Room</Th>
                <Th>Source</Th>
                <Th>Status</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {stays.map((r) => {
                const nights = nightsBetween(r.checkIn, r.checkOut)
                const total = r.status === 'confirmed' ? stayQuote(r.rate, nights).total : balance(r.id).total
                const href = r.status === 'confirmed' || r.status === 'cancelled' ? null : `/folio/${r.id}`
                return (
                  <tr key={r.id} className="hover:bg-sunken/60">
                    <Td>
                      {href ? (
                        <Link href={href} className="font-medium text-brand hover:underline">
                          {r.code}
                        </Link>
                      ) : (
                        <button onClick={() => setOpenRes(r.id)} className="font-medium text-brand hover:underline">
                          {r.code}
                        </button>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {fmtDate(r.checkIn, 'd MMM yyyy')} – {fmtDate(r.checkOut, 'd MMM')}
                      <div className="text-xs text-ink-3">{plural(nights, 'night')}</div>
                    </Td>
                    <Td>
                      {room(r.roomId)?.number ?? '—'}
                      <div className="text-xs text-ink-3">{roomTypeOf(r.typeId).name}</div>
                    </Td>
                    <Td>
                      <SourceLabel source={r.source} />
                    </Td>
                    <Td>
                      <ResStatusBadge status={r.status} />
                    </Td>
                    <Td align="right">{r.status === 'cancelled' ? '—' : naira(total)}</Td>
                  </tr>
                )
              })}
              {!stays.length && (
                <tr>
                  <Td colSpan={6}>
                    <EmptyState title="No bookings in this system yet" body={g.stays ? `${plural(g.stays, 'earlier stay')} imported from the old records.` : undefined} />
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Panel>

        <div className="space-y-5">
          <Panel title="Contact">
            <dl className="px-4 py-2">
              <KeyValue label="Phone">{g.phone}</KeyValue>
              <KeyValue label="Email">
                <span className="break-all">{g.email}</span>
              </KeyValue>
              <KeyValue label="Nationality">{g.nationality}</KeyValue>
              {g.company && <KeyValue label="Company">{g.company}</KeyValue>}
              <KeyValue label="ID on file">{g.idNumber ? `${g.idType} · ···${g.idNumber.slice(-4)}` : <span className="text-ink-3">Taken at check-in</span>}</KeyValue>
            </dl>
          </Panel>

          {!g.anonymised && (
            <Panel title="Preferences" subtitle="Shown to the front desk and housekeeping">
              <div className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {g.preferences.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1 rounded border border-line bg-sunken py-0.5 pr-1 pl-2 text-xs text-ink-2">
                      {p}
                      <button
                        onClick={() => updateGuest(g.id, { preferences: g.preferences.filter((x) => x !== p) })}
                        className="rounded p-0.5 text-ink-3 hover:bg-black/5 hover:text-ink"
                        aria-label={`Remove ${p}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  {!g.preferences.length && <span className="text-xs text-ink-3">None recorded yet.</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  <Input value={newPref} onChange={(e) => setNewPref(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPreference()} placeholder="e.g. Feather-free pillows" />
                  <Button onClick={addPreference} disabled={!newPref.trim()}>
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>
            </Panel>
          )}

          {!g.anonymised && (
            <Panel title="Internal notes" subtitle="Staff only. Never shown to the guest.">
              <div className="px-4 py-3">
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the next shift should know" />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    disabled={notes === (g.notes ?? '')}
                    onClick={() => {
                      updateGuest(g.id, { notes })
                      toast.success('Notes saved')
                    }}
                  >
                    Save notes
                  </Button>
                </div>
              </div>
            </Panel>
          )}

          <Panel title="Privacy and consent" subtitle="Nigeria Data Protection Act (NDPA)">
            <div className="space-y-3 px-4 py-3 text-[13px]">
              <label className="flex items-start gap-2 text-ink-2">
                <input
                  type="checkbox"
                  disabled={g.anonymised}
                  checked={!!g.marketing}
                  onChange={(e) => {
                    updateGuest(g.id, { marketing: e.target.checked })
                    toast.success(e.target.checked ? 'Marketing consent recorded' : 'Guest unsubscribed from marketing')
                  }}
                  className="mt-0.5 accent-brand"
                />
                Agreed to receive offers by email and WhatsApp
              </label>
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <Button
                  size="sm"
                  onClick={() => {
                    const own = reservations.filter((r) => r.guestId === g.id)
                    const ids = new Set(own.map((r) => r.id))
                    downloadJson(`guest-data-${g.lastName.toLowerCase()}-${g.id}.json`, {
                      exportedAt: new Date().toISOString(),
                      profile: g,
                      bookings: own,
                      charges: charges.filter((c) => ids.has(c.resId)),
                      payments: payments.filter((p) => ids.has(p.resId)),
                    })
                    toast.success('Guest data exported', 'Everything held about this guest, as a JSON file for a subject access request.')
                  }}
                >
                  <Download className="size-3.5" /> Export guest data
                </Button>
                {isManager && !g.anonymised && (
                  <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => setModal('erase')}>
                    <Trash2 className="size-3.5" /> Erase personal data
                  </Button>
                )}
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {modal === 'edit' && <EditGuestModal guest={g} onClose={() => setModal(null)} />}
      {modal === 'blacklist' && <BlacklistModal guest={g} onClose={() => setModal(null)} />}
      {modal === 'merge' && dup && <MergeModal a={g} b={dup} onClose={() => setModal(null)} />}
      {modal === 'erase' && <EraseModal guest={g} blocked={active} onClose={() => setModal(null)} />}
      <ReservationDrawer resId={openRes} onClose={() => setOpenRes(null)} />
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-[11.5px] text-ink-3">{hint}</div>}
    </div>
  )
}

function EditGuestModal({ guest: g, onClose }: { guest: Guest; onClose: () => void }) {
  const updateGuest = useHotel((s) => s.updateGuest)
  const [form, setForm] = useState({ firstName: g.firstName, lastName: g.lastName, phone: g.phone, email: g.email, nationality: g.nationality, company: g.company ?? '' })
  const valid = form.firstName.trim() && form.lastName.trim() && form.phone.trim()

  const save = () => {
    const patch = Object.fromEntries(
      Object.entries({ ...form, company: form.company.trim() || undefined }).filter(([k, v]) => v !== (g as unknown as Record<string, unknown>)[k]),
    )
    if (Object.keys(patch).length) updateGuest(g.id, patch)
    toast.success('Profile updated')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit guest details"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ['firstName', 'First name'],
            ['lastName', 'Last name'],
            ['phone', 'Phone (WhatsApp)'],
            ['email', 'Email'],
            ['nationality', 'Nationality'],
            ['company', 'Company (bill-to account)'],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <Input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </Field>
        ))}
      </div>
    </Modal>
  )
}

function BlacklistModal({ guest: g, onClose }: { guest: Guest; onClose: () => void }) {
  const setBlacklist = useHotel((s) => s.setBlacklist)
  const [reason, setReason] = useState('')
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Blacklist ${g.firstName} ${g.lastName}?`}
      description="Front desk will be warned, and only a manager can accept future bookings."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 10}
            onClick={() => {
              setBlacklist(g.id, reason.trim())
              toast.success(`${g.firstName} ${g.lastName} blacklisted`)
              onClose()
            }}
          >
            Blacklist guest
          </Button>
        </>
      }
    >
      <Field label="Reason" hint="Be factual. The guest can request to see this under the NDPA.">
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged room furniture, ₦80,000 unpaid (Room 204, 12 Sep)" autoFocus />
      </Field>
    </Modal>
  )
}

function MergeModal({ a, b, onClose }: { a: Guest; b: Guest; onClose: () => void }) {
  const mergeGuests = useHotel((s) => s.mergeGuests)
  const reservations = useHotel((s) => s.reservations)
  const [keep, setKeep] = useState<string>(a.stays + (a.vip ? 10 : 0) >= b.stays + (b.vip ? 10 : 0) ? a.id : b.id)
  const count = (g: Guest) => reservations.filter((r) => r.guestId === g.id).length
  const fields: [string, (g: Guest) => string][] = [
    ['Email', (g) => g.email],
    ['Phone', (g) => g.phone],
    ['Company', (g) => g.company ?? '—'],
    ['VIP', (g) => (g.vip ? 'Yes' : 'No')],
    ['Earlier stays', (g) => String(g.stays)],
    ['Bookings here', (g) => String(count(g))],
    ['Preferences', (g) => g.preferences.join(', ') || '—'],
  ]
  const drop = keep === a.id ? b : a

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Merge duplicate profiles"
      description="Choose the profile to keep. Bookings, stays and preferences from the other are moved onto it, and the other profile is removed."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              mergeGuests(keep, drop.id)
              toast.success('Profiles merged', `${plural(count(drop), 'booking')} moved. Logged in the audit trail.`)
              onClose()
            }}
          >
            <GitMerge className="size-3.5" /> Merge into selected profile
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {[a, b].map((g) => (
          <button
            key={g.id}
            onClick={() => setKeep(g.id)}
            className={cn('rounded-lg border p-4 text-left transition-colors', keep === g.id ? 'border-brand bg-brand-soft ring-1 ring-brand' : 'border-line hover:border-line-strong')}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                {g.firstName} {g.lastName}
              </span>
              <span className={cn('text-xs font-medium', keep === g.id ? 'text-brand' : 'text-ink-3')}>{keep === g.id ? 'Keep this profile' : 'Merge away'}</span>
            </div>
            <dl className="mt-2 space-y-1 text-[12.5px]">
              {fields.map(([label, get]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-ink-3">{label}</dt>
                  <dd className="text-right text-ink-2">{get(g)}</dd>
                </div>
              ))}
            </dl>
          </button>
        ))}
      </div>
    </Modal>
  )
}

function EraseModal({ guest: g, blocked, onClose }: { guest: Guest; blocked: boolean; onClose: () => void }) {
  const anonymiseGuest = useHotel((s) => s.anonymiseGuest)
  const [confirm, setConfirm] = useState('')
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Erase personal data"
      description={`Right-to-erasure request for ${g.firstName} ${g.lastName}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            disabled={blocked || confirm.trim().toLowerCase() !== g.lastName.toLowerCase()}
            onClick={() => {
              anonymiseGuest(g.id)
              toast.success('Personal data erased', 'Invoices and payments are kept for tax records.')
              onClose()
            }}
          >
            Erase permanently
          </Button>
        </>
      }
    >
      {blocked ? (
        <p className="rounded-md bg-warn-soft px-3 py-2.5 text-[13px] text-warn">This guest has an upcoming or current stay. Erase their data after they check out.</p>
      ) : (
        <div className="space-y-3 text-[13px] text-ink-2">
          <p>Removes name, phone, email, ID, preferences and notes. Invoices, payments and the audit trail are kept anonymously, as tax law requires.</p>
          <Field label={`Type "${g.lastName}" to confirm`}>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoFocus />
          </Field>
        </div>
      )}
    </Modal>
  )
}
