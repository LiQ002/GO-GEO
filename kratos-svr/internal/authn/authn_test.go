package authn

import (
	"context"
	"strings"
	"testing"
	"time"

	kratoserrors "github.com/go-kratos/kratos/v3/errors"
	"github.com/go-kratos/kratos/v3/transport"
)

const testAuthSecret = "0123456789abcdef0123456789abcdef"

func TestManagerRejectsCrossApplicationTokens(t *testing.T) {
	t.Parallel()

	admin := newTestManager(t, Config{
		Issuer: "geohelper", Audience: "geo-admin", SubjectType: SubjectTypeAdmin,
		Secret: testAuthSecret, CookieName: "geo_admin_access",
	})
	user := newTestManager(t, Config{
		Issuer: "geohelper", Audience: "geo-user", SubjectType: SubjectTypeEnterprise,
		Secret: "abcdef0123456789abcdef0123456789", CookieName: "geo_user_access",
	})

	adminAccess, _, _, err := admin.IssuePair(1, 0, 10, SubjectTypeAdmin)
	if err != nil {
		t.Fatalf("issue admin token: %v", err)
	}
	userAccess, _, _, err := user.IssuePair(2, 20, 30, SubjectTypeEnterprise)
	if err != nil {
		t.Fatalf("issue user token: %v", err)
	}

	if _, err := admin.Verify(userAccess, TokenKindAccess); kratoserrors.Code(err) != 401 {
		t.Fatalf("admin Verify(user token) error = %v; want unauthorized", err)
	}
	if _, err := user.Verify(adminAccess, TokenKindAccess); kratoserrors.Code(err) != 401 {
		t.Fatalf("user Verify(admin token) error = %v; want unauthorized", err)
	}
}

func TestManagerRejectsWrongSubjectTypeWithSharedKeyAndAudience(t *testing.T) {
	t.Parallel()

	admin := newTestManager(t, Config{
		Issuer: "geohelper", Audience: "geo-shared", SubjectType: SubjectTypeAdmin, Secret: testAuthSecret,
	})
	user := newTestManager(t, Config{
		Issuer: "geohelper", Audience: "geo-shared", SubjectType: SubjectTypeEnterprise, Secret: testAuthSecret,
	})
	adminAccess, _, _, err := admin.IssuePair(1, 0, 10, SubjectTypeAdmin)
	if err != nil {
		t.Fatalf("issue admin token: %v", err)
	}
	if _, err := user.Verify(adminAccess, TokenKindAccess); kratoserrors.Code(err) != 401 {
		t.Fatalf("user Verify(admin token) error = %v; want subject-type rejection", err)
	}
}

func TestManagerRejectsIssuingWrongSubjectType(t *testing.T) {
	t.Parallel()

	manager := newTestManager(t, Config{
		Issuer: "geohelper", Audience: "geo-admin", SubjectType: SubjectTypeAdmin, Secret: testAuthSecret,
	})
	if _, _, _, err := manager.IssuePair(1, 0, 10, SubjectTypeEnterprise); err == nil {
		t.Fatal("IssuePair() accepted a subject type for another application")
	}
}

func TestManagerRejectsExpiredAndWrongKindTokens(t *testing.T) {
	t.Parallel()

	manager := newTestManager(t, Config{
		Issuer: "geohelper", Audience: "geo-admin", SubjectType: SubjectTypeAdmin, Secret: testAuthSecret,
	})
	_, refresh, _, err := manager.IssuePair(1, 0, 10, SubjectTypeAdmin)
	if err != nil {
		t.Fatalf("issue token pair: %v", err)
	}
	if _, err := manager.Verify(refresh, TokenKindAccess); kratoserrors.Code(err) != 401 {
		t.Fatalf("Verify(refresh as access) error = %v; want unauthorized", err)
	}

	now := time.Now().UTC()
	expired, err := manager.issue(1, 0, 10, SubjectTypeAdmin, TokenKindAccess, now.Add(-2*time.Minute), now.Add(-time.Minute))
	if err != nil {
		t.Fatalf("issue expired token: %v", err)
	}
	if _, err := manager.Verify(expired, TokenKindAccess); kratoserrors.Code(err) != 401 {
		t.Fatalf("Verify(expired token) error = %v; want unauthorized", err)
	}
}

func TestMiddlewareAcceptsBearerOrApplicationCookie(t *testing.T) {
	t.Parallel()

	manager := newTestManager(t, Config{
		Issuer: "geohelper", Audience: "geo-admin", SubjectType: SubjectTypeAdmin,
		Secret: testAuthSecret, CookieName: "geo_admin_access",
	})
	access, _, _, err := manager.IssuePair(1, 0, 10, SubjectTypeAdmin)
	if err != nil {
		t.Fatalf("issue access token: %v", err)
	}

	tests := []struct {
		name   string
		header testHeader
	}{
		{name: "bearer", header: testHeader{"Authorization": {"Bearer " + access}}},
		{name: "cookie", header: testHeader{"Cookie": {"other=value; geo_admin_access=" + access}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := transport.NewServerContext(context.Background(), &testTransport{operation: "/admin.v1.DashboardService/GetDashboard", request: tt.header})
			result, err := Middleware(manager)(func(ctx context.Context, _ any) (any, error) {
				principal, ok := PrincipalFromContext(ctx)
				if !ok {
					t.Fatal("verified principal missing from context")
				}
				return principal, nil
			})(ctx, nil)
			if err != nil {
				t.Fatalf("middleware returned error: %v", err)
			}
			principal := result.(Principal)
			if principal.SubjectType != SubjectTypeAdmin || principal.Audience != "geo-admin" || principal.SubjectID != 1 {
				t.Fatalf("principal = %#v; want verified admin identity", principal)
			}
		})
	}
}

func TestMiddlewareInterceptsMissingInvalidAndForeignTokens(t *testing.T) {
	t.Parallel()

	admin := newTestManager(t, Config{
		Issuer: "geohelper", Audience: "geo-admin", SubjectType: SubjectTypeAdmin,
		Secret: testAuthSecret, CookieName: "geo_admin_access",
	})
	user := newTestManager(t, Config{
		Issuer: "geohelper", Audience: "geo-user", SubjectType: SubjectTypeEnterprise,
		Secret: "abcdef0123456789abcdef0123456789", CookieName: "geo_user_access",
	})
	adminAccess, _, _, err := admin.IssuePair(1, 0, 10, SubjectTypeAdmin)
	if err != nil {
		t.Fatalf("issue admin token: %v", err)
	}
	userAccess, _, _, err := user.IssuePair(2, 20, 30, SubjectTypeEnterprise)
	if err != nil {
		t.Fatalf("issue user token: %v", err)
	}

	tests := []struct {
		name   string
		header testHeader
	}{
		{name: "missing", header: testHeader{}},
		{name: "invalid", header: testHeader{"Authorization": {"Bearer not-a-jwt"}}},
		{name: "malformed bearer does not fall back to cookie", header: testHeader{
			"Authorization": {"Basic invalid"},
			"Cookie":        {"geo_admin_access=" + adminAccess},
		}},
		{name: "foreign bearer", header: testHeader{"Authorization": {"Bearer " + userAccess}}},
		{name: "foreign cookie name", header: testHeader{"Cookie": {"geo_user_access=" + userAccess}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := transport.NewServerContext(context.Background(), &testTransport{operation: "/admin.v1.DashboardService/GetDashboard", request: tt.header})
			called := false
			_, err := Middleware(admin)(func(context.Context, any) (any, error) {
				called = true
				return nil, nil
			})(ctx, nil)
			if kratoserrors.Code(err) != 401 {
				t.Fatalf("middleware error = %v; want unauthorized", err)
			}
			if called {
				t.Fatal("middleware called protected handler for an unverified token")
			}
		})
	}
}

func newTestManager(t *testing.T, config Config) *Manager {
	t.Helper()
	config.AccessDuration = time.Minute
	config.RefreshDuration = time.Hour
	manager, err := NewManager(config)
	if err != nil {
		t.Fatalf("NewManager() error = %v", err)
	}
	return manager
}

type testHeader map[string][]string

func (h testHeader) Get(key string) string {
	for existing, values := range h {
		if strings.EqualFold(existing, key) && len(values) > 0 {
			return values[0]
		}
	}
	return ""
}

func (h testHeader) Set(key, value string) { h[key] = []string{value} }
func (h testHeader) Add(key, value string) { h[key] = append(h[key], value) }
func (h testHeader) Keys() []string {
	keys := make([]string, 0, len(h))
	for key := range h {
		keys = append(keys, key)
	}
	return keys
}
func (h testHeader) Values(key string) []string {
	for existing, values := range h {
		if strings.EqualFold(existing, key) {
			return values
		}
	}
	return nil
}

type testTransport struct {
	operation string
	request   testHeader
	reply     testHeader
}

func (t *testTransport) Kind() transport.Kind            { return transport.KindHTTP }
func (t *testTransport) Endpoint() string                { return "http://127.0.0.1" }
func (t *testTransport) Operation() string               { return t.operation }
func (t *testTransport) RequestHeader() transport.Header { return t.request }
func (t *testTransport) ReplyHeader() transport.Header {
	if t.reply == nil {
		t.reply = testHeader{}
	}
	return t.reply
}
