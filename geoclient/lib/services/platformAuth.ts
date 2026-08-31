/** Shared platform authorization orchestration for renderer pages. */

export type PlatformAuthKind = 'media' | 'model'

export type PlatformSecret = {
  encryptedSecret: string
}

/** Use only the ciphertext freshly fetched from the server for this click. */
export function resolvePlatformSecret(encryptedSecret?: string | null): PlatformSecret {
  return { encryptedSecret: encryptedSecret?.trim() || '' }
}

export function validatePlatformSecret(secret: PlatformSecret): string | null {
  return secret.encryptedSecret.trim() ? null : '未找到平台授权信息，请先重新授权一次'
}

export type SaveAuthParams = {
  platformLabel: string
  sessionId?: string
  /** Persist already-encrypted `cookie_encrypted` payload to the backend. */
  persist: (encryptedSecret: string) => Promise<void>
}

export async function savePlatformAuth(params: SaveAuthParams) {
  const api = window.electronAPI?.platformAuth
  if (!api) {
    throw new Error('Electron API unavailable')
  }

  const result = await api.getCookie(params.sessionId)
  if (!result || !result.ok) {
    throw new Error('尚未获取到 Cookie，请确认已在登录窗口完成登录')
  }

  const encryptedSecret = result.encryptedSecret.trim()
  if (!encryptedSecret) throw new Error('平台授权信息为空，请确认已成功登录')

  await params.persist(encryptedSecret)
  await api.close(params.sessionId ?? result.sessionId)

  return { encryptedSecret, label: params.platformLabel }
}

export async function openPlatformSession(
  platformName: string,
  kind: PlatformAuthKind = 'media',
  sessionId?: string,
  loginUrl?: string,
) {
  const api = window.electronAPI?.platformAuth
  if (!api) {
    throw new Error('Electron API unavailable')
  }
  return api.openLogin(platformName, kind, sessionId, loginUrl)
}

export async function openPlatformWithSecret(
  platformName: string,
  secret: PlatformSecret,
  kind: PlatformAuthKind = 'media',
) {
  const error = validatePlatformSecret(secret)
  if (error) {
    throw new Error(error)
  }

  const api = window.electronAPI?.platformAuth
  if (!api) {
    throw new Error('Electron API unavailable')
  }

  return api.openPublish(platformName, secret.encryptedSecret, kind)
}
