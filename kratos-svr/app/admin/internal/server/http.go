package server

import (
	nethttp "net/http"

	"github.com/go-kratos/kratos/v3/middleware/recovery"
	"github.com/go-kratos/kratos/v3/middleware/validate"
	"github.com/go-kratos/kratos/v3/transport/http"
	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/app/admin/internal/conf"
	"kratos-svr/app/admin/internal/service"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/httpx"

	"go.einride.tech/aip/fieldbehavior"
	"google.golang.org/protobuf/proto"
)

// NewHTTPServer new an HTTP server.
func NewHTTPServer(c *conf.Server, authManager *authn.Manager, authorizer *biz.AdminAuthorizationUsecase, auth *service.AdminAuthService, salesOpportunity *service.SalesOpportunityService, salesDiagnosis *service.SalesDiagnosisService, enterprise *service.EnterpriseService, plan *service.PlanService, article *service.ArticleService, publishTask *service.PublishTaskService, geoTask *service.GeoTaskService, worker *service.WorkerService, workerExecution *service.WorkerExecutionService, auditLog *service.AuditLogService, systemSetting *service.SystemSettingService, dashboard *service.DashboardService, alert *service.AlertService, adminRole *service.AdminRoleService, adminUser *service.AdminUserService, articleType *service.ArticleTypeService, writingModel *service.WritingModelService, publishChannel *service.PublishChannelService, customerAuthorization *service.CustomerAuthorizationService, inclusionSite *service.InclusionSiteService, subscriptionOrder *service.SubscriptionOrderService, billingConfig *service.BillingConfigService, realname *service.RealnameAuthenticationService, icons *service.IconStorage) *http.Server {
	var opts = []http.ServerOption{
		http.Filter(httpx.CORS(c.Http.GetCorsAllowedOrigins())),
		http.RequestDecoder(httpx.ProtoJSONRequestDecoder),
		http.ResponseEncoder(httpx.ProtoJSONResponseEncoder),
		http.Middleware(
			recovery.Recovery(),
			validate.Validator(func(req any) error {
				if msg, ok := req.(proto.Message); ok {
					if err := fieldbehavior.ValidateRequiredFields(msg); err != nil {
						return err
					}
				}
				return nil
			}),
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
	if c.Http.Network != "" {
		opts = append(opts, http.Network(c.Http.Network))
	}
	if c.Http.Addr != "" {
		opts = append(opts, http.Address(c.Http.Addr))
	}
	if c.Http.Timeout != nil {
		opts = append(opts, http.Timeout(c.Http.Timeout.AsDuration()))
	}
	srv := http.NewServer(opts...)
	registerIconHandler(srv, "/uploads/channel-icons/", icons.ChannelDirectory())
	registerIconHandler(srv, "/uploads/inclusion-site-icons/", icons.InclusionSiteDirectory())
	v1.RegisterAdminAuthServiceHTTPServer(srv, auth)
	v1.RegisterSalesOpportunityServiceHTTPServer(srv, salesOpportunity)
	v1.RegisterSalesDiagnosisServiceHTTPServer(srv, salesDiagnosis)
	v1.RegisterEnterpriseServiceHTTPServer(srv, enterprise)
	v1.RegisterPlanServiceHTTPServer(srv, plan)
	v1.RegisterArticleServiceHTTPServer(srv, article)
	v1.RegisterPublishTaskServiceHTTPServer(srv, publishTask)
	v1.RegisterGeoTaskServiceHTTPServer(srv, geoTask)
	v1.RegisterWorkerServiceHTTPServer(srv, worker)
	v1.RegisterWorkerExecutionServiceHTTPServer(srv, workerExecution)
	v1.RegisterAuditLogServiceHTTPServer(srv, auditLog)
	v1.RegisterSystemSettingServiceHTTPServer(srv, systemSetting)
	v1.RegisterDashboardServiceHTTPServer(srv, dashboard)
	v1.RegisterAlertServiceHTTPServer(srv, alert)
	v1.RegisterAdminRoleServiceHTTPServer(srv, adminRole)
	v1.RegisterAdminUserServiceHTTPServer(srv, adminUser)
	v1.RegisterArticleTypeServiceHTTPServer(srv, articleType)
	v1.RegisterWritingModelServiceHTTPServer(srv, writingModel)
	v1.RegisterPublishChannelServiceHTTPServer(srv, publishChannel)
	v1.RegisterCustomerAuthorizationServiceHTTPServer(srv, customerAuthorization)
	v1.RegisterSelfMediaAuthorizationServiceHTTPServer(srv, customerAuthorization)
	v1.RegisterInclusionSiteAuthorizationServiceHTTPServer(srv, customerAuthorization)
	v1.RegisterInclusionSiteServiceHTTPServer(srv, inclusionSite)
	v1.RegisterSubscriptionOrderServiceHTTPServer(srv, subscriptionOrder)
	v1.RegisterBillingConfigServiceHTTPServer(srv, billingConfig)
	v1.RegisterRealnameAuthenticationServiceHTTPServer(srv, realname)
	return srv
}

func registerIconHandler(srv *http.Server, prefix, directory string) {
	staticIcons := nethttp.StripPrefix(prefix, nethttp.FileServer(nethttp.Dir(directory)))
	srv.HandlePrefix(prefix, nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		if r.Method != nethttp.MethodGet && r.Method != nethttp.MethodHead {
			w.WriteHeader(nethttp.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		staticIcons.ServeHTTP(w, r)
	}))
}
