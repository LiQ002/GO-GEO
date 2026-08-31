package data

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"

	modelopenai "github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/schema"
	"gorm.io/gorm"
)

type einoArticleGenerator struct {
	data *Data
}

func NewEinoArticleGenerator(data *Data) biz.ArticleGenerator {
	return &einoArticleGenerator{data: data}
}

func (g *einoArticleGenerator) Generate(ctx context.Context, task *biz.ArticleGenerationTask) (*biz.ArticleGenerationResult, error) {
	if task == nil || task.WritingModelID == 0 {
		return nil, biz.ErrArticleGenerationInvalid
	}
	var credential model.WritingModelCredential
	if err := g.data.DB(ctx).Where("writing_model_id = ?", task.WritingModelID).First(&credential).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, biz.ErrArticleGenerationModel
		}
		return nil, err
	}
	apiKey, err := g.data.openCredential(credential.Nonce, credential.Ciphertext, []byte(fmt.Sprintf("writing-model:%d", task.WritingModelID)))
	if err != nil {
		return nil, err
	}
	defer clear(apiKey)

	var modelSnapshot generationModelSnapshot
	if err := json.Unmarshal([]byte(task.ModelSnapshotJSON), &modelSnapshot); err != nil {
		return nil, fmt.Errorf("decode model snapshot: %w", err)
	}
	var promptSnapshot generationPromptSnapshot
	if err := json.Unmarshal([]byte(task.PromptSnapshot), &promptSnapshot); err != nil {
		return nil, fmt.Errorf("decode prompt snapshot: %w", err)
	}
	return generateArticleWithEino(ctx, modelSnapshot, promptSnapshot, string(apiKey))
}

func generateArticleWithEino(ctx context.Context, modelSnapshot generationModelSnapshot, promptSnapshot generationPromptSnapshot, apiKey string) (*biz.ArticleGenerationResult, error) {
	if modelSnapshot.Protocol != "openai_compatible" {
		return nil, fmt.Errorf("unsupported writing model protocol %q", modelSnapshot.Protocol)
	}
	if strings.TrimSpace(modelSnapshot.BaseURL) == "" || strings.TrimSpace(modelSnapshot.ModelID) == "" || strings.TrimSpace(apiKey) == "" {
		return nil, errors.New("writing model connection configuration is incomplete")
	}
	if modelSnapshot.MaxTokens == 0 || modelSnapshot.MaxTokens > 65536 || modelSnapshot.TimeoutSeconds == 0 || modelSnapshot.TimeoutSeconds > 600 {
		return nil, errors.New("writing model parameters are outside allowed limits")
	}
	if modelSnapshot.Temperature < 0 || modelSnapshot.Temperature > 2 {
		return nil, errors.New("writing model temperature is outside allowed limits")
	}
	if modelSnapshot.TopP < 0 || modelSnapshot.TopP > 1 {
		return nil, errors.New("writing model top_p is outside allowed limits")
	}
	timeout := time.Duration(modelSnapshot.TimeoutSeconds) * time.Second
	temperature := float32(modelSnapshot.Temperature)
	topP := float32(modelSnapshot.TopP)
	maxTokens := int(modelSnapshot.MaxTokens)
	config := &modelopenai.ChatModelConfig{
		APIKey:      apiKey,
		Timeout:     timeout,
		BaseURL:     strings.TrimRight(modelSnapshot.BaseURL, "/"),
		Model:       modelSnapshot.ModelID,
		Temperature: &temperature,
		TopP:        &topP,
		MaxTokens:   &maxTokens,
	}
	chatModel, err := modelopenai.NewChatModel(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create Eino chat model: %w", err)
	}
	response, err := chatModel.Generate(ctx, []*schema.Message{
		schema.SystemMessage(promptSnapshot.System),
		schema.UserMessage(promptSnapshot.User),
	})
	if err != nil {
		return nil, fmt.Errorf("generate article with Eino: %w", err)
	}
	// 兼容思考型模型（DeepSeek-R1 / QwQ / Kimi K1.5 / Doubao-1.5-thinking 等）：
	// 这些模型把真正的回答放在 ReasoningContent，Content 可能是空字符串。
	// Content 为空时回退到 ReasoningContent，避免误判为"empty content"。
	content := strings.TrimSpace(response.Content)
	if content == "" && strings.TrimSpace(response.ReasoningContent) != "" {
		content = strings.TrimSpace(response.ReasoningContent)
		slog.Info("article generation: content empty, fallback to reasoning_content",
			slog.Int("reasoning_len", len(content)),
		)
	}
	result, err := parseGeneratedArticle(content)
	if err != nil {
		return nil, err
	}
	if response.ResponseMeta != nil && response.ResponseMeta.Usage != nil {
		result.InputTokens = uint64(max(response.ResponseMeta.Usage.PromptTokens, 0))
		result.OutputTokens = uint64(max(response.ResponseMeta.Usage.CompletionTokens, 0))
	}
	result.CostMicros = generationCostMicros(
		modelSnapshot.InputPriceMicrosPerMillionTokens,
		modelSnapshot.OutputPriceMicrosPerMillionTokens,
		result.InputTokens,
		result.OutputTokens,
	)
	return result, nil
}

func parseGeneratedArticle(content string) (*biz.ArticleGenerationResult, error) {
	raw := strings.TrimSpace(content)
	if raw == "" {
		return nil, errors.New("writing model returned empty content")
	}
	jsonContent := stripJSONFence(raw)
	var result biz.ArticleGenerationResult
	if err := json.Unmarshal([]byte(jsonContent), &result); err == nil && strings.TrimSpace(result.ContentMarkdown) != "" {
		result.Title = strings.TrimSpace(result.Title)
		result.Summary = strings.TrimSpace(result.Summary)
		result.ContentMarkdown = strings.TrimSpace(result.ContentMarkdown)
		if result.Title == "" {
			result.Title = generatedArticleTitle(result.ContentMarkdown)
		}
		return &result, nil
	}
	return &biz.ArticleGenerationResult{
		Title:           generatedArticleTitle(raw),
		Summary:         truncateRunes(strings.TrimSpace(strings.TrimLeft(raw, "# ")), 200),
		ContentMarkdown: raw,
		RawContent:      raw,
	}, nil
}

func stripJSONFence(content string) string {
	content = strings.TrimSpace(content)
	if content == "" {
		return content
	}
	// 1. 剥离 markdown 代码块 ```...```
	if strings.HasPrefix(content, "```") {
		firstNewline := strings.IndexByte(content, '\n')
		lastFence := strings.LastIndex(content, "```")
		if firstNewline != -1 && lastFence > firstNewline {
			content = strings.TrimSpace(content[firstNewline+1 : lastFence])
		}
	}
	// 2. 兼容思考型模型（DeepSeek-R1 / QwQ / Kimi K1.5 / deepseek-v4-pro 等）：
	// 这些模型的 ReasoningContent 可能是 "<think>...</think>\n{\"questions\":[...]}" 这种混合文本，
	// 直接 json.Unmarshal 会失败。提取首个 { 到最后一个 } 之间的 JSON 部分。
	if !strings.HasPrefix(content, "{") && !strings.HasPrefix(content, "[") {
		firstBrace := strings.Index(content, "{")
		lastBrace := strings.LastIndex(content, "}")
		if firstBrace >= 0 && lastBrace > firstBrace {
			extracted := content[firstBrace : lastBrace+1]
			// 仅当截取后能解析为 JSON 时才替换，避免误伤非 JSON 文本
			// （如文章生成的 markdown fallback 场景）。
			var probe any
			if json.Unmarshal([]byte(extracted), &probe) == nil {
				content = extracted
			}
		}
	}
	return content
}

func generatedArticleTitle(content string) string {
	for line := range strings.Lines(content) {
		line = strings.TrimSpace(strings.TrimLeft(line, "#"))
		if line != "" {
			return truncateRunes(line, 120)
		}
	}
	return "AI 生成文章"
}

func truncateRunes(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

func generationCostMicros(inputPrice, outputPrice int64, inputTokens, outputTokens uint64) int64 {
	if inputPrice < 0 || outputPrice < 0 {
		return 0
	}
	inputCost := int64(inputTokens) * inputPrice / 1_000_000
	outputCost := int64(outputTokens) * outputPrice / 1_000_000
	return inputCost + outputCost
}
