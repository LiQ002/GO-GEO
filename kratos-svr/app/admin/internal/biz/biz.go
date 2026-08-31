package biz

import "github.com/google/wire"

// ProviderSet is biz providers.
var ProviderSet = wire.NewSet(
	NewAdminAuthUsecase,
	NewEnterpriseUsecase,
	NewPlanUsecase,
	NewAdminArticleUsecase,
	NewAdminPublishTaskUsecase,
	NewAdminGeoTaskUsecase,
	NewWorkerAdminUsecase,
	NewWorkerTaskUsecase,
	NewAdminAuditLogUsecase,
	NewSystemSettingUsecase,
	NewDashboardUsecase,
	NewAdminAlertUsecase,
	NewAdminRoleUsecase,
	NewAdminUserUsecase,
	NewAdminAuthorizationUsecase,
	NewSalesOpportunityUsecase,
	NewSalesDiagnosisUsecase,
	NewArticleTypeUsecase,
	NewWritingModelUsecase,
	NewPublishChannelUsecase,
	NewCustomerAuthorizationUsecase,
	NewInclusionSiteUsecase,
	NewSubscriptionOrderUsecase,
	NewBillingConfigUsecase,
	NewBillingScheduler,
	NewRealnameUsecase,
)
