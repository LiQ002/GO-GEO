import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { App, Button, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import {
  inclusionSiteAuthorizationServiceChangeInclusionSiteAuthorizationStatus,
  inclusionSiteAuthorizationServiceListInclusionSiteAuthorizations,
} from '@/services/geo-admin/inclusionSiteAuthorizationService';
import { inclusionSiteServiceListInclusionSites } from '@/services/geo-admin/inclusionSiteService';
import { publishChannelServiceListPublishChannels } from '@/services/geo-admin/publishChannelService';
import {
  selfMediaAuthorizationServiceChangeSelfMediaAuthorizationStatus,
  selfMediaAuthorizationServiceListSelfMediaAuthorizations,
} from '@/services/geo-admin/selfMediaAuthorizationService';
import { pageTokenFor } from '@/utils/admin-api';
import {
  apiOptionValue,
  authorizationStatusOptions,
  authorizationUsageOptions,
  optionValueEnum,
  PublishChannelCategory,
} from '@/utils/platform-enums';

type AuthorizationAction = 'pause' | 'resume' | 'revoke';
type ActionForm = { reason: string };
type AuthorizationResourceType = 'publish_channel' | 'inclusion_site';

type CustomerAuthorizationsPageProps = {
  resourceType: AuthorizationResourceType;
};

const authorizationStatusMap: Record<string, { text: string; color: string }> =
  {
    active: { text: '授权有效', color: 'success' },
    expired: { text: '授权过期', color: 'warning' },
    revoked: { text: '已撤销', color: 'error' },
  };

const usageStatusMap: Record<string, { text: string; color: string }> = {
  enabled: { text: '使用中', color: 'processing' },
  paused: { text: '已暂停', color: 'warning' },
  disabled: { text: '已禁用', color: 'default' },
};

const actionName: Record<AuthorizationAction, string> = {
  pause: '暂停使用',
  resume: '恢复使用',
  revoke: '撤销授权',
};

export const CustomerAuthorizationsPage = ({
  resourceType,
}: CustomerAuthorizationsPageProps) => {
  const actionRef = useRef<ActionType | null>(null);
  const [actionTarget, setActionTarget] = useState<{
    action: AuthorizationAction;
    record: API.CustomerAuthorization;
  }>();
  const { message } = App.useApp();
  const isSelfMedia = resourceType === 'publish_channel';
  const resourceLabel = isSelfMedia ? '自媒体渠道' : '检测模型站点';

  const columns: ProColumns<API.CustomerAuthorization>[] = [
    {
      title: '搜索',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: `企业、${resourceLabel}或授权账号` },
    },
    {
      title: '客户企业',
      dataIndex: 'enterpriseName',
      search: false,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.enterpriseName}</Typography.Text>
          <Typography.Text type="secondary" copyable>
            {record.enterpriseCode}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: resourceLabel,
      dataIndex: 'resourceName',
      search: false,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.resourceName}</Typography.Text>
          <Typography.Text type="secondary">
            {record.resourceCode}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: `${resourceLabel}筛选`,
      dataIndex: 'resourceId',
      valueType: 'select',
      hideInTable: true,
      request: async () => {
        if (isSelfMedia) {
          const reply = await publishChannelServiceListPublishChannels({
            pageSize: 200,
            category: PublishChannelCategory.selfMedia,
          });
          return (reply.items ?? []).map((item) => ({
            label: item.name,
            value: item.id,
          }));
        }
        const reply = await inclusionSiteServiceListInclusionSites({
          pageSize: 200,
        });
        return (reply.items ?? []).map((item) => ({
          label: item.name,
          value: item.id,
        }));
      },
    },
    {
      title: '授权账号',
      dataIndex: 'accountName',
      search: false,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.accountName}</Typography.Text>
          <Typography.Text type="secondary">
            {record.maskedIdentity || record.externalId || '-'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '授权状态',
      dataIndex: 'authorizationStatus',
      valueType: 'select',
      valueEnum: optionValueEnum(authorizationStatusOptions),
      render: (_, record) => {
        const status = authorizationStatusMap[record.authorizationStatus ?? ''];
        return (
          <Tag color={status?.color}>
            {status?.text ?? record.authorizationStatus}
          </Tag>
        );
      },
    },
    {
      title: '使用状态',
      dataIndex: 'usageStatus',
      valueType: 'select',
      valueEnum: optionValueEnum(authorizationUsageOptions),
      render: (_, record) => {
        const status = usageStatusMap[record.usageStatus ?? ''];
        return (
          <Tag color={status?.color}>{status?.text ?? record.usageStatus}</Tag>
        );
      },
    },
    {
      title: '授权到期',
      dataIndex: 'expiresAt',
      valueType: 'dateTime',
      search: false,
    },
    {
      title: '最近验证',
      dataIndex: 'lastVerifiedAt',
      valueType: 'dateTime',
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => {
        const actions: ReactNode[] = [];
        if (
          record.authorizationStatus === 'active' &&
          record.usageStatus === 'enabled'
        ) {
          actions.push(
            <Button
              key="pause"
              type="link"
              onClick={() => setActionTarget({ action: 'pause', record })}
            >
              暂停
            </Button>,
          );
        }
        if (
          record.authorizationStatus === 'active' &&
          record.usageStatus === 'paused'
        ) {
          actions.push(
            <Button
              key="resume"
              type="link"
              onClick={() => setActionTarget({ action: 'resume', record })}
            >
              恢复
            </Button>,
          );
        }
        if (record.authorizationStatus !== 'revoked') {
          actions.push(
            <Button
              key="revoke"
              type="link"
              danger
              onClick={() => setActionTarget({ action: 'revoke', record })}
            >
              撤销
            </Button>,
          );
        }
        return actions;
      },
    },
  ];

  return (
    <PageContainer
      title={`${resourceLabel}客户授权`}
      subTitle={`独立查看客户提交的${resourceLabel}登录授权，并控制其使用状态；平台不展示明文凭据`}
    >
      <ProTable<API.CustomerAuthorization>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const pageSize = params.pageSize ?? 20;
          const commonParams = {
            pageSize,
            pageToken: pageTokenFor(params.current, pageSize),
            keyword: params.keyword,
            authorizationStatus: apiOptionValue(
              authorizationStatusOptions,
              params.authorizationStatus,
            ),
            usageStatus: apiOptionValue(
              authorizationUsageOptions,
              params.usageStatus,
            ),
          };
          const reply = isSelfMedia
            ? await selfMediaAuthorizationServiceListSelfMediaAuthorizations({
                ...commonParams,
                publishChannelId: params.resourceId,
              })
            : await inclusionSiteAuthorizationServiceListInclusionSiteAuthorizations(
                {
                  ...commonParams,
                  inclusionSiteId: params.resourceId,
                },
              );
          return {
            data: reply.items ?? [],
            total: Number(reply.totalSize ?? 0),
            success: true,
          };
        }}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
      />

      <ModalForm<ActionForm>
        key={`${actionTarget?.action ?? 'none'}-${actionTarget?.record.id ?? 'none'}`}
        title={actionTarget ? actionName[actionTarget.action] : '修改授权状态'}
        open={Boolean(actionTarget)}
        width={520}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={(open) => {
          if (!open) setActionTarget(undefined);
        }}
        onFinish={async (values) => {
          if (!actionTarget?.record.id || !actionTarget.record.version)
            return false;
          const body = {
            id: actionTarget.record.id,
            version: actionTarget.record.version,
            action: actionTarget.action,
            reason: values.reason,
          };
          if (isSelfMedia) {
            await selfMediaAuthorizationServiceChangeSelfMediaAuthorizationStatus(
              { id: actionTarget.record.id },
              body,
            );
          } else {
            await inclusionSiteAuthorizationServiceChangeInclusionSiteAuthorizationStatus(
              { id: actionTarget.record.id },
              body,
            );
          }
          message.success(`${actionName[actionTarget.action]}成功`);
          setActionTarget(undefined);
          actionRef.current?.reload();
          return true;
        }}
      >
        <ProFormTextArea
          name="reason"
          label="操作原因"
          fieldProps={{ rows: 4, maxLength: 500, showCount: true }}
          rules={[{ required: true, message: '请输入操作原因，以便审计追踪' }]}
        />
      </ModalForm>
    </PageContainer>
  );
};
