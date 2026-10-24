'use client'

import { Mail, Phone, Receipt } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { actorName } from '@/lib/config'
import { fmtDate, fmtDateTime, nightsBetween } from '@/lib/dates'
import { naira, plural } from '@/lib/format'
import { roomTypeOf, useFolio, useLookups } from '@/lib/hooks'
import { stayQuote } from '@/lib/pricing'
import { toast, useHotel } from '@/lib/store'
import { CheckInModal } from './check-in'
import { Modal } from './modal'
import { ResStatusBadge, SourceLabel, VipMark } from './status'
import { Button, Field, KeyValue, Select } from './ui'

const CANCEL_REASONS = ['Guest changed travel plans', 'Duplicate booking', 'Found cheaper rate', 'No payment received', 'Other']

export function ReservationDrawer({ resId, onClose }: { resId: string | null; onClose: () => void }) {
  const res = useHotel((s) => s.reservations.find((r) => r.id === resId))
  const today = useHotel((s) => s.businessDate)
  const cancelReservation = useHotel((s) => s.cancelReservation)
  const { guest, room } = useLookups()
  const folio = useFolio(resId ?? '')
  const [checkInId, setCheckInId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState(CANCEL_REASONS[0])

  if (!res) return null
  const g = guest(res.guestId)
  const nights = nightsBetween(res.checkIn, res.checkOut)
  const quote = stayQuote(res.rate, nights)
  const lateCancel = nightsBetween(today, res.checkIn) < 2
  const fee = lateCancel ? res.rate : 0
  const showFolio = res.status !== 'confirmed' || folio.payments.length > 0

  return (
    <>
      <Modal
        open={!!resId && !checkInId}
        onClose={onClose}
        side
        title={
          <span className="flex items-center gap-2">
            {g.firstName} {g.lastName} {g.vip && <VipMark />}
            {g.blacklist && <span className="rounded bg-danger-soft px-1 text-[10.5px] font-semibold text-danger">BLACKLISTED</span>}
          </span>
        }
        description={
          <span className="flex items-center gap-2">
            {res.code} · <ResStatusBadge status={res.status} />
          </span>
        }
        footer={
          <>
            {res.status === 'confirmed' && (
              <Button variant="ghost" className="mr-auto text-danger hover:text-danger" onClick={() => setCancelling(true)}>
                Cancel booking
              </Button>
            )}
            {showFolio && (
              <Link href={`/folio/${res.id}`}>
                <Button>
                  <Receipt className="size-3.5" /> Open folio
                </Button>
              </Link>
            )}
            {res.status === 'confirmed' && res.checkIn === today && (
              <Button variant="primary" onClick={() => setCheckInId(res.id)}>
                Check in
              </Button>
            )}
          </>
        }
      >
        <section>
          <h3 className="mb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Stay</h3>
          <dl className="divide-y divide-line">
            <KeyValue label="Dates">
              {fmtDate(res.checkIn, 'EEE d MMM')} – {fmtDate(res.checkOut, 'EEE d MMM')} · {plural(nights, 'night')}
            </KeyValue>
            <KeyValue label="Room">{room(res.roomId) ? `Room ${room(res.roomId)!.number}` : <span className="text-warn">Not assigned</span>}</KeyValue>
            <KeyValue label="Room type">{roomTypeOf(res.typeId).name}</KeyValue>
            <KeyValue label="Rate plan">
              {res.ratePlan} · {naira(res.rate)}/night
            </KeyValue>
            <KeyValue label="Guests">
              {plural(res.adults, 'adult')}
              {res.children ? `, ${plural(res.children, 'child', 'children')}` : ''}
            </KeyValue>
            <KeyValue label="Source">
              <SourceLabel source={res.source} />
            </KeyValue>
            {res.eta && res.status === 'confirmed' && <KeyValue label="Expected arrival">{res.eta}</KeyValue>}
            <KeyValue label="Booked">
              {fmtDateTime(res.createdAt)} by {actorName(res.createdBy)}
            </KeyValue>
            {res.checkedInAt && <KeyValue label="Checked in">{fmtDateTime(res.checkedInAt)}</KeyValue>}
            {res.checkedOutAt && <KeyValue label="Checked out">{fmtDateTime(res.checkedOutAt)}</KeyValue>}
            {res.cancelReason && <KeyValue label="Cancellation">{res.cancelReason}</KeyValue>}
          </dl>
          {res.notes && <p className="mt-3 rounded-md bg-brass-soft px-3 py-2 text-[12.5px] text-[#6d5126]">{res.notes}</p>}
        </section>

        <section className="mt-6">
          <div className="mb-1 flex items-baseline justify-between">
            <h3 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Guest</h3>
            <Link href={`/guests/${g.id}`} className="text-xs font-medium text-brand hover:underline">
              Full profile
            </Link>
          </div>
          <dl className="divide-y divide-line">
            <KeyValue label="Phone">
              <a href={`tel:${g.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand">
                <Phone className="size-3 text-ink-3" /> {g.phone}
              </a>
            </KeyValue>
            <KeyValue label="Email">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3 text-ink-3" /> {g.email}
              </span>
            </KeyValue>
            <KeyValue label="Nationality">{g.nationality}</KeyValue>
            {g.company && <KeyValue label="Company">{g.company}</KeyValue>}
            <KeyValue label="Previous stays">{g.stays}</KeyValue>
            {g.idNumber && (
              <KeyValue label="ID on file">
                {g.idType} · ···{g.idNumber.slice(-4)}
              </KeyValue>
            )}
          </dl>
          {g.preferences.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {g.preferences.map((p) => (
                <span key={p} className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-2">
                  {p}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6">
          <h3 className="mb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Billing</h3>
          <dl className="divide-y divide-line">
            {res.status === 'confirmed' ? (
              <KeyValue label="Stay total (incl. taxes)">{naira(quote.total)}</KeyValue>
            ) : (
              <KeyValue label="Charges to date (incl. taxes)">{naira(folio.totals.total)}</KeyValue>
            )}
            <KeyValue label="Paid">{naira(folio.totals.paid)}</KeyValue>
            <KeyValue label={res.status === 'confirmed' ? 'Due on arrival' : 'Balance'}>
              <span className="font-semibold">{naira(res.status === 'confirmed' ? Math.max(quote.total - folio.totals.paid, 0) : folio.totals.balance)}</span>
            </KeyValue>
          </dl>
        </section>
      </Modal>

      <Modal
        open={cancelling}
        onClose={() => setCancelling(false)}
        size="sm"
        title={`Cancel ${res.code}?`}
        description={`${g.firstName} ${g.lastName} · arriving ${fmtDate(res.checkIn, 'EEE d MMM')}`}
        footer={
          <>
            <Button onClick={() => setCancelling(false)}>Keep booking</Button>
            <Button
              variant="danger"
              onClick={() => {
                cancelReservation(res.id, reason, fee)
                setCancelling(false)
                onClose()
                toast.success(`${res.code} cancelled`, fee ? `Late cancellation fee of ${naira(fee)} posted to the folio.` : 'No cancellation fee. The room is back on sale.')
              }}
            >
              Cancel booking
            </Button>
          </>
        }
      >
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {CANCEL_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <div className="mt-4 rounded-md border border-line bg-sunken px-3 py-2.5 text-[12.5px] text-ink-2">
          <p className="font-medium text-ink">Cancellation policy</p>
          <p className="mt-0.5">Free until 48 hours before arrival. After that, one night ({naira(res.rate)}) is charged.</p>
          <p className="mt-1.5 font-medium text-ink">{lateCancel ? `Fee applies: ${naira(fee)}` : 'No fee applies.'}</p>
        </div>
      </Modal>

      <CheckInModal resId={checkInId} onClose={() => setCheckInId(null)} onDone={onClose} />
    </>
  )
}
