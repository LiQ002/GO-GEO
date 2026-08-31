import type { CookieParam, Page } from 'puppeteer'
import {
  deserializeSessionCookies,
  deserializeSessionLocalStorage,
  serializeSessionCookies,
} from '../../../lib/platforms'
import {
  getCookieSiteUrl,
  getTargetUrl,
  isMediaPlatform,
  requirePlatform,
  resolvePlatformKind,
  type PlatformKind,
} from '../../../lib/platforms/unified'
import {
  getOrCreateMainPage,
  launchBrowser,
} from '../browser'
import { createLogger } from '../logger'
import { sessionManager } from './SessionManager'
import { credentialService } from './CredentialService'

const log = createLogger('AuthService')

async function applySessionCookies(page: Page, cookies: CookieParam[]) {
  for (const cookie of cookies) {
    try {
      await page.setCookie(cookie)
    } catch (err) {
      log.warn('Skip rejected cookie', {
        name: cookie.name,
        domain: cookie.domain,
        error: String(err),
      })
    }
  }
}

async function getAllCookies(page: Page) {
  const client = await page.createCDPSession()
  const { cookies } = await client.send('Network.getAllCookies')
  return cookies
}

async function dumpLocalStorage(page: Page): Promise<Record<string, string>> {
  try {
    return await page.evaluate(() => {
      const out: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        const value = localStorage.getItem(key)
        if (value !== null) out[key] = value
      }
      return out
    })
  } catch (err) {
    log.warn('Failed to dump localStorage', { error: String(err) })
    return {}
  }
}

async function restoreLocalStorage(page: Page, entries: Record<string, string>) {
  const keys = Object.keys(entries)
  if (keys.length === 0) return

  await page.evaluate((data) => {
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, value)
    }
  }, entries)

  log.info('Restored localStorage keys', { keys })
}

async function preloadLocalStorage(
  page: Page,
  siteUrl: string,
  entries: Record<string, string>,
) {
  const keys = Object.keys(entries)
  if (keys.length === 0) return

  const targetOrigin = new URL(siteUrl).origin
  await page.evaluateOnNewDocument(
    ({ origin, data }) => {
      if (location.origin !== origin) return
      for (const [key, value] of Object.entries(data)) {
        localStorage.setItem(key, value)
      }
    },
    { origin: targetOrigin, data: entries },
  )

  log.info('Preloaded localStorage keys', { targetOrigin, keys })
}

function prepareAuthCookies(
  raw: string,
  platform: ReturnType<typeof requirePlatform>,
  cookieSiteUrl: string,
) {
  if (platform.buildCookies) {
    return platform.buildCookies(raw)
  }
  return deserializeSessionCookies(raw, cookieSiteUrl, platform.cookieDomain)
}

export class AuthService {
  async openLogin(
    platformId: string,
    platformUrl?: string,
    kind?: PlatformKind,
  ): Promise<{ ok: true; sessionId: string }> {
    const resolvedKind = resolvePlatformKind(platformId, kind)
    const platform = requirePlatform(platformId, resolvedKind)
    const loginUrl = platformUrl || platform.loginUrl

    log.info('Opening login', { platformId, kind: resolvedKind })

    const browser = await launchBrowser({ stealth: platform.useStealth ?? false })
    try {
      const mainPage = await getOrCreateMainPage(browser)
      await mainPage.goto(loginUrl, { waitUntil: 'domcontentloaded' })

      const sessionId = await sessionManager.open({
        platformId,
        platformUrl: loginUrl,
        kind: resolvedKind,
        browser,
        page: mainPage,
      })
      // 授权登录窗口不启用 auto-close：登录过程中页面跳转/弹窗变化可能触发
      // "所有标签页关闭" 的误判（企鹅号尤为明显），保持 pause 直到前端主动 close。
      // sessionManager.resumeLifecycle(sessionId)

      return { ok: true, sessionId }
    } catch (err) {
      await browser.close().catch(() => {})
      throw err
    }
  }

  async captureCredentials(sessionId?: string) {
    const session = sessionManager.resolve(sessionId)
    if (!session) {
      log.warn('captureCredentials: no active session', { sessionId })
      return { ok: false as const, message: 'No active session' }
    }

    log.info('Capturing credentials', { sessionId, platformId: session.platformId, pageUrl: session.page.url() })

    const platform = requirePlatform(session.platformId, session.kind)
    if (isMediaPlatform(platform) && platform.assertAuthenticated) {
      await platform.assertAuthenticated(session.page)
    }
    const cookieSiteUrl = getCookieSiteUrl(platform)
    const cookies = await getAllCookies(session.page)
    const localStorage = platform.localStoragePersistFilter
      ? await dumpLocalStorage(session.page)
      : undefined

    const cookie = serializeSessionCookies(
      cookies,
      cookieSiteUrl,
      platform.cookieDomain,
      platform.cookiePersistFilter,
      localStorage,
      platform.localStoragePersistFilter,
      isMediaPlatform(platform) ? platform.additionalCookieDomains : undefined,
    )
    const pageUrl = session.page.url()
    const authUrl = platform.normalizeAuthUrl ? platform.normalizeAuthUrl(pageUrl) : pageUrl
    const restoredLocal = deserializeSessionLocalStorage(cookie)
    const hasCookies = prepareAuthCookies(cookie, platform, cookieSiteUrl).length > 0
    const hasLocalStorage = Boolean(restoredLocal && Object.keys(restoredLocal).length > 0)

    if (!cookie || (!hasCookies && !hasLocalStorage)) {
      return { ok: false as const, message: 'No cookies found for this platform' }
    }

    log.info('Captured session', {
      platformId: session.platformId,
      cookieBytes: cookie.length,
      localStorageKeys: restoredLocal ? Object.keys(restoredLocal) : [],
    })

    const encryptedSecret = credentialService.encrypt({ cookie, authUrl })
    return { ok: true as const, encryptedSecret, sessionId: session.sessionId }
  }

  async close(sessionId?: string) {
    await sessionManager.close(sessionId)
    return { ok: true as const }
  }

  /** Inject cookies (+ localStorage when present) and navigate to target URL. */
  async prepareAuthenticatedPage(params: {
    platformId: string
    encryptedSecret: string
    kind?: PlatformKind
    loginUrl?: string
    userAgent?: string
    viewport?: { width: number; height: number; isMobile?: boolean; hasTouch?: boolean }
  }) {
    const kind = params.kind ?? resolvePlatformKind(params.platformId)
    const platform = requirePlatform(params.platformId, kind)
    const credentials = credentialService.decrypt(params.encryptedSecret)
    const cookieSiteUrl = params.loginUrl || getCookieSiteUrl(platform)
    const targetUrl = getTargetUrl(platform, credentials.authUrl)

    const browser = await launchBrowser({ stealth: platform.useStealth ?? false })
    try {
      const mainPage = await getOrCreateMainPage(browser)
      mainPage.setDefaultTimeout(45_000)

      // 在导航前设置 UA 和 viewport，确保登录态恢复在正确的终端环境下进行
      // （元宝等平台在移动端 UA 下使用不同的登录验证逻辑，desktop UA 下恢复的登录态可能不被移动端认可）
      if (params.userAgent) {
        await mainPage.setUserAgent(params.userAgent)
      }
      if (params.viewport) {
        await mainPage.setViewport(params.viewport)
      }

      // navigator.webdriver 通过 Chrome 启动参数 --disable-blink-features=AutomationControlled 隐藏
      // 不使用 evaluateOnNewDocument（可能干扰页面 JS 初始化导致登录态丢失）

      const cookies = prepareAuthCookies(credentials.cookie, platform, cookieSiteUrl)
      const localStorage = platform.localStoragePersistFilter
        ? deserializeSessionLocalStorage(credentials.cookie)
        : undefined

      if (platform.preloadAuthState) {
        log.info('Preloading auth state before first navigation', {
          platformId: params.platformId,
        })
        await applySessionCookies(mainPage, cookies)
        if (localStorage) {
          await preloadLocalStorage(mainPage, cookieSiteUrl, localStorage)
        }
      } else {
        await mainPage.goto(cookieSiteUrl, { waitUntil: 'domcontentloaded' })
        await applySessionCookies(mainPage, cookies)
        if (localStorage) {
          await restoreLocalStorage(mainPage, localStorage)
        }

        // Reload so the app bootstraps with restored cookies + localStorage.
        await mainPage.goto(cookieSiteUrl, { waitUntil: 'domcontentloaded' })
      }

      if (platform.kind === 'media' && platform.beforeOpenPublish) {
        await platform.beforeOpenPublish(browser, mainPage, credentials.cookie)
      }

      await mainPage.goto(targetUrl, { waitUntil: 'domcontentloaded' })

      if (platform.kind === 'media' && platform.afterOpenPublish) {
        await platform.afterOpenPublish(mainPage, browser)
      }

      const sessionId = await sessionManager.open({
        platformId: params.platformId,
        platformUrl: targetUrl,
        kind,
        browser,
        page: mainPage,
      })
      sessionManager.resumeLifecycle(sessionId)

      return { sessionId, platform, browser, page: mainPage, targetUrl }
    } catch (err) {
      await browser.close().catch(() => {})
      throw err
    }
  }
}

export const authService = new AuthService()
