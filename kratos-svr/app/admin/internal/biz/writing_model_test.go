package biz

import "testing"

func TestValidateWritingModelNormalizesStructuredConfiguration(t *testing.T) {
	t.Parallel()

	item := &WritingModel{
		Code: " QWEN_LONG ", DisplayName: " 长文模型 ", Provider: WritingModelProviderQwen, BaseURL: " https://example.com/v1/ ",
		ModelID: " qwen-long ", APIKey: "secret", Status: WritingModelStatusActive, Purposes: []int32{WritingModelPurposeArticle, WritingModelPurposeSummary},
		Temperature: 0.7, TopP: 0.9, MaxTokens: 8192, TimeoutSeconds: 180,
		InputPriceMicrosPerMillionTokens: 1000000, OutputPriceMicrosPerMillionTokens: 2000000,
		PriceCurrency: PriceCurrencyCNY, AccessScope: WritingModelAccessRestricted, VisiblePlanIDs: []uint64{1},
		SafetyEnabled: true, BlockedSafetyCategories: []int32{SafetyCategoryViolence, SafetyCategoryPersonalData},
	}
	if err := validateWritingModel(item, true); err != nil {
		t.Fatalf("validateWritingModel() error = %v", err)
	}
	if item.Code != "qwen_long" || item.Provider != WritingModelProviderQwen || item.Protocol != WritingModelProtocolOpenAICompatible {
		t.Fatalf("identity fields not normalized: %#v", item)
	}
	if item.BaseURL != "https://example.com/v1" || item.PriceCurrency != PriceCurrencyCNY || item.AccessScope != WritingModelAccessRestricted {
		t.Fatalf("configuration fields not normalized: %#v", item)
	}
	if item.Purposes[0] != WritingModelPurposeArticle || item.BlockedSafetyCategories[1] != SafetyCategoryPersonalData {
		t.Fatalf("list fields not normalized: %#v", item)
	}
}

func TestValidateWritingModelRejectsDuplicateStructuredValues(t *testing.T) {
	t.Parallel()

	item := &WritingModel{
		Code: "qwen", DisplayName: "Qwen", Provider: WritingModelProviderQwen, BaseURL: "https://example.com/v1",
		ModelID: "qwen", Purposes: []int32{WritingModelPurposeArticle, WritingModelPurposeArticle}, Temperature: 0.7, TopP: 1,
		MaxTokens: 4096, TimeoutSeconds: 120, PriceCurrency: PriceCurrencyCNY, AccessScope: WritingModelAccessAll,
	}
	if err := validateWritingModel(item, false); err == nil {
		t.Fatal("validateWritingModel() error = nil, want duplicate purpose error")
	}
}

func TestValidateWritingModelRequiresRestrictedScopeTargets(t *testing.T) {
	t.Parallel()

	item := &WritingModel{
		Code: "qwen", DisplayName: "Qwen", Provider: WritingModelProviderQwen, BaseURL: "https://example.com/v1",
		ModelID: "qwen", Purposes: []int32{WritingModelPurposeArticle}, Temperature: 0.7, TopP: 1,
		MaxTokens: 4096, TimeoutSeconds: 120, PriceCurrency: PriceCurrencyCNY, AccessScope: WritingModelAccessRestricted,
	}
	if err := validateWritingModel(item, false); err != nil {
		t.Fatalf("validation should leave scope target integrity to repository: %v", err)
	}
}

func TestValidateWritingModelAcceptsDistinctDiagnosisAndSentimentPurposes(t *testing.T) {
	t.Parallel()

	if WritingModelPurposeSalesDiagnosis == WritingModelPurposeSentimentAnalysis {
		t.Fatal("sales diagnosis and sentiment analysis purposes must use distinct persisted values")
	}
	item := &WritingModel{
		Code: "shared-model", DisplayName: "Shared Model", Provider: WritingModelProviderDeepSeek, BaseURL: "https://example.com/v1",
		ModelID: "deepseek", Purposes: []int32{WritingModelPurposeSalesDiagnosis, WritingModelPurposeSentimentAnalysis}, Temperature: 0.7, TopP: 1,
		MaxTokens: 4096, TimeoutSeconds: 120, PriceCurrency: PriceCurrencyCNY, AccessScope: WritingModelAccessAll,
	}
	if err := validateWritingModel(item, false); err != nil {
		t.Fatalf("validateWritingModel() error = %v", err)
	}
}

func TestValidateWritingModelAcceptsResponsesWebSearchForDiagnosis(t *testing.T) {
	t.Parallel()

	item := &WritingModel{
		Code: "qwen-search", DisplayName: "Qwen Search", Provider: WritingModelProviderQwen, BaseURL: "https://example.com/v1",
		ModelID: "qwen", Purposes: []int32{WritingModelPurposeSalesDiagnosis}, Temperature: 0.2, TopP: 0.9,
		MaxTokens: 4096, TimeoutSeconds: 120, PriceCurrency: PriceCurrencyCNY, AccessScope: WritingModelAccessAll,
		CitationCapability: WritingModelCitationCapabilityProviderSources, DiagnosisAPIMode: WritingModelDiagnosisAPIResponses,
		DiagnosisWebSearchEnabled: true,
	}
	if err := validateWritingModel(item, false); err != nil {
		t.Fatalf("validateWritingModel() error = %v", err)
	}
}

func TestValidateWritingModelRejectsWebSearchWithoutResponsesOrSources(t *testing.T) {
	t.Parallel()

	base := WritingModel{
		Code: "qwen-search", DisplayName: "Qwen Search", Provider: WritingModelProviderQwen, BaseURL: "https://example.com/v1",
		ModelID: "qwen", Purposes: []int32{WritingModelPurposeSalesDiagnosis}, Temperature: 0.2, TopP: 0.9,
		MaxTokens: 4096, TimeoutSeconds: 120, PriceCurrency: PriceCurrencyCNY, AccessScope: WritingModelAccessAll,
		DiagnosisWebSearchEnabled: true,
	}
	if err := validateWritingModel(&base, false); err == nil {
		t.Fatal("validateWritingModel() error = nil, want chat completions rejection")
	}
	base.DiagnosisAPIMode = WritingModelDiagnosisAPIResponses
	if err := validateWritingModel(&base, false); err == nil {
		t.Fatal("validateWritingModel() error = nil, want missing provider sources rejection")
	}
}
