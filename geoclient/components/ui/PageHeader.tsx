'use client'

import { clsx } from 'clsx'

interface PageHeaderProps {
  description?: string
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export default function PageHeader({
  description,
  actions,
  children,
  className,
}: PageHeaderProps) {
  if (!description && !actions && !children) return null

  return (
    <div className={clsx('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0 flex-1 space-y-1">
        {description && (
          <p className="text-sm text-app-text-muted leading-relaxed">{description}</p>
        )}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}
