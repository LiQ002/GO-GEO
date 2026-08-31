import {
  Alert,
  Card,
  Col,
  Collapse,
  Descriptions,
  Divider,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  SalesDiagnosisReportFindingType,
  salesDiagnosisEvidenceTypeLabel,
} from '@/utils/sales-diagnosis-enums';
import {
  diagnosisBrandHighlightTerms,
  HighlightedAnswer,
} from './answer-highlight';
import { DiagnosisReportChart } from './report-charts';
import {
  diagnosisLevelLabel,
  diagnosisPriorityLabel,
  diagnosisSourceTypeLabel,
  diagnosisThreatLevelLabels,
  isOverallDiagnosisDimension,
} from './report-data';
import './report.less';

type DiagnosisReportViewProps = {
  diagnosis: API.SalesDiagnosis;
  action?: ReactNode;
};

const percent = (value?: number) => `${((value ?? 0) * 100).toFixed(1)}%`;
const formatTime = (value?: string) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
const position = (available?: boolean, value?: number) =>
  available && value
    ? `平均第 ${Number(value).toFixed(1)} 位`
    : '未形成明确推荐位次';
const threatColor = (value?: number) =>
  ({ 1: 'green', 2: 'gold', 3: 'orange', 4: 'red' })[Number(value)] ??
  'default';
const priorityColor = (value?: number) =>
  ({ 0: 'red', 1: 'orange', 2: 'gold', 3: 'blue' })[Number(value)] ?? 'default';
const effectiveThreatLevel = (item: API.SalesDiagnosisReportEntity) => {
  if (item.threatLevel) return item.threatLevel;
  const rate = item.mentionRate ?? 0;
  if (rate >= 0.75) return 4;
  if (rate >= 0.5) return 3;
  if (rate >= 0.25) return 2;
  return 1;
};

const defaultOptimizationFindings: API.SalesDiagnosisReportFinding[] = [
  {
    title: '知识库重构与内容焕新',
    content:
      '优先沉淀统一、可验证的品牌事实与产品知识，持续补充具备时效性的结构化内容，解决 AI 信息不完整和信息滞后问题。',
    priority: 0,
  },
  {
    title: '补齐平台短板，强化高权重信源供给',
    content:
      '针对表现偏弱的平台和查询场景，增加可抓取、可引用、结构清晰的内容供给，提升平台间收录与推荐表现的一致性。',
    priority: 1,
  },
  {
    title: '差异化内容矩阵与竞品防御',
    content:
      '围绕品牌优势、核心场景和竞品共现问题建设差异化内容矩阵，使 AI 在对比和推荐回答中获得更充分的本品牌证据。',
    priority: 1,
  },
  {
    title: '常态化监测与策略迭代',
    content:
      '持续复用同一组核心问题监测收录、推荐位次、情感、竞品共现与信源变化，通过数据看板推动策略迭代并沉淀客户自有内容资产。',
    priority: 2,
  },
];

function ReportSection({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="sales-diagnosis-report-section">
      <Typography.Title
        level={3}
        className="sales-diagnosis-report-section-title"
      >
        <span>{index}</span>
        {title}
      </Typography.Title>
      {children}
    </section>
  );
}

export function DiagnosisReportView({
  diagnosis,
  action,
}: DiagnosisReportViewProps) {
  const report = diagnosis.report;
  const overallMetrics = useMemo(
    () =>
      new Map(
        (diagnosis.metrics ?? [])
          .filter((item) => isOverallDiagnosisDimension(item.diagnosisModelId))
          .map((item) => [item.metricCode, item]),
      ),
    [diagnosis.metrics],
  );
  const competitors = useMemo(
    () =>
      (report?.entities ?? []).filter(
        (item) =>
          isOverallDiagnosisDimension(item.diagnosisModelId) &&
          (item.entityType === 2 || item.entityType === 3),
      ),
    [report?.entities],
  );
  const competitorChartData = useMemo(
    () =>
      competitors.slice(0, 10).map((item) => ({
        label: item.entityName ?? '未知品牌',
        value: item.mentionRate ?? 0,
      })),
    [competitors],
  );
  const sourceTypeChartData = useMemo(() => {
    const totals = new Map<number, number>();
    for (const source of report?.sources ?? []) {
      if (!isOverallDiagnosisDimension(source.diagnosisModelId)) continue;
      const sourceType = Number(source.sourceType ?? 1);
      totals.set(
        sourceType,
        (totals.get(sourceType) ?? 0) + (source.shareRate ?? 0),
      );
    }
    return [...totals.entries()].map(([sourceType, value]) => ({
      label: diagnosisSourceTypeLabel(sourceType),
      value,
    }));
  }, [report?.sources]);
  const sourceOwnershipChartData = useMemo(() => {
    const labels: Record<number, string> = {
      1: '第三方 / 未知',
      2: '目标品牌官网',
      3: '已配置竞品官网',
    };
    const totals = new Map<number, number>();
    for (const source of report?.sources ?? []) {
      if (!isOverallDiagnosisDimension(source.diagnosisModelId)) continue;
      const type = source.ownershipType ?? 1;
      totals.set(type, (totals.get(type) ?? 0) + (source.shareRate ?? 0));
    }
    return [...totals.entries()].map(([type, value]) => ({
      label: labels[type] ?? '未知',
      value,
    }));
  }, [report?.sources]);
  const sentimentChartData = useMemo(
    () =>
      [
        {
          label: '正向',
          metric: overallMetrics.get('positive_sentiment_rate'),
        },
        {
          label: '中性',
          metric: overallMetrics.get('neutral_sentiment_rate'),
        },
        {
          label: '负向',
          metric: overallMetrics.get('negative_sentiment_rate'),
        },
      ]
        .filter((item) => item.metric?.availabilityStatus !== 2)
        .map((item) => ({
          label: item.label,
          value: item.metric?.value ?? 0,
        })),
    [overallMetrics],
  );
  const resultById = useMemo(() => {
    const items = new Map<string, API.SalesDiagnosisResult>();
    for (const task of diagnosis.tasks ?? []) {
      for (const result of task.results ?? []) {
        if (result.id) items.set(String(result.id), result);
      }
    }
    return items;
  }, [diagnosis.tasks]);

  if (!report) return null;

  const findings = report.findings ?? [];
  const isV4Report = (report.templateVersion ?? 0) >= 4;
  const coreFindings = findings
    .filter(
      (item) =>
        item.sectionCode !== 'optimization' &&
        item.type !== SalesDiagnosisReportFindingType.recommendation,
    )
    .slice(0, 5);
  const gapFindings = findings.filter(
    (item) =>
      item.sectionCode === 'internal_gap' ||
      item.sectionCode === 'external_gap' ||
      (!item.sectionCode &&
        item.type !== SalesDiagnosisReportFindingType.recommendation),
  );
  const generatedOptimizationFindings = findings.filter(
    (item) => item.sectionCode === 'optimization',
  );
  const optimizationFindings = generatedOptimizationFindings.length
    ? generatedOptimizationFindings
    : defaultOptimizationFindings;
  const summaryFindings = findings.filter(
    (item) => item.sectionCode === 'summary',
  );
  const coveredPlatforms = (report.models ?? [])
    .map((item) => item.modelName)
    .filter(Boolean)
    .join('、');
  const overallSources = (report.sources ?? []).filter((item) =>
    isOverallDiagnosisDimension(item.diagnosisModelId),
  );
  const brandHighlightTerms = diagnosisBrandHighlightTerms(diagnosis);

  return (
    <Card
      className="sales-diagnosis-report"
      title={report.title ?? 'GEO 售前诊断报告'}
      extra={
        <Space wrap className="sales-diagnosis-report-meta">
          <Typography.Text type="secondary">
            {report.templateCode} v{report.templateVersion ?? 1} · 报告版本{' '}
            {report.version ?? 1}
          </Typography.Text>
          {action && (
            <span className="sales-diagnosis-report-action">{action}</span>
          )}
        </Space>
      }
    >
      <div className="sales-diagnosis-report-cover">
        <Typography.Title level={1}>GEO 售前诊断报告</Typography.Title>
        <Typography.Title level={4}>
          {diagnosis.profile?.brandName ||
            diagnosis.profile?.customerName ||
            '-'}
        </Typography.Title>
        <Descriptions bordered size="small" column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="客户名称">
            {diagnosis.profile?.customerName || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="诊断对象">
            {diagnosis.profile?.brandName || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="行业 / 地区">
            {[diagnosis.profile?.industry, diagnosis.profile?.region]
              .filter(Boolean)
              .join(' / ') || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="报告日期">
            {formatTime(report.generatedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="覆盖平台" span={2}>
            {coveredPlatforms || '-'}
          </Descriptions.Item>
        </Descriptions>
      </div>

      <Space
        direction="vertical"
        size={32}
        style={{ width: '100%' }}
        className="sales-diagnosis-report-content"
      >
        {!isV4Report && (
          <Alert
            type="warning"
            showIcon
            message="历史报告兼容模式"
            description="该记录由旧版模板生成，页面已按 V4 结构兼容展示；信息完整度、回答质量、时效性和推荐理由等新增字段需要重新发起一次诊断后才会产生可追溯数据。"
          />
        )}
        <section className="sales-diagnosis-report-summary">
          <Typography.Title level={3}>执行摘要</Typography.Title>
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
            {report.executiveSummary || '-'}
          </Typography.Paragraph>
          <Alert
            type="info"
            showIcon
            message="综合结论"
            description={report.overallConclusion || '-'}
          />
          {coreFindings.length > 0 && (
            <div className="sales-diagnosis-core-findings">
              <Typography.Title level={5}>核心发现</Typography.Title>
              <ol>
                {coreFindings.map((finding) => (
                  <li key={finding.id ?? finding.title}>
                    <Typography.Text strong>{finding.title}：</Typography.Text>
                    {finding.content}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <ReportSection index="一" title="收录现状分析">
          <Row gutter={[16, 16]} className="sales-diagnosis-report-kpis">
            {[
              ['综合提及率', 'brand_mention_rate'],
              ['品牌声量占比', 'brand_share_of_voice'],
              ['TOP3 占比', 'top3_rate'],
              ['可核验引用率', 'citation_rate'],
            ].map(([label, code]) => {
              const metric = overallMetrics.get(code);
              const unavailable = metric?.availabilityStatus === 2;
              return (
                <Col xs={12} lg={6} key={code}>
                  <Card size="small">
                    <Statistic
                      title={label}
                      value={
                        unavailable ? '不可用' : (metric?.value ?? 0) * 100
                      }
                      precision={unavailable ? undefined : 1}
                      suffix={unavailable ? undefined : '%'}
                    />
                  </Card>
                </Col>
              );
            })}
          </Row>

          <Table<API.SalesDiagnosisReportModel>
            className="sales-diagnosis-report-table"
            rowKey={(item) => item.id ?? item.diagnosisModelId ?? ''}
            pagination={false}
            scroll={{ x: 1100 }}
            dataSource={report.models ?? []}
            columns={[
              {
                title: '平台',
                dataIndex: 'modelName',
                fixed: 'left',
                width: 150,
              },
              {
                title: '是否收录',
                dataIndex: 'inclusionRate',
                width: 100,
                render: (_, item) => (
                  <Tag
                    color={
                      ((isV4Report
                        ? item.inclusionRate
                        : item.brandMentionRate) ?? 0) > 0
                        ? 'success'
                        : 'default'
                    }
                  >
                    {((isV4Report
                      ? item.inclusionRate
                      : item.brandMentionRate) ?? 0) > 0
                      ? '已收录'
                      : '未收录'}
                  </Tag>
                ),
              },
              {
                title: '收录率',
                dataIndex: 'inclusionRate',
                width: 90,
                render: (_, item) =>
                  percent(
                    isV4Report ? item.inclusionRate : item.brandMentionRate,
                  ),
              },
              {
                title: '信息完整度',
                dataIndex: 'completenessScore',
                width: 110,
                render: (value) => (isV4Report ? percent(value) : '待重新诊断'),
              },
              {
                title: '回答质量',
                dataIndex: 'answerQualityScore',
                width: 100,
                render: (value) => (isV4Report ? percent(value) : '待重新诊断'),
              },
              {
                title: '推荐位置',
                width: 150,
                render: (_, item) =>
                  isV4Report
                    ? position(
                        item.recommendationPositionAvailable,
                        item.averageRecommendationPosition,
                      )
                    : '待重新诊断',
              },
              {
                title: '内容时效性',
                width: 120,
                render: (_, item) =>
                  !isV4Report
                    ? '待重新诊断'
                    : item.timelinessAvailable
                      ? percent(item.timelinessRate)
                      : '暂无时效证据',
              },
              {
                title: '综合评级',
                dataIndex: 'overallRating',
                width: 100,
                render: (value) => (
                  <Tag
                    color={
                      value === '优秀'
                        ? 'green'
                        : value === '良好'
                          ? 'blue'
                          : value === '一般'
                            ? 'gold'
                            : 'orange'
                    }
                  >
                    {isV4Report ? value || '待提升' : '待重新诊断'}
                  </Tag>
                ),
              },
              {
                title: '有效样本',
                width: 100,
                render: (_, item) =>
                  `${item.succeededCount ?? 0}/${item.sampleCount ?? 0}`,
              },
            ]}
          />

          <Collapse
            className="sales-diagnosis-platform-analysis"
            items={(report.models ?? []).map((model) => {
              const modelSources = (report.sources ?? []).filter(
                (item) =>
                  Number(item.diagnosisModelId) ===
                  Number(model.diagnosisModelId),
              );
              const answers = (report.questions ?? []).flatMap((question) =>
                (question.answers ?? [])
                  .filter(
                    (answer) =>
                      Number(answer.diagnosisModelId) ===
                      Number(model.diagnosisModelId),
                  )
                  .map((answer) => ({
                    ...answer,
                    question: question.question,
                  })),
              );
              return {
                key: model.id ?? model.diagnosisModelId,
                forceRender: true,
                label: `${
                  model.modelName ?? '未知平台'
                }：优势、短板与真实回答证据`,
                children: (
                  <Space
                    direction="vertical"
                    size="middle"
                    style={{ width: '100%' }}
                  >
                    <Descriptions
                      bordered
                      size="small"
                      column={{ xs: 1, lg: 2 }}
                    >
                      <Descriptions.Item label="优势表现">
                        {model.strengths || '暂无明确优势证据'}
                      </Descriptions.Item>
                      <Descriptions.Item label="待优化点">
                        {model.gaps || '暂无明确短板证据'}
                      </Descriptions.Item>
                      <Descriptions.Item label="诊断结论" span={2}>
                        {model.diagnosisConclusion || model.summary || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="信源类型" span={2}>
                        {modelSources.length > 0 ? (
                          <Space wrap>
                            {[
                              ...new Set(
                                modelSources.map((source) =>
                                  diagnosisSourceTypeLabel(source.sourceType),
                                ),
                              ),
                            ].map((label) => (
                              <Tag key={label}>{label}</Tag>
                            ))}
                          </Space>
                        ) : (
                          '接口未返回可核验的结构化信源'
                        )}
                      </Descriptions.Item>
                    </Descriptions>
                    {answers.map((answer) => (
                      <Card
                        key={answer.id ?? answer.resultId}
                        size="small"
                        title={answer.question || '诊断问题'}
                        extra={
                          <Tag>
                            {salesDiagnosisEvidenceTypeLabel(
                              answer.evidenceType,
                            )}
                          </Tag>
                        }
                      >
                        <Typography.Paragraph
                          style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}
                        >
                          <HighlightedAnswer
                            content={
                              resultById.get(String(answer.resultId))?.answer ||
                              answer.answerExcerpt ||
                              '模型未返回正文'
                            }
                            terms={brandHighlightTerms}
                          />
                          {resultById.get(String(answer.resultId))?.analysis
                            ?.dominantSentiment === 4 && (
                            <Tag color="error" style={{ marginLeft: 8 }}>
                              疑似负面，请人工复核
                            </Tag>
                          )}
                        </Typography.Paragraph>
                      </Card>
                    ))}
                  </Space>
                ),
              };
            })}
          />

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card
                size="small"
                title="信源类型分布（AntV G2）"
                className="sales-diagnosis-report-chart"
              >
                <DiagnosisReportChart kind="donut" data={sourceTypeChartData} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card
                size="small"
                title="目标 / 竞品 / 第三方信源归属（AntV G2）"
                className="sales-diagnosis-report-chart"
              >
                <DiagnosisReportChart
                  kind="donut"
                  data={sourceOwnershipChartData}
                />
              </Card>
            </Col>
          </Row>
        </ReportSection>

        <ReportSection index="二" title="竞品推荐情况分析">
          <Row
            gutter={[16, 16]}
            className="sales-diagnosis-competitor-overview"
          >
            <Col xs={24} lg={14}>
              <Table<API.SalesDiagnosisReportEntity>
                className="sales-diagnosis-report-table sales-diagnosis-competitor-table"
                rowKey={(item) =>
                  item.id ?? `${item.entityType}-${item.entityName}`
                }
                pagination={false}
                dataSource={competitors}
                columns={[
                  { title: '竞品', dataIndex: 'entityName', width: 90 },
                  {
                    title: '层级',
                    dataIndex: 'competitorLevel',
                    width: 110,
                    render: (value, item) =>
                      value === 1 || (!value && item.entityType === 2)
                        ? '一级直接竞品'
                        : '二级间接竞品',
                  },
                  {
                    title: '地区',
                    dataIndex: 'location',
                    width: 70,
                    render: (value) => value || '未采集',
                  },
                  {
                    title: '推荐频率',
                    dataIndex: 'mentionRate',
                    width: 90,
                    render: percent,
                  },
                  {
                    title: '威胁',
                    dataIndex: 'threatLevel',
                    width: 70,
                    render: (_, item) => {
                      const value = effectiveThreatLevel(item);
                      return (
                        <Tag color={threatColor(value)}>
                          {diagnosisThreatLevelLabels[value]}
                        </Tag>
                      );
                    },
                  },
                  {
                    title: '推荐理由 / 回答证据',
                    dataIndex: 'recommendationReason',
                    className: 'sales-diagnosis-table-long-text',
                    ellipsis: true,
                  },
                ]}
              />
            </Col>
            <Col xs={24} lg={10}>
              <Card
                size="small"
                title="竞品推荐频率矩阵（AntV G2）"
                className="sales-diagnosis-report-chart"
              >
                <DiagnosisReportChart kind="bar" data={competitorChartData} />
              </Card>
            </Col>
          </Row>
          <Collapse
            items={(report.models ?? []).map((model) => ({
              key: `competitor-${model.diagnosisModelId}`,
              forceRender: true,
              label: `${model.modelName ?? '未知平台'}竞品明细`,
              children: (
                <Table<API.SalesDiagnosisReportEntity>
                  size="small"
                  rowKey={(item) => item.id ?? item.entityName ?? ''}
                  pagination={false}
                  dataSource={(report.entities ?? []).filter(
                    (item) =>
                      Number(item.diagnosisModelId) ===
                        Number(model.diagnosisModelId) &&
                      (item.entityType === 2 || item.entityType === 3),
                  )}
                  columns={[
                    { title: '竞品', dataIndex: 'entityName' },
                    {
                      title: '出现频率',
                      dataIndex: 'mentionRate',
                      render: percent,
                    },
                    {
                      title: '平均明确排名',
                      dataIndex: 'averageRank',
                      render: (value) =>
                        value ? `第 ${Number(value).toFixed(1)} 位` : '不可用',
                    },
                    {
                      title: '推荐理由 / 原文证据',
                      dataIndex: 'recommendationReason',
                    },
                    {
                      title: '证据编号',
                      render: (_, item) =>
                        (item.evidenceMentionIds ?? []).map((id) => (
                          <Tag key={id}>#{id}</Tag>
                        )),
                    },
                  ]}
                />
              ),
            }))}
          />
          <Card
            size="small"
            title="目标品牌情感倾向（AntV G2）"
            className="sales-diagnosis-report-chart"
          >
            <DiagnosisReportChart kind="donut" data={sentimentChartData} />
          </Card>
        </ReportSection>

        <ReportSection index="三" title="差距诊断（GEO 视角）">
          <Alert
            type="warning"
            showIcon
            message="诊断边界"
            description="本章节仅分析 AI 信息抓取、收录、推荐、竞品共现和信源供给差距，不延伸为客户内部经营诊断。"
            style={{ marginBottom: 16 }}
          />
          <Table<API.SalesDiagnosisReportFinding>
            className="sales-diagnosis-report-table"
            rowKey={(item) => item.id ?? item.title ?? ''}
            pagination={false}
            dataSource={gapFindings}
            columns={[
              {
                title: '类别',
                dataIndex: 'sectionCode',
                width: 110,
                render: (value) =>
                  value === 'external_gap' ? '外部差距' : '内部差距',
              },
              {
                title: '优先级',
                dataIndex: 'priority',
                width: 90,
                render: (value) => (
                  <Tag color={priorityColor(value)}>
                    {diagnosisPriorityLabel(value)}
                  </Tag>
                ),
              },
              { title: '问题', dataIndex: 'title', width: 190 },
              { title: '诊断依据与影响', dataIndex: 'content' },
              {
                title: '影响',
                dataIndex: 'impactLevel',
                width: 70,
                render: diagnosisLevelLabel,
              },
              {
                title: '紧迫',
                dataIndex: 'urgencyLevel',
                width: 70,
                render: diagnosisLevelLabel,
              },
            ]}
          />
        </ReportSection>

        <ReportSection index="四" title="优化建议（大方向）">
          <Typography.Paragraph>
            以下建议用于帮助客户理解改善方向；具体模块、实施范围与交付节奏将在正式优化方案中单独定义。
          </Typography.Paragraph>
          <Row
            gutter={[16, 16]}
            className="sales-diagnosis-optimization-screen-list"
          >
            {optimizationFindings.map((finding, index) => (
              <Col xs={24} lg={12} key={finding.id ?? finding.title}>
                <Card
                  className="sales-diagnosis-optimization-card"
                  title={`${index + 1}. ${finding.title}`}
                  extra={
                    <Tag color={priorityColor(finding.priority)}>
                      {diagnosisPriorityLabel(finding.priority)}
                    </Tag>
                  }
                >
                  <Typography.Paragraph style={{ marginBottom: 0 }}>
                    {finding.content}
                  </Typography.Paragraph>
                </Card>
              </Col>
            ))}
          </Row>
          <div className="sales-diagnosis-optimization-print-list">
            {optimizationFindings.map((finding, index) => (
              <article
                className="sales-diagnosis-optimization-print-item"
                key={finding.id ?? finding.title}
              >
                <header>
                  <h4>{`${index + 1}. ${finding.title}`}</h4>
                  <span data-priority={finding.priority ?? 3}>
                    {diagnosisPriorityLabel(finding.priority)}
                  </span>
                </header>
                <p>{finding.content}</p>
              </article>
            ))}
          </div>
        </ReportSection>

        <ReportSection index="五" title="总结与下一步">
          <Alert
            type="success"
            showIcon
            message="诊断总结"
            description={report.overallConclusion || '-'}
          />
          {summaryFindings.map((finding) => (
            <Alert
              key={finding.id ?? finding.title}
              type="warning"
              showIcon
              message={finding.title}
              description={finding.content}
              style={{ marginTop: 12 }}
            />
          ))}
          <Table
            className="sales-diagnosis-report-table sales-diagnosis-next-steps"
            style={{ marginTop: 16 }}
            rowKey="stage"
            pagination={false}
            dataSource={[
              {
                stage: '近期',
                action: '校准品牌、产品、场景与竞品知识基线',
                output: '统一、可核验的 GEO 知识底稿',
              },
              {
                stage: '短期',
                action: '补齐弱势平台所需的高权重结构化内容',
                output: '平台短板与信源供给清单',
              },
              {
                stage: '中期',
                action: '建设差异化内容矩阵并开展竞品共现监测',
                output: '主题矩阵与竞品防御方向',
              },
              {
                stage: '长期',
                action: '复用核心问题持续监测并推动策略迭代',
                output: '可对比的诊断历史与策略迭代记录',
              },
            ]}
            columns={[
              { title: '阶段', dataIndex: 'stage', width: 90 },
              { title: '建议动作', dataIndex: 'action' },
              { title: '预期输出', dataIndex: 'output' },
            ]}
          />
          <blockquote className="sales-diagnosis-report-bridge">
            本诊断报告用于定位问题与明确方向，不构成效果承诺。若进入后续合作阶段，将基于本报告另行形成正式
            GEO 优化方案。
          </blockquote>
        </ReportSection>

        <Divider>附录：方法与证据追溯</Divider>
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="诊断方法">
            {report.methodology || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="数据说明">
            {report.disclaimer || '-'}
          </Descriptions.Item>
        </Descriptions>
        <Collapse
          className="sales-diagnosis-report-appendix"
          items={[
            {
              key: 'question-evidence',
              label: '附录 A：诊断问题与真实回答摘录',
              forceRender: true,
              children: (
                <Collapse
                  items={(report.questions ?? []).map((question) => ({
                    key: question.id ?? question.questionId,
                    forceRender: true,
                    label: `${question.question ?? '诊断问题'}（${
                      question.successfulModelCount ?? 0
                    } 个有效回答）`,
                    children: (
                      <Space
                        direction="vertical"
                        size="middle"
                        style={{ width: '100%' }}
                      >
                        {(question.answers ?? []).map((answer) => (
                          <Card
                            key={answer.id ?? answer.resultId}
                            size="small"
                            title={answer.modelName ?? '未知模型'}
                            extra={
                              <Space wrap>
                                <Tag>
                                  {salesDiagnosisEvidenceTypeLabel(
                                    answer.evidenceType,
                                  )}
                                </Tag>
                                <Tag>结果 #{answer.resultId ?? '-'}</Tag>
                              </Space>
                            }
                          >
                            <Typography.Paragraph
                              style={{
                                whiteSpace: 'pre-wrap',
                                marginBottom: 0,
                              }}
                            >
                              <HighlightedAnswer
                                content={
                                  resultById.get(String(answer.resultId))
                                    ?.answer ||
                                  answer.answerExcerpt ||
                                  '模型未返回正文'
                                }
                                terms={brandHighlightTerms}
                              />
                              {resultById.get(String(answer.resultId))?.analysis
                                ?.dominantSentiment === 4 && (
                                <Tag color="error" style={{ marginLeft: 8 }}>
                                  疑似负面，请人工复核
                                </Tag>
                              )}
                            </Typography.Paragraph>
                          </Card>
                        ))}
                      </Space>
                    ),
                  }))}
                />
              ),
            },
            {
              key: 'entity-evidence',
              label: '附录 B：品牌与竞品实体证据',
              forceRender: true,
              children: (
                <Table<API.SalesDiagnosisReportEntity>
                  size="small"
                  rowKey={(item) =>
                    item.id ?? `${item.entityType}-${item.entityName}`
                  }
                  pagination={false}
                  dataSource={(report.entities ?? []).filter((item) =>
                    isOverallDiagnosisDimension(item.diagnosisModelId),
                  )}
                  columns={[
                    { title: '实体', dataIndex: 'entityName' },
                    { title: '提及次数', dataIndex: 'mentionCount' },
                    {
                      title: '提及率',
                      dataIndex: 'mentionRate',
                      render: percent,
                    },
                    {
                      title: '平均明确排名',
                      dataIndex: 'averageRank',
                      render: (value) =>
                        value ? Number(value).toFixed(2) : '不可用',
                    },
                    {
                      title: '情感（正/中/负）',
                      render: (_, item) =>
                        `${item.positiveCount ?? 0}/${item.neutralCount ?? 0}/${
                          item.negativeCount ?? 0
                        }`,
                    },
                    {
                      title: '实体证据编号',
                      render: (_, item) =>
                        (item.evidenceMentionIds ?? []).map((id) => (
                          <Tag key={id}>#{id}</Tag>
                        )),
                    },
                  ]}
                />
              ),
            },
            {
              key: 'source-evidence',
              label: '附录 C：真实信源与引用证据',
              forceRender: true,
              children: (
                <Table<API.SalesDiagnosisReportSource>
                  size="small"
                  rowKey={(item) => item.id ?? item.domain ?? ''}
                  pagination={false}
                  dataSource={overallSources}
                  columns={[
                    {
                      title: '信源类型',
                      dataIndex: 'sourceType',
                      render: diagnosisSourceTypeLabel,
                    },
                    {
                      title: '来源平台',
                      render: (_, item) =>
                        item.sourceName || item.domain || '-',
                    },
                    { title: '域名', dataIndex: 'domain' },
                    { title: '引用次数', dataIndex: 'citationCount' },
                    {
                      title: '信源占比',
                      dataIndex: 'shareRate',
                      render: percent,
                    },
                    {
                      title: '引用证据编号',
                      render: (_, item) =>
                        (item.citationIds ?? []).map((id) => (
                          <Tag key={id}>#{id}</Tag>
                        )),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </Space>
    </Card>
  );
}
