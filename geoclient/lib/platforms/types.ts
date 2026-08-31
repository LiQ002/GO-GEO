import type { Browser, CookieParam, Page } from 'puppeteer'
import type { CookiePersistFilter, LocalStoragePersistFilter } from './cookies'

export interface PublishArticleInput {
  title: string
  content: string
  author?: string
  cover?: string
  tags?: string[]
  summary?: string
}

export interface PublishArticleResult {
  publishedUrl?: string
  platformArticleId?: string
}

export interface PlatformPublisher {
  /** Platform id, e.g. wechat */
  id: string
  label: string
  icon: string
  color: string
  iconStyle: { bg: string; text: string }

  /** Login page for authorization */
  loginUrl: string
  /** Article publish entry page */
  publishUrl: string
  /** Base URL for cookie injection; defaults to publishUrl */
  cookieSiteUrl?: string
  /** Cookie domain override when it differs from cookieSiteUrl hostname */
  cookieDomain?: string
  /** Extra cookie domains that belong to the same authenticated session. */
  additionalCookieDomains?: string[]
  /** Filter session / short-lived cookies when saving authorization. */
  cookiePersistFilter?: CookiePersistFilter
  /** Persist selected localStorage keys with the session when needed. */
  localStoragePersistFilter?: LocalStoragePersistFilter
  /** Restore cookies/storage before the platform's first navigation. */
  preloadAuthState?: boolean

  /** Customize cookie parsing/injection per platform */
  buildCookies?: (cookieHeader: string) => CookieParam[]

  /** Normalize saved session URL after login (e.g. WeChat home + token). */
  normalizeAuthUrl?: (url: string) => string

  /** Reject credential capture until the platform has completed login. */
  assertAuthenticated?: (page: Page) => Promise<void>

  /** Build publish URL from saved auth session URL (keeps token in sync). */
  buildPublishUrl?: (authUrl: string) => string

  /** Hook after cookies are set, before navigation */
  beforeOpenPublish?: (browser: Browser, page: Page, cookieHeader: string) => Promise<void>

  /** Hook after publish page is opened */
  afterOpenPublish?: (page: Page, browser: Browser) => Promise<void>

  /**
   * Enable puppeteer-extra stealth when launching the browser for this platform.
   * Default false — manual login pages (WeChat, etc.) may break when APIs are patched.
   */
  useStealth?: boolean

  /** Fill the platform editor and submit/save the article automatically.
   *  Optionally returns the published article URL and/or platform article ID.
   */
  publishArticle?: (
    page: Page,
    article: PublishArticleInput,
  ) => Promise<string | PublishArticleResult | void>
}
