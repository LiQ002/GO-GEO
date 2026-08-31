package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORSAllowsConfiguredPreflight(t *testing.T) {
	handler := CORS([]string{"http://localhost:3000/", "app://-"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Fatal("preflight request reached the application handler")
	}))
	request := httptest.NewRequest(http.MethodOptions, "/api/user/v1/auth/login", nil)
	request.Header.Set("Origin", "http://localhost:3000")
	request.Header.Set("Access-Control-Request-Method", http.MethodPost)
	request.Header.Set("Access-Control-Request-Headers", "content-type")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if got := response.Code; got != http.StatusNoContent {
		t.Errorf("status = %d, want %d", got, http.StatusNoContent)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Errorf("allowed origin = %q, want http://localhost:3000", got)
	}
	if got := response.Header().Get("Access-Control-Allow-Headers"); got != defaultAllowedHeaders {
		t.Errorf("allowed headers = %q, want %q", got, defaultAllowedHeaders)
	}
}

func TestCORSAddsHeadersToApplicationResponse(t *testing.T) {
	handler := CORS([]string{"app://-"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	request := httptest.NewRequest(http.MethodPost, "/api/user/v1/auth/login", nil)
	request.Header.Set("Origin", "app://-")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if got := response.Code; got != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", got, http.StatusUnauthorized)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "app://-" {
		t.Errorf("allowed origin = %q, want app://-", got)
	}
}

func TestCORSRejectsDisallowedPreflight(t *testing.T) {
	handler := CORS([]string{"http://localhost:3000"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	request := httptest.NewRequest(http.MethodOptions, "/api/user/v1/auth/login", nil)
	request.Header.Set("Origin", "https://untrusted.example")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if got := response.Code; got != http.StatusForbidden {
		t.Errorf("status = %d, want %d", got, http.StatusForbidden)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("allowed origin = %q, want empty", got)
	}
}

func TestCORSPassesThroughSameOriginRequest(t *testing.T) {
	handler := CORS(nil)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	request := httptest.NewRequest(http.MethodPost, "/api/user/v1/auth/login", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if got := response.Code; got != http.StatusCreated {
		t.Errorf("status = %d, want %d", got, http.StatusCreated)
	}
}
