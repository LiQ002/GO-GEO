export default [
  {
    path: '/user',
    layout: false,
    routes: [
      {
        name: '登录',
        path: '/user/login',
        component: './user/login',
      },
    ],
  },
  {
    path: '/dashboard',
    name: '运营总览',
    icon: 'dashboard',
    access: 'canDashboard',
    component: './dashboard',
  },
  {
    path: '/sales/diagnoses/:id/report',
    component: './sales/diagnoses/report',
    layout: false,
    access: 'canSalesDiagnosisRead',
    hideInMenu: true,
  },
  {
    path: '/customers',
    name: '企业与套餐',
    icon: 'team',
    access: 'canEnterpriseManage',
    routes: [
      {
        path: '/customers',
        redirect: '/customers/enterprises',
      },
      {
        path: '/customers/enterprises',
        name: '企业管理',
        component: './enterprises',
      },
      {
        path: '/customers/plans',
        name: '套餐管理',
        component: './plans',
      },
      {
        path: '/customers/orders',
        name: '订单管理',
        component: './orders',
      },
    ],
  },
  {
    path: '/sales',
    name: '售前支持',
    icon: 'solution',
    access: 'canSalesOpportunityRead',
    routes: [
      {
        path: '/sales',
        redirect: '/sales/opportunities',
      },
      {
        path: '/sales/opportunities',
        name: '销售机会',
        component: './sales/opportunities',
      },
      {
        path: '/sales/diagnoses',
        name: '诊断记录',
        component: './sales/diagnoses',
        access: 'canSalesDiagnosisRead',
      },
      {
        path: '/sales/diagnoses/new',
        name: '发起诊断',
        component: './sales/diagnoses/new',
        access: 'canSalesDiagnosisManage',
        hideInMenu: true,
      },
      {
        path: '/sales/diagnoses/:id',
        name: '诊断详情',
        component: './sales/diagnoses/detail',
        access: 'canSalesDiagnosisRead',
        hideInMenu: true,
      },
    ],
  },
  {
    path: '/operations',
    name: '运营工作台',
    icon: 'control',
    access: 'canAdmin',
    routes: [
      { path: '/operations', redirect: '/operations/articles' },
      {
        path: '/operations/articles',
        name: '文章审核',
        component: './operations/articles',
        access: 'canArticleManage',
      },
      {
        path: '/operations/publish-tasks',
        name: '发布任务',
        component: './operations/publish-tasks',
        access: 'canPublishTaskManage',
      },
      {
        path: '/operations/geo-tasks',
        name: 'GEO 检测任务',
        component: './operations/geo-tasks',
        access: 'canGeoTaskManage',
      },
      {
        path: '/operations/workers',
        name: '工作节点',
        component: './operations/workers',
        access: 'canWorkerManage',
      },
      {
        path: '/operations/alerts',
        name: '运行告警',
        component: './operations/alerts',
        access: 'canAlertManage',
      },
      {
        path: '/operations/realname-review',
        name: '实名审核',
        component: './operations/realname-review',
        access: 'canAdmin',
      },
    ],
  },
  {
    path: '/content-config',
    name: '内容与模型',
    icon: 'fileText',
    access: 'canContentConfigManage',
    routes: [
      {
        path: '/content-config',
        redirect: '/content-config/article-types',
      },
      {
        path: '/content-config/article-types',
        name: '文章类型',
        component: './article-types',
      },
      {
        path: '/content-config/writing-models',
        name: '编写模型',
        component: './writing-models',
      },
    ],
  },
  {
    path: '/distribution',
    name: '投放与监测',
    icon: 'deploymentUnit',
    access: 'canDistributionConfigManage',
    routes: [
      {
        path: '/distribution',
        redirect: '/distribution/self-media',
      },
      {
        path: '/distribution/self-media',
        name: '自媒体渠道',
        component: './self-media',
      },
      {
        path: '/distribution/self-media-authorizations',
        name: '自媒体客户授权',
        component: './self-media-authorizations',
      },
      {
        path: '/distribution/publish-channels',
        name: '媒体投稿渠道',
        component: './publish-channels',
      },
      {
        path: '/distribution/inclusion-sites',
        name: 'GEO 检查站点',
        component: './inclusion-sites',
      },
      {
        path: '/distribution/inclusion-site-authorizations',
        name: '检测站点客户授权',
        component: './inclusion-site-authorizations',
      },
      {
        path: '/distribution/customer-authorizations',
        redirect: '/distribution/self-media-authorizations',
        hideInMenu: true,
      },
    ],
  },
  {
    path: '/system',
    name: '系统治理',
    icon: 'setting',
    access: 'canAdmin',
    routes: [
      { path: '/system', redirect: '/system/settings' },
      {
        path: '/system/admin-users',
        name: '平台账号',
        component: './system/admin-users',
        access: 'canRbacManage',
      },
      {
        path: '/system/admin-roles',
        name: '角色权限',
        component: './system/admin-roles',
        access: 'canRbacManage',
      },
      {
        path: '/system/settings',
        name: '系统配置',
        component: './system/settings',
        access: 'canSystemSettingsManage',
      },
      {
        path: '/system/billing-config',
        name: '计费配置',
        component: './system/billing-config',
        access: 'canSystemSettingsManage',
      },
      {
        path: '/system/audit-logs',
        name: '审计日志',
        component: './system/audit-logs',
        access: 'canAuditRead',
      },
    ],
  },
  {
    path: '/account',
    name: '账号与安全',
    icon: 'safetyCertificate',
    access: 'canAdmin',
    routes: [
      {
        path: '/account',
        redirect: '/account/settings',
      },
      {
        path: '/account/settings',
        name: '我的账号',
        component: './account-security',
      },
    ],
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    component: './exception/404',
    layout: false,
    path: './*',
  },
];
