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
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useRef, useState } from 'react';
import IconUpload from '@/components/IconUpload';
import {
  inclusionSiteServiceCreateInclusionSite,
  inclusionSiteServiceDeleteInclusionSite,
  inclusionSiteServiceListInclusionSites,
  inclusionSiteServiceUpdateInclusionSite,
  inclusionSiteServiceUploadInclusionSiteIcon,
} from '@/services/geo-admin/inclusionSiteService';
import { pageTokenFor } from '@/utils/admin-api';
import {
  AuthorizationType,
  optionLabel,
  optionValueEnum,
  PlatformConfigStatus,
  platformConfigStatusOptions,
} from '@/utils/platform-enums';
import { modelDriverOptions } from '@/utils/platform-drivers';

type InclusionSiteForm = API.InclusionSite;

const InclusionSitesPage = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [editing, setEditing] = useState<API.InclusionSite>();
  const [formOpen, setFormOpen] = useState(false);
  const { message } = App.useApp();

  const saveSite = async (values: InclusionSiteForm) => {
    const site = {
      ...values,
      authorizationType: AuthorizationType.clientLogin,
    };
    if (editing?.id) {
      await inclusionSiteServiceUpdateInclusionSite(
        { 'inclusion_site.id': editing.id },
        { inclusionSite: { ...editing, ...site } },
      );
      message.success('GEO 检查站点已更新');
    } else {
      await inclusionSiteServiceCreateInclusionSite({ inclusionSite: site });
      message.success('GEO 检查站点已创建');
    }
    setFormOpen(false);
    setEditing(undefined);
    actionRef.current?.reload();
    return true;
  };

  const columns: ProColumns<API.InclusionSite>[] = [
    {
      title: '站点名称',
      dataIndex: 'name',
      render: (_, record) => (
        <Space>
          <Avatar shape="square" size="small" src={record.icon}>
            {record.name?.slice(0, 1)}
          </Avatar>
          <span>{record.name}</span>
        </Space>
      ),
    },
    { title: '站点编码', dataIndex: 'code', copyable: true },
    {
      title: '客户端驱动',
      dataIndex: 'driverType',
      search: false,
      render: (_, record) =>
        optionLabel(modelDriverOptions, record.driverType),
    },
    {
      title: '入口 URL',
      dataIndex: 'entryUrl',
      search: false,
      ellipsis: true,
      render: (_, record) => (
        <Typography.Link
          href={record.entryUrl}
          target="_blank"
          rel="noreferrer"
        >
          {record.entryUrl}
        </Typography.Link>
      ),
    },
    {
      title: '授权方式',
      dataIndex: 'authorizationType',
      search: false,
      render: () => <Tag color="gold">企业客户端授权</Tag>,
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
    {
      title: '维护公告',
      dataIndex: 'maintenanceMessage',
      search: false,
      ellipsis: true,
    },
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
        <Button
          key="edit"
          type="link"
          onClick={() => {
            setEditing(record);
            setFormOpen(true);
          }}
        >
          编辑
        </Button>,
        <Popconfirm
          key="delete"
          title="确认删除该 GEO 检查站点？"
          description="已被监测计划引用时后端将拒绝删除。"
          onConfirm={async () => {
            if (!record.id) return;
            await inclusionSiteServiceDeleteInclusionSite({
              id: record.id,
              version: record.version,
            });
            message.success('GEO 检查站点已删除');
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

  return (
    <PageContainer
      title="GEO 收录检查站点"
      subTitle="配置运营客户端实际打开、提问并采集引用证据的站点"
    >
      <ProTable<API.InclusionSite>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const pageSize = params.pageSize ?? 20;
          const reply = await inclusionSiteServiceListInclusionSites({
            pageSize,
            pageToken: pageTokenFor(params.current, pageSize),
            keyword: params.name,
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
              setFormOpen(true);
            }}
          >
            新建检查站点
          </Button>,
        ]}
      />

      <ModalForm<InclusionSiteForm>
        key={editing?.id ?? 'create'}
        title={editing ? '编辑 GEO 检查站点' : '新建 GEO 检查站点'}
        open={formOpen}
        width={760}
        initialValues={{
          ...(editing ?? {
            status: PlatformConfigStatus.disabled,
            sortOrder: 0,
          }),
          authorizationType: AuthorizationType.clientLogin,
        }}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(undefined);
        }}
        onFinish={saveSite}
      >
        <Space size="large">
          <ProFormText
            name="code"
            label="站点编码"
            disabled={Boolean(editing)}
            rules={[
              { required: true, message: '请输入站点编码' },
              {
                pattern: /^[a-z][a-z0-9_]*$/u,
                message: '仅支持小写字母、数字和下划线',
              },
            ]}
          />
          <ProFormText
            name="name"
            label="站点名称"
            rules={[{ required: true, message: '请输入站点名称' }]}
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={platformConfigStatusOptions}
          />
        </Space>
        <ProFormText
          name="entryUrl"
          label="登录与检测入口 URL"
          rules={[
            {
              required: true,
              type: 'url',
              message: '请输入有效的 HTTP(S) URL',
            },
          ]}
        />
        <ProFormSelect
          name="driverType"
          label="客户端驱动"
          options={modelDriverOptions}
          tooltip="业务编码用于后台管理；客户端驱动决定授权和 GEO 检测时加载哪套自动化实现。"
          rules={[{ required: true, message: '请选择客户端驱动' }]}
        />
        <ProFormText name="icon" hidden />
        <ProFormText name="authorizationType" hidden />
        <IconUpload
          label="站点图标"
          upload={inclusionSiteServiceUploadInclusionSiteIcon}
        />
        <Alert
          showIcon
          type="info"
          message="客户登录授权"
          description="所有 GEO 检测站点均由企业用户通过 GEOHelper 客户端完成登录授权，平台后台仅查看脱敏授权记录。"
          style={{ marginBottom: 24 }}
        />
        <Space size="large">
          <ProFormText name="driverVersion" label="驱动版本" />
          <ProFormDigit
            name="sortOrder"
            label="排序"
            fieldProps={{ precision: 0 }}
          />
        </Space>
        <ProFormTextArea
          name="maintenanceMessage"
          label="维护公告"
          fieldProps={{ rows: 2 }}
        />
      </ModalForm>
    </PageContainer>
  );
};

export default InclusionSitesPage;
