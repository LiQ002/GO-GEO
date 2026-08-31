import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Descriptions, Drawer, Tag } from 'antd';
import { useState } from 'react';
import {
  auditLogServiceGetAuditLog,
  auditLogServiceListAuditLogs,
} from '@/services/geo-admin/auditLogService';
import { pageTokenFor } from '@/utils/admin-api';
import {
  apiOptionLabel,
  apiOptionValue,
  auditResultOptions,
  optionValueEnum,
} from '@/utils/platform-enums';
export default function AuditLogsPage() {
  const [detail, setDetail] = useState<API.AuditLog>();
  const cols: ProColumns<API.AuditLog>[] = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      search: false,
    },
    { title: '操作者', dataIndex: 'actorName', search: false },
    { title: '类型', dataIndex: 'actorType' },
    { title: '操作', dataIndex: 'action' },
    { title: '资源', dataIndex: 'resourceType' },
    {
      title: '结果',
      dataIndex: 'result',
      valueEnum: optionValueEnum(auditResultOptions),
      renderText: (value) => apiOptionLabel(auditResultOptions, value),
    },
    { title: '企业', dataIndex: 'enterpriseName', search: false },
    { title: '请求 ID', dataIndex: 'requestId', copyable: true },
    {
      title: '详情',
      valueType: 'option',
      render: (_, v) => [
        <Button
          key="detail"
          type="link"
          onClick={async () =>
            v.id && setDetail(await auditLogServiceGetAuditLog({ id: v.id }))
          }
        >
          查看
        </Button>,
      ],
    },
  ];
  return (
    <PageContainer title="审计日志" subTitle="日志只读且不可由业务功能删除">
      <ProTable<API.AuditLog>
        rowKey="id"
        columns={cols}
        request={async (p) => {
          const size = p.pageSize ?? 20;
          const r = await auditLogServiceListAuditLogs({
            pageSize: size,
            pageToken: pageTokenFor(p.current, size),
            actorType: p.actorType,
            action: p.action,
            resourceType: p.resourceType,
            result: apiOptionValue(auditResultOptions, p.result),
            requestId: p.requestId,
          });
          return {
            data: r.items ?? [],
            total: Number(r.totalSize ?? 0),
            success: true,
          };
        }}
      />
      <Drawer
        title="审计详情"
        width={800}
        open={Boolean(detail)}
        onClose={() => setDetail(undefined)}
      >
        {detail && (
          <Descriptions
            bordered
            column={1}
            items={[
              { key: 'action', label: '操作', children: detail.action },
              {
                key: 'actor',
                label: '操作者',
                children: `${detail.actorName ?? ''} (${detail.actorType}:${detail.actorId})`,
              },
              {
                key: 'result',
                label: '结果',
                children: (
                  <Tag>{apiOptionLabel(auditResultOptions, detail.result)}</Tag>
                ),
              },
              { key: 'reason', label: '原因', children: detail.reason || '-' },
              {
                key: 'resource',
                label: '资源',
                children: `${detail.resourceType}/${detail.resourceId}`,
              },
              {
                key: 'before',
                label: '变更前',
                children: <pre>{detail.beforeJson || '-'}</pre>,
              },
              {
                key: 'after',
                label: '变更后',
                children: <pre>{detail.afterJson || '-'}</pre>,
              },
              {
                key: 'request',
                label: '请求追踪',
                children: `${detail.requestId ?? ''} ${detail.traceId ?? ''}`,
              },
              {
                key: 'network',
                label: '来源',
                children: `${detail.ipAddress ?? ''} ${detail.userAgent ?? ''}`,
              },
            ]}
          />
        )}
      </Drawer>
    </PageContainer>
  );
}
