package server

import (
	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/app/admin/internal/conf"
	"kratos-svr/app/admin/internal/service"
	"kratos-svr/internal/authn"

	"github.com/go-kratos/kratos/v3/middleware/recovery"
	"github.com/go-kratos/kratos/v3/transport/grpc"
)

// NewGRPCServer new a gRPC server.
func NewGRPCServer(c *conf.Server, authManager *authn.Manager, authorizer *biz.AdminAuthorizationUsecase, auth *service.AdminAuthService, salesOpportunity *service.SalesOpportunityService, salesDiagnosis *service.SalesDiagnosisService, enterprise *service.EnterpriseService, plan *service.PlanService, article *service.ArticleService, publishTask *service.PublishTaskService, geoTask *service.GeoTaskService, worker *service.WorkerService, workerExecution *service.WorkerExecutionService, auditLog *service.AuditLogService, systemSetting *service.SystemSettingService, dashboard *service.DashboardService, alert *service.AlertService, adminRole *service.AdminRoleService, adminUser *service.AdminUserService, articleType *service.ArticleTypeService, writingModel *service.WritingModelService, publishChannel *service.PublishChannelService, customerAuthorization *service.CustomerAuthorizationService, inclusionSite *service.InclusionSiteService, subscriptionOrder *service.SubscriptionOrderService, billingConfig *service.BillingConfigService) *grpc.Server {
	var opts = []grpc.ServerOption{
		grpc.Middleware(
			recovery.Recovery(),
			authn.Middleware(authManager,
				"/admin.v1.AdminAuthService/Login",
				"/admin.v1.AdminAuthService/Refresh",
				"/admin.v1.WorkerExecutionService/Heartbeat",
				"/admin.v1.WorkerExecutionService/ClaimTask",
				"/admin.v1.WorkerExecutionService/RenewLease",
				"/admin.v1.WorkerExecutionService/ReleaseLease",
				"/admin.v1.WorkerExecutionService/ReportTaskResult",
			),
			adminAuthorization(authorizer),
		),
	}
	if c.Grpc.Network != "" {
		opts = append(opts, grpc.Network(c.Grpc.Network))
	}
	if c.Grpc.Addr != "" {
		opts = append(opts, grpc.Address(c.Grpc.Addr))
	}
	if c.Grpc.Timeout != nil {
		opts = append(opts, grpc.Timeout(c.Grpc.Timeout.AsDuration()))
	}
	srv := grpc.NewServer(opts...)
	v1.RegisterAdminAuthServiceServer(srv, auth)
	v1.RegisterSalesOpportunityServiceServer(srv, salesOpportunity)
	v1.RegisterSalesDiagnosisServiceServer(srv, salesDiagnosis)
	v1.RegisterEnterpriseServiceServer(srv, enterprise)
	v1.RegisterPlanServiceServer(srv, plan)
	v1.RegisterArticleServiceServer(srv, article)
	v1.RegisterPublishTaskServiceServer(srv, publishTask)
	v1.RegisterGeoTaskServiceServer(srv, geoTask)
	v1.RegisterWorkerServiceServer(srv, worker)
	v1.RegisterWorkerExecutionServiceServer(srv, workerExecution)
	v1.RegisterAuditLogServiceServer(srv, auditLog)
	v1.RegisterSystemSettingServiceServer(srv, systemSetting)
	v1.RegisterDashboardServiceServer(srv, dashboard)
	v1.RegisterAlertServiceServer(srv, alert)
	v1.RegisterAdminRoleServiceServer(srv, adminRole)
	v1.RegisterAdminUserServiceServer(srv, adminUser)
	v1.RegisterArticleTypeServiceServer(srv, articleType)
	v1.RegisterWritingModelServiceServer(srv, writingModel)
	v1.RegisterPublishChannelServiceServer(srv, publishChannel)
	v1.RegisterCustomerAuthorizationServiceServer(srv, customerAuthorization)
	v1.RegisterSelfMediaAuthorizationServiceServer(srv, customerAuthorization)
	v1.RegisterInclusionSiteAuthorizationServiceServer(srv, customerAuthorization)
	v1.RegisterInclusionSiteServiceServer(srv, inclusionSite)
	v1.RegisterSubscriptionOrderServiceServer(srv, subscriptionOrder)
	v1.RegisterBillingConfigServiceServer(srv, billingConfig)
	return srv
}
