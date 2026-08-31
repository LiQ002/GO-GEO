import type { CookieParam } from 'puppeteer'
import {
  cookiesFromHeader,
  cookiesWithSiteUrl,
  parseCookieHeader,
} from './cookieHeader'

export { parseCookieHeader, cookiesFromHeader } from './cookieHeader'
export type { ParsedCookie } from './cookieHeader'

export type StoredSessionCookie = {
  name: string
  value: string
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: CookieParam['sameSite']
  expires?: number
}

/** v2 session payload: cookies + optional localStorage snapshot. */
export type StoredSessionPayload = {
  v: 2
  cookies: StoredSessionCookie[]
  localStorage?: Record<string, string>
}

type RawBrowserCookie = {
  name?: string
  value?: string
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: CookieParam['sameSite']
  expires?: number
  session?: boolean
}

/** Rules for which cookies to keep when saving a platform session. */
export type CookiePersistFilter = {
  /** Keep only cookies with an exact name match. */
  names?: string[]
  /** Keep cookies whose name starts with one of these prefixes. */
  namePrefixes?: string[]
  /** Drop session cookies (no expiry / expires <= 0). Ignored when allowlist is set. */
  excludeSessionCookies?: boolean
}

/** Rules for which localStorage keys to keep when saving a platform session. */
export type LocalStoragePersistFilter = {
  /** Keep only exact key matches. */
  keys?: string[]
  /** Keep keys that start with one of these prefixes. */
  keyPrefixes?: string[]
  /** Keep keys that end with these suffixes. */
  keySuffixes?: string[]
}

function isSessionCookie(cookie: RawBrowserCookie): boolean {
  if (cookie.session === true) return true
  return cookie.expires === undefined || cookie.expires <= 0
}

function shouldPersistCookie(cookie: RawBrowserCookie, filter?: CookiePersistFilter): boolean {
  if (!filter) return true

  const name = cookie.name || ''
  const hasAllowlist = Boolean(filter.names?.length || filter.namePrefixes?.length)

  if (hasAllowlist) {
    const allowedByName = filter.names?.includes(name) ?? false
    const allowedByPrefix = filter.namePrefixes?.some((prefix) => name.startsWith(prefix)) ?? false
    if (!allowedByName && !allowedByPrefix) return false
  }

  if (filter.excludeSessionCookies && !hasAllowlist && isSessionCookie(cookie)) {
    return false
  }

  return true
}

function cookieMatchesScope(
  cookie: { domain?: string },
  siteUrl: string,
  cookieDomain?: string,
  additionalCookieDomains?: string[],
): boolean {
  const host = new URL(siteUrl).hostname
  const roots = new Set<string>([host])
  if (cookieDomain) roots.add(cookieDomain.replace(/^\./, ''))
  for (const domain of additionalCookieDomains ?? []) {
    roots.add(domain.replace(/^\./, ''))
  }

  const domain = (cookie.domain || '').replace(/^\./, '')
  if (!domain) return false

  for (const root of roots) {
    if (domain === root || root.endsWith(`.${domain}`) || domain.endsWith(`.${root}`)) {
      return true
    }
  }
  return false
}

/** Attach url at setCookie time — same as puppeteer-test.js */
export function preparePuppeteerCookies(
  cookies: Array<{ name: string; value: string; url?: string; domain?: string }>,
  siteUrl: string,
): CookieParam[] {
  return cookiesWithSiteUrl(cookies, siteUrl)
}

export function buildPuppeteerCookies(
  cookieHeader: string,
  siteUrl: string,
  cookieDomain?: string,
): CookieParam[] {
  const parsed = new URL(siteUrl)
  const domain = cookieDomain ?? parsed.hostname

  return parseCookieHeader(cookieHeader).map((c) => ({
    name: c.name,
    value: c.value,
    domain,
    path: '/',
    secure: parsed.protocol === 'https:',
    sameSite: 'Lax',
  }))
}

/** Scope cookies by site URL (matches puppeteer-test header injection flow). */
export function buildPuppeteerCookiesWithUrl(cookieHeader: string, siteUrl: string): CookieParam[] {
  return cookiesFromHeader(cookieHeader, siteUrl)
}

export function cookiesToHeader(
  cookies: Array<{ name?: string; value?: string; domain?: string }>,
  hostname?: string,
) {
  const scoped = hostname
    ? cookies.filter((c) => cookieMatchesScope(c, `https://${hostname}`, hostname))
    : cookies

  return scoped
    .filter((c) => c.name && typeof c.value === 'string')
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')
}

function toStoredCookies(
  cookies: RawBrowserCookie[],
  siteUrl: string,
  cookieDomain?: string,
  persistFilter?: CookiePersistFilter,
  additionalCookieDomains?: string[],
): StoredSessionCookie[] {
  return cookies
    .filter((cookie) => cookie.name && typeof cookie.value === 'string')
    .filter((cookie) =>
      cookieMatchesScope(cookie, siteUrl, cookieDomain, additionalCookieDomains),
    )
    .filter((cookie) => shouldPersistCookie(cookie, persistFilter))
    .map(
      (cookie): StoredSessionCookie => ({
        name: cookie.name!,
        value: cookie.value!,
        domain: cookie.domain,
        path: cookie.path || '/',
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expires: cookie.expires,
      }),
    )
}

function shouldPersistLocalStorageKey(key: string, filter?: LocalStoragePersistFilter): boolean {
  if (!filter) return false
  const hasAllowlist = Boolean(
    filter.keys?.length || filter.keyPrefixes?.length || filter.keySuffixes?.length,
  )
  if (!hasAllowlist) return false

  const allowedByKey = filter.keys?.includes(key) ?? false
  const allowedByPrefix = filter.keyPrefixes?.some((prefix) => key.startsWith(prefix)) ?? false
  const allowedBySuffix = filter.keySuffixes?.some((suffix) => key.endsWith(suffix)) ?? false
  return allowedByKey || allowedByPrefix || allowedBySuffix
}

export function filterLocalStorage(
  localStorage: Record<string, string>,
  filter?: LocalStoragePersistFilter,
): Record<string, string> | undefined {
  if (!filter) return undefined

  const entries = Object.entries(localStorage).filter(([key]) =>
    shouldPersistLocalStorageKey(key, filter),
  )
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries)
}

/**
 * Normalize a sameSite value to one of Playwright's accepted values:
 * "Strict" | "Lax" | "None". Any missing/unknown value defaults to "Lax".
 *
 * Playwright Cookie.sameSite type: "Strict" | "Lax" | "None"
 */
function normalizeSameSite(value: CookieParam['sameSite'] | undefined): 'Strict' | 'Lax' | 'None' {
  switch (value) {
    case 'Strict':
    case 'Lax':
    case 'None':
      return value
    default:
      // undefined / unknown / legacy Puppeteer values → Lax (safe default)
      return 'Lax'
  }
}

function storedCookiesToParams(
  stored: StoredSessionCookie[],
  siteUrl: string,
  cookieDomain?: string,
): CookieParam[] {
  const now = Date.now() / 1000
  const parsedUrl = new URL(siteUrl)
  const isHttps = parsedUrl.protocol === 'https:'

  return stored
    .filter((cookie) => {
      // Keep session cookies (missing / non-positive expires). Drop only truly expired ones.
      if (cookie.expires === undefined || cookie.expires <= 0) return true
      return cookie.expires > now
    })
    .map((cookie) => {
      // Normalize sameSite FIRST — needed to determine secure below
      const sameSite = normalizeSameSite(cookie.sameSite)
      // Schemeful Same-Site: a cookie stored as secure=false on an HTTPS origin
      // will be treated as an "insecure" cookie and BLOCKED when sent to HTTPS
      // subresources from an HTTPS page. Force secure=true for all cookies on
      // HTTPS origins. SameSite=None also requires Secure per RFC 6265bis.
      const secure = isHttps || sameSite === 'None' ? true : (cookie.secure ?? false)

      const param: CookieParam = {
        name: cookie.name,
        value: cookie.value,
        path: cookie.path || '/',
        sameSite,
        secure,
      }

      if (cookie.domain) {
        param.domain = cookie.domain
      } else if (cookieDomain) {
        param.domain = cookieDomain
      } else {
        param.url = siteUrl
      }

      if (cookie.httpOnly !== undefined) param.httpOnly = cookie.httpOnly
      if (cookie.expires && cookie.expires > 0) param.expires = cookie.expires

      return param
    })
}

function parseSessionPayload(raw: string): StoredSessionPayload | StoredSessionCookie[] | null {
  const trimmed = String(raw || '').trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null

  try {
    const parsed = JSON.parse(trimmed) as StoredSessionPayload | StoredSessionCookie[]
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.cookies)) {
      return parsed
    }
  } catch {
    return null
  }
  return null
}

/** Persist CDP cookies with domain/path/httpOnly metadata for reliable replay. */
export function serializeSessionCookies(
  cookies: RawBrowserCookie[],
  siteUrl: string,
  cookieDomain?: string,
  persistFilter?: CookiePersistFilter,
  localStorage?: Record<string, string>,
  localStorageFilter?: LocalStoragePersistFilter,
  additionalCookieDomains?: string[],
): string {
  const storedCookies = toStoredCookies(
    cookies,
    siteUrl,
    cookieDomain,
    persistFilter,
    additionalCookieDomains,
  )
  const storedLocalStorage = filterLocalStorage(localStorage ?? {}, localStorageFilter)

  if (storedLocalStorage) {
    const payload: StoredSessionPayload = {
      v: 2,
      cookies: storedCookies,
      localStorage: storedLocalStorage,
    }
    return JSON.stringify(payload)
  }

  return JSON.stringify(storedCookies)
}

/** Restore cookies from v2 payload, legacy cookie JSON array, or `a=b; c=d` header. */
export function deserializeSessionCookies(
  raw: string,
  siteUrl: string,
  cookieDomain?: string,
): CookieParam[] {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return []

  const parsed = parseSessionPayload(trimmed)
  if (parsed) {
    const cookies = Array.isArray(parsed) ? parsed : parsed.cookies
    return storedCookiesToParams(cookies, siteUrl, cookieDomain)
  }

  if (cookieDomain) {
    return buildPuppeteerCookies(trimmed, siteUrl, cookieDomain)
  }

  return preparePuppeteerCookies(parseCookieHeader(trimmed), siteUrl)
}

/** Extract localStorage snapshot from a v2 session payload (if present). */
export function deserializeSessionLocalStorage(raw: string): Record<string, string> | undefined {
  const parsed = parseSessionPayload(String(raw || '').trim())
  if (!parsed || Array.isArray(parsed)) return undefined
  if (!parsed.localStorage || typeof parsed.localStorage !== 'object') return undefined
  return parsed.localStorage
}

export function isSerializedSessionCookies(raw: string) {
  const trimmed = String(raw || '').trim()
  if (trimmed.startsWith('[')) return true
  if (!trimmed.startsWith('{')) return false
  const parsed = parseSessionPayload(trimmed)
  return Boolean(parsed && !Array.isArray(parsed))
}
