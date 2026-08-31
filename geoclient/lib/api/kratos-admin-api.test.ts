import { beforeEach, describe, expect, it, vi } from 'vitest'

const requestMocks = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('./core', () => ({ http: requestMocks }))

import { getOperatorArticles, getStats, getUser, getUsers } from './operator'

describe('Kratos admin API integration', () => {
  beforeEach(() => {
    requestMocks.get.mockReset()
  })

  it('loads enterprises from the admin API and maps account details', async () => {
    requestMocks.get.mockResolvedValue({
      data: {
        items: [
          {
            enterprise: {
              id: '7',
              code: 'demo',
              name: '示例企业',
              contactEmail: 'team@example.com',
              createdAt: '2026-07-01T00:00:00Z',
              updatedAt: '2026-07-02T00:00:00Z',
            },
            account: { username: 'demo-user', email: 'owner@example.com' },
            subscription: { expiresAt: '2027-07-01T00:00:00Z' },
            articleCount: '12',
            publishedCount: '8',
          },
        ],
        totalSize: '21',
      },
    })

    await expect(getUsers({ page: 2, pageSize: 20, search: '示例' })).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: 7,
          username: 'demo-user',
          name: '示例企业',
          email: 'owner@example.com',
          articleCount: 12,
          publishedCount: 8,
        }),
      ],
      total: 21,
      page: 2,
      pageSize: 20,
    })
    expect(requestMocks.get).toHaveBeenCalledWith('/api/admin/v1/enterprises', {
      params: { pageSize: 20, pageToken: 'MjA', keyword: '示例' },
    })
  })

  it('loads a single enterprise from the Kratos detail route', async () => {
    requestMocks.get.mockResolvedValue({
      data: { enterprise: { id: '7', code: 'demo', name: '示例企业' } },
    })

    await expect(getUser(7)).resolves.toMatchObject({ id: 7, username: 'demo' })
    expect(requestMocks.get).toHaveBeenCalledWith('/api/admin/v1/enterprises/7')
  })

  it('loads articles from the admin API and maps camel-case fields', async () => {
    requestMocks.get.mockResolvedValue({
      data: {
        items: [
          {
            id: '31',
            enterpriseId: '7',
            enterpriseName: '示例企业',
            title: '测试文章',
            summary: '文章摘要',
            articleTypeName: '品牌介绍',
            status: 'published',
            createdAt: '2026-07-20T00:00:00Z',
          },
        ],
        totalSize: '1',
      },
    })

    await expect(
      getOperatorArticles({ page: 1, pageSize: 10, userId: 7, status: 'published' }),
    ).resolves.toMatchObject({
      items: [
        {
          id: 31,
          userId: 7,
          userName: '示例企业',
          title: '测试文章',
          summary: '文章摘要',
          status: 'published',
        },
      ],
      total: 1,
    })
    expect(requestMocks.get).toHaveBeenCalledWith('/api/admin/v1/articles', {
      params: {
        pageSize: 10,
        pageToken: undefined,
        enterpriseId: 7,
        status: 'published',
        keyword: '',
      },
    })
  })

  it('builds dashboard statistics from the current admin endpoints', async () => {
    requestMocks.get
      .mockResolvedValueOnce({
        data: {
          metrics: [{ key: 'enterprises', value: '5' }],
          trends: [{ date: '2026-07-21', publishSucceeded: '3' }],
          activities: [{ id: '9', type: 'failed', message: '发布任务失败', createdAt: '2026-07-21T10:00:00Z' }],
          platformStats: [{ platform: 'wechat', label: '微信公众号', count: '5', successRate: 0.8 }],
        },
      })
      .mockResolvedValueOnce({ data: { totalSize: '18' } })
      .mockResolvedValueOnce({ data: { totalSize: '8' } })
      .mockResolvedValueOnce({ data: { totalSize: '2' } })

    await expect(getStats()).resolves.toMatchObject({
      totalUsers: 5,
      totalArticles: 18,
      publishedToday: 3,
      totalPublished: 8,
      successRate: 0.8,
      platformStats: [expect.objectContaining({ platform: 'wechat', count: 5, successRate: 0.8 })],
      recentActivity: [expect.objectContaining({ id: 9, message: '发布任务失败' })],
    })
    expect(requestMocks.get.mock.calls.map(([path]) => path)).toEqual([
      '/api/admin/v1/dashboard',
      '/api/admin/v1/articles',
      '/api/admin/v1/publish-tasks',
      '/api/admin/v1/publish-tasks',
    ])
  })
})
