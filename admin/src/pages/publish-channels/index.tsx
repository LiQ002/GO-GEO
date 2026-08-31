import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import {
  Alert,
  App,
  Avatar,
  Button,
  Drawer,
  Popconfirm,
  Space,
  Tag,
} from 'antd';
import { useCallback, useRef, useState } from 'react';
import IconUpload from '@/components/IconUpload';
import {
  publishChannelServiceCreatePublishChannel,
  publishChannelServiceCreatePublishTarget,
  publishChannelServiceDeletePublishChannel,
  publishChannelServiceDeletePublishTarget,
  publishChannelServiceListPublishChannels,
  publishChannelServiceListPublishTargets,
  publishChannelServiceUpdatePublishChannel,
  publishChannelServiceUpdatePublishTarget,
  publishChannelServiceUploadPublishChannelIcon,
} from '@/services/geo-admin/publishChannelService';
import { jsonFieldRule, pageTokenFor } from '@/utils/admin-api';
import {
  AuthorizationType,
  authorizationTypeOptions,
  ExecutionMode,
  executionModeOptions,
  optionLabel,
  optionValueEnum,
  PlatformConfigStatus,
  PublishChannelCategory,
  platformConfigStatusOptions,
  publishChannelCategoryOptions,
} from '@/utils/platform-enums';
import {
  mediaDriverOptions,
} from '@/utils/platform-drivers';

const submissionCategoryOptions = publishChannelCategoryOptions.filter(
  (item) => item.value !== PublishChannelCategory.selfMedia,
);

type ChannelForm = API.PublishChannel;
type TargetForm = API.PublishTarget;

export type PublishChannelsPageProps = {
  mode?: 'submission' | 'self_media';
};

const PublishChannelsPage = ({
  mode = 'submission',
}: PublishChannelsPageProps) => {
  const isSelfMedia = mode === 'self_media';
  const actionRef = useRef<ActionType | null>(null);
  const [editing, setEditing] = useState<API.PublishChannel>();
  const [channelFormOpen, setChannelFormOpen] = useState(false);
  const [targetOwner, setTargetOwner] = useState<API.PublishChannel>();
  const [targets, setTargets] = useState<API.PublishTarget[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [editingTarget, setEditingTarget] = useState<API.PublishTarget>();
  const [targetFormOpen, setTargetFormOpen] = useState(false);
  const { message } = App.useApp();

  const loadTargets = useCallback(async (owner: API.PublishChannel) => {
    if (!owner.id) return;
    setTargetsLoading(true);
    try {
      const reply = await publishChannelServiceListPublishTargets({
        publishChannelId: owner.id,
      });
      setTargets(reply.items ?? []);
    } finally {
      setTargetsLoading(false);
    }
  }, []);

  const openTargets = async (record: API.PublishChannel) => {
    setTargetOwner(record);
    await loadTargets(record);
  };

  const saveChannel = async (values: ChannelForm) => {
    if (editing?.id) {
      await publishChannelServiceUpdatePublishChannel(
        { 'publish_channel.id': editing.id },
        { publishChannel: { ...editing, ...values } },
      );
      message.success(isSelfMedia ? '自媒体渠道已更新' : '投稿渠道已更新');
    } else {
      await publishChannelServiceCreatePublishChannel({
        publishChannel: values,
      });
      message.success(isSelfMedia ? '自媒体渠道已创建' : '投稿渠道已创建');
    }
    setChannelFormOpen(false);
    setEditing(undefined);
    actionRef.current?.reload();
    return true;
  };

  const saveTarget = async (values: TargetForm) => {
    if (!targetOwner?.id) return false;
    if (editingTarget?.id) {
      await publishChannelServiceUpdatePublishTarget(
        {
          publishChannelId: targetOwner.id,
          'target.id': editingTarget.id,
        },
        {
          publishChannelId: targetOwner.id,
          target: {
            ...editingTarget,
            ...values,
            publishChannelId: targetOwner.id,
          },
        },
      );
      message.success('投稿目标已更新');
    } else {
      await publishChannelServiceCreatePublishTarget(
        { publishChannelId: targetOwner.id },
        {
          publishChannelId: targetOwner.id,
          target: { ...values, publishChannelId: targetOwner.id },
        },
      );
      message.success('投稿目标已创建');
    }
    setTargetFormOpen(false);
    setEditingTarget(undefined);
    await loadTargets(targetOwner);
    return true;
  };

  const columns: ProColumns<API.PublishChannel>[] = [
    {
      title: '渠道名称',
      dataIndex: 'name',
      render: (_, record) => {
        const label = (
          <Space>
            <Avatar shape="square" size="small" src={record.icon}>
              {record.name?.slice(0, 1)}
            </Avatar>
            <span>{record.name}</span>
          </Space>
        );
        return isSelfMedia ? (
          label
        ) : (
          <Button type="link" onClick={() => openTargets(record)}>
            {label}
          </Button>
        );
      },
    },
    { title: '编码', dataIndex: 'code', copyable: true },
    {
      title: '客户端驱动',
      dataIndex: 'driverType',
      hideInTable: !isSelfMedia,
      search: false,
      render: (_, record) =>
        optionLabel(mediaDriverOptions, record.driverType),
    },
    {
      title: '分类',
      dataIndex: 'category',
      hideInTable: isSelfMedia,
      search: isSelfMedia ? false : undefined,
      valueEnum: optionValueEnum(submissionCategoryOptions),
      render: (_, record) => (
        <Tag color="blue">
          {optionLabel(publishChannelCategoryOptions, record.category)}
        </Tag>
      ),
    },
    {
      title: '执行方式',
      dataIndex: 'executionMode',
      search: false,
      render: (_, record) =>
        optionLabel(executionModeOptions, record.executionMode),
    },
    {
      title: '授权方式',
      dataIndex: 'authorizationType',
      search: false,
      render: (_, record) =>
        record.authorizationType === AuthorizationType.clientLogin ? (
          <Tag color="gold">企业客户端授权</Tag>
        ) : (
          <Tag>无需企业授权</Tag>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: optionValueEnum(platformConfigStatusOptions),
      render: (_, record) => (
        <Tag
          color={
            record.status === PlatformConfigStatus.active
              ? 'success'
              : 'default'
          }
        >
          {optionLabel(platformConfigStatusOptions, record.status)}
        </Tag>
      ),
    },
    { title: '驱动版本', dataIndex: 'driverVersion', search: false },
    { title: '排序', dataIndex: 'sortOrder', search: false },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => [
        !isSelfMedia ? (
          <Button key="targets" type="link" onClick={() => openTargets(record)}>
            投稿目标
          </Button>
        ) : null,
        <Button
          key="edit"
          type="link"
          onClick={() => {
            setEditing(record);
            setChannelFormOpen(true);
          }}
        >
          编辑
        </Button>,
        <Popconfirm
          key="delete"
          title="确认删除该投放渠道？"
          onConfirm={async () => {
            if (!record.id) return;
            await publishChannelServiceDeletePublishChannel({
              id: record.id,
              version: record.version,
            });
            message.success(
              isSelfMedia ? '自媒体渠道已删除' : '投稿渠道已删除',
            );
            actionRef.current?.reload();
          }}
        >
          <Button type="link" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  const targetColumns: ProColumns<API.PublishTarget>[] = [
    { title: '目标名称', dataIndex: 'name' },
    {
      title: '类型',
      dataIndex: 'targetType',
      render: (_, record) => (
        <Tag>
          {optionLabel(publishChannelCategoryOptions, record.targetType)}
        </Tag>
      ),
    },
    { title: '平台', dataIndex: 'platform' },
    { title: '地区', dataIndex: 'region' },
    { title: '行业', dataIndex: 'industry' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, record) => (
        <Tag
          color={
            record.status === PlatformConfigStatus.active
              ? 'success'
              : 'default'
          }
        >
          {optionLabel(platformConfigStatusOptions.slice(0, 2), record.status)}
        </Tag>
      ),
    },
    { title: '排序', dataIndex: 'sortOrder' },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => [
        <Button
          key="edit"
          type="link"
          onClick={() => {
            setEditingTarget(record);
            setTargetFormOpen(true);
          }}
        >
          编辑
        </Button>,
        <Popconfirm
          key="delete"
          title="确认删除该投稿目标？"
          onConfirm={async () => {
            if (!targetOwner?.id || !record.id) return;
            await publishChannelServiceDeletePublishTarget({
              publishChannelId: targetOwner.id,
              targetId: record.id,
              version: record.version,
            });
            message.success('投稿目标已删除');
            await loadTargets(targetOwner);
          }}
        >
          <Button type="link" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer
      title={isSelfMedia ? '自媒体渠道' : '媒体投稿渠道'}
      subTitle={
        isSelfMedia
          ? '配置客户可授权使用的自媒体平台；所有自媒体账号均须由企业客户端完成授权'
          : '管理官方媒体和大 V 投稿渠道及其具体投稿目标'
      }
    >
      <ProTable<API.PublishChannel>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const pageSize = params.pageSize ?? 20;
          const reply = await publishChannelServiceListPublishChannels({
            pageSize,
            pageToken: pageTokenFor(params.current, pageSize),
            keyword: params.name,
            category: isSelfMedia
              ? PublishChannelCategory.selfMedia
              : params.category,
            status: params.status,
          });
          return {
            data: reply.items ?? [],
            total: Number(reply.totalSize ?? 0),
            success: true,
          };
        }}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(undefined);
              setChannelFormOpen(true);
            }}
          >
            {isSelfMedia ? '新建自媒体渠道' : '新建投稿渠道'}
          </Button>,
        ]}
      />

      <ModalForm<ChannelForm>
        key={editing?.id ?? 'create'}
        title={
          editing
            ? isSelfMedia
              ? '编辑自媒体渠道'
              : '编辑投稿渠道'
            : isSelfMedia
              ? '新建自媒体渠道'
              : '新建投稿渠道'
        }
        open={channelFormOpen}
        width={720}
        initialValues={
          editing ?? {
            category: isSelfMedia
              ? PublishChannelCategory.selfMedia
              : PublishChannelCategory.officialMedia,
            status: PlatformConfigStatus.disabled,
            authorizationType: isSelfMedia
              ? AuthorizationType.clientLogin
              : AuthorizationType.none,
            executionMode: ExecutionMode.semiAutomatic,
            sortOrder: 0,
          }
        }
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={(open) => {
          setChannelFormOpen(open);
          if (!open) setEditing(undefined);
        }}
        onFinish={saveChannel}
      >
        <Space size="large">
          <ProFormText
            name="code"
            label="渠道编码"
            disabled={Boolean(editing)}
            rules={[
              { required: true, message: '请输入渠道编码' },
              {
                pattern: /^[a-z][a-z0-9_]*$/u,
                message: '仅支持小写字母、数字和下划线',
              },
            ]}
          />
          <ProFormText
            name="name"
            label="渠道名称"
            rules={[{ required: true, message: '请输入渠道名称' }]}
          />
          {isSelfMedia ? (
            <ProFormText name="category" hidden />
          ) : (
            <ProFormSelect
              name="category"
              label="渠道分类"
              disabled={Boolean(editing)}
              options={submissionCategoryOptions}
              rules={[{ required: true, message: '请选择渠道分类' }]}
            />
          )}
        </Space>
        <ProFormTextArea name="description" label="渠道说明" />
        {isSelfMedia ? (
          <Space size="large">
            <ProFormSelect
              name="driverType"
              label="客户端驱动"
              options={mediaDriverOptions}
              tooltip="业务编码用于平台管理；客户端驱动决定授权和发布时加载哪套自动化实现。"
              rules={[{ required: true, message: '请选择客户端驱动' }]}
            />
            <ProFormText
              name="loginUrl"
              label="授权登录地址"
              rules={[
                { required: true, message: '请输入授权登录地址' },
                { type: 'url', message: '请输入有效的 HTTP(S) URL' },
              ]}
            />
          </Space>
        ) : null}
        <ProFormText name="icon" hidden />
        <IconUpload
          label="渠道图标"
          upload={publishChannelServiceUploadPublishChannelIcon}
        />
        <Space size="large">
          <ProFormSelect
            name="status"
            label="状态"
            options={platformConfigStatusOptions}
          />
          {isSelfMedia ? (
            <ProFormText name="authorizationType" hidden />
          ) : (
            <ProFormSelect
              name="authorizationType"
              label="授权方式"
              options={authorizationTypeOptions}
            />
          )}
          <ProFormSelect
            name="executionMode"
            label="执行方式"
            options={executionModeOptions}
            rules={[{ required: true, message: '请选择执行方式' }]}
          />
        </Space>
        {isSelfMedia ? (
          <Alert
            showIcon
            type="info"
            message="客户授权要求"
            description="该渠道的账号和登录凭据必须由客户通过企业授权客户端提交，平台后台仅查看脱敏授权记录，不接收明文账号凭据。"
            style={{ marginBottom: 24 }}
          />
        ) : null}
        <Space size="large">
          <ProFormText name="driverVersion" label="驱动版本" />
          <ProFormDigit
            name="sortOrder"
            label="排序"
            fieldProps={{ precision: 0 }}
          />
        </Space>
      </ModalForm>

      {!isSelfMedia ? (
        <Drawer
          title={`${targetOwner?.name ?? ''} · 投稿目标`}
          open={Boolean(targetOwner)}
          size="large"
          onClose={() => {
            setTargetOwner(undefined);
            setTargets([]);
          }}
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingTarget(undefined);
                setTargetFormOpen(true);
              }}
            >
              新建投稿目标
            </Button>
          }
        >
          <ProTable<API.PublishTarget>
            rowKey="id"
            columns={targetColumns}
            dataSource={targets}
            loading={targetsLoading}
            search={false}
            pagination={false}
            options={false}
          />
        </Drawer>
      ) : null}

      {!isSelfMedia ? (
        <ModalForm<TargetForm>
          key={editingTarget?.id ?? 'create-target'}
          title={editingTarget ? '编辑投稿目标' : '新建投稿目标'}
          open={targetFormOpen}
          width={680}
          initialValues={
            editingTarget ?? {
              targetType: targetOwner?.category,
              status: PlatformConfigStatus.active,
              cooperationJson: '{}',
              requirementsJson: '{}',
              sortOrder: 0,
            }
          }
          modalProps={{ destroyOnHidden: true }}
          onOpenChange={(open) => {
            setTargetFormOpen(open);
            if (!open) setEditingTarget(undefined);
          }}
          onFinish={saveTarget}
        >
          <Space size="large">
            <ProFormText
              name="name"
              label="目标名称"
              rules={[{ required: true, message: '请输入目标名称' }]}
            />
            <ProFormSelect
              name="targetType"
              label="目标类型"
              options={submissionCategoryOptions}
              rules={[{ required: true, message: '请选择目标类型' }]}
            />
            <ProFormText name="platform" label="所属平台" />
          </Space>
          <ProFormText name="entryUrl" label="投稿入口 URL" />
          <ProFormText name="submissionEmail" label="投稿邮箱" />
          <Space size="large">
            <ProFormText name="region" label="地区" />
            <ProFormText name="industry" label="行业" />
            <ProFormSelect
              name="status"
              label="状态"
              options={platformConfigStatusOptions.slice(0, 2)}
            />
            <ProFormDigit
              name="sortOrder"
              label="排序"
              fieldProps={{ precision: 0 }}
            />
          </Space>
          <ProFormTextArea
            name="cooperationJson"
            label="合作/费用信息 JSON"
            fieldProps={{ rows: 4 }}
            rules={[jsonFieldRule(false)]}
          />
          <ProFormTextArea
            name="requirementsJson"
            label="稿件要求 JSON"
            fieldProps={{ rows: 4 }}
            rules={[jsonFieldRule(false)]}
          />
        </ModalForm>
      ) : null}
    </PageContainer>
  );
};

export default PublishChannelsPage;
