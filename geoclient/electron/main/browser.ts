import puppeteer from 'puppeteer'
import puppeteerExtra from 'puppeteer-extra'
import type { Browser, Page } from 'puppeteer'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { createLogger } from './logger'
import { browserRegistry } from './services/BrowserRegistry'
import { browserRuntimeService } from './services/BrowserRuntimeService'

const log = createLogger('Browser')

let stealthPluginReady = false

/** Fixed UA for all Puppeteer sessions — keeps platform auth environments consistent. */
export const FIXED_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'

const CHROME_ARGS = [
  '--no-first-run',
  '--no-default-browser-check',
  `--user-agent=${FIXED_USER_AGENT}`,
] as const

function getLauncher(stealth: boolean) {
  if (!stealth) {
    return puppeteer
  }

  if (!stealthPluginReady) {
    const plugin = StealthPlugin()
    // iframe / permissions / chrome.runtime patches break mp.weixin.qq.com login UI.
    plugin.enabledEvasions.delete('iframe.contentWindow')
    plugin.enabledEvasions.delete('navigator.permissions')
    plugin.enabledEvasions.delete('chrome.runtime')
    plugin.enabledEvasions.delete('user-agent-override')
    puppeteerExtra.use(plugin)
    stealthPluginReady = true
  }

  return puppeteerExtra
}

export type BrowserLaunchOptions = {
  /** Enable puppeteer-extra stealth plugin for this launch. */
  stealth?: boolean
}

export async function applyFixedUserAgent(page: Page): Promise<void> {
  await page.setUserAgent(FIXED_USER_AGENT)
}

function attachFixedUserAgent(browser: Browser) {
  const syncPages = async () => {
    for (const page of await browser.pages()) {
      if (!page.isClosed()) {
        await applyFixedUserAgent(page).catch(() => {})
      }
    }
  }

  void syncPages()

  // 注意：不监听 targetcreated 事件强制覆盖 UA。
  // 元宝等平台在移动端模式下，page.setUserAgent(mobileUA) 设置后，
  // 如果 targetcreated 回调强制覆盖回 desktop UA，会导致登录态失效和 API 请求失败。
  // 新页面（如弹窗、新标签页）默认会使用浏览器启动参数中的 UA，无需额外处理。
}

export async function launchBrowser(options: BrowserLaunchOptions = {}): Promise<Browser> {
  const stealth = options.stealth ?? false
  const launcher = getLauncher(stealth)
  const executablePath = await browserRuntimeService.requireExecutablePath()

  log.info('Launching browser', {
    stealth,
    source: 'system-config',
    platform: process.platform,
    arch: process.arch,
  })

  const browser = await launcher.launch({
    headless: false,
    defaultViewport: { width: 1366, height: 900 },
    args: [...CHROME_ARGS],
    executablePath,
  })

  browserRegistry.track(browser)
  attachFixedUserAgent(browser)
  return browser
}

/** Reuse Puppeteer's initial tab instead of opening a second one. */
export async function getOrCreateMainPage(browser: Browser): Promise<Page> {
  const pages = await browser.pages()
  const page = pages[0] ?? (await browser.newPage())
  await applyFixedUserAgent(page)
  return page
}

export type AutoCloseControls = {
  pause: () => void
  resume: () => void
}

/**
 * When the user closes every tab, close the browser process and notify the caller.
 * Use pause/resume around programmatic navigation so setup is not interrupted.
 *
 * Implementation note: page navigations (especially on login flows) can briefly
 * report zero pages while a new target is being created. We double-check after a
 * short delay before closing to avoid destroying the browser mid-authorization.
 */
export function attachAutoCloseWhenAllTabsClosed(
  browser: Browser,
  onClosed?: () => void,
): AutoCloseControls {
  let notified = false
  let paused = false
  let closeTimer: ReturnType<typeof setTimeout> | null = null
  let pendingClose = false

  const notifyClosed = () => {
    if (notified) return
    notified = true
    onClosed?.()
  }

  const hasOpenPages = async () => {
    try {
      const pages = (await browser.pages()).filter((page) => !page.isClosed())
      return pages.length > 0
    } catch {
      return false
    }
  }

  const maybeCloseBrowser = async (remainingChecks = 6) => {
    if (paused || !browser.connected || notified) {
      pendingClose = false
      return
    }

    const hasPages = await hasOpenPages()
    log.debug('Auto-close recheck', { hasPages, remainingChecks, pendingClose })
    if (hasPages) {
      pendingClose = false
      return
    }

    if (remainingChecks > 0) {
      // Wait a bit and recheck: the new page may still be spawning after a redirect/popup.
      closeTimer = setTimeout(() => {
        closeTimer = null
        void maybeCloseBrowser(remainingChecks - 1)
      }, 1200)
      return
    }

    pendingClose = false
    log.info('Closing browser after all tabs confirmed closed')
    await browser.close().catch(() => {})
    notifyClosed()
  }

  const scheduleMaybeClose = (reason?: string) => {
    if (paused) return
    if (closeTimer) clearTimeout(closeTimer)
    pendingClose = true
    log.debug('Scheduling browser close check', { reason })
    closeTimer = setTimeout(() => {
      closeTimer = null
      void maybeCloseBrowser()
    }, 500)
  }

  const cancelPendingClose = () => {
    if (pendingClose && closeTimer) {
      log.debug('Cancelling browser close check because a new target was created')
      clearTimeout(closeTimer)
      closeTimer = null
      pendingClose = false
    }
  }

  const watchPage = (page: Page) => {
    const lastUrl = page.url()
    page.on('close', () => {
      log.debug('Page close event', { url: lastUrl })
      scheduleMaybeClose('page-close')
    })
  }

  browser.on('targetcreated', (target) => {
    cancelPendingClose()
    if (target.type() !== 'page') return
    void target.page().then((page) => {
      if (page) watchPage(page)
    })
  })

  browser.on('targetdestroyed', () => {
    scheduleMaybeClose('target-destroyed')
  })

  browser.on('disconnected', () => {
    if (closeTimer) clearTimeout(closeTimer)
    notifyClosed()
  })

  void browser.pages().then((pages) => {
    for (const page of pages) watchPage(page)
  })

  return {
    pause: () => {
      paused = true
    },
    resume: () => {
      paused = false
    },
  }
}
