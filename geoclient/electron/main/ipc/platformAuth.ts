import type { IpcMain, WebContents } from 'electron'
import type { PublishArticleInput } from '../../../lib/platforms/types'
import type { PlatformKind } from '../../../lib/platforms/unified'
import { authService } from '../services/AuthService'
import { publishService } from '../services/PublishService'
import { sessionManager } from '../services/SessionManager'
import { requirePlatformLoginUrl } from '../../../lib/platform-manifest'

function requirePlatformName(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z0-9_-]{1,50}$/.test(value)) {
    throw new Error('Invalid platform name')
  }
  return value
}

function optionalKind(value: unknown): PlatformKind | undefined {
  if (value === undefined) return undefined
  if (value === 'media' || value === 'model') return value
  throw new Error('Invalid platform kind')
}

function requireEncryptedSecret(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2_000_000) {
    throw new Error('Invalid platform credentials')
  }
  return value
}

export function registerPlatformAuthIpc(ipcMain: IpcMain, getWebContents: () => WebContents) {
  publishService.setProgressTarget(getWebContents)

  ipcMain.handle(
    'platformAuth:openLogin',
    async (
      _evt,
      payload: {
        platformName: string
        kind?: PlatformKind
        sessionId?: string
        loginUrl?: string
      },
    ) => {
      if (payload.sessionId) {
        await sessionManager.close(payload.sessionId)
      }
      const platformName = requirePlatformName(payload.platformName)
      const kind = optionalKind(payload.kind) ?? 'media'
      const loginUrl = requirePlatformLoginUrl(platformName, kind, payload.loginUrl)
      return authService.openLogin(platformName, loginUrl, kind)
    },
  )

  ipcMain.handle(
    'platformAuth:getCookie',
    async (_evt, payload?: { sessionId?: string }) => {
      return authService.captureCredentials(payload?.sessionId)
    },
  )

  ipcMain.handle(
    'platformAuth:close',
    async (_evt, payload?: { sessionId?: string }) => {
      return authService.close(payload?.sessionId)
    },
  )

  ipcMain.handle(
    'platformAuth:openPublish',
    async (
      _evt,
      payload: {
        platformName: string
        encryptedSecret: string
        kind?: PlatformKind
        sessionId?: string
      },
    ) => {
      if (payload.sessionId) {
        await sessionManager.close(payload.sessionId)
      } else {
        await sessionManager.closeAll()
      }
      return publishService.openPublish({
        platformName: requirePlatformName(payload.platformName),
        encryptedSecret: requireEncryptedSecret(payload.encryptedSecret),
        kind: optionalKind(payload.kind),
      })
    },
  )

  ipcMain.handle(
    'platformAuth:publishArticle',
    async (
      _evt,
      payload: {
        platformName: string
        encryptedSecret: string
        article: PublishArticleInput
        kind?: PlatformKind
        sessionId?: string
      },
    ) => {
      return publishService.publishArticle({
        ...payload,
        platformName: requirePlatformName(payload.platformName),
        encryptedSecret: requireEncryptedSecret(payload.encryptedSecret),
        kind: optionalKind(payload.kind),
      })
    },
  )
}
