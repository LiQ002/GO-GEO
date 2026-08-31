declare namespace API {
  type ActionRegistryEntry = {
    action?: string;
    implemented?: boolean;
    bizEntry?: string;
    status?: string;
  };

  type ActionRegistryReply = {
    items?: ActionRegistryEntry[];
  };

  type AddonQuotaRequest = {
    enterpriseId?: string;
    addonQuotaMetric?: string;
    addonQuotaAmount?: string;
    amountMinorUnits?: string;
    operatorId?: string;
    remark?: string;
  };

  type AdminChangePasswordRequest = {
    /** 当前密码。 */
    currentPassword?: string;
    /** 新密码。 */
    newPassword?: string;
  };

  type AdminLoginReply = {
    /** 访问令牌。 */
    accessToken?: string;
    /** 刷新令牌。 */
    refreshToken?: string;
    /** 访问令牌过期时间。 */
    accessExpiresAt?: string;
    /** 平台管理员。 */
    admin?: AdminProfile;
  };

  type AdminLoginRequest = {
    /** 登录用户名。 */
    username?: string;
    /** 登录密码。 */
    password?: string;
    /** 客户端设备编号。 */
    deviceId?: string;
  };

  type AdminLogoutRequest = {
    /** 是否作用于全部会话。 */
    allSessions?: boolean;
  };

  type AdminPermission = {
    /** 唯一编号。 */
    id?: string;
    /** 业务编码。 */
    code?: string;
    /** 名称。 */
    name?: string;
    /** 资源。 */
    resource?: string;
    /** 操作类型。 */
    action?: string;
    /** 说明。 */
    description?: string;
  };

  type AdminProfile = {
    /** 唯一编号。 */
    id?: string;
    /** 登录用户名。 */
    username?: string;
    /** 显示名称。 */
    displayName?: string;
    /** 电子邮箱。 */
    email?: string;
    /** 状态。 */
    status?: string;
    /** 角色列表。 */
    roles?: string[];
    /** 权限列表。 */
    permissions?: string[];
    /** 最近登录时间。 */
    lastLoginAt?: string;
  };

  type AdminRefreshRequest = {
    /** 刷新令牌。 */
    refreshToken?: string;
  };

  type AdminRole = {
    /** 唯一编号。 */
    id?: string;
    /** 业务编码。 */
    code?: string;
    /** 名称。 */
    name?: string;
    /** 说明。 */
    description?: string;
    /** 数据范围。 */
    dataScope?: number;
    /** 状态。 */
    status?: number;
    /** 权限列表。 */
    permissions?: AdminPermission[];
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
  };

  type AdminRoleServiceDeleteAdminRoleParams = {
    /** 唯一编号。 */
    id: string;
    /** 操作原因。 */
    reason?: string;
  };

  type AdminRoleServiceGetAdminRoleParams = {
    /** 唯一编号。 */
    id: string;
  };

  type AdminRoleServiceListAdminPermissionsParams = {
    /** 资源。 */
    resource?: string;
    /** 搜索关键词。 */
    keyword?: string;
  };

  type AdminRoleServiceListAdminRolesParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 状态。 */
    status?: number;
    /** 搜索关键词。 */
    keyword?: string;
  };

  type AdminRoleServiceSetAdminRolePermissionsParams = {
    /** 唯一编号。 */
    id: string;
  };

  type AdminRoleServiceUpdateAdminRoleParams = {
    "role.id": string;
  };

  type AdminUser = {
    /** 唯一编号。 */
    id?: string;
    /** 登录用户名。 */
    username?: string;
    /** 显示名称。 */
    displayName?: string;
    /** 电子邮箱。 */
    email?: string;
    /** 状态。 */
    status?: string;
    /** 失败登录数量。 */
    failedLoginCount?: number;
    /** 锁定截止时间。 */
    lockedUntil?: string;
    /** 最近登录时间。 */
    lastLoginAt?: string;
    /** 角色列表。 */
    roles?: AdminRole[];
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
  };

  type AdminUserServiceChangeAdminUserStatusParams = {
    /** 唯一编号。 */
    id: string;
  };

  type AdminUserServiceGetAdminUserParams = {
    /** 唯一编号。 */
    id: string;
  };

  type AdminUserServiceListAdminUsersParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 状态。 */
    status?: string;
    /** 搜索关键词。 */
    keyword?: string;
    /** 角色编号。 */
    roleId?: string;
  };

  type AdminUserServiceResetAdminUserPasswordParams = {
    /** 唯一编号。 */
    id: string;
  };

  type AdminUserServiceSetAdminUserRolesParams = {
    /** 唯一编号。 */
    id: string;
  };

  type AdminUserServiceUpdateAdminUserParams = {
    "user.id": string;
  };

  type Alert = {
    /** 唯一编号。 */
    id?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 企业名称。 */
    enterpriseName?: string;
    /** 告警类型。 */
    alertType?: string;
    /** 严重程度。 */
    severity?: string;
    /** 状态。 */
    status?: string;
    /** 标题。 */
    title?: string;
    /** 说明。 */
    description?: string;
    /** 资源类型。 */
    resourceType?: string;
    /** 资源编号。 */
    resourceId?: string;
    /** 详细信息 JSON。 */
    detailsJson?: string;
    /** 处理完成时间。 */
    resolvedAt?: string;
    /** 已处理处理人。 */
    resolvedBy?: string;
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
  };

  type AlertServiceGetAlertParams = {
    /** 唯一编号。 */
    id: string;
  };

  type AlertServiceListAlertsParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 严重程度。 */
    severity?: string;
    /** 状态。 */
    status?: string;
    /** 告警类型。 */
    alertType?: string;
    /** 搜索关键词。 */
    keyword?: string;
  };

  type AlertServiceResolveAlertParams = {
    /** 唯一编号。 */
    id: string;
  };

  type AnalysisResult = {
    /** 唯一编号。 */
    id?: string;
    /** 分析版本。 */
    analysisVersion?: number;
    /** 规则版本。 */
    ruleVersion?: string;
    /** 状态。 */
    status?: string;
    /** 品牌已提及。 */
    brandMentioned?: boolean;
    /** 企业被引用。 */
    enterpriseCited?: boolean;
    /** 可见性评分。 */
    visibilityScore?: number;
    /** 准确性评分。 */
    accuracyScore?: number;
    /** 置信度。 */
    confidence?: number;
    /** 结果数据 JSON。 */
    resultJson?: string;
  };

  type AnswerSnapshot = {
    /** 唯一编号。 */
    id?: string;
    /** 尝试编号。 */
    attemptId?: string;
    /** 模型入口。 */
    modelEntry?: string;
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
    /** 会话引用。 */
    sessionRef?: string;
    /** 采集时间。 */
    observedAt?: string;
    /** 客户端版本。 */
    clientVersion?: string;
  };

  type ApproveRealnameAuthenticationRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 审核备注。 */
    remark?: string;
  };

  type ArchiveArticleRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type Article = {
    /** 唯一编号。 */
    id?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 企业名称。 */
    enterpriseName?: string;
    /** 品牌编号。 */
    brandId?: string;
    /** 品牌名称。 */
    brandName?: string;
    /** 文章类型编号。 */
    articleTypeId?: string;
    /** 文章类型名称。 */
    articleTypeName?: string;
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
    /** 发布时间。 */
    publishedAt?: string;
    /** 数据版本号。 */
    version?: string;
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
  };

  type Article = {
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
    imageUrls?: string[];
  };

  type ArticleDetail = {
    /** 文章。 */
    article?: Article;
    /** 版本列表。 */
    versions?: ArticleVersion[];
    /** 审核记录。 */
    reviews?: ArticleReview[];
  };

  type ArticleGenerationTask = {
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

  type ArticleReview = {
    /** 唯一编号。 */
    id?: string;
    /** 操作类型。 */
    action?: string;
    /** 起始状态。 */
    fromStatus?: string;
    /** 结束状态。 */
    toStatus?: string;
    /** 审核人类型。 */
    reviewerType?: string;
    /** 审核人编号。 */
    reviewerId?: string;
    /** 操作原因。 */
    reason?: string;
    /** 创建时间。 */
    createdAt?: string;
  };

  type ArticleServiceArchiveArticleParams = {
    /** 唯一编号。 */
    id: string;
  };

  type ArticleServiceGetArticleParams = {
    /** 唯一编号。 */
    id: string;
  };

  type ArticleServiceListArticlesParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 品牌编号。 */
    brandId?: string;
    /** 状态。 */
    status?: string;
    /** 来源。 */
    source?: string;
    /** 搜索关键词。 */
    keyword?: string;
    /** 最小质量评分。 */
    minQualityScore?: number;
  };

  type ArticleServiceReviewArticleParams = {
    /** 唯一编号。 */
    id: string;
  };

  type ArticleSnapshot = {
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

  type ArticleType = {
    /** 唯一编号。 */
    id?: string;
    /** 业务编码。 */
    code?: string;
    /** 名称。 */
    name?: string;
    /** 说明。 */
    description?: string;
    /** 图标地址。 */
    icon?: string;
    /** 来源类型。 */
    sourceType?: number;
    /** 状态。 */
    status?: number;
    /** 是否可见。 */
    visible?: boolean;
    /** 排序值。 */
    sortOrder?: number;
    /** 当前版本编号。 */
    currentVersionId?: string;
    /** 可见范围 JSON。 */
    visibilityJson?: string;
    /** 数据版本号。 */
    version?: string;
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
    /** 当前生效的结构化生成配置；保存文章类型时由后端自动创建配置修订。 */
    config?: ArticleTypeConfig;
    /** 当前配置修订号。 */
    configRevision?: number;
    /** 本次配置变更说明；仅在保存时使用，并记录到自动生成的修订中。 */
    configChangeSummary?: string;
  };

  type ArticleTypeCatalogItem = {
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
    config?: ArticleTypePublicConfig;
  };

  type ArticleTypeConfig = {
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
    sections?: ArticleTypeSection[];
    /** 企业生成时需要填写的输入项。 */
    inputFields?: ArticleTypeInputField[];
    /** GEO 优化规则。 */
    geoRules?: string[];
    /** 质量检查规则。 */
    qualityRules?: string[];
    /** 大模型系统提示词。 */
    systemPrompt?: string;
    /** 用户提示词模板，支持使用 {{.变量名}} 引用输入项和内置品牌变量。 */
    userPromptTemplate?: string;
    /** 输出格式：1 Markdown。 */
    outputFormat?: number;
    /** 可用写作模型编号列表；为空时允许企业使用全部已授权模型。 */
    writingModelIds?: string[];
    /** 默认写作模型编号；为 0 时由企业选择。 */
    defaultWritingModelId?: string;
    /** 适用投放渠道编号列表；为空时表示不限制渠道。 */
    publishChannelIds?: string[];
  };

  type ArticleTypeInputField = {
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
    options?: string[];
    /** 默认值。 */
    defaultValue?: string;
  };

  type ArticleTypePublicConfig = {
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
    sections?: ArticleTypeSection[];
    /** 企业生成时需要填写的输入项。 */
    inputFields?: ArticleTypeInputField[];
    /** 输出格式：1 Markdown。 */
    outputFormat?: number;
    /** 该类型允许的写作模型编号列表；为空时不限制。 */
    writingModelIds?: string[];
    /** 默认写作模型编号。 */
    defaultWritingModelId?: string;
    /** 该类型适用的投放渠道编号列表；为空时不限制。 */
    publishChannelIds?: string[];
  };

  type ArticleTypeSection = {
    /** 章节标题。 */
    title?: string;
    /** 章节写作要求。 */
    guidance?: string;
    /** 是否必须生成该章节。 */
    required?: boolean;
  };

  type ArticleTypeServiceCreateArticleTypeVersionParams = {
    /** 文章类型编号。 */
    articleTypeId: string;
  };

  type ArticleTypeServiceDeleteArticleTypeParams = {
    /** 唯一编号。 */
    id: string;
    /** 数据版本号。 */
    version?: string;
  };

  type ArticleTypeServiceGetArticleTypeParams = {
    /** 唯一编号。 */
    id: string;
  };

  type ArticleTypeServiceListArticleTypesParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 状态。 */
    status?: number;
    /** 来源类型。 */
    sourceType?: number;
    /** 搜索关键词。 */
    keyword?: string;
    /** 是否可见。 */
    visible?: boolean;
  };

  type ArticleTypeServiceListArticleTypeVersionsParams = {
    /** 文章类型编号。 */
    articleTypeId: string;
  };

  type ArticleTypeServicePublishArticleTypeVersionParams = {
    /** 文章类型编号。 */
    articleTypeId: string;
    /** 版本编号。 */
    versionId: string;
  };

  type ArticleTypeServiceRollbackArticleTypeParams = {
    /** 文章类型编号。 */
    articleTypeId: string;
  };

  type ArticleTypeServiceUpdateArticleTypeParams = {
    "article_type.id": string;
  };

  type ArticleTypeVersion = {
    /** 唯一编号。 */
    id?: string;
    /** 文章类型编号。 */
    articleTypeId?: string;
    /** 版本序号。 */
    versionNumber?: number;
    /** 状态。 */
    status?: number;
    /** 内容目标。 */
    contentGoal?: string;
    /** 目标受众。 */
    targetAudience?: string;
    /** 语气。 */
    tone?: string;
    /** 建议最小字数。 */
    recommendedMinWords?: number;
    /** 建议最大字数。 */
    recommendedMaxWords?: number;
    /** 文章结构配置 JSON。 */
    structureJson?: string;
    /** 输入参数结构 JSON。 */
    inputSchemaJson?: string;
    /** GEO 优化规则 JSON。 */
    geoRulesJson?: string;
    /** 质量检查规则 JSON。 */
    qualityRulesJson?: string;
    /** 提示词版本编号。 */
    promptVersionId?: string;
    /** 默认模型编号。 */
    defaultModelId?: string;
    /** 备用模型编号列表 JSON。 */
    fallbackModelIdsJson?: string;
    /** 变更摘要。 */
    changeSummary?: string;
    /** 创建时间。 */
    createdAt?: string;
    /** 该历史修订对应的结构化生成配置。 */
    config?: ArticleTypeConfig;
    /** 发布管理员编号。 */
    publishedBy?: string;
  };

  type ArticleVersion = {
    /** 唯一编号。 */
    id?: string;
    /** 版本序号。 */
    versionNumber?: number;
    /** 标题。 */
    title?: string;
    /** 内容摘要。 */
    summary?: string;
    /** 变更来源。 */
    changeSource?: string;
    /** 变更摘要。 */
    changeSummary?: string;
    /** 操作人类型。 */
    operatorType?: string;
    /** 操作人编号。 */
    operatorId?: string;
    /** 创建时间。 */
    createdAt?: string;
  };

  type AuditLog = {
    /** 唯一编号。 */
    id?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 企业名称。 */
    enterpriseName?: string;
    /** 操作者类型。 */
    actorType?: string;
    /** 操作者编号。 */
    actorId?: string;
    /** 操作者名称。 */
    actorName?: string;
    /** 受众。 */
    audience?: string;
    /** 操作类型。 */
    action?: string;
    /** 资源类型。 */
    resourceType?: string;
    /** 资源编号。 */
    resourceId?: string;
    /** 结果。 */
    result?: string;
    /** 操作原因。 */
    reason?: string;
    /** 变更前数据 JSON。 */
    beforeJson?: string;
    /** 变更后数据 JSON。 */
    afterJson?: string;
    /** IP 地址。 */
    ipAddress?: string;
    /** 用户代理商。 */
    userAgent?: string;
    /** 请求编号。 */
    requestId?: string;
    /** 链路追踪编号。 */
    traceId?: string;
    /** 创建时间。 */
    createdAt?: string;
  };

  type AuditLogServiceGetAuditLogParams = {
    /** 唯一编号。 */
    id: string;
  };

  type AuditLogServiceListAuditLogsParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 操作者类型。 */
    actorType?: string;
    /** 操作者编号。 */
    actorId?: string;
    /** 操作类型。 */
    action?: string;
    /** 资源类型。 */
    resourceType?: string;
    /** 结果。 */
    result?: string;
    /** 请求编号。 */
    requestId?: string;
    /** 开始时间。 */
    startedAt?: string;
    /** 结束时间。 */
    endedAt?: string;
  };

  type AuthorizationSession = {
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

  type BillingConfigServiceUpdateBillingUnitCostParams = {
    action: string;
  };

  type BillingUnitCost = {
    /** 计费项 key。 */
    action?: string;
    /** 标题。 */
    title?: string;
    /** 点数（点，运行时换算为毫点）。 */
    points?: number;
    /** 计价单位。 */
    unit?: string;
    /** 扣费模式：both / quota_only / points_only。 */
    chargeType?: string;
    /** 关联额度指标。 */
    quotaMetric?: string;
  };

  type BillingUnitCostsReply = {
    items?: BillingUnitCost[];
  };

  type Brand = {
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

  type BrandCompanyInfo = {
    enterpriseName?: string;
    brandName?: string;
    website?: string;
    keywordCount?: string;
    termCount?: string;
    totalInclusion?: string;
    articleCount?: string;
    startedAt?: string;
    expiresAt?: string;
    brandKeywords?: string[];
  };

  type BrandDashboard = {
    visibilityRate?: number;
    top3Rate?: number;
    positiveRate?: number;
    mentionCount?: string;
    dialogueRounds?: string;
    platforms?: BrandPlatformStat[];
  };

  type BrandIndexBottom = {
    periodType?: string;
    opinions?: BrandOpinion[];
  };

  type BrandIndexMain = {
    inclusionTrend?: BrandTrendPoint[];
    visibilityTrend?: BrandTrendPoint[];
    mentionTrend?: BrandTrendPoint[];
    sentimentBreakdown?: BrandSentimentStat[];
  };

  type BrandIndexTop = {
    platforms?: BrandRecommendation[];
  };

  type BrandOpinion = {
    title?: string;
    summary?: string;
    sentiment?: string;
    occurredAt?: string;
  };

  type BrandOptimizeStats = {
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

  type BrandPlatformStat = {
    platform?: string;
    visibilityRate?: number;
    mentionCount?: string;
    sentiment?: string;
    inclusionCount?: string;
  };

  type BrandQuestionStat = {
    question?: string;
    totalCount?: string;
    periodCount?: string;
  };

  type BrandRecommendation = {
    platform?: string;
    recommendation?: number;
    inclusionCount?: string;
    visibilityRate?: number;
    mentionCount?: string;
    sentiment?: string;
  };

  type BrandRecord = {
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
  };

  type BrandRecordsPage = {
    records?: BrandRecord[];
    nextPageToken?: string;
    totalSize?: string;
  };

  type BrandSentimentStat = {
    sentiment?: string;
    count?: string;
    rate?: number;
  };

  type BrandSummary = {
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
    questions?: BrandQuestionStat[];
  };

  type BrandTrendPoint = {
    date?: string;
    value?: string;
    rate?: number;
  };

  type CancelExportJobRequest = {
    /** 唯一编号。 */
    id?: string;
  };

  type CancelOrderRequest = {
    id?: string;
    operatorId?: string;
    remark?: string;
  };

  type CancelSalesDiagnosisRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
    /** 取消原因。 */
    reason?: string;
  };

  type CatalogItem = {
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

  type ChangeAdminUserStatusRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 操作类型。 */
    action?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type ChangeArticleStatusRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
    /** 操作类型。 */
    action?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type ChangeCustomerAuthorizationStatusRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
    /** 操作类型。 */
    action?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type ChangeEnterpriseStatusRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
    /** 操作类型。 */
    action?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type ChangeInclusionSiteAuthorizationStatusRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
    /** 操作类型。 */
    action?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type ChangeMonitorPlanStatusRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
    /** 操作类型。 */
    action?: string;
  };

  type ChangePasswordRequest = {
    /** 当前密码。 */
    currentPassword?: string;
    /** 新密码。 */
    newPassword?: string;
  };

  type ChangePlatformAccountStatusRequest = {
    /** 账号编号。 */
    accountId?: string;
    /** 数据版本号。 */
    version?: string;
    /** 操作类型。 */
    action?: string;
  };

  type ChangePublishPlanStatusRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
    /** 操作类型。 */
    action?: string;
  };

  type ChangeSalesOpportunityStatusRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
    /** 目标状态。 */
    status?: number;
    /** 操作原因。 */
    reason?: string;
  };

  type ChangeSelfMediaAuthorizationStatusRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
    /** 操作类型。 */
    action?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type ChangeWorkerStatusRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
    /** 操作类型。 */
    action?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type CheckSalesOpportunityDuplicateReply = {
    /** 是否存在疑似重复客户。 */
    duplicated?: boolean;
    /** 疑似重复的销售机会。 */
    matches?: SalesOpportunity[];
  };

  type Citation = {
    /** 唯一编号。 */
    id?: string;
    /** 地址。 */
    url?: string;
    /** 域名。 */
    domain?: string;
    /** 标题。 */
    title?: string;
    /** 位置。 */
    position?: number;
    /** 是否企业来源。 */
    isEnterpriseSource?: boolean;
    /** 文章编号。 */
    articleId?: string;
    /** 扩展元数据 JSON。 */
    metadataJson?: string;
  };

  type ClaimTaskReply = {
    /** 租约。 */
    lease?: TaskLease;
  };

  type ClaimTaskRequest = {
    /** 工作节点令牌。 */
    workerToken?: string;
    /** 任务类型列表。 */
    taskTypes?: string[];
    /** 发布渠道编号列表。 */
    publishChannelIds?: string[];
    /** 检测模型站点编号列表。 */
    inclusionSiteIds?: string[];
    /** 指定任务编号；为 0 时领取队列中的下一个任务。 */
    taskId?: string;
  };

  type ClientConfig = {
    /** 最低支持版本。 */
    minimumVersion?: string;
    /** 最新客户端版本。 */
    latestVersion?: string;
    /** 是否强制升级。 */
    forceUpgrade?: boolean;
    /** 客户端下载地址。 */
    downloadUrl?: string;
    /** 可授权目标列表。 */
    authorizationTargets?: CatalogItem[];
  };

  type CompareSalesDiagnosesReply = {
    /** 基线诊断。 */
    baseline?: SalesDiagnosis;
    /** 对比诊断。 */
    comparison?: SalesDiagnosis;
    /** 汇总指标变化。 */
    metrics?: SalesDiagnosisMetricComparison[];
  };

  type ConfirmReceiptRequest = {
    id?: string;
    operatorId?: string;
    remark?: string;
  };

  type CreateAdminRoleRequest = {
    /** 角色。 */
    role?: AdminRole;
    /** 权限编号列表。 */
    permissionIds?: string[];
    /** 操作原因。 */
    reason?: string;
  };

  type CreateAdminUserRequest = {
    /** 用户。 */
    user?: AdminUser;
    /** 初始密码。 */
    initialPassword?: string;
    /** 角色编号列表。 */
    roleIds?: string[];
    /** 操作原因。 */
    reason?: string;
  };

  type CreateArticleGenerationRequest = {
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
    knowledgeBaseIds?: string[];
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
    galleryAlbumIds?: string[];
    /** 需要随机插入正文的图库图片数量，0 表示不插图，最大 20。 */
    galleryImageCount?: number;
    /** 企业知识条目编号列表，至少选择一个；仅引用已解析内容。 */
    knowledgeDocumentIds?: string[];
  };

  type CreateArticleRequest = {
    /** 文章。 */
    article?: Article;
  };

  type CreateArticleSnapshotRequest = {
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

  type CreateArticleTypeRequest = {
    /** 文章类型。 */
    articleType?: ArticleType;
  };

  type CreateArticleTypeVersionRequest = {
    /** 文章类型编号。 */
    articleTypeId?: string;
    /** 数据版本号。 */
    version?: ArticleTypeVersion;
  };

  type CreateAuthorizationSessionRequest = {
    /** 客户端设备编号。 */
    deviceId?: string;
    /** 资源类型。 */
    resourceType?: number;
    /** 资源编号。 */
    resourceId?: string;
    /** 平台账号编号。 */
    platformAccountId?: string;
  };

  type CreateBrandRequest = {
    /** 品牌。 */
    brand?: Brand;
  };

  type CreateEnterpriseRequest = {
    /** 企业。 */
    enterprise?: Enterprise;
    /** 登录用户名。 */
    username?: string;
    /** 初始密码。 */
    initialPassword?: string;
    /** 账号邮箱。 */
    accountEmail?: string;
    /** 账号手机号。 */
    accountPhone?: string;
    /** 套餐编号。 */
    planId?: string;
    /** 订阅过期时间。 */
    subscriptionExpiresAt?: string;
    /** 配额列表。 */
    quotas?: QuotaLimit[];
    /** 额外赠送点数（毫点）；套餐自带点数会自动发放，此字段用于额外赠送。 */
    grantedPoints?: string;
  };

  type CreateExportJobRequest = {
    /** 资源类型。 */
    resourceType?: string;
    /** 格式。 */
    format?: string;
    /** 资源专用且创建后不可变的导出筛选条件 JSON。 */
    filterJson?: string;
    /** 客户端请求幂等编号。 */
    clientRequestId?: string;
  };

  type CreateGalleryAlbumRequest = {
    album?: GalleryAlbum;
  };

  type CreateInclusionSiteRequest = {
    /** 检测模型站点。 */
    inclusionSite?: InclusionSite;
  };

  type CreateKeywordRequest = {
    /** 搜索关键词。 */
    keyword?: Keyword;
    /** 创建后立即蒸馏的问题数量，1-20。 */
    distillQuestionCount?: number;
    /** 指定问题蒸馏模型；为 0 时自动选择企业可用模型。 */
    writingModelId?: string;
    /** 客户端幂等编号。 */
    clientRequestId?: string;
  };

  type CreateKnowledgeBaseRequest = {
    /** 知识库。 */
    knowledgeBase?: KnowledgeBase;
  };

  type CreateKnowledgeDocumentRequest = {
    /** 文档。 */
    document?: KnowledgeDocument;
    /** 内容。 */
    content?: string;
  };

  type CreateManualReviewRequest = {
    /** 任务编号。 */
    taskId?: string;
    /** 回答快照编号。 */
    answerSnapshotId?: string;
    /** 分析结果编号。 */
    analysisResultId?: string;
    /** 变更前数据 JSON。 */
    beforeJson?: string;
    /** 变更后数据 JSON。 */
    afterJson?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type CreateMonitorPlanRequest = {
    /** 套餐。 */
    plan?: MonitorPlan;
  };

  type CreatePlanRequest = {
    /** 套餐。 */
    plan?: Plan;
  };

  type CreatePublishChannelRequest = {
    /** 发布渠道。 */
    publishChannel?: PublishChannel;
  };

  type CreatePublishPlanRequest = {
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
    targets?: PublishTargetInput[];
    /** 去重策略：no_dedup（默认，不去重）/ all_unique（全部去重，按轮询分配）/ per_platform（单平台去重）。 */
    dedupStrategy?: string;
    /** 文章编号列表（有序；与 article_snapshot_ids 一一对应）。 */
    articleIds?: string[];
    /** 文章快照编号列表（与 article_ids 一一对应）。 */
    articleSnapshotIds?: string[];
  };

  type CreatePublishTargetRequest = {
    /** 发布渠道编号。 */
    publishChannelId?: string;
    /** 目标。 */
    target?: PublishTarget;
  };

  type CreateQuestionRequest = {
    /** 问题。 */
    question?: Question;
  };

  type CreateSalesDiagnosisRequest = {
    /** 诊断名称。 */
    name?: string;
    /** 诊断对象类型。 */
    subjectType?: number;
    /** 销售机会编号；对象为销售机会时必填。 */
    opportunityId?: string;
    /** 企业编号；对象为企业时必填。 */
    enterpriseId?: string;
    /** 可选诊断问题；留空时后台先调用一个已选模型生成品牌词和相关问题，传入时自动去重后最多 50 条。 */
    questions?: string[];
    /** 可选编写模型配置编号；留空时自动选择全部已启用“售前诊断”用途的模型。 */
    writingModelIds?: string[];
    /** 创建后是否立即执行。 */
    startImmediately?: boolean;
    /** 客户企业名称；快速品牌诊断时必填。 */
    customerName?: string;
    /** 品牌名称；快速品牌诊断时必填。 */
    brandName?: string;
  };

  type CreateSalesOpportunityRequest = {
    /** 销售机会和客户资料。 */
    opportunity?: SalesOpportunity;
  };

  type CreateSubscriptionOrderRequest = {
    planId?: string;
    orderType?: string;
    cycle?: string;
    amountMinorUnits?: string;
    creditsAmount?: string;
    remark?: string;
  };

  type CreateSystemSettingRequest = {
    /** 配置项。 */
    setting?: SystemSetting;
    /** 操作原因。 */
    reason?: string;
  };

  type CreateWritingModelRequest = {
    /** 写作模型。 */
    writingModel?: WritingModel;
    /** API 密钥。 */
    apiKey?: string;
  };

  type CustomerAuthorization = {
    /** 唯一编号。 */
    id?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 企业编码。 */
    enterpriseCode?: string;
    /** 企业名称。 */
    enterpriseName?: string;
    /** 发布渠道编号。 */
    publishChannelId?: string;
    /** 渠道编码。 */
    channelCode?: string;
    /** 渠道名称。 */
    channelName?: string;
    /** 授权账号名称。 */
    accountName?: string;
    /** 外部平台账号编号。 */
    externalId?: string;
    /** 脱敏身份标识。 */
    maskedIdentity?: string;
    /** 授权状态。 */
    authorizationStatus?: string;
    /** 使用状态。 */
    usageStatus?: string;
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
    /** 数据版本号。 */
    version?: string;
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
    /** 资源类型。 */
    resourceType?: string;
    /** 资源编号。 */
    resourceId?: string;
    /** 资源编码。 */
    resourceCode?: string;
    /** 资源名称。 */
    resourceName?: string;
  };

  type CustomerAuthorizationServiceChangeCustomerAuthorizationStatusParams = {
    /** 唯一编号。 */
    id: string;
  };

  type CustomerAuthorizationServiceGetCustomerAuthorizationParams = {
    /** 唯一编号。 */
    id: string;
  };

  type CustomerAuthorizationServiceListCustomerAuthorizationsParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 发布渠道编号。 */
    publishChannelId?: string;
    /** 授权状态。 */
    authorizationStatus?: string;
    /** 使用状态。 */
    usageStatus?: string;
    /** 搜索关键词。 */
    keyword?: string;
    /** 资源类型。 */
    resourceType?: string;
    /** 资源编号。 */
    resourceId?: string;
  };

  type Dashboard = {
    /** 指标集合。 */
    metrics?: DashboardMetric[];
    /** 趋势列表。 */
    trends?: DashboardTrend[];
    /** 告警列表。 */
    alerts?: DashboardAlert[];
    /** 生成时间。 */
    generatedAt?: string;
    /** 平台发布统计。 */
    platformStats?: DashboardPlatformStat[];
    /** 最近活动。 */
    activities?: DashboardActivity[];
  };

  type DashboardActivity = {
    /** 唯一编号。 */
    id?: string;
    /** 活动类型（success/failed/started）。 */
    type?: string;
    /** 活动描述。 */
    message?: string;
    /** 创建时间。 */
    createdAt?: string;
  };

  type DashboardAlert = {
    /** 唯一编号。 */
    id?: string;
    /** 严重程度。 */
    severity?: string;
    /** 标题。 */
    title?: string;
    /** 资源类型。 */
    resourceType?: string;
    /** 资源编号。 */
    resourceId?: string;
    /** 创建时间。 */
    createdAt?: string;
  };

  type DashboardCompanyCard = {
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
    keywords?: string[];
    /** 关键词数量。 */
    keywordCount?: string;
    /** 词条总量（关键词蒸馏的问题数量）。 */
    questionCount?: string;
    /** 品牌名称列表（企业下所有品牌）。 */
    brandNames?: string[];
  };

  type DashboardMetric = {
    /** 键名。 */
    key?: string;
    /** 标签。 */
    label?: string;
    /** 值。 */
    value?: string;
    /** 对比值。 */
    comparisonValue?: string;
  };

  type DashboardOverview = {
    /** 收录总量（企业级，brand_mentioned=true 的快照数）。 */
    totalIncluded?: string;
    /** 近30天收录量。 */
    recentIncluded?: string;
    /** 文章发布量（已发布状态的文章数）。 */
    publishedArticles?: string;
    /** 联系方式曝光量（提及表中与品牌相关的记录数）。 */
    contactExposure?: string;
  };

  type DashboardPlatformStat = {
    /** 平台编码。 */
    platform?: string;
    /** 平台名称。 */
    label?: string;
    /** 发布数量。 */
    count?: string;
    /** 成功率（0-1 小数）。 */
    successRate?: number;
  };

  type DashboardServiceGetDashboardParams = {
    /** 趋势天数。 */
    trendDays?: number;
  };

  type DashboardSiteStat = {
    /** 检测模型站点编号。 */
    inclusionSiteId?: string;
    /** 站点名称。 */
    siteName?: string;
    /** 收录量。 */
    included?: string;
  };

  type DashboardTopKeyword = {
    /** 关键词编号。 */
    keywordId?: string;
    /** 关键词文本。 */
    keyword?: string;
    /** 收录成功次数。 */
    includedCount?: string;
  };

  type DashboardTrend = {
    /** 日期。 */
    date?: string;
    /** 文章数量。 */
    articles?: string;
    /** 发布成功。 */
    publishSucceeded?: string;
    /** GEO 检测成功数量。 */
    geoSucceeded?: string;
    /** 失败任务数量。 */
    failedTasks?: string;
  };

  type DashboardTrendPoint = {
    /** 日期（YYYY-MM-DD）。 */
    date?: string;
    /** 当日收录量。 */
    included?: string;
  };

  type DeleteRealnameAuthenticationReply = {
    /** 成功标记。 */
    success?: boolean;
  };

  type DistillKeywordQuestionsRequest = {
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

  type Enterprise = {
    /** 唯一编号。 */
    id?: string;
    /** 代理商编号。 */
    agentId?: string;
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
    /** 备注。 */
    remark?: string;
    /** 数据版本号。 */
    version?: string;
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
  };

  type EnterpriseAccount = {
    /** 唯一编号。 */
    id?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 登录用户名。 */
    username?: string;
    /** 电子邮箱。 */
    email?: string;
    /** 手机号码。 */
    phone?: string;
    /** 状态。 */
    status?: string;
    /** 必须变更密码。 */
    mustChangePassword?: boolean;
    /** 失败登录数量。 */
    failedLoginCount?: number;
    /** 锁定截止时间。 */
    lockedUntil?: string;
    /** 最近登录时间。 */
    lastLoginAt?: string;
  };

  type EnterpriseDetail = {
    /** 企业。 */
    enterprise?: Enterprise;
    /** 账号。 */
    account?: EnterpriseAccount;
    /** 订阅。 */
    subscription?: Subscription;
    /** 配额列表。 */
    quotas?: QuotaLimit[];
    /** 文章总数。 */
    articleCount?: string;
    /** 已发布文章数。 */
    publishedCount?: string;
    /** 点数余额（毫点）。 */
    pointsBalance?: string;
    /** 点数冻结（毫点）。 */
    pointsFrozen?: string;
  };

  type EnterpriseProfile = {
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
    quotas?: Quota[];
    /** 点数余额（毫点）。 */
    pointsBalance?: string;
    /** 冻结点数（毫点）。 */
    pointsFrozen?: string;
    /** 订阅状态：active / expired。 */
    subscriptionStatus?: string;
  };

  type EnterpriseServiceChangeEnterpriseStatusParams = {
    /** 唯一编号。 */
    id: string;
  };

  type EnterpriseServiceGetEnterpriseParams = {
    /** 唯一编号。 */
    id: string;
  };

  type EnterpriseServiceListEnterprisesParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 搜索关键词。 */
    keyword?: string;
    /** 状态。 */
    status?: string;
    /** 套餐编号。 */
    planId?: string;
    /** 代理商编号。 */
    agentId?: string;
    /** 是否仅查询即将到期的企业。 */
    expiringSoon?: boolean;
  };

  type EnterpriseServiceResetEnterprisePasswordParams = {
    /** 唯一编号。 */
    id: string;
  };

  type EnterpriseServiceSetEnterpriseQuotaParams = {
    /** 企业编号。 */
    enterpriseId: string;
    /** 指标。 */
    metric: string;
  };

  type EnterpriseServiceSetEnterpriseSubscriptionParams = {
    /** 企业编号。 */
    enterpriseId: string;
  };

  type EnterpriseServiceUpdateEnterpriseParams = {
    "enterprise.id": string;
  };

  type ExportJob = {
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

  type GalleryAlbum = {
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

  type GalleryImage = {
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

  type GeoAnswer = {
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
    citations?: GeoCitation[];
    /** 提及列表。 */
    mentions?: GeoMention[];
    /** 可见性评分。 */
    visibilityScore?: number;
    /** 准确性评分。 */
    accuracyScore?: number;
    /** 置信度。 */
    confidence?: number;
    /** 对话页面链接（session_ref），用于跳转到原始对话页面。 */
    sessionRef?: string;
  };

  type GeoCitation = {
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

  type GeoDashboard = {
    /** 企业名片。 */
    company?: DashboardCompanyCard;
    /** 数据总览。 */
    overview?: DashboardOverview;
    /** 趋势图数据点。 */
    trend?: DashboardTrendPoint[];
    /** 分平台收录量。 */
    siteStats?: DashboardSiteStat[];
    /** Top 热词榜。 */
    topKeywords?: DashboardTopKeyword[];
    /** 收录明细任务列表。 */
    tasks?: GeoTask[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
    /** 更新时间。 */
    updatedAt?: string;
  };

  type GeoMention = {
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

  type GeoMetrics = {
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

  type GeoReportFilter = {
    /** 品牌编号。 */
    brandId?: string;
    /** 检测模型站点编号。 */
    inclusionSiteId?: string;
    /** 开始日期。 */
    from?: string;
    /** 结束日期，为不包含该日期的上界。 */
    to?: string;
  };

  type GeoReportMetrics = {
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

  type GeoReportSummary = {
    /** 筛选条件。 */
    filter?: GeoReportFilter;
    /** 指标集合。 */
    metrics?: GeoReportMetrics;
    /** 生成时间。 */
    generatedAt?: string;
  };

  type GeoReportTrendPoint = {
    /** UTC 日历日期，格式为 YYYY-MM-DD。 */
    date?: string;
    /** 指标集合。 */
    metrics?: GeoReportMetrics;
  };

  type GeoSitePerformance = {
    /** 检测模型站点编号。 */
    inclusionSiteId?: string;
    /** 检测模型站点名称。 */
    inclusionSiteName?: string;
    /** 指标集合。 */
    metrics?: GeoReportMetrics;
  };

  type GeoTask = {
    /** 唯一编号。 */
    id?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 企业名称。 */
    enterpriseName?: string;
    /** 监测计划编号。 */
    monitorPlanId?: string;
    /** 监测套餐名称。 */
    monitorPlanName?: string;
    /** 品牌编号。 */
    brandId?: string;
    /** 品牌名称。 */
    brandName?: string;
    /** 问题编号。 */
    questionId?: string;
    /** 问题文本。 */
    questionText?: string;
    /** 检测模型站点编号。 */
    inclusionSiteId?: string;
    /** 检测模型站点名称。 */
    inclusionSiteName?: string;
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
    /** 已尝试次数。 */
    attemptCount?: number;
    /** 最大尝试次数。 */
    maxAttempts?: number;
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
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
    /** 品牌是否被提及（收录判定）。 */
    brandMentioned?: boolean;
    /** 会话引用（官方对话链接）。 */
    sessionRef?: string;
    /** 终端类型: 1=电脑端 2=移动端。 */
    terminalType?: number;
  };

  type GeoTask = {
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

  type GeoTaskActionRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type GeoTaskDetail = {
    /** 任务。 */
    task?: GeoTask;
    /** 回答。 */
    answer?: AnswerSnapshot;
    /** 引用列表。 */
    citations?: Citation[];
    /** 提及列表。 */
    mentions?: Mention[];
    /** 分析。 */
    analysis?: AnalysisResult;
    /** 审核记录。 */
    reviews?: ManualReview[];
  };

  type GeoTaskServiceCancelGeoTaskParams = {
    /** 唯一编号。 */
    id: string;
  };

  type GeoTaskServiceCreateManualReviewParams = {
    /** 任务编号。 */
    taskId: string;
  };

  type GeoTaskServiceGetGeoTaskParams = {
    /** 唯一编号。 */
    id: string;
  };

  type GeoTaskServiceListGeoTasksParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 检测模型站点编号。 */
    inclusionSiteId?: string;
    /** 状态。 */
    status?: string;
    /** 错误分类。 */
    errorCategory?: string;
    /** 搜索关键词。 */
    keyword?: string;
  };

  type GeoTaskServiceRetryGeoTaskParams = {
    /** 唯一编号。 */
    id: string;
  };

  type InclusionSite = {
    /** 唯一编号。 */
    id?: string;
    /** 业务编码。 */
    code?: string;
    /** 名称。 */
    name?: string;
    /** 站点入口地址。 */
    entryUrl?: string;
    /** 图标地址。 */
    icon?: string;
    /** 状态。 */
    status?: number;
    /** 授权方式。 */
    authorizationType?: number;
    /** 驱动版本。 */
    driverVersion?: string;
    /** 维护提示。 */
    maintenanceMessage?: string;
    /** 排序值。 */
    sortOrder?: number;
    /** 数据版本号。 */
    version?: string;
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
    /** 客户端自动化驱动类型，从 1 开始，不等同于业务编码。 */
    driverType?: number;
  };

  type InclusionSiteAuthorizationServiceChangeInclusionSiteAuthorizationStatusParams =
    {
      /** 唯一编号。 */
      id: string;
    };

  type InclusionSiteAuthorizationServiceGetInclusionSiteAuthorizationParams = {
    /** 唯一编号。 */
    id: string;
  };

  type InclusionSiteAuthorizationServiceListInclusionSiteAuthorizationsParams =
    {
      /** 每页记录数。 */
      pageSize?: number;
      /** 分页令牌。 */
      pageToken?: string;
      /** 企业编号。 */
      enterpriseId?: string;
      /** 检测模型站点编号。 */
      inclusionSiteId?: string;
      /** 授权状态。 */
      authorizationStatus?: string;
      /** 使用状态。 */
      usageStatus?: string;
      /** 搜索关键词。 */
      keyword?: string;
    };

  type InclusionSiteServiceDeleteInclusionSiteParams = {
    /** 唯一编号。 */
    id: string;
    /** 数据版本号。 */
    version?: string;
  };

  type InclusionSiteServiceGetInclusionSiteParams = {
    /** 唯一编号。 */
    id: string;
  };

  type InclusionSiteServiceListInclusionSitesParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 状态。 */
    status?: number;
    /** 搜索关键词。 */
    keyword?: string;
  };

  type InclusionSiteServiceUpdateInclusionSiteParams = {
    "inclusion_site.id": string;
  };

  type Keyword = {
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

  type KeywordDistillationTask = {
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

  type KnowledgeBase = {
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

  type KnowledgeChunk = {
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

  type KnowledgeDocument = {
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

  type ListAdminPermissionsReply = {
    /** 数据列表。 */
    items?: AdminPermission[];
  };

  type ListAdminRolesReply = {
    /** 数据列表。 */
    items?: AdminRole[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListAdminUsersReply = {
    /** 数据列表。 */
    items?: AdminUser[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListAlertsReply = {
    /** 数据列表。 */
    items?: Alert[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListArticleGenerationsReply = {
    /** 数据列表。 */
    items?: ArticleGenerationTask[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListArticlesReply = {
    /** 数据列表。 */
    items?: Article[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListArticlesReply = {
    /** 数据列表。 */
    items?: Article[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListArticleTypeCatalogReply = {
    /** 数据列表。 */
    items?: ArticleTypeCatalogItem[];
  };

  type ListArticleTypesReply = {
    /** 数据列表。 */
    items?: ArticleType[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListArticleTypeVersionsReply = {
    /** 数据列表。 */
    items?: ArticleTypeVersion[];
  };

  type ListAuditLogsReply = {
    /** 数据列表。 */
    items?: AuditLog[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListBrandsReply = {
    /** 数据列表。 */
    items?: Brand[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListCustomerAuthorizationsReply = {
    /** 数据列表。 */
    items?: CustomerAuthorization[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListEnterprisesReply = {
    /** 数据列表。 */
    items?: EnterpriseDetail[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListExportJobsReply = {
    /** 数据列表。 */
    items?: ExportJob[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListGalleryAlbumsReply = {
    items?: GalleryAlbum[];
    nextPageToken?: string;
    totalSize?: string;
  };

  type ListGalleryImagesReply = {
    items?: GalleryImage[];
    nextPageToken?: string;
    totalSize?: string;
  };

  type ListGeoReportTrendReply = {
    /** 筛选条件。 */
    filter?: GeoReportFilter;
    /** 数据列表。 */
    items?: GeoReportTrendPoint[];
    /** 生成时间。 */
    generatedAt?: string;
  };

  type ListGeoSitePerformanceReply = {
    /** 筛选条件。 */
    filter?: GeoReportFilter;
    /** 数据列表。 */
    items?: GeoSitePerformance[];
    /** 生成时间。 */
    generatedAt?: string;
  };

  type ListGeoTasksReply = {
    /** 数据列表。 */
    items?: GeoTask[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListGeoTasksReply = {
    /** 数据列表。 */
    items?: GeoTask[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListInclusionSiteAuthorizationsReply = {
    /** 数据列表。 */
    items?: CustomerAuthorization[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListInclusionSiteCatalogReply = {
    /** 数据列表。 */
    items?: CatalogItem[];
  };

  type ListInclusionSitesReply = {
    /** 数据列表。 */
    items?: InclusionSite[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListInclusionSitesReply = {
    /** 数据列表。 */
    items?: CatalogItem[];
  };

  type ListKeywordDistillationsReply = {
    items?: KeywordDistillationTask[];
    nextPageToken?: string;
    totalSize?: string;
  };

  type ListKeywordsReply = {
    /** 数据列表。 */
    items?: Keyword[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListKnowledgeBasesReply = {
    /** 数据列表。 */
    items?: KnowledgeBase[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListKnowledgeChunksReply = {
    /** 数据列表。 */
    items?: KnowledgeChunk[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListKnowledgeDocumentsReply = {
    /** 数据列表。 */
    items?: KnowledgeDocument[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListMonitorPlansReply = {
    /** 数据列表。 */
    items?: MonitorPlan[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListMyOrdersReply = {
    items?: UserSubscriptionOrder[];
    nextPageToken?: string;
    totalSize?: string;
  };

  type ListNotificationsReply = {
    /** 数据列表。 */
    items?: Notification[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListPlansReply = {
    /** 数据列表。 */
    items?: Plan[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListPlatformAccountsReply = {
    /** 数据列表。 */
    items?: PlatformAccount[];
  };

  type ListPublishChannelCatalogReply = {
    /** 数据列表。 */
    items?: CatalogItem[];
  };

  type ListPublishChannelsReply = {
    /** 数据列表。 */
    items?: PublishChannel[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListPublishChannelsReply = {
    /** 数据列表。 */
    items?: CatalogItem[];
  };

  type ListPublishPlansReply = {
    /** 数据列表。 */
    items?: PublishPlan[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListPublishTargetCatalogReply = {
    /** 数据列表。 */
    items?: CatalogItem[];
  };

  type ListPublishTargetsReply = {
    /** 数据列表。 */
    items?: PublishTarget[];
  };

  type ListPublishTasksReply = {
    /** 数据列表。 */
    items?: PublishTask[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListPurchasablePlansReply = {
    items?: PurchasablePlan[];
  };

  type ListQuestionsReply = {
    /** 数据列表。 */
    items?: Question[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListRealnameAuthenticationsReply = {
    /** 数据列表。 */
    items?: RealnameAuthenticationDetail[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListSalesDiagnosesReply = {
    /** 数据列表。 */
    items?: SalesDiagnosis[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListSalesOpportunitiesReply = {
    /** 数据列表。 */
    items?: SalesOpportunity[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListSalesOpportunityOwnersReply = {
    /** 负责人列表。 */
    items?: SalesOpportunityOwner[];
    /** 当前人员是否可以把机会分配给其他人员。 */
    canAssignOthers?: boolean;
  };

  type ListSelfMediaAuthorizationsReply = {
    /** 数据列表。 */
    items?: CustomerAuthorization[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListSessionsReply = {
    /** 数据列表。 */
    items?: Session[];
  };

  type ListSubscriptionOrdersReply = {
    items?: SubscriptionOrder[];
    nextPageToken?: string;
    totalSize?: string;
  };

  type ListSucceededPublishTasksReply = {
    /** 数据列表。 */
    items?: PublishTask[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListSystemSettingsReply = {
    /** 数据列表。 */
    items?: SystemSetting[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListWorkersReply = {
    /** 数据列表。 */
    items?: WorkerNode[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type ListWritingModelCatalogReply = {
    /** 数据列表。 */
    items?: CatalogItem[];
  };

  type ListWritingModelsReply = {
    /** 数据列表。 */
    items?: WritingModel[];
    /** 下一页分页令牌。 */
    nextPageToken?: string;
    /** 总记录数。 */
    totalSize?: string;
  };

  type LoginReply = {
    /** 访问令牌。 */
    accessToken?: string;
    /** 刷新令牌。 */
    refreshToken?: string;
    /** 访问令牌过期时间。 */
    accessExpiresAt?: string;
    /** 企业。 */
    enterprise?: EnterpriseProfile;
  };

  type LoginRequest = {
    /** 登录用户名。 */
    username?: string;
    /** 登录密码。 */
    password?: string;
    /** 客户端设备编号。 */
    deviceId?: string;
  };

  type LogoutRequest = {
    /** 是否作用于全部会话。 */
    allSessions?: boolean;
  };

  type ManualReview = {
    /** 唯一编号。 */
    id?: string;
    /** 回答快照编号。 */
    answerSnapshotId?: string;
    /** 分析结果编号。 */
    analysisResultId?: string;
    /** 审核人编号。 */
    reviewerId?: string;
    /** 变更前数据 JSON。 */
    beforeJson?: string;
    /** 变更后数据 JSON。 */
    afterJson?: string;
    /** 操作原因。 */
    reason?: string;
    /** 创建时间。 */
    createdAt?: string;
  };

  type MarkAllNotificationsReadReply = {
    /** 更新数量。 */
    updatedCount?: string;
  };

  type MarkNotificationReadRequest = {
    /** 唯一编号。 */
    id?: string;
  };

  type Mention = {
    /** 唯一编号。 */
    id?: string;
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

  type MonitorPlan = {
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

  type Notification = {
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

  type OpenPlanRequest = {
    enterpriseId?: string;
    planId?: string;
    cycle?: string;
    operatorId?: string;
    remark?: string;
  };

  type Plan = {
    /** 唯一编号。 */
    id?: string;
    /** 业务编码。 */
    code?: string;
    /** 名称。 */
    name?: string;
    /** 状态。 */
    status?: number;
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
    /** 限制列表。 */
    limits?: PlanLimit[];
    /** 功能列表。 */
    features?: PlanFeature[];
    /** 套餐描述。 */
    description?: string;
    /** 半年价（分）。 */
    halfYearlyPriceMinorUnits?: string;
    /** 年价（分）。 */
    yearlyPriceMinorUnits?: string;
    /** 货币代码。 */
    currency?: string;
    /** 计费周期。 */
    billingCycle?: string;
    /** 是否在企业工作台可见。 */
    visibleToEnterprise?: boolean;
    /** 排序权重。 */
    sortOrder?: number;
    /** 系列分组编码。 */
    seriesCode?: string;
    /** 赠送点数（毫点）。 */
    grantedPoints?: string;
  };

  type PlanFeature = {
    /** 唯一编号。 */
    id?: string;
    /** 套餐编号。 */
    planId?: string;
    /** 功能。 */
    feature?: number;
    /** 是否启用。 */
    enabled?: boolean;
  };

  type PlanLimit = {
    /** 唯一编号。 */
    id?: string;
    /** 套餐编号。 */
    planId?: string;
    /** 指标。 */
    metric?: number;
    /** 上限值。 */
    limitValue?: string;
    /** 周期。 */
    period?: number;
  };

  type PlanServiceDeletePlanParams = {
    /** 唯一编号。 */
    id: string;
  };

  type PlanServiceGetPlanParams = {
    /** 唯一编号。 */
    id: string;
  };

  type PlanServiceListPlansParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 状态。 */
    status?: number;
    /** 搜索关键词。 */
    keyword?: string;
  };

  type PlanServiceUpdatePlanParams = {
    "plan.id": string;
  };

  type PlatformAccount = {
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

  type PlatformAccountCredential = {
    /** 平台账号编号。 */
    accountId?: string;
    /** 客户端加密后的授权凭据密文。 */
    credentialPayload?: string;
  };

  type PublishArticleTypeVersionRequest = {
    /** 文章类型编号。 */
    articleTypeId?: string;
    /** 版本编号。 */
    versionId?: string;
    /** 期望的数据版本号。 */
    expectedVersion?: string;
  };

  type PublishAttempt = {
    /** 唯一编号。 */
    id?: string;
    /** 尝试序号。 */
    attemptNumber?: number;
    /** 工作节点编号。 */
    workerNodeId?: string;
    /** 租约编号。 */
    leaseId?: string;
    /** 状态。 */
    status?: string;
    /** 开始时间。 */
    startedAt?: string;
    /** 结束时间。 */
    finishedAt?: string;
    /** 耗时毫秒数。 */
    durationMs?: string;
    /** 结果数据 JSON。 */
    resultJson?: string;
    /** 证据数据 JSON。 */
    evidenceJson?: string;
    /** 错误分类。 */
    errorCategory?: string;
    /** 错误编码。 */
    errorCode?: string;
    /** 错误信息。 */
    errorMessage?: string;
    /** 客户端版本。 */
    clientVersion?: string;
  };

  type PublishChannel = {
    /** 唯一编号。 */
    id?: string;
    /** 业务编码。 */
    code?: string;
    /** 名称。 */
    name?: string;
    /** 分类。 */
    category?: number;
    /** 图标地址。 */
    icon?: string;
    /** 说明。 */
    description?: string;
    /** 状态。 */
    status?: number;
    /** 授权方式。 */
    authorizationType?: number;
    /** 执行模式。 */
    executionMode?: number;
    /** 驱动版本。 */
    driverVersion?: string;
    /** 排序值。 */
    sortOrder?: number;
    /** 数据版本号。 */
    version?: string;
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
    /** 客户端自动化驱动类型，从 1 开始，不等同于业务编码。 */
    driverType?: number;
    /** 客户端授权登录入口。 */
    loginUrl?: string;
  };

  type PublishChannelServiceCreatePublishTargetParams = {
    /** 发布渠道编号。 */
    publishChannelId: string;
  };

  type PublishChannelServiceDeletePublishChannelParams = {
    /** 唯一编号。 */
    id: string;
    /** 数据版本号。 */
    version?: string;
  };

  type PublishChannelServiceDeletePublishTargetParams = {
    /** 发布渠道编号。 */
    publishChannelId: string;
    /** 目标编号。 */
    targetId: string;
    /** 数据版本号。 */
    version?: string;
  };

  type PublishChannelServiceGetPublishChannelParams = {
    /** 唯一编号。 */
    id: string;
  };

  type PublishChannelServiceListPublishChannelsParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 分类。 */
    category?: number;
    /** 状态。 */
    status?: number;
    /** 搜索关键词。 */
    keyword?: string;
  };

  type PublishChannelServiceListPublishTargetsParams = {
    /** 发布渠道编号。 */
    publishChannelId: string;
    /** 目标类型。 */
    targetType?: number;
    /** 状态。 */
    status?: number;
  };

  type PublishChannelServiceUpdatePublishChannelParams = {
    "publish_channel.id": string;
  };

  type PublishChannelServiceUpdatePublishTargetParams = {
    /** 发布渠道编号。 */
    publishChannelId: string;
    "target.id": string;
  };

  type PublishPlan = {
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

  type PublishPlanDetail = {
    /** 套餐。 */
    plan?: PublishPlan;
    /** 任务列表。 */
    tasks?: PublishTask[];
  };

  type PublishTarget = {
    /** 唯一编号。 */
    id?: string;
    /** 发布渠道编号。 */
    publishChannelId?: string;
    /** 名称。 */
    name?: string;
    /** 目标类型。 */
    targetType?: number;
    /** 平台。 */
    platform?: string;
    /** 站点入口地址。 */
    entryUrl?: string;
    /** 投稿邮箱。 */
    submissionEmail?: string;
    /** 区域。 */
    region?: string;
    /** 行业。 */
    industry?: string;
    /** 渠道合作配置 JSON。 */
    cooperationJson?: string;
    /** 投稿要求 JSON。 */
    requirementsJson?: string;
    /** 状态。 */
    status?: number;
    /** 排序值。 */
    sortOrder?: number;
    /** 数据版本号。 */
    version?: string;
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
  };

  type PublishTargetInput = {
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

  type PublishTask = {
    /** 唯一编号。 */
    id?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 企业名称。 */
    enterpriseName?: string;
    /** 发布计划编号。 */
    publishPlanId?: string;
    /** 发布套餐名称。 */
    publishPlanName?: string;
    /** 文章快照编号。 */
    articleSnapshotId?: string;
    /** 文章标题。 */
    articleTitle?: string;
    /** 发布渠道编号。 */
    publishChannelId?: string;
    /** 发布渠道名称。 */
    publishChannelName?: string;
    /** 发布目标编号。 */
    publishTargetId?: string;
    /** 发布目标名称。 */
    publishTargetName?: string;
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
    /** 下一次重试时间。 */
    nextRetryAt?: string;
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
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
  };

  type PublishTask = {
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

  type PublishTaskActionRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type PublishTaskDetail = {
    /** 任务。 */
    task?: PublishTask;
    /** 尝试记录。 */
    attempts?: PublishAttempt[];
    /** 回执。 */
    receipt?: SubmissionReceipt;
  };

  type PublishTaskServiceCancelPublishTaskParams = {
    /** 唯一编号。 */
    id: string;
  };

  type PublishTaskServiceGetPublishTaskParams = {
    /** 唯一编号。 */
    id: string;
  };

  type PublishTaskServiceListPublishTasksParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 发布渠道编号。 */
    publishChannelId?: string;
    /** 状态。 */
    status?: string;
    /** 错误分类。 */
    errorCategory?: string;
    /** 搜索关键词。 */
    keyword?: string;
  };

  type PublishTaskServiceRetryPublishTaskParams = {
    /** 唯一编号。 */
    id: string;
  };

  type PublishTaskServiceSaveSubmissionReceiptParams = {
    /** 任务编号。 */
    taskId: string;
  };

  type PurchasablePlan = {
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
    limits?: PurchasablePlanLimit[];
    features?: PurchasablePlanFeature[];
  };

  type PurchasablePlanFeature = {
    feature?: number;
    enabled?: boolean;
  };

  type PurchasablePlanLimit = {
    metric?: number;
    limitValue?: string;
    period?: number;
  };

  type Question = {
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

  type Quota = {
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

  type QuotaLimit = {
    /** 唯一编号。 */
    id?: string;
    /** 企业编号。 */
    enterpriseId?: string;
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

  type RealnameAuthentication = {
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

  type RealnameAuthentication = {
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

  type RealnameAuthenticationDetail = {
    /** 实名认证。 */
    authentication?: RealnameAuthentication;
    /** 企业名称。 */
    enterpriseName?: string;
    /** 企业编码。 */
    enterpriseCode?: string;
    /** 账号用户名。 */
    username?: string;
  };

  type RealnameAuthenticationServiceApproveRealnameAuthenticationParams = {
    /** 唯一编号。 */
    id: string;
  };

  type RealnameAuthenticationServiceDeleteRealnameAuthenticationParams = {
    /** 唯一编号。 */
    id: string;
  };

  type RealnameAuthenticationServiceListRealnameAuthenticationsParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 搜索关键词。 */
    keyword?: string;
    /** 状态。 */
    status?: string;
    /** 认证类型。 */
    type?: string;
  };

  type RealnameAuthenticationServiceRejectRealnameAuthenticationParams = {
    /** 唯一编号。 */
    id: string;
  };

  type RechargeCreditsRequest = {
    enterpriseId?: string;
    creditsAmount?: string;
    amountMinorUnits?: string;
    operatorId?: string;
    remark?: string;
  };

  type RechargeCreditsRequest = {
    creditsAmount?: string;
    amountMinorUnits?: string;
    remark?: string;
  };

  type RefreshRequest = {
    /** 刷新令牌。 */
    refreshToken?: string;
  };

  type RefundOrderRequest = {
    refundReferenceOrderId?: string;
    operatorId?: string;
    remark?: string;
  };

  type RegisterWorkerReply = {
    /** 工作节点。 */
    worker?: WorkerNode;
    /** 工作节点令牌。 */
    workerToken?: string;
  };

  type RegisterWorkerRequest = {
    /** 节点编号。 */
    nodeId?: string;
    /** 名称。 */
    name?: string;
    /** 客户端版本。 */
    clientVersion?: string;
    /** 能力配置 JSON。 */
    capabilitiesJson?: string;
    /** 工作节点系统信息 JSON。 */
    systemInfoJson?: string;
    /** 最大并发数。 */
    maxConcurrency?: number;
  };

  type RejectRealnameAuthenticationRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 驳回原因。 */
    rejectReason?: string;
  };

  type ReleaseLeaseRequest = {
    /** 租约编号。 */
    leaseId?: string;
    /** 租约令牌。 */
    leaseToken?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type RenewLeaseRequest = {
    /** 租约编号。 */
    leaseId?: string;
    /** 租约令牌。 */
    leaseToken?: string;
    /** 租约版本。 */
    leaseVersion?: string;
  };

  type RenewSubscriptionRequest = {
    enterpriseId?: string;
    planId?: string;
    cycle?: string;
    renewFromSubscriptionId?: string;
    operatorId?: string;
    remark?: string;
  };

  type ReportAuthorizationHeartbeatRequest = {
    /** 授权会话令牌。 */
    sessionToken?: string;
    /** 状态。 */
    status?: string;
    /** 客户端版本。 */
    clientVersion?: string;
  };

  type ReportTaskResultRequest = {
    /** 任务类型。 */
    taskType?: string;
    /** 任务编号。 */
    taskId?: string;
    /** 租约编号。 */
    leaseId?: string;
    /** 租约令牌。 */
    leaseToken?: string;
    /** 幂等键。 */
    idempotencyKey?: string;
    /** 状态。 */
    status?: string;
    /** 结果数据 JSON。 */
    resultJson?: string;
    /** 证据数据 JSON。 */
    evidenceJson?: string;
    /** 错误分类。 */
    errorCategory?: string;
    /** 错误编码。 */
    errorCode?: string;
    /** 错误信息。 */
    errorMessage?: string;
    /** 耗时毫秒数。 */
    durationMs?: string;
    /** 客户端版本。 */
    clientVersion?: string;
  };

  type ResetAdminUserPasswordRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 新密码。 */
    newPassword?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type ResetBillingUnitCostsRequest = {
    operatorId?: string;
    reason?: string;
  };

  type ResetEnterprisePasswordRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 新密码。 */
    newPassword?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type ResolveAlertRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type RetryArticleGenerationRequest = {
    /** 唯一编号。 */
    id?: string;
  };

  type RetryKeywordDistillationRequest = {
    id?: string;
  };

  type RetryKnowledgeDocumentParseRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 文档版本。 */
    documentVersion?: number;
  };

  type RetryPublishTaskRequest = {
    /** 任务编号。 */
    taskId?: string;
    /** 数据版本号。 */
    version?: string;
  };

  type RetrySalesDiagnosisTaskRequest = {
    /** 失败任务编号。 */
    taskId?: string;
    /** 重试原因。 */
    reason?: string;
  };

  type ReviewArticleRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
    /** 操作类型。 */
    action?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type ReviewQuestionRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
    /** 操作类型。 */
    action?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type RollbackArticleTypeRequest = {
    /** 文章类型编号。 */
    articleTypeId?: string;
    /** 版本编号。 */
    versionId?: string;
    /** 期望的数据版本号。 */
    expectedVersion?: string;
  };

  type RunSalesDiagnosisRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 数据版本号。 */
    version?: string;
  };

  type SalesDiagnosis = {
    /** 唯一编号。 */
    id?: string;
    /** 诊断编号。 */
    code?: string;
    /** 诊断名称。 */
    name?: string;
    /** 诊断对象类型。 */
    subjectType?: number;
    /** 销售机会编号。 */
    opportunityId?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 发起人平台账号编号。 */
    createdByAdminId?: string;
    /** 发起人名称。 */
    createdByDisplayName?: string;
    /** 诊断状态。 */
    status?: number;
    /** 问题数量。 */
    questionCount?: number;
    /** 模型数量。 */
    modelCount?: number;
    /** 任务总数。 */
    taskCount?: number;
    /** 成功任务数。 */
    succeededTaskCount?: number;
    /** 失败任务数。 */
    failedTaskCount?: number;
    /** 客户资料快照。 */
    profile?: SalesDiagnosisProfile;
    /** 问题列表。 */
    questions?: SalesDiagnosisQuestion[];
    /** 模型列表。 */
    models?: SalesDiagnosisModel[];
    /** 任务列表。 */
    tasks?: SalesDiagnosisTask[];
    /** 指标列表。 */
    metrics?: SalesDiagnosisMetric[];
    /** 开始时间。 */
    startedAt?: string;
    /** 完成时间。 */
    completedAt?: string;
    /** 数据版本号。 */
    version?: string;
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
    /** 全部任务结束后由后台统一生成的诊断报告。 */
    report?: SalesDiagnosisReport;
    /** 逐平台采样前的品牌词与问题准备阶段。 */
    preparation?: SalesDiagnosisPreparation;
    /** 前置研究生成并用于后续主体辨识的结构化品牌相关词。 */
    brandTerms?: SalesDiagnosisBrandTerm[];
  };

  type SalesDiagnosisBrandTerm = {
    /** 唯一编号。 */
    id?: string;
    /** 词语正文。 */
    term?: string;
    /** 词语类型。 */
    termType?: number;
    /** 选择该词的用途或依据。 */
    reason?: string;
    /** 排序值。 */
    sortOrder?: number;
  };

  type SalesDiagnosisCitation = {
    /** 唯一编号。 */
    id?: string;
    /** 来源标题。 */
    title?: string;
    /** 来源地址。 */
    url?: string;
    /** 来源域名。 */
    domain?: string;
    /** 排序值。 */
    sortOrder?: number;
    /** 提供商来源编号。 */
    providerSourceId?: string;
    /** 来源平台名称。 */
    sourceName?: string;
    /** 引用摘要。 */
    snippet?: string;
    /** 引用在回答中的位置；零表示未提供。 */
    position?: number;
    /** 来源归属：1 未知，2 目标品牌，3 竞品。 */
    ownershipType?: number;
    /** 核验状态：1 提供商原始元数据，2 已额外核验。 */
    verificationStatus?: number;
    /** 信源采集时间。 */
    capturedAt?: string;
    /** 信源类型：1 其他，2 官方，3 百科，4 新闻资讯，5 行业垂类，6 社区UGC，7 攻略游记，8 OTA票务，9 文库资料。 */
    sourceType?: number;
  };

  type SalesDiagnosisClaimMatch = {
    id?: string;
    claimId?: string;
    matched?: boolean;
    confidence?: number;
    evidenceExcerpt?: string;
  };

  type SalesDiagnosisCompetitorMention = {
    /** 唯一编号。 */
    id?: string;
    /** 竞品名称。 */
    competitorName?: string;
    /** 在回答中的首次出现位置；零表示未计算。 */
    position?: number;
  };

  type SalesDiagnosisEntityMention = {
    id?: string;
    /** 1 目标品牌，2 已配置竞品，3 回答中新发现品牌。 */
    entityType?: number;
    entityRefId?: string;
    entityName?: string;
    mentionCount?: number;
    firstPosition?: number;
    /** 只有回答明确给出推荐顺序时才大于零。 */
    rankPosition?: number;
    /** 1 未知，2 正向，3 中性，4 负向。 */
    sentiment?: number;
    confidence?: number;
    evidenceExcerpt?: string;
  };

  type SalesDiagnosisMetric = {
    /** 唯一编号。 */
    id?: string;
    /** 诊断模型编号；零表示全部模型汇总。 */
    diagnosisModelId?: string;
    /** 指标代码，例如 brand_mention_rate、citation_rate。 */
    metricCode?: string;
    /** 分子。 */
    numerator?: string;
    /** 分母。 */
    denominator?: string;
    /** 指标值。 */
    value?: number;
    /** 样本量。 */
    sampleCount?: number;
    /** 可用状态：1 可用，2 不可用，3 部分可用。 */
    availabilityStatus?: number;
    /** 指标计算规则版本。 */
    ruleVersion?: string;
    /** 逐个不可变回答的计算血缘。 */
    samples?: SalesDiagnosisMetricSample[];
  };

  type SalesDiagnosisMetricComparison = {
    /** 指标代码。 */
    metricCode?: string;
    /** 基线值。 */
    baselineValue?: number;
    /** 对比值。 */
    comparisonValue?: number;
    /** 变化值。 */
    delta?: number;
    /** 基线样本量。 */
    baselineSampleCount?: number;
    /** 对比样本量。 */
    comparisonSampleCount?: number;
  };

  type SalesDiagnosisMetricSample = {
    id?: string;
    resultId?: string;
    numeratorValue?: number;
    denominatorValue?: number;
    eligible?: boolean;
    reason?: string;
  };

  type SalesDiagnosisModel = {
    /** 唯一编号。 */
    id?: string;
    /** 平台编写模型配置编号。 */
    writingModelId?: string;
    /** 展示名称。 */
    displayName?: string;
    /** 模型提供商数字枚举。 */
    provider?: number;
    /** 调用协议数字枚举。 */
    protocol?: number;
    /** 模型 API 地址。 */
    baseUrl?: string;
    /** 模型 ID。 */
    modelId?: string;
    /** 模型配置版本。 */
    modelVersion?: string;
    /** 随机性参数。 */
    temperature?: number;
    /** Top P 参数。 */
    topP?: number;
    /** 最大输出 Token 数。 */
    maxTokens?: number;
    /** 调用超时秒数。 */
    timeoutSeconds?: number;
    /** 排序值。 */
    sortOrder?: number;
    /** 信源能力：1 不支持结构化信源，2 接口返回可核验信源元数据。 */
    citationCapability?: number;
    /** 本次冻结的诊断 API：1 Chat Completions，2 Responses API。 */
    diagnosisApiMode?: number;
    /** 本次冻结配置是否启用供应商原生联网搜索工具。 */
    diagnosisWebSearchEnabled?: boolean;
  };

  type SalesDiagnosisPreparation = {
    /** 唯一编号。 */
    id?: string;
    /** 执行前置研究的诊断模型编号。 */
    diagnosisModelId?: string;
    /** 准备阶段状态。 */
    status?: number;
    /** 已尝试次数。 */
    attemptCount?: number;
    /** 最近错误码。 */
    lastErrorCode?: string;
    /** 最近错误信息。 */
    lastErrorMessage?: string;
    /** 开始时间。 */
    startedAt?: string;
    /** 完成时间。 */
    completedAt?: string;
    /** 全部不可变调用记录。 */
    attempts?: SalesDiagnosisPreparationAttempt[];
  };

  type SalesDiagnosisPreparationAttempt = {
    /** 唯一编号。 */
    id?: string;
    /** 尝试次数。 */
    attemptNo?: number;
    /** 是否成功生成并落库。 */
    succeeded?: boolean;
    /** 识别出的行业。 */
    industry?: string;
    /** 品牌主体与业务摘要。 */
    brandSummary?: string;
    /** 完整提示词快照。 */
    promptSnapshot?: string;
    /** 第三方原始响应 JSON，仅用于审计和问题排查。 */
    rawResponseJson?: string;
    /** 提供商请求编号。 */
    providerRequestId?: string;
    /** 实际响应模型。 */
    responseModel?: string;
    /** 输入 Token 数。 */
    inputTokens?: string;
    /** 输出 Token 数。 */
    outputTokens?: string;
    /** 成本，单位为百万分之一货币单位。 */
    costMicros?: string;
    /** 调用耗时，单位毫秒。 */
    durationMs?: string;
    /** 失败错误码。 */
    errorCode?: string;
    /** 失败错误信息。 */
    errorMessage?: string;
    /** 记录创建时间。 */
    createdAt?: string;
  };

  type SalesDiagnosisProfile = {
    /** 客户企业名称。 */
    customerName?: string;
    /** 客户官网。 */
    website?: string;
    /** 行业。 */
    industry?: string;
    /** 地区。 */
    region?: string;
    /** 品牌名称。 */
    brandName?: string;
    /** 目标客户说明。 */
    targetAudience?: string;
    /** 品牌核心价值。 */
    coreValue?: string;
    /** 当前内容建设情况。 */
    currentContent?: string;
    /** 当前痛点。 */
    painPoints?: string;
    /** 预期目标。 */
    expectedGoals?: string;
    /** 品牌别名。 */
    brandAliases?: string[];
    /** 产品或服务快照。 */
    products?: SalesDiagnosisProfileProduct[];
    /** 竞品快照。 */
    competitors?: SalesDiagnosisProfileCompetitor[];
    /** 来源数据版本。 */
    sourceVersion?: string;
    /** 诊断创建时冻结的原子官方事实，用于内容采纳率计算。 */
    claims?: SalesDiagnosisProfileClaim[];
  };

  type SalesDiagnosisProfileClaim = {
    /** 唯一编号。 */
    id?: string;
    /** 事实类型：1 品牌价值，2 产品，3 目标客户，4 现有内容，5 其他。 */
    claimType?: number;
    /** 来源资料字段。 */
    sourceField?: string;
    /** 来源子项编号，例如产品快照编号。 */
    sourceItemId?: string;
    /** 原子事实正文。 */
    claimText?: string;
    /** 排序值。 */
    sortOrder?: number;
  };

  type SalesDiagnosisProfileCompetitor = {
    /** 竞品名称。 */
    name?: string;
    /** 竞品官网。 */
    website?: string;
    /** 竞品说明。 */
    description?: string;
  };

  type SalesDiagnosisProfileProduct = {
    /** 名称。 */
    name?: string;
    /** 说明。 */
    description?: string;
    /** 主要卖点。 */
    sellingPoints?: string;
    /** 目标客户。 */
    targetAudience?: string;
  };

  type SalesDiagnosisQuestion = {
    /** 唯一编号。 */
    id?: string;
    /** 问题正文。 */
    question?: string;
    /** 排序值。 */
    sortOrder?: number;
    /** 来源：1 人工填写，2 前置研究模型生成。 */
    sourceType?: number;
    /** 问题意图，例如品类推荐或竞品对比。 */
    intent?: string;
    /** 生成该问题要验证的诊断指标。 */
    reason?: string;
  };

  type SalesDiagnosisReport = {
    /** 唯一编号。 */
    id?: string;
    /** 报告状态。 */
    status?: number;
    /** 固定模板代码。 */
    templateCode?: string;
    /** 固定模板版本。 */
    templateVersion?: number;
    /** 报告标题。 */
    title?: string;
    /** 执行摘要。 */
    executiveSummary?: string;
    /** 综合结论。 */
    overallConclusion?: string;
    /** 诊断方法说明。 */
    methodology?: string;
    /** 数据免责声明。 */
    disclaimer?: string;
    /** 各模型统一指标结果。 */
    models?: SalesDiagnosisReportModel[];
    /** 各问题跨模型汇总。 */
    questions?: SalesDiagnosisReportQuestion[];
    /** 问题、机会和建议。 */
    findings?: SalesDiagnosisReportFinding[];
    /** 报告生成时间。 */
    generatedAt?: string;
    /** 报告版本。 */
    version?: string;
    /** 品牌与竞品排名、提及和情感聚合。 */
    entities?: SalesDiagnosisReportEntity[];
    /** 提供商真实返回的信源分布。 */
    sources?: SalesDiagnosisReportSource[];
  };

  type SalesDiagnosisReportAnswer = {
    /** 唯一编号。 */
    id?: string;
    /** 不可变调用结果编号。 */
    resultId?: string;
    /** 本次诊断模型编号。 */
    diagnosisModelId?: string;
    /** 模型展示名称快照。 */
    modelName?: string;
    /** 回答摘要；完整回答仍在任务历史中。 */
    answerExcerpt?: string;
    /** 是否提及目标品牌。 */
    brandMentioned?: boolean;
    /** 证据类型。 */
    evidenceType?: number;
    /** 排序值。 */
    sortOrder?: number;
  };

  type SalesDiagnosisReportEntity = {
    id?: string;
    /** 零表示全部模型汇总。 */
    diagnosisModelId?: string;
    entityType?: number;
    entityName?: string;
    mentionCount?: number;
    mentionRate?: number;
    averageRank?: number;
    top3Count?: number;
    positiveCount?: number;
    neutralCount?: number;
    negativeCount?: number;
    sortOrder?: number;
    /** 构成本聚合结果的不可变实体提及证据编号。 */
    evidenceMentionIds?: string[];
    /** 竞品层级：0 非竞品，1 一级直接竞品，2 二级间接竞品。 */
    competitorLevel?: number;
    /** 威胁等级：0 不适用，1 低，2 中，3 高，4 极高。 */
    threatLevel?: number;
    /** 竞品地理位置；未采集时为空。 */
    location?: string;
    /** 基于真实回答证据提炼的推荐理由。 */
    recommendationReason?: string;
  };

  type SalesDiagnosisReportFinding = {
    /** 唯一编号。 */
    id?: string;
    /** 发现类型。 */
    type?: number;
    /** 严重程度。 */
    severity?: number;
    /** 标题。 */
    title?: string;
    /** 内容。 */
    content?: string;
    /** 排序值。 */
    sortOrder?: number;
    /** 所属章节：internal_gap、external_gap、optimization、summary。 */
    sectionCode?: string;
    /** 优先级：0 P0，1 P1，2 P2，3 P3。 */
    priority?: number;
    /** 影响程度：1 低，2 中，3 高。 */
    impactLevel?: number;
    /** 紧迫程度：1 低，2 中，3 高。 */
    urgencyLevel?: number;
  };

  type SalesDiagnosisReportModel = {
    /** 唯一编号。 */
    id?: string;
    /** 本次诊断模型编号。 */
    diagnosisModelId?: string;
    /** 模型展示名称快照。 */
    modelName?: string;
    /** 任务样本数。 */
    sampleCount?: number;
    /** 成功样本数。 */
    succeededCount?: number;
    /** 失败样本数。 */
    failedCount?: number;
    /** 品牌提及率。 */
    brandMentionRate?: number;
    /** 可核验引用率。 */
    citationRate?: number;
    /** 品牌声量占比。 */
    brandShareOfVoice?: number;
    /** 模型表现摘要。 */
    summary?: string;
    /** 排序值。 */
    sortOrder?: number;
    /** 目标品牌累计提及次数。 */
    mentionCount?: number;
    /** 明确排名样本中的 TOP3 占比。 */
    top3Rate?: number;
    top3Available?: boolean;
    /** 对冻结官方事实的采纳率。 */
    contentAdoptionRate?: number;
    contentAdoptionAvailable?: boolean;
    /** 当前模型是否具备可核验引用率计算条件。 */
    citationAvailable?: boolean;
    positiveCount?: number;
    neutralCount?: number;
    negativeCount?: number;
    unknownSentimentCount?: number;
    /** 平台回答中目标品牌被收录的比例。 */
    inclusionRate?: number;
    /** 平台平均信息完整度。 */
    completenessScore?: number;
    /** 平台平均回答质量。 */
    answerQualityScore?: number;
    /** 平台平均明确推荐位次。 */
    averageRecommendationPosition?: number;
    /** 是否存在可计算的明确推荐位次。 */
    recommendationPositionAvailable?: boolean;
    /** 有时效性证据样本的平均达标率。 */
    timelinessRate?: number;
    /** 是否存在可判断时效性的样本。 */
    timelinessAvailable?: boolean;
    /** 平台综合评级。 */
    overallRating?: string;
    /** 平台优势表现摘要。 */
    strengths?: string;
    /** 平台待优化点摘要。 */
    gaps?: string;
    /** GEO 视角的平台诊断结论。 */
    diagnosisConclusion?: string;
  };

  type SalesDiagnosisReportQuestion = {
    /** 唯一编号。 */
    id?: string;
    /** 诊断问题编号。 */
    questionId?: string;
    /** 问题正文快照。 */
    question?: string;
    /** 成功回答模型数。 */
    successfulModelCount?: number;
    /** 失败模型数。 */
    failedModelCount?: number;
    /** 提及目标品牌的模型数。 */
    brandMentionedModelCount?: number;
    /** 提及已配置竞品的模型数。 */
    competitorMentionedModelCount?: number;
    /** 跨模型汇总说明。 */
    summary?: string;
    /** 排序值。 */
    sortOrder?: number;
    /** 各模型最新有效回答摘要。 */
    answers?: SalesDiagnosisReportAnswer[];
  };

  type SalesDiagnosisReportSource = {
    id?: string;
    /** 零表示全部模型汇总。 */
    diagnosisModelId?: string;
    domain?: string;
    sourceName?: string;
    citationCount?: number;
    shareRate?: number;
    sortOrder?: number;
    /** 构成本信源聚合的真实引用记录编号。 */
    citationIds?: string[];
    /** 来源归属：1 第三方/未知，2 目标品牌官网，3 已配置竞品官网。 */
    ownershipType?: number;
    /** 信源类型：1 其他，2 官方，3 百科，4 新闻资讯，5 行业垂类，6 社区UGC，7 攻略游记，8 OTA票务，9 文库资料。 */
    sourceType?: number;
  };

  type SalesDiagnosisResult = {
    /** 唯一编号。 */
    id?: string;
    /** 尝试次数。 */
    attemptNo?: number;
    /** 是否成功。 */
    succeeded?: boolean;
    /** 模型原始回答正文。 */
    answer?: string;
    /** 第三方原始响应 JSON，仅用于审计和问题排查。 */
    rawResponseJson?: string;
    /** 提供商请求编号。 */
    providerRequestId?: string;
    /** 实际响应模型。 */
    responseModel?: string;
    /** 本次调用使用的完整提示词快照。 */
    promptSnapshot?: string;
    /** 证据类型。 */
    evidenceType?: number;
    /** 输入 Token 数。 */
    inputTokens?: string;
    /** 输出 Token 数。 */
    outputTokens?: string;
    /** 成本，单位为百万分之一货币单位。 */
    costMicros?: string;
    /** 调用耗时，单位毫秒。 */
    durationMs?: string;
    /** 是否提及目标品牌。 */
    brandMentioned?: boolean;
    /** 品牌在回答中的首次出现位置；零表示未出现。 */
    brandPosition?: number;
    /** 失败错误码。 */
    errorCode?: string;
    /** 失败错误信息。 */
    errorMessage?: string;
    /** 引用列表。 */
    citations?: SalesDiagnosisCitation[];
    /** 竞品提及列表。 */
    competitorMentions?: SalesDiagnosisCompetitorMention[];
    /** 结果创建时间。 */
    createdAt?: string;
    /** 对该原始回答执行的最新结构分析及证据。 */
    analysis?: SalesDiagnosisResultAnalysis;
  };

  type SalesDiagnosisResultAnalysis = {
    id?: string;
    analysisVersion?: number;
    ruleVersion?: string;
    /** 1 规则，2 模型，3 混合。 */
    analyzerKind?: number;
    analyzerModelName?: string;
    promptSnapshot?: string;
    rawResponseJson?: string;
    /** 1 成功，2 部分成功，3 失败。 */
    status?: number;
    /** 1 未知，2 正向，3 中性，4 负向。 */
    dominantSentiment?: number;
    confidence?: number;
    errorMessage?: string;
    entityMentions?: SalesDiagnosisEntityMention[];
    claimMatches?: SalesDiagnosisClaimMatch[];
    /** 目标品牌是否进入本次回答。 */
    included?: boolean;
    /** 品牌信息完整度，范围 0 到 1。 */
    completenessScore?: number;
    /** 回答质量评分，范围 0 到 1。 */
    answerQualityScore?: number;
    /** 内容时效性评分，范围 0 到 1。 */
    freshnessScore?: number;
    /** 回答是否提供了可判断时效性的证据。 */
    freshnessAvailable?: boolean;
    /** 目标品牌明确推荐位次；零表示回答没有明确排序。 */
    recommendationPosition?: number;
    /** 回答事实摘要。 */
    answerSummary?: string;
    /** 回答中的优势表现。 */
    strengths?: string;
    /** 回答中的待优化点。 */
    gaps?: string;
  };

  type SalesDiagnosisServiceCancelSalesDiagnosisParams = {
    /** 唯一编号。 */
    id: string;
  };

  type SalesDiagnosisServiceCompareSalesDiagnosesParams = {
    /** 基线诊断编号。 */
    baselineId?: string;
    /** 对比诊断编号。 */
    comparisonId?: string;
  };

  type SalesDiagnosisServiceGetSalesDiagnosisParams = {
    /** 唯一编号。 */
    id: string;
  };

  type SalesDiagnosisServiceListSalesDiagnosesParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 搜索诊断编号、名称、客户或品牌。 */
    keyword?: string;
    /** 诊断状态；零表示全部。 */
    status?: number;
    /** 诊断对象类型；零表示全部。 */
    subjectType?: number;
    /** 销售机会编号。 */
    opportunityId?: string;
    /** 企业编号。 */
    enterpriseId?: string;
  };

  type SalesDiagnosisServiceRetrySalesDiagnosisTaskParams = {
    /** 失败任务编号。 */
    taskId: string;
  };

  type SalesDiagnosisServiceRunSalesDiagnosisParams = {
    /** 唯一编号。 */
    id: string;
  };

  type SalesDiagnosisTask = {
    /** 唯一编号。 */
    id?: string;
    /** 问题编号。 */
    questionId?: string;
    /** 诊断模型编号。 */
    diagnosisModelId?: string;
    /** 任务状态。 */
    status?: number;
    /** 已尝试次数。 */
    attemptCount?: number;
    /** 最近错误码。 */
    lastErrorCode?: string;
    /** 最近错误信息。 */
    lastErrorMessage?: string;
    /** 开始时间。 */
    startedAt?: string;
    /** 完成时间。 */
    completedAt?: string;
    /** 历史调用结果，按尝试次数升序。 */
    results?: SalesDiagnosisResult[];
  };

  type SalesOpportunity = {
    /** 唯一编号。 */
    id?: string;
    /** 机会编号。 */
    code?: string;
    /** 机会名称。 */
    name?: string;
    /** 负责人平台账号编号。 */
    ownerAdminId?: string;
    /** 负责人姓名。 */
    ownerDisplayName?: string;
    /** 客户企业名称。 */
    customerName?: string;
    /** 客户官网。 */
    website?: string;
    /** 所属行业。 */
    industry?: string;
    /** 所属地区。 */
    region?: string;
    /** 主要联系人。 */
    contactName?: string;
    /** 联系电话。 */
    contactPhone?: string;
    /** 联系邮箱。 */
    contactEmail?: string;
    /** 品牌名称。 */
    brandName?: string;
    /** 目标客户说明。 */
    targetAudience?: string;
    /** 品牌核心价值。 */
    coreValue?: string;
    /** 当前内容渠道和建设情况。 */
    currentContent?: string;
    /** 当前痛点。 */
    painPoints?: string;
    /** 预期目标。 */
    expectedGoals?: string;
    /** 预算下限，使用最小货币单位。 */
    budgetMinMinorUnits?: string;
    /** 预算上限，使用最小货币单位；零表示未填写。 */
    budgetMaxMinorUnits?: string;
    /** 货币代码。 */
    currency?: string;
    /** 状态。 */
    status?: number;
    /** 备注。 */
    remark?: string;
    /** 品牌别名。 */
    brandAliases?: SalesOpportunityBrandAlias[];
    /** 产品或服务。 */
    products?: SalesOpportunityProduct[];
    /** 竞品。 */
    competitors?: SalesOpportunityCompetitor[];
    /** 数据版本号。 */
    version?: string;
    /** 关闭时间。 */
    closedAt?: string;
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
  };

  type SalesOpportunityBrandAlias = {
    /** 唯一编号。 */
    id?: string;
    /** 品牌别名。 */
    alias?: string;
    /** 排序值。 */
    sortOrder?: number;
  };

  type SalesOpportunityCompetitor = {
    /** 唯一编号。 */
    id?: string;
    /** 竞品名称。 */
    name?: string;
    /** 竞品官网。 */
    website?: string;
    /** 竞品说明。 */
    description?: string;
    /** 排序值。 */
    sortOrder?: number;
  };

  type SalesOpportunityOwner = {
    /** 平台账号编号。 */
    id?: string;
    /** 登录用户名。 */
    username?: string;
    /** 显示名称。 */
    displayName?: string;
    /** 邮箱。 */
    email?: string;
  };

  type SalesOpportunityProduct = {
    /** 唯一编号。 */
    id?: string;
    /** 产品或服务名称。 */
    name?: string;
    /** 产品或服务说明。 */
    description?: string;
    /** 主要卖点。 */
    sellingPoints?: string;
    /** 目标客户。 */
    targetAudience?: string;
    /** 排序值。 */
    sortOrder?: number;
  };

  type SalesOpportunityServiceChangeSalesOpportunityStatusParams = {
    /** 唯一编号。 */
    id: string;
  };

  type SalesOpportunityServiceCheckSalesOpportunityDuplicateParams = {
    /** 客户企业名称。 */
    customerName?: string;
    /** 客户官网。 */
    website?: string;
    /** 编辑时排除的销售机会编号。 */
    excludeId?: string;
  };

  type SalesOpportunityServiceGetSalesOpportunityParams = {
    /** 唯一编号。 */
    id: string;
  };

  type SalesOpportunityServiceListSalesOpportunitiesParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 搜索机会、客户、品牌、官网或联系人。 */
    keyword?: string;
    /** 状态；零表示全部。 */
    status?: number;
    /** 负责人编号；未传表示按当前数据范围查询。 */
    ownerAdminId?: string;
  };

  type SalesOpportunityServiceListSalesOpportunityOwnersParams = {
    /** 搜索姓名、用户名或邮箱。 */
    keyword?: string;
  };

  type SalesOpportunityServiceUpdateSalesOpportunityParams = {
    "opportunity.id": string;
  };

  type SaveSubmissionReceiptRequest = {
    /** 任务编号。 */
    taskId?: string;
    /** 回执。 */
    receipt?: SubmissionReceipt;
    /** 操作原因。 */
    reason?: string;
  };

  type SelfMediaAuthorizationServiceChangeSelfMediaAuthorizationStatusParams = {
    /** 唯一编号。 */
    id: string;
  };

  type SelfMediaAuthorizationServiceGetSelfMediaAuthorizationParams = {
    /** 唯一编号。 */
    id: string;
  };

  type SelfMediaAuthorizationServiceListSelfMediaAuthorizationsParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 发布渠道编号。 */
    publishChannelId?: string;
    /** 授权状态。 */
    authorizationStatus?: string;
    /** 使用状态。 */
    usageStatus?: string;
    /** 搜索关键词。 */
    keyword?: string;
  };

  type Session = {
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

  type SetAdminRolePermissionsRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 权限编号列表。 */
    permissionIds?: string[];
    /** 操作原因。 */
    reason?: string;
  };

  type SetAdminUserRolesRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 角色编号列表。 */
    roleIds?: string[];
    /** 操作原因。 */
    reason?: string;
  };

  type SetEnterpriseQuotaRequest = {
    /** 企业编号。 */
    enterpriseId?: string;
    /** 指标。 */
    metric?: string;
    /** 上限值。 */
    limitValue?: string;
    /** 周期。 */
    period?: string;
    /** 重置时间。 */
    resetAt?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type SetEnterpriseSubscriptionRequest = {
    /** 企业编号。 */
    enterpriseId?: string;
    /** 套餐编号。 */
    planId?: string;
    /** 状态。 */
    status?: string;
    /** 开始时间。 */
    startsAt?: string;
    /** 过期时间。 */
    expiresAt?: string;
    /** 是否自动续费。 */
    autoRenew?: boolean;
    /** 期望的数据版本号。 */
    expectedVersion?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type SubmissionReceipt = {
    /** 唯一编号。 */
    id?: string;
    /** 回执类型。 */
    receiptType?: string;
    /** 回执编码。 */
    receiptCode?: string;
    /** 状态。 */
    status?: string;
    /** 提交时间。 */
    submittedAt?: string;
    /** 期望时间。 */
    expectedAt?: string;
    /** 发布时间。 */
    publishedAt?: string;
    /** 发布地址。 */
    publishedUrl?: string;
    /** 成本（最小货币单位）。 */
    costMinorUnits?: string;
    /** 币种。 */
    currency?: string;
    /** 后续处理信息 JSON。 */
    followUpJson?: string;
  };

  type SubmitAuthorizationRequest = {
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

  type SubmitRealnameAuthenticationRequest = {
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

  type Subscription = {
    /** 唯一编号。 */
    id?: string;
    /** 企业编号。 */
    enterpriseId?: string;
    /** 套餐编号。 */
    planId?: string;
    /** 套餐名称。 */
    planName?: string;
    /** 状态。 */
    status?: string;
    /** 开始时间。 */
    startsAt?: string;
    /** 过期时间。 */
    expiresAt?: string;
    /** 是否自动续费。 */
    autoRenew?: boolean;
    /** 数据版本号。 */
    version?: string;
  };

  type SubscriptionOrder = {
    id?: string;
    orderNo?: string;
    enterpriseId?: string;
    planId?: string;
    orderType?: string;
    cycle?: string;
    amountMinorUnits?: string;
    currency?: string;
    creditsAmount?: string;
    addonQuotaMetric?: string;
    addonQuotaAmount?: string;
    renewFromSubscriptionId?: string;
    refundReferenceOrderId?: string;
    pointsBefore?: string;
    pointsAfter?: string;
    status?: string;
    source?: string;
    paidAt?: string;
    approvedAt?: string;
    approvedBy?: string;
    remark?: string;
    createdAt?: string;
    updatedAt?: string;
    enterpriseName?: string;
    planName?: string;
  };

  type SubscriptionOrderServiceCancelOrderParams = {
    id: string;
  };

  type SubscriptionOrderServiceConfirmReceiptParams = {
    id: string;
  };

  type SubscriptionOrderServiceGetSubscriptionOrderParams = {
    id: string;
  };

  type SubscriptionOrderServiceListSubscriptionOrdersParams = {
    pageSize?: number;
    pageToken?: string;
    enterpriseId?: string;
    orderType?: string;
    status?: string;
    source?: string;
    keyword?: string;
  };

  type SystemSetting = {
    /** 唯一编号。 */
    id?: string;
    /** 命名空间。 */
    namespace?: string;
    /** 键名。 */
    key?: string;
    /** 配置值 JSON。 */
    valueJson?: string;
    /** 说明。 */
    description?: string;
    /** 是否为敏感数据。 */
    sensitive?: boolean;
    /** 数据版本号。 */
    version?: string;
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
  };

  type SystemSettingServiceDeleteSystemSettingParams = {
    /** 唯一编号。 */
    id: string;
    /** 数据版本号。 */
    version?: string;
    /** 操作原因。 */
    reason?: string;
  };

  type SystemSettingServiceGetSystemSettingParams = {
    /** 唯一编号。 */
    id: string;
  };

  type SystemSettingServiceListSystemSettingsParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 命名空间。 */
    namespace?: string;
    /** 搜索关键词。 */
    keyword?: string;
  };

  type SystemSettingServiceUpdateSystemSettingParams = {
    "setting.id": string;
  };

  type TaskLease = {
    /** 唯一编号。 */
    id?: string;
    /** 任务类型。 */
    taskType?: string;
    /** 任务编号。 */
    taskId?: string;
    /** 租约令牌。 */
    leaseToken?: string;
    /** 过期时间。 */
    expiresAt?: string;
    /** 租约版本。 */
    leaseVersion?: string;
    /** 任务快照 JSON。 */
    taskSnapshotJson?: string;
    /** 授权凭据密文载荷。 */
    credentialPayload?: string;
  };

  type TestWritingModelReply = {
    /** 操作是否成功。 */
    success?: boolean;
    /** 响应延迟毫秒数。 */
    latencyMs?: string;
    /** 响应预览。 */
    responsePreview?: string;
    /** 错误编码。 */
    errorCode?: string;
  };

  type TestWritingModelRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 提示词。 */
    prompt?: string;
  };

  type UnreadNotificationCountReply = {
    /** 未读数量。 */
    unreadCount?: string;
  };

  type UpdateAdminRoleRequest = {
    /** 角色。 */
    role?: AdminRole;
    /** 操作原因。 */
    reason?: string;
  };

  type UpdateAdminUserRequest = {
    /** 用户。 */
    user?: AdminUser;
    /** 操作原因。 */
    reason?: string;
  };

  type UpdateArticleRequest = {
    /** 文章。 */
    article?: Article;
    /** 变更摘要。 */
    changeSummary?: string;
  };

  type UpdateArticleTypeRequest = {
    /** 文章类型。 */
    articleType?: ArticleType;
  };

  type UpdateBillingUnitCostRequest = {
    action?: string;
    points?: number;
    chargeType?: string;
    quotaMetric?: string;
    operatorId?: string;
    reason?: string;
  };

  type UpdateBrandRequest = {
    /** 品牌。 */
    brand?: Brand;
  };

  type UpdateEnterpriseProfileRequest = {
    /** 企业。 */
    enterprise?: EnterpriseProfile;
  };

  type UpdateEnterpriseRequest = {
    /** 企业。 */
    enterprise?: Enterprise;
  };

  type UpdateGalleryAlbumRequest = {
    album?: GalleryAlbum;
  };

  type UpdateInclusionSiteRequest = {
    /** 检测模型站点。 */
    inclusionSite?: InclusionSite;
  };

  type UpdateKeywordRequest = {
    /** 搜索关键词。 */
    keyword?: Keyword;
  };

  type UpdateKnowledgeBaseRequest = {
    /** 知识库。 */
    knowledgeBase?: KnowledgeBase;
  };

  type UpdateKnowledgeDocumentRequest = {
    /** 文档。 */
    document?: KnowledgeDocument;
    /** 内容。 */
    content?: string;
  };

  type UpdateMonitorPlanRequest = {
    /** 唯一编号。 */
    id?: string;
    /** 监测计划名称。 */
    name?: string;
    /** 数据版本号（乐观锁）。 */
    version?: string;
  };

  type UpdatePlanRequest = {
    /** 套餐。 */
    plan?: Plan;
  };

  type UpdatePublishChannelRequest = {
    /** 发布渠道。 */
    publishChannel?: PublishChannel;
  };

  type UpdatePublishTargetRequest = {
    /** 发布渠道编号。 */
    publishChannelId?: string;
    /** 目标。 */
    target?: PublishTarget;
  };

  type UpdateQuestionRequest = {
    /** 问题。 */
    question?: Question;
  };

  type UpdateSalesOpportunityRequest = {
    /** 销售机会和客户资料。 */
    opportunity?: SalesOpportunity;
  };

  type UpdateSystemSettingRequest = {
    /** 配置项。 */
    setting?: SystemSetting;
    /** 操作原因。 */
    reason?: string;
  };

  type UpdateWritingModelRequest = {
    /** 写作模型。 */
    writingModel?: WritingModel;
    /** 替换用 API Key。 */
    replacementApiKey?: string;
  };

  type UploadGalleryImageRequest = {
    albumId?: string;
    originalName?: string;
    mimeType?: string;
    content?: string;
  };

  type UploadInclusionSiteIconReply = {
    /** 地址。 */
    url?: string;
  };

  type UploadInclusionSiteIconRequest = {
    /** 文件名。 */
    filename?: string;
    /** 内容类型。 */
    contentType?: string;
    /** 内容。 */
    content?: string;
  };

  type UploadPublishChannelIconReply = {
    /** 地址。 */
    url?: string;
  };

  type UploadPublishChannelIconRequest = {
    /** 文件名。 */
    filename?: string;
    /** 内容类型。 */
    contentType?: string;
    /** 内容。 */
    content?: string;
  };

  type UploadRealnameImageReply = {
    /** 图片的 OSS URL。 */
    url?: string;
    /** 对象键。 */
    objectKey?: string;
  };

  type UploadRealnameImageRequest = {
    /** 原始文件名。 */
    originalName?: string;
    /** MIME 类型。 */
    mimeType?: string;
    /** Base64 编码的图片内容。 */
    content?: string;
    /** 用途：license（营业执照）或 id_card（身份证）。 */
    usage?: string;
  };

  type UserSubscriptionOrder = {
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

  type WorkerDetail = {
    /** 工作节点。 */
    worker?: WorkerNode;
    /** 心跳记录。 */
    heartbeats?: WorkerHeartbeatRecord[];
    /** 租约列表。 */
    leases?: WorkerLease[];
  };

  type WorkerHeartbeatRecord = {
    /** 唯一编号。 */
    id?: string;
    /** 活跃任务数量。 */
    activeTasks?: number;
    /** 运行指标 JSON。 */
    metricsJson?: string;
    /** 接收时间。 */
    receivedAt?: string;
  };

  type WorkerHeartbeatReply = {
    /** 任务是否已受理。 */
    accepted?: boolean;
    /** 已撤销。 */
    revoked?: boolean;
    /** 是否强制升级。 */
    forceUpgrade?: boolean;
    /** 最新客户端版本。 */
    latestVersion?: string;
  };

  type WorkerHeartbeatRequest = {
    /** 工作节点令牌。 */
    workerToken?: string;
    /** 客户端版本。 */
    clientVersion?: string;
    /** 能力配置 JSON。 */
    capabilitiesJson?: string;
    /** 工作节点系统信息 JSON。 */
    systemInfoJson?: string;
    /** 活跃任务数量。 */
    activeTasks?: number;
  };

  type WorkerLease = {
    /** 唯一编号。 */
    id?: string;
    /** 任务类型。 */
    taskType?: string;
    /** 任务编号。 */
    taskId?: string;
    /** 状态。 */
    status?: string;
    /** 租用时间。 */
    leasedAt?: string;
    /** 过期时间。 */
    expiresAt?: string;
    /** 已释放时间。 */
    releasedAt?: string;
    /** 释放原因。 */
    releaseReason?: string;
  };

  type WorkerNode = {
    /** 唯一编号。 */
    id?: string;
    /** 节点编号。 */
    nodeId?: string;
    /** 名称。 */
    name?: string;
    /** 状态。 */
    status?: string;
    /** 审批状态。 */
    approvalStatus?: string;
    /** 客户端版本。 */
    clientVersion?: string;
    /** 支持的驱动版本 JSON。 */
    driverVersionsJson?: string;
    /** 能力配置 JSON。 */
    capabilitiesJson?: string;
    /** 工作节点系统信息 JSON。 */
    systemInfoJson?: string;
    /** 最大并发数。 */
    maxConcurrency?: number;
    /** 最近心跳时间。 */
    lastHeartbeatAt?: string;
    /** 已撤销时间。 */
    revokedAt?: string;
    /** 数据版本号。 */
    version?: string;
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
  };

  type WorkerServiceChangeWorkerStatusParams = {
    /** 唯一编号。 */
    id: string;
  };

  type WorkerServiceGetWorkerParams = {
    /** 唯一编号。 */
    id: string;
  };

  type WorkerServiceListWorkersParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 状态。 */
    status?: string;
    /** 审批状态。 */
    approvalStatus?: string;
    /** 搜索关键词。 */
    keyword?: string;
  };

  type WritingModel = {
    /** 唯一编号。 */
    id?: string;
    /** 业务编码。 */
    code?: string;
    /** 显示名称。 */
    displayName?: string;
    /** 供应商。 */
    provider?: number;
    /** 协议。 */
    protocol?: number;
    /** 基础地址。 */
    baseUrl?: string;
    /** 模型编号。 */
    modelId?: string;
    /** 是否已配置访问凭据。 */
    credentialConfigured?: boolean;
    /** 上下文长度。 */
    contextLength?: number;
    /** 状态。 */
    status?: number;
    /** 排序值。 */
    sortOrder?: number;
    /** 数据版本号。 */
    version?: string;
    /** 创建时间。 */
    createdAt?: string;
    /** 更新时间。 */
    updatedAt?: string;
    /** 用途列表。 */
    purposes?: number[];
    /** 温度参数。 */
    temperature?: number;
    /** Top P 采样参数。 */
    topP?: number;
    /** 最大令牌数。 */
    maxTokens?: number;
    /** 超时秒数。 */
    timeoutSeconds?: number;
    /** 内容安全启用。 */
    safetyEnabled?: boolean;
    /** 输入审核启用。 */
    inputModerationEnabled?: boolean;
    /** 输出审核启用。 */
    outputModerationEnabled?: boolean;
    /** 内容安全失败关闭。 */
    safetyFailClosed?: boolean;
    /** 拦截内容安全分类列表。 */
    blockedSafetyCategories?: number[];
    /** 每百万输入 Token 的微单位价格。 */
    inputPriceMicrosPerMillionTokens?: string;
    /** 每百万输出 Token 的微单位价格。 */
    outputPriceMicrosPerMillionTokens?: string;
    /** 价格币种。 */
    priceCurrency?: number;
    /** 访问范围。 */
    accessScope?: number;
    /** 可见套餐编号列表。 */
    visiblePlanIds?: string[];
    /** 可见企业编号列表。 */
    visibleEnterpriseIds?: string[];
    /** 信源能力：1 不支持结构化信源，2 接口返回可核验信源元数据。 */
    citationCapability?: number;
    /** 售前诊断 API：1 Chat Completions，2 Responses API。 */
    diagnosisApiMode?: number;
    /** 售前诊断是否启用供应商原生联网搜索工具。 */
    diagnosisWebSearchEnabled?: boolean;
  };

  type WritingModelServiceDeleteWritingModelParams = {
    /** 唯一编号。 */
    id: string;
    /** 数据版本号。 */
    version?: string;
  };

  type WritingModelServiceGetWritingModelParams = {
    /** 唯一编号。 */
    id: string;
  };

  type WritingModelServiceListWritingModelsParams = {
    /** 每页记录数。 */
    pageSize?: number;
    /** 分页令牌。 */
    pageToken?: string;
    /** 供应商。 */
    provider?: number;
    /** 状态。 */
    status?: number;
    /** 搜索关键词。 */
    keyword?: string;
  };

  type WritingModelServiceTestWritingModelParams = {
    /** 唯一编号。 */
    id: string;
  };

  type WritingModelServiceUpdateWritingModelParams = {
    "writing_model.id": string;
  };
}
