import { isOperatorMode } from '@/lib/app-mode'

/** Prefix localStorage keys in operator mode to avoid clashing with the client. */
function withModePrefix(key: string): string {
  return isOperatorMode() ? `ops_${key}` : key
}

export const STORAGE_KEYS = {
  token: () => withModePrefix('token'),
  refreshToken: () => withModePrefix('refresh_token'),
  serverUrl: () => withModePrefix('serverUrl'),
  user: () => withModePrefix('user'),
  appStore: () => (isOperatorMode() ? 'ops-app-store' : 'app-store'),
} as const
