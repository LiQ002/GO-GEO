'use client'

import { clsx } from 'clsx'

interface TagProps {
  children: React.ReactNode
  className?: string
}

export default function Tag({ children, className }: TagProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md',
        'bg-app-elevated border border-app-border text-app-text-muted',
        className,
      )}
    >
      {children}
    </span>
  )
}
