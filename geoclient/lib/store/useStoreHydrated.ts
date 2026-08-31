'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store/useAppStore'

/** True only after zustand persist has finished rehydrating from localStorage. */
export function useStoreHydrated() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false

    const finishHydration = async () => {
      await useAppStore.getState().hydrateAuth()
      if (!cancelled) setHydrated(true)
    }

    const unsubscribe = useAppStore.persist?.hasHydrated()
      ? undefined
      : useAppStore.persist?.onFinishHydration(() => void finishHydration())

    if (useAppStore.persist?.hasHydrated()) void finishHydration()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  return hydrated
}
