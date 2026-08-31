import { describe, expect, it } from 'vitest'
import {
  deserializeSessionCookies,
  deserializeSessionLocalStorage,
  serializeSessionCookies,
} from '../cookies'
import { sohuPublisher } from './index'

describe('Sohu authentication', () => {
  it('replays scoped cookies before navigation without stored browser state', () => {
    const raw = serializeSessionCookies(
      [
        { name: 'ppinf', value: 'passport-session', domain: '.sohu.com' },
        { name: 'pprdig', value: 'passport-digest', domain: '.sohu.com' },
        { name: 'ppmdig', value: 'media-digest', domain: 'mp.sohu.com' },
        { name: 'mp-cv', value: 'client-version', domain: 'mp.sohu.com' },
      ],
      sohuPublisher.cookieSiteUrl!,
      sohuPublisher.cookieDomain,
      sohuPublisher.cookiePersistFilter,
      {
        ticket: 'sso-ticket',
        currentAccount: '{"id":10001,"status":1}',
        vuex: '{"app":{"userInfo":{"id":10001}}}',
        accountsNum: '1',
        toPath: '/contentManagement/first/page',
        source: 'login',
      },
      sohuPublisher.localStoragePersistFilter,
      sohuPublisher.additionalCookieDomains,
    )

    expect(
      deserializeSessionCookies(
        raw,
        sohuPublisher.cookieSiteUrl!,
        sohuPublisher.cookieDomain,
      ),
    ).toEqual([
      expect.objectContaining({ name: 'ppinf', domain: '.sohu.com' }),
      expect.objectContaining({ name: 'pprdig', domain: '.sohu.com' }),
      expect.objectContaining({ name: 'ppmdig', domain: 'mp.sohu.com' }),
      expect.objectContaining({ name: 'mp-cv', domain: 'mp.sohu.com' }),
    ])
    expect(deserializeSessionLocalStorage(raw)).toBeUndefined()
    expect(sohuPublisher.preloadAuthState).toBe(true)
    expect(sohuPublisher.useStealth).toBe(false)
  })
})
