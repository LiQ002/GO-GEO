import { app, BrowserWindow, dialog, ipcMain, session as electronSession, shell } from 'electron'
import serve from 'electron-serve'
import { join } from 'path'
import { registerPlatformAuthIpc } from './ipc/platformAuth'
import { browserRegistry } from './services/BrowserRegistry'
import { browserRuntimeService } from './services/BrowserRuntimeService'
import { authSessionService } from './services/AuthSessionService'
import { registerPublishJobIpc } from './ipc/publishJobs'
import { registerGeoJobIpc } from './ipc/geoJobs'
import { createLogger, flushFileLogs, initializeFileLogging } from './logger'
import { resolveDevRendererUrl } from './devRendererUrl'

const log = createLogger('Main')

// Compiled entry lives at main/electron/main/index.js; static export is at <app>/out.
// Prefer app.getAppPath() so the path stays correct under asar and across platforms.
const appServe = app.isPackaged
  ? serve({
      directory: join(app.getAppPath(), 'out'),
    })
  : null

let mainWindow: BrowserWindow | null = null
let ipcRegistered = false

const RENDERER_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ')

function isAllowedRendererNavigation(rawUrl: string, devRendererOrigin?: string) {
  try {
    const url = new URL(rawUrl)
    if (devRendererOrigin) return url.origin === devRendererOrigin
    return url.protocol === 'app:' && url.hostname === '-'
  } catch {
    return false
  }
}

function configureSessionSecurity() {
  const defaultSession = electronSession.defaultSession
  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  if (app.isPackaged) {
    defaultSession.webRequest.onHeadersReceived((details, callback) => {
      if (!details.url.startsWith('app://-')) {
        callback({ responseHeaders: details.responseHeaders })
        return
      }
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [RENDERER_CSP],
        },
      })
    })
  }
}

function getMainWebContents() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Main window is unavailable')
  }
  return mainWindow.webContents
}

function registerIpcHandlers() {
  if (ipcRegistered) return
  ipcRegistered = true

  registerPlatformAuthIpc(ipcMain, getMainWebContents)
  registerPublishJobIpc(ipcMain)
  registerGeoJobIpc(ipcMain)
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
  ipcMain.handle('authSession:get', () => authSessionService.get())
  ipcMain.handle(
    'authSession:set',
    (_event, payload: { accessToken?: unknown; refreshToken?: unknown }) => {
      if (
        typeof payload.accessToken !== 'string' ||
        typeof payload.refreshToken !== 'string' ||
        payload.accessToken.length > 16_384 ||
        payload.refreshToken.length > 16_384
      ) {
        throw new Error('Invalid auth session')
      }
      return authSessionService.setAuthTokens(payload.accessToken, payload.refreshToken)
    },
  )
  ipcMain.handle('authSession:setWorkerToken', (_event, workerToken: unknown) => {
    if (typeof workerToken !== 'string' || workerToken.length < 16 || workerToken.length > 16_384) {
      throw new Error('Invalid worker token')
    }
    return authSessionService.setWorkerToken(workerToken)
  })
  ipcMain.handle('authSession:clear', () => authSessionService.clear())
  ipcMain.handle('browserRuntime:get', () => browserRuntimeService.getConfiguration())
  ipcMain.handle('browserRuntime:select', async () => {
    const options: Electron.OpenDialogOptions = {
      title: '选择本机 Chrome 可执行文件',
      properties: ['openFile'],
      filters: process.platform === 'win32'
        ? [{ name: 'Google Chrome', extensions: ['exe'] }]
        : undefined,
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) {
      return browserRuntimeService.getConfiguration()
    }
    return browserRuntimeService.setExecutablePath(result.filePaths[0])
  })
  ipcMain.handle('browserRuntime:clear', () => browserRuntimeService.clear())
}

function createWindow(): void {
  const isDev = !app.isPackaged
  const devRendererUrl = isDev
    ? resolveDevRendererUrl(process.env.ELECTRON_RENDERER_URL)
    : undefined

  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 660,
    frame: false,
    show: false,
    backgroundColor: '#f4f6fb',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow = window

  window.on('ready-to-show', () => {
    window.show()
    if (isDev) {
      window.webContents.openDevTools({ mode: 'detach' })
    }
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const protocol = new URL(url).protocol
      if (protocol === 'https:' || (protocol === 'http:' && !app.isPackaged)) {
        void shell.openExternal(url)
      }
    } catch {
      // Invalid URLs are denied below.
    }
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedRendererNavigation(url, devRendererUrl)) {
      event.preventDefault()
      log.warn('Blocked renderer navigation', { url })
    }
  })

  window.webContents.on('will-redirect', (event, url) => {
    if (!isAllowedRendererNavigation(url, devRendererUrl)) {
      event.preventDefault()
      log.warn('Blocked renderer redirect', { url })
    }
  })

  if (devRendererUrl) {
    void window.loadURL(devRendererUrl)
    window.webContents.on('did-fail-load', () => {
      window.webContents.reloadIgnoringCache()
    })
  } else if (appServe) {
    void appServe(window)
  }

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })
}

app.whenReady().then(async () => {
  const logFilePath = await initializeFileLogging(app.getPath('logs')).catch((error) => {
    log.error('Unable to initialize file logging', error)
    return null
  })
  log.info('Application ready', {
    version: app.getVersion(),
    packaged: app.isPackaged,
    logFilePath,
  })

  configureSessionSecurity()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

let shutdownStarted = false
app.on('before-quit', (event) => {
  if (shutdownStarted) return
  shutdownStarted = true
  event.preventDefault()

  log.info('Application shutdown started', { trackedBrowsers: browserRegistry.size })
  const hardExitTimer = setTimeout(() => {
    log.warn('Application shutdown timed out; exiting immediately')
    app.exit(0)
  }, 1_500)

  void browserRegistry
    .closeAll()
    .catch((error) => log.error('Failed to close browser processes', error))
    .then(() => flushFileLogs())
    .finally(() => {
      clearTimeout(hardExitTimer)
      app.exit(0)
    })
})

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception', error)
})

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection', reason)
})
