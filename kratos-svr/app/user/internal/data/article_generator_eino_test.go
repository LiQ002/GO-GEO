package data

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"
)

func TestGenerateArticleWithEinoUsesCompatibleEndpoint(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" {
			t.Errorf("path = %q, want /v1/chat/completions", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Errorf("Authorization = %q, want Bearer test-key", got)
		}
		var request struct {
			Model    string `json:"model"`
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode request: %v", err)
		}
		if request.Model != "compatible-model" || len(request.Messages) != 2 {
			t.Errorf("request = %#v", request)
		}
		articleJSON, err := json.Marshal(map[string]string{
			"title":            "测试标题",
			"summary":          "测试摘要",
			"content_markdown": "# 正文\n内容",
		})
		if err != nil {
			t.Errorf("encode article response: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		response := map[string]any{
			"id":      "chatcmpl-test",
			"object":  "chat.completion",
			"created": 1,
			"model":   "compatible-model",
			"choices": []map[string]any{{
				"index": 0,
				"message": map[string]any{
					"role":    "assistant",
					"content": string(articleJSON),
				},
				"finish_reason": "stop",
			}},
			"usage": map[string]any{"prompt_tokens": 12, "completion_tokens": 34, "total_tokens": 46},
		}
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("encode response: %v", err)
		}
	}))
	t.Cleanup(server.Close)

	result, err := generateArticleWithEino(context.Background(), generationModelSnapshot{
		Protocol: "openai_compatible", BaseURL: server.URL + "/v1", ModelID: "compatible-model",
		Temperature: 0.2, TopP: 1, MaxTokens: 2048, TimeoutSeconds: 5,
		InputPriceMicrosPerMillionTokens: 1000000, OutputPriceMicrosPerMillionTokens: 2000000,
	}, generationPromptSnapshot{System: "system", User: "user"}, "test-key")
	if err != nil {
		t.Fatalf("generateArticleWithEino() error = %v", err)
	}
	if result.Title != "测试标题" || result.ContentMarkdown != "# 正文\n内容" {
		t.Fatalf("result = %#v", result)
	}
	if result.InputTokens != 12 || result.OutputTokens != 34 || result.CostMicros != 80 {
		t.Fatalf("usage = input:%d output:%d cost:%d", result.InputTokens, result.OutputTokens, result.CostMicros)
	}
}

func TestParseGeneratedArticleFallsBackToMarkdown(t *testing.T) {
	t.Parallel()

	result, err := parseGeneratedArticle("# 普通正文\n\n模型没有输出 JSON。")
	if err != nil {
		t.Fatalf("parseGeneratedArticle() error = %v", err)
	}
	if result.Title != "普通正文" || !strings.Contains(result.ContentMarkdown, "模型没有输出 JSON") {
		t.Fatalf("result = %#v", result)
	}
}

func TestBuildGenerationPromptDoesNotDuplicateTemplate(t *testing.T) {
	t.Parallel()

	prompt, err := buildGenerationPrompt(
		"system",
		"主题：{{.topic}}",
		&model.ArticleTypeVersion{
			ContentGoal: "介绍产品",
			Tone:        "专业",
			Sections:    []model.ArticleTypeSection{{Title: "产品价值", Guidance: "提供事实依据"}},
			Rules:       []model.ArticleTypeRule{{RuleType: model.ArticleTypeRuleGEO, RuleText: "使用清晰实体名称"}},
		},
		model.Brand{Name: "品牌"},
		map[string]any{"topic": "GEO"},
		"知识内容",
		nil,
		"补充要求",
	)
	if err != nil {
		t.Fatalf("buildGenerationPrompt() error = %v", err)
	}
	if strings.Count(prompt.User, "主题：GEO") != 1 {
		t.Fatalf("rendered template count = %d, prompt = %q", strings.Count(prompt.User, "主题：GEO"), prompt.User)
	}
	if !strings.Contains(prompt.User, "知识内容") || !strings.Contains(prompt.User, "补充要求") || !strings.Contains(prompt.User, "产品价值") || !strings.Contains(prompt.User, "使用清晰实体名称") {
		t.Fatalf("prompt = %q", prompt.User)
	}
	if !strings.Contains(prompt.System, "主提示词") {
		t.Fatalf("system prompt does not establish article type as primary instruction: %q", prompt.System)
	}
}

func TestBuildGenerationPromptIncludesGalleryPlacementInstructions(t *testing.T) {
	t.Parallel()

	prompt, err := buildGenerationPrompt(
		"system",
		"主题：{{.topic}}",
		&model.ArticleTypeVersion{ContentGoal: "介绍产品"},
		model.Brand{Name: "品牌"},
		map[string]any{"topic": "新品"},
		"",
		[]biz.ArticleGenerationGalleryRef{
			{
				AlbumName:    "产品图库",
				Category:     biz.KnowledgeCategoryProductOverview,
				OriginalName: "封面图.png",
				Placement:    biz.ArticleGalleryPlacementCover,
			},
			{
				AlbumName:    "产品图库",
				Category:     biz.KnowledgeCategoryProductOverview,
				OriginalName: "正面图.png",
				Placeholder:  "[[GALLERY_IMAGE_1]]",
				Placement:    biz.ArticleGalleryPlacementBody,
			},
		},
		"",
	)
	if err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{
		"[[GALLERY_IMAGE_1]]",
		"产品图库",
		"产品介绍",
		"各使用一次",
	} {
		if !strings.Contains(prompt.User, expected) {
			t.Fatalf("prompt does not contain %q: %s", expected, prompt.User)
		}
	}
}
