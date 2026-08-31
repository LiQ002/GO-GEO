import type {
  AxiosError,
  AxiosResponse,
  RequestOptions,
} from '@@/plugin-request/request';
import type { RequestConfig } from '@umijs/max';
import { getIntl } from '@umijs/max';
import {
  showRequestError,
  showRequestMessage,
} from '@/components/RequestFeedbackBridge';
import {
  clearAuthSession,
  getAccessToken,
  refreshAccessToken,
} from '@/lib/auth';

interface KratosError {
  code?: number;
  reason?: string;
  message?: string;
  metadata?: Record<string, string>;
}

const retryUnauthorizedRequest = async (rawError: Error) => {
  const error = rawError as AxiosError;
  const config = error.config as
    | (RequestOptions & { _retried?: boolean })
    | undefined;
  const isPublicAuthRequest =
    config?.url?.endsWith('/api/admin/v1/auth/login') ||
    config?.url?.endsWith('/api/admin/v1/auth/refresh');
  if (
    error.response?.status !== 401 ||
    !config ||
    config._retried ||
    isPublicAuthRequest
  ) {
    throw error;
  }

  config._retried = true;
  if (!(await refreshAccessToken())) throw error;
  const { request } = await import('@umijs/max');
  return request(config.url ?? '', {
    ...config,
    headers: {
      ...config.headers,
      Authorization: `Bearer ${getAccessToken()}`,
    },
    getResponse: true,
    skipErrorHandler: true,
  });
};

const refreshErrorInterceptor = retryUnauthorizedRequest as unknown as (
  error: Error,
) => Promise<Error>;

export const errorConfig: RequestConfig = {
  errorConfig: {
    errorHandler: (error: any, opts: any) => {
      if (opts?.skipErrorHandler) throw error;
      if (error.response) {
        const payload = error.response.data as KratosError | undefined;
        if (error.response.status === 401) {
          clearAuthSession();
        }
        showRequestError(
          payload?.reason || `HTTP ${error.response.status}`,
          payload?.message || '请求失败，请稍后重试',
        );
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        showRequestMessage(
          getIntl().formatMessage({
            id: 'app.request.offline',
            defaultMessage:
              'Network unavailable. Please check your connection and try again.',
          }),
        );
      } else if (error.request) {
        showRequestMessage('服务无响应，请检查网络或后端服务');
      } else {
        showRequestMessage('请求失败，请稍后重试');
      }
    },
  },
  requestInterceptors: [
    (config: RequestOptions) => {
      const token = getAccessToken();
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
      return config;
    },
  ],
  responseInterceptors: [
    [
      (response: AxiosResponse) => response,
      refreshErrorInterceptor,
    ],
  ],
};
