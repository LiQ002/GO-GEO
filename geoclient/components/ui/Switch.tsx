'use client'

import { clsx } from 'clsx'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  description?: string
}

export default function Switch({
  checked,
  onChange,
  disabled,
  label,
  description,
}: SwitchProps) {
  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/30',
        checked ? 'bg-app-accent' : 'bg-app-border-strong',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={clsx(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-app-surface shadow-sm transition-transform mt-1',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  )

  if (!label) return toggle

  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <div className="min-w-0">
        <div className="text-sm font-medium text-app-text">{label}</div>
        {description && (
          <div className="text-xs text-app-text-dim mt-0.5 leading-relaxed">{description}</div>
        )}
      </div>
      {toggle}
    </label>
  )
}
