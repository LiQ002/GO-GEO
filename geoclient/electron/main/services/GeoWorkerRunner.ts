/**
 * GeoWorkerRunner — Electron-side manager for the GEO worker process.
 *
 * Spawns a standalone Node.js child process (via child_process.fork with
 * ELECTRON_RUN_AS_NODE=1) that runs geo-worker.ts.  The worker handles the
 * entire GEO job: browser launch → cookie injection → navigation → input →
 * wait → extract → return result.
 *
 * Why a separate process: Chrome launched from within Electron's main process
 * carries environment fingerprints that trigger risk control on platforms like
 * yuanbao (元宝).  Running puppeteer from a pure Node.js process avoids this.
 */

import { app } from 'electron'
import { fork } from 'node:child_process'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { createLogger } from '../logger'
import type { GeoJobInput } from '../../../lib/ipc-contract'
import { browserRuntimeService } from './BrowserRuntimeService'

const log = createLogger('GeoWorkerRunner')
// 专用 logger 用于转发 worker 进程的 IPC 日志。
// worker 不再直接 console.log（打包模式下会丢失），统一通过 IPC 发送给主进程，
// 由主进程 logger 写入 main.log 文件 + 终端输出。
const workerLog = createLogger('GeoWorker')

type WorkerResult = {
  answerText: string
  answerStatus: string
  screenshotKey?: string
  sessionRef?: string
  citations: import('../../../lib/ipc-contract').GeoCitation[]
}

type WorkerMessage =
  | { type: 'log'; level: string; scope: string; message: string; data?: unknown }
  | { type: 'result'; result: WorkerResult }
  | { type: 'error'; message: string; stack?: string }

/** Resolve the compiled worker script path (works in both dev and packaged).
 *  In packaged mode, the worker is unpacked from asar (asarUnpack config) because
 *  ELECTRON_RUN_AS_NODE=1 processes can't read from inside asar.
 */
function getWorkerScriptPath(): string {
  const asarPath = join(app.getAppPath(), 'main', 'electron', 'worker', 'geo-worker.js')
  if (!app.isPackaged) return asarPath
  // In packaged mode, asarUnpack extracts to app.asar.unpacked
  const unpackedPath = asarPath
    .replace('app.asar\\', 'app.asar.unpacked\\')
    .replace('app.asar/', 'app.asar.unpacked/')
  return existsSync(unpackedPath) ? unpackedPath : asarPath
}

export class GeoWorkerRunner {
  /**
   * Run a GEO job in a standalone Node.js worker process.
   * Returns the worker result or throws on error.
   */
  async runGeoJob(input: GeoJobInput): Promise<WorkerResult> {
    const workerScript = getWorkerScriptPath()
    const executablePath = await browserRuntimeService.requireExecutablePath()
    const evidenceDir = join(app.getPath('userData'), 'evidence', 'geo')

    log.info('Spawning GEO worker', {
      workerScript,
      executablePath,
      jobId: input.jobId,
      platformName: input.platformName,
    })

    return new Promise<WorkerResult>((resolve, reject) => {
      let settled = false
      const done = (fn: () => void) => { if (!settled) { settled = true; fn() } }

      const child = fork(workerScript, [], {
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
        },
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      })

      const timeout = 240_000 // 4 minutes hard limit (kimi 等平台回答生成可达 70s+，分享链接提取需额外时间)
      const timer = setTimeout(() => {
        log.error('GEO worker timed out, killing', { jobId: input.jobId, timeoutMs: timeout })
        child.kill('SIGKILL')
        done(() => reject(new Error(`GEO worker timed out after ${timeout / 1000}s`)))
      }, timeout)

      child.on('message', (msg: WorkerMessage) => {
        switch (msg.type) {
          // worker 通过 IPC 发送日志消息，主进程统一用 logger 输出（终端 + main.log 文件）。
          // worker 不再直接 console.log，避免打包模式下日志丢失。
          case 'log':
            switch (msg.level) {
              case 'error': workerLog.error(msg.message, msg.data); break
              case 'warn': workerLog.warn(msg.message, msg.data); break
              case 'info': workerLog.info(msg.message, msg.data); break
              default: workerLog.debug(msg.message, msg.data); break
            }
            break
          case 'result':
            clearTimeout(timer)
            log.info('GEO worker returned result', {
              jobId: input.jobId,
              answerStatus: msg.result.answerStatus,
              answerLength: msg.result.answerText.length,
              citations: msg.result.citations.length,
            })
            done(() => resolve(msg.result))
            break
          case 'error':
            clearTimeout(timer)
            log.error('GEO worker returned error', { jobId: input.jobId, message: msg.message })
            done(() => reject(new Error(msg.message)))
            break
        }
      })

      child.on('error', (err) => {
        clearTimeout(timer)
        log.error('GEO worker process error', { jobId: input.jobId, error: String(err) })
        done(() => reject(err))
      })

      child.on('exit', (code, signal) => {
        clearTimeout(timer)
        if (code !== 0 && code !== null) {
          log.warn('GEO worker exited with non-zero code', { jobId: input.jobId, code, signal })
          done(() => reject(new Error(`GEO worker crashed (exit code ${code})`)))
        }
      })

      // Send the job command to the worker
      child.send({
        type: 'geo-job',
        input,
        executablePath,
        evidenceDir,
      })
    })
  }
}

export const geoWorkerRunner = new GeoWorkerRunner()
