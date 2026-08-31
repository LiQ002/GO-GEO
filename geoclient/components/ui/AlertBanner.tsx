'use client'

import { clsx } from 'clsx'

type AlertBannerVariant = 'info' | 'success' | 'warning'

interface AlertBannerProps {
  title: string
  description?: string
  variant?: AlertBannerVariant
  className?: string
}

const variantClasses: Record<AlertBannerVariant, string> = {
  info: 'bg-app-accent-subtle border-app-accent/20',
  success: 'bg-app-success-subtle border-app-success/20',
  warning: 'bg-app-warning-subtle border-app-warning/20',
}

export default function AlertBanner({
  title,
  description,
  variant = 'info',
  className,
}: AlertBannerProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl border px-7 py-6 shadow-(--shadow-card)',
        variantClasses[variant],
        className,
      )}
    >
      <h2 className="text-sm font-medium text-app-text-muted leading-relaxed">{title}</h2>
      {description && (
        <p className="text-2xl font-semibold text-app-text mt-2 tracking-tight leading-tight">{description}</p>
      )}
    </div>
  )
}
