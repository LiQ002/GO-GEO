import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { App, Button, Popconfirm, Space, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import {
  adminRoleServiceCreateAdminRole,
  adminRoleServiceDeleteAdminRole,
  adminRoleServiceListAdminPermissions,
  adminRoleServiceListAdminRoles,
  adminRoleServiceSetAdminRolePermissions,
  adminRoleServiceUpdateAdminRole,
} from '@/services/geo-admin/adminRoleService';
import { pageTokenFor } from '@/utils/admin-api';
import {
  AdminRoleDataScope,
  AdminRoleStatus,
  adminRoleDataScopeOptions,
  adminRoleStatusOptions,
  optionValueEnum,
} from '@/utils/platform-enums';

type Form = {
  code: string;
  name: string;
  description?: string;
  dataScope: number;
  status: number;
  permissionIds: string[];
  reason: string;
};
export default function AdminRolesPage() {
  const ref = useRef<ActionType | null>(null);
  const [permissions, setPermissions] = useState<API.AdminPermission[]>([]);
  const [editing, setEditing] = useState<API.AdminRole>();
  const [open, setOpen] = useState(false);
  const { message } = App.useApp();
  useEffect(() => {
    adminRoleServiceListAdminPermissions({}).then((v) =>
      setPermissions(v.items ?? []),
    );
  }, []);
  const cols: ProColumns<API.AdminRole>[] = [
    { title: '角色', dataIndex: 'name' },
    { title: '编码', dataIndex: 'code' },
    {
      title: '数据范围',
      dataIndex: 'dataScope',
      valueEnum: optionValueEnum(adminRoleDataScopeOptions),
    },
    {
      title: '权限',
      search: false,
      render: (_, v) => (
        <Space wrap>
          {(v.permissions ?? []).slice(0, 5).map((p) => (
            <Tag key={p.id}>{p.name}</Tag>
          ))}
          {(v.permissions?.length ?? 0) > 5 && `等 ${v.permissions?.length} 项`}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: optionValueEnum(adminRoleStatusOptions),
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, v) => [
        <Button
          key="edit"
          type="link"
          onClick={() => {
            setEditing(v);
            setOpen(true);
          }}
        >
          编辑
        </Button>,
        <Popconfirm
          key="delete"
          title="确认删除角色？"
          description="已绑定平台账号的角色不能删除。"
          onConfirm={async () => {
            if (!v.id) return;
            await adminRoleServiceDeleteAdminRole({
              id: v.id,
              reason: '平台管理员删除角色',
            });
            message.success('角色已删除');
            ref.current?.reload();
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
      title="角色权限"
      subTitle="平台内部 RBAC；企业侧不使用此角色模型"
    >
      <ProTable<API.AdminRole>
        rowKey="id"
        actionRef={ref}
        columns={cols}
        request={async (p) => {
          const size = p.pageSize ?? 20;
          const r = await adminRoleServiceListAdminRoles({
            pageSize: size,
            pageToken: pageTokenFor(p.current, size),
            keyword: p.name,
            status: p.status,
          });
          return {
            data: r.items ?? [],
            total: Number(r.totalSize ?? 0),
            success: true,
          };
        }}
        toolBarRender={() => [
          <Button
            key="new"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            新增角色
          </Button>,
        ]}
      />
      <ModalForm<Form>
        title={editing ? '编辑角色' : '新增角色'}
        open={open}
        modalProps={{ destroyOnHidden: true, onCancel: () => setOpen(false) }}
        initialValues={
          editing
            ? {
                ...editing,
                permissionIds: (editing.permissions ?? []).map((v) => v.id),
              }
            : {
                dataScope: AdminRoleDataScope.all,
                status: AdminRoleStatus.active,
                permissionIds: [],
              }
        }
        onFinish={async (v) => {
          if (editing?.id) {
            await adminRoleServiceUpdateAdminRole(
              { 'role.id': editing.id },
              {
                role: {
                  ...editing,
                  name: v.name,
                  description: v.description,
                  dataScope: v.dataScope,
                  status: v.status,
                },
                reason: v.reason,
              },
            );
            await adminRoleServiceSetAdminRolePermissions(
              { id: editing.id },
              {
                id: editing.id,
                permissionIds: v.permissionIds,
                reason: v.reason,
              },
            );
          } else
            await adminRoleServiceCreateAdminRole({
              role: {
                code: v.code,
                name: v.name,
                description: v.description,
                dataScope: v.dataScope,
                status: v.status,
              },
              permissionIds: v.permissionIds,
              reason: v.reason,
            });
          message.success('角色已保存');
          setOpen(false);
          setEditing(undefined);
          ref.current?.reload();
          return true;
        }}
      >
        <ProFormText
          name="code"
          label="角色编码"
          disabled={Boolean(editing)}
          rules={[{ required: true }]}
        />
        <ProFormText
          name="name"
          label="角色名称"
          rules={[{ required: true }]}
        />
        <ProFormTextArea name="description" label="说明" />
        <ProFormSelect
          name="dataScope"
          label="数据范围"
          rules={[{ required: true }]}
          options={adminRoleDataScopeOptions}
        />
        <ProFormSelect
          name="status"
          label="状态"
          rules={[{ required: true }]}
          options={adminRoleStatusOptions}
        />
        <ProFormSelect
          name="permissionIds"
          label="权限点"
          mode="multiple"
          options={permissions.map((v) => ({
            label: `${v.resource} / ${v.name}`,
            value: v.id,
          }))}
        />
        <ProFormTextArea
          name="reason"
          label="操作原因"
          rules={[{ required: true }]}
        />
      </ModalForm>
    </PageContainer>
  );
}
