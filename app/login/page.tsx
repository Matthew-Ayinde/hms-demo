'use client'

import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { Avatar } from '@/components/ui'
import { occupiedOn } from '@/lib/availability'
import { HOTEL, ROLE_HOME, USERS } from '@/lib/config'
import { fmtDate } from '@/lib/dates'
import { useHotel, useSession } from '@/lib/store'
import type { Role } from '@/lib/types'

const ROLE_SCOPE: Record<Role, string> = {
  manager: 'Everything, including reports, audit log and approvals',
  frontdesk: 'Reservations, check-in and check-out, guest bills',
  housekeeping: 'Room-status board and cleaning tasks (phone view)',
  restaurant: 'Restaurant and bar till, post to room',
}

export default function LoginPage() {
  const router = useRouter()
  const login = useSession((s) => s.login)
  const businessDate = useHotel((s) => s.businessDate)
  const reservations = useHotel((s) => s.reservations)
  const rooms = useHotel((s) => s.rooms)

  const stats = useMemo(() => {
    const sellable = rooms.filter((r) => r.hk !== 'ooo').length
    const occupied = occupiedOn(reservations, businessDate)
    return {
      occupancy: Math.round((occupied / sellable) * 100),
      arrivals: reservations.filter((r) => r.checkIn === businessDate && r.status === 'confirmed').length,
      departures: reservations.filter((r) => r.checkOut === businessDate && r.status === 'checked_in').length,
    }
  }, [rooms, reservations, businessDate])

  const signIn = (id: string, role: Role) => {
    login(id)
    router.push(ROLE_HOME[role])
  }

  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-brand p-10 text-[#efe7d8] lg:flex">
        <svg className="pointer-events-none absolute -right-24 -bottom-24 size-[520px] opacity-[0.07]" viewBox="0 0 200 200" aria-hidden>
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={i} cx="100" cy="100" r={20 + i * 10} fill="none" stroke="#efe7d8" strokeWidth="0.8" />
          ))}
        </svg>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md border border-[#efe7d8]/30 font-serif text-lg italic">{HOTEL.codePrefix}</span>
          <div className="leading-tight">
            <div className="font-serif text-xl">{HOTEL.name}</div>
            <div className="text-xs text-[#efe7d8]/60">{HOTEL.tagline}</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="font-serif text-[34px] leading-[1.15]">One system for every desk in the hotel.</p>
          <p className="mt-4 text-[13.5px] leading-relaxed text-[#efe7d8]/70">
            Reservations, front desk, housekeeping, billing and the restaurant share one live record. A change made at one desk shows up at the others straight away.
          </p>
        </div>

        <dl className="relative grid max-w-md grid-cols-3 gap-6 border-t border-[#efe7d8]/15 pt-6">
          <div>
            <dt className="text-[11px] tracking-wide text-[#efe7d8]/55 uppercase">Occupancy tonight</dt>
            <dd className="mt-1 text-2xl font-medium">{stats.occupancy}%</dd>
          </div>
          <div>
            <dt className="text-[11px] tracking-wide text-[#efe7d8]/55 uppercase">Arrivals</dt>
            <dd className="mt-1 text-2xl font-medium">{stats.arrivals}</dd>
          </div>
          <div>
            <dt className="text-[11px] tracking-wide text-[#efe7d8]/55 uppercase">Departures</dt>
            <dd className="mt-1 text-2xl font-medium">{stats.departures}</dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="mb-8 lg:hidden">
            <div className="font-serif text-2xl text-brand">{HOTEL.name}</div>
            <div className="text-xs text-ink-3">{HOTEL.tagline}</div>
          </div>
          <p className="text-xs font-medium tracking-wide text-ink-3 uppercase">Business date · {fmtDate(businessDate, 'EEE d MMM yyyy')}</p>
          <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.01em]">Sign in to your workspace</h1>
          <p className="mt-1.5 text-[13px] text-ink-2">Choose a staff profile. Each role sees only the screens it is allowed to use.</p>

          <ul className="mt-7 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {USERS.map((u) => (
              <li key={u.id}>
                <button onClick={() => signIn(u.id, u.role)} className="group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-sunken">
                  <Avatar initials={u.initials} size="lg" tone={u.role === 'manager' ? 'brass' : 'brand'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[14px] font-medium">{u.name}</span>
                      <span className="text-xs text-ink-3">{u.title}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-ink-2">{ROLE_SCOPE[u.role]}</div>
                  </div>
                  <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between text-xs text-ink-3">
            <span>Prototype · no passwords · sample data</span>
            <a href="/book" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
              Guest booking site <ArrowUpRight className="size-3.5" />
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
