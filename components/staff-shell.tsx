'use client'

import {
  ArrowUpRight,
  BarChart3,
  BedDouble,
  CalendarRange,
  ConciergeBell,
  LayoutGrid,
  LogOut,
  Menu,
  RotateCcw,
  ScrollText,
  ShieldAlert,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { HOTEL, ROLE_HOME, ROLE_LABEL, ROUTE_ACCESS } from '@/lib/config'
import { fmtDate } from '@/lib/dates'
import { useCurrentUser } from '@/lib/hooks'
import { toast, useHotel, useSession } from '@/lib/store'
import type { Role } from '@/lib/types'
import { Modal } from './modal'
import { Avatar, Badge, Button, cn } from './ui'

const NAV: { group: string; items: { href: string; label: string; icon: typeof LayoutGrid }[] }[] = [
  {
    group: 'Operations',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
      { href: '/front-desk', label: 'Front desk', icon: ConciergeBell },
      { href: '/reservations', label: 'Reservations', icon: CalendarRange },
      { href: '/housekeeping', label: 'Housekeeping', icon: BedDouble },
      { href: '/pos', label: 'Restaurant & bar', icon: UtensilsCrossed },
    ],
  },
  {
    group: 'Management',
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3 },
      { href: '/audit', label: 'Audit log', icon: ScrollText },
    ],
  },
]

const canAccess = (role: Role, path: string) => {
  const key = Object.keys(ROUTE_ACCESS).find((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  return key ? ROUTE_ACCESS[key].includes(role) : true
}

export function StaffShell({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!user) router.replace('/login')
  }, [user, router])

  useEffect(() => setMobileOpen(false), [pathname])

  if (!user) return null
  const allowed = canAccess(user.role, pathname)

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 border-r border-line bg-surface lg:block">
        <Sidebar role={user.role} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] bg-surface shadow-xl">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-3 rounded p-1 text-ink-3" aria-label="Close menu">
              <X className="size-4" />
            </button>
            <Sidebar role={user.role} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {allowed ? (
            children
          ) : (
            <div className="mx-auto mt-16 max-w-md rounded-card border border-line bg-surface p-8 text-center">
              <ShieldAlert className="mx-auto size-6 text-ink-3" />
              <h1 className="mt-3 text-[15px] font-semibold">Not available for your role</h1>
              <p className="mt-1 text-[13px] text-ink-2">
                {ROLE_LABEL[user.role]} staff don&apos;t have access to this screen. Access is set per role by the general manager.
              </p>
              <Link href={ROLE_HOME[user.role]} className="mt-5 inline-block">
                <Button variant="primary">Go to my workspace</Button>
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useCurrentUser()!
  const logout = useSession((s) => s.logout)
  const reset = useHotel((s) => s.reset)
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-6">
        <span className="flex size-8 items-center justify-center rounded-md bg-brand font-serif text-[15px] text-[#e9d9b8] italic">
          {HOTEL.codePrefix}
        </span>
        <div className="min-w-0 leading-tight">
          <div className="truncate font-serif text-[16px] text-ink">{HOTEL.shortName}</div>
          <div className="text-[11px] text-ink-3">Property management</div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3">
        {NAV.map((group) => {
          const items = group.items.filter((i) => canAccess(role, i.href))
          if (!items.length) return null
          return (
            <div key={group.group}>
              <div className="px-2 pb-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{group.group}</div>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === '/front-desk' && pathname.startsWith('/folio'))
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors',
                          active ? 'bg-brand-soft font-medium text-brand' : 'text-ink-2 hover:bg-black/[0.035] hover:text-ink',
                        )}
                      >
                        <item.icon className="size-4" strokeWidth={active ? 2.2 : 1.8} />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}

        {(role === 'manager' || role === 'frontdesk') && (
          <div>
            <div className="px-2 pb-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Guest-facing</div>
            <a href="/book" target="_blank" className="flex h-8 items-center justify-between rounded-md px-2 text-[13px] text-ink-2 hover:bg-black/[0.035] hover:text-ink">
              <span>Booking website</span>
              <ArrowUpRight className="size-3.5 text-ink-3" />
            </a>
          </div>
        )}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <Avatar initials={user.initials} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-medium">{user.name}</div>
            <div className="truncate text-[11px] text-ink-3">{user.title}</div>
          </div>
          <button
            onClick={() => {
              logout()
              router.push('/login')
            }}
            title="Switch user"
            className="rounded p-1.5 text-ink-3 hover:bg-black/[0.04] hover:text-ink"
          >
            <LogOut className="size-4" />
          </button>
        </div>
        <button onClick={() => setConfirmReset(true)} className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink-3 hover:bg-black/[0.035] hover:text-ink-2">
          <RotateCcw className="size-3.5" />
          Reset demo data
        </button>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        size="sm"
        title="Reset demo data?"
        description="Restores every room, booking, bill and log entry to the starting state. Use it between rehearsals."
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>Keep current data</Button>
            <Button
              variant="primary"
              onClick={() => {
                reset()
                setConfirmReset(false)
                toast.success('Demo data reset', 'All screens are back to the starting state.')
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-2">Other open tabs pick up the reset automatically.</p>
      </Modal>
    </div>
  )
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const businessDate = useHotel((s) => s.businessDate)
  const auditDone = useHotel((s) => s.nightAuditDone)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="no-print sticky top-0 z-30 flex h-13 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button onClick={onMenu} className="-ml-1 rounded p-1.5 text-ink-2 lg:hidden" aria-label="Open menu">
        <Menu className="size-5" />
      </button>
      <div className="flex min-w-0 items-baseline gap-2 text-[13px]">
        <span className="font-medium text-ink">{fmtDate(businessDate, 'EEEE d MMMM yyyy')}</span>
        <span className="num hidden text-ink-3 sm:inline">
          {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden text-xs text-ink-3 md:inline">Night audit</span>
        <Badge tone={auditDone ? 'ok' : 'neutral'} dot className="hidden md:inline-flex">
          {auditDone ? 'Closed' : 'Open'}
        </Badge>
        <span className="mx-1 hidden h-4 w-px bg-line-strong md:block" />
        <Badge tone="brass">Prototype · sample data</Badge>
      </div>
    </header>
  )
}
