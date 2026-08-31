export type NumericOption = { label: string; value: number };
export type ApiNumericOption = NumericOption & { apiValue: string };
export type StringOption = { label: string; value: string };

export const PlanStatus = { active: 1, disabled: 2, archived: 3 } as const;
export const PlanMetric = {
  articleGenerations: 1,
  publishTasks: 2,
  geoQueries: 3,
  knowledgeBytes: 4,
  aiTokens: 5,
  aiDistills: 6,
  brandKeywords: 7,
  productKeywords: 8,
  customKeywords: 9,
  aiDerivedKeywords: 10,
} as const;
export const QuotaPeriod = {
  daily: 1,
  monthly: 2,
  yearly: 3,
  total: 4,
  lifetime: 5,
} as const;
export const PlanFeature = {
  articleGeneration: 1,
  knowledgeManagement: 2,
  publishManagement: 3,
  geoMonitoring: 4,
  dataExport: 5,
  sentimentAnalysis: 6,
  competitorAnalysis: 7,
  opinionAnalysis: 8,
} as const;
export const AdminRoleDataScope = { all: 1, assigned: 2, readonly: 3 } as const;
export const AdminRoleStatus = { active: 1, disabled: 2 } as const;
export const ArticleTypeSource = { system: 1, custom: 2 } as const;
export const ArticleTypeStatus = {
  draft: 1,
  active: 2,
  disabled: 3,
  archived: 4,
} as const;
export const ArticleTypeVersionStatus = { draft: 1, published: 2 } as const;
export const PublishChannelCategory = {
  selfMedia: 1,
  officialMedia: 2,
  kol: 3,
} as const;
export const PlatformConfigStatus = {
  active: 1,
  disabled: 2,
  maintenance: 3,
} as const;
export const AuthorizationType = { none: 1, clientLogin: 2 } as const;
export const ExecutionMode = {
  automatic: 1,
  semiAutomatic: 2,
  manual: 3,
} as const;
export const WritingModelProvider = {
  qwen: 1,
  deepseek: 2,
  kimi: 3,
  openai: 4,
  custom: 5,
} as const;
export const WritingModelProtocol = { openAICompatible: 1 } as const;
export const WritingModelDiagnosisAPI = {
  chatCompletions: 1,
  responses: 2,
} as const;
export const WritingModelStatus = { active: 1, disabled: 2 } as const;
export const WritingModelCitationCapability = {
  none: 1,
  providerSources: 2,
} as const;
export const WritingModelPurpose = {
  outline: 1,
  article: 2,
  rewrite: 3,
  summary: 4,
  questionExtraction: 5,
  salesDiagnosis: 6,
  sentimentAnalysis: 7,
  sentimentTendencyAnalysis: 8,
  competitorAnalysis: 9,
  opinionSummary: 10,
} as const;
export const SafetyCategory = {
  illegal: 1,
  violence: 2,
  adult: 3,
  hate: 4,
  selfHarm: 5,
  personalData: 6,
} as const;
export const PriceCurrency = { cny: 1, usd: 2 } as const;
export const WritingModelAccess = { all: 1, restricted: 2 } as const;

export const planStatusOptions: NumericOption[] = [
  { label: '启用', value: PlanStatus.active },
  { label: '停用', value: PlanStatus.disabled },
  { label: '归档', value: PlanStatus.archived },
];
export const planMetricOptions: NumericOption[] = [
  { label: '词条数', value: PlanMetric.articleGenerations },
  { label: '发布篇数', value: PlanMetric.publishTasks },
  { label: 'AI蒸馏使用次数', value: PlanMetric.aiDistills },
  { label: '品牌关键词', value: PlanMetric.brandKeywords },
  { label: '产品关键词', value: PlanMetric.customKeywords },
];
export const quotaPeriodOptions: NumericOption[] = [
  { label: '每日', value: QuotaPeriod.daily },
  { label: '每月', value: QuotaPeriod.monthly },
  { label: '每年', value: QuotaPeriod.yearly },
  { label: '套餐有效期内', value: QuotaPeriod.total },
  { label: '永久', value: QuotaPeriod.lifetime },
];
export const planFeatureOptions: NumericOption[] = [
  { label: '文章智能生成', value: PlanFeature.articleGeneration },
  { label: '品牌与知识库', value: PlanFeature.knowledgeManagement },
  { label: '文章投放管理', value: PlanFeature.publishManagement },
  { label: 'GEO 监测与分析', value: PlanFeature.geoMonitoring },
  { label: '报告与数据导出', value: PlanFeature.dataExport },
  { label: '情感分析', value: PlanFeature.sentimentAnalysis },
  { label: '竞品分析', value: PlanFeature.competitorAnalysis },
  { label: '舆情分析', value: PlanFeature.opinionAnalysis },
];
export const adminRoleDataScopeOptions: NumericOption[] = [
  { label: '全部数据', value: AdminRoleDataScope.all },
  { label: '指定范围（预留）', value: AdminRoleDataScope.assigned },
  { label: '只读', value: AdminRoleDataScope.readonly },
];
export const adminRoleStatusOptions: NumericOption[] = [
  { label: '启用', value: AdminRoleStatus.active },
  { label: '停用', value: AdminRoleStatus.disabled },
];
export const articleTypeSourceOptions: NumericOption[] = [
  { label: '系统预置', value: ArticleTypeSource.system },
  { label: '平台自定义', value: ArticleTypeSource.custom },
];
export const articleTypeStatusOptions: NumericOption[] = [
  { label: '草稿', value: ArticleTypeStatus.draft },
  { label: '已启用', value: ArticleTypeStatus.active },
  { label: '已停用', value: ArticleTypeStatus.disabled },
  { label: '已归档', value: ArticleTypeStatus.archived },
];
export const publishChannelCategoryOptions: NumericOption[] = [
  { label: '自媒体', value: PublishChannelCategory.selfMedia },
  { label: '官方媒体投稿', value: PublishChannelCategory.officialMedia },
  { label: '大 V 投稿', value: PublishChannelCategory.kol },
];
export const platformConfigStatusOptions: NumericOption[] = [
  { label: '已启用', value: PlatformConfigStatus.active },
  { label: '已停用', value: PlatformConfigStatus.disabled },
  { label: '维护中', value: PlatformConfigStatus.maintenance },
];
export const authorizationTypeOptions: NumericOption[] = [
  { label: '无需企业授权', value: AuthorizationType.none },
  { label: '企业客户端登录授权', value: AuthorizationType.clientLogin },
];
export const executionModeOptions: NumericOption[] = [
  { label: '自动执行', value: ExecutionMode.automatic },
  { label: '半自动确认', value: ExecutionMode.semiAutomatic },
  { label: '纯人工', value: ExecutionMode.manual },
];
export const writingModelProviderOptions: NumericOption[] = [
  { label: '通义千问', value: WritingModelProvider.qwen },
  { label: 'DeepSeek', value: WritingModelProvider.deepseek },
  { label: 'Kimi', value: WritingModelProvider.kimi },
  { label: 'OpenAI', value: WritingModelProvider.openai },
  { label: '其他兼容服务', value: WritingModelProvider.custom },
];
export const writingModelProtocolOptions: NumericOption[] = [
  { label: 'OpenAI Compatible', value: WritingModelProtocol.openAICompatible },
];
export const writingModelDiagnosisAPIOptions: NumericOption[] = [
  {
    label: 'Chat Completions（普通问答）',
    value: WritingModelDiagnosisAPI.chatCompletions,
  },
  {
    label: 'Responses API（支持内置工具）',
    value: WritingModelDiagnosisAPI.responses,
  },
];
export const writingModelStatusOptions: NumericOption[] = [
  { label: '已启用', value: WritingModelStatus.active },
  { label: '已停用', value: WritingModelStatus.disabled },
];
export const writingModelCitationCapabilityOptions: NumericOption[] = [
  {
    label: '普通模型知识（无结构化信源）',
    value: WritingModelCitationCapability.none,
  },
  {
    label: '接口返回可核验信源元数据',
    value: WritingModelCitationCapability.providerSources,
  },
];
export const writingModelPurposeOptions: NumericOption[] = [
  { label: '文章提纲', value: WritingModelPurpose.outline },
  { label: '文章正文', value: WritingModelPurpose.article },
  { label: '内容改写', value: WritingModelPurpose.rewrite },
  { label: '内容摘要', value: WritingModelPurpose.summary },
  { label: '问题蒸馏', value: WritingModelPurpose.questionExtraction },
  { label: '售前诊断', value: WritingModelPurpose.salesDiagnosis },
  { label: '情感分析', value: WritingModelPurpose.sentimentAnalysis },
  { label: '情感倾向分析', value: WritingModelPurpose.sentimentTendencyAnalysis },
  { label: '竞品分析', value: WritingModelPurpose.competitorAnalysis },
  { label: '舆情总结', value: WritingModelPurpose.opinionSummary },
];
export const safetyCategoryOptions: NumericOption[] = [
  { label: '违法违规', value: SafetyCategory.illegal },
  { label: '暴力内容', value: SafetyCategory.violence },
  { label: '色情内容', value: SafetyCategory.adult },
  { label: '仇恨歧视', value: SafetyCategory.hate },
  { label: '自伤风险', value: SafetyCategory.selfHarm },
  { label: '个人敏感信息', value: SafetyCategory.personalData },
];
export const priceCurrencyOptions: NumericOption[] = [
  { label: '人民币 CNY', value: PriceCurrency.cny },
  { label: '美元 USD', value: PriceCurrency.usd },
];
export const writingModelAccessOptions: NumericOption[] = [
  { label: '全部正常企业可用', value: WritingModelAccess.all },
  { label: '仅指定套餐或企业可用', value: WritingModelAccess.restricted },
];
export const visibilityOptions: NumericOption[] = [
  { label: '可见', value: 1 },
  { label: '隐藏', value: 2 },
];

export const enterpriseStatusOptions: ApiNumericOption[] = [
  { label: '正常', value: 1, apiValue: 'active' },
  { label: '已暂停', value: 2, apiValue: 'suspended' },
  { label: '已到期', value: 3, apiValue: 'expired' },
];
export const adminUserStatusOptions: ApiNumericOption[] = [
  { label: '启用', value: 1, apiValue: 'active' },
  { label: '停用', value: 2, apiValue: 'suspended' },
];
export const authorizationStatusOptions: ApiNumericOption[] = [
  { label: '授权有效', value: 1, apiValue: 'active' },
  { label: '授权过期', value: 2, apiValue: 'expired' },
  { label: '已撤销', value: 3, apiValue: 'revoked' },
];
export const authorizationUsageOptions: ApiNumericOption[] = [
  { label: '使用中', value: 1, apiValue: 'enabled' },
  { label: '已暂停', value: 2, apiValue: 'paused' },
  { label: '已禁用', value: 3, apiValue: 'disabled' },
];
export const auditResultOptions: ApiNumericOption[] = [
  { label: '成功', value: 1, apiValue: 'success' },
  { label: '失败', value: 2, apiValue: 'failure' },
];
export const articleSourceOptions: ApiNumericOption[] = [
  { label: '人工', value: 1, apiValue: 'manual' },
  { label: 'AI 生成', value: 2, apiValue: 'ai' },
  { label: '导入', value: 3, apiValue: 'import' },
];
export const articleWorkflowStatusOptions: ApiNumericOption[] = [
  { label: '草稿', value: 0, apiValue: 'draft' },
  { label: '待审核', value: 1, apiValue: 'pending_review' },
  { label: '正常', value: 2, apiValue: 'normal' },
  { label: '禁用', value: 3, apiValue: 'disabled' },
  { label: '已发布', value: 4, apiValue: 'published' },
  { label: '已归档', value: 5, apiValue: 'archived' },
];
export const articleReviewActionOptions: ApiNumericOption[] = [
  { label: '通过', value: 1, apiValue: 'approve' },
  { label: '禁用', value: 2, apiValue: 'disable' },
  { label: '重新审核', value: 3, apiValue: 'review' },
];
export const workerStatusOptions: ApiNumericOption[] = [
  { label: '运行中', value: 1, apiValue: 'active' },
  { label: '已停用', value: 2, apiValue: 'suspended' },
  { label: '已吊销', value: 3, apiValue: 'revoked' },
];
export const workerApprovalOptions: ApiNumericOption[] = [
  { label: '待审批', value: 1, apiValue: 'pending' },
  { label: '已批准', value: 2, apiValue: 'approved' },
  { label: '已吊销', value: 3, apiValue: 'revoked' },
];
export const workerActionOptions: ApiNumericOption[] = [
  { label: '批准并启用', value: 1, apiValue: 'approve' },
  { label: '启用', value: 2, apiValue: 'activate' },
  { label: '停用', value: 3, apiValue: 'suspend' },
  { label: '永久吊销', value: 4, apiValue: 'revoke' },
];
export const taskStatusOptions: ApiNumericOption[] = [
  { label: '排队中', value: 1, apiValue: 'queued' },
  { label: '执行中', value: 2, apiValue: 'running' },
  { label: '等待重试', value: 3, apiValue: 'retry_wait' },
  { label: '成功', value: 4, apiValue: 'succeeded' },
  { label: '失败', value: 5, apiValue: 'failed' },
  { label: '已取消', value: 6, apiValue: 'cancelled' },
];
export const alertSeverityOptions: ApiNumericOption[] = [
  { label: '严重', value: 1, apiValue: 'critical' },
  { label: '高', value: 2, apiValue: 'high' },
  { label: '中', value: 3, apiValue: 'medium' },
  { label: '低', value: 4, apiValue: 'low' },
];
export const alertStatusOptions: ApiNumericOption[] = [
  { label: '待处理', value: 1, apiValue: 'open' },
  { label: '已解决', value: 2, apiValue: 'resolved' },
];
export const quotaMetricApiOptions: ApiNumericOption[] = [
  {
    label: '词条数',
    value: PlanMetric.articleGenerations,
    apiValue: 'article_generations',
  },
  {
    label: '发布篇数',
    value: PlanMetric.publishTasks,
    apiValue: 'publish_tasks',
  },
  {
    label: 'AI蒸馏使用次数',
    value: PlanMetric.aiDistills,
    apiValue: 'ai_distills',
  },
  {
    label: '品牌关键词',
    value: PlanMetric.brandKeywords,
    apiValue: 'brand_keywords',
  },
  {
    label: '产品关键词',
    value: PlanMetric.customKeywords,
    apiValue: 'custom_keywords',
  },
];
export const quotaPeriodApiOptions: ApiNumericOption[] = [
  { label: '每月', value: QuotaPeriod.monthly, apiValue: 'monthly' },
  { label: '每年', value: QuotaPeriod.yearly, apiValue: 'yearly' },
  { label: '永久', value: QuotaPeriod.lifetime, apiValue: 'lifetime' },
];

export const orderTypeOptions: StringOption[] = [
  { label: '开通套餐', value: 'plan' },
  { label: '续费', value: 'renew' },
  { label: '加购额度', value: 'addon' },
  { label: '充值点数', value: 'credits' },
  { label: '退款', value: 'refund' },
];
export const orderStatusOptions: StringOption[] = [
  { label: '待确认', value: 'pending' },
  { label: '已支付', value: 'paid' },
  { label: '已确认', value: 'approved' },
  { label: '已取消', value: 'cancelled' },
  { label: '已退款', value: 'refunded' },
];
export const orderSourceOptions: StringOption[] = [
  { label: '企业自购', value: 'enterprise_self' },
  { label: '管理员开通', value: 'admin_grant' },
  { label: '管理员编辑', value: 'admin_edit' },
];
export const orderCycleOptions: StringOption[] = [
  { label: '半年付', value: 'half_yearly' },
  { label: '年付', value: 'yearly' },
];
export const chargeTypeOptions: StringOption[] = [
  { label: '双扣（额度+点数）', value: 'both' },
  { label: '只扣额度', value: 'quota_only' },
  { label: '只扣点数', value: 'points_only' },
  { label: '开放模式（不扣额度也不扣点数）', value: 'open' },
];
export const orderStatusTagColor: Record<string, string> = {
  pending: 'orange',
  paid: 'blue',
  approved: 'green',
  cancelled: 'default',
  refunded: 'red',
};

export function optionLabel(options: NumericOption[], value?: number) {
  return options.find((option) => option.value === value)?.label ?? '-';
}

export function optionValueEnum(options: NumericOption[]) {
  return Object.fromEntries(
    options.map((option) => [option.value, { text: option.label }]),
  );
}

export function apiOptionValue(options: ApiNumericOption[], value?: number) {
  return options.find((option) => option.value === value)?.apiValue;
}

export function apiOptionLabel(options: ApiNumericOption[], apiValue?: string) {
  return (
    options.find((option) => option.apiValue === apiValue)?.label ??
    apiValue ??
    '-'
  );
}

export function stringOptionValueEnum(options: StringOption[]) {
  return Object.fromEntries(
    options.map((option) => [option.value, { text: option.label }]),
  );
}

export function stringOptionLabel(options: StringOption[], value?: string) {
  return (
    options.find((option) => option.value === value)?.label ?? value ?? '-'
  );
}
