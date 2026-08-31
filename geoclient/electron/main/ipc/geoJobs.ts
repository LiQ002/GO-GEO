import type { IpcMain } from 'electron'
import type { GeoJobInput } from '../../../lib/ipc-contract'
import { geoJobService } from '../services/GeoJobService'

function validateJob(input: GeoJobInput): GeoJobInput {
  if (!input || typeof input !== 'object') throw new Error('Invalid geo job')
  if (!/^[a-zA-Z0-9:_-]{1,255}$/u.test(input.jobId)) throw new Error('Invalid geo job id')
  if (!Number.isSafeInteger(input.taskId) || input.taskId <= 0) throw new Error('Invalid geo task id')
  if (!Number.isSafeInteger(input.enterpriseId) || input.enterpriseId <= 0) {
    throw new Error('Invalid geo enterprise id')
  }
  if (typeof input.question !== 'string' || input.question.length === 0 || input.question.length > 4000) {
    throw new Error('Invalid geo question')
  }
  if (!/^[a-z0-9_-]{1,50}$/u.test(input.platformName)) throw new Error('Invalid geo platform')
  return input
}

export function registerGeoJobIpc(ipcMain: IpcMain) {
  ipcMain.handle('geoJobs:run', (_event, input: GeoJobInput) => {
    return geoJobService.run(validateJob(input))
  })
}
