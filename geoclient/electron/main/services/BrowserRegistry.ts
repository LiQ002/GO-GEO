import { execFile } from 'child_process'
import { join } from 'path'
import type { Browser } from 'puppeteer'
import { createLogger } from '../logger'

const log = createLogger('BrowserRegistry')

export const DEFAULT_BROWSER_CLOSE_TIMEOUT_MS = 500
const TASKKILL_TIMEOUT_MS = 700

type ForceKillBrowser = (browser: Browser) => Promise<void>

function resolveTaskkillExecutable(): string {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR
  return systemRoot ? join(systemRoot, 'System32', 'taskkill.exe') : 'taskkill.exe'
}

async function forceKillBrowserProcess(browser: Browser): Promise<void> {
  const browserProcess = browser.process()
  if (!browserProcess?.pid) return

  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      execFile(
        resolveTaskkillExecutable(),
        ['/PID', String(browserProcess.pid), '/T', '/F'],
        { windowsHide: true, timeout: TASKKILL_TIMEOUT_MS },
        (error) => {
          if (error && browser.connected) {
            log.warn('Unable to terminate browser process tree', {
              pid: browserProcess.pid,
              error: String(error),
            })
          }
          resolve()
        },
      )
    })
    return
  }

  if (!browserProcess.killed) {
    browserProcess.kill('SIGKILL')
  }
}

/** Tracks every Puppeteer Chromium instance so application shutdown cannot orphan one. */
export class BrowserRegistry {
  private readonly browsers = new Set<Browser>()

  constructor(private readonly forceKill: ForceKillBrowser = forceKillBrowserProcess) {}

  get size(): number {
    return this.browsers.size
  }

  track(browser: Browser): Browser {
    this.browsers.add(browser)
    browser.on('disconnected', () => {
      this.browsers.delete(browser)
    })
    return browser
  }

  async closeAll(timeoutMs = DEFAULT_BROWSER_CLOSE_TIMEOUT_MS): Promise<void> {
    const browsers = [...this.browsers]
    if (browsers.length === 0) return

    log.info('Closing tracked browser processes', { count: browsers.length, timeoutMs })
    await Promise.all(browsers.map((browser) => this.closeOne(browser, timeoutMs)))
  }

  private async closeOne(browser: Browser, timeoutMs: number): Promise<void> {
    if (!browser.connected) {
      this.browsers.delete(browser)
      return
    }

    let timeout: ReturnType<typeof setTimeout> | undefined
    const result = await Promise.race([
      browser.close().then(
        () => 'closed' as const,
        (error) => {
          log.warn('Graceful browser close failed', { error: String(error) })
          return 'failed' as const
        },
      ),
      new Promise<'timeout'>((resolve) => {
        timeout = setTimeout(() => resolve('timeout'), timeoutMs)
      }),
    ])
    if (timeout) clearTimeout(timeout)

    if (result !== 'closed' && browser.connected) {
      log.warn('Force-closing browser process', { reason: result })
      await this.forceKill(browser).catch((error) => {
        log.warn('Force-close browser process failed', { error: String(error) })
      })
    }
    this.browsers.delete(browser)
  }
}

export const browserRegistry = new BrowserRegistry()
