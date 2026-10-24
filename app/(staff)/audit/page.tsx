'use client'

import { Download, Lock, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar, Badge, Button, EmptyState, Input, PageHeader, Panel, Select, Table, Td, Th, type Tone } from '@/components/ui'
import { USERS, actorName } from '@/lib/config'
import { downloadCsv } from '@/lib/csv'
import { fmtDateTime } from '@/lib/dates'
import { useHotel } from '@/lib/store'
import type { Module } from '@/lib/types'

const MODULE_TONE: Record<Module, Tone> = {
  Reservations: 'info',
  'Front desk': 'brand',
  Billing: 'brass',
  POS: 'warn',
  Housekeeping: 'ok',
  Maintenance: 'danger',
  Guests: 'info',
  Rates: 'brass',
  Settings: 'neutral',
  System: 'neutral',
}

export default function AuditPage() {
  const audit = useHotel((s) => s.audit)
  const [query, setQuery] = useState('')
  const [module, setModule] = useState<'all' | Module>('all')
  const [userId, setUserId] = useState('all')

  const actors = useMemo(() => Array.from(new Set(audit.map((a) => a.userId))), [audit])
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return audit.filter(
      (a) =>
        (module === 'all' || a.module === module) &&
        (userId === 'all' || a.userId === userId) &&
        (!q || `${a.action} ${a.detail} ${a.ref ?? ''} ${actorName(a.userId)}`.toLowerCase().includes(q)),
    )
  }, [audit, query, module, userId])

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every booking, payment, void and status change, with the person who made it and when."
        actions={
          <Button
            onClick={() =>
              downloadCsv(
                'audit-log.csv',
                ['Time', 'User', 'Module', 'Action', 'Detail', 'Reference'],
                rows.map((a) => [a.at, actorName(a.userId), a.module, a.action, a.detail, a.ref ?? '']),
              )
            }
          >
            <Download className="size-3.5" /> Export
          </Button>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search actions, guests, references" className="w-72 pl-8" />
          </div>
          <Select value={module} onChange={(e) => setModule(e.target.value as 'all' | Module)} className="w-40">
            <option value="all">All modules</option>
            {(Object.keys(MODULE_TONE) as Module[]).map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
          <Select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-48">
            <option value="all">All staff</option>
            {actors.map((id) => (
              <option key={id} value={id}>
                {actorName(id)}
              </option>
            ))}
          </Select>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-3">
            <Lock className="size-3" /> {rows.length} entries · entries can&apos;t be edited or deleted
          </span>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Time</Th>
              <Th>Staff</Th>
              <Th>Module</Th>
              <Th>Action</Th>
              <Th>Detail</Th>
              <Th>Ref.</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const u = USERS.find((x) => x.id === a.userId)
              return (
                <tr key={a.id} className="hover:bg-sunken/60">
                  <Td className="num whitespace-nowrap text-ink-2">{fmtDateTime(a.at)}</Td>
                  <Td>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <Avatar initials={u?.initials ?? 'SY'} size="sm" tone={u ? 'brand' : 'neutral'} />
                      {actorName(a.userId)}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={MODULE_TONE[a.module]}>{a.module}</Badge>
                  </Td>
                  <Td className="font-medium whitespace-nowrap">{a.action}</Td>
                  <Td className="min-w-[320px] text-ink-2">{a.detail}</Td>
                  <Td className="num text-xs whitespace-nowrap text-ink-3">{a.ref ?? '—'}</Td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <Td colSpan={6}>
                  <EmptyState title="No entries match these filters" />
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Panel>
    </div>
  )
}
