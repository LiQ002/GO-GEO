import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProFormSelect,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { App, Button, Descriptions, Drawer, Tabs, Tag } from 'antd';
import { useRef, useState } from 'react';
import {
  workerServiceChangeWorkerStatus,
  workerServiceGetWorker,
  workerServiceListWorkers,
} from '@/services/geo-admin/workerService';
import { pageTokenFor } from '@/utils/admin-api';
import {
  apiOptionLabel,
  apiOptionValue,
  optionValueEnum,
  workerActionOptions,
  workerApprovalOptions,
  workerStatusOptions,
} from '@/utils/platform-enums';

type Form = { action: number; reason: string };
export default function WorkersPage() {
  const ref = useRef<ActionType | null>(null);
  const [detail, setDetail] = useState<API.WorkerDetail>();
  const [actionOpen, setActionOpen] = useState(false);
  const { message } = App.useApp();
  const load = async (id?: string) => {
    if (id) setDetail(await workerServiceGetWorker({ id }));
  };
  const cols: ProColumns<API.WorkerNode>[] = [
    { title: '节点名称', dataIndex: 'name' },
    { title: '节点 ID', dataIndex: 'nodeId', copyable: true },
    { title: '版本', dataIndex: 'clientVersion' },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: optionValueEnum(workerStatusOptions),
      renderText: (value) => apiOptionLabel(workerStatusOptions, value),
    },
    {
      title: '审批',
      dataIndex: 'approvalStatus',
      valueEnum: optionValueEnum(workerApprovalOptions),
      renderText: (value) => apiOptionLabel(workerApprovalOptions, value),
    },
    {
      title: '最后心跳',
      dataIndex: 'lastHeartbeatAt',
      valueType: 'dateTime',
      search: false,
    },
    { title: '并发数', dataIndex: 'maxConcurrency', search: false },
    {
      title: '操作',
      valueType: 'option',
      render: (_, v) => [
        <Button key="detail" type="link" onClick={() => load(v.id)}>
          详情
        </Button>,
        <Button
          key="status"
          type="link"
          onClick={() => {
            setDetail({ worker: v });
            setActionOpen(true);
          }}
        >
          状态操作
        </Button>,
      ],
    },
  ];
  return (
    <PageContainer
      title="工作节点"
      subTitle="审批运营客户端，查看心跳和任务租约"
    >
      <ProTable<API.WorkerNode>
        rowKey="id"
        actionRef={ref}
        columns={cols}
        request={async (p) => {
          const size = p.pageSize ?? 20;
          const r = await workerServiceListWorkers({
            pageSize: size,
            pageToken: pageTokenFor(p.current, size),
            keyword: p.name,
            status: apiOptionValue(workerStatusOptions, p.status),
            approvalStatus: apiOptionValue(
              workerApprovalOptions,
              p.approvalStatus,
            ),
          });
          return {
            data: r.items ?? [],
            total: Number(r.totalSize ?? 0),
            success: true,
          };
        }}
      />
      <Drawer
        title="节点详情"
        width={820}
        open={Boolean(detail) && !actionOpen}
        onClose={() => setDetail(undefined)}
      >
        {detail?.worker && (
          <>
            <Descriptions
              bordered
              size="small"
              column={2}
              items={[
                {
                  key: 'node',
                  label: '节点 ID',
                  children: detail.worker.nodeId,
                },
                {
                  key: 'status',
                  label: '状态',
                  children: <Tag>{detail.worker.status}</Tag>,
                },
                {
                  key: 'version',
                  label: '客户端版本',
                  children: detail.worker.clientVersion,
                },
                {
                  key: 'heartbeat',
                  label: '最后心跳',
                  children: detail.worker.lastHeartbeatAt,
                },
                {
                  key: 'caps',
                  label: '能力',
                  span: 2,
                  children: <pre>{detail.worker.capabilitiesJson}</pre>,
                },
                {
                  key: 'system',
                  label: '系统信息',
                  span: 2,
                  children: <pre>{detail.worker.systemInfoJson}</pre>,
                },
              ]}
            />
            <Tabs
              items={[
                {
                  key: 'heartbeats',
                  label: `心跳 (${detail.heartbeats?.length ?? 0})`,
                  children: (
                    <pre>
                      {JSON.stringify(detail.heartbeats ?? [], null, 2)}
                    </pre>
                  ),
                },
                {
                  key: 'leases',
                  label: `租约 (${detail.leases?.length ?? 0})`,
                  children: (
                    <pre>{JSON.stringify(detail.leases ?? [], null, 2)}</pre>
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>
      <ModalForm<Form>
        title="节点状态操作"
        open={actionOpen}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setActionOpen(false),
        }}
        initialValues={{
          action: detail?.worker?.approvalStatus === 'pending' ? 1 : 3,
        }}
        onFinish={async (v) => {
          const w = detail?.worker;
          if (!w?.id) return false;
          await workerServiceChangeWorkerStatus(
            { id: w.id },
            {
              id: w.id,
              version: w.version,
              action: apiOptionValue(workerActionOptions, v.action),
              reason: v.reason,
            },
          );
          message.success('节点状态已更新');
          setActionOpen(false);
          setDetail(undefined);
          ref.current?.reload();
          return true;
        }}
      >
        <ProFormSelect
          name="action"
          label="操作"
          rules={[{ required: true }]}
          options={workerActionOptions}
        />
        <ProFormTextArea
          name="reason"
          label="原因"
          rules={[{ required: true }]}
        />
      </ModalForm>
    </PageContainer>
  );
}
