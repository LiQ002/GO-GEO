export type AppMode = 'operator' | 'client'

export interface User {
  id: number
  username: string
  name: string
  email: string
  articleCount: number
  publishedCount: number
  createdAt: string
  updatedAt: string
  /** Enterprise account fields from /api/enterprise/login */
  pointsBalance?: number
  expireAt?: string | null
}

export interface Article {
  id: number
  userId: number
  userName?: string
  title: string
  summary: string
  content?: string
  cover: string
  tags: string[]
  status: ArticleStatus
  publishTasks?: PublishTask[]
  /** Latest snapshot ID — used to match publish tasks to articles. */
  latestSnapshotId?: number
  /** Timestamp when the article was first successfully published. */
  publishedAt?: string | null
  /** Platforms where this article has been successfully published (operator view). */
  publishedPlatforms?: PublishedPlatform[]
  /** Data version number for optimistic locking (from backend). */
  version?: number
  createdAt: string
  updatedAt: string
}

export interface PublishedPlatform {
  /** Platform driver ID, e.g. 'wechat', 'zhihu'. */
  platformId: string
  /** Human-readable platform label, e.g. '微信公众号'. */
  platformLabel: string
  /** Original publish channel name from the backend. */
  channelName: string
  /** Icon URL uploaded by admin in publish-channel management. */
  iconUrl?: string
  /** Published article URL if available. */
  resultUrl?: string
}

export type ArticleStatus =
  | 'pending_review'
  | 'normal'
  | 'published'
  | 'disabled'
  | 'archived'
  | 'partial'
  | 'failed'

export interface Platform {
  /** Platform configuration resource ID returned by the user API. */
  id: string
  /** Business configuration code, separate from the executable driver type. */
  code: string
  /** Numeric client driver enum returned by the user API. */
  driverType: number
  /** Built-in executable driver ID resolved from driverType. */
  name: string
  label: string
  icon: string
  /** Optional client-bundled brand icon. Falls back to `icon` when unavailable. */
  iconUrl?: string
  color: string
  loginUrl: string
  configurationError?: string
}

export interface UserPlatform {
  id: string
  /** ID of the configured publish channel or inclusion site. */
  resourceId: string
  userId: number
  platformName: string
  platformLabel: string
  isActive: boolean
  expiresAt: string | null
  lastLoginAt: string | null
  createdAt: string
  /** Backend auth_status: unauthorized / active / expired / blocked */
  authStatus?: string
  status?: string
  accountId?: string
  accountName?: string
  version?: string
}

export type ModelPlatform = Platform
export type UserModelPlatform = UserPlatform

export interface PublishTask {
  id: number
  enterpriseId?: number
  userId: number
  articleId: number
  articleIds?: number[]
  articleTitle?: string
  platformName: string
  platforms?: string[]
  platformLabel?: string
  publishChannelId?: number
  status: TaskStatus
  retryCount: number
  errorMsg: string
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  completedCount?: number
  version?: number
  attemptCount?: number
  articleSnapshotId?: number
  platformAccountId?: number
}

export type TaskStatus = 'pending' | 'publishing' | 'success' | 'failed'

export interface GeoTask {
  id: number
  enterpriseId: number
  questionText: string
  inclusionSiteName: string
  platformAccountId?: number
  modelEntry: string
  terminalType?: number // 1=电脑端, 2=移动端
  status: TaskStatus
  errorMsg?: string
  retryCount: number
  version: number
  scheduledAt: string
  brandMentioned?: boolean
  sessionRef?: string
}

export interface PublishLog {
  id: number
  userId: number
  userName?: string
  articleId: number
  articleTitle?: string
  platformName: string
  platformLabel?: string
  status: TaskStatus
  errorMsg: string
  duration: number
  createdAt: string
}

export interface Stats {
  totalUsers: number
  totalArticles: number
  publishedToday: number
  totalPublished: number
  successRate: number
  pendingArticles: number
  failedPublish: number
  failedGeo: number
  onlineWorkers: number
  openAlerts: number
  platformStats: PlatformStat[]
  recentActivity: ActivityItem[]
  alerts: AlertItem[]
}

export interface AlertItem {
  id: number
  severity: string
  title: string
  resourceType: string
  resourceId: string
  createdAt: string
}

export interface PlatformStat {
  platform: string
  label: string
  count: number
  successRate: number
}

export interface ActivityItem {
  id: number
  type: 'success' | 'failed' | 'started'
  message: string
  createdAt: string
}

export interface UserStats {
  totalArticles: number
  publishedCount: number
  pendingCount: number
  failedCount: number
  successRate: number
  platformStats: PlatformStat[]
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface LoginCredentials {
  username: string
  password: string
}

/** Raw response from POST /api/enterprise/login */
export interface EnterpriseLoginResponse {
  access_token: string
  refresh_token: string
  company_name: string
  enterprise_id: number
  points_balance: number
  expire_at: string | null
}

/** Raw response from POST /api/admin/login */
export interface AdminLoginResponse {
  access_token: string
  refresh_token: string
  token_type?: string
  username: string
  role: string
}

export interface AuthResult {
  accessToken: string
  refreshToken: string
  user: User
}

export interface Settings {
  serverUrl: string
  autoPublish: boolean
  retryCount: number
  publishDelay: number
}
