import type {
  PublishJobInput,
  PublishJobResult,
  PublishJobTargetResult,
} from '../../../lib/ipc-contract'
import { createLogger } from '../logger'
import { publishService } from './PublishService'
import { sessionManager } from './SessionManager'

const log = createLogger('PublishJobService')

type QueueItem = {
  input: PublishJobInput
  resolve: (result: PublishJobResult) => void
  reject: (error: unknown) => void
}

export class PublishJobService {
  private readonly maxConcurrent = 2
  private readonly queue: QueueItem[] = []
  private readonly active = new Set<string>()
  private readonly cancelled = new Set<string>()
  private readonly pending = new Map<string, Promise<PublishJobResult>>()

  run(input: PublishJobInput): Promise<PublishJobResult> {
    const existing = this.pending.get(input.jobId)
    if (existing) return existing

    const promise = new Promise<PublishJobResult>((resolve, reject) => {
      this.queue.push({ input, resolve, reject })
      this.pump()
    }).finally(() => {
      this.pending.delete(input.jobId)
      this.cancelled.delete(input.jobId)
    })
    this.pending.set(input.jobId, promise)
    return promise
  }

  cancel(jobId: string): boolean {
    if (!this.pending.has(jobId)) return false
    this.cancelled.add(jobId)
    return true
  }

  private pump() {
    while (this.active.size < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift()!
      this.active.add(item.input.jobId)
      void this.execute(item.input)
        .then(item.resolve, item.reject)
        .finally(() => {
          this.active.delete(item.input.jobId)
          this.pump()
        })
    }
  }

  private async execute(input: PublishJobInput): Promise<PublishJobResult> {
    const results: PublishJobTargetResult[] = []
    const total = input.targets.length
    publishService.emitProgress({
      type: 'start',
      platformName: input.targets[0]?.platformName ?? 'unknown',
      jobId: input.jobId,
      taskId: input.taskId,
      articleId: input.articleId,
      done: 0,
      total,
      message: '发布任务开始执行',
    })

    for (const [index, target] of input.targets.entries()) {
      if (this.cancelled.has(input.jobId)) {
        results.push({
          platformName: target.platformName,
          accountId: target.accountId ?? '',
          accountName: target.accountName ?? '',
          status: 'skipped',
          errorMsg: '任务已取消',
          executedAt: new Date().toISOString(),
        })
        continue
      }

      publishService.emitProgress({
        type: 'progress',
        platformName: target.platformName,
        jobId: input.jobId,
        taskId: input.taskId,
        articleId: input.articleId,
        accountId: target.accountId,
        done: index,
        total,
        message: `正在发布到 ${target.accountName || target.platformName}`,
      })

      const result = await publishService.publishArticle(
        {
          platformName: target.platformName,
          encryptedSecret: target.encryptedSecret,
          article: input.article,
          kind: 'media',
          loginUrl: target.loginUrl,
        },
        { silent: true },
      )

      if (result.ok && result.sessionId) await sessionManager.closeOne(result.sessionId)
      results.push({
        platformName: target.platformName,
        accountId: target.accountId ?? '',
        accountName: target.accountName ?? '',
        status: result.ok ? 'success' : 'failed',
        errorMsg: result.ok ? '' : result.message,
        executedAt: new Date().toISOString(),
        publishedUrl: result.ok && 'publishedUrl' in result ? (result.publishedUrl as string | undefined) : undefined,
        platformArticleId:
          result.ok && 'platformArticleId' in result
            ? (result.platformArticleId as string | undefined)
            : undefined,
      })
    }

    const failed = results.filter((result) => result.status === 'failed').length
    log.info('Publish job finished', { jobId: input.jobId, total, failed })
    publishService.emitProgress({
      type: failed > 0 ? 'error' : 'complete',
      platformName: input.targets.at(-1)?.platformName ?? 'unknown',
      jobId: input.jobId,
      taskId: input.taskId,
      articleId: input.articleId,
      done: results.length,
      total,
      message: failed > 0 ? `${failed} 个目标发布失败` : '发布任务完成',
    })

    return {
      jobId: input.jobId,
      taskId: input.taskId,
      enterpriseId: input.enterpriseId,
      articleId: input.articleId,
      results,
    }
  }
}

export const publishJobService = new PublishJobService()
