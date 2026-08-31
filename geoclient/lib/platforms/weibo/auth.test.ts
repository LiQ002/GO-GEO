import type { Cookie, Page } from 'puppeteer'
import { describe, expect, it, vi } from 'vitest'
import {
  deserializeSessionCookies,
  deserializeSessionLocalStorage,
  serializeSessionCookies,
} from '../cookies'
import { weiboPublisher } from './index'
import { assertWeiboAuthenticated, WEIBO_SESSION_COOKIE_NAME } from './publish'

function createWeiboPage(url: string, cookies: Array<Pick<Cookie, 'name' | 'value'>>) {
  const readCookies = vi.fn().mockResolvedValue(cookies)
  const page = {
    cookies: readCookies,
    url: vi.fn(() => url),
  } as unknown as Page
  return { page, readCookies }
}

describe('Weibo authentication', () => {
  it('accepts the authenticated home page through the session cookie', async () => {
    const { page, readCookies } = createWeiboPage('https://weibo.com/', [
      { name: WEIBO_SESSION_COOKIE_NAME, value: '_2A25example' },
    ])

    await expect(assertWeiboAuthenticated(page)).resolves.toBeUndefined()
    expect(readCookies).toHaveBeenCalledWith('https://weibo.com')
  })

  it('rejects the home page when the session cookie is missing', async () => {
    const { page } = createWeiboPage('https://weibo.com/', [
      { name: 'XSRF-TOKEN', value: 'example' },
    ])

    await expect(assertWeiboAuthenticated(page)).rejects.toThrow(
      '未检测到登录态 Cookie：SUB',
    )
  })

  it('rejects a login page before reading cookies', async () => {
    const { page, readCookies } = createWeiboPage('https://passport.weibo.com/login', [])

    await expect(assertWeiboAuthenticated(page)).rejects.toThrow('当前在登录页')
    expect(readCookies).not.toHaveBeenCalled()
  })

  it('persists only the required Weibo SUB cookie before first navigation', () => {
    const raw = serializeSessionCookies(
      [
        { name: 'SUB', value: 'weibo-session', domain: '.weibo.com' },
        { name: 'SUBP', value: 'optional-session', domain: '.weibo.com' },
        { name: 'SUB', value: 'sina-session', domain: '.sina.com.cn' },
      ],
      weiboPublisher.cookieSiteUrl!,
      weiboPublisher.cookieDomain,
      weiboPublisher.cookiePersistFilter,
      {
        '4055254406_degraded': 'degraded-state',
        V7_PLAYER_VOLUME: '0.50',
        aria: 'runtime-state',
        autoplaySigns: '{"4055254406":false}',
        right_search_tab: '{"4055254406":{"type":"mine"}}',
        unrelated: 'discard',
      },
      weiboPublisher.localStoragePersistFilter,
      weiboPublisher.additionalCookieDomains,
    )

    expect(
      deserializeSessionCookies(
        raw,
        weiboPublisher.cookieSiteUrl!,
        weiboPublisher.cookieDomain,
      ),
    ).toEqual([
      expect.objectContaining({ name: 'SUB', domain: '.weibo.com' }),
    ])
    expect(deserializeSessionLocalStorage(raw)).toBeUndefined()
    expect(weiboPublisher.preloadAuthState).toBe(true)
    expect(weiboPublisher.useStealth).toBe(true)
  })
})
