'use client'

import { Check, CircleAlert, FileImage, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { freeRooms } from '@/lib/availability'
import { HOTEL, ROOM_TYPES } from '@/lib/config'
import { fmtDate, nightsBetween } from '@/lib/dates'
import { naira, plural } from '@/lib/format'
import { roomTypeOf, useFolio, useLookups } from '@/lib/hooks'
import { stayQuote } from '@/lib/pricing'
import { isReady } from '@/lib/rooms'
import { toast, useHotel } from '@/lib/store'
import type { PayMethod } from '@/lib/types'
import { Modal } from './modal'
import { SignaturePad } from './signature-pad'
import { SourceLabel, VipMark } from './status'
import { Badge, Button, Field, Input, Select, cn } from './ui'

const ID_TYPES = ['International passport', 'NIN slip', "Driver's licence", "Voter's card", 'Company ID', 'Passport']
const STEPS = ['Guest & ID', 'Room', 'Payment & signature'] as const

export function CheckInModal({ resId, onClose, onDone }: { resId: string | null; onClose: () => void; onDone?: () => void }) {
  if (!resId) return null
  return <CheckInFlow key={resId} resId={resId} onClose={onClose} onDone={onDone} />
}

function CheckInFlow({ resId, onClose, onDone }: { resId: string; onClose: () => void; onDone?: () => void }) {
  const res = useHotel((s) => s.reservations.find((r) => r.id === resId))!
  const rooms = useHotel((s) => s.rooms)
  const reservations = useHotel((s) => s.reservations)
  const checkIn = useHotel((s) => s.checkIn)
  const { guest } = useLookups()
  const g = guest(res.guestId)
  const folio = useFolio(resId)

  const [step, setStep] = useState(0)
  const [idType, setIdType] = useState(g.idType ?? 'International passport')
  const [idNumber, setIdNumber] = useState(g.idNumber ?? '')
  const [idFile, setIdFile] = useState<{ name: string; url: string } | null>(null)
  const [showUpgrades, setShowUpgrades] = useState(false)
  const [roomId, setRoomId] = useState<string>(res.roomId ?? '')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PayMethod>('Card')
  const [payRef, setPayRef] = useState('')
  const [signature, setSignature] = useState('')
  const [policies, setPolicies] = useState(false)
  const [touched, setTouched] = useState(false)

  const nights = nightsBetween(res.checkIn, res.checkOut)
  const quote = stayQuote(res.rate, nights)
  const expectedOutstanding = Math.max(quote.total - folio.totals.paid, 0)

  const candidates = useMemo(() => {
    const list = freeRooms(rooms, reservations, res.checkIn, res.checkOut, showUpgrades ? undefined : res.typeId, res.id)
    const order = { inspected: 0, clean: 1, dirty: 2, ooo: 3 }
    return list.sort((a, b) => order[a.hk] - order[b.hk] || a.number.localeCompare(b.number))
  }, [rooms, reservations, res, showUpgrades])

  const room = rooms.find((r) => r.id === roomId)
  const roomFree = candidates.some((r) => r.id === roomId)
  const type = roomTypeOf(res.typeId)

  const stepValid = [idType && idNumber.trim().length >= 4, !!room && roomFree, !!signature && policies][step]

  const next = () => {
    setTouched(true)
    if (!stepValid) return
    setTouched(false)
    if (step === 1 && !amount) setAmount(expectedOutstanding ? String(expectedOutstanding) : '0')
    setStep(step + 1)
  }

  const complete = () => {
    setTouched(true)
    if (!stepValid || !room) return
    const paid = Number(amount.replace(/[^\d]/g, '')) || 0
    const result = checkIn(resId, {
      roomId: room.id,
      idType,
      idNumber,
      idFile: idFile?.name,
      signature,
      payment: paid > 0 ? { method, amount: paid, ref: payRef || undefined } : undefined,
    })
    if (!result.ok) {
      toast.error('Check-in failed', result.error)
      return
    }
    toast.success(`${g.firstName} ${g.lastName} checked in to Room ${room.number}`, `${res.adults > 1 ? '2 key cards' : '1 key card'} encoded · welcome message sent on WhatsApp (simulated)`)
    onDone?.()
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          Check in · {g.firstName} {g.lastName} {g.vip && <VipMark />}
        </span>
      }
      description={`${res.code} · ${type.name} · ${fmtDate(res.checkIn, 'EEE d MMM')} – ${fmtDate(res.checkOut, 'EEE d MMM')} · ${plural(nights, 'night')}`}
      footer={
        <>
          {step > 0 && (
            <Button className="mr-auto" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          {step < 2 ? (
            <Button variant="primary" onClick={next}>
              Continue
            </Button>
          ) : (
            <Button variant="primary" onClick={complete}>
              Complete check-in
            </Button>
          )}
        </>
      }
    >
      <ol className="mb-5 flex items-center gap-2 text-xs">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded-full text-[11px] font-semibold',
                i < step ? 'bg-brand text-white' : i === step ? 'border border-brand text-brand' : 'border border-line-strong text-ink-3',
              )}
            >
              {i < step ? <Check className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn(i === step ? 'font-medium text-ink' : 'text-ink-3')}>{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-8 bg-line-strong" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Phone">
                <Input value={g.phone} readOnly className="bg-sunken" />
              </Field>
              <Field label="Email">
                <Input value={g.email} readOnly className="bg-sunken" />
              </Field>
              <Field label="ID document">
                <Select value={idType} onChange={(e) => setIdType(e.target.value)}>
                  {ID_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="ID number" error={touched && idNumber.trim().length < 4 ? 'Enter the document number' : undefined}>
                <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="e.g. A12345678" />
              </Field>
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-ink-2">ID scan</span>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-line-strong bg-sunken px-3 py-3 hover:border-brand">
                {idFile ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={idFile.url} alt="" className="h-12 w-18 rounded border border-line object-cover" />
                ) : (
                  <span className="flex h-12 w-18 items-center justify-center rounded border border-line bg-surface text-ink-3">
                    <FileImage className="size-5" />
                  </span>
                )}
                <span className="min-w-0 text-[13px]">
                  <span className="block truncate font-medium text-ink">{idFile ? idFile.name : 'Upload or photograph ID'}</span>
                  <span className="text-xs text-ink-3">{idFile ? 'Stored encrypted against the guest profile' : 'JPG or PNG · uses the tablet camera on mobile'}</span>
                </span>
                <Upload className="ml-auto size-4 text-ink-3" />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setIdFile({ name: f.name, url: URL.createObjectURL(f) })
                  }}
                />
              </label>
            </div>
          </div>
          <aside className="space-y-3 rounded-lg border border-line bg-sunken p-3.5 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-ink-3">Source</span>
              <SourceLabel source={res.source} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-3">Guests</span>
              <span>
                {plural(res.adults, 'adult')}
                {res.children ? `, ${plural(res.children, 'child', 'children')}` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-3">Previous stays</span>
              <span>{g.stays}</span>
            </div>
            {g.company && (
              <div className="flex items-center justify-between">
                <span className="text-ink-3">Company</span>
                <span>{g.company}</span>
              </div>
            )}
            {(g.preferences.length > 0 || res.notes) && (
              <div className="border-t border-line pt-3">
                <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Preferences & notes</div>
                <ul className="space-y-1 text-[12.5px] text-ink-2">
                  {g.preferences.map((p) => (
                    <li key={p}>· {p}</li>
                  ))}
                  {res.notes && <li className="text-brass">· {res.notes}</li>}
                </ul>
              </div>
            )}
          </aside>
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] text-ink-2">
              Free rooms for the whole stay{showUpgrades ? '' : ` · ${type.name}`}. Rooms that are clean and inspected are listed first.
            </p>
            <label className="flex items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" checked={showUpgrades} onChange={(e) => setShowUpgrades(e.target.checked)} className="accent-brand" />
              Show upgrades
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {candidates.map((r) => {
              const rt = ROOM_TYPES.find((t) => t.id === r.typeId)!
              const selected = r.id === roomId
              return (
                <button
                  key={r.id}
                  onClick={() => setRoomId(r.id)}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-left transition-colors',
                    selected ? 'border-brand bg-brand-soft ring-1 ring-brand' : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-semibold">{r.number}</span>
                    {r.typeId !== res.typeId && <Badge tone="brass">Upgrade</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-3">
                    {rt.name} · Floor {r.floor}
                  </div>
                  <div className="mt-2">
                    {r.hk === 'inspected' ? (
                      <Badge tone="brand" dot>Inspected</Badge>
                    ) : r.hk === 'clean' ? (
                      <Badge tone="ok" dot>Clean</Badge>
                    ) : (
                      <Badge tone="warn" dot>Being cleaned</Badge>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          {room && roomFree && !isReady(room) && (
            <div className="mt-3 flex gap-2 rounded-md border border-warn/25 bg-warn-soft px-3 py-2.5 text-[13px] text-warn">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Room {room.number} hasn&apos;t been released by housekeeping yet. You can still check the guest in. Their key will work once the room is marked clean.
              </span>
            </div>
          )}
          {touched && !roomFree && <p className="mt-2 text-xs text-danger">Select a room.</p>}
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[13px] font-semibold">Stay charges</h3>
            <dl className="space-y-1.5 rounded-lg border border-line bg-sunken p-3.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ink-2">
                  Room {room?.number} · {naira(res.rate)} × {nights}
                </dt>
                <dd className="num">{naira(quote.net)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Service charge and VAT</dt>
                <dd className="num">{naira(quote.service + quote.vat)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>Stay total</dt>
                <dd className="num">{naira(quote.total)}</dd>
              </div>
              <div className="flex justify-between text-ok">
                <dt>Already paid</dt>
                <dd className="num">{naira(-folio.totals.paid)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 font-semibold">
                <dt>Expected balance</dt>
                <dd className="num">{naira(expectedOutstanding)}</dd>
              </div>
            </dl>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Collect now" hint="Deposit or full prepayment">
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="Method">
                <Select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
                  {(['Card', 'Cash', 'Bank transfer', 'Mobile money'] as PayMethod[]).map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
              {method !== 'Cash' && (
                <Field label="Reference" className="col-span-2">
                  <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="POS approval code or transfer reference" />
                </Field>
              )}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-[13px] font-semibold">Registration card</h3>
            <SignaturePad onChange={setSignature} />
            {touched && !signature && <p className="-mt-4 mb-2 text-xs text-danger">Guest signature required.</p>}
            <label className="mt-2 flex items-start gap-2 text-[12.5px] text-ink-2">
              <input type="checkbox" checked={policies} onChange={(e) => setPolicies(e.target.checked)} className="mt-0.5 accent-brand" />
              <span>
                Guest accepts hotel policies: check-out by {HOTEL.checkOutTime}, no smoking in rooms, and incidental charges settled on departure.
              </span>
            </label>
            {touched && !policies && <p className="mt-1 text-xs text-danger">Confirm the guest has accepted the policies.</p>}
          </div>
        </div>
      )}
    </Modal>
  )
}
