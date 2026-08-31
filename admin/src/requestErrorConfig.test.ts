import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorConfig } from './requestErrorConfig';

const mocks = vi.hoisted(() => ({
  clearAuthSession: vi.fn(),
  getAccessToken: vi.fn((): string | undefined => 'access-token'),
  refreshAccessToken: vi.fn(),
  showRequestError: vi.fn(),
  showRequestMessage: vi.fn(),
}));

vi.mock('@/components/RequestFeedbackBridge', () => ({
  showRequestError: mocks.showRequestError,
  showRequestMessage: mocks.showRequestMessage,
}));

vi.mock('@/lib/auth', () => ({
  clearAuthSession: mocks.clearAuthSession,
  getAccessToken: mocks.getAccessToken,
  refreshAccessToken: mocks.refreshAccessToken,
}));

vi.mock('@umijs/max', () => ({
  getIntl: vi.fn(() => ({
    formatMessage: vi.fn(({ defaultMessage }) => defaultMessage),
  })),
}));

describe('requestErrorConfig', () => {
  // biome-ignore lint/style/noNonNullAssertion: config handlers are always defined
  const errorHandler = errorConfig.errorConfig!.errorHandler!;
  const interceptor = errorConfig.requestInterceptors?.[0] as (config: {
    headers?: Record<string, string>;
    url?: string;
  }) => { headers?: Record<string, string>; url?: string };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccessToken.mockReturnValue('access-token');
  });

  it('rethrows errors when the caller handles them', () => {
    const error = new Error('handled by caller');
    expect(() => errorHandler(error, { skipErrorHandler: true })).toThrow(
      'handled by caller',
    );
  });

  it('shows the Kratos reason and message', () => {
    errorHandler(
      {
        response: {
          status: 409,
          data: { reason: 'ARTICLE_TYPE_CONFLICT', message: '版本已变更' },
        },
      } as never,
      {},
    );

    expect(mocks.showRequestError).toHaveBeenCalledWith(
      'ARTICLE_TYPE_CONFLICT',
      '版本已变更',
    );
  });

  it('clears the local session after an unauthorized response', () => {
    errorHandler(
      { response: { status: 401, data: { message: '未登录' } } } as never,
      {},
    );

    expect(mocks.clearAuthSession).toHaveBeenCalledOnce();
  });

  it('shows an offline message', () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    try {
      errorHandler({ request: {} } as never, {});
      expect(mocks.showRequestMessage).toHaveBeenCalledWith(
        'Network unavailable. Please check your connection and try again.',
      );
    } finally {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        value: originalOnLine,
      });
    }
  });

  it('attaches the current bearer token', () => {
    const result = interceptor({ url: '/api/admin/v1/auth/me' });
    expect(result.headers?.Authorization).toBe('Bearer access-token');
  });

  it('leaves headers unchanged when no token is stored', () => {
    mocks.getAccessToken.mockReturnValue(undefined);
    const result = interceptor({ url: '/api/admin/v1/auth/login' });
    expect(result.headers).toBeUndefined();
  });
});
