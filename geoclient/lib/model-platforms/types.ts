import type { CookieParam } from 'puppeteer'
import type { CookiePersistFilter, LocalStoragePersistFilter } from '../platforms/cookies'

export interface ModelPlatformConfig {
  id: string
  label: string
  icon: string
  color: string
  iconStyle: { bg: string; text: string }
  loginUrl: string
  chatUrl: string
  cookieSiteUrl?: string
  cookieDomain?: string
  /** Filter session / short-lived cookies when saving authorization. */
  cookiePersistFilter?: CookiePersistFilter
  /**
   * Persist selected localStorage keys with the session.
   * Required for platforms that store auth tokens in localStorage (e.g. Kimi).
   */
  localStoragePersistFilter?: LocalStoragePersistFilter
  /** Restore cookies/storage before the platform's first navigation. */
  preloadAuthState?: boolean
  buildCookies?: (cookieHeader: string) => CookieParam[]
  normalizeAuthUrl?: (url: string) => string
  useStealth?: boolean
}
