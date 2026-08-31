import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultServerURL, normalizeServerURL } from './server-url'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('default server URL', () => {
  it('uses HTTP only for development builds', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '')
    expect(getDefaultServerURL()).toBe('http://geo-enterprise.d.gbicom.com')
  })

  it('uses HTTPS for production builds', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '')
    expect(getDefaultServerURL()).toBe('https://geo-enterprise.d.gbicom.com')
  })
})

describe('server URL policy', () => {
  it('allows HTTP while running an explicit development server', () => {
    expect(normalizeServerURL('http://test-api.example.com/', true)).toBe(
      'http://test-api.example.com',
    )
  })

  it('requires HTTPS in production builds', () => {
    expect(() => normalizeServerURL('http://test-api.example.com', false)).toThrow(
      '正式环境必须使用 HTTPS',
    )
    expect(normalizeServerURL('https://api.example.com/', false)).toBe(
      'https://api.example.com',
    )
  })

  it('rejects non-HTTP protocols in every environment', () => {
    expect(() => normalizeServerURL('file:///tmp/api', true)).toThrow()
  })
})
