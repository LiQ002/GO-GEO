import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/app'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import type { PublishProgressEvent } from '@/lib/ipc-contract'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

interface AppState {
  // Auth
  token: string | null
  refreshToken: string | null
  currentUser: User | null
  isLoggedIn: boolean

  // Publishing
  isPublishing: boolean
  publishingTotal: number
  publishingDone: number
  publishingJobs: Record<string, { done: number; total: number }>

  // UI
  sidebarCollapsed: boolean
  toasts: Toast[]

  // Actions
  login: (accessToken: string, refreshToken: string, user: User) => Promise<void>
  replaceAuthTokens: (accessToken: string, refreshToken: string) => Promise<void>
  logout: () => Promise<void>
  hydrateAuth: () => Promise<void>
  setPublishing: (active: boolean, total?: number, done?: number) => void
  updatePublishingProgress: (done: number) => void
  trackPublishingJob: (event: PublishProgressEvent) => void
  toggleSidebar: () => void
  addToast: (type: Toast['type'], message: string) => void
  removeToast: (id: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      currentUser: null,
      isLoggedIn: false,
      isPublishing: false,
      publishingTotal: 0,
      publishingDone: 0,
      publishingJobs: {},
      sidebarCollapsed: false,
      toasts: [],

      login: async (accessToken, refreshToken, user) => {
        await window.electronAPI?.authSession.set(accessToken, refreshToken)
        localStorage.removeItem(STORAGE_KEYS.token())
        localStorage.removeItem(STORAGE_KEYS.refreshToken())
        set({
          token: accessToken,
          refreshToken,
          currentUser: user,
          isLoggedIn: true,
        })
      },

      replaceAuthTokens: async (accessToken, refreshToken) => {
        await window.electronAPI?.authSession.set(accessToken, refreshToken)
        localStorage.removeItem(STORAGE_KEYS.token())
        localStorage.removeItem(STORAGE_KEYS.refreshToken())
        set({ token: accessToken, refreshToken })
      },

      logout: async () => {
        await window.electronAPI?.authSession.clear()
        localStorage.removeItem(STORAGE_KEYS.token())
        localStorage.removeItem(STORAGE_KEYS.refreshToken())
        set({ token: null, refreshToken: null, currentUser: null, isLoggedIn: false })
      },

      hydrateAuth: async () => {
        const legacyAccessToken = localStorage.getItem(STORAGE_KEYS.token()) || ''
        const legacyRefreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken()) || ''
        if (legacyAccessToken && legacyRefreshToken && window.electronAPI?.authSession) {
          await window.electronAPI.authSession.set(legacyAccessToken, legacyRefreshToken)
        }
        localStorage.removeItem(STORAGE_KEYS.token())
        localStorage.removeItem(STORAGE_KEYS.refreshToken())

        const session = await window.electronAPI?.authSession.get()
        if (!session?.accessToken) {
          set({ token: null, refreshToken: null, currentUser: null, isLoggedIn: false })
          return
        }
        set({
          token: session.accessToken,
          refreshToken: session.refreshToken,
          isLoggedIn: Boolean(get().currentUser),
        })
      },

      setPublishing: (active, total = 0, done = 0) => {
        set({ isPublishing: active, publishingTotal: total, publishingDone: done })
      },

      updatePublishingProgress: (done) => {
        set({ publishingDone: done })
        if (done >= get().publishingTotal) {
          set({ isPublishing: false })
        }
      },

      trackPublishingJob: (event) => {
        if (!event.jobId) return
        const jobId = event.jobId
        set((state) => {
          const publishingJobs = { ...state.publishingJobs }
          if (event.type === 'complete' || event.type === 'error') {
            delete publishingJobs[jobId]
          } else {
            publishingJobs[jobId] = {
              done: event.done ?? 0,
              total: event.total ?? 1,
            }
          }
          const active = Object.values(publishingJobs)
          return {
            publishingJobs,
            isPublishing: active.length > 0,
            publishingDone: active.reduce((sum, job) => sum + job.done, 0),
            publishingTotal: active.reduce((sum, job) => sum + job.total, 0),
          }
        })
      },

      toggleSidebar: () => {
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }))
      },

      addToast: (type, message) => {
        const id = Math.random().toString(36).slice(2)
        set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
        setTimeout(() => {
          get().removeToast(id)
        }, 4000)
      },

      removeToast: (id) => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      },
    }),
    {
      name: STORAGE_KEYS.appStore(),
      partialize: (s) => ({
        currentUser: s.currentUser,
        isLoggedIn: s.isLoggedIn,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
    },
  ),
)
