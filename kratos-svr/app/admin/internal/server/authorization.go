package server

import (
	"context"
	"strings"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/authn"

	"github.com/go-kratos/kratos/v3/middleware"
	"github.com/go-kratos/kratos/v3/transport"
)

func adminAuthorization(uc *biz.AdminAuthorizationUsecase) middleware.Middleware {
	return func(next middleware.Handler) middleware.Handler {
		return func(ctx context.Context, req any) (any, error) {
			tr, ok := transport.FromServerContext(ctx)
			if !ok {
				return nil, biz.ErrAdminForbidden
			}
			permission := adminOperationPermission(tr.Operation())
			if permission == "" {
				return next(ctx, req)
			}
			principal, ok := authn.PrincipalFromContext(ctx)
			if !ok || principal.SubjectType != "admin" {
				return nil, biz.ErrAdminForbidden
			}
			if err := uc.Authorize(ctx, principal.SubjectID, permission); err != nil {
				return nil, err
			}
			return next(ctx, req)
		}
	}
}

func adminOperationPermission(operation string) string {
	if strings.HasPrefix(operation, "/admin.v1.AdminAuthService/") {
		return ""
	}
	if strings.HasPrefix(operation, "/admin.v1.WorkerExecutionService/") {
		return ""
	}
	salesOpportunityPermissions := map[string]string{
		"/admin.v1.SalesOpportunityService/GetSalesOpportunity":            "sales.opportunity.read",
		"/admin.v1.SalesOpportunityService/ListSalesOpportunities":         "sales.opportunity.read",
		"/admin.v1.SalesOpportunityService/CheckSalesOpportunityDuplicate": "sales.opportunity.read",
		"/admin.v1.SalesOpportunityService/ListSalesOpportunityOwners":     "sales.opportunity.read",
		"/admin.v1.SalesOpportunityService/CreateSalesOpportunity":         "sales.opportunity.manage",
		"/admin.v1.SalesOpportunityService/UpdateSalesOpportunity":         "sales.opportunity.manage",
		"/admin.v1.SalesOpportunityService/ChangeSalesOpportunityStatus":   "sales.opportunity.manage",
	}
	if permission, ok := salesOpportunityPermissions[operation]; ok {
		return permission
	}
	if strings.HasPrefix(operation, "/admin.v1.SalesOpportunityService/") {
		return "__deny__"
	}
	salesDiagnosisPermissions := map[string]string{
		"/admin.v1.SalesDiagnosisService/GetSalesDiagnosis":       "sales.diagnosis.read",
		"/admin.v1.SalesDiagnosisService/ListSalesDiagnoses":      "sales.diagnosis.read",
		"/admin.v1.SalesDiagnosisService/CompareSalesDiagnoses":   "sales.diagnosis.read",
		"/admin.v1.SalesDiagnosisService/CreateSalesDiagnosis":    "sales.diagnosis.manage",
		"/admin.v1.SalesDiagnosisService/RunSalesDiagnosis":       "sales.diagnosis.manage",
		"/admin.v1.SalesDiagnosisService/CancelSalesDiagnosis":    "sales.diagnosis.manage",
		"/admin.v1.SalesDiagnosisService/RetrySalesDiagnosisTask": "sales.diagnosis.manage",
	}
	if permission, ok := salesDiagnosisPermissions[operation]; ok {
		return permission
	}
	if strings.HasPrefix(operation, "/admin.v1.SalesDiagnosisService/") {
		return "__deny__"
	}
	services := []struct{ prefix, permission string }{
		{"/admin.v1.DashboardService/", "dashboard.read"},
		{"/admin.v1.EnterpriseService/", "enterprise.manage"}, {"/admin.v1.PlanService/", "enterprise.manage"},
		{"/admin.v1.ArticleService/", "article.manage"}, {"/admin.v1.PublishTaskService/", "publish_task.manage"},
		{"/admin.v1.GeoTaskService/", "geo_task.manage"}, {"/admin.v1.WorkerService/", "worker.manage"},
		{"/admin.v1.AlertService/", "alert.manage"}, {"/admin.v1.ArticleTypeService/", "content_config.manage"},
		{"/admin.v1.WritingModelService/", "content_config.manage"}, {"/admin.v1.PublishChannelService/", "distribution_config.manage"},
		{"/admin.v1.CustomerAuthorizationService/", "distribution_config.manage"},
		{"/admin.v1.SelfMediaAuthorizationService/", "distribution_config.manage"},
		{"/admin.v1.InclusionSiteAuthorizationService/", "distribution_config.manage"},
		{"/admin.v1.InclusionSiteService/", "distribution_config.manage"}, {"/admin.v1.SystemSettingService/", "system.settings.manage"},
		{"/admin.v1.AuditLogService/", "system.audit.read"}, {"/admin.v1.AdminRoleService/", "system.rbac.manage"},
		{"/admin.v1.AdminUserService/", "system.rbac.manage"},
		{"/admin.v1.SubscriptionOrderService/", "enterprise.manage"},
		{"/admin.v1.BillingConfigService/", "system.settings.manage"},
	}
	for _, item := range services {
		if strings.HasPrefix(operation, item.prefix) {
			return item.permission
		}
	}
	return "__deny__"
}
