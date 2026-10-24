'use client'

import { useEffect, useState } from 'react'
import { HOTEL } from '@/lib/config'
import { useHotel, useSession } from '@/lib/store'

/**
 * All demo data lives in the browser, so nothing date- or storage-dependent
 * renders on the server. This gate rehydrates the stores, reseeds when the
 * calendar day has changed, and keeps other open tabs in sync.
 */
export function StoreGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await useHotel.persist.rehydrate()
      await useSession.persist.rehydrate()
      useHotel.getState().ensureFresh()
      if (!cancelled) setReady(true)
    })()

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'hms-demo-data') useHotel.persist.rehydrate()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      cancelled = true
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center">
        <div className="text-center">
          <div className="font-serif text-2xl text-brand">{HOTEL.name}</div>
          <div className="mt-2 text-xs tracking-wide text-ink-3 uppercase animate-pulse-soft">Loading property data</div>
        </div>
      </div>
    )
  }
  return <>{children}</>
}
