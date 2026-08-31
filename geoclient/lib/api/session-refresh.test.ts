import { describe, expect, it } from 'vitest'
import {
  accessTokenNeedsRefresh,
  authRefreshPath,
  jwtExpirationMs,
  RefreshCoordinator,
} from './session-refresh'

function unsignedToken(expiresAtSeconds: number): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ exp: expiresAtSeconds })}.signature`
}

describe('desktop session refresh', () => {
  it('refreshes access tokens inside the five-minute expiration window', () => {
    const now = Date.UTC(2026, 7, 11, 10, 0, 0)
    const tenMinutesLater = Math.floor((now + 10 * 60 * 1000) / 1000)
    const fourMinutesLater = Math.floor((now + 4 * 60 * 1000) / 1000)

    expect(accessTokenNeedsRefresh(unsignedToken(tenMinutesLater), now)).toBe(false)
    expect(accessTokenNeedsRefresh(unsignedToken(fourMinutesLater), now)).toBe(true)
  })

  it('treats missing and malformed access tokens as requiring refresh', () => {
    expect(accessTokenNeedsRefresh(undefined)).toBe(true)
    expect(accessTokenNeedsRefresh('not-a-jwt')).toBe(true)
    expect(jwtExpirationMs('not-a-jwt')).toBeNull()
  })

  it('uses the correct refresh endpoint for client and operator modes', () => {
    expect(authRefreshPath(false)).toBe('/api/user/v1/auth/refresh')
    expect(authRefreshPath(true)).toBe('/api/admin/v1/auth/refresh')
  })

  it('merges concurrent refreshes and briefly reuses a successful result', async () => {
    let now = 1_000
    let calls = 0
    const coordinator = new RefreshCoordinator<{ kind: string; token: string }>(
      10_000,
      () => now,
    )
    const refresh = async () => {
      calls += 1
      await Promise.resolve()
      return { kind: 'success', token: `token-${calls}` }
    }
    const retainSuccess = (result: { kind: string }) => result.kind === 'success'

    const [first, second] = await Promise.all([
      coordinator.run('old-refresh-token', refresh, retainSuccess),
      coordinator.run('old-refresh-token', refresh, retainSuccess),
    ])
    const graceResult = await coordinator.run('old-refresh-token', refresh, retainSuccess)

    expect(calls).toBe(1)
    expect(second).toEqual(first)
    expect(graceResult).toEqual(first)

    now += 10_001
    const renewed = await coordinator.run('old-refresh-token', refresh, retainSuccess)
    expect(calls).toBe(2)
    expect(renewed.token).toBe('token-2')
  })

  it('does not cache failed refreshes', async () => {
    let calls = 0
    const coordinator = new RefreshCoordinator<{ kind: string }>()
    const refresh = async () => {
      calls += 1
      return { kind: 'unavailable' }
    }

    await coordinator.run('refresh-token', refresh, () => false)
    await coordinator.run('refresh-token', refresh, () => false)

    expect(calls).toBe(2)
  })
})
