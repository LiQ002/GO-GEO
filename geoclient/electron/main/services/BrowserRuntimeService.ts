import { app } from 'electron'
import { access, mkdir, readFile, rename, stat, unlink, writeFile } from 'fs/promises'
import { constants } from 'fs'
import { basename, dirname, join, win32 as windowsPath } from 'path'
import type { BrowserRuntimeConfiguration } from '../../../lib/ipc-contract'

type StoredBrowserRuntime = {
  v: 1
  executablePath: string
}

const SUPPORTED_EXECUTABLE_NAMES: Record<NodeJS.Platform, readonly string[]> = {
  aix: [],
  android: [],
  darwin: ['Google Chrome', 'Google Chrome for Testing', 'Chromium'],
  freebsd: ['chrome', 'chromium'],
  haiku: [],
  linux: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'],
  openbsd: ['chrome', 'chromium'],
  sunos: [],
  win32: ['chrome.exe'],
  cygwin: ['chrome.exe'],
  netbsd: ['chrome', 'chromium'],
}

export function isSupportedChromeExecutablePath(
  executablePath: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const name = (platform === 'win32' || platform === 'cygwin'
    ? windowsPath.basename(executablePath)
    : basename(executablePath)
  ).toLowerCase()
  return (SUPPORTED_EXECUTABLE_NAMES[platform] ?? []).some(
    (candidate) => candidate.toLowerCase() === name,
  )
}

export class BrowserRuntimeService {
  private get filePath() {
    return join(app.getPath('appData'), 'GeoHelper', 'runtime-settings.json')
  }

  async getConfiguration(): Promise<BrowserRuntimeConfiguration> {
    const executablePath = await this.readExecutablePath()
    if (!executablePath) {
      return {
        executablePath: '',
        valid: false,
        error: '尚未配置本机 Chrome，请先在系统设置中选择 chrome.exe',
      }
    }

    try {
      await this.validateExecutablePath(executablePath)
      return { executablePath, valid: true }
    } catch (error) {
      return {
        executablePath,
        valid: false,
        error: error instanceof Error ? error.message : 'Chrome 路径不可用',
      }
    }
  }

  async setExecutablePath(executablePath: string): Promise<BrowserRuntimeConfiguration> {
    const normalizedPath = executablePath.trim()
    await this.validateExecutablePath(normalizedPath)

    const filePath = this.filePath
    const tempPath = `${filePath}.tmp`
    const stored: StoredBrowserRuntime = { v: 1, executablePath: normalizedPath }
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(tempPath, `${JSON.stringify(stored)}\n`, { mode: 0o600 })
    await rename(tempPath, filePath)
    return { executablePath: normalizedPath, valid: true }
  }

  async clear(): Promise<BrowserRuntimeConfiguration> {
    await unlink(this.filePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
    return {
      executablePath: '',
      valid: false,
      error: '尚未配置本机 Chrome，请先在系统设置中选择 chrome.exe',
    }
  }

  async requireExecutablePath(): Promise<string> {
    const configuration = await this.getConfiguration()
    if (!configuration.valid) {
      throw new Error(configuration.error || '本机 Chrome 配置不可用')
    }
    return configuration.executablePath
  }

  private async readExecutablePath(): Promise<string> {
    try {
      const stored = JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<StoredBrowserRuntime>
      if (stored.v !== 1 || typeof stored.executablePath !== 'string') return ''
      return stored.executablePath.trim()
    } catch {
      return ''
    }
  }

  private async validateExecutablePath(executablePath: string): Promise<void> {
    if (!executablePath || executablePath.length > 4_096 || executablePath.includes('\0')) {
      throw new Error('请选择有效的 Chrome 可执行文件')
    }
    if (!isSupportedChromeExecutablePath(executablePath)) {
      throw new Error('所选文件不是受支持的 Chrome 可执行文件')
    }

    const file = await stat(executablePath).catch(() => null)
    if (!file?.isFile()) {
      throw new Error('所选 Chrome 文件不存在或不是可执行文件')
    }
    await access(
      executablePath,
      process.platform === 'win32' ? constants.R_OK : constants.R_OK | constants.X_OK,
    ).catch(() => {
      throw new Error('当前用户无权运行所选 Chrome 文件')
    })
  }
}

export const browserRuntimeService = new BrowserRuntimeService()
