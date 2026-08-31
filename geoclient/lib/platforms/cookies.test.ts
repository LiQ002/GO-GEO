import { describe, expect, it } from 'vitest'
import {
  deserializeSessionCookies,
  deserializeSessionLocalStorage,
  serializeSessionCookies,
} from './cookies'

const siteUrl = 'https://example.com'

describe('platform session persistence', () => {
  it('scopes cookies and drops expired or unrelated cookies on replay', () => {
    const raw = serializeSessionCookies(
      [
        { name: 'token', value: 'ok', domain: '.example.com', expires: Date.now() / 1000 + 3600 },
        { name: 'expired', value: 'old', domain: '.example.com', expires: 1 },
        { name: 'foreign', value: 'no', domain: '.other.example', expires: Date.now() / 1000 + 3600 },
      ],
      siteUrl,
    )

    expect(deserializeSessionCookies(raw, siteUrl)).toEqual([
      expect.objectContaining({ name: 'token', value: 'ok', domain: '.example.com' }),
    ])
  })

  it('preserves allowlisted session cookies and localStorage only', () => {
    const raw = serializeSessionCookies(
      [
        { name: 'auth_token', value: 'secret', domain: '.example.com', session: true },
        { name: 'analytics', value: 'discard', domain: '.example.com', session: true },
      ],
      siteUrl,
      undefined,
      { names: ['auth_token'], excludeSessionCookies: true },
      { auth_state: 'ready', theme: 'dark' },
      { keyPrefixes: ['auth_'], keySuffixes: ['_degraded'] },
    )

    expect(deserializeSessionCookies(raw, siteUrl)).toEqual([
      expect.objectContaining({ name: 'auth_token', value: 'secret' }),
    ])
    expect(deserializeSessionLocalStorage(raw)).toEqual({ auth_state: 'ready' })
  })

  it('preserves additional session domains and suffix-matched localStorage keys', () => {
    const raw = serializeSessionCookies(
      [
        { name: 'SUB', value: 'weibo', domain: '.weibo.com' },
        { name: 'SUB', value: 'sina', domain: '.sina.com.cn' },
        { name: 'foreign', value: 'discard', domain: '.example.net' },
      ],
      'https://weibo.com',
      '.weibo.com',
      undefined,
      { '4055254406_degraded': 'state', unrelated: 'discard' },
      { keySuffixes: ['_degraded'] },
      ['.sina.com.cn'],
    )

    expect(deserializeSessionCookies(raw, 'https://weibo.com', '.weibo.com')).toEqual([
      expect.objectContaining({ name: 'SUB', value: 'weibo', domain: '.weibo.com' }),
      expect.objectContaining({ name: 'SUB', value: 'sina', domain: '.sina.com.cn' }),
    ])
    expect(deserializeSessionLocalStorage(raw)).toEqual({
      '4055254406_degraded': 'state',
    })
  })

  it('supports legacy cookie header payloads', () => {
    expect(deserializeSessionCookies('a=1; b=two', siteUrl)).toEqual([
      expect.objectContaining({ name: 'a', value: '1', url: siteUrl }),
      expect.objectContaining({ name: 'b', value: 'two', url: siteUrl }),
    ])
  })
})
