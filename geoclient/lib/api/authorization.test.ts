import { describe, expect, it } from 'vitest'
import { createAuthorizationHeader } from './authorization'

describe('authorization header', () => {
  it('uses the standard Bearer scheme for every application', () => {
    expect(createAuthorizationHeader('admin-token')).toBe('Bearer admin-token')
    expect(createAuthorizationHeader('enterprise-token')).toBe('Bearer enterprise-token')
  })
})
