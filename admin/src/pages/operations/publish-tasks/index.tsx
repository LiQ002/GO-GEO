import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Descriptions,
  Drawer,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import { useRef, useState } from 'react';
import {
  publishTaskServiceCancelPublishTask,
  publishTaskServiceGetPublishTask,
  publishTaskServiceListPublishTasks,
  publishTaskServiceRetryPublishTask,
  publishTaskServiceSaveSubmissionReceipt,
} from '@/services/geo-admin/publishTaskService';
import { jsonFieldRule, pageTokenFor } from '@/utils/admin-api';
import {
  apiOptionValue,
  optionValueEnum,
  taskStatusOptions,
} from '@/utils/platform-enums';

type ReasonForm = { reason: string };
type ReceiptForm = {
  receiptType: string;
  receiptCode?: string;
  status: string;
  publishedUrl?: string;
  currency?: string;
  costMinorUnits?: string;
  followUpJson?: string;
  reason: string;
};
export default function PublishTasksPage() {
  const ref = useRef<ActionType | null>(null);
  const [detail, setDetail] = useState<API.PublishTaskDetail>();
  const [action, setAction] = useState<'retry' | 'cancel'>();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const { message } = App.useApp();
  const load = async (id?: string) => {
    if (id) setDetail(await publishTaskServiceGetPublishTask({ id }));
  };
  const columns: ProColumns<API.PublishTask>[] = [
    { title: '文章', dataIndex: 'articleTitle', ellipsis: true },
    { title: '企业', dataIndex: 'enterpriseName', search: false },
    {
      title: '企业 ID',
      dataIndex: 'enterpriseId',
      valueType: 'digit',
      hideInTable: true,
    },
    { title: '渠道', dataIndex: 'publishChannelName', search: false },
    {
      title: '渠道 ID',
      dataIndex: 'publishChannelId',
      valueType: 'digit',
      hideInTable: true,
    },
    { title: '执行方式', dataIndex: 'executionMode', search: false },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: optionValueEnum(taskStatusOptions),
    },
    {
      title: '尝试',
      search: false,
      render: (_, v) => `${v.attemptCount ?? 0}/${v.maxAttempts ?? 0}`,
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
          详情
        </Button>,
        v.status === 'failed' || v.status === 'cancelled' ? (
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
      title="发布任务"
      subTitle="统一查看自媒体、官方媒体和大 V 投稿执行情况"
    >
      <ProTable<API.PublishTask>
        rowKey="id"
        actionRef={ref}
        columns={columns}
        request={async (p) => {
          const size = p.pageSize ?? 20;
          const r = await publishTaskServiceListPublishTasks({
            pageSize: size,
            pageToken: pageTokenFor(p.current, size),
            enterpriseId: p.enterpriseId,
            publishChannelId: p.publishChannelId,
            status: apiOptionValue(taskStatusOptions, p.status),
            keyword: p.articleTitle,
          });
          return {
            data: r.items ?? [],
            total: Number(r.totalSize ?? 0),
            success: true,
          };
        }}
      />
      <Drawer
        title="发布任务详情"
        width={820}
        open={Boolean(detail) && !action}
        onClose={() => setDetail(undefined)}
        extra={
          <Button onClick={() => setReceiptOpen(true)}>登记投稿回执</Button>
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
                  key: 'channel',
                  label: '渠道',
                  children: detail.task.publishChannelName,
                },
                {
                  key: 'target',
                  label: '投稿目标',
                  children: detail.task.publishTargetName || '-',
                },
                {
                  key: 'status',
                  label: '状态',
                  children: <Tag>{detail.task.status}</Tag>,
                },
                {
                  key: 'url',
                  label: '结果地址',
                  span: 2,
                  children: detail.task.resultUrl ? (
                    <Typography.Link
                      href={detail.task.resultUrl}
                      target="_blank"
                    >
                      {detail.task.resultUrl}
                    </Typography.Link>
                  ) : (
                    '-'
                  ),
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
                  key: 'attempts',
                  label: '执行记录',
                  children: (
                    <Timeline
                      items={(detail.attempts ?? []).map((v) => ({
                        children: `第 ${v.attemptNumber} 次：${v.status} ${v.errorMessage ?? ''}`,
                      }))}
                    />
                  ),
                },
                {
                  key: 'receipt',
                  label: '投稿回执',
                  children: (
                    <pre>{JSON.stringify(detail.receipt ?? {}, null, 2)}</pre>
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>
      <ModalForm<ReasonForm>
        title={action === 'retry' ? '重试任务' : '取消任务'}
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
            await publishTaskServiceRetryPublishTask({ id: t.id }, body);
          else await publishTaskServiceCancelPublishTask({ id: t.id }, body);
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
      <ModalForm<ReceiptForm>
        title="登记投稿回执"
        open={receiptOpen}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setReceiptOpen(false),
        }}
        initialValues={{
          receiptType: 'submission',
          status: 'submitted',
          currency: 'CNY',
          followUpJson: '{}',
        }}
        onFinish={async (v) => {
          const id = detail?.task?.id;
          if (!id) return false;
          await publishTaskServiceSaveSubmissionReceipt(
            { taskId: id },
            {
              taskId: id,
              reason: v.reason,
              receipt: {
                receiptType: v.receiptType,
                receiptCode: v.receiptCode,
                status: v.status,
                publishedUrl: v.publishedUrl,
                currency: v.currency,
                costMinorUnits: v.costMinorUnits,
                followUpJson: v.followUpJson,
              },
            },
          );
          message.success('投稿回执已保存');
          setReceiptOpen(false);
          await load(id);
          return true;
        }}
      >
        <ProFormText
          name="receiptType"
          label="回执类型"
          rules={[{ required: true }]}
        />
        <ProFormText name="receiptCode" label="回执编号" />
        <ProFormText name="status" label="状态" rules={[{ required: true }]} />
        <ProFormText name="publishedUrl" label="发布地址" />
        <ProFormText name="costMinorUnits" label="费用（最小货币单位）" />
        <ProFormText name="currency" label="币种" />
        <ProFormTextArea
          name="followUpJson"
          label="跟进信息 JSON"
          rules={[jsonFieldRule()]}
        />
        <ProFormTextArea
          name="reason"
          label="登记原因"
          rules={[{ required: true }]}
        />
      </ModalForm>
    </PageContainer>
  );
}
