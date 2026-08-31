'use client'

import { clsx } from 'clsx'
import Card from './Card'

interface SectionProps {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  padding?: 'sm' | 'md' | 'lg' | 'none'
  children: React.ReactNode
  className?: string
}

export default function Section({
  title,
  description,
  action,
  icon,
  padding = 'lg',
  children,
  className,
}: SectionProps) {
  return (
    <Card padding={padding} className={clsx('min-w-0', className)}>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-2.5 min-w-0">
          {icon && <span className="text-app-accent mt-0.5 flex-shrink-0">{icon}</span>}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-app-text">{title}</h3>
            {description && (
              <p className="text-xs text-app-text-dim mt-1 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {children}
    </Card>
  )
}

interface SectionCardProps {
  title: string
  count?: number
  children: React.ReactNode
  className?: string
}

export function SectionCard({ title, count, children, className }: SectionCardProps) {
  return (
    <Card padding="none" className={clsx('min-w-0 overflow-hidden', className)}>
      <div className="px-5 py-4 border-b border-app-border">
        <h3 className="text-sm font-semibold text-app-text">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-xs font-normal text-app-text-dim">({count})</span>
          )}
        </h3>
      </div>
      {children}
    </Card>
  )
}
