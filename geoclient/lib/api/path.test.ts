import { describe, expect, it } from 'vitest'
import { apiPath } from './path'

describe('OpenAPI paths', () => {
  it('builds static paths', () => {
    expect(apiPath('/api/admin/v1/auth/login')).toBe('/api/admin/v1/auth/login')
    expect(apiPath('/api/admin/v1/dashboard')).toBe('/api/admin/v1/dashboard')
    expect(apiPath('/api/user/v1/inclusion-sites')).toBe('/api/user/v1/inclusion-sites')
    expect(apiPath('/api/user/v1/publish-channels')).toBe('/api/user/v1/publish-channels')
  })

  it('encodes path parameters', () => {
    expect(
      apiPath('/api/client/ops/publish-tasks/{task_id}/lease', { task_id: 'task/1' }),
    ).toBe('/api/client/ops/publish-tasks/task%2F1/lease')
  })
})
