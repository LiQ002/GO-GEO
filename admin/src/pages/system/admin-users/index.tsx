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
import { App, Button, Space, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { adminRoleServiceListAdminRoles } from '@/services/geo-admin/adminRoleService';
import {
  adminUserServiceChangeAdminUserStatus,
  adminUserServiceCreateAdminUser,
  adminUserServiceListAdminUsers,
  adminUserServiceResetAdminUserPassword,
  adminUserServiceSetAdminUserRoles,
  adminUserServiceUpdateAdminUser,
} from '@/services/geo-admin/adminUserService';
import { pageTokenFor } from '@/utils/admin-api';
import {
  AdminRoleStatus,
  adminUserStatusOptions,
  apiOptionLabel,
  apiOptionValue,
  optionValueEnum,
} from '@/utils/platform-enums';

type Form = {
  username: string;
  displayName: string;
  email?: string;
  initialPassword?: string;
  roleIds: string[];
  reason: string;
};
export default function AdminUsersPage() {
  const ref = useRef<ActionType | null>(null);
  const [roles, setRoles] = useState<API.AdminRole[]>([]);
  const [editing, setEditing] = useState<API.AdminUser>();
  const [open, setOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<API.AdminUser>();
  const { message } = App.useApp();
  useEffect(() => {
    adminRoleServiceListAdminRoles({
      pageSize: 100,
      status: AdminRoleStatus.active,
    }).then((v) => setRoles(v.items ?? []));
  }, []);
  const cols: ProColumns<API.AdminUser>[] = [
    { title: '用户名', dataIndex: 'username' },
    { title: '姓名', dataIndex: 'displayName' },
    { title: '邮箱', dataIndex: 'email', search: false },
    {
      title: '角色',
      search: false,
      render: (_, v) => (
        <Space wrap>
          {(v.roles ?? []).map((r) => (
            <Tag key={r.id}>{r.name}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: optionValueEnum(adminUserStatusOptions),
      renderText: (value) => apiOptionLabel(adminUserStatusOptions, value),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      valueType: 'dateTime',
      search: false,
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
          编辑/角色
        </Button>,
        <Button key="password" type="link" onClick={() => setPasswordUser(v)}>
          重置密码
        </Button>,
        <Button
          key="status"
          type="link"
          danger={v.status === 'active'}
          onClick={async () => {
            if (!v.id) return;
            const action = v.status === 'active' ? 'suspend' : 'activate';
            await adminUserServiceChangeAdminUserStatus(
              { id: v.id },
              {
                id: v.id,
                action,
                reason: `平台管理员${action === 'suspend' ? '停用' : '启用'}账号`,
              },
            );
            message.success('账号状态已更新');
            ref.current?.reload();
          }}
        >
          {v.status === 'active' ? '停用' : '启用'}
        </Button>,
      ],
    },
  ];
  return (
    <PageContainer
      title="平台账号"
      subTitle="管理内部运营人员账号；不能停用当前登录账号"
    >
      <ProTable<API.AdminUser>
        rowKey="id"
        actionRef={ref}
        columns={cols}
        request={async (p) => {
          const size = p.pageSize ?? 20;
          const r = await adminUserServiceListAdminUsers({
            pageSize: size,
            pageToken: pageTokenFor(p.current, size),
            keyword: p.username,
            status: apiOptionValue(adminUserStatusOptions, p.status),
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
            新增平台账号
          </Button>,
        ]}
      />
      <ModalForm<Form>
        title={editing ? '编辑平台账号' : '新增平台账号'}
        open={open}
        modalProps={{ destroyOnHidden: true, onCancel: () => setOpen(false) }}
        initialValues={
          editing
            ? { ...editing, roleIds: (editing.roles ?? []).map((v) => v.id) }
            : { roleIds: [] }
        }
        onFinish={async (v) => {
          if (editing?.id) {
            await adminUserServiceUpdateAdminUser(
              { 'user.id': editing.id },
              {
                user: {
                  ...editing,
                  displayName: v.displayName,
                  email: v.email,
                },
                reason: v.reason,
              },
            );
            await adminUserServiceSetAdminUserRoles(
              { id: editing.id },
              { id: editing.id, roleIds: v.roleIds, reason: v.reason },
            );
          } else
            await adminUserServiceCreateAdminUser({
              user: {
                username: v.username,
                displayName: v.displayName,
                email: v.email,
              },
              initialPassword: v.initialPassword,
              roleIds: v.roleIds,
              reason: v.reason,
            });
          message.success('平台账号已保存');
          setOpen(false);
          setEditing(undefined);
          ref.current?.reload();
          return true;
        }}
      >
        <ProFormText
          name="username"
          label="用户名"
          disabled={Boolean(editing)}
          rules={[{ required: true }]}
        />
        <ProFormText
          name="displayName"
          label="姓名"
          rules={[{ required: true }]}
        />
        <ProFormText name="email" label="邮箱" rules={[{ type: 'email' }]} />
        {!editing && (
          <ProFormText.Password
            name="initialPassword"
            label="初始密码"
            rules={[{ required: true }, { min: 8 }]}
          />
        )}
        <ProFormSelect
          name="roleIds"
          label="角色"
          mode="multiple"
          rules={[{ required: true }]}
          options={roles.map((v) => ({ label: v.name ?? v.code, value: v.id }))}
        />
        <ProFormTextArea
          name="reason"
          label="操作原因"
          rules={[{ required: true }]}
        />
      </ModalForm>
      <ModalForm<{ password: string; reason: string }>
        title="重置平台账号密码"
        open={Boolean(passwordUser)}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setPasswordUser(undefined),
        }}
        onFinish={async (v) => {
          if (!passwordUser?.id) return false;
          await adminUserServiceResetAdminUserPassword(
            { id: passwordUser.id },
            { id: passwordUser.id, newPassword: v.password, reason: v.reason },
          );
          message.success('密码已重置，原会话已撤销');
          setPasswordUser(undefined);
          return true;
        }}
      >
        <ProFormText.Password
          name="password"
          label="新密码"
          rules={[{ required: true }, { min: 8 }]}
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
