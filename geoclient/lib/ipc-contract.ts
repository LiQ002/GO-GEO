import type { PublishArticleInput } from './platforms/types'

export type PlatformKind = 'media' | 'model'

export type BrowserRuntimeConfiguration = {
  executablePath: string
  valid: boolean
  error?: string
}

export type PublishProgressEvent = {
  type: 'start' | 'progress' | 'complete' | 'error'
  platformName: string
  message?: string
  done?: number
  total?: number
  jobId?: string
  taskId?: number
  articleId?: number
  accountId?: string
}

export type PublishJobTarget = {
  platformName: string
  encryptedSecret: string
  accountId?: string
  accountName?: string
  loginUrl?: string
}

export type PublishJobInput = {
  jobId: string
  taskId: number
  enterpriseId: number
  articleId: number
  article: PublishArticleInput
  targets: PublishJobTarget[]
}

export type PublishJobTargetResult = {
  platformName: string
  accountId: string
  accountName: string
  status: 'success' | 'failed' | 'skipped'
  errorMsg: string
  executedAt: string
  publishedUrl?: string
  platformArticleId?: string
}

export type PublishJobResult = {
  jobId: string
  taskId: number
  enterpriseId: number
  articleId: number
  results: PublishJobTargetResult[]
}

export type GeoCitation = {
  url: string
  domain: string
  title?: string
  position?: number
  isEnterpriseSource?: boolean
  articleId?: number
  metadataJson?: string
}

export type GeoMention = {
  entityType: string
  entityId: number
  text: string
  position?: number
  sentiment?: string
  confidence?: number
}

export type GeoAnalysisResult = {
  analysisVersion?: number
  ruleVersion?: string
  status?: string
  brandMentioned?: boolean
  enterpriseCited?: boolean
  visibilityScore?: number
  accuracyScore?: number
  confidence?: number
  resultJson?: string
}

export type GeoJobInput = {
  jobId: string
  taskId: number
  enterpriseId: number
  question: string
  platformName: string
  encryptedSecret?: string
  siteEntryUrl?: string
  terminalType?: number // 1=电脑端, 2=移动端
  brand?: {
    name: string
    officialDomain?: string
    aliases?: string[]
  }
  modelEntry?: string
  locale?: string
  region?: string
}

export type GeoJobResult = {
  jobId: string
  taskId: number
  enterpriseId: number
  platformName: string
  status: 'success' | 'failed' | 'skipped'
  errorMsg: string
  executedAt: string
  questionText?: string
  answerText?: string
  answerStatus?: string
  screenshotKey?: string
  sessionRef?: string
  citations?: GeoCitation[]
  mentions?: GeoMention[]
  analysisResult?: GeoAnalysisResult
}
