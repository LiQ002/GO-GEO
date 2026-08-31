import type { components as kratosComponents } from './generated/user-openapi'
import { http } from './core'
import { makeArticle, makePublishTask, mapTaskStatus } from './mappers'
import type { Article, GeoTask, PaginatedResponse, PublishedPlatform, PublishTask, Stats, User } from '@/types/app'
import { apiPath } from './path'
import { getPlatformDriverId, listPlatformManifests } from '@/lib/platform-manifest'

type AdminEnterpriseDetail = kratosComponents['schemas']['admin.v1.EnterpriseDetail']
type AdminEnterpriseList = kratosComponents['schemas']['admin.v1.ListEnterprisesReply']
type AdminArticleList = kratosComponents['schemas']['admin.v1.ListArticlesReply']
type AdminArticleDetail = kratosComponents['schemas']['admin.v1.ArticleDetail']
type AdminDashboard = kratosComponents['schemas']['admin.v1.Dashboard']
type AdminPublishTaskList = kratosComponents['schemas']['admin.v1.ListPublishTasksReply']
type AdminPublishChannelList = kratosComponents['schemas']['admin.v1.ListPublishChannelsReply']
type RegisterWorkerReply = kratosComponents['schemas']['admin.v1.RegisterWorkerReply']
type WorkerHeartbeatReply = kratosComponents['schemas']['admin.v1.WorkerHeartbeatReply']
export type OperatorTaskLease = kratosComponents['schemas']['admin.v1.TaskLease']

/** Publish channel info needed for icon display. */
interface PublishChannelInfo {
  id: number
  name: string
  icon?: string
  driverType?: number
}

const WORKER_CLIENT_VERSION = '0.1.0'
const DEFAULT_WORKER_TASK_TYPES = ['publish', 'geo']

function numeric(value?: string | number): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function pageTokenFor(page: number, pageSize: number): string | undefined {
  const offset = Math.max(0, page - 1) * pageSize
  return offset > 0 ? btoa(String(offset)).replace(/=+$/u, '') : undefined
}

function mapEnterprise(detail: AdminEnterpriseDetail): User {
  const enterprise = detail.enterprise ?? {}
  const account = detail.account ?? {}
  return {
    id: numeric(enterprise.id),
    username: account.username ?? enterprise.code ?? '',
    name: enterprise.name ?? account.username ?? '',
    email: account.email ?? enterprise.contactEmail ?? '',
    articleCount: numeric(detail.articleCount),
    publishedCount: numeric(detail.publishedCount),
    createdAt: enterprise.createdAt ?? '',
    updatedAt: enterprise.updatedAt ?? enterprise.createdAt ?? '',
    expireAt: detail.subscription?.expiresAt ?? null,
  }
}

export async function getUsers(params: {
  page?: number
  pageSize?: number
  search?: string
} = {}): Promise<PaginatedResponse<User>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const { data } = await http.get<AdminEnterpriseList>(apiPath('/api/admin/v1/enterprises'), {
    params: {
      pageSize,
      pageToken: pageTokenFor(page, pageSize),
      keyword: params.search ?? '',
    },
  })
  return {
    items: (data.items ?? []).map(mapEnterprise),
    total: numeric(data.totalSize),
    page,
    pageSize,
  }
}

export async function getUser(id: number): Promise<User> {
  const { data } = await http.get<AdminEnterpriseDetail>(
    apiPath('/api/admin/v1/enterprises/{id}', { id }),
  )
  return mapEnterprise(data)
}

/** Fetch publish channels from admin API for icon lookup. */
export async function getOperatorPublishChannels(): Promise<PublishChannelInfo[]> {
  const { data } = await http.get<AdminPublishChannelList>(
    apiPath('/api/admin/v1/publish-channels'),
    { params: { pageSize: 200 } },
  )
  return (data.items ?? []).map((ch) => ({
    id: numeric(ch.id),
    name: ch.name ?? '',
    icon: ch.icon || undefined,
    driverType: ch.driverType,
  }))
}

/** Match a publish channel to a platform manifest by driverType or name. */
function resolvePlatform(
  channel: PublishChannelInfo | undefined,
  channelName: string,
): PublishedPlatform | null {
  if (!channelName) return null

  // 1. If we have the channel with driverType, use it to resolve the platform manifest.
  if (channel?.driverType) {
    const platformId = getPlatformDriverId(channel.driverType, 'media')
    if (platformId) {
      const manifests = listPlatformManifests('media')
      const manifest = manifests.find((m) => m.id === platformId)
      if (manifest) {
        return {
          platformId: manifest.id,
          platformLabel: manifest.label,
          channelName,
          iconUrl: channel.icon,
        }
      }
    }
  }

  // 2. Fall back to matching by channel name against known platform labels.
  const manifests = listPlatformManifests('media')
  for (const m of manifests) {
    if (channelName.includes(m.label) || channelName.includes(m.id)) {
      return {
        platformId: m.id,
        platformLabel: m.label,
        channelName,
        iconUrl: channel?.icon,
      }
    }
  }

  // 3. Unknown platform — use channel name and icon as-is.
  return {
    platformId: '',
    platformLabel: channelName,
    channelName,
    iconUrl: channel?.icon,
  }
}

/** Match publish tasks to articles by snapshot ID or title, returning published platforms. */
function matchPublishedPlatforms(
  articles: Article[],
  tasks: PublishTask[],
  channels: PublishChannelInfo[],
): void {
  const channelMap = new Map(channels.map((c) => [c.id, c]))
  for (const article of articles) {
    const matched = tasks.filter(
      (t) =>
        t.status === 'success' &&
        ((article.latestSnapshotId && t.articleSnapshotId === article.latestSnapshotId) ||
          (t.articleTitle && t.articleTitle === article.title)),
    )
    const platforms: PublishedPlatform[] = []
    const seen = new Set<string>()
    for (const t of matched) {
      const channelName = t.platformLabel || t.platformName
      if (!channelName) continue
      const key = (t.publishChannelId ?? channelName).toString().toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const channel = t.publishChannelId ? channelMap.get(t.publishChannelId) : undefined
      const resolved = resolvePlatform(channel, channelName)
      if (resolved) {
        platforms.push(resolved)
      }
    }
    article.publishedPlatforms = platforms
  }
}

export async function getOperatorArticles(params: {
  page?: number
  pageSize?: number
  userId?: number
  status?: string
  search?: string
} = {}): Promise<PaginatedResponse<Article>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const { data } = await http.get<AdminArticleList>(apiPath('/api/admin/v1/articles'), {
    params: {
      pageSize,
      pageToken: pageTokenFor(page, pageSize),
      enterpriseId: params.userId,
      status: params.status ?? '',
      keyword: params.search ?? '',
    },
  })
  const articles = (data.items ?? []).map((article) =>
    makeArticle({
      id: numeric(article.id),
      enterpriseId: numeric(article.enterpriseId),
      enterpriseName: article.enterpriseName,
      title: article.title ?? '',
      content: article.summary || article.contentMarkdown,
      category: article.articleTypeName,
      status: article.status ?? '',
      version: article.version,
      latestSnapshotId: article.latestSnapshotId,
      publishedAt: article.publishedAt,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    }),
  )

  // Fetch publish tasks AND publish channels in parallel to populate publishedPlatforms.
  try {
    const [tasks, channels] = await Promise.all([
      getOperatorPublishTasks(),
      getOperatorPublishChannels(),
    ])
    matchPublishedPlatforms(articles, tasks, channels)
  } catch {
    // Non-critical: if publish tasks or channels fail to load, articles still render.
  }

  return {
    items: articles,
    total: numeric(data.totalSize),
    page,
    pageSize,
  }
}

export async function getOperatorArticle(id: number): Promise<Article> {
  const { data } = await http.get<AdminArticleDetail>(
    apiPath('/api/admin/v1/articles/{id}', { id }),
  )
  const article = data.article ?? {}
  return makeArticle({
    id: numeric(article.id),
    enterpriseId: numeric(article.enterpriseId),
    enterpriseName: article.enterpriseName,
    title: article.title ?? '',
    content: article.summary || article.contentMarkdown,
    category: article.articleTypeName,
    status: article.status ?? '',
    version: article.version,
    latestSnapshotId: article.latestSnapshotId,
    publishedAt: article.publishedAt,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  })
}

export async function changeOperatorArticleStatus(
  id: number,
  version: number,
  action: 'approve' | 'disable' | 'review',
  reason: string,
): Promise<void> {
  await http.post(
    apiPath('/api/admin/v1/articles/{id}/review', { id }),
    { id: String(id), version: String(version), action, reason },
  )
}

export async function getArticleBySnapshotId(snapshotId: number): Promise<Article> {
  const { data } = await http.get<AdminArticleList>(apiPath('/api/admin/v1/articles'), {
    params: { pageSize: 100 },
  })
  const article = (data.items ?? []).find((item) => numeric(item.latestSnapshotId) === snapshotId)
  if (!article) throw new Error(`未找到快照 #${snapshotId} 对应的文章`)
  return makeArticle({
    id: numeric(article.id),
    enterpriseId: numeric(article.enterpriseId),
    enterpriseName: article.enterpriseName,
    title: article.title ?? '',
    content: article.summary || article.contentMarkdown,
    category: article.articleTypeName,
    status: article.status ?? '',
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  })
}

export async function getStats(): Promise<Stats> {
  const [{ data: dashboard }, { data: articles }, { data: succeeded }, { data: failed }] =
    await Promise.all([
      http.get<AdminDashboard>(apiPath('/api/admin/v1/dashboard'), {
        params: { trendDays: 14 },
      }),
      http.get<AdminArticleList>(apiPath('/api/admin/v1/articles'), {
        params: { pageSize: 1 },
      }),
      http.get<AdminPublishTaskList>(apiPath('/api/admin/v1/publish-tasks'), {
        params: { pageSize: 1, status: 'succeeded' },
      }),
      http.get<AdminPublishTaskList>(apiPath('/api/admin/v1/publish-tasks'), {
        params: { pageSize: 1, status: 'failed' },
      }),
    ])
  const metrics = new Map((dashboard.metrics ?? []).map((item) => [item.key, numeric(item.value)]))
  const trends = [...(dashboard.trends ?? [])].sort((a, b) =>
    String(a.date ?? '').localeCompare(String(b.date ?? '')),
  )
  const successful = numeric(succeeded.totalSize)
  const failedCount = numeric(failed.totalSize)
  const attempts = successful + failedCount
  const latestTrend = trends.at(-1)
  return {
    totalUsers: metrics.get('enterprises') ?? 0,
    totalArticles: numeric(articles.totalSize),
    publishedToday: numeric(latestTrend?.publishSucceeded),
    totalPublished: successful,
    successRate: attempts > 0 ? successful / attempts : 0,
    pendingArticles: metrics.get('pending_articles') ?? 0,
    failedPublish: metrics.get('failed_publish') ?? 0,
    failedGeo: metrics.get('failed_geo') ?? 0,
    onlineWorkers: metrics.get('online_workers') ?? 0,
    openAlerts: metrics.get('open_alerts') ?? 0,
    platformStats: (dashboard.platformStats ?? []).map((ps) => ({
      platform: ps.platform ?? '',
      label: ps.label ?? ps.platform ?? '',
      count: numeric(ps.count),
      successRate: ps.successRate ?? 0,
    })),
    recentActivity: (dashboard.activities ?? []).map((act) => ({
      id: numeric(act.id),
      type: (act.type === 'success' ? 'success' : act.type === 'failed' ? 'failed' : 'started') as
        | 'success'
        | 'failed'
        | 'started',
      message: act.message ?? '',
      createdAt: act.createdAt ?? dashboard.generatedAt ?? '',
    })),
    alerts: (dashboard.alerts ?? []).map((al) => ({
      id: numeric(al.id),
      severity: al.severity ?? '',
      title: al.title ?? '',
      resourceType: al.resourceType ?? '',
      resourceId: al.resourceId ?? '',
      createdAt: al.createdAt ?? dashboard.generatedAt ?? '',
    })),
  }
}

export async function getOperatorPublishTasks(): Promise<PublishTask[]> {
  const { data } = await http.get<AdminPublishTaskList>(apiPath('/api/admin/v1/publish-tasks'), {
    params: { pageSize: 100 },
  })
  return (data.items ?? []).map((task) =>
    makePublishTask({
      id: numeric(task.id),
      enterpriseId: numeric(task.enterpriseId),
      name: task.articleTitle || task.publishPlanName || `任务 #${task.id}`,
      articleIds: [],
      platforms: task.publishChannelName ? [task.publishChannelName] : [],
      publishChannelId: task.publishChannelId,
      status: task.status ?? '',
      error: task.errorMessage,
      createdAt: task.createdAt,
      startedAt: task.scheduledAt,
      attemptCount: task.attemptCount,
      version: numeric(task.version),
      articleSnapshotId: numeric(task.articleSnapshotId),
      platformAccountId: numeric(task.platformAccountId),
    }),
  )
}

function workerRuntimeInfo() {
  return JSON.stringify({
    platform: navigator.platform,
    userAgent: navigator.userAgent,
    language: navigator.language,
  })
}

export async function ensureOperatorWorkerToken(
  nodeId: string,
  taskTypes: string[] = DEFAULT_WORKER_TASK_TYPES,
): Promise<string> {
  const session = await window.electronAPI?.authSession.get()
  if (session?.workerToken) return session.workerToken
  if (!window.electronAPI?.authSession) throw new Error('安全存储不可用，无法注册工作节点')

  const { data } = await http.post<RegisterWorkerReply>(
    apiPath('/api/admin/v1/workers/register'),
    {
      nodeId,
      name: `GEO 运营执行端 ${nodeId.slice(0, 8)}`,
      clientVersion: WORKER_CLIENT_VERSION,
      capabilitiesJson: JSON.stringify({ taskTypes, safeDraftOnly: true }),
      systemInfoJson: workerRuntimeInfo(),
      maxConcurrency: 2,
    },
  )
  const workerToken = data.workerToken?.trim()
  if (!workerToken) throw new Error('工作节点注册成功，但服务端未返回节点令牌')
  await window.electronAPI.authSession.setWorkerToken(workerToken)
  return workerToken
}

export async function heartbeatOperatorWorker(
  workerToken: string,
  activeTasks: number,
  taskTypes: string[] = DEFAULT_WORKER_TASK_TYPES,
): Promise<WorkerHeartbeatReply> {
  const { data } = await http.post<WorkerHeartbeatReply>(apiPath('/api/worker/v1/heartbeat'), {
    workerToken,
    clientVersion: WORKER_CLIENT_VERSION,
    capabilitiesJson: JSON.stringify({ taskTypes, safeDraftOnly: true }),
    systemInfoJson: workerRuntimeInfo(),
    activeTasks,
  })
  return data
}

export async function claimOperatorPublishTask(
  taskId: number,
  workerToken: string,
): Promise<OperatorTaskLease> {
  const { data } = await http.post<{ lease?: OperatorTaskLease }>(
    apiPath('/api/worker/v1/tasks:claim'),
    { workerToken, taskTypes: ['publish'], taskId: String(taskId) },
  )
  if (!data.lease?.id || !data.lease.leaseToken) throw new Error('服务端未返回有效任务租约')
  return data.lease
}

export async function renewOperatorPublishTask(
  lease: OperatorTaskLease,
): Promise<OperatorTaskLease> {
  const { data } = await http.post<OperatorTaskLease>(
    apiPath('/api/worker/v1/leases/{leaseId}:renew', { leaseId: lease.id ?? '' }),
    {
      leaseId: lease.id,
      leaseToken: lease.leaseToken,
      leaseVersion: lease.leaseVersion,
    },
  )
  return data
}

export async function releaseOperatorPublishTask(
  lease: OperatorTaskLease,
  reason: string,
): Promise<void> {
  await http.post(
    apiPath('/api/worker/v1/leases/{leaseId}:release', { leaseId: lease.id ?? '' }),
    { leaseId: lease.id, leaseToken: lease.leaseToken, reason },
  )
}

export async function reportOperatorPublishResult(input: {
  lease: OperatorTaskLease
  idempotencyKey: string
  status: 'succeeded' | 'draft_saved' | 'failed'
  result: Record<string, unknown>
  evidence: Record<string, unknown>
  errorMessage?: string
  durationMs: number
}): Promise<void> {
  const taskId = input.lease.taskId ?? ''
  const leaseId = input.lease.id ?? ''
  console.log('[reportOperatorPublishResult] Reporting result', {
    taskId,
    leaseId,
    status: input.status,
    idempotencyKey: input.idempotencyKey,
    hasLeaseToken: !!input.lease.leaseToken,
    leaseTokenLength: input.lease.leaseToken?.length ?? 0,
  })
  try {
    await http.post(
      apiPath('/api/worker/v1/tasks/{taskId}:report', { taskId }),
      {
        taskType: input.lease.taskType || 'publish',
        taskId,
        leaseId,
        leaseToken: input.lease.leaseToken,
        idempotencyKey: input.idempotencyKey,
        status: input.status,
        resultJson: JSON.stringify(input.result),
        evidenceJson: JSON.stringify(input.evidence),
        errorCategory: input.status === 'failed' ? 'platform' : '',
        errorCode: input.status === 'failed' ? 'PUBLISH_EXECUTION_FAILED' : '',
        errorMessage: input.errorMessage ?? '',
        durationMs: String(Math.max(0, Math.round(input.durationMs))),
        clientVersion: WORKER_CLIENT_VERSION,
      },
    )
    console.log('[reportOperatorPublishResult] Report succeeded')
  } catch (error) {
    console.error('[reportOperatorPublishResult] Report failed', error)
    throw error
  }
}

export async function retryOperatorPublishTask(task: PublishTask): Promise<void> {
  await http.post(apiPath('/api/admin/v1/publish-tasks/{id}/retry', { id: task.id }), {
    id: task.id,
    version: task.version ?? 0,
    reason: '运营执行端重新执行失败任务',
  })
}

export async function retryOperatorGeoTask(task: GeoTask): Promise<void> {
  await http.post(apiPath('/api/admin/v1/geo-tasks/{id}/retry', { id: task.id }), {
    id: task.id,
    version: task.version ?? 0,
    reason: '运营执行端重新执行失败 GEO 监测任务',
  })
}

type AdminGeoTaskList = kratosComponents['schemas']['admin.v1.ListGeoTasksReply']
type AdminGeoTask = kratosComponents['schemas']['admin.v1.GeoTask']

function makeGeoTask(task: AdminGeoTask): GeoTask {
  return {
    id: numeric(task.id),
    enterpriseId: numeric(task.enterpriseId),
    questionText: task.questionText ?? `问题 #${task.questionId}`,
    inclusionSiteName: task.inclusionSiteName ?? `站点 #${task.inclusionSiteId}`,
    platformAccountId: numeric(task.platformAccountId),
    modelEntry: task.modelEntry ?? '',
    terminalType: numeric(task.terminalType),
    status: mapTaskStatus(task.status ?? 'pending'),
    errorMsg: task.errorMessage,
    retryCount: numeric(task.attemptCount),
    version: numeric(task.version),
    scheduledAt: task.scheduledAt ?? '',
    brandMentioned: task.brandMentioned ?? false,
    sessionRef: task.sessionRef ?? '',
  }
}

export async function getOperatorGeoTasks(): Promise<GeoTask[]> {
  const { data } = await http.get<AdminGeoTaskList>(apiPath('/api/admin/v1/geo-tasks'), {
    params: { pageSize: 100 },
  })
  return (data.items ?? []).map((task) => makeGeoTask(task))
}

export async function claimOperatorGeoTask(
  taskId: number,
  workerToken: string,
): Promise<OperatorTaskLease> {
  const { data } = await http.post<{ lease?: OperatorTaskLease }>(
    apiPath('/api/worker/v1/tasks:claim'),
    { workerToken, taskTypes: ['geo'], taskId: String(taskId) },
  )
  if (!data.lease?.id || !data.lease.leaseToken) throw new Error('服务端未返回有效 GEO 任务租约')
  return data.lease
}

export async function reportOperatorGeoResult(input: {
  lease: OperatorTaskLease
  idempotencyKey: string
  status: 'succeeded' | 'failed'
  result: Record<string, unknown>
  evidence: Record<string, unknown>
  errorMessage?: string
  durationMs: number
}): Promise<void> {
  await http.post(
    apiPath('/api/worker/v1/tasks/{taskId}:report', { taskId: input.lease.taskId ?? '' }),
    {
      taskType: input.lease.taskType || 'geo',
      taskId: input.lease.taskId,
      leaseId: input.lease.id,
      leaseToken: input.lease.leaseToken,
      idempotencyKey: input.idempotencyKey,
      status: input.status,
      resultJson: JSON.stringify(input.result),
      evidenceJson: JSON.stringify(input.evidence),
      errorCategory: input.status === 'failed' ? 'platform' : '',
      errorCode: input.status === 'failed' ? 'GEO_EXECUTION_FAILED' : '',
      errorMessage: input.errorMessage ?? '',
      durationMs: String(Math.max(0, Math.round(input.durationMs))),
      clientVersion: WORKER_CLIENT_VERSION,
    },
  )
}
