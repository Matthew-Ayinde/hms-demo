'use client'

import { Check, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar, Badge, Button, Field, Input, PageHeader, Panel, Table, Tabs, Td, Th, cn } from '@/components/ui'
import { HOTEL, ROLE_LABEL, SCREEN_LABELS, USERS, type HotelSettings } from '@/lib/config'
import { fmtDateTime } from '@/lib/dates'
import { toast, useHotel } from '@/lib/store'
import type { Role } from '@/lib/types'

type Tab = 'property' | 'roles' | 'approvals'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('property')
  return (
    <div>
      <PageHeader title="Settings" description="Property details, who can see what, and which actions need a manager's approval. Every change is logged." />
      <Panel>
        <Tabs
          value={tab}
          onChange={setTab}
          className="px-2"
          items={[
            { value: 'property', label: 'Property' },
            { value: 'roles', label: 'Roles & permissions' },
            { value: 'approvals', label: 'Approvals' },
          ]}
        />
        {tab === 'property' && <Property />}
        {tab === 'roles' && <Roles />}
        {tab === 'approvals' && <Approvals />}
      </Panel>
    </div>
  )
}

const PROPERTY_FIELDS: { key: keyof HotelSettings; label: string; hint?: string; wide?: boolean }[] = [
  { key: 'name', label: 'Hotel name', hint: 'Shown on invoices, the booking website and emails' },
  { key: 'shortName', label: 'Short name', hint: 'Used in the staff sidebar' },
  { key: 'tagline', label: 'Location line' },
  { key: 'address', label: 'Address', wide: true },
  { key: 'phone', label: 'Reservations phone' },
  { key: 'email', label: 'Reservations email' },
  { key: 'website', label: 'Website' },
  { key: 'tin', label: 'Tax ID (TIN)', hint: 'Printed on tax invoices' },
  { key: 'rcNumber', label: 'CAC registration number' },
  { key: 'checkInTime', label: 'Check-in from' },
  { key: 'checkOutTime', label: 'Check-out by' },
]

function Property() {
  const settings = useHotel((s) => s.settings)
  const updateSettings = useHotel((s) => s.updateSettings)
  const initial = useMemo(() => Object.fromEntries(PROPERTY_FIELDS.map((f) => [f.key, String(HOTEL[f.key])])) as Record<keyof HotelSettings, string>, [settings]) // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState(initial)
  const changed = PROPERTY_FIELDS.filter((f) => form[f.key].trim() !== initial[f.key])

  return (
    <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <div className="grid gap-3 sm:grid-cols-2">
          {PROPERTY_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint} className={f.wide ? 'sm:col-span-2' : ''}>
              <Input value={form[f.key]} type={f.key.endsWith('Time') ? 'time' : 'text'} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            </Field>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button
            variant="primary"
            disabled={!changed.length || !form.name.trim()}
            onClick={() => {
              updateSettings(Object.fromEntries(changed.map((f) => [f.key, form[f.key].trim()])))
              toast.success('Property settings saved', 'Invoices, the booking website and staff screens now use the new details.')
            }}
          >
            Save changes
          </Button>
          {changed.length > 0 && (
            <Button variant="ghost" onClick={() => setForm(initial)}>
              Discard
            </Button>
          )}
        </div>
      </div>
      <aside className="h-fit space-y-4">
        <div className="rounded-lg border border-line p-4">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Lock className="size-3.5 text-ink-3" /> Taxes and charges
          </h3>
          <dl className="mt-2 space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-ink-2">Service charge</dt>
              <dd>{HOTEL.serviceRate * 100}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">VAT (on room + service)</dt>
              <dd>{HOTEL.vatRate * 100}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Currency</dt>
              <dd>Naira (₦)</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-3">Tax rates are locked after go-live. Changing them mid-year needs the accountant&apos;s sign-off, so it&apos;s done by the support team.</p>
        </div>
        <div className="rounded-lg border border-line p-4">
          <h3 className="text-[13px] font-semibold">Invoice bank details</h3>
          <dl className="mt-2 space-y-1 text-[13px] text-ink-2">
            <div>{HOTEL.bank.name}</div>
            <div className="num">{HOTEL.bank.account}</div>
            <div>{HOTEL.bank.accountName}</div>
          </dl>
        </div>
      </aside>
    </div>
  )
}

const ROLES: Role[] = ['manager', 'frontdesk', 'housekeeping', 'restaurant']

function Roles() {
  const permissions = useHotel((s) => s.permissions)
  const audit = useHotel((s) => s.audit)
  const setPermission = useHotel((s) => s.setPermission)

  const lastSeen = (userId: string) => audit.find((a) => a.userId === userId)?.at

  return (
    <div>
      <Table>
        <thead>
          <tr>
            <Th>Screen</Th>
            {ROLES.map((r) => (
              <Th key={r} align="center">
                {ROLE_LABEL[r]}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.keys(SCREEN_LABELS).map((route) => (
            <tr key={route} className="hover:bg-sunken/60">
              <Td className="font-medium">{SCREEN_LABELS[route]}</Td>
              {ROLES.map((role) => {
                const allowed = role === 'manager' || (permissions[route] ?? []).includes(role)
                return (
                  <Td key={role} align="center">
                    {role === 'manager' ? (
                      <Check className="mx-auto size-4 text-ink-3" aria-label="Always allowed" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={allowed}
                        aria-label={`${ROLE_LABEL[role]} can open ${SCREEN_LABELS[route]}`}
                        onChange={(e) => {
                          setPermission(route, role, e.target.checked)
                          toast.success(e.target.checked ? 'Access granted' : 'Access removed', `${ROLE_LABEL[role]} · ${SCREEN_LABELS[route]}. Applies on their next click.`)
                        }}
                        className="size-4 accent-brand"
                      />
                    )}
                  </Td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="px-4 py-3 text-xs text-ink-3">Managers always have full access. Unticking a screen hides it from that role&apos;s menu and blocks the page.</p>

      <div className="border-t border-line">
        <div className="px-4 py-3">
          <h3 className="text-[13px] font-semibold">Staff accounts</h3>
          <p className="text-xs text-ink-3">In the live system each person signs in with their own password and a code from their phone.</p>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Two-factor sign-in</Th>
              <Th>Last activity</Th>
            </tr>
          </thead>
          <tbody>
            {USERS.map((u) => {
              const seen = lastSeen(u.id)
              return (
                <tr key={u.id}>
                  <Td>
                    <span className="flex items-center gap-2">
                      <Avatar initials={u.initials} size="sm" />
                      <span>
                        <span className="font-medium">{u.name}</span>
                        <span className="block text-xs text-ink-3">{u.title}</span>
                      </span>
                    </span>
                  </Td>
                  <Td>{ROLE_LABEL[u.role]}</Td>
                  <Td>{u.role === 'manager' || u.role === 'frontdesk' ? <Badge tone="ok" dot>Required</Badge> : <Badge>Optional</Badge>}</Td>
                  <Td className="text-ink-2">{seen ? fmtDateTime(seen) : '—'}</Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </div>
    </div>
  )
}

function Approvals() {
  const voidNeedsApproval = useHotel((s) => s.voidNeedsApproval)
  const setVoidApproval = useHotel((s) => s.setVoidApproval)
  const updateSettings = useHotel((s) => s.updateSettings)
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const pinValid = /^\d{4}$/.test(pin) && pin === confirm

  return (
    <div className="grid gap-5 p-4 lg:grid-cols-2">
      <div className="rounded-lg border border-line p-4">
        <h3 className="text-[13px] font-semibold">Approval rules</h3>
        <ul className="mt-3 divide-y divide-line">
          <Rule
            title="Voiding a charge needs a manager"
            body="Front desk staff must ask the duty manager to enter their PIN before a charge is removed from a guest bill."
            checked={voidNeedsApproval}
            onChange={(v) => {
              setVoidApproval(v)
              toast.success(v ? 'Voids now need approval' : 'Voids no longer need approval', 'Logged in the audit trail.')
            }}
          />
          <Rule title="Booking a blacklisted guest needs a manager" body="Front desk sees the reason and can't save the booking." checked locked />
          <Rule title="Checking out with a balance is blocked" body="The bill must be settled, or moved to a company account, before check-out." checked locked />
        </ul>
      </div>
      <div className="rounded-lg border border-line p-4">
        <h3 className="text-[13px] font-semibold">Manager PIN</h3>
        <p className="mt-1 text-xs text-ink-3">Used to approve voids at the front desk and restaurant. Four digits, never shared by email or WhatsApp.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="New PIN">
            <Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} className="tracking-[0.3em]" />
          </Field>
          <Field label="Repeat PIN" error={confirm && pin !== confirm ? "Doesn't match" : undefined}>
            <Input type="password" inputMode="numeric" maxLength={4} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="tracking-[0.3em]" />
          </Field>
        </div>
        <Button
          variant="primary"
          className="mt-3"
          disabled={!pinValid}
          onClick={() => {
            updateSettings({ managerPin: pin })
            setPin('')
            setConfirm('')
            toast.success('Manager PIN changed', 'The old PIN stops working straight away.')
          }}
        >
          Change PIN
        </Button>
      </div>
    </div>
  )
}

function Rule({ title, body, checked, onChange, locked }: { title: string; body: string; checked: boolean; onChange?: (v: boolean) => void; locked?: boolean }) {
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <button
        role="switch"
        aria-checked={checked}
        disabled={locked}
        onClick={() => onChange?.(!checked)}
        className={cn('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60', checked ? 'bg-brand' : 'bg-line-strong')}
      >
        <span className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      <div>
        <div className="flex items-center gap-1.5 text-[13px] font-medium">
          {title} {locked && <Lock className="size-3 text-ink-3" />}
        </div>
        <p className="text-xs text-ink-3">{body}</p>
      </div>
    </li>
  )
}
