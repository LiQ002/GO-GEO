import type { PublishArticleInput } from '@/lib/platforms/types'
import type { BrowserRuntimeConfiguration, GeoJobInput, GeoJobResult, PublishJobInput, PublishJobResult, PublishProgressEvent } from '@/lib/ipc-contract'

export interface ElectronAPI {
  platform: string
  versions: {
    node: string
    chrome: string
    electron: string
  }
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
  }
  platformAuth: {
    openLogin: (
      platformName: string,
      kind?: 'media' | 'model',
      sessionId?: string,
      loginUrl?: string,
    ) => Promise<{ ok: true; sessionId: string }>
    getCookie: (
      sessionId?: string,
    ) => Promise<
      | { ok: true; encryptedSecret: string; sessionId: string }
      | { ok: false; message: string }
    >
    close: (sessionId?: string) => Promise<{ ok: true }>
    openPublish: (
      platformName: string,
      encryptedSecret: string,
      kind?: 'media' | 'model',
      sessionId?: string,
    ) => Promise<{ ok: true; sessionId: string }>
    publishArticle: (
      platformName: string,
      encryptedSecret: string,
      article: PublishArticleInput,
      kind?: 'media' | 'model',
      sessionId?: string,
    ) => Promise<
      | {
          ok: true
          sessionId: string
          publishedUrl: string
          platformArticleId?: string
        }
      | { ok: false; message: string }
    >
  }
  onPublishProgress: (callback: (event: PublishProgressEvent) => void) => () => void
  publishJobs: {
    run: (input: PublishJobInput) => Promise<PublishJobResult>
    cancel: (jobId: string) => Promise<boolean>
  }
  geoJobs: {
    run: (input: GeoJobInput) => Promise<GeoJobResult>
  }
  authSession: {
    get: () => Promise<{ accessToken: string; refreshToken: string; workerToken?: string } | null>
    set: (accessToken: string, refreshToken: string) => Promise<void>
    setWorkerToken: (workerToken: string) => Promise<void>
    clear: () => Promise<void>
  }
  browserRuntime: {
    get: () => Promise<BrowserRuntimeConfiguration>
    select: () => Promise<BrowserRuntimeConfiguration>
    clear: () => Promise<BrowserRuntimeConfiguration>
  }
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
