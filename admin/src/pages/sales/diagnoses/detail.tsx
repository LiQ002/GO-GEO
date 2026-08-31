import {
  PlayCircleOutlined,
  PrinterOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  ModalForm,
  PageContainer,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { history, useAccess, useParams } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Empty,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  salesDiagnosisServiceCancelSalesDiagnosis,
  salesDiagnosisServiceGetSalesDiagnosis,
  salesDiagnosisServiceRetrySalesDiagnosisTask,
  salesDiagnosisServiceRunSalesDiagnosis,
} from '@/services/geo-admin/salesDiagnosisService';
import { writingModelProviderOptions } from '@/utils/platform-enums';
import {
  SalesDiagnosisStatus,
  SalesDiagnosisTaskStatus,
  salesDiagnosisEvidenceTypeLabel,
  salesDiagnosisStatusColors,
  salesDiagnosisStatusLabel,
  salesDiagnosisSubjectTypeLabel,
  salesDiagnosisTaskStatusColors,
  salesDiagnosisTaskStatusLabel,
} from '@/utils/sales-diagnosis-enums';
import {
  diagnosisBrandHighlightTerms,
  HighlightedAnswer,
} from './answer-highlight';
import { isOverallDiagnosisDimension } from './report-data';
import { DiagnosisReportView } from './report-view';

const metricLabels: Record<string, string> = {
  brand_mention_rate: '品牌提及率',
  brand_mention_count: '品牌提及次数',
  top3_rate: 'TOP3 占比',
  content_adoption_rate: '内容采纳率',
  citation_rate: '可核验引用率',
  brand_share_of_voice: '品牌声量占比',
  positive_sentiment_rate: '正向情感占比',
  neutral_sentiment_rate: '中性情感占比',
  negative_sentiment_rate: '负向情感占比',
};

const percent = (value?: number) => `${((value ?? 0) * 100).toFixed(1)}%`;
const formatTime = (value?: string) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';

const preparationStatusLabels: Record<number, string> = {
  1: '等待生成',
  2: '生成中',
  3: '生成成功',
  4: '生成失败',
  5: '使用人工问题',
  6: '已取消',
};
const preparationStatusColors: Record<number, string> = {
  1: 'default',
  2: 'processing',
  3: 'success',
  4: 'error',
  5: 'blue',
  6: 'default',
};
const brandTermTypeLabels: Record<number, string> = {
  1: '目标品牌',
  2: '品牌别名',
  3: '产品/服务',
  4: '所属品类',
  5: '竞品',
  6: '需求场景',
};

type ReasonForm = { reason?: string };

export default function SalesDiagnosisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const access = useAccess();
  const { message } = App.useApp();
  const [diagnosis, setDiagnosis] = useState<API.SalesDiagnosis>();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [retryTask, setRetryTask] = useState<API.SalesDiagnosisTask>();

  const load = useCallback(async () => {
    if (!id) return;
    const reply = await salesDiagnosisServiceGetSalesDiagnosis({ id });
    setDiagnosis(reply);
  }, [id]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (diagnosis?.status !== SalesDiagnosisStatus.running) return undefined;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [diagnosis?.status, load]);

  const questionMap = useMemo(
    () =>
      new Map(
        (diagnosis?.questions ?? []).map((item) => [item.id, item.question]),
      ),
    [diagnosis?.questions],
  );
  const modelMap = useMemo(
    () =>
      new Map(
        (diagnosis?.models ?? []).map((item) => [
          item.id,
          item.displayName ?? item.modelId,
        ]),
      ),
    [diagnosis?.models],
  );
  const claimMap = useMemo(
    () =>
      new Map(
        (diagnosis?.profile?.claims ?? []).map((item) => [
          item.id,
          item.claimText,
        ]),
      ),
    [diagnosis?.profile?.claims],
  );
  const overallMetrics = useMemo(
    () =>
      new Map(
        (diagnosis?.metrics ?? [])
          .filter((item) => isOverallDiagnosisDimension(item.diagnosisModelId))
          .map((item) => [item.metricCode, item]),
      ),
    [diagnosis?.metrics],
  );
  const brandHighlightTerms = useMemo(
    () => diagnosisBrandHighlightTerms(diagnosis),
    [diagnosis],
  );
  const completed =
    (diagnosis?.succeededTaskCount ?? 0) + (diagnosis?.failedTaskCount ?? 0);
  const canRun =
    access.canSalesDiagnosisManage &&
    (
      [
        SalesDiagnosisStatus.pending,
        SalesDiagnosisStatus.partiallySucceeded,
        SalesDiagnosisStatus.failed,
      ] as number[]
    ).includes(diagnosis?.status ?? 0);
  const canCancel =
    access.canSalesDiagnosisManage &&
    (
      [SalesDiagnosisStatus.pending, SalesDiagnosisStatus.running] as number[]
    ).includes(diagnosis?.status ?? 0);
  const runDisabledReason = !access.canSalesDiagnosisManage
    ? '当前账号没有执行售前诊断的权限'
    : diagnosis?.status === SalesDiagnosisStatus.running
      ? '诊断正在执行中'
      : diagnosis?.status === SalesDiagnosisStatus.succeeded
        ? '诊断已经全部完成'
        : diagnosis?.status === SalesDiagnosisStatus.cancelled
          ? '已取消的诊断不能再次执行'
          : !diagnosis
            ? '正在加载诊断数据'
            : undefined;

  const run = async () => {
    if (!diagnosis?.id || !diagnosis.version) return;
    setRunning(true);
    try {
      const reply = await salesDiagnosisServiceRunSalesDiagnosis(
        { id: diagnosis.id },
        { id: diagnosis.id, version: diagnosis.version },
      );
      setDiagnosis(reply);
      message.success('诊断已提交后台执行，可安全离开当前页面');
    } finally {
      setRunning(false);
    }
  };

  const resultHistory = (task: API.SalesDiagnosisTask) => {
    if (!task.results?.length) return <Empty description="暂无调用结果" />;
    const latest = task.results.at(-1);
    return (
      <Collapse
        defaultActiveKey={latest?.id ? [latest.id] : []}
        items={task.results
          .slice()
          .reverse()
          .map((result) => ({
            key: result.id ?? String(result.attemptNo),
            label: (
              <Space wrap>
                <span>第 {result.attemptNo ?? '-'} 次调用</span>
                <Tag>结果 #{result.id ?? '-'}</Tag>
                <Tag color={result.succeeded ? 'success' : 'error'}>
                  {result.succeeded ? '成功' : '失败'}
                </Tag>
                <Tag>
                  {salesDiagnosisEvidenceTypeLabel(result.evidenceType)}
                </Tag>
                <Typography.Text type="secondary">
                  {formatTime(result.createdAt)} · {result.durationMs ?? 0} ms
                </Typography.Text>
              </Space>
            ),
            children: result.succeeded ? (
              <Space
                direction="vertical"
                size="middle"
                style={{ width: '100%' }}
              >
                <Typography.Paragraph
                  style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}
                >
                  <HighlightedAnswer
                    content={result.answer || '模型未返回正文'}
                    terms={brandHighlightTerms}
                  />
                </Typography.Paragraph>
                <Space wrap>
                  <Tag color={result.brandMentioned ? 'success' : 'default'}>
                    {result.brandMentioned ? '已提及品牌' : '未提及品牌'}
                  </Tag>
                  <Tag>
                    Token：{result.inputTokens ?? 0} +{' '}
                    {result.outputTokens ?? 0}
                  </Tag>
                  <Tag>响应模型：{result.responseModel ?? '-'}</Tag>
                  {result.providerRequestId && (
                    <Tag>请求编号：{result.providerRequestId}</Tag>
                  )}
                  {result.analysis?.dominantSentiment === 4 && (
                    <Tag color="error">疑似负面，请人工复核</Tag>
                  )}
                </Space>
                {result.analysis && (
                  <Card
                    size="small"
                    title="结构分析与指标证据"
                    extra={
                      <Space wrap>
                        <Tag
                          color={
                            result.analysis.status === 1 ? 'success' : 'warning'
                          }
                        >
                          {result.analysis.status === 1
                            ? '分析完成'
                            : '部分可用'}
                        </Tag>
                        <Tag>{result.analysis.ruleVersion ?? '-'}</Tag>
                      </Space>
                    }
                  >
                    <Descriptions
                      bordered
                      size="small"
                      column={{ xs: 1, md: 2, xl: 4 }}
                      style={{ marginBottom: 12 }}
                    >
                      <Descriptions.Item label="是否收录">
                        <Tag
                          color={
                            result.analysis.included ? 'success' : 'default'
                          }
                        >
                          {result.analysis.included ? '已收录' : '未收录'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="信息完整度">
                        {percent(result.analysis.completenessScore)}
                      </Descriptions.Item>
                      <Descriptions.Item label="回答质量">
                        {percent(result.analysis.answerQualityScore)}
                      </Descriptions.Item>
                      <Descriptions.Item label="推荐位置">
                        {result.analysis.recommendationPosition
                          ? `第 ${result.analysis.recommendationPosition} 位`
                          : '未形成明确推荐位次'}
                      </Descriptions.Item>
                      <Descriptions.Item label="内容时效性">
                        {result.analysis.freshnessAvailable
                          ? percent(result.analysis.freshnessScore)
                          : '暂无时效证据'}
                      </Descriptions.Item>
                      <Descriptions.Item label="回答摘要" span={3}>
                        {result.analysis.answerSummary || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="优势表现" span={2}>
                        {result.analysis.strengths || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="待优化点" span={2}>
                        {result.analysis.gaps || '-'}
                      </Descriptions.Item>
                    </Descriptions>
                    {(result.analysis.entityMentions?.length ?? 0) > 0 && (
                      <Table<API.SalesDiagnosisEntityMention>
                        size="small"
                        rowKey={(item) =>
                          item.id ?? `${item.entityType}-${item.entityName}`
                        }
                        pagination={false}
                        dataSource={result.analysis.entityMentions}
                        columns={[
                          {
                            title: '证据编号',
                            dataIndex: 'id',
                            render: (value) => `#${value}`,
                          },
                          { title: '品牌实体', dataIndex: 'entityName' },
                          { title: '提及次数', dataIndex: 'mentionCount' },
                          {
                            title: '明确排名',
                            dataIndex: 'rankPosition',
                            render: (value) =>
                              value ? `第 ${value} 名` : '未形成明确排名',
                          },
                          {
                            title: '证据原文',
                            dataIndex: 'evidenceExcerpt',
                            ellipsis: true,
                          },
                        ]}
                      />
                    )}
                    {(result.analysis.claimMatches?.length ?? 0) > 0 && (
                      <Table<API.SalesDiagnosisClaimMatch>
                        size="small"
                        rowKey={(item) => item.id ?? item.claimId ?? ''}
                        pagination={false}
                        dataSource={result.analysis.claimMatches}
                        columns={[
                          {
                            title: '冻结官方事实',
                            dataIndex: 'claimId',
                            render: (value) =>
                              claimMap.get(value) ?? `事实 #${value}`,
                          },
                          {
                            title: '是否采纳',
                            render: (_, item) => (
                              <Tag color={item.matched ? 'success' : 'default'}>
                                {item.matched ? '已采纳' : '未采纳'}
                              </Tag>
                            ),
                          },
                          {
                            title: '命中原文',
                            dataIndex: 'evidenceExcerpt',
                            ellipsis: true,
                          },
                        ]}
                      />
                    )}
                    {result.analysis.errorMessage && (
                      <Alert
                        type="warning"
                        showIcon
                        style={{ marginTop: 12 }}
                        message="结构分析部分失败"
                        description={result.analysis.errorMessage}
                      />
                    )}
                  </Card>
                )}
                {(result.competitorMentions?.length ?? 0) > 0 && (
                  <Space wrap>
                    <Typography.Text type="secondary">
                      回答中出现的竞品：
                    </Typography.Text>
                    {result.competitorMentions?.map((item) => (
                      <Tag key={item.id ?? item.competitorName}>
                        {item.competitorName}
                      </Tag>
                    ))}
                  </Space>
                )}
                {(result.citations?.length ?? 0) > 0 && (
                  <div>
                    <Typography.Text strong>可核验来源</Typography.Text>
                    <ol>
                      {result.citations?.map((citation) => (
                        <li key={citation.id ?? citation.url}>
                          <Tag>引用 #{citation.id ?? '-'}</Tag>
                          <Tag>
                            {(
                              {
                                1: '其他高权重信源',
                                2: '官方信息源',
                                3: '百科类平台',
                                4: '新闻资讯类平台',
                                5: '行业垂类媒体',
                                6: '开放平台 / UGC',
                                7: '攻略游记类平台',
                                8: 'OTA / 票务平台',
                                9: '文库资料类平台',
                              } as Record<number, string>
                            )[Number(citation.sourceType)] ?? '其他高权重信源'}
                          </Tag>
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {citation.title ?? citation.domain ?? citation.url}
                          </a>
                          {citation.snippet && (
                            <Typography.Text type="secondary">
                              {' '}
                              — {citation.snippet}
                            </Typography.Text>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </Space>
            ) : (
              <Alert
                type="error"
                showIcon
                message={result.errorCode ?? '模型调用失败'}
                description={result.errorMessage ?? '未返回错误详情'}
              />
            ),
          }))}
      />
    );
  };

  return (
    <PageContainer
      loading={loading}
      title={diagnosis?.name ?? '诊断详情'}
      subTitle={diagnosis?.code}
      onBack={() => history.push('/sales/diagnoses')}
      tags={
        <Tag color={salesDiagnosisStatusColors[diagnosis?.status ?? 0]}>
          {salesDiagnosisStatusLabel(diagnosis?.status)}
        </Tag>
      }
      extra={[
        <Button
          key="refresh"
          icon={<ReloadOutlined />}
          onClick={() => void load()}
        >
          刷新
        </Button>,
        canCancel ? (
          <Button
            key="cancel"
            danger
            icon={<StopOutlined />}
            onClick={() => setCancelOpen(true)}
          >
            取消诊断
          </Button>
        ) : null,
        <Tooltip key="run" title={runDisabledReason}>
          <span>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={running}
              disabled={!canRun}
              onClick={() => void run()}
            >
              发起执行
            </Button>
          </span>
        </Tooltip>,
      ]}
    >
      {diagnosis?.status === SalesDiagnosisStatus.running && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            diagnosis.preparation?.status === 1 ||
            diagnosis.preparation?.status === 2
              ? '正在生成品牌词与统一诊断问题'
              : '多模型诊断正在后台执行'
          }
          description={
            diagnosis.preparation?.status === 1 ||
            diagnosis.preparation?.status === 2
              ? '准备完成后，系统会将同一组问题分别发送给每个已选模型平台。页面每 5 秒自动刷新，离开本页不会中断执行。'
              : `已完成 ${completed}/${diagnosis.taskCount ?? 0} 个逐平台任务。页面每 5 秒自动刷新，离开本页不会中断执行。`
          }
        />
      )}
      {diagnosis?.modelCount === 1 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="本次诊断只有一个模型样本"
          description="结果只能代表该模型当前配置下的回答，不应作为跨模型平台的整体 GEO 表现。"
        />
      )}
      <Card title="诊断概览" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, lg: 4 }}>
          <Descriptions.Item label="诊断对象">
            {salesDiagnosisSubjectTypeLabel(diagnosis?.subjectType)}
          </Descriptions.Item>
          <Descriptions.Item label="客户">
            {diagnosis?.profile?.customerName ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="品牌">
            {diagnosis?.profile?.brandName ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="发起人">
            {diagnosis?.createdByDisplayName ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="执行进度">
            <Progress
              size="small"
              style={{ minWidth: 150 }}
              percent={
                diagnosis?.taskCount
                  ? Math.round((completed / diagnosis.taskCount) * 100)
                  : 0
              }
              format={() => `${completed}/${diagnosis?.taskCount ?? 0}`}
            />
          </Descriptions.Item>
          <Descriptions.Item label="问题与模型">
            {diagnosis?.questionCount ?? 0} 个问题 ×{' '}
            {diagnosis?.modelCount ?? 0} 个模型
          </Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {formatTime(diagnosis?.startedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="完成时间">
            {formatTime(diagnosis?.completedAt)}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {diagnosis?.preparation && (
        <Card
          title="前置研究：品牌词与统一问题生成"
          style={{ marginBottom: 16 }}
        >
          <Descriptions column={{ xs: 1, md: 2, xl: 4 }}>
            <Descriptions.Item label="状态">
              <Tag
                color={
                  preparationStatusColors[diagnosis.preparation.status ?? 0]
                }
              >
                {preparationStatusLabels[diagnosis.preparation.status ?? 0] ??
                  '-'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="执行模型">
              {modelMap.get(diagnosis.preparation.diagnosisModelId) ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="尝试次数">
              {diagnosis.preparation.attemptCount ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label="完成时间">
              {formatTime(diagnosis.preparation.completedAt)}
            </Descriptions.Item>
          </Descriptions>
          {diagnosis.preparation.lastErrorMessage && (
            <Alert
              type="error"
              showIcon
              style={{ marginTop: 12 }}
              title={diagnosis.preparation.lastErrorCode || '前置研究失败'}
              description={`${diagnosis.preparation.lastErrorMessage}。可点击页面右上角“发起执行”仅重试未完成阶段。`}
            />
          )}
          {(diagnosis.preparation.attempts?.length ?? 0) > 0 && (
            <Collapse
              style={{ marginTop: 12 }}
              items={diagnosis.preparation.attempts
                ?.slice()
                .reverse()
                .map((attempt) => ({
                  key: attempt.id ?? attempt.attemptNo,
                  label: (
                    <Space wrap>
                      <span>第 {attempt.attemptNo} 次准备</span>
                      <Tag color={attempt.succeeded ? 'success' : 'error'}>
                        {attempt.succeeded ? '成功' : '失败'}
                      </Tag>
                      <Typography.Text type="secondary">
                        {attempt.responseModel || '-'} ·{' '}
                        {attempt.durationMs ?? 0} ms
                      </Typography.Text>
                    </Space>
                  ),
                  children: attempt.succeeded ? (
                    <Descriptions bordered size="small" column={1}>
                      <Descriptions.Item label="识别行业">
                        {attempt.industry || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="品牌主体摘要">
                        {attempt.brandSummary || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="请求编号">
                        {attempt.providerRequestId || '-'}
                      </Descriptions.Item>
                    </Descriptions>
                  ) : (
                    <Alert
                      type="error"
                      title={attempt.errorCode || '准备失败'}
                      description={attempt.errorMessage || '未返回错误详情'}
                    />
                  ),
                }))}
            />
          )}
          {(diagnosis.brandTerms?.length ?? 0) > 0 && (
            <div style={{ marginTop: 16 }}>
              <Typography.Text strong>结构化品牌相关词</Typography.Text>
              <div style={{ marginTop: 8 }}>
                <Space wrap>
                  {diagnosis.brandTerms?.map((item) => (
                    <Tooltip
                      key={item.id ?? `${item.termType}-${item.term}`}
                      title={item.reason}
                    >
                      <Tag>
                        {brandTermTypeLabels[item.termType ?? 0] ?? '其他'}：
                        {item.term}
                      </Tag>
                    </Tooltip>
                  ))}
                </Space>
              </div>
            </div>
          )}
          {(diagnosis.questions?.length ?? 0) > 0 && (
            <Table<API.SalesDiagnosisQuestion>
              style={{ marginTop: 16 }}
              size="small"
              rowKey={(item) => item.id ?? item.question ?? ''}
              pagination={false}
              dataSource={diagnosis.questions}
              columns={[
                { title: '统一诊断问题', dataIndex: 'question' },
                {
                  title: '验证意图',
                  dataIndex: 'intent',
                  width: 150,
                  render: (value) => value || '-',
                },
                {
                  title: '指标说明',
                  dataIndex: 'reason',
                  width: 260,
                  render: (value) => value || '-',
                },
              ]}
            />
          )}
        </Card>
      )}

      {diagnosis?.report && (
        <DiagnosisReportView
          diagnosis={diagnosis}
          action={
            <Button
              icon={<PrinterOutlined />}
              onClick={() =>
                window.open(
                  `/sales/diagnoses/${diagnosis.id}/report`,
                  '_blank',
                  'noopener,noreferrer',
                )
              }
            >
              打开独立报告页
            </Button>
          }
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {[
          'brand_mention_rate',
          'brand_mention_count',
          'top3_rate',
          'content_adoption_rate',
          'citation_rate',
          'brand_share_of_voice',
        ].map((code) => {
          const metric = overallMetrics.get(code);
          const unavailable = metric?.availabilityStatus === 2;
          const rawCount = code === 'brand_mention_count';
          return (
            <Col xs={24} md={12} xl={8} key={code}>
              <Card>
                <Statistic
                  title={metricLabels[code]}
                  value={
                    unavailable
                      ? '不可用'
                      : rawCount
                        ? (metric?.value ?? 0)
                        : (metric?.value ?? 0) * 100
                  }
                  precision={unavailable || rawCount ? undefined : 1}
                  suffix={unavailable || rawCount ? undefined : '%'}
                />
                <Typography.Text type="secondary">
                  {unavailable
                    ? '当前模型或样本不具备有效计算条件'
                    : `样本量 ${metric?.sampleCount ?? 0} · ${
                        metric?.ruleVersion ?? '-'
                      }`}
                </Typography.Text>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Card title="客户资料快照" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="官网">
            {diagnosis?.profile?.website ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="行业 / 地区">
            {[diagnosis?.profile?.industry, diagnosis?.profile?.region]
              .filter(Boolean)
              .join(' / ') || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="目标客户">
            {diagnosis?.profile?.targetAudience ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="品牌核心价值">
            {diagnosis?.profile?.coreValue ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="当前痛点" span={2}>
            {diagnosis?.profile?.painPoints ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="预期目标" span={2}>
            {diagnosis?.profile?.expectedGoals ?? '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="模型诊断指标" style={{ marginBottom: 16 }}>
        <Table<API.SalesDiagnosisModel>
          rowKey="id"
          pagination={false}
          dataSource={diagnosis?.models ?? []}
          columns={[
            { title: '模型', dataIndex: 'displayName' },
            {
              title: '提供商',
              dataIndex: 'provider',
              render: (value: number) =>
                writingModelProviderOptions.find((item) => item.value === value)
                  ?.label ?? '-',
            },
            ...[
              'brand_mention_rate',
              'brand_mention_count',
              'top3_rate',
              'content_adoption_rate',
              'citation_rate',
              'brand_share_of_voice',
            ].map((code) => ({
              title: metricLabels[code],
              key: code,
              render: (_: unknown, model: API.SalesDiagnosisModel) => {
                const metric = diagnosis?.metrics?.find(
                  (item) =>
                    item.diagnosisModelId === model.id &&
                    item.metricCode === code,
                );
                if (metric?.availabilityStatus === 2) return '不可用';
                return code === 'brand_mention_count'
                  ? (metric?.value ?? 0)
                  : percent(metric?.value);
              },
            })),
          ]}
        />
        <Collapse
          style={{ marginTop: 16 }}
          items={(diagnosis?.metrics ?? [])
            .filter((metric) =>
              isOverallDiagnosisDimension(metric.diagnosisModelId),
            )
            .map((metric) => ({
              key: metric.id ?? metric.metricCode,
              label: (
                <Space wrap>
                  <Typography.Text strong>
                    {metricLabels[metric.metricCode ?? ''] ?? metric.metricCode}
                  </Typography.Text>
                  <Tag>{metric.ruleVersion ?? '-'}</Tag>
                  <Tag
                    color={
                      metric.availabilityStatus === 2 ? 'default' : 'success'
                    }
                  >
                    {metric.availabilityStatus === 2 ? '不可用' : '可追溯'}
                  </Tag>
                </Space>
              ),
              children: (
                <Table<API.SalesDiagnosisMetricSample>
                  size="small"
                  rowKey={(sample) => sample.id ?? sample.resultId ?? ''}
                  pagination={false}
                  dataSource={metric.samples ?? []}
                  columns={[
                    {
                      title: '原始结果',
                      dataIndex: 'resultId',
                      render: (value) => `#${value}`,
                    },
                    { title: '分子贡献', dataIndex: 'numeratorValue' },
                    { title: '分母贡献', dataIndex: 'denominatorValue' },
                    {
                      title: '计算资格',
                      render: (_, sample) => (
                        <Tag color={sample.eligible ? 'success' : 'default'}>
                          {sample.eligible ? '计入' : '不计入'}
                        </Tag>
                      ),
                    },
                    {
                      title: '说明',
                      dataIndex: 'reason',
                      render: (value) => value || '-',
                    },
                  ]}
                />
              ),
            }))}
        />
      </Card>

      <Card title="样本回放：真实回答原文与品牌命中">
        <Table<API.SalesDiagnosisTask>
          rowKey="id"
          dataSource={diagnosis?.tasks ?? []}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          expandable={{ expandedRowRender: resultHistory }}
          columns={[
            {
              title: '诊断问题',
              dataIndex: 'questionId',
              ellipsis: true,
              render: (value: string) => questionMap.get(value) ?? value,
            },
            {
              title: '模型',
              dataIndex: 'diagnosisModelId',
              width: 180,
              render: (value: string) => modelMap.get(value) ?? value,
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (value: number) => (
                <Tag color={salesDiagnosisTaskStatusColors[value]}>
                  {salesDiagnosisTaskStatusLabel(value)}
                </Tag>
              ),
            },
            {
              title: '尝试次数',
              dataIndex: 'attemptCount',
              width: 100,
            },
            {
              title: '最近错误',
              dataIndex: 'lastErrorMessage',
              ellipsis: true,
              render: (value?: string) => value || '-',
            },
            {
              title: '操作',
              width: 90,
              render: (_: unknown, task: API.SalesDiagnosisTask) =>
                task.status === SalesDiagnosisTaskStatus.failed &&
                access.canSalesDiagnosisManage ? (
                  <Button type="link" onClick={() => setRetryTask(task)}>
                    重试
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>

      <ModalForm<ReasonForm>
        title="取消诊断"
        open={cancelOpen}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setCancelOpen(false),
        }}
        onFinish={async (values) => {
          if (!diagnosis?.id || !diagnosis.version) return false;
          const reply = await salesDiagnosisServiceCancelSalesDiagnosis(
            { id: diagnosis.id },
            {
              id: diagnosis.id,
              version: diagnosis.version,
              reason: values.reason,
            },
          );
          setDiagnosis(reply);
          setCancelOpen(false);
          message.success('诊断已取消');
          return true;
        }}
      >
        <ProFormTextArea
          name="reason"
          label="取消原因"
          fieldProps={{ rows: 3, maxLength: 500, showCount: true }}
          rules={[{ required: true, message: '请填写取消原因' }]}
        />
      </ModalForm>

      <ModalForm<ReasonForm>
        title="重试诊断任务"
        open={Boolean(retryTask)}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setRetryTask(undefined),
        }}
        initialValues={{ reason: '人工确认后重试' }}
        onFinish={async (values) => {
          if (!retryTask?.id) return false;
          const reply = await salesDiagnosisServiceRetrySalesDiagnosisTask(
            { taskId: retryTask.id },
            { taskId: retryTask.id, reason: values.reason },
          );
          setDiagnosis(reply);
          setRetryTask(undefined);
          message.success('任务已加入后台重试队列');
          return true;
        }}
      >
        <ProFormTextArea
          name="reason"
          label="重试原因"
          fieldProps={{ rows: 3, maxLength: 500, showCount: true }}
          rules={[{ required: true, message: '请填写重试原因' }]}
        />
      </ModalForm>
    </PageContainer>
  );
}
