'use client'

import { clsx } from 'clsx'

interface ProgressBarProps {
  value: number
  color?: string
  className?: string
  animated?: boolean
}

export default function ProgressBar({ value, color, className, animated }: ProgressBarProps) {
  return (
    <div className={clsx('h-2 bg-app-elevated rounded-full overflow-hidden', className)}>
      <div
        className={clsx('h-full rounded-full transition-all duration-500', animated && 'animate-pulse')}
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: color ?? 'var(--color-app-accent)',
        }}
      />
    </div>
  )
}

interface PlatformProgressItemProps {
  label: string
  count: number
  max: number
  color?: string
  suffix?: string
}

export function PlatformProgressItem({
  label,
  count,
  max,
  color,
  suffix = '',
}: PlatformProgressItemProps) {
  const pct = max > 0 ? (count / max) * 100 : 0

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-4 mb-2">
        <span className="text-sm text-app-text-muted flex-shrink-0 min-w-[5rem] truncate">
          {label}
        </span>
        <span className="text-sm font-medium text-app-text flex-shrink-0 tabular-nums">
          {count}{suffix}
        </span>
      </div>
      <ProgressBar value={pct} color={color} />
    </div>
  )
}
