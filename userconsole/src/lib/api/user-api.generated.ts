/* eslint-disable */
// 本文件由 scripts/generate-user-api.mjs 根据 kratos-svr/openapi.yaml 自动生成，请勿手动修改。
"use client";

import { apiRequest } from "./client";

type PathValue = number | string;

/** 文章类型生成配置。 */
export type CommonV1ArticleTypeConfig = {
  /** 内容生成目标。 */
  contentGoal?: string;
  /** 目标受众。 */
  targetAudience?: string;
  /** 文章语气。 */
  tone?: string;
  /** 建议最小字数。 */
  recommendedMinWords?: number;
  /** 建议最大字数。 */
  recommendedMaxWords?: number;
  /** 文章章节结构。 */
  sections?: Array<CommonV1ArticleTypeSection>;
  /** 企业生成时需要填写的输入项。 */
  inputFields?: Array<CommonV1ArticleTypeInputField>;
  /** GEO 优化规则。 */
  geoRules?: Array<string>;
  /** 质量检查规则。 */
  qualityRules?: Array<string>;
  /** 大模型系统提示词。 */
  systemPrompt?: string;
  /** 用户提示词模板，支持使用 {{.变量名}} 引用输入项和内置品牌变量。 */
  userPromptTemplate?: string;
  /** 输出格式：1 Markdown。 */
  outputFormat?: number;
  /** 可用写作模型编号列表；为空时允许企业使用全部已授权模型。 */
  writingModelIds?: Array<string>;
  /** 默认写作模型编号；为 0 时由企业选择。 */
  defaultWritingModelId?: string;
  /** 适用投放渠道编号列表；为空时表示不限制渠道。 */
  publishChannelIds?: Array<string>;
};

/** 文章生成输入项。 */
export type CommonV1ArticleTypeInputField = {
  /** 输入项键名，用于提示词变量，例如 topic。 */
  key?: string;
  /** 输入项中文名称。 */
  label?: string;
  /** 输入类型：1 单行文本、2 多行文本、3 数字、4 单选、5 多选。 */
  inputType?: number;
  /** 是否必填。 */
  required?: boolean;
  /** 输入提示。 */
  placeholder?: string;
  /** 帮助说明。 */
  helpText?: string;
  /** 选择项列表，仅单选和多选使用。 */
  options?: Array<string>;
  /** 默认值。 */
  defaultValue?: string;
};

/** 文章结构章节。 */
export type CommonV1ArticleTypeSection = {
  /** 章节标题。 */
  title?: string;
  /** 章节写作要求。 */
  guidance?: string;
  /** 是否必须生成该章节。 */
  required?: boolean;
};

/** 文章数据。 */
export type UserV1Article = {
  /** 唯一编号。 */
  id?: string;
  /** 品牌编号。 */
  brandId?: string;
  /** 文章类型编号。 */
  articleTypeId?: string;
  /** 标题。 */
  title?: string;
  /** 内容摘要。 */
  summary?: string;
  /** Markdown 格式正文。 */
  contentMarkdown?: string;
  /** HTML 格式正文。 */
  contentHtml?: string;
  /** 状态。 */
  status?: string;
  /** 来源。 */
  source?: string;
  /** 当前版本编号。 */
  currentVersionId?: string;
  /** 最新快照编号。 */
  latestSnapshotId?: string;
  /** 质量评分。 */
  qualityScore?: number;
  /** 质量检查结果 JSON。 */
  qualityResultJson?: string;
  /** 数据版本号。 */
  version?: string;
  /** 创建时间。 */
  createdAt?: string;
  /** 更新时间。 */
  updatedAt?: string;
  /** 发布时间。 */
  publishedAt?: string;
  /** 企业图库中自动匹配的文章封面。 */
  coverImageUrl?: string;
  /** 企业图库中自动匹配的正文配图。 */
  imageUrls?: Array<string>;
};

/** 文章生成任务数据。 */
export type UserV1ArticleGenerationTask = {
  /** 唯一编号。 */
  id?: string;
  /** 文章编号。 */
  articleId?: string;
  /** 文章类型版本编号。 */
  articleTypeVersionId?: string;
  /** 提示词版本编号。 */
  promptVersionId?: string;
  /** 写作模型编号。 */
  writingModelId?: string;
  /** 写作模型版本。 */
  writingModelVersion?: string;
  /** 客户端请求幂等编号。 */
  clientRequestId?: string;
  /** 状态。 */
  status?: string;
  /** 输入参数 JSON。 */
  inputJson?: string;
  /** 输出结果 JSON。 */
  outputJson?: string;
  /** 输入令牌数。 */
  inputTokens?: string;
  /** 输出令牌数。 */
  outputTokens?: string;
  /** 调用成本（微单位）。 */
  costMicros?: string;
  /** 错误编码。 */
  errorCode?: string;
  /** 错误信息。 */
  errorMessage?: string;
  /** 已尝试次数。 */
  attemptCount?: number;
  /** 结果文章版本编号。 */
  resultArticleVersionId?: string;
  /** 结果快照编号。 */
  resultSnapshotId?: string;
  /** 开始时间。 */
  startedAt?: string;
  /** 完成时间。 */
  completedAt?: string;
  /** 创建时间。 */
  createdAt?: string;
  /** 更新时间。 */
  updatedAt?: string;
};

/** 文章发布趋势数据点。 */
export type UserV1ArticlePublishTrendPoint = {
  /** 日期 YYYY-MM-DD（year 范围用 YYYY-MM）。 */
  date?: string;
  /** 当期发布数。 */
  count?: string;
};

/** 文章快照数据。 */
export type UserV1ArticleSnapshot = {
  /** 唯一编号。 */
  id?: string;
  /** 文章编号。 */
  articleId?: string;
  /** 文章版本编号。 */
  articleVersionId?: string;
  /** 文章类型版本编号。 */
  articleTypeVersionId?: string;
  /** 提示词版本编号。 */
  promptVersionId?: string;
  /** 写作模型编号。 */
  writingModelId?: string;
  /** 标题。 */
  title?: string;
  /** Markdown 格式正文。 */
  contentMarkdown?: string;
  /** HTML 格式正文。 */
  contentHtml?: string;
  /** 输入快照 JSON。 */
  inputSnapshotJson?: string;
  /** 知识引用列表 JSON。 */
  knowledgeRefsJson?: string;
  /** 内容哈希。 */
  contentHash?: string;
  /** 创建时间。 */
  createdAt?: string;
  /** 图库图片引用列表 JSON。 */
  galleryRefsJson?: string;
};

/** 企业可用文章类型目录项。 */
export type UserV1ArticleTypeCatalogItem = {
  /** 文章类型编号，创建生成任务时直接提交该编号。 */
  id?: string;
  /** 业务编码。 */
  code?: string;
  /** 名称。 */
  name?: string;
  /** 说明。 */
  description?: string;
  /** 图标地址。 */
  icon?: string;
  /** 当前配置修订号。 */
  configRevision?: number;
  /** 当前生效的结构化生成配置。 */
  config?: UserV1ArticleTypePublicConfig;
};

/** 企业侧可见的文章生成配置；不包含平台提示词和内部质量规则。 */
export type UserV1ArticleTypePublicConfig = {
  /** 内容生成目标。 */
  contentGoal?: string;
  /** 目标受众。 */
  targetAudience?: string;
  /** 文章语气。 */
  tone?: string;
  /** 建议最小字数。 */
  recommendedMinWords?: number;
  /** 建议最大字数。 */
  recommendedMaxWords?: number;
  /** 文章章节结构。 */
  sections?: Array<CommonV1ArticleTypeSection>;
  /** 企业生成时需要填写的输入项。 */
  inputFields?: Array<CommonV1ArticleTypeInputField>;
  /** 输出格式：1 Markdown。 */
  outputFormat?: number;
  /** 该类型允许的写作模型编号列表；为空时不限制。 */
  writingModelIds?: Array<string>;
  /** 默认写作模型编号。 */
  defaultWritingModelId?: string;
  /** 该类型适用的投放渠道编号列表；为空时不限制。 */
  publishChannelIds?: Array<string>;
};

/** 授权会话数据。 */
export type UserV1AuthorizationSession = {
  /** 唯一编号。 */
  id?: string;
  /** 授权会话令牌。 */
  sessionToken?: string;
  /** 客户端设备编号。 */
  deviceId?: string;
  /** 资源类型。 */
  resourceType?: number;
  /** 资源编号。 */
  resourceId?: string;
  /** 平台账号编号。 */
  platformAccountId?: string;
  /** 状态。 */
  status?: number;
  /** 过期时间。 */
  expiresAt?: string;
  /** 完成时间。 */
  completedAt?: string;
};

/** 品牌数据。 */
export type UserV1Brand = {
  /** 唯一编号。 */
  id?: string;
  /** 名称。 */
  name?: string;
  /** 品牌别名 JSON。 */
  aliasesJson?: string;
  /** 官方域名。 */
  officialDomain?: string;
  /** 说明。 */
  description?: string;
  /** 行业。 */
  industry?: string;
  /** 区域。 */
  region?: string;
  /** 目标受众。 */
  targetAudience?: string;
  /** 核心值。 */
  coreValue?: string;
  /** 状态。 */
  status?: number;
  /** 数据版本号。 */
  version?: string;
  /** 创建时间。 */
  createdAt?: string;
  /** 更新时间。 */
  updatedAt?: string;
};

/** 企业信息（顶栏 4 统计卡 + 名片）。 */
export type UserV1BrandCompanyInfo = {
  enterpriseName?: string;
  brandName?: string;
  website?: string;
  keywordCount?: string;
  termCount?: string;
  totalInclusion?: string;
  articleCount?: string;
  startedAt?: string;
  expiresAt?: string;
  brandKeywords?: Array<string>;
};

/** 数据大盘（5 聚合指标 + 各平台分项）。 */
export type UserV1BrandDashboard = {
  visibilityRate?: number;
  top3Rate?: number;
  positiveRate?: number;
  mentionCount?: string;
  dialogueRounds?: string;
  platforms?: Array<UserV1BrandPlatformStat>;
};

/** 舆情分析。 */
export type UserV1BrandIndexBottom = {
  periodType?: string;
  opinions?: Array<UserV1BrandOpinion>;
  /** 负面事件明细列表。 */
  negativeEvents?: Array<UserV1NegativeEvent>;
};

/** 主区数据（3 趋势折线 + 情感倾向表）。 */
export type UserV1BrandIndexMain = {
  inclusionTrend?: Array<UserV1BrandTrendPoint>;
  visibilityTrend?: Array<UserV1BrandTrendPoint>;
  mentionTrend?: Array<UserV1BrandTrendPoint>;
  sentimentBreakdown?: Array<UserV1BrandSentimentStat>;
};

/** 品牌推荐度。 */
export type UserV1BrandIndexTop = {
  platforms?: Array<UserV1BrandRecommendation>;
};

/** 单条舆情总结（LLM 生成的分类总结建议）。 */
export type UserV1BrandOpinion = {
  title?: string;
  summary?: string;
  sentiment?: string;
  occurredAt?: string;
};

/** 优化统计卡（顶部 6 统计）。 */
export type UserV1BrandOptimizeStats = {
  /** 累计优化天数（服务开通至今）。 */
  totalOptimizeDays?: string;
  /** 累计达标天数（收录>0 的天数）。 */
  totalQualifiedDays?: string;
  /** 达标剩余天数（服务到期距今天）。 */
  remainingDays?: string;
  /** 今日收录条数。 */
  todayInclusion?: string;
  /** 今日电话收录次数（terminal_type=1）。 */
  todayPcInclusion?: string;
  /** 今日官网收录次数（terminal_type=2）。 */
  todayMobileInclusion?: string;
};

/** 单平台数据大盘分项。 */
export type UserV1BrandPlatformStat = {
  platform?: string;
  visibilityRate?: number;
  mentionCount?: string;
  sentiment?: string;
  inclusionCount?: string;
};

/** 收录详情按问题词条聚合。 */
export type UserV1BrandQuestionStat = {
  question?: string;
  totalCount?: string;
  periodCount?: string;
};

/** 单平台推荐度。 */
export type UserV1BrandRecommendation = {
  platform?: string;
  recommendation?: number;
  inclusionCount?: string;
  visibilityRate?: number;
  mentionCount?: string;
  sentiment?: string;
};

/** 单条优化记录。 */
export type UserV1BrandRecord = {
  id?: string;
  /** 关键词文本。 */
  keyword?: string;
  /** AI 问题文本。 */
  question?: string;
  /** 平台名称。 */
  platform?: string;
  /** 平台图标 URL。 */
  platformIcon?: string;
  /** 是否收录。 */
  included?: boolean;
  /** 提及次数（该 snapshot 内品牌出现的 mention 行数）。 */
  mentionCount?: string;
  /** 品牌排名（JSON result_json.brandRank），0=无排名。 */
  brandRank?: number;
  /** 情感倾向：positive / negative / neutral。 */
  sentiment?: string;
  /** 监测端：1=电脑端 2=移动端。 */
  terminalType?: number;
  /** 对话时间（observed_at）。 */
  observedAt?: string;
  /** 对话页面链接。 */
  sessionRef?: string;
  /** 任务状态。 */
  taskStatus?: string;
  /** 联系方式曝光（AI回答中是否提及企业联系电话）。 */
  contactExposed?: boolean;
};

/** 优化记录分页响应。 */
export type UserV1BrandRecordsPage = {
  records?: Array<UserV1BrandRecord>;
  nextPageToken?: string;
  totalSize?: string;
};

/** 情感倾向统计。sentiment: positive/neutral/negative（前端显示 无/正/负）。 */
export type UserV1BrandSentimentStat = {
  sentiment?: string;
  count?: string;
  rate?: number;
};

/** 信源分析聚合响应。 */
export type UserV1BrandSourceAnalysis = {
  /** 文章发布总量（status=succeeded 的 pub_tasks 数）。 */
  articlePublishCount?: string;
  /** 文章引用总量（geo_citations 中 article_id IS NOT NULL 的行数）。 */
  articleCitationCount?: string;
  /** 引用信源总量（geo_citations 中不重复 domain 数）。 */
  sourceReferenceCount?: string;
  /** 媒体文章分布。 */
  mediaBreakdown?: UserV1MediaArticleBreakdown;
  /** Top10 文章引用排行。 */
  topArticles?: Array<UserV1SourceArticleStat>;
  /** 文章发布趋势。 */
  publishTrend?: Array<UserV1ArticlePublishTrendPoint>;
  /** Top10 信源平台分布。 */
  topSourcePlatforms?: Array<UserV1SourcePlatformStat>;
};

/** 周月报摘要。 */
export type UserV1BrandSummary = {
  periodType?: string;
  periodStart?: string;
  periodEnd?: string;
  visibilityRate?: number;
  visibilityDelta?: number;
  top3Rate?: number;
  top3RateDelta?: number;
  mentionCount?: string;
  mentionDelta?: string;
  totalInclusion?: string;
  inclusionDelta?: string;
  questions?: Array<UserV1BrandQuestionStat>;
};

/** 趋势数据点。date 格式 YYYY-MM-DD（year 范围用 YYYY-MM）。 */
export type UserV1BrandTrendPoint = {
  date?: string;
  value?: string;
  rate?: number;
};

/** 取消数据导出任务请求参数。 */
export type UserV1CancelExportJobRequest = {
  /** 唯一编号。 */
  id?: string;
};

/** 目录项数据。 */
export type UserV1CatalogItem = {
  /** 唯一编号。 */
  id?: string;
  /** 业务编码。 */
  code?: string;
  /** 名称。 */
  name?: string;
  /** 分类。 */
  category?: string;
  /** 说明。 */
  description?: string;
  /** 图标地址。 */
  icon?: string;
  /** 能力配置 JSON。 */
  capabilitiesJson?: string;
  /** 展示配置 JSON。 */
  displayConfigJson?: string;
  /** 当前版本编号。 */
  currentVersionId?: string;
  /** 是否需要账号授权。 */
  accountRequired?: boolean;
  /** 父级编号。 */
  parentId?: string;
  /** 客户端自动化驱动类型，从 1 开始。 */
  driverType?: number;
  /** 客户端授权登录入口。 */
  loginUrl?: string;
};

/** 变更文章状态请求参数。 */
export type UserV1ChangeArticleStatusRequest = {
  /** 唯一编号。 */
  id?: string;
  /** 数据版本号。 */
  version?: string;
  /** 操作类型。 */
  action?: string;
  /** 操作原因。 */
  reason?: string;
};

/** 变更监测计划状态请求参数。 */
export type UserV1ChangeMonitorPlanStatusRequest = {
  /** 唯一编号。 */
  id?: string;
  /** 数据版本号。 */
  version?: string;
  /** 操作类型。 */
  action?: string;
};

/** 变更密码请求参数。 */
export type UserV1ChangePasswordRequest = {
  /** 当前密码。 */
  currentPassword?: string;
  /** 新密码。 */
  newPassword?: string;
};

/** 变更平台账号状态请求参数。 */
export type UserV1ChangePlatformAccountStatusRequest = {
  /** 账号编号。 */
  accountId?: string;
  /** 数据版本号。 */
  version?: string;
  /** 操作类型。 */
  action?: string;
};

/** 变更发布计划状态请求参数。 */
export type UserV1ChangePublishPlanStatusRequest = {
  /** 唯一编号。 */
  id?: string;
  /** 数据版本号。 */
  version?: string;
  /** 操作类型。 */
  action?: string;
};

/** 客户端配置数据。 */
export type UserV1ClientConfig = {
  /** 最低支持版本。 */
  minimumVersion?: string;
  /** 最新客户端版本。 */
  latestVersion?: string;
  /** 是否强制升级。 */
  forceUpgrade?: boolean;
  /** 客户端下载地址。 */
  downloadUrl?: string;
  /** 可授权目标列表。 */
  authorizationTargets?: Array<UserV1CatalogItem>;
};

/** 单条空白词条。 */
export type UserV1CompetitorBlankKeyword = {
  /** 关键词。 */
  keyword?: string;
  /** AI 问题文本。 */
  question?: string;
  /** 竞品词（该回答里出现的第一个竞品名）。 */
  competitorText?: string;
  /** AI 平台名称。 */
  platform?: string;
  /** AI 问答时间（ISO 日期）。 */
  observedAt?: string;
  /** 对话页面链接（官方快照）。 */
  sessionRef?: string;
};

/** 空白词条分页响应。 */
export type UserV1CompetitorBlankKeywordsPage = {
  /** 空白词条列表。 */
  items?: Array<UserV1CompetitorBlankKeyword>;
  nextPageToken?: string;
  totalSize?: string;
};

/** 单个品牌/竞品的核心指标。 */
export type UserV1CompetitorCompareItem = {
  /** 品牌/竞品名称。 */
  name?: string;
  /** 是否本品牌。 */
  isOwnBrand?: boolean;
  /** 品牌可见度（0-1，双精度）。 */
  visibilityRate?: number;
  /** 内容采纳率（0-1）。 */
  adoptionRate?: number;
  /** AI 回答数。 */
  answerCount?: string;
  /** top3 占比（0-1）。 */
  top3Rate?: number;
};

/** 竞品核心指标对比分页响应。 */
export type UserV1CompetitorComparePage = {
  /** 对比列表（含本品牌 + 竞品，按 AI 回答数降序）。 */
  items?: Array<UserV1CompetitorCompareItem>;
  /** 趋势日期序列（近7天）。 */
  trendDates?: Array<string>;
  /** 品牌趋势数据 map（key=品牌名，value=按日提及次数）。 */
  trendData?: Record<string, UserV1CompetitorTrendValues>;
};

/** 单个 AI 平台的品牌排序。 */
export type UserV1CompetitorPlatformRanking = {
  /** 平台名称。 */
  platform?: string;
  /** 前 5 名品牌列表（按 rank 升序）。 */
  items?: Array<UserV1CompetitorRankItem>;
};

/** 单个品牌排序项（本品牌或竞品）。 */
export type UserV1CompetitorRankItem = {
  /** 品牌/竞品名称。 */
  name?: string;
  /** 排名 1-5，0=无法判定。 */
  rank?: number;
  /** 是否本品牌（前端高亮）。 */
  isOwnBrand?: boolean;
  /** 提及数（按条数，一条回答出现N次算1次）。 */
  mentionCount?: string;
};

/** 竞品品牌排序分页响应。 */
export type UserV1CompetitorRankingPage = {
  /** 按 AI 平台分组的品牌排序。 */
  platforms?: Array<UserV1CompetitorPlatformRanking>;
};

/** 品牌按日提及次数序列。 */
export type UserV1CompetitorTrendValues = { values?: Array<string> };

/** 创建文章生成请求参数。 */
export type UserV1CreateArticleGenerationRequest = {
  /** 客户端请求幂等编号。 */
  clientRequestId?: string;
  /** 文章编号。 */
  articleId?: string;
  /** 品牌编号。 */
  brandId?: string;
  /** 文章类型版本编号。 */
  articleTypeVersionId?: string;
  /** 写作模型编号。 */
  writingModelId?: string;
  /** 知识库编号列表。兼容旧客户端；新客户端应使用 knowledge_document_ids 精确选择企业知识。 */
  knowledgeBaseIds?: Array<string>;
  /** 输入参数 JSON。 */
  inputJson?: string;
  /** 用户指令。 */
  userInstruction?: string;
  /** 文章类型编号。后端自动锁定当前配置修订；新客户端应使用该字段。 */
  articleTypeId?: string;
  /** 目标关键词编号。 */
  keywordId?: string;
  /** 目标问题编号；生成标题必须围绕该问题。 */
  questionId?: string;
  /** 本次生成可使用的企业图库相册编号列表。 */
  galleryAlbumIds?: Array<string>;
  /** 需要随机插入正文的图库图片数量，0 表示不插图，最大 20。 */
  galleryImageCount?: number;
  /** 企业知识条目编号列表，至少选择一个；仅引用已解析内容。 */
  knowledgeDocumentIds?: Array<string>;
};

/** 创建文章请求参数。 */
export type UserV1CreateArticleRequest = {
  /** 文章。 */
  article?: UserV1Article;
};

/** 创建文章快照请求参数。 */
export type UserV1CreateArticleSnapshotRequest = {
  /** 唯一编号。 */
  id?: string;
  /** 数据版本号。 */
  version?: string;
  /** 文章类型版本编号。 */
  articleTypeVersionId?: string;
  /** 提示词版本编号。 */
  promptVersionId?: string;
  /** 写作模型编号。 */
  writingModelId?: string;
  /** 输入快照 JSON。 */
  inputSnapshotJson?: string;
  /** 知识引用列表 JSON。 */
  knowledgeRefsJson?: string;
  /** 图库图片引用列表 JSON。 */
  galleryRefsJson?: string;
};

/** 创建授权会话请求参数。 */
export type UserV1CreateAuthorizationSessionRequest = {
  /** 客户端设备编号。 */
  deviceId?: string;
  /** 资源类型。 */
  resourceType?: number;
  /** 资源编号。 */
  resourceId?: string;
  /** 平台账号编号。 */
  platformAccountId?: string;
};

/** 创建品牌请求参数。 */
export type UserV1CreateBrandRequest = {
  /** 品牌。 */
  brand?: UserV1Brand;
};

/** 创建数据导出任务请求参数。 */
export type UserV1CreateExportJobRequest = {
  /** 资源类型。 */
  resourceType?: string;
  /** 格式。 */
  format?: string;
  /** 资源专用且创建后不可变的导出筛选条件 JSON。 */
  filterJson?: string;
  /** 客户端请求幂等编号。 */
  clientRequestId?: string;
};

export type UserV1CreateGalleryAlbumRequest = { album?: UserV1GalleryAlbum };

/** 创建关键词请求参数。 */
export type UserV1CreateKeywordRequest = {
  /** 搜索关键词。 */
  keyword?: UserV1Keyword;
  /** 创建后立即蒸馏的问题数量，1-20。 */
  distillQuestionCount?: number;
  /** 指定问题蒸馏模型；为 0 时自动选择企业可用模型。 */
  writingModelId?: string;
  /** 客户端幂等编号。 */
  clientRequestId?: string;
};

/** 创建知识库请求参数。 */
export type UserV1CreateKnowledgeBaseRequest = {
  /** 知识库。 */
  knowledgeBase?: UserV1KnowledgeBase;
};

/** 创建知识文档请求参数。 */
export type UserV1CreateKnowledgeDocumentRequest = {
  /** 文档。 */
  document?: UserV1KnowledgeDocument;
  /** 内容。 */
  content?: string;
};

/** 创建 GEO 监测计划请求参数。 */
export type UserV1CreateMonitorPlanRequest = {
  /** 套餐。 */
  plan?: UserV1MonitorPlan;
};

/** 创建发布计划请求参数。 */
export type UserV1CreatePublishPlanRequest = {
  /** 名称。 */
  name?: string;
  /** 文章编号（已弃用：单文章接口保留向后兼容，新调用请用 article_ids）。 */
  articleId?: string;
  /** 文章快照编号（已弃用：同上）。 */
  articleSnapshotId?: string;
  /** 调度类型。 */
  scheduleType?: number;
  /** 计划执行时间。 */
  scheduledAt?: string;
  /** 时区。 */
  timezone?: string;
  /** 失败处理策略 JSON。 */
  failurePolicyJson?: string;
  /** 客户端请求幂等编号。 */
  clientRequestId?: string;
  /** 目标列表。 */
  targets?: Array<UserV1PublishTargetInput>;
  /** 去重策略：no_dedup（默认，不去重）/ all_unique（全部去重，按轮询分配）/ per_platform（单平台去重）。 */
  dedupStrategy?: string;
  /** 文章编号列表（有序；与 article_snapshot_ids 一一对应）。 */
  articleIds?: Array<string>;
  /** 文章快照编号列表（与 article_ids 一一对应）。 */
  articleSnapshotIds?: Array<string>;
};

/** 创建问题请求参数。 */
export type UserV1CreateQuestionRequest = {
  /** 问题。 */
  question?: UserV1Question;
};

export type UserV1CreateSubscriptionOrderRequest = {
  planId?: string;
  orderType?: string;
  cycle?: string;
  amountMinorUnits?: string;
  creditsAmount?: string;
  remark?: string;
};

/** 企业名片数据。 */
export type UserV1DashboardCompanyCard = {
  /** 企业名称。 */
  enterpriseName?: string;
  /** 上线时间。 */
  onlineAt?: string;
  /** 到期时间。 */
  expireAt?: string;
  /** 联系方式。 */
  contact?: string;
  /** 官网地址。 */
  website?: string;
  /** AI 训练量（被分析过的回答快照数）。 */
  aiTrainingCount?: string;
  /** 品牌名称。 */
  brandName?: string;
  /** AI 画像关键词列表。 */
  keywords?: Array<string>;
  /** 关键词数量。 */
  keywordCount?: string;
  /** 词条总量（关键词蒸馏的问题数量）。 */
  questionCount?: string;
  /** 品牌名称列表（企业下所有品牌）。 */
  brandNames?: Array<string>;
};

/** 看板数据总览。 */
export type UserV1DashboardOverview = {
  /** 收录总量（企业级，brand_mentioned=true 的快照数）。 */
  totalIncluded?: string;
  /** 近30天收录量。 */
  recentIncluded?: string;
  /** 文章发布量（已发布状态的文章数）。 */
  publishedArticles?: string;
  /** 联系方式曝光量（提及表中与品牌相关的记录数）。 */
  contactExposure?: string;
};

/** 分平台收录量。 */
export type UserV1DashboardSiteStat = {
  /** 检测模型站点编号。 */
  inclusionSiteId?: string;
  /** 站点名称。 */
  siteName?: string;
  /** 收录量。 */
  included?: string;
};

/** Top 热词榜项。 */
export type UserV1DashboardTopKeyword = {
  /** 关键词编号。 */
  keywordId?: string;
  /** 关键词文本。 */
  keyword?: string;
  /** 收录成功次数。 */
  includedCount?: string;
};

/** 趋势图数据点。 */
export type UserV1DashboardTrendPoint = {
  /** 日期（YYYY-MM-DD）。 */
  date?: string;
  /** 当日收录量。 */
  included?: string;
};

/** 蒸馏关键词问题请求参数。 */
export type UserV1DistillKeywordQuestionsRequest = {
  /** 关键词编号。 */
  keywordId?: string;
  /** 期望问题数量，1-20。 */
  questionCount?: number;
  /** 可选区域；为空时沿用关键词区域。 */
  region?: string;
  /** 指定模型；为 0 时自动选择企业可用的问题蒸馏模型。 */
  writingModelId?: string;
  /** 客户端幂等编号。 */
  clientRequestId?: string;
};

/** 企业资料数据。 */
export type UserV1EnterpriseProfile = {
  /** 企业编号。 */
  enterpriseId?: string;
  /** 业务编码。 */
  code?: string;
  /** 名称。 */
  name?: string;
  /** 状态。 */
  status?: string;
  /** 行业。 */
  industry?: string;
  /** 区域。 */
  region?: string;
  /** 时区。 */
  timezone?: string;
  /** 语言区域。 */
  locale?: string;
  /** 联系人名称。 */
  contactName?: string;
  /** 联系人邮箱。 */
  contactEmail?: string;
  /** 联系人手机号。 */
  contactPhone?: string;
  /** 通知偏好 JSON。 */
  notificationJson?: string;
  /** 数据版本号。 */
  version?: string;
  /** 套餐名称。 */
  planName?: string;
  /** 订阅过期时间。 */
  subscriptionExpiresAt?: string;
  /** 配额列表。 */
  quotas?: Array<UserV1Quota>;
  /** 点数余额（毫点）。 */
  pointsBalance?: string;
  /** 冻结点数（毫点）。 */
  pointsFrozen?: string;
  /** 订阅状态：active / expired。 */
  subscriptionStatus?: string;
};

/** 数据导出任务数据。 */
export type UserV1ExportJob = {
  /** 唯一编号。 */
  id?: string;
  /** 资源类型。 */
  resourceType?: string;
  /** 格式。 */
  format?: string;
  /** 筛选条件 JSON。 */
  filterJson?: string;
  /** 状态。 */
  status?: string;
  /** 客户端请求幂等编号。 */
  clientRequestId?: string;
  /** 下载就绪。 */
  downloadReady?: boolean;
  /** 文件哈希。 */
  fileHash?: string;
  /** 过期时间。 */
  expiresAt?: string;
  /** 错误信息。 */
  errorMessage?: string;
  /** 完成时间。 */
  completedAt?: string;
  /** 取消时间。 */
  cancelledAt?: string;
  /** 创建时间。 */
  createdAt?: string;
  /** 更新时间。 */
  updatedAt?: string;
};

/** 企业相册。 */
export type UserV1GalleryAlbum = {
  id?: string;
  name?: string;
  category?: number;
  description?: string;
  version?: string;
  imageCount?: string;
  coverImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

/** 企业图库图片。 */
export type UserV1GalleryImage = {
  id?: string;
  albumId?: string;
  originalName?: string;
  objectKey?: string;
  url?: string;
  mimeType?: string;
  sizeBytes?: string;
  contentHash?: string;
  version?: string;
  createdAt?: string;
};

/** GEO 回答数据。 */
export type UserV1GeoAnswer = {
  /** 快照编号。 */
  snapshotId?: string;
  /** 任务编号。 */
  taskId?: string;
  /** 问题文本。 */
  questionText?: string;
  /** 回答文本。 */
  answerText?: string;
  /** 回答状态。 */
  answerStatus?: string;
  /** 截图键名。 */
  screenshotKey?: string;
  /** 证据数据 JSON。 */
  evidenceJson?: string;
  /** 采集时间。 */
  observedAt?: string;
  /** 引用列表。 */
  citations?: Array<UserV1GeoCitation>;
  /** 提及列表。 */
  mentions?: Array<UserV1GeoMention>;
  /** 可见性评分。 */
  visibilityScore?: number;
  /** 准确性评分。 */
  accuracyScore?: number;
  /** 置信度。 */
  confidence?: number;
  /** 对话页面链接（session_ref），用于跳转到原始对话页面。 */
  sessionRef?: string;
};

/** GEO 引用数据。 */
export type UserV1GeoCitation = {
  /** 地址。 */
  url?: string;
  /** 域名。 */
  domain?: string;
  /** 标题。 */
  title?: string;
  /** 位置。 */
  position?: number;
  /** 企业来源。 */
  enterpriseSource?: boolean;
  /** 文章编号。 */
  articleId?: string;
};

/** GEO 数据看板。 */
export type UserV1GeoDashboard = {
  /** 企业名片。 */
  company?: UserV1DashboardCompanyCard;
  /** 数据总览。 */
  overview?: UserV1DashboardOverview;
  /** 趋势图数据点。 */
  trend?: Array<UserV1DashboardTrendPoint>;
  /** 分平台收录量。 */
  siteStats?: Array<UserV1DashboardSiteStat>;
  /** Top 热词榜。 */
  topKeywords?: Array<UserV1DashboardTopKeyword>;
  /** 收录明细任务列表。 */
  tasks?: Array<UserV1GeoTask>;
  /** 下一页分页令牌。 */
  nextPageToken?: string;
  /** 总记录数。 */
  totalSize?: string;
  /** 更新时间。 */
  updatedAt?: string;
};

/** GEO 提及数据。 */
export type UserV1GeoMention = {
  /** 实体类型。 */
  entityType?: string;
  /** 实体编号。 */
  entityId?: string;
  /** 文本。 */
  text?: string;
  /** 位置。 */
  position?: number;
  /** 情感倾向。 */
  sentiment?: string;
  /** 置信度。 */
  confidence?: number;
};

/** GEO 指标数据。 */
export type UserV1GeoMetrics = {
  /** 回答总数。 */
  totalAnswers?: string;
  /** 有效回答数量。 */
  validAnswers?: string;
  /** 品牌提及比例。 */
  brandMentionRate?: number;
  /** 引用比例。 */
  citationRate?: number;
  /** 问题覆盖率比例。 */
  questionCoverageRate?: number;
  /** 平均可见性评分。 */
  averageVisibilityScore?: number;
};

/** GEO 报告筛选条件数据。 */
export type UserV1GeoReportFilter = {
  /** 品牌编号。 */
  brandId?: string;
  /** 检测模型站点编号。 */
  inclusionSiteId?: string;
  /** 开始日期。 */
  from?: string;
  /** 结束日期，为不包含该日期的上界。 */
  to?: string;
};

/** GEO 报告指标数据。 */
export type UserV1GeoReportMetrics = {
  /** 回答总数。 */
  totalAnswers?: string;
  /** 有效回答数量。 */
  validAnswers?: string;
  /** 品牌提及率。 */
  brandMentionRate?: number;
  /** 引用率。 */
  citationRate?: number;
  /** 问题覆盖率。 */
  questionCoverageRate?: number;
  /** 平均可见性评分。 */
  averageVisibilityScore?: number;
};

/** GEO 报告汇总数据。 */
export type UserV1GeoReportSummary = {
  /** 筛选条件。 */
  filter?: UserV1GeoReportFilter;
  /** 指标集合。 */
  metrics?: UserV1GeoReportMetrics;
  /** 生成时间。 */
  generatedAt?: string;
};

/** GEO 报告趋势点数据。 */
export type UserV1GeoReportTrendPoint = {
  /** UTC 日历日期，格式为 YYYY-MM-DD。 */
  date?: string;
  /** 指标集合。 */
  metrics?: UserV1GeoReportMetrics;
};

/** GEO 站点表现数据。 */
export type UserV1GeoSitePerformance = {
  /** 检测模型站点编号。 */
  inclusionSiteId?: string;
  /** 检测模型站点名称。 */
  inclusionSiteName?: string;
  /** 指标集合。 */
  metrics?: UserV1GeoReportMetrics;
};

/** GEO 检测任务数据。 */
export type UserV1GeoTask = {
  /** 唯一编号。 */
  id?: string;
  /** 监测计划编号。 */
  monitorPlanId?: string;
  /** 品牌编号。 */
  brandId?: string;
  /** 问题编号。 */
  questionId?: string;
  /** 检测模型站点编号。 */
  inclusionSiteId?: string;
  /** 平台账号编号。 */
  platformAccountId?: string;
  /** 模型入口。 */
  modelEntry?: string;
  /** 语言区域。 */
  locale?: string;
  /** 区域。 */
  region?: string;
  /** 状态。 */
  status?: string;
  /** 任务优先级。 */
  priority?: number;
  /** 计划执行时间。 */
  scheduledAt?: string;
  /** 错误分类。 */
  errorCategory?: string;
  /** 错误编码。 */
  errorCode?: string;
  /** 错误信息。 */
  errorMessage?: string;
  /** 完成时间。 */
  completedAt?: string;
  /** 对话页面链接（session_ref），用于跳转到原始对话页面。 */
  sessionRef?: string;
  /** 是否收录成功（基于最新 analysis_result 的 brand_mentioned 字段）。 */
  brandMentioned?: boolean;
  /** 终端类型: 1=电脑端 2=移动端。 */
  terminalType?: number;
};

/** 关键词数据。 */
export type UserV1Keyword = {
  /** 唯一编号。 */
  id?: string;
  /** 品牌编号。 */
  brandId?: string;
  /** 文本。 */
  text?: string;
  /** 标签 JSON。 */
  tagsJson?: string;
  /** 任务优先级。 */
  priority?: number;
  /** 状态。 */
  status?: string;
  /** 来源。 */
  source?: string;
  /** 数据版本号。 */
  version?: string;
  /** 创建时间。 */
  createdAt?: string;
  /** 更新时间。 */
  updatedAt?: string;
  /** 可选区域，例如“北京”。 */
  region?: string;
  /** 最近一次请求蒸馏的问题数量。 */
  requestedQuestionCount?: number;
  /** 最近一次成功蒸馏的问题数量。 */
  distilledQuestionCount?: number;
  /** 蒸馏状态：1待执行、2执行中、3已完成、4失败。 */
  distillationStatus?: number;
  /** 最近一次蒸馏任务编号。 */
  lastDistillationTaskId?: string;
  /** 最近一次蒸馏错误。 */
  distillationError?: string;
};

/** 关键词问题蒸馏任务。 */
export type UserV1KeywordDistillationTask = {
  id?: string;
  keywordId?: string;
  brandId?: string;
  writingModelId?: string;
  writingModelVersion?: string;
  clientRequestId?: string;
  /** 1待执行、2执行中、3已完成、4失败。 */
  status?: number;
  region?: string;
  requestedCount?: number;
  outputJson?: string;
  inputTokens?: string;
  outputTokens?: string;
  costMicros?: string;
  errorCode?: string;
  errorMessage?: string;
  attemptCount?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

/** 知识库数据。 */
export type UserV1KnowledgeBase = {
  /** 唯一编号。 */
  id?: string;
  /** 名称。 */
  name?: string;
  /** 说明。 */
  description?: string;
  /** 状态。 */
  status?: number;
  /** 数据版本号。 */
  version?: string;
  /** 创建时间。 */
  createdAt?: string;
  /** 更新时间。 */
  updatedAt?: string;
};

/** 知识分块数据。 */
export type UserV1KnowledgeChunk = {
  /** 唯一编号。 */
  id?: string;
  /** 知识文档编号。 */
  knowledgeDocumentId?: string;
  /** 文档版本。 */
  documentVersion?: number;
  /** 分块序号。 */
  chunkIndex?: number;
  /** 内容。 */
  content?: string;
  /** 内容哈希。 */
  contentHash?: string;
  /** 内容定位信息 JSON。 */
  locatorJson?: string;
  /** 扩展元数据 JSON。 */
  metadataJson?: string;
  /** 创建时间。 */
  createdAt?: string;
};

/** 知识文档数据。 */
export type UserV1KnowledgeDocument = {
  /** 唯一编号。 */
  id?: string;
  /** 知识库编号。 */
  knowledgeBaseId?: string;
  /** 标题。 */
  title?: string;
  /** 来源类型。 */
  sourceType?: number;
  /** 来源地址。 */
  sourceUrl?: string;
  /** 对象键名。 */
  objectKey?: string;
  /** 内容哈希。 */
  contentHash?: string;
  /** MIME 类型。 */
  mimeType?: string;
  /** 解析状态。 */
  parseStatus?: number;
  /** 解析错误。 */
  parseError?: string;
  /** 文档版本。 */
  documentVersion?: number;
  /** 扩展元数据 JSON。 */
  metadataJson?: string;
  /** 创建时间。 */
  createdAt?: string;
  /** 更新时间。 */
  updatedAt?: string;
  /** GEO 内容上下文分类。 */
  category?: number;
  /** 用户录入的正文内容。 */
  content?: string;
};

/** 查询文章生成任务列表响应结果。 */
export type UserV1ListArticleGenerationsReply = {
  /** 数据列表。 */
  items?: Array<UserV1ArticleGenerationTask>;
  /** 下一页分页令牌。 */
  nextPageToken?: string;
  /** 总记录数。 */
  totalSize?: string;
};

/** 查询文章类型目录响应结果。 */
export type UserV1ListArticleTypeCatalogReply = {
  /** 数据列表。 */
  items?: Array<UserV1ArticleTypeCatalogItem>;
};

/** 查询文章列表响应结果。 */
export type UserV1ListArticlesReply = {
  /** 数据列表。 */
  items?: Array<UserV1Article>;
  /** 下一页分页令牌。 */
  nextPageToken?: string;
  /** 总记录数。 */
  totalSize?: string;
};

/** 查询品牌列表响应结果。 */
export type UserV1ListBrandsReply = {
  /** 数据列表。 */
  items?: Array<UserV1Brand>;
  /** 下一页分页令牌。 */
  nextPageToken?: string;
  /** 总记录数。 */
  totalSize?: string;
};

/** 查询导出任务列表响应结果。 */
export type UserV1ListExportJobsReply = {
  /** 数据列表。 */
  items?: Array<UserV1ExportJob>;
  /** 下一页分页令牌。 */
  nextPageToken?: string;
  /** 总记录数。 */
  totalSize?: string;
};

export type UserV1ListGalleryAlbumsReply = {
  items?: Array<UserV1GalleryAlbum>;
  nextPageToken?: string;
  totalSize?: string;
};

export type UserV1ListGalleryImagesReply = {
  items?: Array<UserV1GalleryImage>;
  nextPageToken?: string;
  totalSize?: string;
};

/** 查询 GEO 报告趋势响应结果。 */
export type UserV1ListGeoReportTrendReply = {
  /** 筛选条件。 */
  filter?: UserV1GeoReportFilter;
  /** 数据列表。 */
  items?: Array<UserV1GeoReportTrendPoint>;
  /** 生成时间。 */
  generatedAt?: string;
};

/** 查询 GEO 站点表现响应结果。 */
export type UserV1ListGeoSitePerformanceReply = {
  /** 筛选条件。 */
  filter?: UserV1GeoReportFilter;
  /** 数据列表。 */
  items?: Array<UserV1GeoSitePerformance>;
  /** 生成时间。 */
  generatedAt?: string;
};

/** 查询 GEO 检测任务列表响应结果。 */
export type UserV1ListGeoTasksReply = {
  /** 数据列表。 */
  items?: Array<UserV1GeoTask>;
  /** 下一页分页令牌。 */
  nextPageToken?: string;
  /** 总记录数。 */
  totalSize?: string;
};

/** 查询检测站点目录响应结果。 */
export type UserV1ListInclusionSiteCatalogReply = {
  /** 数据列表。 */
  items?: Array<UserV1CatalogItem>;
};

/** 查询客户端可用模型检测站点响应结果。 */
export type UserV1ListInclusionSitesReply = {
  /** 数据列表。 */
  items?: Array<UserV1CatalogItem>;
};

export type UserV1ListKeywordDistillationsReply = {
  items?: Array<UserV1KeywordDistillationTask>;
  nextPageToken?: string;
  totalSize?: string;
};

/** 查询关键词列表响应结果。 */
export type UserV1ListKeywordsReply = {
  /** 数据列表。 */
  items?: Array<UserV1Keyword>;
  /** 下一页分页令牌。 */
  nextPageToken?: string;
  /** 总记录数。 */
  totalSize?: string;
};

/** 查询知识库列表响应结果。 */
export type UserV1ListKnowledgeBasesReply = {
  /** 数据列表。 */
  items?: Array<UserV1KnowledgeBase>;
  /** 下一页分页令牌。 */
  nextPageToken?: string;
  /** 总记录数。 */
  totalSize?: string;
};

/** 查询知识分块列表响应结果。 */
export type UserV1ListKnowledgeChunksReply = {
  /** 数据列表。 */
  items?: Array<UserV1KnowledgeChunk>;
  /** 下一页分页令牌。 */
  nextPageToken?: string;
  /** 总记录数。 */
  totalSize?: string;
};

/** 查询知识文档列表响应结果。 */
export type UserV1ListKnowledgeDocumentsReply = {
  /** 数据列表。 */
  items?: Array<UserV1KnowledgeDocument>;
  /** 下一页分页令牌。 */
  nextPageToken?: string;
  /** 总记录数。 */
  totalSize?: string;
};

/** 查询监测计划列表响应结果。 */
export type UserV1ListMonitorPlansReply = {
  /** 数据列表。 */
  items?: Array<UserV1MonitorPlan>;
  /** 下一页分页令牌。 */
  nextPageToken?: string;
  /** 总记录数。 */
  totalSize?: string;
};

export type UserV1ListMyOrdersReply = {
  items?: Array<UserV1UserSubscriptionOrder>;
  nextPageToken?: string;
  totalSize?: string;
};

/** 查询通知列表响应结果。 */
export type UserV1ListNotificationsReply = {
  /** 数据列表。 */
  items?: Array<UserV1Notification>;
  /** 下一页分页令牌。 */
  nextPageToken?: string;
  /** 总记录数。 */
  totalSize?: string;
};

/** 查询平台账号列表响应结果。 */
export type UserV1ListPlatformAccountsReply = {
  /** 数据列表。 */
  items?: Array<UserV1PlatformAccount>;
};

/** 查询投放渠道目录响应结果。 */
export type UserV1ListPublishChannelCatalogReply = {
  /** 数据列表。 */
  items?: Array<UserV1CatalogItem>;
};

/** 查询客户端可用投放渠道响应结果。 */
export type UserV1ListPublishChannelsReply = {
  /** 数据列表。 */
  items?: Array<UserV1CatalogItem>;
};

/** 查询发布计划列表响应结果。 */
export type UserV1ListPublishPlansReply = {
  /** 数据列表。 */
  items?: Array<UserV1PublishPlan>;
  /** 下一页分页令牌。 */
  nextPageToken?: string;
  /** 总记录数。 */
  totalSize?: string;
};

/** 查询发布目标目录响应结果。 */
export type UserV1ListPublishTargetCatalogReply = {
  /** 数据列表。 */
  items?: Array<UserV1CatalogItem>;
};

export type UserV1ListPurchasablePlansReply = {
  items?: Array<UserV1PurchasablePlan>;
};

/** 查询问题列表响应结果。 */
export type UserV1ListQuestionsReply = {
  /** 数据列表。 */
  items?: Array<UserV1Question>;
  /** 下一页分页令牌。 */
  nextPageToken?: string;
  /** 总记录数。 */
  totalSize?: string;
};

/** 查询会话列表响应结果。 */
export type UserV1ListSessionsReply = {
  /** 数据列表。 */
  items?: Array<UserV1Session>;
};

/** 查询成功发布任务列表响应结果。 */
export type UserV1ListSucceededPublishTasksReply = {
  /** 数据列表。 */
  items?: Array<UserV1PublishTask>;
  /** 下一页分页令牌。 */
  nextPageToken?: string;
  /** 总记录数。 */
  totalSize?: string;
};

/** 查询写作模型目录响应结果。 */
export type UserV1ListWritingModelCatalogReply = {
  /** 数据列表。 */
  items?: Array<UserV1CatalogItem>;
};

/** 登录响应结果。 */
export type UserV1LoginReply = {
  /** 访问令牌。 */
  accessToken?: string;
  /** 刷新令牌。 */
  refreshToken?: string;
  /** 访问令牌过期时间。 */
  accessExpiresAt?: string;
  /** 企业。 */
  enterprise?: UserV1EnterpriseProfile;
};

/** 登录请求参数。 */
export type UserV1LoginRequest = {
  /** 登录用户名。 */
  username?: string;
  /** 登录密码。 */
  password?: string;
  /** 客户端设备编号。 */
  deviceId?: string;
};

/** 退出登录请求参数。 */
export type UserV1LogoutRequest = {
  /** 是否作用于全部会话。 */
  allSessions?: boolean;
};

/** 标记全部通知已读响应结果。 */
export type UserV1MarkAllNotificationsReadReply = {
  /** 更新数量。 */
  updatedCount?: string;
};

/** 标记通知已读请求参数。 */
export type UserV1MarkNotificationReadRequest = {
  /** 唯一编号。 */
  id?: string;
};

/** 媒体文章分布（按来源类型，对应 cfg_publish_channels.category：1=自媒体 2=官方媒体 3=KOL）。 */
export type UserV1MediaArticleBreakdown = {
  total?: string;
  /** 自媒体文章数。 */
  selfMediaCount?: string;
  /** 官方媒体文章数。 */
  commercialMediaCount?: string;
  /** KOL 文章数。 */
  officialKbCount?: string;
};

/** GEO 监测计划数据。 */
export type UserV1MonitorPlan = {
  /** 唯一编号。 */
  id?: string;
  /** 名称。 */
  name?: string;
  /** 品牌编号。 */
  brandId?: string;
  /** 状态。 */
  status?: number;
  /** 调度类型。 */
  scheduleType?: number;
  /** Cron 表达式。 */
  cronExpression?: string;
  /** 时区。 */
  timezone?: string;
  /** 问题编号列表 JSON。 */
  questionIdsJson?: string;
  /** 检测站点目标 JSON。 */
  siteTargetsJson?: string;
  /** 下一次运行时间。 */
  nextRunAt?: string;
  /** 最近运行时间。 */
  lastRunAt?: string;
  /** 客户端请求幂等编号。 */
  clientRequestId?: string;
  /** 数据版本号。 */
  version?: string;
  /** 创建时间。 */
  createdAt?: string;
  /** 监测终端: 1=电脑端 2=移动端 3=并行(PC+移动端)。 */
  monitorTerminal?: number;
};

/** 负面事件明细（单条 negative AI 回答）。 */
export type UserV1NegativeEvent = {
  /** 平台名称（DeepSeek/Kimi 等）。 */
  platform?: string;
  /** 用户提问。 */
  question?: string;
  /** AI 回答摘要（前 200 字）。 */
  answerPreview?: string;
  /** 情感（固定 negative）。 */
  sentiment?: string;
  /** 查看链接（session_ref）。 */
  shareUrl?: string;
  /** 采集时间。 */
  observedAt?: string;
};

/** 通知数据。 */
export type UserV1Notification = {
  /** 唯一编号。 */
  id?: string;
  /** 渠道。 */
  channel?: string;
  /** 模板编码。 */
  templateCode?: string;
  /** 业务载荷 JSON。 */
  payloadJson?: string;
  /** 投递状态。 */
  deliveryStatus?: string;
  /** 计划执行时间。 */
  scheduledAt?: string;
  /** 发送时间。 */
  sentAt?: string;
  /** 已读时间。 */
  readAt?: string;
  /** 创建时间。 */
  createdAt?: string;
};

/** 平台授权账号数据。 */
export type UserV1PlatformAccount = {
  /** 唯一编号。 */
  id?: string;
  /** 资源类型：1 表示自媒体投放渠道，2 表示模型检测站点。 */
  resourceType?: number;
  /** 资源编号。 */
  resourceId?: string;
  /** 授权账号名称。 */
  accountName?: string;
  /** 外部平台账号编号。 */
  externalId?: string;
  /** 脱敏身份标识。 */
  maskedIdentity?: string;
  /** 授权状态。 */
  authorizationStatus?: number;
  /** 使用状态。 */
  usageStatus?: number;
  /** 过期时间。 */
  expiresAt?: string;
  /** 最近验证时间。 */
  lastVerifiedAt?: string;
  /** 最近使用时间。 */
  lastUsedAt?: string;
  /** 每日使用上限。 */
  dailyLimit?: string;
  /** 是否为默认项。 */
  isDefault?: boolean;
  /** 扩展元数据 JSON。 */
  metadataJson?: string;
  /** 数据版本号。 */
  version?: string;
};

/** 平台账号授权凭据。 */
export type UserV1PlatformAccountCredential = {
  /** 平台账号编号。 */
  accountId?: string;
  /** 客户端加密后的授权凭据密文。 */
  credentialPayload?: string;
};

/** 发布计划数据。 */
export type UserV1PublishPlan = {
  /** 唯一编号。 */
  id?: string;
  /** 名称。 */
  name?: string;
  /** 文章编号。 */
  articleId?: string;
  /** 文章快照编号。 */
  articleSnapshotId?: string;
  /** 状态。 */
  status?: number;
  /** 调度类型。 */
  scheduleType?: number;
  /** 计划执行时间。 */
  scheduledAt?: string;
  /** 时区。 */
  timezone?: string;
  /** 失败处理策略 JSON。 */
  failurePolicyJson?: string;
  /** 客户端请求幂等编号。 */
  clientRequestId?: string;
  /** 数据版本号。 */
  version?: string;
  /** 创建时间。 */
  createdAt?: string;
  /** 文章标题。 */
  articleTitle?: string;
  /** 去重策略：no_dedup / all_unique / per_platform。 */
  dedupStrategy?: string;
  /** 关联文章数（多文章计划摘要）。 */
  articleCount?: number;
  /** 关联平台数（多平台计划摘要）。 */
  platformCount?: number;
  /** 任务总数。 */
  taskCount?: number;
  /** 成功任务数。 */
  succeededCount?: number;
  /** 失败任务数。 */
  failedCount?: number;
};

/** 发布计划详情数据。 */
export type UserV1PublishPlanDetail = {
  /** 套餐。 */
  plan?: UserV1PublishPlan;
  /** 任务列表。 */
  tasks?: Array<UserV1PublishTask>;
};

/** 发布目标输入数据。 */
export type UserV1PublishTargetInput = {
  /** 发布渠道编号。 */
  publishChannelId?: string;
  /** 发布目标编号。 */
  publishTargetId?: string;
  /** 平台账号编号。 */
  platformAccountId?: string;
  /** 执行模式。 */
  executionMode?: string;
  /** 任务优先级。 */
  priority?: number;
};

/** 发布任务数据。 */
export type UserV1PublishTask = {
  /** 唯一编号。 */
  id?: string;
  /** 发布计划编号。 */
  publishPlanId?: string;
  /** 发布渠道编号。 */
  publishChannelId?: string;
  /** 发布目标编号。 */
  publishTargetId?: string;
  /** 平台账号编号。 */
  platformAccountId?: string;
  /** 执行模式。 */
  executionMode?: string;
  /** 状态。 */
  status?: string;
  /** 任务优先级。 */
  priority?: number;
  /** 计划执行时间。 */
  scheduledAt?: string;
  /** 已尝试次数。 */
  attemptCount?: number;
  /** 最大尝试次数。 */
  maxAttempts?: number;
  /** 结果地址。 */
  resultUrl?: string;
  /** 平台文章编号。 */
  platformArticleId?: string;
  /** 错误分类。 */
  errorCategory?: string;
  /** 错误编码。 */
  errorCode?: string;
  /** 错误信息。 */
  errorMessage?: string;
  /** 完成时间。 */
  completedAt?: string;
  /** 数据版本号。 */
  version?: string;
  /** 最近一次执行结果 JSON。 */
  resultJson?: string;
  /** 最近一次检测证据 JSON。 */
  evidenceJson?: string;
  /** 文章编号（从 plan 冗余，用于去重查询）。 */
  articleId?: string;
};

/** 可购套餐数据。 */
export type UserV1PurchasablePlan = {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  /** 半年价（分）。 */
  halfYearlyPriceMinorUnits?: string;
  yearlyPriceMinorUnits?: string;
  currency?: string;
  billingCycle?: string;
  seriesCode?: string;
  grantedPoints?: string;
  sortOrder?: number;
  limits?: Array<UserV1PurchasablePlanLimit>;
  features?: Array<UserV1PurchasablePlanFeature>;
};

export type UserV1PurchasablePlanFeature = {
  feature?: number;
  enabled?: boolean;
};

export type UserV1PurchasablePlanLimit = {
  metric?: number;
  limitValue?: string;
  period?: number;
};

/** 问题数据。 */
export type UserV1Question = {
  /** 唯一编号。 */
  id?: string;
  /** 关键词编号。 */
  keywordId?: string;
  /** 品牌编号。 */
  brandId?: string;
  /** 文本。 */
  text?: string;
  /** 状态。 */
  status?: number;
  /** 意图。 */
  intent?: number;
  /** 受众。 */
  audience?: string;
  /** 漏斗阶段。 */
  funnelStage?: number;
  /** 集群编码。 */
  clusterCode?: string;
  /** 任务优先级。 */
  priority?: number;
  /** 排序值。 */
  sortOrder?: number;
  /** 数据版本号。 */
  version?: string;
  /** 创建时间。 */
  createdAt?: string;
  /** 更新时间。 */
  updatedAt?: string;
  /** 可选区域。 */
  region?: string;
  /** 来源：1手工创建、2大模型蒸馏。 */
  source?: number;
  /** 蒸馏任务编号。 */
  distillationTaskId?: string;
};

/** 配额数据。 */
export type UserV1Quota = {
  /** 指标。 */
  metric?: string;
  /** 上限值。 */
  limitValue?: string;
  /** 已使用值。 */
  usedValue?: string;
  /** 预留值。 */
  reservedValue?: string;
  /** 周期。 */
  period?: string;
  /** 重置时间。 */
  resetAt?: string;
};

/** 实名认证数据。 */
export type UserV1RealnameAuthentication = {
  /** 唯一编号。 */
  id?: string;
  /** 企业编号。 */
  enterpriseId?: string;
  /** 认证类型。 */
  type?: string;
  /** 状态。 */
  status?: string;
  /** 真实姓名。 */
  realName?: string;
  /** 身份证号。 */
  idCardNumber?: string;
  /** 手机号。 */
  mobile?: string;
  /** 企业名称。 */
  companyName?: string;
  /** 营业执照注册号。 */
  registrationNo?: string;
  /** 营业执照图片URL。 */
  licenseImageUrl?: string;
  /** 身份证图片URL。 */
  idCardImageUrl?: string;
  /** 驳回原因。 */
  rejectReason?: string;
  /** 审核人编号。 */
  reviewedBy?: string;
  /** 审核时间。 */
  reviewedAt?: string;
  /** 提交时间。 */
  submittedAt?: string;
};

export type UserV1RechargeCreditsRequest = {
  creditsAmount?: string;
  amountMinorUnits?: string;
  remark?: string;
};

/** 刷新请求参数。 */
export type UserV1RefreshRequest = {
  /** 刷新令牌。 */
  refreshToken?: string;
};

/** 上报授权心跳请求参数。 */
export type UserV1ReportAuthorizationHeartbeatRequest = {
  /** 授权会话令牌。 */
  sessionToken?: string;
  /** 状态。 */
  status?: string;
  /** 客户端版本。 */
  clientVersion?: string;
};

/** 重试文章生成请求参数。 */
export type UserV1RetryArticleGenerationRequest = {
  /** 唯一编号。 */
  id?: string;
};

export type UserV1RetryKeywordDistillationRequest = { id?: string };

/** 重试知识文档解析请求参数。 */
export type UserV1RetryKnowledgeDocumentParseRequest = {
  /** 唯一编号。 */
  id?: string;
  /** 文档版本。 */
  documentVersion?: number;
};

/** 重试发布任务请求参数。 */
export type UserV1RetryPublishTaskRequest = {
  /** 任务编号。 */
  taskId?: string;
  /** 数据版本号。 */
  version?: string;
};

/** 审核问题请求参数。 */
export type UserV1ReviewQuestionRequest = {
  /** 唯一编号。 */
  id?: string;
  /** 数据版本号。 */
  version?: string;
  /** 操作类型。 */
  action?: string;
  /** 操作原因。 */
  reason?: string;
};

/** 登录会话数据。 */
export type UserV1Session = {
  /** 唯一编号。 */
  id?: string;
  /** 客户端设备编号。 */
  deviceId?: string;
  /** IP 地址。 */
  ipAddress?: string;
  /** 用户代理商。 */
  userAgent?: string;
  /** 最近在线时间。 */
  lastSeenAt?: string;
  /** 过期时间。 */
  expiresAt?: string;
  /** 当前。 */
  current?: boolean;
};

/** Top10 文章引用统计。 */
export type UserV1SourceArticleStat = {
  /** 排名（1-based）。 */
  rank?: number;
  /** 文章标题。 */
  title?: string;
  /** 引用次数。 */
  citationCount?: string;
  /** 文章 ID。 */
  articleId?: string;
  /** 文章发布后的外部 URL（跳转链接）。 */
  url?: string;
};

/** Top10 信源平台分布。 */
export type UserV1SourcePlatformStat = {
  /** 排名（1-based）。 */
  rank?: number;
  /** 信源域名。 */
  domain?: string;
  /** 引用次数。 */
  citationCount?: string;
  /** 信源页面标题（用于前端显示中文名称）。 */
  title?: string;
};

/** 提交授权请求参数。 */
export type UserV1SubmitAuthorizationRequest = {
  /** 授权会话令牌。 */
  sessionToken?: string;
  /** 授权账号名称。 */
  accountName?: string;
  /** 外部平台账号编号。 */
  externalId?: string;
  /** 脱敏身份标识。 */
  maskedIdentity?: string;
  /** 授权凭据密文文本载荷（当前为 aes:v2: 前缀的共享 AES-GCM 封装）。 */
  credentialPayload?: string;
  /** 过期时间。 */
  expiresAt?: string;
  /** 扩展元数据 JSON。 */
  metadataJson?: string;
  /** 客户端版本。 */
  clientVersion?: string;
};

/** 提交实名认证请求参数。 */
export type UserV1SubmitRealnameAuthenticationRequest = {
  /** 认证类型。 */
  type?: string;
  /** 真实姓名。 */
  realName?: string;
  /** 身份证号。 */
  idCardNumber?: string;
  /** 手机号。 */
  mobile?: string;
  /** 企业名称（企业认证必填）。 */
  companyName?: string;
  /** 营业执照注册号（企业认证必填）。 */
  registrationNo?: string;
  /** 营业执照图片URL（企业认证必填）。 */
  licenseImageUrl?: string;
  /** 身份证图片URL。 */
  idCardImageUrl?: string;
};

/** 未读通知数量响应结果。 */
export type UserV1UnreadNotificationCountReply = {
  /** 未读数量。 */
  unreadCount?: string;
};

/** 更新文章请求参数。 */
export type UserV1UpdateArticleRequest = {
  /** 文章。 */
  article?: UserV1Article;
  /** 变更摘要。 */
  changeSummary?: string;
};

/** 更新品牌请求参数。 */
export type UserV1UpdateBrandRequest = {
  /** 品牌。 */
  brand?: UserV1Brand;
};

/** 更新企业资料请求参数。 */
export type UserV1UpdateEnterpriseProfileRequest = {
  /** 企业。 */
  enterprise?: UserV1EnterpriseProfile;
};

export type UserV1UpdateGalleryAlbumRequest = { album?: UserV1GalleryAlbum };

/** 更新关键词请求参数。 */
export type UserV1UpdateKeywordRequest = {
  /** 搜索关键词。 */
  keyword?: UserV1Keyword;
};

/** 更新知识库请求参数。 */
export type UserV1UpdateKnowledgeBaseRequest = {
  /** 知识库。 */
  knowledgeBase?: UserV1KnowledgeBase;
};

/** 更新知识文档请求参数。 */
export type UserV1UpdateKnowledgeDocumentRequest = {
  /** 文档。 */
  document?: UserV1KnowledgeDocument;
  /** 内容。 */
  content?: string;
};

/** 更新 GEO 监测计划请求参数。 */
export type UserV1UpdateMonitorPlanRequest = {
  /** 唯一编号。 */
  id?: string;
  /** 监测计划名称。 */
  name?: string;
  /** 数据版本号（乐观锁）。 */
  version?: string;
};

/** 更新问题请求参数。 */
export type UserV1UpdateQuestionRequest = {
  /** 问题。 */
  question?: UserV1Question;
};

export type UserV1UploadGalleryImageRequest = {
  albumId?: string;
  originalName?: string;
  mimeType?: string;
  content?: string;
};

/** 上传实名认证图片响应。 */
export type UserV1UploadRealnameImageReply = {
  /** 图片的 OSS URL。 */
  url?: string;
  /** 对象键。 */
  objectKey?: string;
};

/** 上传实名认证图片请求参数。 */
export type UserV1UploadRealnameImageRequest = {
  /** 原始文件名。 */
  originalName?: string;
  /** MIME 类型。 */
  mimeType?: string;
  /** Base64 编码的图片内容。 */
  content?: string;
  /** 用途：license（营业执照）或 id_card（身份证）。 */
  usage?: string;
};

/** 企业端订单数据。 */
export type UserV1UserSubscriptionOrder = {
  id?: string;
  orderNo?: string;
  enterpriseId?: string;
  planId?: string;
  orderType?: string;
  cycle?: string;
  amountMinorUnits?: string;
  currency?: string;
  creditsAmount?: string;
  status?: string;
  source?: string;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
  planName?: string;
};

export type UserApiArticleGenerationListArticleGenerationsQuery = {
  /** 每页记录数。 */
  pageSize?: number;
  /** 分页令牌。 */
  pageToken?: string;
  /** 状态。 */
  status?: string;
  /** 文章编号。 */
  articleId?: string;
};

export type UserApiArticleListArticlesQuery = {
  /** 每页记录数。 */
  pageSize?: number;
  /** 分页令牌。 */
  pageToken?: string;
  /** 品牌编号。 */
  brandId?: string;
  /** 状态。 */
  status?: string;
  /** 搜索关键词。 */
  keyword?: string;
};

export type UserApiArticleDeleteArticleQuery = {
  /** 数据版本号。 */
  version?: string;
};

export type UserApiGeoBrandBoardGetBrandCompanyInfoQuery = {
  enterpriseId?: string;
  range?: string;
  periodType?: string;
  periodDate?: string;
};

export type UserApiGeoBrandBoardListCompetitorBlankKeywordsQuery = {
  enterpriseId?: string;
  pageSize?: number;
  pageToken?: string;
};

export type UserApiGeoBrandBoardGetCompetitorCompareQuery = {
  enterpriseId?: string;
  range?: string;
  periodType?: string;
  periodDate?: string;
};

export type UserApiGeoBrandBoardGetCompetitorRankingQuery = {
  enterpriseId?: string;
  range?: string;
  periodType?: string;
  periodDate?: string;
};

export type UserApiGeoBrandBoardGetBrandDashboardQuery = {
  enterpriseId?: string;
  range?: string;
  periodType?: string;
  periodDate?: string;
};

export type UserApiGeoBrandBoardGetBrandIndexBottomQuery = {
  enterpriseId?: string;
  range?: string;
  periodType?: string;
  periodDate?: string;
};

export type UserApiGeoBrandBoardGetBrandIndexMainQuery = {
  enterpriseId?: string;
  range?: string;
  periodType?: string;
  periodDate?: string;
};

export type UserApiGeoBrandBoardGetBrandIndexTopQuery = {
  enterpriseId?: string;
  range?: string;
  periodType?: string;
  periodDate?: string;
};

export type UserApiGeoBrandBoardGetBrandOptimizeStatsQuery = {
  enterpriseId?: string;
  range?: string;
  periodType?: string;
  periodDate?: string;
};

export type UserApiGeoBrandBoardListBrandRecordsQuery = {
  enterpriseId?: string;
  pageSize?: number;
  pageToken?: string;
  /** 平台筛选（inclusion_site_id），0=全部。 */
  inclusionSiteId?: string;
  /** 关键词筛选，空=全部。 */
  keyword?: string;
  /** 状态筛选：all / included / not_included，空=all。 */
  statusFilter?: string;
  /** 情感筛选：positive / negative / neutral，空=全部。 */
  sentimentFilter?: string;
};

export type UserApiGeoBrandBoardGetBrandSourceAnalysisQuery = {
  enterpriseId?: string;
  range?: string;
};

export type UserApiGeoBrandBoardGetBrandSummaryQuery = {
  enterpriseId?: string;
  periodType?: string;
  periodDate?: string;
};

export type UserApiBrandListBrandsQuery = {
  /** 每页记录数。 */
  pageSize?: number;
  /** 分页令牌。 */
  pageToken?: string;
  /** 状态。 */
  status?: number;
  /** 搜索关键词。 */
  keyword?: string;
};

export type UserApiBrandDeleteBrandQuery = {
  /** 数据版本号。 */
  version?: string;
};

export type UserApiCatalogListPublishTargetCatalogQuery = {
  /** 发布渠道编号。 */
  publishChannelId?: string;
};

export type UserApiClientAuthorizationGetClientConfigQuery = {
  /** 客户端版本。 */
  clientVersion?: string;
  /** 客户端设备编号。 */
  deviceId?: string;
};

export type UserApiExportJobListExportJobsQuery = {
  /** 每页记录数。 */
  pageSize?: number;
  /** 分页令牌。 */
  pageToken?: string;
  /** 资源类型。 */
  resourceType?: string;
  /** 格式。 */
  format?: string;
  /** 状态。 */
  status?: string;
};

export type UserApiGalleryListGalleryAlbumsQuery = {
  pageSize?: number;
  pageToken?: string;
  category?: number;
  keyword?: string;
};

export type UserApiGalleryDeleteGalleryAlbumQuery = {
  version?: string;
};

export type UserApiGalleryListGalleryImagesQuery = {
  pageSize?: number;
  pageToken?: string;
  albumId?: string;
  keyword?: string;
};

export type UserApiGalleryDeleteGalleryImageQuery = {
  version?: string;
};

export type UserApiGeoMonitorGetGeoDashboardQuery = {
  /** 时间范围：7d（近7天）、month（本月）、year（今年）；默认 7d。 */
  range?: string;
  /** 收录明细分页大小。 */
  pageSize?: number;
  /** 收录明细分页令牌。 */
  pageToken?: string;
  /** 收录明细平台筛选（0 表示全部）。 */
  inclusionSiteId?: string;
};

export type UserApiGeoMonitorGetGeoMetricsQuery = {
  /** 品牌编号。 */
  brandId?: string;
  /** 检测模型站点编号。 */
  inclusionSiteId?: string;
  /** 开始日期。 */
  from?: string;
  /** 结束日期。 */
  to?: string;
};

export type UserApiGeoMonitorListMonitorPlansQuery = {
  /** 每页记录数。 */
  pageSize?: number;
  /** 分页令牌。 */
  pageToken?: string;
  /** 品牌编号。 */
  brandId?: string;
  /** 状态。 */
  status?: number;
};

export type UserApiGeoReportListGeoSitePerformanceQuery = {
  /** 品牌编号。 */
  "filter.brandId"?: string;
  /** 检测模型站点编号。 */
  "filter.inclusionSiteId"?: string;
  /** 开始日期。 */
  "filter.from"?: string;
  /** 结束日期，为不包含该日期的上界。 */
  "filter.to"?: string;
};

export type UserApiGeoReportGetGeoReportSummaryQuery = {
  /** 品牌编号。 */
  "filter.brandId"?: string;
  /** 检测模型站点编号。 */
  "filter.inclusionSiteId"?: string;
  /** 开始日期。 */
  "filter.from"?: string;
  /** 结束日期，为不包含该日期的上界。 */
  "filter.to"?: string;
};

export type UserApiGeoReportListGeoReportTrendQuery = {
  /** 品牌编号。 */
  "filter.brandId"?: string;
  /** 检测模型站点编号。 */
  "filter.inclusionSiteId"?: string;
  /** 开始日期。 */
  "filter.from"?: string;
  /** 结束日期，为不包含该日期的上界。 */
  "filter.to"?: string;
};

export type UserApiGeoMonitorListGeoTasksQuery = {
  /** 每页记录数。 */
  pageSize?: number;
  /** 分页令牌。 */
  pageToken?: string;
  /** 监测计划编号。 */
  monitorPlanId?: string;
  /** 检测模型站点编号。 */
  inclusionSiteId?: string;
  /** 状态。 */
  status?: string;
};

export type UserApiKeywordListKeywordDistillationsQuery = {
  pageSize?: number;
  pageToken?: string;
  keywordId?: string;
  status?: number;
};

export type UserApiKeywordListKeywordsQuery = {
  /** 每页记录数。 */
  pageSize?: number;
  /** 分页令牌。 */
  pageToken?: string;
  /** 品牌编号。 */
  brandId?: string;
  /** 状态。 */
  status?: string;
  /** 搜索关键词。 */
  keyword?: string;
};

export type UserApiKeywordDeleteKeywordQuery = {
  /** 数据版本号。 */
  version?: string;
};

export type UserApiKnowledgeListKnowledgeBasesQuery = {
  /** 每页记录数。 */
  pageSize?: number;
  /** 分页令牌。 */
  pageToken?: string;
  /** 状态。 */
  status?: number;
  /** 搜索关键词。 */
  keyword?: string;
};

export type UserApiKnowledgeDeleteKnowledgeBaseQuery = {
  /** 数据版本号。 */
  version?: string;
};

export type UserApiKnowledgeListKnowledgeDocumentsQuery = {
  /** 每页记录数。 */
  pageSize?: number;
  /** 分页令牌。 */
  pageToken?: string;
  /** 知识库编号。 */
  knowledgeBaseId?: string;
  /** 来源类型。 */
  sourceType?: number;
  /** 解析状态。 */
  parseStatus?: number;
  /** 搜索关键词。 */
  keyword?: string;
  /** GEO 内容上下文分类。 */
  category?: number;
};

export type UserApiKnowledgeDeleteKnowledgeDocumentQuery = {
  /** 文档版本。 */
  documentVersion?: number;
};

export type UserApiKnowledgeListKnowledgeChunksQuery = {
  /** 文档版本。 */
  documentVersion?: number;
  /** 每页记录数。 */
  pageSize?: number;
  /** 分页令牌。 */
  pageToken?: string;
};

export type UserApiNotificationListNotificationsQuery = {
  /** 每页记录数。 */
  pageSize?: number;
  /** 分页令牌。 */
  pageToken?: string;
  /** 是否仅查询未读通知，可与投递状态筛选组合使用。 */
  unreadOnly?: boolean;
  /** 渠道。 */
  channel?: string;
};

export type UserApiPlatformAccountListPlatformAccountsQuery = {
  /** 资源类型：1 表示自媒体投放渠道，2 表示模型检测站点；不传则查询全部。 */
  resourceType?: number;
  /** 资源编号。 */
  resourceId?: string;
  /** 状态。 */
  status?: number;
};

export type UserApiPlatformAccountDeletePlatformAccountQuery = {
  /** 数据版本号。 */
  version?: string;
};

export type UserApiPublishTaskListPublishPlansQuery = {
  /** 每页记录数。 */
  pageSize?: number;
  /** 分页令牌。 */
  pageToken?: string;
  /** 状态。 */
  status?: number;
  /** 文章编号。 */
  articleId?: string;
};

export type UserApiPublishTaskListSucceededPublishTasksQuery = {
  /** 每页记录数。 */
  pageSize?: number;
  /** 分页令牌。 */
  pageToken?: string;
};

export type UserApiQuestionListQuestionsQuery = {
  /** 每页记录数。 */
  pageSize?: number;
  /** 分页令牌。 */
  pageToken?: string;
  /** 品牌编号。 */
  brandId?: string;
  /** 关键词编号。 */
  keywordId?: string;
  /** 状态。 */
  status?: number;
  /** 搜索关键词。 */
  keyword?: string;
};

export type UserApiQuestionDeleteQuestionQuery = {
  /** 数据版本号。 */
  version?: string;
};

export type UserApiSubscriptionOrderListMyOrdersQuery = {
  pageSize?: number;
  pageToken?: string;
  orderType?: string;
};

export const userApi = {
  article: {
    /** 变更文章状态 */
    changeArticleStatus(id: string, body: UserV1ChangeArticleStatusRequest) {
      return apiRequest<UserV1Article>(`/articles/${encodePath(id)}:status`, {
        method: "POST",
        body,
      });
    },
    /** 创建文章 */
    createArticle(body: UserV1CreateArticleRequest) {
      return apiRequest<UserV1Article>("/articles", { method: "POST", body });
    },
    /** 创建文章快照 */
    createArticleSnapshot(
      id: string,
      body: UserV1CreateArticleSnapshotRequest,
    ) {
      return apiRequest<UserV1ArticleSnapshot>(
        `/articles/${encodePath(id)}/snapshots`,
        { method: "POST", body },
      );
    },
    /** 删除文章 */
    deleteArticle(id: string, query: UserApiArticleDeleteArticleQuery = {}) {
      return apiRequest<void>(`/articles/${encodePath(id)}`, {
        method: "DELETE",
        query,
      });
    },
    /** 获取文章 */
    getArticle(id: string) {
      return apiRequest<UserV1Article>(`/articles/${encodePath(id)}`);
    },
    /** 查询文章列表 */
    listArticles(query: UserApiArticleListArticlesQuery = {}) {
      return apiRequest<UserV1ListArticlesReply>("/articles", { query });
    },
    /** 更新文章 */
    updateArticle(articleId: string, body: UserV1UpdateArticleRequest) {
      return apiRequest<UserV1Article>(`/articles/${encodePath(articleId)}`, {
        method: "PUT",
        body,
      });
    },
  },
  articleGeneration: {
    /** 创建文章生成 */
    createArticleGeneration(body: UserV1CreateArticleGenerationRequest) {
      return apiRequest<UserV1ArticleGenerationTask>("/article-generations", {
        method: "POST",
        body,
      });
    },
    /** 获取文章生成 */
    getArticleGeneration(id: string) {
      return apiRequest<UserV1ArticleGenerationTask>(
        `/article-generations/${encodePath(id)}`,
      );
    },
    /** 查询文章生成任务列表 */
    listArticleGenerations(
      query: UserApiArticleGenerationListArticleGenerationsQuery = {},
    ) {
      return apiRequest<UserV1ListArticleGenerationsReply>(
        "/article-generations",
        { query },
      );
    },
    /** 重试文章生成 */
    retryArticleGeneration(
      id: string,
      body: UserV1RetryArticleGenerationRequest,
    ) {
      return apiRequest<UserV1ArticleGenerationTask>(
        `/article-generations/${encodePath(id)}:retry`,
        { method: "POST", body },
      );
    },
  },
  auth: {
    /** 变更密码 */
    changePassword(body: UserV1ChangePasswordRequest) {
      return apiRequest<void>("/auth/change-password", {
        method: "POST",
        body,
      });
    },
    /** 获取当前企业 */
    getCurrentEnterprise() {
      return apiRequest<UserV1EnterpriseProfile>("/auth/me");
    },
    /** 查询会话列表 */
    listSessions() {
      return apiRequest<UserV1ListSessionsReply>("/auth/sessions");
    },
    /** 登录 */
    login(body: UserV1LoginRequest) {
      return apiRequest<UserV1LoginReply>("/auth/login", {
        method: "POST",
        body,
      });
    },
    /** 退出登录 */
    logout(body: UserV1LogoutRequest) {
      return apiRequest<void>("/auth/logout", { method: "POST", body });
    },
    /** 刷新登录令牌 */
    refresh(body: UserV1RefreshRequest) {
      return apiRequest<UserV1LoginReply>("/auth/refresh", {
        method: "POST",
        body,
      });
    },
    /** 撤销登录会话 */
    revokeSession(sessionId: string) {
      return apiRequest<void>(`/auth/sessions/${encodePath(sessionId)}`, {
        method: "DELETE",
      });
    },
    /** 更新企业资料 */
    updateEnterpriseProfile(body: UserV1UpdateEnterpriseProfileRequest) {
      return apiRequest<UserV1EnterpriseProfile>("/auth/profile", {
        method: "PUT",
        body,
      });
    },
  },
  brand: {
    /** 创建品牌 */
    createBrand(body: UserV1CreateBrandRequest) {
      return apiRequest<UserV1Brand>("/brands", { method: "POST", body });
    },
    /** 删除品牌 */
    deleteBrand(id: string, query: UserApiBrandDeleteBrandQuery = {}) {
      return apiRequest<void>(`/brands/${encodePath(id)}`, {
        method: "DELETE",
        query,
      });
    },
    /** 获取品牌 */
    getBrand(id: string) {
      return apiRequest<UserV1Brand>(`/brands/${encodePath(id)}`);
    },
    /** 查询品牌列表 */
    listBrands(query: UserApiBrandListBrandsQuery = {}) {
      return apiRequest<UserV1ListBrandsReply>("/brands", { query });
    },
    /** 更新品牌 */
    updateBrand(brandId: string, body: UserV1UpdateBrandRequest) {
      return apiRequest<UserV1Brand>(`/brands/${encodePath(brandId)}`, {
        method: "PUT",
        body,
      });
    },
  },
  catalog: {
    /** 查询文章类型目录 */
    listArticleTypeCatalog() {
      return apiRequest<UserV1ListArticleTypeCatalogReply>(
        "/catalog/article-types",
      );
    },
    /** 查询企业可用模型检测站点 */
    listInclusionSiteCatalog() {
      return apiRequest<UserV1ListInclusionSiteCatalogReply>(
        "/catalog/inclusion-sites",
      );
    },
    /** 查询客户端可用模型检测站点 */
    listInclusionSites() {
      return apiRequest<UserV1ListInclusionSitesReply>("/inclusion-sites");
    },
    /** 查询企业可用投放渠道 */
    listPublishChannelCatalog() {
      return apiRequest<UserV1ListPublishChannelCatalogReply>(
        "/catalog/publish-channels",
      );
    },
    /** 查询客户端可用投放渠道 */
    listPublishChannels() {
      return apiRequest<UserV1ListPublishChannelsReply>("/publish-channels");
    },
    /** 查询发布目标目录 */
    listPublishTargetCatalog(
      query: UserApiCatalogListPublishTargetCatalogQuery = {},
    ) {
      return apiRequest<UserV1ListPublishTargetCatalogReply>(
        "/catalog/publish-targets",
        { query },
      );
    },
    /** 查询写作模型目录 */
    listWritingModelCatalog() {
      return apiRequest<UserV1ListWritingModelCatalogReply>(
        "/catalog/writing-models",
      );
    },
  },
  clientAuthorization: {
    /** 获取客户端配置 */
    getClientConfig(
      query: UserApiClientAuthorizationGetClientConfigQuery = {},
    ) {
      return apiRequest<UserV1ClientConfig>("/client/config", { query });
    },
    /** 上报授权心跳 */
    reportAuthorizationHeartbeat(
      sessionToken: string,
      body: UserV1ReportAuthorizationHeartbeatRequest,
    ) {
      return apiRequest<UserV1AuthorizationSession>(
        `/client/authorization-sessions/${encodePath(sessionToken)}:heartbeat`,
        { method: "POST", body },
      );
    },
    /** 提交授权 */
    submitAuthorization(
      sessionToken: string,
      body: UserV1SubmitAuthorizationRequest,
    ) {
      return apiRequest<UserV1PlatformAccount>(
        `/client/authorization-sessions/${encodePath(sessionToken)}:submit`,
        { method: "POST", body },
      );
    },
  },
  exportJob: {
    /** 取消数据导出任务 */
    cancelExportJob(id: string, body: UserV1CancelExportJobRequest) {
      return apiRequest<UserV1ExportJob>(
        `/export-jobs/${encodePath(id)}:cancel`,
        { method: "POST", body },
      );
    },
    /** 创建数据导出任务 */
    createExportJob(body: UserV1CreateExportJobRequest) {
      return apiRequest<UserV1ExportJob>("/export-jobs", {
        method: "POST",
        body,
      });
    },
    /** 获取数据导出任务 */
    getExportJob(id: string) {
      return apiRequest<UserV1ExportJob>(`/export-jobs/${encodePath(id)}`);
    },
    /** 查询导出任务列表 */
    listExportJobs(query: UserApiExportJobListExportJobsQuery = {}) {
      return apiRequest<UserV1ListExportJobsReply>("/export-jobs", { query });
    },
  },
  gallery: {
    /** 创建企业相册 */
    createGalleryAlbum(body: UserV1CreateGalleryAlbumRequest) {
      return apiRequest<UserV1GalleryAlbum>("/gallery-albums", {
        method: "POST",
        body,
      });
    },
    /** 删除企业相册 */
    deleteGalleryAlbum(
      id: string,
      query: UserApiGalleryDeleteGalleryAlbumQuery = {},
    ) {
      return apiRequest<void>(`/gallery-albums/${encodePath(id)}`, {
        method: "DELETE",
        query,
      });
    },
    /** 删除企业图库图片 */
    deleteGalleryImage(
      id: string,
      query: UserApiGalleryDeleteGalleryImageQuery = {},
    ) {
      return apiRequest<void>(`/gallery-images/${encodePath(id)}`, {
        method: "DELETE",
        query,
      });
    },
    /** 获取企业相册 */
    getGalleryAlbum(id: string) {
      return apiRequest<UserV1GalleryAlbum>(
        `/gallery-albums/${encodePath(id)}`,
      );
    },
    /** 查询企业相册 */
    listGalleryAlbums(query: UserApiGalleryListGalleryAlbumsQuery = {}) {
      return apiRequest<UserV1ListGalleryAlbumsReply>("/gallery-albums", {
        query,
      });
    },
    /** 查询企业图库图片 */
    listGalleryImages(query: UserApiGalleryListGalleryImagesQuery = {}) {
      return apiRequest<UserV1ListGalleryImagesReply>("/gallery-images", {
        query,
      });
    },
    /** 更新企业相册 */
    updateGalleryAlbum(albumId: string, body: UserV1UpdateGalleryAlbumRequest) {
      return apiRequest<UserV1GalleryAlbum>(
        `/gallery-albums/${encodePath(albumId)}`,
        { method: "PUT", body },
      );
    },
    /** 上传企业图库图片 */
    uploadGalleryImage(body: UserV1UploadGalleryImageRequest) {
      return apiRequest<UserV1GalleryImage>("/gallery-images", {
        method: "POST",
        body,
      });
    },
  },
  geoBrandBoard: {
    /** 获取品牌看板企业信息 */
    getBrandCompanyInfo(
      query: UserApiGeoBrandBoardGetBrandCompanyInfoQuery = {},
    ) {
      return apiRequest<UserV1BrandCompanyInfo>("/brand-board/company-info", {
        query,
      });
    },
    /** 获取数据大盘 */
    getBrandDashboard(query: UserApiGeoBrandBoardGetBrandDashboardQuery = {}) {
      return apiRequest<UserV1BrandDashboard>("/brand-board/dashboard", {
        query,
      });
    },
    /** 获取舆情分析 */
    getBrandIndexBottom(
      query: UserApiGeoBrandBoardGetBrandIndexBottomQuery = {},
    ) {
      return apiRequest<UserV1BrandIndexBottom>("/brand-board/index-bottom", {
        query,
      });
    },
    /** 获取主区趋势与情感 */
    getBrandIndexMain(query: UserApiGeoBrandBoardGetBrandIndexMainQuery = {}) {
      return apiRequest<UserV1BrandIndexMain>("/brand-board/index-main", {
        query,
      });
    },
    /** 获取品牌推荐度 */
    getBrandIndexTop(query: UserApiGeoBrandBoardGetBrandIndexTopQuery = {}) {
      return apiRequest<UserV1BrandIndexTop>("/brand-board/index-top", {
        query,
      });
    },
    /** 获取优化统计卡 */
    getBrandOptimizeStats(
      query: UserApiGeoBrandBoardGetBrandOptimizeStatsQuery = {},
    ) {
      return apiRequest<UserV1BrandOptimizeStats>(
        "/brand-board/optimize-stats",
        { query },
      );
    },
    /** 获取信源分析 */
    getBrandSourceAnalysis(
      query: UserApiGeoBrandBoardGetBrandSourceAnalysisQuery = {},
    ) {
      return apiRequest<UserV1BrandSourceAnalysis>(
        "/brand-board/source-analysis",
        { query },
      );
    },
    /** 获取周月报摘要 */
    getBrandSummary(query: UserApiGeoBrandBoardGetBrandSummaryQuery = {}) {
      return apiRequest<UserV1BrandSummary>("/brand-board/summary", { query });
    },
    /** 获取竞品对比指标 */
    getCompetitorCompare(
      query: UserApiGeoBrandBoardGetCompetitorCompareQuery = {},
    ) {
      return apiRequest<UserV1CompetitorComparePage>(
        "/brand-board/competitor-compare",
        { query },
      );
    },
    /** 获取竞品品牌排序 */
    getCompetitorRanking(
      query: UserApiGeoBrandBoardGetCompetitorRankingQuery = {},
    ) {
      return apiRequest<UserV1CompetitorRankingPage>(
        "/brand-board/competitor-ranking",
        { query },
      );
    },
    /** 获取优化记录明细 */
    listBrandRecords(query: UserApiGeoBrandBoardListBrandRecordsQuery = {}) {
      return apiRequest<UserV1BrandRecordsPage>("/brand-board/records", {
        query,
      });
    },
    /** 获取空白词条列表 */
    listCompetitorBlankKeywords(
      query: UserApiGeoBrandBoardListCompetitorBlankKeywordsQuery = {},
    ) {
      return apiRequest<UserV1CompetitorBlankKeywordsPage>(
        "/brand-board/competitor-blank-keywords",
        { query },
      );
    },
  },
  geoMonitor: {
    /** 变更监测计划状态 */
    changeMonitorPlanStatus(
      id: string,
      body: UserV1ChangeMonitorPlanStatusRequest,
    ) {
      return apiRequest<UserV1MonitorPlan>(
        `/geo-monitor-plans/${encodePath(id)}:status`,
        { method: "POST", body },
      );
    },
    /** 创建 GEO 监测计划 */
    createMonitorPlan(body: UserV1CreateMonitorPlanRequest) {
      return apiRequest<UserV1MonitorPlan>("/geo-monitor-plans", {
        method: "POST",
        body,
      });
    },
    /** 删除 GEO 监测计划 */
    deleteMonitorPlan(id: string) {
      return apiRequest<void>(`/geo-monitor-plans/${encodePath(id)}`, {
        method: "DELETE",
      });
    },
    /** 获取 GEO 回答 */
    getGeoAnswer(taskId: string) {
      return apiRequest<UserV1GeoAnswer>(
        `/geo-tasks/${encodePath(taskId)}/answer`,
      );
    },
    /** 获取 GEO 数据看板 */
    getGeoDashboard(query: UserApiGeoMonitorGetGeoDashboardQuery = {}) {
      return apiRequest<UserV1GeoDashboard>("/geo-dashboard", { query });
    },
    /** 获取 GEO 指标 */
    getGeoMetrics(query: UserApiGeoMonitorGetGeoMetricsQuery = {}) {
      return apiRequest<UserV1GeoMetrics>("/geo-metrics", { query });
    },
    /** 获取 GEO 监测计划 */
    getMonitorPlan(id: string) {
      return apiRequest<UserV1MonitorPlan>(
        `/geo-monitor-plans/${encodePath(id)}`,
      );
    },
    /** 查询 GEO 检测任务列表 */
    listGeoTasks(query: UserApiGeoMonitorListGeoTasksQuery = {}) {
      return apiRequest<UserV1ListGeoTasksReply>("/geo-tasks", { query });
    },
    /** 查询监测计划列表 */
    listMonitorPlans(query: UserApiGeoMonitorListMonitorPlansQuery = {}) {
      return apiRequest<UserV1ListMonitorPlansReply>("/geo-monitor-plans", {
        query,
      });
    },
    /** 更新 GEO 监测计划 */
    updateMonitorPlan(id: string, body: UserV1UpdateMonitorPlanRequest) {
      return apiRequest<UserV1MonitorPlan>(
        `/geo-monitor-plans/${encodePath(id)}`,
        { method: "PATCH", body },
      );
    },
  },
  geoReport: {
    /** 获取 GEO 报告汇总 */
    getGeoReportSummary(query: UserApiGeoReportGetGeoReportSummaryQuery = {}) {
      return apiRequest<UserV1GeoReportSummary>("/geo-reports/summary", {
        query,
      });
    },
    /** 查询 GEO 报告趋势 */
    listGeoReportTrend(query: UserApiGeoReportListGeoReportTrendQuery = {}) {
      return apiRequest<UserV1ListGeoReportTrendReply>("/geo-reports/trend", {
        query,
      });
    },
    /** 查询 GEO 站点表现 */
    listGeoSitePerformance(
      query: UserApiGeoReportListGeoSitePerformanceQuery = {},
    ) {
      return apiRequest<UserV1ListGeoSitePerformanceReply>(
        "/geo-reports/sites",
        { query },
      );
    },
  },
  keyword: {
    /** 创建关键词 */
    createKeyword(body: UserV1CreateKeywordRequest) {
      return apiRequest<UserV1Keyword>("/keywords", { method: "POST", body });
    },
    /** 删除关键词 */
    deleteKeyword(id: string, query: UserApiKeywordDeleteKeywordQuery = {}) {
      return apiRequest<void>(`/keywords/${encodePath(id)}`, {
        method: "DELETE",
        query,
      });
    },
    /** 蒸馏关键词问题 */
    distillKeywordQuestions(
      keywordId: string,
      body: UserV1DistillKeywordQuestionsRequest,
    ) {
      return apiRequest<UserV1KeywordDistillationTask>(
        `/keywords/${encodePath(keywordId)}:distill`,
        { method: "POST", body },
      );
    },
    /** 获取关键词 */
    getKeyword(id: string) {
      return apiRequest<UserV1Keyword>(`/keywords/${encodePath(id)}`);
    },
    /** 查询关键词蒸馏任务 */
    listKeywordDistillations(
      query: UserApiKeywordListKeywordDistillationsQuery = {},
    ) {
      return apiRequest<UserV1ListKeywordDistillationsReply>(
        "/keyword-distillations",
        { query },
      );
    },
    /** 查询关键词列表 */
    listKeywords(query: UserApiKeywordListKeywordsQuery = {}) {
      return apiRequest<UserV1ListKeywordsReply>("/keywords", { query });
    },
    /** 重试关键词蒸馏任务 */
    retryKeywordDistillation(
      id: string,
      body: UserV1RetryKeywordDistillationRequest,
    ) {
      return apiRequest<UserV1KeywordDistillationTask>(
        `/keyword-distillations/${encodePath(id)}:retry`,
        { method: "POST", body },
      );
    },
    /** 更新关键词 */
    updateKeyword(keywordId: string, body: UserV1UpdateKeywordRequest) {
      return apiRequest<UserV1Keyword>(`/keywords/${encodePath(keywordId)}`, {
        method: "PUT",
        body,
      });
    },
  },
  knowledge: {
    /** 创建知识库 */
    createKnowledgeBase(body: UserV1CreateKnowledgeBaseRequest) {
      return apiRequest<UserV1KnowledgeBase>("/knowledge-bases", {
        method: "POST",
        body,
      });
    },
    /** 创建知识文档 */
    createKnowledgeDocument(body: UserV1CreateKnowledgeDocumentRequest) {
      return apiRequest<UserV1KnowledgeDocument>("/knowledge-documents", {
        method: "POST",
        body,
      });
    },
    /** 删除知识库 */
    deleteKnowledgeBase(
      id: string,
      query: UserApiKnowledgeDeleteKnowledgeBaseQuery = {},
    ) {
      return apiRequest<void>(`/knowledge-bases/${encodePath(id)}`, {
        method: "DELETE",
        query,
      });
    },
    /** 删除知识文档 */
    deleteKnowledgeDocument(
      id: string,
      query: UserApiKnowledgeDeleteKnowledgeDocumentQuery = {},
    ) {
      return apiRequest<void>(`/knowledge-documents/${encodePath(id)}`, {
        method: "DELETE",
        query,
      });
    },
    /** 获取知识库 */
    getKnowledgeBase(id: string) {
      return apiRequest<UserV1KnowledgeBase>(
        `/knowledge-bases/${encodePath(id)}`,
      );
    },
    /** 获取知识文档 */
    getKnowledgeDocument(id: string) {
      return apiRequest<UserV1KnowledgeDocument>(
        `/knowledge-documents/${encodePath(id)}`,
      );
    },
    /** 查询知识库列表 */
    listKnowledgeBases(query: UserApiKnowledgeListKnowledgeBasesQuery = {}) {
      return apiRequest<UserV1ListKnowledgeBasesReply>("/knowledge-bases", {
        query,
      });
    },
    /** 查询知识分块列表 */
    listKnowledgeChunks(
      knowledgeDocumentId: string,
      query: UserApiKnowledgeListKnowledgeChunksQuery = {},
    ) {
      return apiRequest<UserV1ListKnowledgeChunksReply>(
        `/knowledge-documents/${encodePath(knowledgeDocumentId)}/chunks`,
        { query },
      );
    },
    /** 查询知识文档列表 */
    listKnowledgeDocuments(
      query: UserApiKnowledgeListKnowledgeDocumentsQuery = {},
    ) {
      return apiRequest<UserV1ListKnowledgeDocumentsReply>(
        "/knowledge-documents",
        { query },
      );
    },
    /** 重试知识文档解析 */
    retryKnowledgeDocumentParse(
      id: string,
      body: UserV1RetryKnowledgeDocumentParseRequest,
    ) {
      return apiRequest<UserV1KnowledgeDocument>(
        `/knowledge-documents/${encodePath(id)}:retry-parse`,
        { method: "POST", body },
      );
    },
    /** 更新知识库 */
    updateKnowledgeBase(
      knowledgeBaseId: string,
      body: UserV1UpdateKnowledgeBaseRequest,
    ) {
      return apiRequest<UserV1KnowledgeBase>(
        `/knowledge-bases/${encodePath(knowledgeBaseId)}`,
        { method: "PUT", body },
      );
    },
    /** 更新知识文档 */
    updateKnowledgeDocument(
      documentId: string,
      body: UserV1UpdateKnowledgeDocumentRequest,
    ) {
      return apiRequest<UserV1KnowledgeDocument>(
        `/knowledge-documents/${encodePath(documentId)}`,
        { method: "PUT", body },
      );
    },
  },
  notification: {
    /** 获取通知 */
    getNotification(id: string) {
      return apiRequest<UserV1Notification>(`/notifications/${encodePath(id)}`);
    },
    /** 获取未读通知数量 */
    getUnreadNotificationCount() {
      return apiRequest<UserV1UnreadNotificationCountReply>(
        "/notifications:unread-count",
      );
    },
    /** 查询通知列表 */
    listNotifications(query: UserApiNotificationListNotificationsQuery = {}) {
      return apiRequest<UserV1ListNotificationsReply>("/notifications", {
        query,
      });
    },
    /** 标记全部通知已读 */
    markAllNotificationsRead() {
      return apiRequest<UserV1MarkAllNotificationsReadReply>(
        "/notifications:mark-all-read",
        { method: "POST" },
      );
    },
    /** 标记通知已读 */
    markNotificationRead(id: string, body: UserV1MarkNotificationReadRequest) {
      return apiRequest<UserV1Notification>(
        `/notifications/${encodePath(id)}:mark-read`,
        { method: "POST", body },
      );
    },
  },
  platformAccount: {
    /** 变更平台账号状态 */
    changePlatformAccountStatus(
      accountId: string,
      body: UserV1ChangePlatformAccountStatusRequest,
    ) {
      return apiRequest<UserV1PlatformAccount>(
        `/platform-accounts/${encodePath(accountId)}:status`,
        { method: "POST", body },
      );
    },
    /** 创建授权会话 */
    createAuthorizationSession(body: UserV1CreateAuthorizationSessionRequest) {
      return apiRequest<UserV1AuthorizationSession>(
        "/platform-accounts/authorization-sessions",
        { method: "POST", body },
      );
    },
    /** 删除平台授权账号 */
    deletePlatformAccount(
      accountId: string,
      query: UserApiPlatformAccountDeletePlatformAccountQuery = {},
    ) {
      return apiRequest<void>(`/platform-accounts/${encodePath(accountId)}`, {
        method: "DELETE",
        query,
      });
    },
    /** 获取授权会话 */
    getAuthorizationSession(sessionId: string) {
      return apiRequest<UserV1AuthorizationSession>(
        `/platform-accounts/authorization-sessions/${encodePath(sessionId)}`,
      );
    },
    /** 获取平台账号授权凭据 */
    getPlatformAccountCredential(accountId: string) {
      return apiRequest<UserV1PlatformAccountCredential>(
        `/platform-accounts/${encodePath(accountId)}/credential`,
      );
    },
    /** 查询平台账号列表 */
    listPlatformAccounts(
      query: UserApiPlatformAccountListPlatformAccountsQuery = {},
    ) {
      return apiRequest<UserV1ListPlatformAccountsReply>("/platform-accounts", {
        query,
      });
    },
  },
  publishTask: {
    /** 变更发布计划状态 */
    changePublishPlanStatus(
      id: string,
      body: UserV1ChangePublishPlanStatusRequest,
    ) {
      return apiRequest<UserV1PublishPlan>(
        `/publish-plans/${encodePath(id)}:status`,
        { method: "POST", body },
      );
    },
    /** 创建发布计划 */
    createPublishPlan(body: UserV1CreatePublishPlanRequest) {
      return apiRequest<UserV1PublishPlan>("/publish-plans", {
        method: "POST",
        body,
      });
    },
    /** 获取发布计划 */
    getPublishPlan(id: string) {
      return apiRequest<UserV1PublishPlanDetail>(
        `/publish-plans/${encodePath(id)}`,
      );
    },
    /** 查询发布计划列表 */
    listPublishPlans(query: UserApiPublishTaskListPublishPlansQuery = {}) {
      return apiRequest<UserV1ListPublishPlansReply>("/publish-plans", {
        query,
      });
    },
    /** 查询成功发布任务列表 */
    listSucceededPublishTasks(
      query: UserApiPublishTaskListSucceededPublishTasksQuery = {},
    ) {
      return apiRequest<UserV1ListSucceededPublishTasksReply>(
        "/publish-tasks/succeeded",
        { query },
      );
    },
    /** 重试发布任务 */
    retryPublishTask(taskId: string, body: UserV1RetryPublishTaskRequest) {
      return apiRequest<UserV1PublishTask>(
        `/publish-tasks/${encodePath(taskId)}:retry`,
        { method: "POST", body },
      );
    },
  },
  question: {
    /** 创建问题 */
    createQuestion(body: UserV1CreateQuestionRequest) {
      return apiRequest<UserV1Question>("/questions", { method: "POST", body });
    },
    /** 删除问题 */
    deleteQuestion(id: string, query: UserApiQuestionDeleteQuestionQuery = {}) {
      return apiRequest<void>(`/questions/${encodePath(id)}`, {
        method: "DELETE",
        query,
      });
    },
    /** 获取问题 */
    getQuestion(id: string) {
      return apiRequest<UserV1Question>(`/questions/${encodePath(id)}`);
    },
    /** 查询问题列表 */
    listQuestions(query: UserApiQuestionListQuestionsQuery = {}) {
      return apiRequest<UserV1ListQuestionsReply>("/questions", { query });
    },
    /** 审核问题 */
    reviewQuestion(id: string, body: UserV1ReviewQuestionRequest) {
      return apiRequest<UserV1Question>(`/questions/${encodePath(id)}:review`, {
        method: "POST",
        body,
      });
    },
    /** 更新问题 */
    updateQuestion(questionId: string, body: UserV1UpdateQuestionRequest) {
      return apiRequest<UserV1Question>(
        `/questions/${encodePath(questionId)}`,
        { method: "PUT", body },
      );
    },
  },
  realname: {
    /** 获取当前企业实名认证状态 */
    getMyRealnameAuthentication() {
      return apiRequest<UserV1RealnameAuthentication>(
        "/realname-authentications/mine",
      );
    },
    /** 提交实名认证 */
    submitRealnameAuthentication(
      body: UserV1SubmitRealnameAuthenticationRequest,
    ) {
      return apiRequest<UserV1RealnameAuthentication>(
        "/realname-authentications",
        { method: "POST", body },
      );
    },
    /** 上传实名认证图片 */
    uploadRealnameImage(body: UserV1UploadRealnameImageRequest) {
      return apiRequest<UserV1UploadRealnameImageReply>(
        "/realname-authentications/upload",
        { method: "POST", body },
      );
    },
  },
  subscriptionOrder: {
    /** 企业自购下单 */
    createSubscriptionOrder(body: UserV1CreateSubscriptionOrderRequest) {
      return apiRequest<UserV1UserSubscriptionOrder>("/subscription-orders", {
        method: "POST",
        body,
      });
    },
    /** 获取我的订单详情 */
    getMyOrder(id: string) {
      return apiRequest<UserV1UserSubscriptionOrder>(
        `/subscription-orders/${encodePath(id)}`,
      );
    },
    /** 查询我的订单列表 */
    listMyOrders(query: UserApiSubscriptionOrderListMyOrdersQuery = {}) {
      return apiRequest<UserV1ListMyOrdersReply>("/subscription-orders", {
        query,
      });
    },
    /** 查询可购套餐列表 */
    listPurchasablePlans() {
      return apiRequest<UserV1ListPurchasablePlansReply>(
        "/subscription-orders/plans",
      );
    },
    /** 企业自助充值点数 */
    rechargeCredits(body: UserV1RechargeCreditsRequest) {
      return apiRequest<UserV1UserSubscriptionOrder>(
        "/subscription-orders:recharge",
        { method: "POST", body },
      );
    },
  },
} as const;

export const USER_API_OPERATION_COUNT = 122 as const;

export const userApiOperationIds = [
  "ArticleGenerationService_CreateArticleGeneration",
  "ArticleGenerationService_GetArticleGeneration",
  "ArticleGenerationService_ListArticleGenerations",
  "ArticleGenerationService_RetryArticleGeneration",
  "ArticleService_ChangeArticleStatus",
  "ArticleService_CreateArticle",
  "ArticleService_CreateArticleSnapshot",
  "ArticleService_DeleteArticle",
  "ArticleService_GetArticle",
  "ArticleService_ListArticles",
  "ArticleService_UpdateArticle",
  "AuthService_ChangePassword",
  "AuthService_GetCurrentEnterprise",
  "AuthService_ListSessions",
  "AuthService_Login",
  "AuthService_Logout",
  "AuthService_Refresh",
  "AuthService_RevokeSession",
  "AuthService_UpdateEnterpriseProfile",
  "BrandService_CreateBrand",
  "BrandService_DeleteBrand",
  "BrandService_GetBrand",
  "BrandService_ListBrands",
  "BrandService_UpdateBrand",
  "CatalogService_ListArticleTypeCatalog",
  "CatalogService_ListInclusionSiteCatalog",
  "CatalogService_ListInclusionSites",
  "CatalogService_ListPublishChannelCatalog",
  "CatalogService_ListPublishChannels",
  "CatalogService_ListPublishTargetCatalog",
  "CatalogService_ListWritingModelCatalog",
  "ClientAuthorizationService_GetClientConfig",
  "ClientAuthorizationService_ReportAuthorizationHeartbeat",
  "ClientAuthorizationService_SubmitAuthorization",
  "ExportJobService_CancelExportJob",
  "ExportJobService_CreateExportJob",
  "ExportJobService_GetExportJob",
  "ExportJobService_ListExportJobs",
  "GalleryService_CreateGalleryAlbum",
  "GalleryService_DeleteGalleryAlbum",
  "GalleryService_DeleteGalleryImage",
  "GalleryService_GetGalleryAlbum",
  "GalleryService_ListGalleryAlbums",
  "GalleryService_ListGalleryImages",
  "GalleryService_UpdateGalleryAlbum",
  "GalleryService_UploadGalleryImage",
  "GeoBrandBoardService_GetBrandCompanyInfo",
  "GeoBrandBoardService_GetBrandDashboard",
  "GeoBrandBoardService_GetBrandIndexBottom",
  "GeoBrandBoardService_GetBrandIndexMain",
  "GeoBrandBoardService_GetBrandIndexTop",
  "GeoBrandBoardService_GetBrandOptimizeStats",
  "GeoBrandBoardService_GetBrandSourceAnalysis",
  "GeoBrandBoardService_GetBrandSummary",
  "GeoBrandBoardService_GetCompetitorCompare",
  "GeoBrandBoardService_GetCompetitorRanking",
  "GeoBrandBoardService_ListBrandRecords",
  "GeoBrandBoardService_ListCompetitorBlankKeywords",
  "GeoMonitorService_ChangeMonitorPlanStatus",
  "GeoMonitorService_CreateMonitorPlan",
  "GeoMonitorService_DeleteMonitorPlan",
  "GeoMonitorService_GetGeoAnswer",
  "GeoMonitorService_GetGeoDashboard",
  "GeoMonitorService_GetGeoMetrics",
  "GeoMonitorService_GetMonitorPlan",
  "GeoMonitorService_ListGeoTasks",
  "GeoMonitorService_ListMonitorPlans",
  "GeoMonitorService_UpdateMonitorPlan",
  "GeoReportService_GetGeoReportSummary",
  "GeoReportService_ListGeoReportTrend",
  "GeoReportService_ListGeoSitePerformance",
  "KeywordService_CreateKeyword",
  "KeywordService_DeleteKeyword",
  "KeywordService_DistillKeywordQuestions",
  "KeywordService_GetKeyword",
  "KeywordService_ListKeywordDistillations",
  "KeywordService_ListKeywords",
  "KeywordService_RetryKeywordDistillation",
  "KeywordService_UpdateKeyword",
  "KnowledgeService_CreateKnowledgeBase",
  "KnowledgeService_CreateKnowledgeDocument",
  "KnowledgeService_DeleteKnowledgeBase",
  "KnowledgeService_DeleteKnowledgeDocument",
  "KnowledgeService_GetKnowledgeBase",
  "KnowledgeService_GetKnowledgeDocument",
  "KnowledgeService_ListKnowledgeBases",
  "KnowledgeService_ListKnowledgeChunks",
  "KnowledgeService_ListKnowledgeDocuments",
  "KnowledgeService_RetryKnowledgeDocumentParse",
  "KnowledgeService_UpdateKnowledgeBase",
  "KnowledgeService_UpdateKnowledgeDocument",
  "NotificationService_GetNotification",
  "NotificationService_GetUnreadNotificationCount",
  "NotificationService_ListNotifications",
  "NotificationService_MarkAllNotificationsRead",
  "NotificationService_MarkNotificationRead",
  "PlatformAccountService_ChangePlatformAccountStatus",
  "PlatformAccountService_CreateAuthorizationSession",
  "PlatformAccountService_DeletePlatformAccount",
  "PlatformAccountService_GetAuthorizationSession",
  "PlatformAccountService_GetPlatformAccountCredential",
  "PlatformAccountService_ListPlatformAccounts",
  "PublishTaskService_ChangePublishPlanStatus",
  "PublishTaskService_CreatePublishPlan",
  "PublishTaskService_GetPublishPlan",
  "PublishTaskService_ListPublishPlans",
  "PublishTaskService_ListSucceededPublishTasks",
  "PublishTaskService_RetryPublishTask",
  "QuestionService_CreateQuestion",
  "QuestionService_DeleteQuestion",
  "QuestionService_GetQuestion",
  "QuestionService_ListQuestions",
  "QuestionService_ReviewQuestion",
  "QuestionService_UpdateQuestion",
  "RealnameService_GetMyRealnameAuthentication",
  "RealnameService_SubmitRealnameAuthentication",
  "RealnameService_UploadRealnameImage",
  "SubscriptionOrderService_CreateSubscriptionOrder",
  "SubscriptionOrderService_GetMyOrder",
  "SubscriptionOrderService_ListMyOrders",
  "SubscriptionOrderService_ListPurchasablePlans",
  "SubscriptionOrderService_RechargeCredits",
] as const;

function encodePath(value: PathValue) {
  return encodeURIComponent(String(value));
}
