import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Descriptions,
  Drawer,
  List,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useRef, useState } from 'react';
import {
  geoTaskServiceCancelGeoTask,
  geoTaskServiceCreateManualReview,
  geoTaskServiceGetGeoTask,
  geoTaskServiceListGeoTasks,
  geoTaskServiceRetryGeoTask,
} from '@/services/geo-admin/geoTaskService';
import { jsonFieldRule, pageTokenFor } from '@/utils/admin-api';
import {
  apiOptionLabel,
  apiOptionValue,
  optionValueEnum,
  taskStatusOptions,
} from '@/utils/platform-enums';

const geoTaskStatusOptions = taskStatusOptions.filter(
  (option) => option.apiValue !== 'retry_wait',
);

type ReasonForm = { reason: string };
type ReviewForm = { beforeJson?: string; afterJson: string; reason: string };
export default function GeoTasksPage() {
  const ref = useRef<ActionType | null>(null);
  const [detail, setDetail] = useState<API.GeoTaskDetail>();
  const [action, setAction] = useState<'retry' | 'cancel'>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const { message } = App.useApp();
  const load = async (id?: string) => {
    if (id) setDetail(await geoTaskServiceGetGeoTask({ id }));
  };
  const columns: ProColumns<API.GeoTask>[] = [
    { title: '问题', dataIndex: 'questionText', ellipsis: true },
    { title: '企业', dataIndex: 'enterpriseName', search: false },
    {
      title: '企业 ID',
      dataIndex: 'enterpriseId',
      valueType: 'digit',
      hideInTable: true,
    },
    { title: '品牌', dataIndex: 'brandName', search: false },
    { title: '检查站点', dataIndex: 'inclusionSiteName', search: false },
    {
      title: '站点 ID',
      dataIndex: 'inclusionSiteId',
      valueType: 'digit',
      hideInTable: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: optionValueEnum(geoTaskStatusOptions),
      renderText: (value) => apiOptionLabel(geoTaskStatusOptions, value),
    },
    {
      title: '计划时间',
      dataIndex: 'scheduledAt',
      valueType: 'dateTime',
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, v) => [
        <Button key="detail" type="link" onClick={() => load(v.id)}>
          证据详情
        </Button>,
        v.status === 'failed' ? (
          <Button
            key="retry"
            type="link"
            onClick={() => {
              setDetail({ task: v });
              setAction('retry');
            }}
          >
            重试
          </Button>
        ) : null,
        !['succeeded', 'cancelled'].includes(v.status ?? '') ? (
          <Button
            key="cancel"
            type="link"
            danger
            onClick={() => {
              setDetail({ task: v });
              setAction('cancel');
            }}
          >
            取消
          </Button>
        ) : null,
      ],
    },
  ];
  return (
    <PageContainer
      title="GEO 检测任务"
      subTitle="查看模型回答、引用、品牌提及、分析结果和人工纠正"
    >
      <ProTable<API.GeoTask>
        rowKey="id"
        actionRef={ref}
        columns={columns}
        request={async (p) => {
          const size = p.pageSize ?? 20;
          const r = await geoTaskServiceListGeoTasks({
            pageSize: size,
            pageToken: pageTokenFor(p.current, size),
            enterpriseId: p.enterpriseId,
            inclusionSiteId: p.inclusionSiteId,
            status: apiOptionValue(geoTaskStatusOptions, p.status),
            keyword: p.questionText,
          });
          return {
            data: r.items ?? [],
            total: Number(r.totalSize ?? 0),
            success: true,
          };
        }}
      />
      <Drawer
        title="GEO 证据详情"
        width={900}
        open={Boolean(detail) && !action}
        onClose={() => setDetail(undefined)}
        extra={
          detail?.answer ? (
            <Button onClick={() => setReviewOpen(true)}>人工复核</Button>
          ) : null
        }
      >
        {detail?.task && (
          <>
            <Descriptions
              bordered
              size="small"
              column={2}
              items={[
                {
                  key: 'enterprise',
                  label: '企业',
                  children: detail.task.enterpriseName,
                },
                {
                  key: 'site',
                  label: '检查站点',
                  children: detail.task.inclusionSiteName,
                },
                {
                  key: 'brand',
                  label: '品牌',
                  children: detail.task.brandName,
                },
                {
                  key: 'status',
                  label: '状态',
                  children: (
                    <Tag>
                      {apiOptionLabel(geoTaskStatusOptions, detail.task.status)}
                    </Tag>
                  ),
                },
                {
                  key: 'question',
                  label: '问题',
                  span: 2,
                  children: detail.task.questionText,
                },
                {
                  key: 'error',
                  label: '错误',
                  span: 2,
                  children: detail.task.errorMessage || '-',
                },
              ]}
            />
            <Tabs
              items={[
                {
                  key: 'answer',
                  label: '原始回答',
                  children: (
                    <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                      {detail.answer?.answerText || '暂无回答证据'}
                    </Typography.Paragraph>
                  ),
                },
                {
                  key: 'citations',
                  label: `引用 (${detail.citations?.length ?? 0})`,
                  children: (
                    <List
                      dataSource={detail.citations ?? []}
                      renderItem={(v) => (
                        <List.Item>
                          <Typography.Link href={v.url} target="_blank">
                            {v.title || v.url}
                          </Typography.Link>
                          <Tag>{v.domain}</Tag>
                        </List.Item>
                      )}
                    />
                  ),
                },
                {
                  key: 'mentions',
                  label: `提及 (${detail.mentions?.length ?? 0})`,
                  children: (
                    <List
                      dataSource={detail.mentions ?? []}
                      renderItem={(v) => (
                        <List.Item>
                          {v.text}
                          <Tag>{v.sentiment}</Tag>置信度 {v.confidence}
                        </List.Item>
                      )}
                    />
                  ),
                },
                {
                  key: 'analysis',
                  label: '分析结果',
                  children: (
                    <pre>{JSON.stringify(detail.analysis ?? {}, null, 2)}</pre>
                  ),
                },
                {
                  key: 'reviews',
                  label: `人工复核 (${detail.reviews?.length ?? 0})`,
                  children: (
                    <List
                      dataSource={detail.reviews ?? []}
                      renderItem={(v) => (
                        <List.Item>
                          {v.reason}
                          <pre>{v.afterJson}</pre>
                        </List.Item>
                      )}
                    />
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>
      <ModalForm<ReasonForm>
        title={action === 'retry' ? '重试 GEO 任务' : '取消 GEO 任务'}
        open={Boolean(action)}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setAction(undefined),
        }}
        onFinish={async (v) => {
          const t = detail?.task;
          if (!t?.id) return false;
          const body = { id: t.id, version: t.version, reason: v.reason };
          if (action === 'retry')
            await geoTaskServiceRetryGeoTask({ id: t.id }, body);
          else await geoTaskServiceCancelGeoTask({ id: t.id }, body);
          message.success('任务状态已更新');
          setAction(undefined);
          setDetail(undefined);
          ref.current?.reload();
          return true;
        }}
      >
        <ProFormTextArea
          name="reason"
          label="操作原因"
          rules={[{ required: true }]}
        />
      </ModalForm>
      <ModalForm<ReviewForm>
        title="提交人工复核"
        open={reviewOpen}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setReviewOpen(false),
        }}
        initialValues={{
          beforeJson: detail?.analysis?.resultJson || '{}',
          afterJson: detail?.analysis?.resultJson || '{}',
        }}
        onFinish={async (v) => {
          const taskId = detail?.task?.id,
            answerId = detail?.answer?.id;
          if (!taskId || !answerId) return false;
          await geoTaskServiceCreateManualReview(
            { taskId },
            {
              taskId,
              answerSnapshotId: answerId,
              analysisResultId: detail?.analysis?.id,
              beforeJson: v.beforeJson,
              afterJson: v.afterJson,
              reason: v.reason,
            },
          );
          message.success('人工复核已追加保存');
          setReviewOpen(false);
          await load(taskId);
          return true;
        }}
      >
        <ProFormTextArea
          name="beforeJson"
          label="复核前 JSON"
          fieldProps={{ rows: 5 }}
          rules={[jsonFieldRule()]}
        />
        <ProFormTextArea
          name="afterJson"
          label="复核后 JSON"
          fieldProps={{ rows: 8 }}
          rules={[{ required: true }, jsonFieldRule(true)]}
        />
        <ProFormTextArea
          name="reason"
          label="复核原因"
          rules={[{ required: true }]}
        />
      </ModalForm>
    </PageContainer>
  );
}
