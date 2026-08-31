'use client'

import { useEffect } from 'react'
import { refreshAuthSession } from '@/lib/api/core'

const ACTIVITY_CHECK_THROTTLE_MS = 30_000

/** Keeps an active desktop session alive without refreshing an idle session indefinitely. */
export function SessionRefreshListener() {
  useEffect(() => {
    let lastCheckAt = 0

    const checkSession = () => {
      if (document.hidden) return
      const now = Date.now()
      if (now - lastCheckAt < ACTIVITY_CHECK_THROTTLE_MS) return
      lastCheckAt = now
      void refreshAuthSession()
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) checkSession()
    }

    checkSession()
    document.addEventListener('pointerdown', checkSession, { passive: true })
    document.addEventListener('keydown', checkSession)
    document.addEventListener('touchstart', checkSession, { passive: true })
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', checkSession)

    return () => {
      document.removeEventListener('pointerdown', checkSession)
      document.removeEventListener('keydown', checkSession)
      document.removeEventListener('touchstart', checkSession)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', checkSession)
    }
  }, [])

  return null
}
