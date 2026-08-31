'use client'

import { clsx } from 'clsx'

interface PageShellProps {
  children: React.ReactNode
  className?: string
  narrow?: boolean
}

export default function PageShell({ children, className, narrow }: PageShellProps) {
  return (
    <div
      className={clsx(
        'w-full min-w-0 space-y-6',
        narrow && 'max-w-2xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
