package server

import "testing"

func TestAdminOperationPermission(t *testing.T) {
	tests := map[string]string{
		"/admin.v1.AdminAuthService/GetCurrentAdmin":                         "",
		"/admin.v1.DashboardService/GetDashboard":                            "dashboard.read",
		"/admin.v1.AdminUserService/ListAdminUsers":                          "system.rbac.manage",
		"/admin.v1.ArticleService/ReviewArticle":                             "article.manage",
		"/admin.v1.SalesOpportunityService/ListSalesOpportunities":           "sales.opportunity.read",
		"/admin.v1.SalesOpportunityService/CheckSalesOpportunityDuplicate":   "sales.opportunity.read",
		"/admin.v1.SalesOpportunityService/CreateSalesOpportunity":           "sales.opportunity.manage",
		"/admin.v1.SalesOpportunityService/ChangeSalesOpportunityStatus":     "sales.opportunity.manage",
		"/admin.v1.SalesOpportunityService/FutureUnregisteredSalesOperation": "__deny__",
		"/admin.v1.SalesDiagnosisService/ListSalesDiagnoses":                 "sales.diagnosis.read",
		"/admin.v1.SalesDiagnosisService/CreateSalesDiagnosis":               "sales.diagnosis.manage",
		"/admin.v1.SalesDiagnosisService/FutureUnregisteredOperation":        "__deny__",
		"/admin.v1.UnknownService/Call":                                      "__deny__",
	}
	for operation, want := range tests {
		if got := adminOperationPermission(operation); got != want {
			t.Errorf("adminOperationPermission(%q) = %q, want %q", operation, got, want)
		}
	}
}
