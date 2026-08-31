import type { Article, ArticleStatus, PublishTask, TaskStatus } from '@/types/app'

export function mapArticleStatus(status: string): ArticleStatus {
  if (status === 'published') return 'published'
  if (status === 'normal') return 'normal'
  if (status === 'pending_review') return 'pending_review'
  if (status === 'disabled') return 'disabled'
  if (status === 'archived') return 'archived'
  if (status === 'partial') return 'partial'
  if (status === 'rejected' || status === 'deleted' || status === 'failed') return 'failed'
  return 'pending_review'
}

export function mapTaskStatus(status: string): TaskStatus {
  if (['success', 'completed', 'done', 'succeeded'].includes(status)) return 'success'
  if (['failed', 'error', 'cancelled', 'stopped', 'expired', 'manual_action_required'].includes(status)) return 'failed'
  if (['publishing', 'running', 'leased', 'processing'].includes(status)) return 'publishing'
  return 'pending'
}

export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function makeArticle(input: {
  id: number
  enterpriseId?: number
  enterpriseName?: string
  title: string
  content?: string
  category?: string
  cover?: string
  status: string
  version?: string | number
  latestSnapshotId?: string | number
  publishedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}): Article {
  const version =
    typeof input.version === 'string' ? Number(input.version) : input.version
  const snapshotId =
    typeof input.latestSnapshotId === 'string' ? Number(input.latestSnapshotId) : input.latestSnapshotId
  return {
    id: input.id,
    userId: input.enterpriseId ?? 0,
    userName: input.enterpriseName,
    title: input.title,
    summary: stripHtml(input.content ?? '').slice(0, 200),
    content: input.content,
    cover: input.cover ?? '',
    tags: input.category ? [input.category] : [],
    status: mapArticleStatus(input.status),
    latestSnapshotId: snapshotId !== undefined && Number.isFinite(snapshotId) ? snapshotId : undefined,
    publishedAt: input.publishedAt ?? null,
    version: version !== undefined && Number.isFinite(version) ? version : undefined,
    createdAt: input.createdAt ?? '',
    updatedAt: input.updatedAt ?? input.createdAt ?? '',
  }
}

export function makePublishTask(input: {
  id: number
  enterpriseId?: number
  name: string
  articleIds?: number[]
  platforms?: string[]
  publishChannelId?: string | number
  status: string
  error?: string
  createdAt?: string | null
  startedAt?: string | null
  completedCount?: number
  version?: number
  attemptCount?: number
  articleSnapshotId?: number
  platformAccountId?: number
}): PublishTask {
  const platformNames = input.platforms ?? []
  const channelId =
    typeof input.publishChannelId === 'string' ? Number(input.publishChannelId) : input.publishChannelId
  return {
    id: input.id,
    enterpriseId: input.enterpriseId,
    userId: input.enterpriseId ?? 0,
    articleId: input.articleIds?.[0] ?? 0,
    articleIds: input.articleIds ?? [],
    articleTitle: input.name,
    platformName: platformNames.join(', '),
    platformLabel: platformNames.join('、'),
    platforms: platformNames,
    publishChannelId: channelId !== undefined && Number.isFinite(channelId) ? channelId : undefined,
    status: mapTaskStatus(input.status),
    retryCount: input.attemptCount ?? 0,
    errorMsg: input.error ?? '',
    startedAt: input.startedAt ?? null,
    finishedAt: mapTaskStatus(input.status) === 'success' ? input.startedAt ?? null : null,
    createdAt: input.createdAt ?? '',
    completedCount: input.completedCount ?? 0,
    version: input.version,
    attemptCount: input.attemptCount,
    articleSnapshotId: input.articleSnapshotId,
    platformAccountId: input.platformAccountId,
  }
}
