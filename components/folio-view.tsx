'use client'

import { ArrowLeft, Ban, CircleAlert, FileText, LogOut, Mail, Plus, Printer, Wallet, X } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { HOTEL, actorName } from '@/lib/config'
import { fmtDate, fmtDateTime, fmtTime, nightsBetween } from '@/lib/dates'
import { naira, plural } from '@/lib/format'
import { roomTypeOf, useCurrentUser, useFolio, useLookups, usePendingRoomCharge } from '@/lib/hooks'
import { withTaxes } from '@/lib/pricing'
import { toast, useHotel, type PaymentInput } from '@/lib/store'
import type { Charge, Dept, PayMethod } from '@/lib/types'
import { Modal } from './modal'
import { ResStatusBadge, SourceLabel, VipMark } from './status'
import { Badge, Button, EmptyState, Field, Input, KeyValue, Panel, Select, Table, Td, Th, cn } from './ui'

export function FolioView() {
  const { id } = useParams<{ id: string }>()
  const res = useHotel((s) => s.reservations.find((r) => r.id === id))
  if (!res) {
    return (
      <Panel>
        <EmptyState title="Folio not found" body="This reservation doesn't exist, or the demo data was reset." action={<Link href="/front-desk"><Button>Back to front desk</Button></Link>} />
      </Panel>
    )
  }
  return <Folio resId={res.id} />
}

type ModalKind = 'charge' | 'payment' | 'invoice' | 'checkout' | null

function Folio({ resId }: { resId: string }) {
  const router = useRouter()
  const res = useHotel((s) => s.reservations.find((r) => r.id === resId))!
  const checkOut = useHotel((s) => s.checkOut)
  const { guest, room } = useLookups()
  const g = guest(res.guestId)
  const rm = room(res.roomId)
  const { charges, payments, totals } = useFolio(resId)
  const pending = usePendingRoomCharge(res)
  const [modal, setModal] = useState<ModalKind>(null)
  const [voiding, setVoiding] = useState<Charge | null>(null)

  const projected = withTaxes(totals.net + pending.amount)
  const dueAtCheckout = projected.total - totals.paid
  const inHouse = res.status === 'checked_in'

  const ledger = [
    ...charges.map((c) => ({ kind: 'charge' as const, time: c.time, charge: c })),
    ...payments.map((p) => ({ kind: 'payment' as const, time: p.time, payment: p })),
  ].sort((a, b) => a.time.localeCompare(b.time))

  const doCheckOut = () => {
    const result = checkOut(resId)
    if (!result.ok) {
      toast.error('Check-out blocked', result.error)
      return
    }
    toast.success(`${g.firstName} ${g.lastName} checked out`, `Invoice ${result.invoiceNo} emailed · Room ${rm?.number} sent to housekeeping`)
    setModal('invoice')
  }

  return (
    <div>
      <Link href="/front-desk" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3.5" /> Front desk
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-[-0.01em]">
              {g.firstName} {g.lastName}
            </h1>
            {g.vip && <VipMark />}
            <ResStatusBadge status={res.status} />
          </div>
          <p className="mt-1 text-[13px] text-ink-2">
            Folio {res.code} · Room {rm?.number ?? '—'} · {roomTypeOf(res.typeId).name} · {fmtDate(res.checkIn, 'EEE d MMM')} – {fmtDate(res.checkOut, 'EEE d MMM')} ({plural(nightsBetween(res.checkIn, res.checkOut), 'night')})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModal('invoice')}>
            <FileText className="size-3.5" /> {res.status === 'checked_out' ? 'Invoice' : 'Pro-forma'}
          </Button>
          {res.status !== 'checked_out' && res.status !== 'cancelled' && (
            <>
              <Button onClick={() => setModal('charge')}>
                <Plus className="size-3.5" /> Add charge
              </Button>
              <Button onClick={() => setModal('payment')}>
                <Wallet className="size-3.5" /> Take payment
              </Button>
            </>
          )}
          {inHouse && (
            <Button variant="primary" onClick={() => setModal('checkout')}>
              <LogOut className="size-3.5" /> Check out
            </Button>
          )}
        </div>
      </div>

      {inHouse && pending.nights.length > 0 && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-info/20 bg-info-soft px-3.5 py-2.5 text-[13px] text-info">
          <CircleAlert className="size-4 shrink-0" />
          {plural(pending.nights.length, 'room night')} ({naira(pending.amount)} before taxes) will be posted automatically at check-out.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Ledger" subtitle="Charges are shown net. Service charge and VAT are calculated on the total.">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Description</Th>
                <Th>Posted by</Th>
                <Th align="right">Charge</Th>
                <Th align="right">Payment</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {ledger.map((row) =>
                row.kind === 'charge' ? (
                  <tr key={row.charge.id} className={cn('group', row.charge.void && 'text-ink-3')}>
                    <Td className="num whitespace-nowrap text-ink-2">{fmtDate(row.charge.date, 'd MMM')}</Td>
                    <Td>
                      <div className={cn(row.charge.void && 'line-through')}>{row.charge.desc}</div>
                      <div className="text-xs text-ink-3">
                        {row.charge.dept}
                        {row.charge.void && (
                          <span className="ml-1 text-danger no-underline">
                            · Voided: {row.charge.void.reason} · approved by {actorName(row.charge.void.approvedBy)}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td className="text-xs text-ink-2">{actorName(row.charge.by)}</Td>
                    <Td align="right" className={cn(row.charge.void && 'line-through')}>
                      {naira(row.charge.amount)}
                    </Td>
                    <Td align="right" />
                    <Td>
                      {!row.charge.void && res.status !== 'checked_out' && (
                        <button
                          onClick={() => setVoiding(row.charge)}
                          title="Void charge"
                          className="rounded p-1 text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-danger-soft hover:text-danger focus:opacity-100"
                        >
                          <Ban className="size-3.5" />
                        </button>
                      )}
                    </Td>
                  </tr>
                ) : (
                  <tr key={row.payment.id} className="bg-ok-soft/40">
                    <Td className="num whitespace-nowrap text-ink-2">{fmtDate(row.payment.time.slice(0, 10), 'd MMM')}</Td>
                    <Td>
                      <div>Payment · {row.payment.method}</div>
                      {row.payment.ref && <div className="text-xs text-ink-3">Ref. {row.payment.ref}</div>}
                    </Td>
                    <Td className="text-xs text-ink-2">{actorName(row.payment.by)}</Td>
                    <Td align="right" />
                    <Td align="right" className="text-ok">
                      {naira(row.payment.amount)}
                    </Td>
                    <Td />
                  </tr>
                ),
              )}
              {!ledger.length && (
                <tr>
                  <Td colSpan={6}>
                    <EmptyState title="No charges yet" body="Room charges are posted every night by the night audit. Restaurant and bar bills appear here when posted to the room." />
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Panel>

        <div className="space-y-5">
          <Panel title="Summary">
            <dl className="px-4 py-3">
              <KeyValue label="Charges (net)">{naira(totals.net)}</KeyValue>
              <KeyValue label={`Service charge ${HOTEL.serviceRate * 100}%`}>{naira(totals.service)}</KeyValue>
              <KeyValue label={`VAT ${HOTEL.vatRate * 100}%`}>{naira(totals.vat)}</KeyValue>
              <KeyValue label="Total" className="border-t border-line font-medium">
                {naira(totals.total)}
              </KeyValue>
              <KeyValue label="Payments">{naira(-totals.paid)}</KeyValue>
              {inHouse && pending.amount > 0 && <KeyValue label="Pending room charges (incl. taxes)">{naira(projected.total - totals.total)}</KeyValue>}
            </dl>
            <div className={cn('flex items-baseline justify-between border-t border-line px-4 py-3.5', dueAtCheckout > 0 ? 'bg-danger-soft/50' : 'bg-ok-soft/50')}>
              <span className="text-[13px] font-medium">{inHouse ? 'Due at check-out' : 'Balance'}</span>
              <span className={cn('num text-xl font-semibold', dueAtCheckout > 0 ? 'text-danger' : 'text-ok')}>{naira(Math.max(inHouse ? dueAtCheckout : totals.balance, 0))}</span>
            </div>
            {dueAtCheckout < 0 && <p className="px-4 pb-3 text-xs text-ink-3">Credit of {naira(-dueAtCheckout)} to refund or carry forward.</p>}
          </Panel>

          <Panel title="Guest">
            <dl className="px-4 py-2">
              <KeyValue label="Phone">{g.phone}</KeyValue>
              <KeyValue label="Email">
                <span className="break-all">{g.email}</span>
              </KeyValue>
              {g.company && <KeyValue label="Bill to">{g.company}</KeyValue>}
              <KeyValue label="Source">
                <SourceLabel source={res.source} />
              </KeyValue>
              <KeyValue label="Rate">
                {naira(res.rate)} · {res.ratePlan}
              </KeyValue>
              {res.checkedInAt && <KeyValue label="Checked in">{fmtDateTime(res.checkedInAt)}</KeyValue>}
            </dl>
            {res.signature && (
              <div className="border-t border-line px-4 py-3">
                <div className="mb-1 text-xs text-ink-3">Registration signature</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={res.signature} alt="Guest signature" className="h-14 rounded border border-line bg-sunken object-contain" />
              </div>
            )}
          </Panel>
        </div>
      </div>

      <AddChargeModal open={modal === 'charge'} onClose={() => setModal(null)} resId={resId} />
      <PaymentModal open={modal === 'payment'} onClose={() => setModal(null)} resId={resId} suggested={Math.max(dueAtCheckout, 0)} company={g.company} />
      <VoidModal charge={voiding} onClose={() => setVoiding(null)} />
      <InvoiceModal open={modal === 'invoice'} onClose={() => (res.status === 'checked_out' && modal === 'invoice' ? router.push('/front-desk') : setModal(null))} resId={resId} />
      <Modal
        open={modal === 'checkout'}
        onClose={() => setModal(null)}
        size="sm"
        title={`Check out Room ${rm?.number}`}
        description={`${g.firstName} ${g.lastName} · ${res.code}`}
        footer={
          dueAtCheckout > 0 ? (
            <>
              <Button onClick={() => setModal(null)}>Close</Button>
              <Button variant="primary" onClick={() => setModal('payment')}>
                Take payment
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={doCheckOut}>
                Confirm check-out
              </Button>
            </>
          )
        }
      >
        {dueAtCheckout > 0 ? (
          <div className="flex gap-2.5 rounded-md border border-danger/25 bg-danger-soft px-3 py-3 text-[13px] text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Outstanding balance of {naira(dueAtCheckout)}</p>
              <p className="mt-0.5 text-[12.5px] text-[#8a1f16]">The guest can&apos;t be checked out until the folio is settled. Take payment, or move it to the company account if this is a corporate guest.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-[13px] text-ink-2">
            <p>The folio is settled. Checking out will:</p>
            <ul className="list-inside list-disc space-y-1">
              {pending.nights.length > 0 && <li>Post the remaining {plural(pending.nights.length, 'room night')}</li>}
              <li>Issue the final invoice and email it to {g.email}</li>
              <li>Mark Room {rm?.number} as dirty and send a cleaning task to housekeeping</li>
            </ul>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ---------- Add charge ---------- */

const CHARGE_DEPTS: Dept[] = ['Restaurant', 'Bar', 'Room service', 'Laundry', 'Minibar', 'Transport', 'Other']

function AddChargeModal({ open, onClose, resId }: { open: boolean; onClose: () => void; resId: string }) {
  const addCharge = useHotel((s) => s.addCharge)
  const [dept, setDept] = useState<Dept>('Laundry')
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const value = Number(amount.replace(/[^\d]/g, '')) || 0

  const submit = () => {
    if (!value) return
    addCharge(resId, { dept, desc: desc.trim() || dept, amount: value })
    toast.success('Charge posted', `${dept} · ${naira(value)}`)
    setDesc('')
    setAmount('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Post a charge"
      description="Amounts are net. Service charge and VAT are added on the folio."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!value}>
            Post charge
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Department">
          <Select value={dept} onChange={(e) => setDept(e.target.value as Dept)}>
            {CHARGE_DEPTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Description">
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={dept === 'Laundry' ? 'e.g. 3 shirts, 1 suit (express)' : 'Description'} />
        </Field>
        <Field label="Amount (₦, net)">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="0" />
        </Field>
      </div>
    </Modal>
  )
}

/* ---------- Payment (split) ---------- */

function PaymentModal({ open, onClose, resId, suggested, company }: { open: boolean; onClose: () => void; resId: string; suggested: number; company?: string }) {
  if (!open) return null
  return <PaymentForm onClose={onClose} resId={resId} suggested={suggested} company={company} />
}

function PaymentForm({ onClose, resId, suggested, company }: { onClose: () => void; resId: string; suggested: number; company?: string }) {
  const addPayments = useHotel((s) => s.addPayments)
  const methods: PayMethod[] = ['Cash', 'Card', 'Bank transfer', 'Mobile money', ...(company ? (['City ledger'] as PayMethod[]) : [])]
  const [rows, setRows] = useState<{ method: PayMethod; amount: string; ref: string }[]>([{ method: 'Card', amount: String(suggested), ref: '' }])

  const parsed = rows.map((r) => Number(r.amount.replace(/[^\d]/g, '')) || 0)
  const entered = parsed.reduce((a, b) => a + b, 0)
  const remaining = suggested - entered

  const update = (i: number, patch: Partial<(typeof rows)[number]>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const submit = () => {
    const items: PaymentInput[] = rows.map((r, i) => ({ method: r.method, amount: parsed[i], ref: r.ref || undefined })).filter((p) => p.amount > 0)
    if (!items.length) return
    addPayments(resId, items)
    toast.success(`Payment of ${naira(entered)} received`, items.length > 1 ? items.map((p) => `${p.method} ${naira(p.amount)}`).join(' + ') : `By ${items[0].method}. Receipt sent to the guest.`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Take payment"
      description={`Balance due ${naira(suggested)}. Split across methods if the guest pays in parts.`}
      footer={
        <>
          <span className={cn('mr-auto text-xs', remaining === 0 ? 'text-ok' : 'text-ink-3')}>
            {remaining > 0 ? `${naira(remaining)} left to allocate` : remaining < 0 ? `${naira(-remaining)} over balance (credit)` : 'Balance fully covered'}
          </span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!entered}>
            Record {naira(entered)}
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_28px] items-end gap-2">
            <Field label={i === 0 ? 'Method' : ''}>
              <Select value={row.method} onChange={(e) => update(i, { method: e.target.value as PayMethod })}>
                {methods.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label={i === 0 ? 'Amount (₦)' : ''}>
              <Input value={row.amount} onChange={(e) => update(i, { amount: e.target.value })} inputMode="numeric" />
            </Field>
            <Field label={i === 0 ? 'Reference' : ''}>
              <Input value={row.ref} onChange={(e) => update(i, { ref: e.target.value })} placeholder={row.method === 'Cash' ? 'Optional' : row.method === 'City ledger' ? company : 'Approval / transfer ref.'} />
            </Field>
            {rows.length > 1 ? (
              <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="mb-1.5 rounded p-1 text-ink-3 hover:bg-black/[0.04] hover:text-ink" aria-label="Remove">
                <X className="size-4" />
              </button>
            ) : (
              <span />
            )}
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setRows([...rows, { method: 'Cash', amount: String(Math.max(remaining, 0)), ref: '' }])}>
          <Plus className="size-3.5" /> Split payment
        </Button>
        {company && <p className="text-xs text-ink-3">City ledger moves the balance to {company}&apos;s account for monthly invoicing.</p>}
      </div>
    </Modal>
  )
}

/* ---------- Void with manager approval ---------- */

const VOID_REASONS = ['Posted to wrong room', 'Duplicate posting', 'Guest dispute — goodwill', 'Item not served', 'Price error']

function VoidModal({ charge, onClose }: { charge: Charge | null; onClose: () => void }) {
  if (!charge) return null
  return <VoidForm key={charge.id} charge={charge} onClose={onClose} />
}

function VoidForm({ charge, onClose }: { charge: Charge; onClose: () => void }) {
  const user = useCurrentUser()!
  const voidCharge = useHotel((s) => s.voidCharge)
  const [reason, setReason] = useState(VOID_REASONS[0])
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const isManager = user.role === 'manager'

  const submit = () => {
    if (!isManager && pin !== HOTEL.managerPin) {
      setError('Incorrect manager PIN. The charge was not voided.')
      return
    }
    voidCharge(charge.id, reason, isManager ? user.id : 'u-gm')
    toast.success('Charge voided', `${charge.desc} · ${naira(charge.amount)}`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Void charge"
      description={`${charge.desc} · ${naira(charge.amount)} · posted ${fmtDate(charge.date)} ${fmtTime(charge.time)}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={submit}>
            {isManager ? 'Void charge' : 'Approve and void'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {VOID_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        {isManager ? (
          <p className="text-xs text-ink-3">You are signed in as a manager, so no second approval is needed. The void is recorded in the audit log under your name.</p>
        ) : (
          <div className="rounded-md border border-line bg-sunken p-3">
            <p className="mb-2 text-[12.5px] text-ink-2">Voids need a manager&apos;s approval. Ask the duty manager to enter their PIN.</p>
            <Field label="Manager PIN" error={error || undefined} hint={`Demo PIN: ${HOTEL.managerPin}`}>
              <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" maxLength={4} className="w-32 tracking-[0.3em]" autoFocus />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ---------- Invoice ---------- */

function InvoiceModal({ open, onClose, resId }: { open: boolean; onClose: () => void; resId: string }) {
  const res = useHotel((s) => s.reservations.find((r) => r.id === resId))!
  const { guest, room } = useLookups()
  const { charges, payments, totals } = useFolio(resId)
  const g = guest(res.guestId)
  const final = res.status === 'checked_out'
  const active = charges.filter((c) => !c.void)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={final ? `Invoice ${res.invoiceNo}` : 'Pro-forma invoice'}
      description={final ? 'Final invoice issued at check-out.' : 'Running bill to date. The final invoice is issued at check-out.'}
      footer={
        <>
          <Button onClick={() => window.print()}>
            <Printer className="size-3.5" /> Print or save PDF
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              toast.success('Invoice sent', `Emailed to ${g.email} (simulated)`)
              onClose()
            }}
          >
            <Mail className="size-3.5" /> Email to guest
          </Button>
        </>
      }
    >
      <div className="print-area rounded-lg border border-line bg-white p-8 text-[12.5px] text-ink">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="font-serif text-[24px] leading-none text-brand">{HOTEL.name}</div>
            <div className="mt-2 text-ink-2">{HOTEL.address}</div>
            <div className="text-ink-2">
              {HOTEL.phone} · {HOTEL.email}
            </div>
            <div className="text-ink-3">
              TIN {HOTEL.tin} · {HOTEL.rcNumber}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">{final ? 'Tax invoice' : 'Pro-forma'}</div>
            <div className="mt-1 text-[15px] font-semibold">{final ? res.invoiceNo : res.code}</div>
            <div className="text-ink-2">{fmtDate((res.checkedOutAt ?? new Date().toISOString()).slice(0, 10), 'd MMMM yyyy')}</div>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-6 border-y border-line py-4">
          <div>
            <div className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Billed to</div>
            <div className="mt-1 font-medium">
              {g.firstName} {g.lastName}
            </div>
            {g.company && <div>{g.company}</div>}
            <div className="text-ink-2">{g.email}</div>
            <div className="text-ink-2">{g.phone}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Stay</div>
            <div className="mt-1">
              Room {room(res.roomId)?.number} · {roomTypeOf(res.typeId).name}
            </div>
            <div className="text-ink-2">
              {fmtDate(res.checkIn, 'd MMM yyyy')} – {fmtDate(res.checkOut, 'd MMM yyyy')} · {plural(nightsBetween(res.checkIn, res.checkOut), 'night')}
            </div>
            <div className="text-ink-2">Booking {res.code}</div>
          </div>
        </div>

        <table className="mt-4 w-full">
          <thead>
            <tr className="text-left text-[11px] tracking-wide text-ink-3 uppercase">
              <th className="py-2 font-medium">Date</th>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {active.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="num py-1.5 text-ink-2">{fmtDate(c.date, 'd MMM')}</td>
                <td className="py-1.5">{c.desc}</td>
                <td className="num py-1.5 text-right">{naira(c.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-64 space-y-1 border-t border-line pt-3">
          <Row label="Subtotal" value={naira(totals.net)} />
          <Row label="Service charge 10%" value={naira(totals.service)} />
          <Row label="VAT 7.5%" value={naira(totals.vat)} />
          <Row label="Total" value={naira(totals.total)} strong />
          {payments.map((p) => (
            <Row key={p.id} label={`Paid · ${p.method}`} value={naira(-p.amount)} />
          ))}
          <div className="flex justify-between border-t border-ink pt-2 text-[14px] font-semibold">
            <span>Balance</span>
            <span className="num">{naira(Math.max(totals.balance, 0))}</span>
          </div>
        </div>

        <div className="mt-8 flex items-end justify-between gap-6 border-t border-line pt-4 text-[11.5px] text-ink-3">
          <div>
            Bank transfer: {HOTEL.bank.name} · {HOTEL.bank.account} · {HOTEL.bank.accountName}
          </div>
          <div className="font-serif text-[13px] text-brand italic">Thank you for staying with us.</div>
        </div>
        {final && (
          <div className="mt-3">
            <Badge tone="ok">Paid in full</Badge>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between', strong && 'font-semibold')}>
      <span className={strong ? '' : 'text-ink-2'}>{label}</span>
      <span className="num">{value}</span>
    </div>
  )
}
