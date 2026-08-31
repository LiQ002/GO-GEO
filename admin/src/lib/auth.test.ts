import { describe, expect, it } from 'vitest';
import { normalizeAuthSession } from './auth';

describe('normalizeAuthSession', () => {
  it('keeps an OpenAPI camelCase response unchanged', () => {
    const response = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessExpiresAt: '2026-07-19T10:00:00Z',
      admin: {
        id: '1',
        username: 'admin',
        displayName: '平台管理员',
      },
    };

    expect(normalizeAuthSession(response)).toMatchObject(response);
  });

  it('normalizes a legacy Kratos snake_case response', () => {
    expect(
      normalizeAuthSession({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        access_expires_at: '2026-07-19T10:00:00Z',
        admin: {
          id: '1',
          username: 'admin',
          display_name: '平台管理员',
          last_login_at: '2026-07-19T09:00:00Z',
        },
      }),
    ).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessExpiresAt: '2026-07-19T10:00:00Z',
      admin: {
        displayName: '平台管理员',
        lastLoginAt: '2026-07-19T09:00:00Z',
      },
    });
  });
});
