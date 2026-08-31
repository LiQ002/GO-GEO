'use client'

import { Minus, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    void api.window.isMaximized().then((maximized) => {
      setIsElectron(true)
      setIsMaximized(maximized)
    })
  }, [])

  if (!isElectron) {
    return null
  }

  const handleMinimize = () => window.electronAPI?.window.minimize()
  const handleMaximize = async () => {
    await window.electronAPI?.window.maximize()
    const maximized = await window.electronAPI?.window.isMaximized()
    setIsMaximized(maximized ?? false)
  }
  const handleClose = () => window.electronAPI?.window.close()

  return (
    <div className="no-drag flex items-center gap-1">
      <button
        onClick={handleMinimize}
        title="最小化"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        <Minus size={15} strokeWidth={2} />
      </button>
      <button
        onClick={handleMaximize}
        title={isMaximized ? '还原' : '最大化'}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        <Square size={12} strokeWidth={2} />
      </button>
      <button
        onClick={handleClose}
        title="关闭"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-500 hover:text-white"
      >
        <X size={15} strokeWidth={2} />
      </button>
    </div>
  )
}
