export const SalesDiagnosisSubjectType = {
  opportunity: 1,
  enterprise: 2,
  quickBrand: 3,
} as const;

export const SalesDiagnosisStatus = {
  pending: 1,
  running: 2,
  succeeded: 3,
  partiallySucceeded: 4,
  failed: 5,
  cancelled: 6,
} as const;

export const SalesDiagnosisTaskStatus = {
  pending: 1,
  running: 2,
  succeeded: 3,
  failed: 4,
  cancelled: 5,
} as const;

export const SalesDiagnosisEvidenceType = {
  modelKnowledge: 1,
  providerSources: 2,
} as const;

export const SalesDiagnosisReportFindingType = {
  issue: 1,
  opportunity: 2,
  recommendation: 3,
} as const;

export const SalesDiagnosisReportSeverity = {
  info: 1,
  medium: 2,
  high: 3,
} as const;

export const salesDiagnosisSubjectTypeOptions = [
  { label: '销售机会', value: SalesDiagnosisSubjectType.opportunity },
  { label: '正式企业', value: SalesDiagnosisSubjectType.enterprise },
  { label: '快速品牌诊断', value: SalesDiagnosisSubjectType.quickBrand },
];

export const salesDiagnosisStatusOptions = [
  { label: '待执行', value: SalesDiagnosisStatus.pending },
  { label: '执行中', value: SalesDiagnosisStatus.running },
  { label: '已完成', value: SalesDiagnosisStatus.succeeded },
  { label: '部分成功', value: SalesDiagnosisStatus.partiallySucceeded },
  { label: '执行失败', value: SalesDiagnosisStatus.failed },
  { label: '已取消', value: SalesDiagnosisStatus.cancelled },
];

export const salesDiagnosisStatusColors: Record<number, string> = {
  [SalesDiagnosisStatus.pending]: 'default',
  [SalesDiagnosisStatus.running]: 'processing',
  [SalesDiagnosisStatus.succeeded]: 'success',
  [SalesDiagnosisStatus.partiallySucceeded]: 'warning',
  [SalesDiagnosisStatus.failed]: 'error',
  [SalesDiagnosisStatus.cancelled]: 'default',
};

export const salesDiagnosisTaskStatusOptions = [
  { label: '待执行', value: SalesDiagnosisTaskStatus.pending },
  { label: '执行中', value: SalesDiagnosisTaskStatus.running },
  { label: '成功', value: SalesDiagnosisTaskStatus.succeeded },
  { label: '失败', value: SalesDiagnosisTaskStatus.failed },
  { label: '已取消', value: SalesDiagnosisTaskStatus.cancelled },
];

export const salesDiagnosisTaskStatusColors: Record<number, string> = {
  [SalesDiagnosisTaskStatus.pending]: 'default',
  [SalesDiagnosisTaskStatus.running]: 'processing',
  [SalesDiagnosisTaskStatus.succeeded]: 'success',
  [SalesDiagnosisTaskStatus.failed]: 'error',
  [SalesDiagnosisTaskStatus.cancelled]: 'default',
};

export const salesDiagnosisEvidenceTypeOptions = [
  {
    label: '模型知识回答',
    value: SalesDiagnosisEvidenceType.modelKnowledge,
  },
  {
    label: '模型提供商来源',
    value: SalesDiagnosisEvidenceType.providerSources,
  },
];

export const salesDiagnosisReportFindingTypeOptions = [
  { label: '问题', value: SalesDiagnosisReportFindingType.issue },
  { label: '机会', value: SalesDiagnosisReportFindingType.opportunity },
  {
    label: '建议',
    value: SalesDiagnosisReportFindingType.recommendation,
  },
];

export const salesDiagnosisReportFindingTypeColors: Record<number, string> = {
  [SalesDiagnosisReportFindingType.issue]: 'error',
  [SalesDiagnosisReportFindingType.opportunity]: 'processing',
  [SalesDiagnosisReportFindingType.recommendation]: 'success',
};

export const salesDiagnosisReportSeverityOptions = [
  { label: '提示', value: SalesDiagnosisReportSeverity.info },
  { label: '中等', value: SalesDiagnosisReportSeverity.medium },
  { label: '高', value: SalesDiagnosisReportSeverity.high },
];

export const salesDiagnosisReportSeverityColors: Record<number, string> = {
  [SalesDiagnosisReportSeverity.info]: 'default',
  [SalesDiagnosisReportSeverity.medium]: 'warning',
  [SalesDiagnosisReportSeverity.high]: 'error',
};

const labelOf = (options: { label: string; value: number }[], value?: number) =>
  options.find((option) => option.value === value)?.label ?? '-';

export const salesDiagnosisSubjectTypeLabel = (value?: number) =>
  labelOf(salesDiagnosisSubjectTypeOptions, value);
export const salesDiagnosisStatusLabel = (value?: number) =>
  labelOf(salesDiagnosisStatusOptions, value);
export const salesDiagnosisTaskStatusLabel = (value?: number) =>
  labelOf(salesDiagnosisTaskStatusOptions, value);
export const salesDiagnosisEvidenceTypeLabel = (value?: number) =>
  labelOf(salesDiagnosisEvidenceTypeOptions, value);
export const salesDiagnosisReportFindingTypeLabel = (value?: number) =>
  labelOf(salesDiagnosisReportFindingTypeOptions, value);
export const salesDiagnosisReportSeverityLabel = (value?: number) =>
  labelOf(salesDiagnosisReportSeverityOptions, value);

export const salesDiagnosisStatusValueEnum = () =>
  Object.fromEntries(
    salesDiagnosisStatusOptions.map((option) => [
      option.value,
      {
        text: option.label,
        status: salesDiagnosisStatusColors[option.value],
      },
    ]),
  );
