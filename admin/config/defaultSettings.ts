import type { ProLayoutProps } from '@ant-design/pro-components';

/**
 * @name
 */
const Settings: ProLayoutProps & {
  logo?: string;
} = {
  navTheme: 'light',
  colorPrimary: '#1677ff',
  layout: 'mix',
  contentWidth: 'Fluid',
  fixedHeader: false,
  fixSiderbar: true,
  colorWeak: false,
  title: 'GEO 运营管理平台',
  logo: '/logo.svg',
  iconfontUrl: '',
  token: {
    bgLayout: 'transparent',
    header: {
      colorBgHeader: 'rgba(255, 255, 255, 0.3)',
      colorBgScrollHeader: 'rgba(248, 251, 255, 0.72)',
      colorBgMenuItemHover: 'rgba(255, 255, 255, 0.28)',
      colorBgMenuItemSelected: 'rgba(255, 255, 255, 0.38)',
      colorBgRightActionsItemHover: 'rgba(255, 255, 255, 0.28)',
    },
    sider: {
      colorMenuBackground: 'rgba(255, 255, 255, 0.22)',
      colorBgMenuItemHover: 'rgba(255, 255, 255, 0.3)',
      colorBgMenuItemActive: 'rgba(255, 255, 255, 0.28)',
      colorBgMenuItemSelected: 'rgba(255, 255, 255, 0.42)',
      colorBgCollapsedButton: 'rgba(255, 255, 255, 0.46)',
    },
    pageContainer: {
      colorBgPageContainer: 'transparent',
      colorBgPageContainerFixed: 'rgba(248, 251, 255, 0.76)',
    },
  },
};

export default Settings;
