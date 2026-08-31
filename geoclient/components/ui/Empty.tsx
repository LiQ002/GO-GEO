'use client'

import { Inbox } from 'lucide-react'

interface EmptyProps {
  title?: string
  description?: string
  action?: React.ReactNode
}

export default function Empty({
  title = '暂无数据',
  description,
  action,
}: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-app-elevated flex items-center justify-center">
        <Inbox size={24} className="text-app-text-dim" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-app-text-muted">{title}</p>
        {description && <p className="text-xs text-app-text-dim mt-1">{description}</p>}
      </div>
      {action}
    </div>
  )
}
