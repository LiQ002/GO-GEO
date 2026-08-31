import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import { useAppStore } from '@/lib/store/useAppStore'
import { createAuthorizationHeader } from './authorization'
import { apiPath } from './path'
import {
  accessTokenNeedsRefresh,
  authRefreshPath,
  RefreshCoordinator,
  type SessionRefreshKind,
} from './session-refresh'
import { getDefaultServerURL, normalizeServerURL } from './server-url'
import { isOperatorMode } from '@/lib/app-mode'

const DEFAULT_SERVER_URL = getDefaultServerURL()
const API_TIMEOUT_MS = 30_000

type AuthRefreshResponse = {
  accessToken?: string
  refreshToken?: string
}

type SessionRefreshResult = {
  kind: SessionRefreshKind
}

type SessionAwareRequestConfig = InternalAxiosRequestConfig & {
  _sessionAccessToken?: string
  _sessionRefreshAttempt?: SessionRefreshKind
  _sessionRetry?: boolean
}

export { normalizeServerURL } from './server-url'

function getInitialBaseURL(): string {
  if (typeof window === 'undefined') return DEFAULT_SERVER_URL
  try {
    return normalizeServerURL(localStorage.getItem(STORAGE_KEYS.serverUrl()) || DEFAULT_SERVER_URL)
  } catch {
    localStorage.removeItem(STORAGE_KEYS.serverUrl())
    return DEFAULT_SERVER_URL
  }
}

let baseURL = getInitialBaseURL()
let handlingUnauthorized = false
const refreshCoordinator = new RefreshCoordinator<SessionRefreshResult>(10_000)

function clearAuthStorage() {
  localStorage.removeItem(STORAGE_KEYS.token())
  localStorage.removeItem(STORAGE_KEYS.refreshToken())
  localStorage.removeItem(STORAGE_KEYS.user())
  localStorage.removeItem(STORAGE_KEYS.appStore())
  void window.electronAPI?.authSession.clear()
  useAppStore.setState({
    token: null,
    refreshToken: null,
    currentUser: null,
    isLoggedIn: false,
  })
}

function handleUnauthorized(requestUrl?: string) {
  if (handlingUnauthorized) return
  // Worker credentials are independent from the signed-in administrator session.
  // An expired worker token must not sign the administrator out.
  if (requestUrl?.startsWith('/api/worker/')) return
  if (requestUrl && /\/api\/(?:enterprise|admin)\/login\b|\/api\/(?:admin|user)\/v1\/auth\/login\b/.test(requestUrl)) return

  handlingUnauthorized = true
  clearAuthStorage()
  if (/\/login\/?$/.test(window.location.pathname)) {
    handlingUnauthorized = false
    return
  }
  window.location.replace('/login')
}

function shouldSkipSessionRefresh(requestUrl?: string): boolean {
  if (!requestUrl) return false
  return (
    requestUrl.startsWith('/api/worker/') ||
    /\/api\/(?:admin|user)\/v1\/auth\/(?:login|refresh)\b/.test(requestUrl)
  )
}

async function performSessionRefresh(refreshToken: string): Promise<SessionRefreshResult> {
  try {
    const { data } = await axios.post<AuthRefreshResponse>(
      `${baseURL}${authRefreshPath(isOperatorMode())}`,
      { refreshToken },
      { timeout: API_TIMEOUT_MS },
    )
    const accessToken = data.accessToken?.trim() || ''
    const nextRefreshToken = data.refreshToken?.trim() || ''
    if (!accessToken || !nextRefreshToken) return { kind: 'unavailable' }

    try {
      await useAppStore.getState().replaceAuthTokens(accessToken, nextRefreshToken)
    } catch {
      // The server has already rotated the refresh token. Keep the new pair in memory
      // so the current session remains usable even if secure persistence is unavailable.
      useAppStore.setState({ token: accessToken, refreshToken: nextRefreshToken })
      useAppStore.getState().addToast(
        'warning',
        '登录已续期，但安全存储更新失败，重启软件后可能需要重新登录',
      )
    }
    return { kind: 'success' }
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined
    return status && [400, 401, 403].includes(status)
      ? { kind: 'invalid' }
      : { kind: 'unavailable' }
  }
}

/** Refreshes the active client/operator session only when needed unless forced after a 401. */
export async function refreshAuthSession(force = false): Promise<SessionRefreshResult> {
  const { isLoggedIn, refreshToken, token } = useAppStore.getState()
  if (!isLoggedIn) return { kind: 'not-needed' }
  if (!refreshToken) {
    handleUnauthorized()
    return { kind: 'invalid' }
  }
  if (!force && !accessTokenNeedsRefresh(token)) return { kind: 'not-needed' }

  const result = await refreshCoordinator.run(
    refreshToken,
    () => performSessionRefresh(refreshToken),
    (value) => value.kind === 'success',
  )
  if (result.kind === 'invalid') handleUnauthorized()
  return result
}

function createClient(url: string): AxiosInstance {
  const client = axios.create({
    baseURL: normalizeServerURL(url),
    timeout: API_TIMEOUT_MS,
  })

  client.interceptors.request.use(async (config: SessionAwareRequestConfig) => {
    if (!shouldSkipSessionRefresh(config.url)) {
      const refresh = await refreshAuthSession()
      config._sessionRefreshAttempt = refresh.kind
      if (refresh.kind === 'invalid') {
        throw new Error('登录状态已失效，请重新登录')
      }
    }
    const token = useAppStore.getState().token
    if (token) {
      config._sessionAccessToken = token
      config.headers.Authorization = createAuthorizationHeader(token)
    }
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status !== 401) return Promise.reject(error)

      const requestConfig = error.config as SessionAwareRequestConfig | undefined
      const requestUrl = requestConfig?.url
      if (!requestConfig || shouldSkipSessionRefresh(requestUrl)) {
        handleUnauthorized(requestUrl)
        return Promise.reject(error)
      }

      const previousAttempt = requestConfig._sessionRefreshAttempt
      const currentToken = useAppStore.getState().token
      if (
        !requestConfig._sessionRetry &&
        currentToken &&
        currentToken !== requestConfig._sessionAccessToken
      ) {
        requestConfig._sessionRetry = true
        requestConfig.headers.Authorization = createAuthorizationHeader(currentToken)
        return client.request(requestConfig)
      }
      if (
        !requestConfig._sessionRetry &&
        previousAttempt !== 'success' &&
        previousAttempt !== 'unavailable'
      ) {
        const refresh = await refreshAuthSession(true)
        if (refresh.kind === 'success') {
          requestConfig._sessionRetry = true
          const refreshedToken = useAppStore.getState().token
          if (refreshedToken) {
            requestConfig.headers.Authorization = createAuthorizationHeader(refreshedToken)
          }
          return client.request(requestConfig)
        }
        if (refresh.kind === 'unavailable') return Promise.reject(error)
      }

      // A transient refresh failure must not destroy a still-recoverable session.
      if (previousAttempt === 'unavailable') return Promise.reject(error)
      handleUnauthorized(requestUrl)
      return Promise.reject(error)
    },
  )

  return client
}

export let http = createClient(baseURL)

export function updateBaseURL(url: string): void {
  baseURL = normalizeServerURL(url)
  localStorage.setItem(STORAGE_KEYS.serverUrl(), baseURL)
  http = createClient(baseURL)
}

export function getBaseURL(): string {
  return baseURL
}

export async function checkServerHealth(url: string): Promise<void> {
  const path = isOperatorMode()
    ? apiPath('/api/admin/v1/auth/me')
    : apiPath('/api/user/v1/auth/me')
  await axios.get(normalizeServerURL(url) + path, {
    timeout: 10_000,
    validateStatus: (status) =>
      (status >= 200 && status < 300) || status === 401 || status === 403,
  })
}

export function getApiErrorMessage(error: unknown, fallback = '请求失败'): string {
  const data = (error as { response?: { data?: { detail?: unknown; message?: string } } })
    ?.response?.data
  if (typeof data?.detail === 'string' && data.detail) return data.detail
  if (Array.isArray(data?.detail)) {
    const messages = data.detail
      .map((item) => (typeof item === 'object' && item && 'msg' in item ? String(item.msg) : ''))
      .filter(Boolean)
    if (messages.length) return messages.join('; ')
  }
  if (data?.message) return data.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}
