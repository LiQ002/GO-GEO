package data

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"
)

func TestDiagnosisResponsesEndpoint(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		baseURL  string
		provider int32
		want     string
	}{
		{name: "deepseek root", baseURL: "https://api.deepseek.com", provider: model.WritingModelProviderDeepSeek, want: "https://api.deepseek.com/responses"},
		{name: "deepseek legacy v1", baseURL: "https://api.deepseek.com/v1/", provider: model.WritingModelProviderDeepSeek, want: "https://api.deepseek.com/responses"},
		{name: "qwen compatible", baseURL: "https://example.com/compatible-mode/v1", provider: model.WritingModelProviderQwen, want: "https://example.com/compatible-mode/v1/responses"},
		{name: "existing endpoint", baseURL: "https://example.com/v1/responses", provider: model.WritingModelProviderQwen, want: "https://example.com/v1/responses"},
	}
	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			got, err := diagnosisResponsesEndpoint(test.baseURL, test.provider)
			if err != nil {
				t.Fatal(err)
			}
			if got != test.want {
				t.Fatalf("diagnosisResponsesEndpoint() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestCallDiagnosisResponsesEnablesWebSearchAndPreservesSources(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/compatible-mode/v1/responses" {
			t.Errorf("request path = %q", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer secret" {
			t.Errorf("Authorization = %q", got)
		}
		var request diagnosisResponsesRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if len(request.Tools) != 1 || request.Tools[0].Type != "web_search" || request.ToolChoice != "required" {
			t.Errorf("web search request = %#v / %#v", request.Tools, request.ToolChoice)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
  "id":"resp-123","status":"completed","model":"qwen-test",
  "output":[
    {"type":"web_search_call","action":{"sources":[{"id":"src-1","title":"品牌官网","url":"https://brand.example/about","snippet":"公开资料"}]}},
    {"type":"message","content":[{"type":"output_text","text":"联网回答","annotations":[{"type":"url_citation","title":"品牌官网","url":"https://brand.example/about"}]}]}
  ],
  "usage":{"input_tokens":10,"output_tokens":20,"total_tokens":30}
}`))
	}))
	defer server.Close()

	diagnosisModel := &biz.SalesDiagnosisModel{
		Provider: model.WritingModelProviderQwen, BaseURL: server.URL + "/compatible-mode/v1", ModelID: "qwen-test",
		DiagnosisAPIMode: model.WritingModelDiagnosisAPIResponses, DiagnosisWebSearchEnabled: true,
		Temperature: 0.2, TopP: 0.8, MaxTokens: 1024,
	}
	message, err := callDiagnosisResponses(context.Background(), server.Client(), diagnosisModel, "secret", "system", "question")
	if err != nil {
		t.Fatal(err)
	}
	if message.Content != "联网回答" || diagnosisProviderRequestID(message.Extra) != "resp-123" || diagnosisProviderResponseModel(message.Extra) != "qwen-test" {
		t.Fatalf("message = %#v", message)
	}
	if message.ResponseMeta == nil || message.ResponseMeta.Usage == nil || message.ResponseMeta.Usage.TotalTokens != 30 {
		t.Fatalf("usage = %#v", message.ResponseMeta)
	}
	citations := diagnosisProviderCitations(message.Extra)
	if len(citations) != 1 || citations[0].URL != "https://brand.example/about" || citations[0].ProviderSourceID != "src-1" {
		t.Fatalf("citations = %#v", citations)
	}
	if raw := diagnosisRawResponseJSON(message); !strings.Contains(raw, `"web_search_call"`) {
		t.Fatalf("raw response = %s", raw)
	}
}

func TestCallDiagnosisResponsesDoesNotSendSearchWhenDisabled(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request diagnosisResponsesRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if len(request.Tools) != 0 || request.ToolChoice != nil {
			t.Errorf("unexpected web search request = %#v / %#v", request.Tools, request.ToolChoice)
		}
		_, _ = w.Write([]byte(`{"id":"resp-plain","status":"completed","output_text":"普通回答","usage":{}}`))
	}))
	defer server.Close()

	diagnosisModel := &biz.SalesDiagnosisModel{
		Provider: model.WritingModelProviderQwen, BaseURL: server.URL, ModelID: "qwen-test",
		DiagnosisAPIMode: model.WritingModelDiagnosisAPIResponses,
	}
	if _, err := callDiagnosisResponses(context.Background(), server.Client(), diagnosisModel, "secret", "system", "question"); err != nil {
		t.Fatal(err)
	}
}

func TestCallDiagnosisResponsesUsesDeepSeekToolChoiceShape(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request map[string]any
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		choice, ok := request["tool_choice"].(map[string]any)
		if !ok || choice["type"] != "web_search" {
			t.Errorf("tool_choice = %#v", request["tool_choice"])
		}
		_, _ = w.Write([]byte(`{"id":"resp-deepseek","status":"completed","output_text":"联网回答","usage":{}}`))
	}))
	defer server.Close()

	diagnosisModel := &biz.SalesDiagnosisModel{
		Provider: model.WritingModelProviderDeepSeek, BaseURL: server.URL + "/v1", ModelID: "deepseek-v4-pro",
		DiagnosisAPIMode: model.WritingModelDiagnosisAPIResponses, DiagnosisWebSearchEnabled: true,
	}
	if _, err := callDiagnosisResponses(context.Background(), server.Client(), diagnosisModel, "secret", "system", "question"); err != nil {
		t.Fatal(err)
	}
}
