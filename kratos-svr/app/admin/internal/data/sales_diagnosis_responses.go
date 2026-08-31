package data

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"

	"github.com/cloudwego/eino/schema"
	"gorm.io/gorm"
)

const diagnosisResponsesBodyLimit = 16 << 20

type diagnosisResponsesRequest struct {
	Model           string                   `json:"model"`
	Instructions    string                   `json:"instructions,omitempty"`
	Input           string                   `json:"input"`
	Stream          bool                     `json:"stream"`
	Temperature     *float64                 `json:"temperature,omitempty"`
	TopP            *float64                 `json:"top_p,omitempty"`
	MaxOutputTokens *int                     `json:"max_output_tokens,omitempty"`
	Tools           []diagnosisResponsesTool `json:"tools,omitempty"`
	ToolChoice      any                      `json:"tool_choice,omitempty"`
	Store           bool                     `json:"store"`
}

type diagnosisResponsesTool struct {
	Type string `json:"type"`
}

type diagnosisResponsesToolChoice struct {
	Type string `json:"type"`
}

type diagnosisResponsesResponse struct {
	ID     string `json:"id"`
	Model  string `json:"model"`
	Status string `json:"status"`
	Output []struct {
		Type    string `json:"type"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	} `json:"output"`
	OutputText string `json:"output_text"`
	Usage      struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
		TotalTokens  int `json:"total_tokens"`
	} `json:"usage"`
	Error *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func (r *einoSalesDiagnosisRunner) generateDiagnosisResponses(ctx context.Context, diagnosisModel *biz.SalesDiagnosisModel, messages []*schema.Message) (*schema.Message, error) {
	if diagnosisModel == nil || diagnosisModel.Protocol != model.WritingModelProtocolOpenAICompatible {
		return nil, errors.New("unsupported diagnosis responses protocol")
	}
	var credential model.WritingModelCredential
	if err := r.data.DB(ctx).Where("writing_model_id = ?", diagnosisModel.WritingModelID).First(&credential).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("diagnosis model credential is not configured")
		}
		return nil, fmt.Errorf("load diagnosis model credential: %w", err)
	}
	apiKey, err := r.data.openCredential(credential.Nonce, credential.Ciphertext, []byte(fmt.Sprintf("writing-model:%d", diagnosisModel.WritingModelID)))
	if err != nil {
		return nil, fmt.Errorf("open diagnosis model credential: %w", err)
	}
	defer clear(apiKey)

	instructions, input := diagnosisResponsesInput(messages)
	timeout := time.Duration(diagnosisModel.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 120 * time.Second
	}
	requestCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return callDiagnosisResponses(requestCtx, http.DefaultClient, diagnosisModel, string(apiKey), instructions, input)
}

func callDiagnosisResponses(ctx context.Context, client *http.Client, diagnosisModel *biz.SalesDiagnosisModel, apiKey, instructions, input string) (*schema.Message, error) {
	endpoint, err := diagnosisResponsesEndpoint(diagnosisModel.BaseURL, diagnosisModel.Provider)
	if err != nil {
		return nil, err
	}
	requestBody := diagnosisResponsesRequest{
		Model: diagnosisModel.ModelID, Instructions: instructions, Input: input, Stream: false, Store: false,
	}
	requestBody.Temperature = &diagnosisModel.Temperature
	requestBody.TopP = &diagnosisModel.TopP
	if diagnosisModel.MaxTokens > 0 {
		maxOutputTokens := int(diagnosisModel.MaxTokens)
		requestBody.MaxOutputTokens = &maxOutputTokens
	}
	if diagnosisModel.DiagnosisWebSearchEnabled {
		requestBody.Tools = []diagnosisResponsesTool{{Type: "web_search"}}
		if diagnosisModel.Provider == model.WritingModelProviderQwen {
			requestBody.ToolChoice = "required"
		} else {
			requestBody.ToolChoice = diagnosisResponsesToolChoice{Type: "web_search"}
		}
	}
	payload, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("marshal diagnosis responses request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create diagnosis responses request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call diagnosis responses API: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, diagnosisResponsesBodyLimit))
	if err != nil {
		return nil, fmt.Errorf("read diagnosis responses API: %w", err)
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("diagnosis responses API returned HTTP %d: %s", resp.StatusCode, diagnosisResponsesErrorMessage(body))
	}
	var decoded diagnosisResponsesResponse
	if err := json.Unmarshal(body, &decoded); err != nil {
		return nil, fmt.Errorf("decode diagnosis responses API: %w", err)
	}
	if decoded.Error != nil {
		return nil, fmt.Errorf("diagnosis responses API error %s: %s", decoded.Error.Code, decoded.Error.Message)
	}
	content := diagnosisResponsesOutputText(decoded)
	if content == "" {
		return nil, errors.New("diagnosis responses API returned empty output_text")
	}
	var providerResponse any
	if err := json.Unmarshal(body, &providerResponse); err != nil {
		return nil, fmt.Errorf("preserve diagnosis responses API payload: %w", err)
	}
	message := schema.AssistantMessage(content, nil)
	message.Extra = map[string]any{
		"request_id":                 decoded.ID,
		"response_model":             decoded.Model,
		"provider_response":          providerResponse,
		"provider_raw_response_json": string(body),
	}
	message.ResponseMeta = &schema.ResponseMeta{
		FinishReason: decoded.Status,
		Usage: &schema.TokenUsage{
			PromptTokens: decoded.Usage.InputTokens, CompletionTokens: decoded.Usage.OutputTokens,
			TotalTokens: decoded.Usage.TotalTokens,
		},
	}
	return message, nil
}

func diagnosisResponsesEndpoint(baseURL string, provider int32) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", errors.New("invalid diagnosis responses base URL")
	}
	parsed.RawQuery = ""
	parsed.Fragment = ""
	path := strings.TrimRight(parsed.Path, "/")
	if provider == model.WritingModelProviderDeepSeek && strings.HasSuffix(strings.ToLower(path), "/v1") {
		path = strings.TrimSuffix(path, "/v1")
	}
	if !strings.HasSuffix(strings.ToLower(path), "/responses") {
		path += "/responses"
	}
	parsed.Path = path
	return parsed.String(), nil
}

func diagnosisResponsesInput(messages []*schema.Message) (string, string) {
	systemParts := make([]string, 0, 1)
	inputParts := make([]string, 0, len(messages))
	for _, message := range messages {
		if message == nil || strings.TrimSpace(message.Content) == "" {
			continue
		}
		content := strings.TrimSpace(message.Content)
		if message.Role == schema.System {
			systemParts = append(systemParts, content)
			continue
		}
		if message.Role == schema.User {
			inputParts = append(inputParts, content)
			continue
		}
		inputParts = append(inputParts, string(message.Role)+": "+content)
	}
	return strings.Join(systemParts, "\n\n"), strings.Join(inputParts, "\n\n")
}

func diagnosisResponsesOutputText(response diagnosisResponsesResponse) string {
	if text := strings.TrimSpace(response.OutputText); text != "" {
		return text
	}
	parts := make([]string, 0)
	for _, output := range response.Output {
		for _, content := range output.Content {
			if text := strings.TrimSpace(content.Text); text != "" {
				parts = append(parts, text)
			}
		}
	}
	return strings.TrimSpace(strings.Join(parts, "\n"))
}

func diagnosisResponsesErrorMessage(body []byte) string {
	var decoded struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if json.Unmarshal(body, &decoded) == nil && decoded.Error.Message != "" {
		if decoded.Error.Code != "" {
			return decoded.Error.Code + ": " + decoded.Error.Message
		}
		return decoded.Error.Message
	}
	value := strings.TrimSpace(string(body))
	if len(value) > 500 {
		value = value[:500]
	}
	return value
}

func diagnosisRawResponseJSON(response *schema.Message) string {
	if response == nil {
		return ""
	}
	if raw, ok := response.Extra["provider_raw_response_json"].(string); ok && strings.TrimSpace(raw) != "" {
		return raw
	}
	raw, err := json.Marshal(response)
	if err != nil {
		return ""
	}
	return string(raw)
}
