'use client'

import { clsx } from 'clsx'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

const paddingClasses = {
  none: '',
  sm: 'p-5',
  md: 'p-6',
  lg: 'p-6',
}

export default function Card({ children, className, hover, padding = 'md' }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-app-card border border-app-border rounded-2xl shadow-(--shadow-card)',
        hover && 'hover:shadow-(--shadow-card-hover) hover:border-app-border-strong transition-all cursor-pointer',
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  )
}

type StatTone = 'accent' | 'success' | 'warning' | 'info'

interface StatCardProps {
  label: string
  value: string | number
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
  icon: React.ReactNode
  tone?: StatTone
}

const toneIconBg: Record<StatTone, string> = {
  accent: 'bg-app-accent-subtle',
  success: 'bg-app-success-subtle',
  warning: 'bg-app-warning-subtle',
  info: 'bg-app-info-subtle',
}

const toneIconColor: Record<StatTone, string> = {
  accent: 'text-app-accent',
  success: 'text-app-success',
  warning: 'text-app-warning',
  info: 'text-app-info',
}

export function StatCard({ label, value, change, changeType = 'neutral', icon, tone = 'accent' }: StatCardProps) {
  const changeColor =
    changeType === 'up' ? 'text-app-success' : changeType === 'down' ? 'text-app-danger' : 'text-app-text-dim'

  return (
    <Card padding="md" className="min-w-0 bg-app-info-subtle border-transparent">
      <div className="flex items-center gap-4">
        <div
          className={clsx(
            'w-1 h-8 rounded-full flex-shrink-0',
            tone === 'success'
              ? 'bg-app-success'
              : tone === 'warning'
                ? 'bg-app-warning'
                : tone === 'info'
                  ? 'bg-app-info'
                  : 'bg-app-accent',
          )}
        >
          <span className="sr-only">{label}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-app-text-dim leading-relaxed">{label}</p>
          <p className="text-[32px] font-semibold text-app-accent mt-2 tracking-tight tabular-nums leading-none">
            {value}
          </p>
          {change && (
            <p className={clsx('text-xs mt-2 leading-relaxed', changeColor)}>{change}</p>
          )}
        </div>
        <div
          className={clsx(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            toneIconBg[tone],
            toneIconColor[tone],
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>
    </Card>
  )
}
