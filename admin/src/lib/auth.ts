const AUTH_STORAGE_KEY = 'geo-admin-auth';
const DEVICE_STORAGE_KEY = 'geo-admin-device-id';

type AuthSession = Pick<
  API.AdminLoginReply,
  'accessToken' | 'refreshToken' | 'accessExpiresAt'
>;

type LegacyAdminProfile = API.AdminProfile & {
  display_name?: string;
  last_login_at?: string;
};

type LegacyAdminLoginReply = API.AdminLoginReply & {
  access_token?: string;
  refresh_token?: string;
  access_expires_at?: string;
  admin?: LegacyAdminProfile;
};

let refreshPromise: Promise<boolean> | undefined;

export const normalizeAuthSession = (
  response: LegacyAdminLoginReply,
): API.AdminLoginReply => {
  const admin = response.admin;
  return {
    ...response,
    accessToken: response.accessToken ?? response.access_token,
    refreshToken: response.refreshToken ?? response.refresh_token,
    accessExpiresAt: response.accessExpiresAt ?? response.access_expires_at,
    admin: admin
      ? {
          ...admin,
          displayName: admin.displayName ?? admin.display_name,
          lastLoginAt: admin.lastLoginAt ?? admin.last_login_at,
        }
      : undefined,
  };
};

const readSession = (): AuthSession | undefined => {
  if (typeof window === 'undefined') return undefined;
  const raw =
    window.localStorage.getItem(AUTH_STORAGE_KEY) ??
    window.sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return undefined;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    clearAuthSession();
    return undefined;
  }
};

export const saveAuthSession = (session: AuthSession, persistent = true) => {
  clearAuthSession();
  const storage = persistent ? window.localStorage : window.sessionStorage;
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const clearAuthSession = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
  }
};

export const getAccessToken = () => readSession()?.accessToken;

export const getDeviceId = () => {
  const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY);
  if (existing) return existing;

  const deviceId =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `browser-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
  return deviceId;
};

const refreshSession = async () => {
  const refreshToken = readSession()?.refreshToken;
  if (!refreshToken) return false;
  const persistent = window.localStorage.getItem(AUTH_STORAGE_KEY) !== null;

  const response = await fetch('/api/admin/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    clearAuthSession();
    return false;
  }

  const session = normalizeAuthSession(
    (await response.json()) as LegacyAdminLoginReply,
  );
  if (!session.accessToken || !session.refreshToken) {
    clearAuthSession();
    return false;
  }
  saveAuthSession(session, persistent);
  return true;
};

export const refreshAccessToken = () => {
  refreshPromise ??= refreshSession().finally(() => {
    refreshPromise = undefined;
  });
  return refreshPromise;
};
