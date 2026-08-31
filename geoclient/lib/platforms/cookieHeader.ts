import type { CookieParam } from 'puppeteer'

export type ParsedCookie = { name: string; value: string }

/**
 * Parse raw Cookie request header string.
 * Split on ';' only — values may contain '=' (e.g. pgv_info=ssid=...).
 */
export function parseCookieHeader(cookieHeader: string): ParsedCookie[] {
  const raw = String(cookieHeader || '').trim()
  if (!raw) return []

  // Allow pasting full "Cookie: a=b; c=d" header lines.
  const header = raw.replace(/^cookie:\s*/i, '')

  return header
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf('=')
      if (idx <= 0) return null
      const name = pair.slice(0, idx).trim()
      const value = pair.slice(idx + 1).trim()
      if (!name) return null
      return { name, value }
    })
    .filter((x): x is ParsedCookie => Boolean(x))
}

/** Attach url at setCookie time — same as puppeteer-test.js */
export function cookiesWithSiteUrl(
  cookies: Array<{ name: string; value: string; url?: string; domain?: string }>,
  siteUrl: string,
): CookieParam[] {
  const isHttps = siteUrl.startsWith('https:')
  return cookies.map((c) => {
    // Playwright requires explicit sameSite ("Strict"|"Lax"|"None") and secure
    // for SameSite=None cookies. Default to Lax + secure on HTTPS origins to
    // avoid "Schemeful Same-Site" blocking (HTTPS page → HTTP subresource).
    const base: CookieParam = {
      name: c.name,
      value: c.value,
      sameSite: 'Lax',
      secure: isHttps,
    }
    if (c.url || c.domain) {
      if (c.url) base.url = c.url
      if (c.domain) base.domain = c.domain
    } else {
      base.url = siteUrl
    }
    return base
  })
}

export function cookiesFromHeader(cookieHeader: string, siteUrl: string): CookieParam[] {
  return cookiesWithSiteUrl(parseCookieHeader(cookieHeader), siteUrl)
}
