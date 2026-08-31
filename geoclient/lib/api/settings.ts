import type { Settings } from '@/types/app'
import { getBaseURL, updateBaseURL } from './core'

const SETTINGS_KEY = 'operator-runtime-settings'

export function getSettings(): Promise<Settings> {
  const stored = localStorage.getItem(SETTINGS_KEY)
  let parsed: Partial<Settings> = {}
  if (stored) {
    try {
      parsed = JSON.parse(stored) as Partial<Settings>
    } catch {
      localStorage.removeItem(SETTINGS_KEY)
    }
  }
  return Promise.resolve({
    serverUrl: getBaseURL(),
    autoPublish: parsed.autoPublish ?? false,
    retryCount: parsed.retryCount ?? 3,
    publishDelay: parsed.publishDelay ?? 3,
  })
}

export function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  if (settings.serverUrl) updateBaseURL(settings.serverUrl)
  const next: Settings = {
    serverUrl: settings.serverUrl ?? getBaseURL(),
    autoPublish: settings.autoPublish ?? false,
    retryCount: settings.retryCount ?? 3,
    publishDelay: settings.publishDelay ?? 3,
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  return Promise.resolve(next)
}
