import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { App, Button, Descriptions, Drawer, Tag } from 'antd';
import { useRef, useState } from 'react';
import {
  alertServiceGetAlert,
  alertServiceListAlerts,
  alertServiceResolveAlert,
} from '@/services/geo-admin/alertService';
import { pageTokenFor } from '@/utils/admin-api';
import {
  alertSeverityOptions,
  alertStatusOptions,
  apiOptionLabel,
  apiOptionValue,
  optionValueEnum,
} from '@/utils/platform-enums';
export default function AlertsPage() {
  const ref = useRef<ActionType | null>(null);
  const [detail, setDetail] = useState<API.Alert>();
  const [resolve, setResolve] = useState(false);
  const { message } = App.useApp();
  const cols: ProColumns<API.Alert>[] = [
    { title: '告警', dataIndex: 'title', ellipsis: true },
    { title: '企业', dataIndex: 'enterpriseName', search: false },
    {
      title: '级别',
      dataIndex: 'severity',
      valueEnum: optionValueEnum(alertSeverityOptions),
      renderText: (value) => apiOptionLabel(alertSeverityOptions, value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: optionValueEnum(alertStatusOptions),
      renderText: (value) => apiOptionLabel(alertStatusOptions, value),
    },
    { title: '类型', dataIndex: 'alertType' },
    {
      title: '时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, v) => [
        <Button
          key="detail"
          type="link"
          onClick={async () =>
            v.id && setDetail(await alertServiceGetAlert({ id: v.id }))
          }
        >
          详情
        </Button>,
        v.status === 'open' ? (
          <Button
            key="resolve"
            type="link"
            onClick={() => {
              setDetail(v);
              setResolve(true);
            }}
          >
            解决
          </Button>
        ) : null,
      ],
    },
  ];
  return (
    <PageContainer title="运行告警">
      <ProTable<API.Alert>
        rowKey="id"
        actionRef={ref}
        columns={cols}
        request={async (p) => {
          const size = p.pageSize ?? 20;
          const r = await alertServiceListAlerts({
            pageSize: size,
            pageToken: pageTokenFor(p.current, size),
            keyword: p.title,
            severity: apiOptionValue(alertSeverityOptions, p.severity),
            status: apiOptionValue(alertStatusOptions, p.status),
            alertType: p.alertType,
          });
          return {
            data: r.items ?? [],
            total: Number(r.totalSize ?? 0),
            success: true,
          };
        }}
      />
      <Drawer
        title="告警详情"
        width={680}
        open={Boolean(detail) && !resolve}
        onClose={() => setDetail(undefined)}
      >
        {detail && (
          <Descriptions
            bordered
            column={1}
            items={[
              {
                key: 'severity',
                label: '级别',
                children: (
                  <Tag>
                    {apiOptionLabel(alertSeverityOptions, detail.severity)}
                  </Tag>
                ),
              },
              { key: 'title', label: '标题', children: detail.title },
              { key: 'desc', label: '说明', children: detail.description },
              {
                key: 'resource',
                label: '关联资源',
                children: `${detail.resourceType ?? ''} / ${detail.resourceId ?? ''}`,
              },
              {
                key: 'details',
                label: '详细数据',
                children: <pre>{detail.detailsJson}</pre>,
              },
            ]}
          />
        )}
      </Drawer>
      <ModalForm<{ reason: string }>
        title="解决告警"
        open={resolve}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setResolve(false),
        }}
        onFinish={async (v) => {
          if (!detail?.id) return false;
          await alertServiceResolveAlert(
            { id: detail.id },
            { id: detail.id, reason: v.reason },
          );
          message.success('告警已解决');
          setResolve(false);
          setDetail(undefined);
          ref.current?.reload();
          return true;
        }}
      >
        <ProFormTextArea
          name="reason"
          label="处理说明"
          rules={[{ required: true }]}
        />
      </ModalForm>
    </PageContainer>
  );
}
