'use client'

import { Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  text?: string
  fullScreen?: boolean
}

const sizeMap = { sm: 16, md: 24, lg: 36 }

export default function LoadingSpinner({
  size = 'md',
  className,
  text,
  fullScreen,
}: LoadingSpinnerProps) {
  const content = (
    <div className={clsx('flex flex-col items-center gap-3', className)}>
      <Loader2 size={sizeMap[size]} className="animate-spin text-app-accent" />
      {text && <p className="text-sm text-app-text-muted">{text}</p>}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-app-bg/80 backdrop-blur-sm z-50">
        {content}
      </div>
    )
  }

  return content
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-48">
      <LoadingSpinner size="md" text="加载中..." />
    </div>
  )
}
