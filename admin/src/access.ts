/**
 * @see https://umijs.org/docs/max/access#access
 * */
export default function access(
  initialState: { currentUser?: API.CurrentUser } | undefined,
) {
  const { currentUser } = initialState ?? {};
  const permissions = currentUser?.permissions ?? [];
  const has = (permission: string) =>
    currentUser?.access === 'admin' &&
    (permissions.includes('platform.all') || permissions.includes(permission));
  return {
    canAdmin: currentUser && currentUser.access === 'admin',
    canDashboard: has('dashboard.read'),
    canEnterpriseManage: has('enterprise.manage'),
    canSalesOpportunityRead: has('sales.opportunity.read'),
    canSalesOpportunityManage: has('sales.opportunity.manage'),
    canSalesDiagnosisRead: has('sales.diagnosis.read'),
    canSalesDiagnosisManage: has('sales.diagnosis.manage'),
    canArticleManage: has('article.manage'),
    canPublishTaskManage: has('publish_task.manage'),
    canGeoTaskManage: has('geo_task.manage'),
    canWorkerManage: has('worker.manage'),
    canAlertManage: has('alert.manage'),
    canContentConfigManage: has('content_config.manage'),
    canDistributionConfigManage: has('distribution_config.manage'),
    canSystemSettingsManage: has('system.settings.manage'),
    canAuditRead: has('system.audit.read'),
    canRbacManage: has('system.rbac.manage'),
  };
}
