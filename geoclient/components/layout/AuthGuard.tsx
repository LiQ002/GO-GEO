'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAppStore } from '@/lib/store/useAppStore'
import { useStoreHydrated } from '@/lib/store/useStoreHydrated'
import { SessionRefreshListener } from './SessionRefreshListener'

const publicPaths = ['/login']

function AuthLoading() {
  return <div className="h-screen bg-[#f4f6fb]" />
}

/** Auth gate for both client and operator modes. */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const hydrated = useStoreHydrated()
  const isLoggedIn = useAppStore((s) => s.isLoggedIn)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!hydrated) return

    if (!isLoggedIn && !publicPaths.includes(pathname)) {
      router.replace('/login')
      return
    }

    if (isLoggedIn && pathname === '/login') {
      router.replace('/dashboard')
    }
  }, [hydrated, isLoggedIn, pathname, router])

  if (!hydrated) {
    return <AuthLoading />
  }

  if (!isLoggedIn && !publicPaths.includes(pathname)) {
    return <AuthLoading />
  }

  return (
    <>
      {isLoggedIn && <SessionRefreshListener />}
      {children}
    </>
  )
}
