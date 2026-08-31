import { LockOutlined } from '@ant-design/icons';
import {
  ModalForm,
  PageContainer,
  ProDescriptions,
  ProFormText,
} from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { App, Button, Card, Space, Tag, Typography } from 'antd';
import { startTransition, useEffect, useState } from 'react';
import { clearAuthSession } from '@/lib/auth';
import {
  adminAuthServiceChangePassword,
  adminAuthServiceGetCurrentAdmin,
} from '@/services/geo-admin/adminAuthService';

type PasswordForm = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

const AccountSecurityPage = () => {
  const [profile, setProfile] = useState<API.AdminProfile>();
  const [loading, setLoading] = useState(true);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const { setInitialState } = useModel('@@initialState');
  const { message } = App.useApp();

  useEffect(() => {
    let active = true;
    adminAuthServiceGetCurrentAdmin()
      .then((current) => {
        if (active) setProfile(current);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const changePassword = async (values: PasswordForm) => {
    await adminAuthServiceChangePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    message.success('密码已修改，请重新登录');
    clearAuthSession();
    startTransition(() => {
      setInitialState((state) => ({ ...state, currentUser: undefined }));
    });
    history.replace('/user/login');
    return true;
  };

  return (
    <PageContainer
      title="我的账号"
      subTitle="查看当前平台管理员身份与安全设置"
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Card title="基本信息" loading={loading}>
          <ProDescriptions<API.AdminProfile>
            dataSource={profile}
            columns={[
              { title: '管理员 ID', dataIndex: 'id', copyable: true },
              { title: '用户名', dataIndex: 'username' },
              { title: '显示名称', dataIndex: 'displayName' },
              { title: '邮箱', dataIndex: 'email', copyable: true },
              {
                title: '状态',
                dataIndex: 'status',
                render: (_, record) => (
                  <Tag color={record.status === 'active' ? 'success' : 'default'}>
                    {record.status === 'active' ? '正常' : record.status}
                  </Tag>
                ),
              },
              { title: '上次登录', dataIndex: 'lastLoginAt', valueType: 'dateTime' },
              {
                title: '角色',
                dataIndex: 'roles',
                render: (_, record) =>
                  record.roles?.length
                    ? record.roles.map((role) => <Tag key={role}>{role}</Tag>)
                    : '-',
              },
              {
                title: '权限点',
                dataIndex: 'permissions',
                span: 2,
                render: (_, record) => (
                  <Typography.Text type="secondary">
                    {record.permissions?.join('、') || '未分配显式权限点'}
                  </Typography.Text>
                ),
              },
            ]}
          />
        </Card>

        <Card
          title="密码安全"
          extra={
            <Button
              type="primary"
              icon={<LockOutlined />}
              onClick={() => setPasswordOpen(true)}
            >
              修改密码
            </Button>
          }
        >
          <Typography.Paragraph type="secondary">
            修改密码后，后端会撤销该管理员的所有刷新会话，当前管理端也会立即退出。
          </Typography.Paragraph>
        </Card>
      </Space>

      <ModalForm<PasswordForm>
        title="修改密码"
        open={passwordOpen}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={setPasswordOpen}
        onFinish={changePassword}
      >
        <ProFormText.Password
          name="currentPassword"
          label="当前密码"
          rules={[{ required: true, message: '请输入当前密码' }]}
        />
        <ProFormText.Password
          name="newPassword"
          label="新密码"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 10, message: '新密码至少 10 位' },
          ]}
        />
        <ProFormText.Password
          name="confirmPassword"
          label="确认新密码"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator: async (_, value) => {
                if (!value || getFieldValue('newPassword') === value) return;
                throw new Error('两次输入的新密码不一致');
              },
            }),
          ]}
        />
      </ModalForm>
    </PageContainer>
  );
};

export default AccountSecurityPage;
