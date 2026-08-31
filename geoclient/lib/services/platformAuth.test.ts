import { describe, expect, it } from 'vitest'
import { resolvePlatformSecret } from './platformAuth'

describe('platform authorization secret resolution', () => {
  it('uses the freshly fetched server ciphertext', () => {
    expect(resolvePlatformSecret('  aes:v2:new-ciphertext  ')).toEqual({
      encryptedSecret: 'aes:v2:new-ciphertext',
    })
  })

  it('returns an empty secret when the server has no credential', () => {
    expect(resolvePlatformSecret()).toEqual({ encryptedSecret: '' })
  })
})
