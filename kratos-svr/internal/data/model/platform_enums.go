package model

// Platform configuration enums start at 1. Zero is reserved for unspecified
// filters and invalid persisted values.
const (
	PlanStatusActive   int32 = 1
	PlanStatusDisabled int32 = 2
	PlanStatusArchived int32 = 3

	PlanMetricArticleGenerations int32 = 1
	PlanMetricPublishTasks       int32 = 2
	PlanMetricGEOQueries         int32 = 3
	PlanMetricKnowledgeBytes     int32 = 4
	PlanMetricAITokens           int32 = 5

	QuotaPeriodDaily    int32 = 1
	QuotaPeriodMonthly  int32 = 2
	QuotaPeriodYearly   int32 = 3
	QuotaPeriodTotal    int32 = 4
	QuotaPeriodLifetime int32 = 5

	PlanFeatureArticleGeneration    int32 = 1
	PlanFeatureKnowledgeManagement  int32 = 2
	PlanFeaturePublishManagement    int32 = 3
	PlanFeatureGEOMonitoring        int32 = 4
	PlanFeatureDataExport           int32 = 5
	PlanFeatureSentimentAnalysis    int32 = 6
	PlanFeatureCompetitorAnalysis   int32 = 7
	PlanFeatureOpinionAnalysis      int32 = 8

	AdminRoleDataScopeAll      int32 = 1
	AdminRoleDataScopeAssigned int32 = 2
	AdminRoleDataScopeReadonly int32 = 3

	AdminRoleStatusActive   int32 = 1
	AdminRoleStatusDisabled int32 = 2

	ArticleTypeSourceSystem int32 = 1
	ArticleTypeSourceCustom int32 = 2

	ArticleTypeStatusDraft    int32 = 1
	ArticleTypeStatusActive   int32 = 2
	ArticleTypeStatusDisabled int32 = 3
	ArticleTypeStatusArchived int32 = 4

	ArticleTypeVersionStatusDraft     int32 = 1
	ArticleTypeVersionStatusPublished int32 = 2

	PublishChannelCategorySelfMedia     int32 = 1
	PublishChannelCategoryOfficialMedia int32 = 2
	PublishChannelCategoryKOL           int32 = 3

	PublishChannelStatusActive      int32 = 1
	PublishChannelStatusDisabled    int32 = 2
	PublishChannelStatusMaintenance int32 = 3

	AuthorizationTypeNone        int32 = 1
	AuthorizationTypeClientLogin int32 = 2

	ExecutionModeAutomatic     int32 = 1
	ExecutionModeSemiAutomatic int32 = 2
	ExecutionModeManual        int32 = 3

	WritingModelProviderQwen     int32 = 1
	WritingModelProviderDeepSeek int32 = 2
	WritingModelProviderKimi     int32 = 3
	WritingModelProviderOpenAI   int32 = 4
	WritingModelProviderCustom   int32 = 5

	WritingModelProtocolOpenAICompatible    int32 = 1
	WritingModelDiagnosisAPIChatCompletions int32 = 1
	WritingModelDiagnosisAPIResponses       int32 = 2

	WritingModelStatusActive                      int32 = 1
	WritingModelStatusDisabled                    int32 = 2
	WritingModelCitationCapabilityNone            int32 = 1
	WritingModelCitationCapabilityProviderSources int32 = 2

	WritingModelPurposeOutline            int32 = 1
	WritingModelPurposeArticle            int32 = 2
	WritingModelPurposeRewrite            int32 = 3
	WritingModelPurposeSummary            int32 = 4
	WritingModelPurposeQuestionExtraction int32 = 5
	WritingModelPurposeSalesDiagnosis             int32 = 6
	WritingModelPurposeSentimentAnalysis          int32 = 7
	WritingModelPurposeSentimentTendencyAnalysis int32 = 8
	WritingModelPurposeCompetitorAnalysis         int32 = 9
	WritingModelPurposeOpinionSummary             int32 = 10

	SafetyCategoryIllegal      int32 = 1
	SafetyCategoryViolence     int32 = 2
	SafetyCategoryAdult        int32 = 3
	SafetyCategoryHate         int32 = 4
	SafetyCategorySelfHarm     int32 = 5
	SafetyCategoryPersonalData int32 = 6

	PriceCurrencyCNY int32 = 1
	PriceCurrencyUSD int32 = 2

	WritingModelAccessAll        int32 = 1
	WritingModelAccessRestricted int32 = 2
)
