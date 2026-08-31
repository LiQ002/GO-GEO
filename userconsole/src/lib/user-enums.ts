export type NumericOption = { label: string; value: number | string };

export const BrandStatus = { active: 1, archived: 2 } as const;
export const KnowledgeBaseStatus = { active: 1, archived: 2 } as const;
export const KnowledgeSourceType = { text: 1, url: 2, file: 3 } as const;
export const KnowledgeParseStatus = {
  pending: 1,
  parsing: 2,
  parsed: 3,
  failed: 4,
} as const;
export const KnowledgeCategory = {
  enterpriseProfile: 1,
  brandPositioning: 2,
  productOverview: 3,
  productAdvantages: 4,
  targetAudience: 5,
  useCases: 6,
  customerCases: 7,
  factsCredentials: 8,
  faq: 9,
  industryInsights: 10,
  brandVoice: 11,
  compliance: 12,
} as const;
export const QuestionStatus = { pending: 1, approved: 2, rejected: 3 } as const;
export const QuestionIntent = {
  education: 1,
  research: 2,
  comparison: 3,
  purchase: 4,
} as const;
export const QuestionFunnel = {
  awareness: 1,
  consideration: 2,
  decision: 3,
} as const;
export const KeywordDistillationStatus = {
  pending: 1,
  running: 2,
  completed: 3,
  failed: 4,
} as const;
export const PublishPlanStatus = {
  pending: 1,
  active: 2,
  paused: 3,
  stopped: 4,
  cancelled: 5,
  completed: 6,
} as const;
export const PublishScheduleType = { immediate: 1, scheduled: 2 } as const;
export const MonitorPlanStatus = { active: 1, paused: 2, stopped: 3 } as const;
export const MonitorScheduleType = {
  once: 1,
  manual: 2,
  hourly: 3,
  daily: 4,
  weekly: 5,
  monthly: 6,
  cron: 7,
} as const;
export const MonitorTerminalType = {
  pc: 1,
  mobile: 2,
  parallel: 3,
} as const;
export const AuthorizationResourceType = {
  publishChannel: 1,
  inclusionSite: 2,
} as const;
export const AuthorizationStatus = {
  pending: 1,
  authorizing: 2,
  active: 3,
  expired: 4,
  revoked: 5,
  failed: 6,
} as const;
export const AuthorizationUsageStatus = {
  enabled: 1,
  paused: 2,
  disabled: 3,
} as const;

export const brandStatusOptions: NumericOption[] = [
  { label: "正常", value: BrandStatus.active },
  { label: "已归档", value: BrandStatus.archived },
];

export const knowledgeSourceOptions: NumericOption[] = [
  { label: "文本", value: KnowledgeSourceType.text },
  { label: "网址", value: KnowledgeSourceType.url },
];

export const knowledgeCategoryOptions: NumericOption[] = [
  { label: "企业介绍", value: KnowledgeCategory.enterpriseProfile },
  { label: "品牌定位", value: KnowledgeCategory.brandPositioning },
  { label: "产品介绍", value: KnowledgeCategory.productOverview },
  { label: "产品优势", value: KnowledgeCategory.productAdvantages },
  { label: "目标客户", value: KnowledgeCategory.targetAudience },
  { label: "应用场景与解决方案", value: KnowledgeCategory.useCases },
  { label: "客户案例", value: KnowledgeCategory.customerCases },
  { label: "事实数据与资质", value: KnowledgeCategory.factsCredentials },
  { label: "常见问题", value: KnowledgeCategory.faq },
  { label: "行业知识与观点", value: KnowledgeCategory.industryInsights },
  { label: "品牌语气与内容规范", value: KnowledgeCategory.brandVoice },
  { label: "合规边界", value: KnowledgeCategory.compliance },
];

export const questionIntentOptions: NumericOption[] = [
  { label: "知识学习", value: QuestionIntent.education },
  { label: "信息调研", value: QuestionIntent.research },
  { label: "方案对比", value: QuestionIntent.comparison },
  { label: "购买决策", value: QuestionIntent.purchase },
];

export const questionFunnelOptions: NumericOption[] = [
  { label: "认知阶段", value: QuestionFunnel.awareness },
  { label: "考虑阶段", value: QuestionFunnel.consideration },
  { label: "决策阶段", value: QuestionFunnel.decision },
];

export const questionStatusOptions: NumericOption[] = [
  { label: "待审核", value: QuestionStatus.pending },
  { label: "已通过", value: QuestionStatus.approved },
  { label: "已驳回", value: QuestionStatus.rejected },
];

export const keywordDistillationStatusOptions: NumericOption[] = [
  { label: "未蒸馏", value: KeywordDistillationStatus.pending },
  { label: "蒸馏中", value: KeywordDistillationStatus.running },
  { label: "已完成", value: KeywordDistillationStatus.completed },
  { label: "蒸馏失败", value: KeywordDistillationStatus.failed },
];

export const publishPlanStatusOptions: NumericOption[] = [
  { label: "待执行", value: PublishPlanStatus.pending },
  { label: "执行中", value: PublishPlanStatus.active },
  { label: "已完成", value: PublishPlanStatus.completed },
  { label: "已暂停", value: PublishPlanStatus.paused },
  { label: "已停止", value: PublishPlanStatus.stopped },
];

export const monitorScheduleOptions: NumericOption[] = [
  { label: "仅执行一次", value: MonitorScheduleType.once },
  { label: "手动执行", value: MonitorScheduleType.manual },
  { label: "每小时", value: MonitorScheduleType.hourly },
  { label: "每天", value: MonitorScheduleType.daily },
  { label: "每周", value: MonitorScheduleType.weekly },
  { label: "每月", value: MonitorScheduleType.monthly },
  { label: "自定义 Cron", value: MonitorScheduleType.cron },
];

export const monitorTerminalOptions: NumericOption[] = [
  { label: "电脑端", value: MonitorTerminalType.pc },
  { label: "移动端", value: MonitorTerminalType.mobile },
  { label: "PC + 移动端 (并行)", value: MonitorTerminalType.parallel },
];

export const monitorPlanStatusOptions: NumericOption[] = [
  { label: "正常", value: MonitorPlanStatus.active },
  { label: "已暂停", value: MonitorPlanStatus.paused },
  { label: "已停止", value: MonitorPlanStatus.stopped },
];

const labels = new Map<number, string>([
  [BrandStatus.active, "正常"],
  [BrandStatus.archived, "已归档"],
]);

export function optionLabel(options: NumericOption[], value?: number) {
  return options.find((option) => option.value === value)?.label ?? "-";
}

export function brandStatusLabel(value?: number) {
  return labels.get(value ?? 0) ?? "-";
}

export function knowledgeParseStatusLabel(value?: number) {
  return (
    {
      [KnowledgeParseStatus.pending]: "待解析",
      [KnowledgeParseStatus.parsing]: "解析中",
      [KnowledgeParseStatus.parsed]: "可用",
      [KnowledgeParseStatus.failed]: "解析失败",
    }[value ?? 0] ?? "-"
  );
}

export function knowledgeCategoryLabel(value?: number) {
  return optionLabel(knowledgeCategoryOptions, value);
}

export function authorizationStatusLabel(
  authorization?: number,
  usage?: number,
) {
  if (authorization === AuthorizationStatus.revoked) return "已撤销";
  if (authorization === AuthorizationStatus.expired) return "已过期";
  if (authorization === AuthorizationStatus.failed) return "授权失败";
  if (authorization === AuthorizationStatus.pending) return "待授权";
  if (authorization === AuthorizationStatus.authorizing) return "授权中";
  if (usage === AuthorizationUsageStatus.paused) return "已暂停";
  if (usage === AuthorizationUsageStatus.disabled) return "已停用";
  return authorization === AuthorizationStatus.active ? "正常" : "-";
}
