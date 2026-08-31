'use client'

import { clsx } from 'clsx'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  children?: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-app-accent hover:bg-app-accent-dark text-white border-transparent shadow-sm shadow-app-accent/20',
  secondary:
    'bg-app-surface hover:bg-app-hover text-app-text border-app-border hover:border-app-border-strong',
  ghost:
    'bg-transparent hover:bg-app-hover text-app-text-muted hover:text-app-text border-transparent',
  danger:
    'bg-red-50 hover:bg-app-danger text-app-danger hover:text-white border-red-200 hover:border-app-danger',
  success:
    'bg-emerald-50 hover:bg-app-success text-app-success hover:text-white border-emerald-200 hover:border-app-success',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-lg border transition-all duration-150 cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 12 : 14} className="animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}
