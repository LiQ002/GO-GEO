import { ConfigProvider } from 'antd';
import type { ConfigProviderProps } from 'antd';
import { createStyles } from 'antd-style';
import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';

const glassShadow = [
  '0 8px 24px rgba(67, 87, 122, 0.12)',
  'inset 0 0 5px 2px rgba(255, 255, 255, 0.34)',
  'inset 0 5px 2px rgba(255, 255, 255, 0.24)',
].join(',');

const glassPanelShadow = [
  '0 12px 32px rgba(43, 63, 98, 0.12)',
  '0 4px 12px rgba(43, 63, 98, 0.08)',
  'inset 0 1px 0 rgba(255, 255, 255, 0.62)',
].join(',');

const useStyles = createStyles(({ css, cssVar }) => {
  const glassBorder = {
    boxShadow: glassShadow,
  };
  const glassBox = {
    ...glassBorder,
    background: `color-mix(in srgb, ${cssVar.colorBgContainer} 32%, transparent)`,
    backdropFilter: 'blur(12px) saturate(145%)',
    WebkitBackdropFilter: 'blur(12px) saturate(145%)',
  };

  return {
    root: css({
      position: 'relative',
      isolation: 'isolate',
      width: '100%',
      height: '100%',
      minHeight: '100vh',
      overflow: 'auto',
      background: [
        'radial-gradient(circle at 10% 8%, rgba(99, 176, 255, 0.38), transparent 31%)',
        'radial-gradient(circle at 92% 16%, rgba(170, 126, 255, 0.3), transparent 30%)',
        'radial-gradient(circle at 76% 94%, rgba(91, 222, 190, 0.2), transparent 28%)',
        'linear-gradient(135deg, #eaf3ff 0%, #f7faff 48%, #f2efff 100%)',
      ].join(','),
      backgroundAttachment: 'fixed',

      '&::before': {
        position: 'fixed',
        zIndex: -1,
        inset: 0,
        pointerEvents: 'none',
        content: '""',
        background:
          'linear-gradient(115deg, rgba(255,255,255,0.32), transparent 35%, rgba(255,255,255,0.18) 68%, transparent)',
      },

      '& .ant-layout, & .ant-pro-layout, & .ant-pro-layout-bg-list': {
        background: 'transparent !important',
      },

      '& .ant-pro-layout .ant-pro-sider, & .ant-pro-layout-header': {
        borderColor: 'rgba(255, 255, 255, 0.5) !important',
        background: 'rgba(255, 255, 255, 0.3) !important',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.58)',
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
      },

      '& .ant-pro-layout .ant-pro-sider': {
        borderInlineEnd: '1px solid rgba(255, 255, 255, 0.46)',
      },

      '& .ant-pro-layout-header': {
        borderBlockEnd: '1px solid rgba(255, 255, 255, 0.46)',
      },

      '& .ant-pro-page-container-warp-page-header, & .ant-page-header': {
        background: 'transparent !important',
      },

      '& .ant-pro-card, & .ant-card': {
        border: '1px solid rgba(255, 255, 255, 0.58)',
        background: 'rgba(255, 255, 255, 0.42)',
        boxShadow: glassPanelShadow,
        backdropFilter: 'blur(16px) saturate(145%)',
        WebkitBackdropFilter: 'blur(16px) saturate(145%)',
      },

      '& .ant-pro-card .ant-pro-card, & .ant-card .ant-card': {
        background: 'rgba(255, 255, 255, 0.26)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.48)',
      },

      '& .ant-pro-table-list-toolbar, & .ant-pro-table-search, & .ant-table-wrapper, & .ant-table': {
        background: 'transparent !important',
      },

      '& .ant-table-container': {
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.44)',
        borderRadius: cssVar.borderRadiusLG,
        background: 'rgba(255, 255, 255, 0.2)',
      },

      '& .ant-table-thead > tr > th': {
        background: 'rgba(255, 255, 255, 0.4) !important',
        borderBlockEndColor: 'rgba(105, 128, 164, 0.14) !important',
      },

      '& .ant-table-tbody > tr > td': {
        borderBlockEndColor: 'rgba(105, 128, 164, 0.12) !important',
        background: 'transparent',
      },

      '& .ant-table-tbody > tr:hover > td': {
        background: 'rgba(255, 255, 255, 0.38) !important',
      },

      '& .ant-table-cell-fix-left, & .ant-table-cell-fix-right': {
        background: 'rgba(247, 250, 255, 0.86) !important',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      },

      '& .ant-pagination-item, & .ant-pagination-prev button, & .ant-pagination-next button': {
        borderColor: 'rgba(255, 255, 255, 0.5) !important',
        background: 'rgba(255, 255, 255, 0.28) !important',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.46)',
      },

      '& .ant-pro-form-login-main': {
        padding: '36px 40px 32px',
        border: '1px solid rgba(255, 255, 255, 0.62)',
        borderRadius: 24,
        background: 'rgba(255, 255, 255, 0.4)',
        boxShadow: '0 24px 64px rgba(50, 74, 112, 0.18), inset 0 1px 0 rgba(255,255,255,0.72)',
        backdropFilter: 'blur(22px) saturate(150%)',
        WebkitBackdropFilter: 'blur(22px) saturate(150%)',
      },

      '& .ant-modal-mask, & .ant-drawer-mask': {
        background: 'rgba(35, 50, 78, 0.18) !important',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
      },

      '& .ant-modal-content, & .ant-drawer-content, & .ant-popover-inner, & .ant-dropdown-menu': {
        border: '1px solid rgba(255, 255, 255, 0.58)',
        background: 'rgba(248, 251, 255, 0.72) !important',
        boxShadow: glassPanelShadow,
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
      },

      '& .ant-input, & .ant-input-affix-wrapper, & .ant-input-number, & .ant-picker, & .ant-select-selector, & .ant-segmented': {
        borderColor: 'rgba(255, 255, 255, 0.58) !important',
        background: 'rgba(255, 255, 255, 0.3) !important',
        boxShadow: glassShadow,
      },

      '& .ant-input-affix-wrapper .ant-input': {
        boxShadow: 'none',
      },

      '& .ant-btn': {
        transition: 'transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease',
      },

      '& .ant-btn:hover': {
        transform: 'translateY(-1px)',
      },

      '@supports not ((backdrop-filter: blur(1px)))': {
        '& .ant-pro-card, & .ant-card, & .ant-pro-layout .ant-pro-sider, & .ant-pro-layout-header': {
          background: 'rgba(248, 251, 255, 0.94) !important',
        },
      },

      '@media (max-width: 768px)': {
        '& .ant-pro-form-login-main': {
          width: 'calc(100vw - 32px)',
          padding: '28px 24px 24px',
        },
      },
    }),
    app: css({
      textShadow: '0 1px rgba(0, 0, 0, 0.06)',
    }),
    glassBox: css(glassBox),
    glassBoxWithoutBlur: css({
      ...glassBox,
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    }),
    glassBorder: css(glassBorder),
    cardRoot: css({
      ...glassBox,
      backgroundColor: `color-mix(in srgb, ${cssVar.colorBgContainer} 42%, transparent)`,
    }),
    modalContainer: css({
      ...glassBox,
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    }),
    buttonRoot: css(glassBorder),
    buttonRootDefault: css({
      background: 'rgba(255, 255, 255, 0.16)',
      color: cssVar.colorText,
      '&:hover': {
        background: 'rgba(255, 255, 255, 0.3)',
        color: cssVar.colorText,
      },
      '&:active': {
        background: 'rgba(255, 255, 255, 0.2)',
      },
    }),
    buttonRootDanger: css({
      background: 'rgba(255, 120, 117, 0.1)',
      borderColor: 'rgba(255, 120, 117, 0.24)',
      color: cssVar.colorError,
    }),
    dropdownRoot: css({
      ...glassBox,
      borderRadius: cssVar.borderRadiusLG,
      '& ul': { background: 'transparent' },
    }),
    notificationRoot: css({
      '&.ant-notification-notice, & .ant-notification-notice': {
        ...glassBox,
        background: `color-mix(in srgb, ${cssVar.colorBgContainer} 54%, transparent)`,
      },
    }),
    switchRoot: css({
      ...glassBorder,
      border: 'none',
    }),
    segmentedRoot: css({
      ...glassBorder,
      background: 'transparent',
      backdropFilter: 'none',
      '& .ant-segmented-thumb, & .ant-segmented-item-selected': glassBox,
    }),
    radioButtonRoot: css({
      '&.ant-radio-button-wrapper': {
        ...glassBorder,
        background: 'transparent',
        borderColor: 'rgba(255, 255, 255, 0.36)',
        color: cssVar.colorText,
        '&.ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled)': {
          ...glassBox,
          borderColor: 'rgba(255, 255, 255, 0.48)',
          color: cssVar.colorText,
        },
      },
    }),
  };
});

const GlassThemeProvider = ({ children }: PropsWithChildren) => {
  const { styles } = useStyles();

  const config = useMemo<ConfigProviderProps>(
    () => ({
      theme: {
        token: {
          borderRadius: 12,
          borderRadiusLG: 12,
          borderRadiusSM: 12,
          borderRadiusXS: 12,
          motionDurationSlow: '0.2s',
          motionDurationMid: '0.1s',
          motionDurationFast: '0.05s',
          boxShadow: glassPanelShadow,
          boxShadowSecondary: glassPanelShadow,
        },
        components: {
          Button: {
            primaryShadow: 'none',
            dangerShadow: 'none',
            defaultShadow: 'none',
            defaultBg: 'rgba(255, 255, 255, 0.16)',
            defaultBorderColor: 'rgba(255, 255, 255, 0.32)',
            defaultHoverBg: 'rgba(255, 255, 255, 0.3)',
            defaultHoverBorderColor: 'rgba(255, 255, 255, 0.44)',
            defaultActiveBg: 'rgba(255, 255, 255, 0.2)',
            defaultActiveBorderColor: 'rgba(255, 255, 255, 0.38)',
          },
          Layout: {
            bodyBg: 'transparent',
            footerBg: 'transparent',
            headerBg: 'rgba(255, 255, 255, 0.3)',
            siderBg: 'rgba(255, 255, 255, 0.24)',
            triggerBg: 'rgba(255, 255, 255, 0.28)',
          },
          Menu: {
            activeBarBorderWidth: 0,
            itemActiveBg: 'rgba(255, 255, 255, 0.26)',
            itemBg: 'transparent',
            itemHoverBg: 'rgba(255, 255, 255, 0.3)',
            itemSelectedBg: 'rgba(255, 255, 255, 0.42)',
            subMenuItemBg: 'transparent',
          },
          Notification: {
            colorSuccessBg: 'rgba(183, 235, 143, 0.24)',
            colorErrorBg: 'rgba(255, 120, 117, 0.2)',
            colorInfoBg: 'rgba(145, 202, 255, 0.24)',
            colorWarningBg: 'rgba(255, 229, 143, 0.24)',
          },
          Progress: {
            remainingColor: 'rgba(255, 255, 255, 0.32)',
          },
        },
      },
      app: { className: styles.app },
      card: { classNames: { root: styles.cardRoot } },
      modal: { classNames: { container: styles.modalContainer } },
      button: {
        classNames: ({ props }) => ({
          root: [
            styles.buttonRoot,
            props.color === 'default' ? styles.buttonRootDefault : '',
            props.color === 'danger' ? styles.buttonRootDanger : '',
          ]
            .filter(Boolean)
            .join(' '),
        }),
      },
      alert: { className: styles.glassBoxWithoutBlur },
      dropdown: { classNames: { root: styles.dropdownRoot } },
      select: {
        classNames: {
          root: styles.glassBoxWithoutBlur,
          popup: { root: styles.glassBox },
        },
      },
      datePicker: {
        classNames: {
          root: styles.glassBoxWithoutBlur,
          popup: { container: styles.glassBox },
        },
      },
      input: { classNames: { root: styles.glassBoxWithoutBlur } },
      inputNumber: { classNames: { root: styles.glassBoxWithoutBlur } },
      popover: { classNames: { container: styles.glassBox } },
      notification: { classNames: { root: styles.notificationRoot } },
      switch: { classNames: { root: styles.switchRoot } },
      radio: { classNames: { root: styles.radioButtonRoot } },
      segmented: { className: styles.segmentedRoot },
      progress: {
        classNames: { track: styles.glassBorder },
        styles: { track: { height: 12 }, rail: { height: 12 } },
      },
    }),
    [styles],
  );

  return (
    <ConfigProvider {...config}>
      <div className={styles.root}>{children}</div>
    </ConfigProvider>
  );
};

export default GlassThemeProvider;
