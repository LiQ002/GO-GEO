import type { Browser, Page } from 'puppeteer'
import { randomUUID } from 'crypto'
import type { PlatformKind } from '../../../lib/platforms/unified'
import { createLogger } from '../logger'
import {
  attachAutoCloseWhenAllTabsClosed,
  type AutoCloseControls,
} from '../browser'

const log = createLogger('SessionManager')

export type AuthSession = {
  sessionId: string
  platformId: string
  platformUrl: string
  kind: PlatformKind
  browser: Browser
  page: Page
}

export class SessionManager {
  private sessions = new Map<string, AuthSession>()
  private browserLifecycle = new WeakMap<Browser, AutoCloseControls>()

  async open(params: {
    platformId: string
    platformUrl: string
    kind: PlatformKind
    browser: Browser
    page: Page
  }): Promise<string> {
    const sessionId = randomUUID()
    this.attachBrowserLifecycle(params.browser, sessionId)

    const session: AuthSession = {
      sessionId,
      platformId: params.platformId,
      platformUrl: params.platformUrl,
      kind: params.kind,
      browser: params.browser,
      page: params.page,
    }

    this.sessions.set(sessionId, session)
    log.info('Session opened', { sessionId, platformId: params.platformId })
    return sessionId
  }

  get(sessionId: string): AuthSession | undefined {
    return this.sessions.get(sessionId)
  }

  /** Most recently opened session — backward compat when sessionId is omitted. */
  getLatest(): AuthSession | undefined {
    let latest: AuthSession | undefined
    for (const session of this.sessions.values()) {
      latest = session
    }
    return latest
  }

  resolve(sessionId?: string): AuthSession | undefined {
    if (sessionId) return this.get(sessionId)
    return this.getLatest()
  }

  resumeLifecycle(sessionId: string) {
    const session = this.get(sessionId)
    if (session) {
      this.browserLifecycle.get(session.browser)?.resume()
    }
  }

  pauseLifecycle(browser: Browser) {
    this.browserLifecycle.get(browser)?.pause()
  }

  private attachBrowserLifecycle(browser: Browser, sessionId: string) {
    const controls = attachAutoCloseWhenAllTabsClosed(browser, () => {
      this.browserLifecycle.delete(browser)
      const session = this.sessions.get(sessionId)
      if (session?.browser === browser) {
        this.sessions.delete(sessionId)
        log.info('Session closed by browser lifecycle', { sessionId })
      }
    })
    controls.pause()
    this.browserLifecycle.set(browser, controls)
  }

  async close(sessionId?: string): Promise<void> {
    if (sessionId) {
      await this.closeOne(sessionId)
      return
    }
    await this.closeAll()
  }

  async closeOne(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    this.sessions.delete(sessionId)
    if (session.browser.connected) {
      await session.browser.close().catch((err) => {
        log.warn('Failed to close browser', { sessionId, error: String(err) })
      })
    }
    log.info('Session closed', { sessionId })
  }

  async closeAll(): Promise<void> {
    const ids = [...this.sessions.keys()]
    await Promise.all(ids.map((id) => this.closeOne(id)))
  }
}

export const sessionManager = new SessionManager()
