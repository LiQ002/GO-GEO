import { describe, expect, it } from 'vitest'
import { resolveDevRendererUrl } from './devRendererUrl'

describe('development renderer URL', () => {
  it('defaults to the client development port', () => {
    expect(resolveDevRendererUrl()).toBe('http://localhost:3000')
  })

  it('accepts the fixed operator port', () => {
    expect(resolveDevRendererUrl('http://localhost:3001/login')).toBe(
      'http://localhost:3001',
    )
  })

  it('rejects remote renderer origins', () => {
    expect(() => resolveDevRendererUrl('http://example.com:3001')).toThrow(
      'loopback HTTP(S) URL',
    )
  })
})
