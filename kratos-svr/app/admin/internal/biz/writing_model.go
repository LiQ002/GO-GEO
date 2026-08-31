package biz

import (
	"context"
	"net/url"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrWritingModelNotFound = errors.NotFound("WRITING_MODEL_NOT_FOUND", "writing model not found")
	ErrWritingModelInvalid  = errors.BadRequest("WRITING_MODEL_INVALID", "invalid writing model")
	ErrWritingModelConflict = errors.Conflict("WRITING_MODEL_CONFLICT", "writing model version conflict")
)

type WritingModel struct {
	ID                                uint64
	Code                              string
	DisplayName                       string
	Provider                          int32
	Protocol                          int32
	BaseURL                           string
	ModelID                           string
	APIKey                            string
	CredentialConfigured              bool
	ContextLength                     uint32
	Status                            int32
	SortOrder                         int32
	Purposes                          []int32
	Temperature                       float64
	TopP                              float64
	MaxTokens                         uint32
	TimeoutSeconds                    uint32
	CitationCapability                int32
	DiagnosisAPIMode                  int32
	DiagnosisWebSearchEnabled         bool
	SafetyEnabled                     bool
	InputModerationEnabled            bool
	OutputModerationEnabled           bool
	SafetyFailClosed                  bool
	BlockedSafetyCategories           []int32
	InputPriceMicrosPerMillionTokens  int64
	OutputPriceMicrosPerMillionTokens int64
	PriceCurrency                     int32
	AccessScope                       int32
	VisiblePlanIDs                    []uint64
	VisibleEnterpriseIDs              []uint64
	Version                           uint64
	CreatedAt                         time.Time
	UpdatedAt                         time.Time
}

type WritingModelListOptions struct {
	Offset, Limit    int
	Provider, Status int32
	Keyword          string
}

type WritingModelTestResult struct {
	Success         bool
	LatencyMS       uint64
	ResponsePreview string
	ErrorCode       string
}

type WritingModelRepo interface {
	Create(context.Context, *WritingModel) (*WritingModel, error)
	Get(context.Context, uint64) (*WritingModel, error)
	List(context.Context, WritingModelListOptions) ([]*WritingModel, int64, error)
	Update(context.Context, *WritingModel) (*WritingModel, error)
	Delete(context.Context, uint64, uint64) error
	Test(context.Context, uint64, string) (*WritingModelTestResult, error)
}

type WritingModelUsecase struct{ repo WritingModelRepo }

func NewWritingModelUsecase(repo WritingModelRepo) *WritingModelUsecase {
	return &WritingModelUsecase{repo: repo}
}

func (uc *WritingModelUsecase) Create(ctx context.Context, item *WritingModel) (*WritingModel, error) {
	if err := validateWritingModel(item, true); err != nil {
		return nil, err
	}
	if item.Status == 0 {
		item.Status = WritingModelStatusDisabled
	}
	return uc.repo.Create(ctx, item)
}

func (uc *WritingModelUsecase) Get(ctx context.Context, id uint64) (*WritingModel, error) {
	if id == 0 {
		return nil, ErrWritingModelInvalid
	}
	return uc.repo.Get(ctx, id)
}

func (uc *WritingModelUsecase) List(ctx context.Context, opts WritingModelListOptions) ([]*WritingModel, int64, error) {
	return uc.repo.List(ctx, opts)
}

func (uc *WritingModelUsecase) Update(ctx context.Context, item *WritingModel) (*WritingModel, error) {
	if item == nil || item.ID == 0 || item.Version == 0 {
		return nil, ErrWritingModelInvalid
	}
	if err := validateWritingModel(item, false); err != nil {
		return nil, err
	}
	return uc.repo.Update(ctx, item)
}

func (uc *WritingModelUsecase) Delete(ctx context.Context, id, version uint64) error {
	if id == 0 || version == 0 {
		return ErrWritingModelInvalid
	}
	return uc.repo.Delete(ctx, id, version)
}

func (uc *WritingModelUsecase) Test(ctx context.Context, id uint64, prompt string) (*WritingModelTestResult, error) {
	if id == 0 {
		return nil, ErrWritingModelInvalid
	}
	if strings.TrimSpace(prompt) == "" {
		prompt = "请回复：连接测试成功"
	}
	return uc.repo.Test(ctx, id, prompt)
}

func validateWritingModel(item *WritingModel, requireKey bool) error {
	if item == nil || strings.TrimSpace(item.Code) == "" || strings.TrimSpace(item.DisplayName) == "" ||
		!inRange(item.Provider, WritingModelProviderQwen, WritingModelProviderCustom) || strings.TrimSpace(item.ModelID) == "" || (requireKey && strings.TrimSpace(item.APIKey) == "") {
		return ErrWritingModelInvalid
	}
	item.Code = strings.ToLower(strings.TrimSpace(item.Code))
	item.DisplayName = strings.TrimSpace(item.DisplayName)
	item.BaseURL = strings.TrimRight(strings.TrimSpace(item.BaseURL), "/")
	item.ModelID = strings.TrimSpace(item.ModelID)
	parsed, err := url.ParseRequestURI(item.BaseURL)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" {
		return ErrWritingModelInvalid
	}
	if item.Protocol == 0 {
		item.Protocol = WritingModelProtocolOpenAICompatible
	}
	if item.Status == 0 {
		item.Status = WritingModelStatusDisabled
	}
	if item.PriceCurrency == 0 {
		item.PriceCurrency = PriceCurrencyCNY
	}
	if item.AccessScope == 0 {
		item.AccessScope = WritingModelAccessAll
	}
	if item.CitationCapability == 0 {
		item.CitationCapability = WritingModelCitationCapabilityNone
	}
	if item.DiagnosisAPIMode == 0 {
		item.DiagnosisAPIMode = WritingModelDiagnosisAPIChatCompletions
	}
	if item.Protocol != WritingModelProtocolOpenAICompatible || !inRange(item.Status, WritingModelStatusActive, WritingModelStatusDisabled) ||
		!inRange(item.AccessScope, WritingModelAccessAll, WritingModelAccessRestricted) || !inRange(item.PriceCurrency, PriceCurrencyCNY, PriceCurrencyUSD) || len(item.Purposes) == 0 ||
		item.Temperature < 0 || item.Temperature > 2 || item.TopP < 0 || item.TopP > 1 ||
		item.MaxTokens == 0 || item.MaxTokens > 65536 || item.TimeoutSeconds == 0 || item.TimeoutSeconds > 600 ||
		!inRange(item.CitationCapability, WritingModelCitationCapabilityNone, WritingModelCitationCapabilityProviderSources) ||
		!inRange(item.DiagnosisAPIMode, WritingModelDiagnosisAPIChatCompletions, WritingModelDiagnosisAPIResponses) ||
		item.InputPriceMicrosPerMillionTokens < 0 || item.OutputPriceMicrosPerMillionTokens < 0 {
		return ErrWritingModelInvalid
	}
	if item.DiagnosisWebSearchEnabled &&
		(item.DiagnosisAPIMode != WritingModelDiagnosisAPIResponses || item.CitationCapability != WritingModelCitationCapabilityProviderSources) {
		return ErrWritingModelInvalid
	}
	if !normalizeUniqueCodes(&item.Purposes, WritingModelPurposeOutline, WritingModelPurposeOpinionSummary) || !normalizeUniqueCodes(&item.BlockedSafetyCategories, SafetyCategoryIllegal, SafetyCategoryPersonalData) ||
		!normalizeUniqueIDs(&item.VisiblePlanIDs) || !normalizeUniqueIDs(&item.VisibleEnterpriseIDs) {
		return ErrWritingModelInvalid
	}
	if item.AccessScope == WritingModelAccessAll {
		item.VisiblePlanIDs = nil
		item.VisibleEnterpriseIDs = nil
	}
	if !item.SafetyEnabled {
		item.InputModerationEnabled = false
		item.OutputModerationEnabled = false
		item.BlockedSafetyCategories = nil
	}
	return nil
}

func normalizeUniqueCodes(values *[]int32, min, max int32) bool {
	seen := make(map[int32]struct{}, len(*values))
	for _, value := range *values {
		if !inRange(value, min, max) {
			return false
		}
		if _, exists := seen[value]; exists {
			return false
		}
		seen[value] = struct{}{}
	}
	return true
}

func normalizeUniqueIDs(values *[]uint64) bool {
	seen := make(map[uint64]struct{}, len(*values))
	for _, value := range *values {
		if value == 0 {
			return false
		}
		if _, exists := seen[value]; exists {
			return false
		}
		seen[value] = struct{}{}
	}
	return true
}
