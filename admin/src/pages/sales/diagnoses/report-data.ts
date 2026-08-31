export const isOverallDiagnosisDimension = (
  diagnosisModelId?: string | number,
) =>
  diagnosisModelId == null ||
  diagnosisModelId === '' ||
  Number(diagnosisModelId) === 0;

export const diagnosisSourceTypeLabels: Record<number, string> = {
  1: '其他高权重信源',
  2: '官方信息源',
  3: '百科类平台',
  4: '新闻资讯类平台',
  5: '行业垂类媒体',
  6: '开放平台 / UGC',
  7: '攻略游记类平台',
  8: 'OTA / 票务平台',
  9: '文库资料类平台',
};

export const diagnosisSourceTypeLabel = (value?: number) =>
  diagnosisSourceTypeLabels[Number(value)] ?? '其他高权重信源';

export const diagnosisThreatLevelLabels: Record<number, string> = {
  0: '不适用',
  1: '低',
  2: '中',
  3: '高',
  4: '极高',
};

export const diagnosisPriorityLabel = (value?: number) =>
  `P${Math.min(3, Math.max(0, Number(value ?? 3)))}`;

export const diagnosisLevelLabel = (value?: number) =>
  ({ 1: '低', 2: '中', 3: '高' }[Number(value)] ?? '待判断');
