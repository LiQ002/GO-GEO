'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store/useAppStore'

/** Subscribes to main-process publish progress events and updates the global store. */
export function PublishProgressListener() {
  const setPublishing = useAppStore((state) => state.setPublishing)
  const updatePublishingProgress = useAppStore((state) => state.updatePublishingProgress)
  const trackPublishingJob = useAppStore((state) => state.trackPublishingJob)
  const addToast = useAppStore((state) => state.addToast)

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onPublishProgress?.((event) => {
      if (event.jobId) trackPublishingJob(event)
      if (event.type === 'start') {
        if (!event.jobId) setPublishing(true, event.total ?? 1, event.done ?? 0)
        return
      }
      if (event.type === 'progress') {
        if (!event.jobId) setPublishing(true, event.total ?? 1, event.done ?? 0)
        return
      }
      if (event.type === 'complete') {
        if (!event.jobId) updatePublishingProgress(event.total ?? 1)
        addToast('success', `${event.platformName} 发布完成`)
        return
      }
      if (event.type === 'error') {
        if (!event.jobId) setPublishing(false)
        addToast('error', event.message ?? `${event.platformName} 发布失败`)
      }
    })

    return () => {
      unsubscribe?.()
    }
  }, [setPublishing, updatePublishingProgress, trackPublishingJob, addToast])

  return null
}
