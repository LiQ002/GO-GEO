import type { Browser } from 'puppeteer'
import { describe, expect, it, vi } from 'vitest'
import { BrowserRegistry } from './BrowserRegistry'

type BrowserMock = {
  browser: Browser
  close: ReturnType<typeof vi.fn>
  disconnect: () => void
}

function createBrowserMock(closeImpl: () => Promise<void>): BrowserMock {
  let connected = true
  let disconnected: (() => void) | undefined
  const close = vi.fn(async () => {
    await closeImpl()
    connected = false
    disconnected?.()
  })
  const browser = {
    get connected() {
      return connected
    },
    close,
    on: vi.fn((event: string, listener: () => void) => {
      if (event === 'disconnected') disconnected = listener
      return browser
    }),
    process: vi.fn(() => null),
  } as unknown as Browser

  return {
    browser,
    close,
    disconnect: () => {
      connected = false
      disconnected?.()
    },
  }
}

describe('BrowserRegistry', () => {
  it('closes every tracked browser gracefully', async () => {
    const forceKill = vi.fn(async () => {})
    const registry = new BrowserRegistry(forceKill)
    const first = createBrowserMock(async () => {})
    const second = createBrowserMock(async () => {})
    registry.track(first.browser)
    registry.track(second.browser)

    await registry.closeAll(50)

    expect(first.close).toHaveBeenCalledOnce()
    expect(second.close).toHaveBeenCalledOnce()
    expect(forceKill).not.toHaveBeenCalled()
    expect(registry.size).toBe(0)
  })

  it('force-kills a browser when graceful close does not finish', async () => {
    const forceKill = vi.fn(async () => {})
    const registry = new BrowserRegistry(forceKill)
    const hanging = createBrowserMock(() => new Promise(() => {}))
    registry.track(hanging.browser)

    await registry.closeAll(5)

    expect(forceKill).toHaveBeenCalledWith(hanging.browser)
    expect(registry.size).toBe(0)
  })

  it('removes browsers that disconnect before shutdown', () => {
    const registry = new BrowserRegistry()
    const tracked = createBrowserMock(async () => {})
    registry.track(tracked.browser)

    tracked.disconnect()

    expect(registry.size).toBe(0)
  })
})
