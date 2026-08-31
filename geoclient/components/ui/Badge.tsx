'use client'

import { clsx } from 'clsx'
import type { TaskStatus, ArticleStatus } from '@/types/app'

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'default' | 'accent'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  dot?: boolean
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-app-success/15 text-app-success border-app-success/20',
  error: 'bg-app-danger/15 text-app-danger border-app-danger/20',
  warning: 'bg-app-warning/15 text-app-warning border-app-warning/20',
  info: 'bg-app-info/15 text-app-info border-app-info/20',
  accent: 'bg-blue-50 text-app-accent border-blue-100',
  default: 'bg-app-elevated text-app-text-muted border-app-border',
}

const dotClasses: Record<BadgeVariant, string> = {
  success: 'bg-app-success',
  error: 'bg-app-danger',
  warning: 'bg-app-warning',
  info: 'bg-app-info',
  accent: 'bg-app-accent',
  default: 'bg-app-text-dim',
}

export default function Badge({ variant = 'default', children, dot, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap',
        variantClasses[variant],
        className,
      )}
    >
      {dot && (
        <span className={clsx('w-1.5 h-1.5 rounded-full', dotClasses[variant])} />
      )}
      {children}
    </span>
  )
}

export function TaskStatusBadge({ status, taskType }: { status: TaskStatus; taskType?: 'publish' | 'geo' }) {
  const map: Record<TaskStatus, { variant: BadgeVariant; label: string }> = {
    pending: { variant: 'default', label: taskType === 'geo' ? '待检测' : '待发布' },
    publishing: { variant: 'info', label: taskType === 'geo' ? '检测中' : '发布中' },
    success: { variant: 'success', label: taskType === 'geo' ? '已完成' : '已成功' },
    failed: { variant: 'error', label: '已失败' },
  }
  const { variant, label } = map[status]
  return <Badge variant={variant} dot>{label}</Badge>
}

export function ArticleStatusBadge({ status }: { status: ArticleStatus }) {
  const map: Record<ArticleStatus, { variant: BadgeVariant; label: string }> = {
    pending_review: { variant: 'warning', label: '待审核' },
    normal: { variant: 'info', label: '待发布' },
    published: { variant: 'success', label: '已发布' },
    disabled: { variant: 'error', label: '已禁用' },
    archived: { variant: 'default', label: '已归档' },
    partial: { variant: 'warning', label: '部分发布' },
    failed: { variant: 'error', label: '发布失败' },
  }
  const { variant, label } = map[status]
  return <Badge variant={variant} dot>{label}</Badge>
}
