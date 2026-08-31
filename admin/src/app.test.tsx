import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn((): string | undefined => 'access-token'),
  queryCurrentAdmin: vi.fn(),
  replace: vi.fn(),
}));

const mockHistory = {
  location: { pathname: '/welcome', search: '', hash: '' },
  replace: mocks.replace,
};

vi.mock('@umijs/max', () => ({
  history: mockHistory,
  Link: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/lib/auth', () => ({ getAccessToken: mocks.getAccessToken }));

vi.mock('@/services/geo-admin/adminAuthService', () => ({
  adminAuthServiceGetCurrentAdmin: mocks.queryCurrentAdmin,
}));

vi.mock('@/components', () => ({
  AvatarDropdown: () => null,
  DocLink: () => null,
  ErrorBoundary: ({ children }: { children: unknown }) => children,
  Footer: () => null,
  LangDropdown: () => null,
  OfflineBanner: () => null,
  VersionDropdown: () => null,
}));

vi.mock('@/components/RequestFeedbackBridge', () => ({
  RequestFeedbackBridge: () => null,
}));

vi.mock('@ant-design/pro-components', () => ({ SettingDrawer: () => null }));
vi.mock('@ant-design/icons', () => ({ LinkOutlined: () => null }));
vi.mock('./requestErrorConfig', () => ({ errorConfig: {} }));
vi.mock('../config/defaultSettings', () => ({
  default: { navTheme: 'light' },
}));

describe('app getInitialState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccessToken.mockReturnValue('access-token');
    mockHistory.location = { pathname: '/welcome', search: '', hash: '' };
  });

  it('fetches and maps the current administrator', async () => {
    const { getInitialState } = await import('./app');
    mocks.queryCurrentAdmin.mockResolvedValue({
      id: '7',
      username: 'admin',
      displayName: '运营管理员',
      email: 'admin@example.com',
      roles: ['operator'],
    });

    const state = await getInitialState();

    expect(mocks.queryCurrentAdmin).toHaveBeenCalled();
    expect(state.currentUser).toMatchObject({
      userid: '7',
      name: '运营管理员',
      access: 'admin',
    });
    expect(state.settingDrawerOpen).toBe(false);
  });

  it('redirects to login when the profile request fails', async () => {
    const { getInitialState } = await import('./app');
    mocks.queryCurrentAdmin.mockRejectedValue(new Error('401'));

    const state = await getInitialState();

    expect(mocks.replace).toHaveBeenCalledWith(
      expect.stringContaining('/user/login?redirect='),
    );
    expect(state.currentUser).toBeUndefined();
  });

  it('does not fetch on the login page', async () => {
    const { getInitialState } = await import('./app');
    mockHistory.location = { pathname: '/user/login', search: '', hash: '' };

    const state = await getInitialState();

    expect(mocks.queryCurrentAdmin).not.toHaveBeenCalled();
    expect(state.currentUser).toBeUndefined();
  });

  it('does not call the backend when no token is stored', async () => {
    const { getInitialState } = await import('./app');
    mocks.getAccessToken.mockReturnValue(undefined);

    const state = await getInitialState();

    expect(mocks.queryCurrentAdmin).not.toHaveBeenCalled();
    expect(state.currentUser).toBeUndefined();
  });

  it('includes default settings in initial state', async () => {
    const { getInitialState } = await import('./app');
    mocks.queryCurrentAdmin.mockResolvedValue({ username: 'admin' });

    const state = await getInitialState();
    expect(state.settings).toEqual({ navTheme: 'light' });
  });
});
