package httpx

import (
	"net/http/httptest"
	"strings"
	"testing"

	adminv1 "kratos-svr/api/admin/v1"
)

func TestProtoJSONResponseEncoderUsesJSONFieldNames(t *testing.T) {
	request := httptest.NewRequest("GET", "/", nil)
	response := httptest.NewRecorder()
	message := &adminv1.AdminLoginReply{AccessToken: "token"}

	if err := ProtoJSONResponseEncoder(response, request, message); err != nil {
		t.Fatalf("ProtoJSONResponseEncoder() error = %v", err)
	}

	if got := response.Header().Get("Content-Type"); got != "application/json; charset=utf-8" {
		t.Errorf("Content-Type = %q, want application/json; charset=utf-8", got)
	}
	body := response.Body.String()
	if !strings.Contains(body, `"accessToken":"token"`) {
		t.Errorf("response body = %s, want OpenAPI JSON field name", body)
	}
	if strings.Contains(body, `"access_token"`) {
		t.Errorf("response body = %s, must not use protobuf source field name", body)
	}
}

func TestProtoJSONResponseEncoderUsesNumericEnums(t *testing.T) {
	request := httptest.NewRequest("GET", "/", nil)
	response := httptest.NewRecorder()
	message := &adminv1.SalesDiagnosis{
		Status: adminv1.SalesDiagnosisStatus_SALES_DIAGNOSIS_STATUS_PENDING,
	}

	if err := ProtoJSONResponseEncoder(response, request, message); err != nil {
		t.Fatalf("ProtoJSONResponseEncoder() error = %v", err)
	}

	body := response.Body.String()
	if !strings.Contains(body, `"status":1`) {
		t.Errorf("response body = %s, want numeric enum matching OpenAPI contract", body)
	}
	if strings.Contains(body, "SALES_DIAGNOSIS_STATUS_PENDING") {
		t.Errorf("response body = %s, must not expose protobuf enum name", body)
	}
}
