'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Header from './Header'
import { PublishProgressListener } from './PublishProgressListener'
import type { AppMode } from '@/types/app'

interface AppLayoutProps {
  mode: AppMode
  children: React.ReactNode
}

export default function AppLayout({ mode, children }: AppLayoutProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen flex-col bg-[#f4f6fb] text-slate-900 overflow-hidden">
      <PublishProgressListener />
      <div className="drag-region h-2.5 shrink-0" aria-hidden />
      <div className="flex min-h-0 flex-1 gap-2.5 px-2.5 pb-2.5">
        <Sidebar mode={mode} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <Header pathname={pathname} mode={mode} />
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#fafbfd]">
            <div className="mx-auto w-full min-w-0 max-w-6xl px-6 py-6 lg:px-8 lg:py-7">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
