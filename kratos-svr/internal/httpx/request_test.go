package httpx

import (
	"net/http/httptest"
	"strings"
	"testing"

	adminv1 "kratos-svr/api/admin/v1"
	userv1 "kratos-svr/api/user/v1"
)

func TestProtoJSONRequestDecoderUsesOpenAPIFieldNames(t *testing.T) {
	request := httptest.NewRequest(
		"POST",
		"/api/admin/v1/enterprises",
		strings.NewReader(`{"enterprise":{"code":"demo","name":"Demo"},"username":"demo","initialPassword":"Demo@2026","planId":"7","subscriptionExpiresAt":"2027-07-19T06:00:00Z","quotas":[{"metric":"geo_queries","limitValue":"1000","period":"monthly"}]}`),
	)
	request.Header.Set("Content-Type", "application/json; charset=utf-8")
	var message adminv1.CreateEnterpriseRequest

	if err := ProtoJSONRequestDecoder(request, &message); err != nil {
		t.Fatalf("ProtoJSONRequestDecoder() error = %v", err)
	}
	if got := message.GetInitialPassword(); got != "Demo@2026" {
		t.Errorf("initial password = %q, want Demo@2026", got)
	}
	if got := message.GetPlanId(); got != 7 {
		t.Errorf("plan ID = %d, want 7", got)
	}
	if got := message.GetQuotas()[0].GetLimitValue(); got != 1000 {
		t.Errorf("quota limit = %d, want 1000", got)
	}
	if message.GetSubscriptionExpiresAt() == nil {
		t.Fatal("subscription expiration was not decoded")
	}
}

func TestProtoJSONRequestDecoderDecodesAuthorizationSessionPayload(t *testing.T) {
	request := httptest.NewRequest(
		"POST",
		"/api/user/v1/platform-accounts/authorization-sessions",
		strings.NewReader(`{"deviceId":"b7fe0bae-099d-45d5-bc81-1bd1ee364660","resourceType":2,"resourceId":"1"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	var message userv1.CreateAuthorizationSessionRequest

	if err := ProtoJSONRequestDecoder(request, &message); err != nil {
		t.Fatalf("ProtoJSONRequestDecoder() error = %v", err)
	}
	if got := message.GetDeviceId(); got != "b7fe0bae-099d-45d5-bc81-1bd1ee364660" {
		t.Errorf("device ID = %q, want request device ID", got)
	}
	if got := message.GetResourceType(); got != 2 {
		t.Errorf("resource type = %d, want 2", got)
	}
	if got := message.GetResourceId(); got != 1 {
		t.Errorf("resource ID = %d, want 1", got)
	}
}

func TestProtoJSONRequestDecoderDecodesTaggedAuthorizationCredential(t *testing.T) {
	request := httptest.NewRequest(
		"POST",
		"/api/user/v1/client/authorization-sessions/session-token:submit",
		strings.NewReader(`{"sessionToken":"session-token","accountName":"deepseek","maskedIdentity":"deepseek","credentialPayload":"safe:v1:c3ludGhldGljLWNpcGhlcnRleHQ=","metadataJson":"{\"platform\":\"deepseek\",\"driverType\":1}","clientVersion":"0.1.0"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	var message userv1.SubmitAuthorizationRequest

	if err := ProtoJSONRequestDecoder(request, &message); err != nil {
		t.Fatalf("ProtoJSONRequestDecoder() error = %v", err)
	}
	if got := message.GetCredentialPayload(); got != "safe:v1:c3ludGhldGljLWNpcGhlcnRleHQ=" {
		t.Errorf("credential payload = %q, want tagged encrypted payload", got)
	}
	if got := message.GetMetadataJson(); got != `{"platform":"deepseek","driverType":1}` {
		t.Errorf("metadata JSON = %q, want client metadata", got)
	}
}
