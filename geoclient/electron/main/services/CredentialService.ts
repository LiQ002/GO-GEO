import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const SHARED_AES_PREFIX = 'aes:v2:'
const AES_IV_BYTES = 12
const AES_AUTH_TAG_BYTES = 16
// Current release compatibility key. COOKIE_AES_KEY can replace it in both clients.
// A KMS-backed envelope should replace this shared key in a later security release.
const DEFAULT_SHARED_AES_SECRET = 'd365bd18ba832a973c60ea8dd3d50ceb'

export type PlatformCredentials = {
  cookie: string
  authUrl: string
}

type StoredCredentials = PlatformCredentials & { v: 1 }

function parseCredentials(raw: string, fallbackAuthUrl = ''): PlatformCredentials {
  const parsed = JSON.parse(raw) as Partial<StoredCredentials>
  if (typeof parsed.cookie !== 'string' || !parsed.cookie.trim()) {
    throw new Error('Stored platform credentials are invalid')
  }
  return {
    cookie: parsed.cookie,
    authUrl: typeof parsed.authUrl === 'string' ? parsed.authUrl : fallbackAuthUrl,
  }
}

function sharedAesKey(): Buffer {
  const secret = process.env.COOKIE_AES_KEY?.trim() || DEFAULT_SHARED_AES_SECRET
  return createHash('sha256').update(secret).digest()
}

function encryptSharedAes(plaintext: string): string {
  const iv = randomBytes(AES_IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', sharedAesKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return SHARED_AES_PREFIX + Buffer.concat([iv, encrypted, tag]).toString('base64')
}

function decryptSharedAes(ciphertext: string, prefix: string): string {
  const raw = Buffer.from(ciphertext.slice(prefix.length), 'base64')
  if (raw.length <= AES_IV_BYTES + AES_AUTH_TAG_BYTES) {
    throw new Error('平台授权密文格式无效')
  }

  const iv = raw.subarray(0, AES_IV_BYTES)
  const encrypted = raw.subarray(AES_IV_BYTES, -AES_AUTH_TAG_BYTES)
  const tag = raw.subarray(-AES_AUTH_TAG_BYTES)
  const decipher = createDecipheriv('aes-256-gcm', sharedAesKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export class CredentialService {
  encrypt(credentials: PlatformCredentials): string {
    const payload: StoredCredentials = { v: 1, ...credentials }
    return encryptSharedAes(JSON.stringify(payload))
  }

  decrypt(encryptedSecret: string, fallbackAuthUrl = ''): PlatformCredentials {
    const raw = encryptedSecret.trim()
    if (!raw) throw new Error('未找到平台授权信息')

    if (!raw.startsWith(SHARED_AES_PREFIX)) {
      throw new Error('平台授权格式已过期，请在用户端重新授权该平台')
    }

    try {
      return parseCredentials(decryptSharedAes(raw, SHARED_AES_PREFIX), fallbackAuthUrl)
    } catch {
      throw new Error('平台授权解密失败，请确认用户端和运营端使用相同的 COOKIE_AES_KEY')
    }
  }
}

export const credentialService = new CredentialService()
