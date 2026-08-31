'use client'

import { clsx } from 'clsx'
import { forwardRef } from 'react'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string
  error?: string
  prefix?: React.ReactNode
  suffix?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, prefix, suffix, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-sm font-medium text-app-text-muted">{label}</label>
        )}
        <div className="relative">
          {prefix && (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-app-text-dim">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            {...props}
            className={clsx(
              'w-full bg-app-surface border border-app-border rounded-xl text-sm text-app-text',
              'placeholder:text-app-text-dim',
              'focus:outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/15',
              'transition-colors py-3',
              prefix ? 'pl-11' : 'pl-4',
              suffix ? 'pr-11' : 'pr-4',
              error && 'border-app-danger focus:border-app-danger focus:ring-app-danger/15',
              className,
            )}
          />
          {suffix && (
            <span className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-app-text-dim">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-app-danger">{error}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'

export default Input

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export function Select({ label, error, options, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-medium text-app-text-muted">{label}</label>}
      <select
        {...props}
        className={clsx(
          'w-full bg-app-surface border border-app-border rounded-xl text-sm text-app-text',
          'px-4 py-3',
          'focus:outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/15',
          'transition-colors',
          error && 'border-app-danger',
          className,
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-app-danger">{error}</p>}
    </div>
  )
}
