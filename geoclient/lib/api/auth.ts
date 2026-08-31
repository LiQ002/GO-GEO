import type { components } from './generated/openapi'
import type { components as userComponents } from './generated/user-openapi'
import { http } from './core'
import { apiPath } from './path'
import { getDeviceId } from '@/lib/device-id'
import type { AuthResult, LoginCredentials } from '@/types/app'

type EnterpriseLoginRequest = userComponents['schemas']['user.v1.LoginRequest']
type EnterpriseLoginResponse = userComponents['schemas']['user.v1.LoginReply']
type AdminLoginRequest = userComponents['schemas']['admin.v1.AdminLoginRequest']
type AdminLoginResponse = userComponents['schemas']['admin.v1.AdminLoginReply']
type PasswordChangeIn = components['schemas']['PasswordChangeIn']

export async function login(credentials: LoginCredentials): Promise<AuthResult> {
  const payload: EnterpriseLoginRequest = {
    username: credentials.username,
    password: credentials.password,
    deviceId: getDeviceId(),
  }
  const { data } = await http.post<EnterpriseLoginResponse>(
    apiPath('/api/user/v1/auth/login'),
    payload,
  )
  if (!data.accessToken || !data.refreshToken || !data.enterprise?.enterpriseId) {
    throw new Error('登录响应缺少令牌或企业信息')
  }
  const enterprise = data.enterprise
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: {
      id: Number(enterprise.enterpriseId),
      username: credentials.username,
      name: enterprise.name || credentials.username,
      email: enterprise.contactEmail || '',
      articleCount: 0,
      publishedCount: 0,
      createdAt: '',
      updatedAt: '',
      expireAt: enterprise.subscriptionExpiresAt ?? null,
    },
  }
}

export async function adminLogin(credentials: LoginCredentials): Promise<AuthResult> {
  const payload: AdminLoginRequest = {
    username: credentials.username,
    password: credentials.password,
    deviceId: getDeviceId(),
  }
  const { data } = await http.post<AdminLoginResponse>(
    apiPath('/api/admin/v1/auth/login'),
    payload,
  )
  if (!data.accessToken || !data.refreshToken || !data.admin?.id) {
    throw new Error('登录响应缺少令牌或管理员信息')
  }
  const admin = data.admin
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: {
      id: Number(admin.id),
      username: admin.username || credentials.username,
      name: admin.displayName || admin.username || credentials.username,
      email: admin.email || '',
      articleCount: 0,
      publishedCount: 0,
      createdAt: '',
      updatedAt: '',
    },
  }
}

export async function changeEnterprisePassword(oldPassword: string, newPassword: string): Promise<void> {
  const payload: PasswordChangeIn = {
    old_password: oldPassword,
    new_password: newPassword,
  }
  await http.put(apiPath('/api/enterprise/password'), payload)
}
