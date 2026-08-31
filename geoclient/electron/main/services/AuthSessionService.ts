import { app, safeStorage } from 'electron'
import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

export type StoredAuthSession = {
  accessToken: string
  refreshToken: string
  workerToken?: string
}

type StoredFile = {
  v: 1
  encrypted: string
}

export class AuthSessionService {
  private get filePath() {
    return join(app.getPath('userData'), 'secure', 'auth-session.json')
  }

  async get(): Promise<StoredAuthSession | null> {
    if (!safeStorage.isEncryptionAvailable()) return null
    try {
      const file = JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<StoredFile>
      if (file.v !== 1 || typeof file.encrypted !== 'string') return null
      const decrypted = safeStorage.decryptString(Buffer.from(file.encrypted, 'base64'))
      const session = JSON.parse(decrypted) as Partial<StoredAuthSession>
      if (typeof session.accessToken !== 'string' || typeof session.refreshToken !== 'string') {
        return null
      }
      return {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        workerToken: typeof session.workerToken === 'string' ? session.workerToken : undefined,
      }
    } catch {
      return null
    }
  }

  async set(session: StoredAuthSession): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('系统安全存储不可用，无法保存登录状态')
    }
    const filePath = this.filePath
    const tempPath = `${filePath}.tmp`
    const encrypted = safeStorage.encryptString(JSON.stringify(session)).toString('base64')
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(tempPath, `${JSON.stringify({ v: 1, encrypted } satisfies StoredFile)}\n`, {
      mode: 0o600,
    })
    await rename(tempPath, filePath)
  }

  async setAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
    const existing = await this.get()
    await this.set({ accessToken, refreshToken, workerToken: existing?.workerToken })
  }

  async setWorkerToken(workerToken: string): Promise<void> {
    const existing = await this.get()
    if (!existing) throw new Error('请先登录运营管理平台，再注册工作节点')
    await this.set({ ...existing, workerToken })
  }

  async clear(): Promise<void> {
    await unlink(this.filePath).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err
    })
  }
}

export const authSessionService = new AuthSessionService()
