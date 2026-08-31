'use client'

import { AlertCircle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useAppStore } from '@/lib/store/useAppStore'
import { clsx } from 'clsx'

const icons = {
  success: <CheckCircle2 size={16} className="text-app-success" />,
  error: <XCircle size={16} className="text-app-danger" />,
  warning: <AlertCircle size={16} className="text-app-warning" />,
  info: <Info size={16} className="text-app-info" />,
}

const borderColors = {
  success: 'border-l-app-success',
  error: 'border-l-app-danger',
  warning: 'border-l-app-warning',
  info: 'border-l-app-info',
}

export default function ToastContainer() {
  const toasts = useAppStore((state) => state.toasts)
  const removeToast = useAppStore((state) => state.removeToast)

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 min-w-72 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            'flex items-start gap-3 px-4 py-3 bg-white border border-app-border rounded-xl shadow-lg',
            'border-l-4',
            borderColors[toast.type],
            'animate-in slide-in-from-right-4 duration-200',
          )}
        >
          <span className="mt-0.5 flex-shrink-0">{icons[toast.type]}</span>
          <p className="flex-1 text-sm text-app-text leading-relaxed">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 text-app-text-dim hover:text-app-text transition-colors mt-0.5"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
