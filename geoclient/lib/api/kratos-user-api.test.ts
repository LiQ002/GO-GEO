import { beforeEach, describe, expect, it, vi } from 'vitest'

const requestMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('./core', () => ({ http: requestMocks }))
vi.mock('@/lib/device-id', () => ({ getDeviceId: () => 'device-1' }))

import { adminLogin, login } from './auth'
import {
  createPlatformAuthorizationSession,
  deleteUserPlatform,
  getModelPlatforms,
  getPlatforms,
  getUserModelPlatforms,
  getUserPlatformSecret,
  getUserPlatforms,
  updateUserPlatform,
} from './client'

describe('Kratos user API integration', () => {
  beforeEach(() => {
    requestMocks.get.mockReset()
    requestMocks.post.mockReset()
    requestMocks.delete.mockReset()
  })

  it('logs in with the desktop device ID', async () => {
    requestMocks.post.mockResolvedValue({
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        enterprise: {
          enterpriseId: '7',
          name: '示例企业',
          contactEmail: 'team@example.com',
        },
      },
    })

    const result = await login({ username: 'demo', password: 'secret' })

    expect(requestMocks.post).toHaveBeenCalledWith('/api/user/v1/auth/login', {
      username: 'demo',
      password: 'secret',
      deviceId: 'device-1',
    })
    expect(result).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 7, name: '示例企业', email: 'team@example.com' },
    })
  })

  it('logs the operator in through the Kratos admin contract', async () => {
    requestMocks.post.mockResolvedValue({
      data: {
        accessToken: 'admin-access-token',
        refreshToken: 'admin-refresh-token',
        admin: {
          id: '9',
          username: 'admin',
          displayName: '平台管理员',
          email: 'admin@example.com',
        },
      },
    })

    const result = await adminLogin({ username: 'admin', password: 'secret' })

    expect(requestMocks.post).toHaveBeenCalledWith('/api/admin/v1/auth/login', {
      username: 'admin',
      password: 'secret',
      deviceId: 'device-1',
    })
    expect(result).toMatchObject({
      accessToken: 'admin-access-token',
      refreshToken: 'admin-refresh-token',
      user: {
        id: 9,
        username: 'admin',
        name: '平台管理员',
        email: 'admin@example.com',
      },
    })
  })

  it('loads configured self-media and inclusion-site catalogs', async () => {
    requestMocks.get
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: '11',
              code: 'c01',
              driverType: 2,
              loginUrl: 'https://www.zhihu.com/signin',
              name: '知乎',
              category: 'self_media',
              accountRequired: true,
            },
            { id: '12', code: 'official', name: '官方媒体', category: 'official_media', accountRequired: false },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: '21',
              code: 'm01',
              driverType: 1,
              loginUrl: 'https://chat.deepseek.com/',
              name: 'DeepSeek',
            },
          ],
        },
      })

    await expect(getPlatforms()).resolves.toEqual([
      expect.objectContaining({
        id: '11',
        code: 'c01',
        driverType: 2,
        name: 'zhihu',
        label: '知乎',
        loginUrl: 'https://www.zhihu.com/signin',
      }),
    ])
    await expect(getModelPlatforms()).resolves.toEqual([
      expect.objectContaining({
        id: '21',
        code: 'm01',
        driverType: 1,
        name: 'deepseek',
        label: 'DeepSeek',
        loginUrl: 'https://chat.deepseek.com/',
      }),
    ])
    expect(requestMocks.get).toHaveBeenNthCalledWith(1, '/api/user/v1/publish-channels')
    expect(requestMocks.get).toHaveBeenNthCalledWith(2, '/api/user/v1/inclusion-sites')
  })

  it('loads authorized accounts by numeric resource type', async () => {
    requestMocks.get
      .mockResolvedValueOnce({
        data: {
          items: [{ id: '31', resourceId: '11', authorizationStatus: 3, usageStatus: 1 }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ id: '32', resourceId: '21', authorizationStatus: 4, usageStatus: 3 }],
        },
      })

    await expect(getUserPlatforms()).resolves.toEqual([
      expect.objectContaining({ id: '31', resourceId: '11', isActive: true }),
    ])
    await expect(getUserModelPlatforms()).resolves.toEqual([
      expect.objectContaining({ id: '32', resourceId: '21', isActive: false, authStatus: 'expired' }),
    ])
    expect(requestMocks.get).toHaveBeenNthCalledWith(1, '/api/user/v1/platform-accounts', {
      params: { resourceType: 1 },
    })
    expect(requestMocks.get).toHaveBeenNthCalledWith(2, '/api/user/v1/platform-accounts', {
      params: { resourceType: 2 },
    })
  })

  it('loads the latest platform credential from the server by account ID', async () => {
    requestMocks.get.mockResolvedValue({
      data: { accountId: '31', credentialPayload: 'aes:v2:latest-ciphertext' },
    })

    await expect(getUserPlatformSecret('31')).resolves.toBe('aes:v2:latest-ciphertext')
    expect(requestMocks.get).toHaveBeenCalledWith(
      '/api/user/v1/platform-accounts/31/credential',
    )
  })

  it('creates, submits, and deletes a Kratos platform authorization', async () => {
    requestMocks.post
      .mockResolvedValueOnce({ data: { sessionToken: 'session-token' } })
      .mockResolvedValueOnce({
        data: {
          id: '31',
          resourceId: '11',
          authorizationStatus: 3,
          usageStatus: 1,
          version: '1',
        },
      })
    requestMocks.delete.mockResolvedValue({ data: undefined })

    await expect(createPlatformAuthorizationSession(1, '11', '31')).resolves.toBe(
      'session-token',
    )
    await expect(
      updateUserPlatform('zhihu', {
        cookie: 'encrypted-secret',
        isActive: true,
        platformLabel: '知乎',
        sessionToken: 'session-token',
        driverType: 2,
      }),
    ).resolves.toMatchObject({ id: '31', resourceId: '11', isActive: true })
    await deleteUserPlatform('31', '1')

    expect(requestMocks.post).toHaveBeenNthCalledWith(
      1,
      '/api/user/v1/platform-accounts/authorization-sessions',
      {
        deviceId: 'device-1',
        resourceType: 1,
        resourceId: '11',
        platformAccountId: '31',
      },
    )
    expect(requestMocks.post).toHaveBeenNthCalledWith(
      2,
      '/api/user/v1/client/authorization-sessions/session-token:submit',
      expect.objectContaining({
        sessionToken: 'session-token',
        accountName: '知乎',
        credentialPayload: 'encrypted-secret',
        clientVersion: '0.1.0',
      }),
    )
    expect(requestMocks.delete).toHaveBeenCalledWith(
      '/api/user/v1/platform-accounts/31',
      { params: { version: '1' } },
    )
  })
})
