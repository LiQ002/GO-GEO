/**
 * GeoJobService — thin wrapper that delegates GEO (查收录) jobs to a
 * standalone Node.js worker process (geo-worker.ts).
 *
 * The worker runs browser automation in a clean Node.js environment (not
 * Electron), avoiding the environment fingerprints that trigger risk control
 * on platforms like yuanbao (元宝). See GeoWorkerRunner for spawn/IPC details.
 */

import type { GeoJobInput, GeoJobResult } from '../../../lib/ipc-contract'
import { createLogger } from '../logger'
import { geoWorkerRunner } from './GeoWorkerRunner'

const log = createLogger('GeoJobService')

export class GeoJobService {
  async run(input: GeoJobInput): Promise<GeoJobResult> {
    log.info('GEO job started', { jobId: input.jobId, platformName: input.platformName })
    const startedAt = Date.now()

    try {
      const result = await geoWorkerRunner.runGeoJob(input)

      // 答案过短或为空时标记为失败（如元宝移动端“请求失败”等错误提示）
      const isFailed = result.answerStatus === 'too_short' || result.answerStatus === 'empty'
      const errorMsg = isFailed
        ? `AI 回答内容异常（${result.answerStatus === 'too_short' ? `仅 ${result.answerText.length} 字符，疑似错误提示` : '回答为空'}）`
        : ''

      log.info('GEO job finished', {
        jobId: input.jobId,
        answerStatus: result.answerStatus,
        durationMs: Date.now() - startedAt,
      })

      return {
        jobId: input.jobId,
        taskId: input.taskId,
        enterpriseId: input.enterpriseId,
        platformName: input.platformName,
        status: isFailed ? 'failed' : 'success',
        errorMsg,
        executedAt: new Date().toISOString(),
        questionText: input.question,
        answerText: result.answerText,
        answerStatus: result.answerStatus,
        screenshotKey: result.screenshotKey,
        sessionRef: result.sessionRef,
        citations: result.citations,
        // mentions + analysisResult 由后端 computeGeoAnalysis 计算
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('GEO job failed', { jobId: input.jobId, error: message })
      return {
        jobId: input.jobId,
        taskId: input.taskId,
        enterpriseId: input.enterpriseId,
        platformName: input.platformName,
        status: 'failed',
        errorMsg: message,
        executedAt: new Date().toISOString(),
      }
    }
  }
}

export const geoJobService = new GeoJobService()
