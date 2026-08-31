import { LockOutlined, UserOutlined } from '@ant-design/icons';
import {
  LoginForm,
  ProFormCheckbox,
  ProFormText,
} from '@ant-design/pro-components';
import { Helmet, history, useIntl, useModel } from '@umijs/max';
import { Alert, App } from 'antd';
import { createStyles } from 'antd-style';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import Settings from '../../../../config/defaultSettings';
import {
  getDeviceId,
  normalizeAuthSession,
  saveAuthSession,
} from '@/lib/auth';
import { adminProfileToCurrentUser } from '@/lib/admin-profile';
import { adminAuthServiceLogin } from '@/services/geo-admin/adminAuthService';

const getSafeRedirectUrl = (redirect: string | null): string => {
  if (!redirect?.startsWith('/') || redirect.startsWith('//')) return '/';
  try {
    const parsed = new URL(redirect, window.location.origin);
    if (parsed.origin !== window.location.origin) return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
};

const useStyles = createStyles(({ token }) => ({
  container: {
    display: 'flex',
    minHeight: '100vh',
    flexDirection: 'column',
    overflow: 'auto',
    background:
      'radial-gradient(circle at 20% 10%, rgba(22, 119, 255, 0.16), transparent 30%), linear-gradient(145deg, #f5f8ff 0%, #ffffff 55%, #f2f7ff 100%)',
  },
  form: {
    flex: 1,
    padding: '72px 24px 48px',
  },
  hint: {
    color: token.colorTextSecondary,
    textAlign: 'center',
  },
}));

type LoginValues = {
  username?: string;
  password?: string;
  autoLogin?: boolean;
};

const Login = () => {
  const [errorMessage, setErrorMessage] = useState<string>();
  const { setInitialState } = useModel('@@initialState');
  const { styles } = useStyles();
  const { message } = App.useApp();
  const intl = useIntl();

  const handleSubmit = async (values: LoginValues) => {
    setErrorMessage(undefined);
    try {
      const reply = normalizeAuthSession(
        await adminAuthServiceLogin(
          {
            username: values.username,
            password: values.password,
            deviceId: getDeviceId(),
          },
          { skipErrorHandler: true },
        ),
      );
      if (!reply.accessToken || !reply.refreshToken || !reply.admin) {
        throw new Error('登录响应不完整');
      }

      const admin = reply.admin;
      saveAuthSession(reply, values.autoLogin !== false);
      flushSync(() => {
        setInitialState((state) => ({
          ...state,
          currentUser: adminProfileToCurrentUser(admin),
        }));
      });
      message.success('登录成功');
      const params = new URL(window.location.href).searchParams;
      history.replace(getSafeRedirectUrl(params.get('redirect')));
    } catch (error) {
      const responseMessage = (
        error as { response?: { data?: { message?: string } } }
      ).response?.data?.message;
      setErrorMessage(responseMessage || '用户名或密码错误');
    }
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>
          {intl.formatMessage({ id: 'menu.login', defaultMessage: '登录' })}
          {Settings.title && ` - ${Settings.title}`}
        </title>
      </Helmet>
      <div className={styles.form}>
        <LoginForm<LoginValues>
          contentStyle={{ minWidth: 280, maxWidth: 420 }}
          logo={<img alt="GEO" src="/logo.svg" />}
          title="GEO 运营管理平台"
          subTitle="统一管理文章生成、投放渠道与 GEO 检查能力"
          initialValues={{ autoLogin: true }}
          onFinish={handleSubmit}
        >
          {errorMessage ? (
            <Alert
              style={{ marginBottom: 24 }}
              title={errorMessage}
              type="error"
              showIcon
            />
          ) : null}
          <ProFormText
            name="username"
            fieldProps={{ size: 'large', prefix: <UserOutlined /> }}
            placeholder="管理员用户名"
            rules={[{ required: true, message: '请输入管理员用户名' }]}
          />
          <ProFormText.Password
            name="password"
            fieldProps={{ size: 'large', prefix: <LockOutlined /> }}
            placeholder="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          />
          <ProFormCheckbox name="autoLogin">保持登录</ProFormCheckbox>
          <p className={styles.hint}>连续登录失败 5 次将临时锁定账号</p>
        </LoginForm>
      </div>
    </div>
  );
};

export default Login;
