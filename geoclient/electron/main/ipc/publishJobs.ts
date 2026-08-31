import type { IpcMain } from 'electron'
import type { PublishJobInput } from '../../../lib/ipc-contract'
import { publishJobService } from '../services/PublishJobService'

function validateJob(input: PublishJobInput): PublishJobInput {
  if (!input || typeof input !== 'object') throw new Error('Invalid publish job')
  if (!/^[a-zA-Z0-9:_-]{1,255}$/.test(input.jobId)) throw new Error('Invalid job id')
  if (!Number.isSafeInteger(input.taskId) || input.taskId <= 0) throw new Error('Invalid task id')
  if (!Number.isSafeInteger(input.enterpriseId) || input.enterpriseId <= 0) {
    throw new Error('Invalid enterprise id')
  }
  if (!Number.isSafeInteger(input.articleId) || input.articleId <= 0) {
    throw new Error('Invalid article id')
  }
  if (!input.article || typeof input.article.title !== 'string' || typeof input.article.content !== 'string') {
    throw new Error('Invalid article')
  }
  if (!Array.isArray(input.targets) || input.targets.length === 0 || input.targets.length > 100) {
    throw new Error('Invalid publish targets')
  }
  for (const target of input.targets) {
    if (!/^[a-z0-9_-]{1,50}$/.test(target.platformName)) throw new Error('Invalid platform')
    if (!target.encryptedSecret || target.encryptedSecret.length > 2_000_000) {
      throw new Error('Invalid platform credentials')
    }
  }
  return input
}

export function registerPublishJobIpc(ipcMain: IpcMain) {
  ipcMain.handle('publishJobs:run', (_event, input: PublishJobInput) => {
    return publishJobService.run(validateJob(input))
  })
  ipcMain.handle('publishJobs:cancel', (_event, jobId: unknown) => {
    if (typeof jobId !== 'string') throw new Error('Invalid job id')
    return publishJobService.cancel(jobId)
  })
}
