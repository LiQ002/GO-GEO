import { contextBridge, ipcRenderer } from 'electron'
import type { PublishArticleInput } from '../../lib/platforms/types'
import type {
  GeoJobInput,
  GeoJobResult,
  BrowserRuntimeConfiguration,
  PlatformKind,
  PublishJobInput,
  PublishJobResult,
  PublishProgressEvent,
} from '../../lib/ipc-contract'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },
  platformAuth: {
    openLogin: (
      platformName: string,
      kind?: PlatformKind,
      sessionId?: string,
      loginUrl?: string,
    ) =>
      ipcRenderer.invoke('platformAuth:openLogin', {
        platformName,
        kind,
        sessionId,
        loginUrl,
      }),
    getCookie: (sessionId?: string) =>
      ipcRenderer.invoke('platformAuth:getCookie', sessionId ? { sessionId } : undefined),
    close: (sessionId?: string) =>
      ipcRenderer.invoke('platformAuth:close', sessionId ? { sessionId } : undefined),
    openPublish: (
      platformName: string,
      encryptedSecret: string,
      kind?: PlatformKind,
      sessionId?: string,
    ) =>
      ipcRenderer.invoke('platformAuth:openPublish', {
        platformName,
        encryptedSecret,
        kind,
        sessionId,
      }),
    publishArticle: (
      platformName: string,
      encryptedSecret: string,
      article: PublishArticleInput,
      kind?: PlatformKind,
      sessionId?: string,
    ) =>
      ipcRenderer.invoke('platformAuth:publishArticle', {
        platformName,
        encryptedSecret,
        article,
        kind,
        sessionId,
      }),
  },
  onPublishProgress: (callback: (event: PublishProgressEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: PublishProgressEvent) => {
      callback(payload)
    }
    ipcRenderer.on('publish:progress', listener)
    return () => {
      ipcRenderer.removeListener('publish:progress', listener)
    }
  },
  publishJobs: {
    run: (input: PublishJobInput): Promise<PublishJobResult> =>
      ipcRenderer.invoke('publishJobs:run', input),
    cancel: (jobId: string): Promise<boolean> => ipcRenderer.invoke('publishJobs:cancel', jobId),
  },
  geoJobs: {
    run: (input: GeoJobInput): Promise<GeoJobResult> =>
      ipcRenderer.invoke('geoJobs:run', input),
  },
  authSession: {
    get: () => ipcRenderer.invoke('authSession:get'),
    set: (accessToken: string, refreshToken: string) =>
      ipcRenderer.invoke('authSession:set', { accessToken, refreshToken }),
    setWorkerToken: (workerToken: string) =>
      ipcRenderer.invoke('authSession:setWorkerToken', workerToken),
    clear: () => ipcRenderer.invoke('authSession:clear'),
  },
  browserRuntime: {
    get: (): Promise<BrowserRuntimeConfiguration> => ipcRenderer.invoke('browserRuntime:get'),
    select: (): Promise<BrowserRuntimeConfiguration> => ipcRenderer.invoke('browserRuntime:select'),
    clear: (): Promise<BrowserRuntimeConfiguration> => ipcRenderer.invoke('browserRuntime:clear'),
  },
})
