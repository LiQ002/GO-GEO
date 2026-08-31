import type { components } from './generated/openapi'
import type { components as userComponents } from './generated/user-openapi'
import { http } from './core'
import { makeArticle, makePublishTask } from './mappers'
import { apiPath } from './path'
import { getDeviceId } from '@/lib/device-id'
import {
  getPlatformDriverId,
  getPlatformManifest,
  resolvePlatformLoginConfiguration,
} from '@/lib/platform-manifest'
import type {
  Article,
  ModelPlatform,
  PaginatedResponse,
  Platform,
  PublishTask,
  UserModelPlatform,
  UserPlatform,
  UserStats,
} from '@/types/app'

type CatalogItem = userComponents['schemas']['user.v1.CatalogItem']
type CatalogReply = { items?: CatalogItem[] }
type UserPlatformAccount = userComponents['schemas']['user.v1.PlatformAccount']
type UserPlatformAccountReply = userComponents['schemas']['user.v1.ListPlatformAccountsReply']
type PlatformAccountCredential = userComponents['schemas']['user.v1.PlatformAccountCredential']
type AuthorizationSession = userComponents['schemas']['user.v1.AuthorizationSession']
type CreateAuthorizationSessionRequest = userComponents['schemas']['user.v1.CreateAuthorizationSessionRequest']
type SubmitAuthorizationRequest = userComponents['schemas']['user.v1.SubmitAuthorizationRequest']
type ArticleListOut = components['schemas']['app__api__enterprise__create__ArticleListOut']
type PublishTaskListOut = components['schemas']['app__api__enterprise__publish__PublishTaskListOut']
type PublishStatsOut = components['schemas']['PublishStatsOut']

const AUTHORIZATION_RESOURCE_PUBLISH_CHANNEL = 1
const AUTHORIZATION_RESOURCE_INCLUSION_SITE = 2
const AUTHORIZATION_STATUS_ACTIVE = 3
const AUTHORIZATION_STATUS_EXPIRED = 4
const AUTHORIZATION_USAGE_ENABLED = 1
const CLIENT_VERSION = '0.1.0'

function mapPlatform(definition: CatalogItem, kind: 'media' | 'model'): Platform | null {
  const id = definition.id?.trim()
  const code = definition.code?.trim()
  if (!id || !code) return null
  const label = definition.name?.trim() || code
  const driverType = definition.driverType ?? 0
  const driverId = getPlatformDriverId(driverType, kind)
  const manifest = driverId ? getPlatformManifest(driverId, kind) : undefined
  const login = driverId
    ? resolvePlatformLoginConfiguration(driverId, kind, definition.loginUrl)
    : { error: '平台后台未配置客户端驱动' }
  return {
    id,
    code,
    driverType,
    name: driverId || code,
    label,
    icon: manifest?.icon || label.charAt(0).toUpperCase(),
    iconUrl: manifest?.iconUrl,
    color: manifest?.color || '#6366f1',
    loginUrl: login.url || '',
    configurationError: login.error,
  }
}

function authorizationStatusName(status?: number): string {
  switch (status) {
    case 1:
      return 'pending'
    case 2:
      return 'authorizing'
    case AUTHORIZATION_STATUS_ACTIVE:
      return 'active'
    case AUTHORIZATION_STATUS_EXPIRED:
      return 'expired'
    case 5:
      return 'revoked'
    case 6:
      return 'failed'
    default:
      return 'unknown'
  }
}

function mapAccount(account: UserPlatformAccount): UserPlatform {
  const status = authorizationStatusName(account.authorizationStatus)
  return {
    id: account.id || '',
    resourceId: account.resourceId || '',
    userId: 0,
    platformName: account.resourceId || '',
    platformLabel: account.accountName || account.maskedIdentity || '',
    isActive:
      account.authorizationStatus === AUTHORIZATION_STATUS_ACTIVE &&
      account.usageStatus === AUTHORIZATION_USAGE_ENABLED,
    expiresAt: account.expiresAt ?? null,
    lastLoginAt: account.lastVerifiedAt ?? account.lastUsedAt ?? null,
    createdAt: '',
    authStatus: status,
    status,
    accountId: account.externalId,
    accountName: account.accountName,
    version: account.version,
  }
}

export async function getPlatforms(): Promise<Platform[]> {
  const { data } = await http.get<CatalogReply>(apiPath('/api/user/v1/publish-channels'))
  return (data.items ?? [])
    .filter((item) => item.category === 'self_media' && item.accountRequired)
    .map((item) => mapPlatform(item, 'media'))
    .filter((item): item is Platform => item !== null)
}

export async function getUserPlatforms(): Promise<UserPlatform[]> {
  const { data } = await http.get<UserPlatformAccountReply>(
    apiPath('/api/user/v1/platform-accounts'),
    { params: { resourceType: AUTHORIZATION_RESOURCE_PUBLISH_CHANNEL } },
  )
  return (data.items ?? []).map(mapAccount)
}

export async function getUserPlatformSecret(accountId: string): Promise<string> {
  const { data } = await http.get<PlatformAccountCredential>(
    apiPath('/api/user/v1/platform-accounts/{accountId}/credential', { accountId }),
  )
  return data.credentialPayload?.trim() || ''
}

export async function createPlatformAuthorizationSession(
  resourceType: 1 | 2,
  resourceId: string,
  platformAccountId?: string,
): Promise<string> {
  const payload: CreateAuthorizationSessionRequest = {
    deviceId: getDeviceId(),
    resourceType,
    resourceId,
    platformAccountId,
  }
  const { data } = await http.post<AuthorizationSession>(
    apiPath('/api/user/v1/platform-accounts/authorization-sessions'),
    payload,
  )
  if (!data.sessionToken) throw new Error('后台未返回授权会话令牌')
  return data.sessionToken
}

async function submitPlatformAuthorization(
  sessionToken: string,
  encryptedSecret: string,
  platform: string,
  platformLabel: string,
  driverType: number,
): Promise<UserPlatform> {
  const payload: SubmitAuthorizationRequest = {
    sessionToken,
    accountName: platformLabel,
    maskedIdentity: platformLabel,
    credentialPayload: encryptedSecret,
    metadataJson: JSON.stringify({ platform, driverType }),
    clientVersion: CLIENT_VERSION,
  }
  const { data } = await http.post<UserPlatformAccount>(
    apiPath('/api/user/v1/client/authorization-sessions/{sessionToken}:submit', {
      sessionToken,
    }),
    payload,
  )
  return mapAccount(data)
}

export async function updateUserPlatform(
  platform: string,
  payload: {
    cookie: string
    isActive: boolean
    platformLabel?: string
    accountName?: string
    accountId?: string
    sessionToken: string
    driverType: number
  },
): Promise<UserPlatform> {
  return submitPlatformAuthorization(
    payload.sessionToken,
    payload.cookie,
    platform,
    payload.platformLabel ?? platform,
    payload.driverType,
  )
}

export async function deleteUserPlatform(accountId: string, version: string): Promise<void> {
  await http.delete(
    apiPath('/api/user/v1/platform-accounts/{accountId}', { accountId }),
    { params: { version } },
  )
}

export async function getModelPlatforms(): Promise<ModelPlatform[]> {
  const { data } = await http.get<CatalogReply>(apiPath('/api/user/v1/inclusion-sites'))
  return (data.items ?? [])
    .map((item) => mapPlatform(item, 'model'))
    .filter((item): item is ModelPlatform => item !== null)
}

export async function getUserModelPlatforms(): Promise<UserModelPlatform[]> {
  const { data } = await http.get<UserPlatformAccountReply>(
    apiPath('/api/user/v1/platform-accounts'),
    { params: { resourceType: AUTHORIZATION_RESOURCE_INCLUSION_SITE } },
  )
  return (data.items ?? []).map(mapAccount)
}

export async function updateUserModelPlatform(
  platform: string,
  payload: {
    cookie: string
    isActive: boolean
    platformLabel?: string
    accountName?: string
    accountId?: string
    sessionToken: string
    driverType: number
  },
): Promise<UserModelPlatform> {
  return submitPlatformAuthorization(
    payload.sessionToken,
    payload.cookie,
    platform,
    payload.platformLabel ?? platform,
    payload.driverType,
  )
}

export async function deleteUserModelPlatform(accountId: string, version: string): Promise<void> {
  await http.delete(
    apiPath('/api/user/v1/platform-accounts/{accountId}', { accountId }),
    { params: { version } },
  )
}

export async function getClientArticles(params: {
  page?: number
  pageSize?: number
  status?: string
} = {}): Promise<PaginatedResponse<Article>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const { data } = await http.get<ArticleListOut>(apiPath('/api/enterprise/articles'), {
    params: { page, page_size: pageSize, status: params.status ?? '' },
  })
  return {
    items: data.items.map((article) =>
      makeArticle({
        id: article.id,
        title: article.title,
        content: article.content,
        category: article.category,
        cover: article.cover_image,
        status: article.status,
        createdAt: article.created_at,
      }),
    ),
    total: data.total,
    page,
    pageSize,
  }
}

export async function changeClientArticleStatus(
  id: number,
  action: 'approve' | 'reject' | 'normal' | 'pending_review',
): Promise<void> {
  await http.post(apiPath('/api/enterprise/articles/batch-review'), {
    ids: [id],
    action,
  })
}

export async function getClientPublishTasks(): Promise<PublishTask[]> {
  const { data } = await http.get<PublishTaskListOut>(apiPath('/api/enterprise/tasks'), {
    params: { page: 1, page_size: 100, task_type: 'publish' },
  })
  return data.items.map((task) =>
    makePublishTask({
      id: task.id,
      name: task.task_name,
      articleIds: task.article_ids,
      platforms: task.platforms,
      status: task.task_status || task.status,
      error: task.error_message,
      createdAt: task.created_at,
      startedAt: task.last_executed_at,
      completedCount: task.completed_count,
    }),
  )
}

export async function startClientPublishTask(taskId: number): Promise<void> {
  await http.post(apiPath('/api/enterprise/tasks/{task_id}/start', { task_id: taskId }))
}

export async function getUserStats(): Promise<UserStats> {
  const [{ data: stats }, articles] = await Promise.all([
    http.get<PublishStatsOut>(apiPath('/api/client/enterprise/publish-stats')),
    getClientArticles({ page: 1, pageSize: 1 }),
  ])
  const attempts = stats.success_count + stats.failed_count
  const extended = stats as PublishStatsOut & {
    platform_stats?: Array<{ platform?: string; label?: string; count?: number; success_rate?: number }>
    published_article_count?: number
    pending_article_count?: number
  }
  const platformStats = extended.platform_stats
  const pendingCount = extended.pending_article_count ?? 0
  return {
    totalArticles: articles.total,
    publishedCount: stats.success_count,
    pendingCount,
    failedCount: stats.failed_count,
    successRate: attempts > 0 ? stats.success_count / attempts : 0,
    platformStats: (platformStats ?? []).map((ps) => ({
      platform: ps.platform ?? '',
      label: ps.label ?? ps.platform ?? '',
      count: ps.count ?? 0,
      successRate: ps.success_rate ?? 0,
    })),
  }
}
