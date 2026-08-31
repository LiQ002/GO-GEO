import { afterEach, describe, expect, it } from 'vitest'

import { CredentialService } from './CredentialService'

describe('CredentialService', () => {
  afterEach(() => {
    delete process.env.COOKIE_AES_KEY
  })

  it('encrypts credentials for another client instance with the shared AES key', () => {
    process.env.COOKIE_AES_KEY = 'shared-test-key'
    const encrypted = new CredentialService().encrypt({
      cookie: 'SUB=credential',
      authUrl: 'https://example.com/publish',
    })

    expect(encrypted).toMatch(/^aes:v2:/)
    expect(new CredentialService().decrypt(encrypted)).toEqual({
      cookie: 'SUB=credential',
      authUrl: 'https://example.com/publish',
    })
  })

  it('uses a random IV for each authorization payload', () => {
    process.env.COOKIE_AES_KEY = 'shared-test-key'
    const credentials = { cookie: 'SUB=credential', authUrl: 'https://example.com/publish' }
    const service = new CredentialService()

    expect(service.encrypt(credentials)).not.toBe(service.encrypt(credentials))
  })

  it('rejects AES ciphertext when the two clients use different keys', () => {
    process.env.COOKIE_AES_KEY = 'client-key'
    const encrypted = new CredentialService().encrypt({ cookie: 'SUB=credential', authUrl: '' })

    process.env.COOKIE_AES_KEY = 'operator-key'
    expect(() => new CredentialService().decrypt(encrypted)).toThrow(
      '平台授权解密失败，请确认用户端和运营端使用相同的 COOKIE_AES_KEY',
    )
  })

  it('rejects credentials from releases before aes:v2', () => {
    expect(() => new CredentialService().decrypt('safe:v1:legacy')).toThrow(
      '平台授权格式已过期，请在用户端重新授权该平台',
    )
    expect(() => new CredentialService().decrypt('v1:legacy')).toThrow(
      '平台授权格式已过期，请在用户端重新授权该平台',
    )
  })
})
