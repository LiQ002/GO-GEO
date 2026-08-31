package service

import "github.com/google/wire"

// ProviderSet is service providers.
var ProviderSet = wire.NewSet(
	NewIconStorage,
	NewAdminAuthService,
	NewSalesOpportunityService,
	NewSalesDiagnosisService,
	NewEnterpriseService,
	NewPlanService,
	NewArticleService,
	NewPublishTaskService,
	NewGeoTaskService,
	NewWorkerService,
	NewWorkerExecutionService,
	NewAuditLogService,
	NewSystemSettingService,
	NewDashboardService,
	NewAlertService,
	NewAdminRoleService,
	NewAdminUserService,
	NewArticleTypeService,
	NewWritingModelService,
	NewPublishChannelService,
	NewCustomerAuthorizationService,
	NewInclusionSiteService,
	NewSubscriptionOrderService,
	NewBillingConfigService,
	NewRealnameAuthenticationService,
)
