package model

import "time"

const (
	SalesDiagnosisSubjectOpportunity int32 = 1
	SalesDiagnosisSubjectEnterprise  int32 = 2
	SalesDiagnosisSubjectQuickBrand  int32 = 3

	SalesDiagnosisStatusPending            int32 = 1
	SalesDiagnosisStatusRunning            int32 = 2
	SalesDiagnosisStatusSucceeded          int32 = 3
	SalesDiagnosisStatusPartiallySucceeded int32 = 4
	SalesDiagnosisStatusFailed             int32 = 5
	SalesDiagnosisStatusCancelled          int32 = 6

	SalesDiagnosisTaskStatusPending   int32 = 1
	SalesDiagnosisTaskStatusRunning   int32 = 2
	SalesDiagnosisTaskStatusSucceeded int32 = 3
	SalesDiagnosisTaskStatusFailed    int32 = 4
	SalesDiagnosisTaskStatusCancelled int32 = 5

	SalesDiagnosisPreparationStatusPending   int32 = 1
	SalesDiagnosisPreparationStatusRunning   int32 = 2
	SalesDiagnosisPreparationStatusSucceeded int32 = 3
	SalesDiagnosisPreparationStatusFailed    int32 = 4
	SalesDiagnosisPreparationStatusSkipped   int32 = 5
	SalesDiagnosisPreparationStatusCancelled int32 = 6

	SalesDiagnosisBrandTermTypeBrand      int32 = 1
	SalesDiagnosisBrandTermTypeAlias      int32 = 2
	SalesDiagnosisBrandTermTypeProduct    int32 = 3
	SalesDiagnosisBrandTermTypeCategory   int32 = 4
	SalesDiagnosisBrandTermTypeCompetitor int32 = 5
	SalesDiagnosisBrandTermTypeScenario   int32 = 6

	SalesDiagnosisQuestionSourceManual         int32 = 1
	SalesDiagnosisQuestionSourceModelGenerated int32 = 2

	SalesDiagnosisEvidenceModelKnowledge  int32 = 1
	SalesDiagnosisEvidenceProviderSources int32 = 2

	SalesDiagnosisCitationCapabilityNone            int32 = 1
	SalesDiagnosisCitationCapabilityProviderSources int32 = 2

	SalesDiagnosisMetricAvailabilityAvailable   int32 = 1
	SalesDiagnosisMetricAvailabilityUnavailable int32 = 2
	SalesDiagnosisMetricAvailabilityPartial     int32 = 3

	SalesDiagnosisSentimentUnknown  int32 = 1
	SalesDiagnosisSentimentPositive int32 = 2
	SalesDiagnosisSentimentNeutral  int32 = 3
	SalesDiagnosisSentimentNegative int32 = 4

	SalesDiagnosisSourceOther           int32 = 1
	SalesDiagnosisSourceOfficial        int32 = 2
	SalesDiagnosisSourceEncyclopedia    int32 = 3
	SalesDiagnosisSourceNews            int32 = 4
	SalesDiagnosisSourceIndustryMedia   int32 = 5
	SalesDiagnosisSourceCommunityUGC    int32 = 6
	SalesDiagnosisSourceTravelGuide     int32 = 7
	SalesDiagnosisSourceOTA             int32 = 8
	SalesDiagnosisSourceDocumentLibrary int32 = 9
)

// SalesDiagnosis stores one immutable-in-history diagnosis run.
type SalesDiagnosis struct {
	BaseModel
	Code               string     `gorm:"column:code;type:varchar(64);not null;uniqueIndex"`
	Name               string     `gorm:"column:name;type:varchar(128);not null"`
	SubjectType        int32      `gorm:"column:subject_type;type:tinyint unsigned;not null;index"`
	OpportunityID      *uint64    `gorm:"column:opportunity_id;index"`
	EnterpriseID       *uint64    `gorm:"column:enterprise_id;index"`
	CreatedByAdminID   uint64     `gorm:"column:created_by_admin_id;not null;index"`
	Status             int32      `gorm:"column:status;type:tinyint unsigned;not null;index"`
	QuestionCount      uint32     `gorm:"column:question_count;not null;default:0"`
	ModelCount         uint32     `gorm:"column:model_count;not null;default:0"`
	TaskCount          uint32     `gorm:"column:task_count;not null;default:0"`
	SucceededTaskCount uint32     `gorm:"column:succeeded_task_count;not null;default:0"`
	FailedTaskCount    uint32     `gorm:"column:failed_task_count;not null;default:0"`
	StartedAt          *time.Time `gorm:"column:started_at"`
	CompletedAt        *time.Time `gorm:"column:completed_at;index"`
	Version            uint64     `gorm:"column:version;not null;default:1"`
}

func (SalesDiagnosis) TableName() string { return TableSalesDiagnoses }

// SalesDiagnosisProfile stores the customer fields captured when a diagnosis is created.
type SalesDiagnosisProfile struct {
	BaseModel
	DiagnosisID    uint64 `gorm:"column:diagnosis_id;not null;uniqueIndex"`
	CustomerName   string `gorm:"column:customer_name;type:varchar(128);not null"`
	Website        string `gorm:"column:website;type:varchar(512)"`
	Industry       string `gorm:"column:industry;type:varchar(128)"`
	Region         string `gorm:"column:region;type:varchar(128)"`
	BrandName      string `gorm:"column:brand_name;type:varchar(128);not null"`
	TargetAudience string `gorm:"column:target_audience;type:text"`
	CoreValue      string `gorm:"column:core_value;type:text"`
	CurrentContent string `gorm:"column:current_content;type:text"`
	PainPoints     string `gorm:"column:pain_points;type:text"`
	ExpectedGoals  string `gorm:"column:expected_goals;type:text"`
	SourceVersion  uint64 `gorm:"column:source_version;not null;default:0"`
}

func (SalesDiagnosisProfile) TableName() string { return TableSalesDiagnosisProfiles }

type SalesDiagnosisProfileAlias struct {
	BaseModel
	DiagnosisID uint64 `gorm:"column:diagnosis_id;not null;index"`
	Alias       string `gorm:"column:alias;type:varchar(128);not null"`
	SortOrder   int32  `gorm:"column:sort_order;not null;default:0"`
}

func (SalesDiagnosisProfileAlias) TableName() string { return TableSalesDiagnosisProfileAliases }

type SalesDiagnosisProfileProduct struct {
	BaseModel
	DiagnosisID    uint64 `gorm:"column:diagnosis_id;not null;index"`
	Name           string `gorm:"column:name;type:varchar(255);not null"`
	Description    string `gorm:"column:description;type:text"`
	SellingPoints  string `gorm:"column:selling_points;type:text"`
	TargetAudience string `gorm:"column:target_audience;type:text"`
	SortOrder      int32  `gorm:"column:sort_order;not null;default:0"`
}

func (SalesDiagnosisProfileProduct) TableName() string { return TableSalesDiagnosisProfileProducts }

type SalesDiagnosisProfileCompetitor struct {
	BaseModel
	DiagnosisID uint64 `gorm:"column:diagnosis_id;not null;index"`
	Name        string `gorm:"column:name;type:varchar(128);not null"`
	Website     string `gorm:"column:website;type:varchar(512)"`
	Description string `gorm:"column:description;type:text"`
	SortOrder   int32  `gorm:"column:sort_order;not null;default:0"`
}

func (SalesDiagnosisProfileCompetitor) TableName() string {
	return TableSalesDiagnosisProfileCompetitors
}

// SalesDiagnosisProfileClaim freezes one atomic, verifiable customer fact used by content-adoption metrics.
type SalesDiagnosisProfileClaim struct {
	BaseModel
	DiagnosisID  uint64  `gorm:"column:diagnosis_id;not null;index"`
	ClaimType    int32   `gorm:"column:claim_type;type:tinyint unsigned;not null;index"`
	SourceField  string  `gorm:"column:source_field;type:varchar(64);not null"`
	SourceItemID *uint64 `gorm:"column:source_item_id"`
	ClaimText    string  `gorm:"column:claim_text;type:text;not null"`
	SortOrder    int32   `gorm:"column:sort_order;not null;default:0"`
}

func (SalesDiagnosisProfileClaim) TableName() string { return TableSalesDiagnosisProfileClaims }

// SalesDiagnosisPreparation is the leased asynchronous brand-discovery stage.
type SalesDiagnosisPreparation struct {
	BaseModel
	DiagnosisID      uint64     `gorm:"column:diagnosis_id;not null;uniqueIndex"`
	DiagnosisModelID *uint64    `gorm:"column:diagnosis_model_id;index"`
	Status           int32      `gorm:"column:status;type:tinyint unsigned;not null;index"`
	AttemptCount     uint32     `gorm:"column:attempt_count;not null;default:0"`
	LastErrorCode    string     `gorm:"column:last_error_code;type:varchar(64)"`
	LastErrorMessage string     `gorm:"column:last_error_message;type:varchar(1024)"`
	AvailableAt      time.Time  `gorm:"column:available_at;not null;index"`
	LeaseOwner       string     `gorm:"column:lease_owner;type:varchar(128)"`
	LeaseToken       string     `gorm:"column:lease_token;type:varchar(64);index"`
	LeaseExpiresAt   *time.Time `gorm:"column:lease_expires_at;index"`
	StartedAt        *time.Time `gorm:"column:started_at"`
	CompletedAt      *time.Time `gorm:"column:completed_at"`
}

func (SalesDiagnosisPreparation) TableName() string { return TableSalesDiagnosisPreparations }

// SalesDiagnosisPreparationAttempt preserves every model call used to prepare a diagnosis.
type SalesDiagnosisPreparationAttempt struct {
	BaseModel
	PreparationID     uint64 `gorm:"column:preparation_id;not null;index"`
	AttemptNo         uint32 `gorm:"column:attempt_no;not null"`
	Succeeded         bool   `gorm:"column:succeeded;not null;default:false"`
	Industry          string `gorm:"column:industry;type:varchar(128)"`
	BrandSummary      string `gorm:"column:brand_summary;type:text"`
	PromptSnapshot    string `gorm:"column:prompt_snapshot;type:longtext"`
	RawResponseJSON   []byte `gorm:"column:raw_response_json;type:json"`
	ProviderRequestID string `gorm:"column:provider_request_id;type:varchar(255)"`
	ResponseModel     string `gorm:"column:response_model;type:varchar(128)"`
	InputTokens       uint64 `gorm:"column:input_tokens;not null;default:0"`
	OutputTokens      uint64 `gorm:"column:output_tokens;not null;default:0"`
	CostMicros        int64  `gorm:"column:cost_micros;not null;default:0"`
	DurationMS        uint64 `gorm:"column:duration_ms;not null;default:0"`
	ErrorCode         string `gorm:"column:error_code;type:varchar(64)"`
	ErrorMessage      string `gorm:"column:error_message;type:varchar(1024)"`
}

func (SalesDiagnosisPreparationAttempt) TableName() string {
	return TableSalesDiagnosisPreparationAttempts
}

// SalesDiagnosisBrandTerm stores normalized terms discovered before platform sampling.
type SalesDiagnosisBrandTerm struct {
	BaseModel
	DiagnosisID uint64 `gorm:"column:diagnosis_id;not null;index"`
	Term        string `gorm:"column:term;type:varchar(255);not null"`
	TermType    int32  `gorm:"column:term_type;type:tinyint unsigned;not null;index"`
	Reason      string `gorm:"column:reason;type:varchar(512)"`
	SortOrder   int32  `gorm:"column:sort_order;not null;default:0"`
}

func (SalesDiagnosisBrandTerm) TableName() string { return TableSalesDiagnosisBrandTerms }

type SalesDiagnosisQuestion struct {
	BaseModel
	DiagnosisID uint64 `gorm:"column:diagnosis_id;not null;index"`
	Question    string `gorm:"column:question;type:text;not null"`
	SourceType  int32  `gorm:"column:source_type;type:tinyint unsigned;not null;default:1"`
	Intent      string `gorm:"column:intent;type:varchar(128)"`
	Reason      string `gorm:"column:reason;type:varchar(512)"`
	SortOrder   int32  `gorm:"column:sort_order;not null;default:0"`
}

func (SalesDiagnosisQuestion) TableName() string { return TableSalesDiagnosisQuestions }

// SalesDiagnosisModel freezes the non-secret model configuration used by one diagnosis.
type SalesDiagnosisModel struct {
	BaseModel
	DiagnosisID                       uint64  `gorm:"column:diagnosis_id;not null;index"`
	WritingModelID                    uint64  `gorm:"column:writing_model_id;not null;index"`
	DisplayName                       string  `gorm:"column:display_name;type:varchar(128);not null"`
	Provider                          int32   `gorm:"column:provider;type:tinyint unsigned;not null"`
	Protocol                          int32   `gorm:"column:protocol;type:tinyint unsigned;not null"`
	BaseURL                           string  `gorm:"column:base_url;type:varchar(512);not null"`
	ModelID                           string  `gorm:"column:model_id;type:varchar(128);not null"`
	ModelVersion                      uint64  `gorm:"column:model_version;not null"`
	Temperature                       float64 `gorm:"column:temperature;type:decimal(4,3);not null"`
	TopP                              float64 `gorm:"column:top_p;type:decimal(4,3);not null"`
	MaxTokens                         uint32  `gorm:"column:max_tokens;not null"`
	TimeoutSeconds                    uint32  `gorm:"column:timeout_seconds;not null"`
	InputPriceMicrosPerMillionTokens  int64   `gorm:"column:input_price_micros_per_million_tokens;not null;default:0"`
	OutputPriceMicrosPerMillionTokens int64   `gorm:"column:output_price_micros_per_million_tokens;not null;default:0"`
	CitationCapability                int32   `gorm:"column:citation_capability;type:tinyint unsigned;not null;default:1"`
	DiagnosisAPIMode                  int32   `gorm:"column:diagnosis_api_mode;type:tinyint unsigned;not null;default:1"`
	DiagnosisWebSearchEnabled         bool    `gorm:"column:diagnosis_web_search_enabled;not null;default:false"`
	SortOrder                         int32   `gorm:"column:sort_order;not null;default:0"`
}

func (SalesDiagnosisModel) TableName() string { return TableSalesDiagnosisModels }

type SalesDiagnosisTask struct {
	BaseModel
	DiagnosisID      uint64     `gorm:"column:diagnosis_id;not null;index"`
	QuestionID       uint64     `gorm:"column:question_id;not null;index"`
	DiagnosisModelID uint64     `gorm:"column:diagnosis_model_id;not null;index"`
	Status           int32      `gorm:"column:status;type:tinyint unsigned;not null;index"`
	AttemptCount     uint32     `gorm:"column:attempt_count;not null;default:0"`
	LastErrorCode    string     `gorm:"column:last_error_code;type:varchar(64)"`
	LastErrorMessage string     `gorm:"column:last_error_message;type:varchar(1024)"`
	StartedAt        *time.Time `gorm:"column:started_at"`
	CompletedAt      *time.Time `gorm:"column:completed_at"`
	AvailableAt      time.Time  `gorm:"column:available_at;not null;index"`
	LeaseOwner       string     `gorm:"column:lease_owner;type:varchar(128)"`
	LeaseToken       string     `gorm:"column:lease_token;type:varchar(64);index"`
	LeaseExpiresAt   *time.Time `gorm:"column:lease_expires_at;index"`
}

func (SalesDiagnosisTask) TableName() string { return TableSalesDiagnosisTasks }

// SalesDiagnosisResult appends one result for every task attempt and is never overwritten.
type SalesDiagnosisResult struct {
	BaseModel
	TaskID            uint64 `gorm:"column:task_id;not null;index"`
	AttemptNo         uint32 `gorm:"column:attempt_no;not null"`
	Succeeded         bool   `gorm:"column:succeeded;not null;default:false"`
	Answer            string `gorm:"column:answer;type:longtext"`
	RawResponseJSON   []byte `gorm:"column:raw_response_json;type:json"`
	ProviderRequestID string `gorm:"column:provider_request_id;type:varchar(255)"`
	ResponseModel     string `gorm:"column:response_model;type:varchar(128)"`
	PromptSnapshot    string `gorm:"column:prompt_snapshot;type:longtext"`
	EvidenceType      int32  `gorm:"column:evidence_type;type:tinyint unsigned;not null;default:1"`
	InputTokens       uint64 `gorm:"column:input_tokens;not null;default:0"`
	OutputTokens      uint64 `gorm:"column:output_tokens;not null;default:0"`
	CostMicros        int64  `gorm:"column:cost_micros;not null;default:0"`
	DurationMS        uint64 `gorm:"column:duration_ms;not null;default:0"`
	BrandMentioned    bool   `gorm:"column:brand_mentioned;not null;default:false"`
	BrandPosition     int32  `gorm:"column:brand_position;not null;default:0"`
	ErrorCode         string `gorm:"column:error_code;type:varchar(64)"`
	ErrorMessage      string `gorm:"column:error_message;type:varchar(1024)"`
}

func (SalesDiagnosisResult) TableName() string { return TableSalesDiagnosisResults }

type SalesDiagnosisCitation struct {
	BaseModel
	ResultID           uint64     `gorm:"column:result_id;not null;index"`
	ProviderSourceID   string     `gorm:"column:provider_source_id;type:varchar(255)"`
	SourceName         string     `gorm:"column:source_name;type:varchar(255)"`
	Title              string     `gorm:"column:title;type:varchar(512)"`
	URL                string     `gorm:"column:url;type:varchar(2048);not null"`
	Domain             string     `gorm:"column:domain;type:varchar(255);not null;index"`
	Snippet            string     `gorm:"column:snippet;type:text"`
	Position           int32      `gorm:"column:position;not null;default:0"`
	OwnershipType      int32      `gorm:"column:ownership_type;type:tinyint unsigned;not null;default:1"`
	SourceType         int32      `gorm:"column:source_type;type:tinyint unsigned;not null;default:1"`
	VerificationStatus int32      `gorm:"column:verification_status;type:tinyint unsigned;not null;default:1"`
	CapturedAt         *time.Time `gorm:"column:captured_at"`
	SortOrder          int32      `gorm:"column:sort_order;not null;default:0"`
}

func (SalesDiagnosisCitation) TableName() string { return TableSalesDiagnosisCitations }

type SalesDiagnosisCompetitorMention struct {
	BaseModel
	ResultID       uint64 `gorm:"column:result_id;not null;index"`
	CompetitorName string `gorm:"column:competitor_name;type:varchar(128);not null;index"`
	Position       int32  `gorm:"column:position;not null;default:0"`
}

func (SalesDiagnosisCompetitorMention) TableName() string {
	return TableSalesDiagnosisCompetitors
}

// SalesDiagnosisResultAnalysis preserves the structured analyzer input/output for one immutable model answer.
type SalesDiagnosisResultAnalysis struct {
	BaseModel
	ResultID               uint64  `gorm:"column:result_id;not null;index"`
	AnalysisVersion        uint32  `gorm:"column:analysis_version;not null"`
	RuleVersion            string  `gorm:"column:rule_version;type:varchar(64);not null"`
	AnalyzerKind           int32   `gorm:"column:analyzer_kind;type:tinyint unsigned;not null"`
	AnalyzerModelName      string  `gorm:"column:analyzer_model_name;type:varchar(128)"`
	PromptSnapshot         string  `gorm:"column:prompt_snapshot;type:longtext"`
	RawResponseJSON        []byte  `gorm:"column:raw_response_json;type:json"`
	Status                 int32   `gorm:"column:status;type:tinyint unsigned;not null"`
	DominantSentiment      int32   `gorm:"column:dominant_sentiment;type:tinyint unsigned;not null;default:1"`
	Confidence             float64 `gorm:"column:confidence;type:decimal(6,5);not null;default:0"`
	Included               bool    `gorm:"column:included;not null;default:false"`
	CompletenessScore      float64 `gorm:"column:completeness_score;type:decimal(6,5);not null;default:0"`
	AnswerQualityScore     float64 `gorm:"column:answer_quality_score;type:decimal(6,5);not null;default:0"`
	FreshnessScore         float64 `gorm:"column:freshness_score;type:decimal(6,5);not null;default:0"`
	FreshnessAvailable     bool    `gorm:"column:freshness_available;not null;default:false"`
	RecommendationPosition int32   `gorm:"column:recommendation_position;not null;default:0"`
	AnswerSummary          string  `gorm:"column:answer_summary;type:text"`
	Strengths              string  `gorm:"column:strengths;type:text"`
	Gaps                   string  `gorm:"column:gaps;type:text"`
	ErrorMessage           string  `gorm:"column:error_message;type:varchar(1024)"`
}

func (SalesDiagnosisResultAnalysis) TableName() string { return TableSalesDiagnosisResultAnalyses }

// SalesDiagnosisEntityMention stores target, configured competitor, and newly discovered brand evidence.
type SalesDiagnosisEntityMention struct {
	BaseModel
	AnalysisID      uint64  `gorm:"column:analysis_id;not null;index"`
	EntityType      int32   `gorm:"column:entity_type;type:tinyint unsigned;not null;index"`
	EntityRefID     *uint64 `gorm:"column:entity_ref_id"`
	EntityName      string  `gorm:"column:entity_name;type:varchar(128);not null;index"`
	MentionCount    uint32  `gorm:"column:mention_count;not null;default:0"`
	FirstPosition   int32   `gorm:"column:first_position;not null;default:0"`
	RankPosition    int32   `gorm:"column:rank_position;not null;default:0"`
	Sentiment       int32   `gorm:"column:sentiment;type:tinyint unsigned;not null;default:1"`
	Confidence      float64 `gorm:"column:confidence;type:decimal(6,5);not null;default:0"`
	EvidenceExcerpt string  `gorm:"column:evidence_excerpt;type:text"`
}

func (SalesDiagnosisEntityMention) TableName() string { return TableSalesDiagnosisEntityMentions }

type SalesDiagnosisClaimMatch struct {
	BaseModel
	AnalysisID      uint64  `gorm:"column:analysis_id;not null;index"`
	ClaimID         uint64  `gorm:"column:claim_id;not null;index"`
	Matched         bool    `gorm:"column:matched;not null;default:false"`
	Confidence      float64 `gorm:"column:confidence;type:decimal(6,5);not null;default:0"`
	EvidenceExcerpt string  `gorm:"column:evidence_excerpt;type:text"`
}

func (SalesDiagnosisClaimMatch) TableName() string { return TableSalesDiagnosisClaimMatches }

type SalesDiagnosisMetric struct {
	BaseModel
	DiagnosisID        uint64  `gorm:"column:diagnosis_id;not null;index"`
	ModelID            *uint64 `gorm:"column:diagnosis_model_id;index"`
	MetricCode         string  `gorm:"column:metric_code;type:varchar(64);not null"`
	Numerator          int64   `gorm:"column:numerator;not null;default:0"`
	Denominator        int64   `gorm:"column:denominator;not null;default:0"`
	Value              float64 `gorm:"column:value;type:decimal(12,6);not null;default:0"`
	SampleCount        uint32  `gorm:"column:sample_count;not null;default:0"`
	AvailabilityStatus int32   `gorm:"column:availability_status;type:tinyint unsigned;not null;default:1"`
	RuleVersion        string  `gorm:"column:rule_version;type:varchar(64);not null;default:'geo-report-v1'"`
	Generation         uint64  `gorm:"column:generation;not null;default:1"`
	IsCurrent          bool    `gorm:"column:is_current;not null;default:true;index"`
}

func (SalesDiagnosisMetric) TableName() string { return TableSalesDiagnosisMetrics }

type SalesDiagnosisMetricSample struct {
	BaseModel
	MetricID         uint64  `gorm:"column:metric_id;not null;index"`
	ResultID         uint64  `gorm:"column:result_id;not null;index"`
	NumeratorValue   float64 `gorm:"column:numerator_value;type:decimal(12,6);not null;default:0"`
	DenominatorValue float64 `gorm:"column:denominator_value;type:decimal(12,6);not null;default:0"`
	Eligible         bool    `gorm:"column:eligible;not null;default:false"`
	Reason           string  `gorm:"column:reason;type:varchar(255)"`
}

func (SalesDiagnosisMetricSample) TableName() string { return TableSalesDiagnosisMetricSamples }

const (
	SalesDiagnosisReportStatusReady int32 = 1

	SalesDiagnosisReportFindingIssue          int32 = 1
	SalesDiagnosisReportFindingOpportunity    int32 = 2
	SalesDiagnosisReportFindingRecommendation int32 = 3

	SalesDiagnosisReportSeverityInfo   int32 = 1
	SalesDiagnosisReportSeverityMedium int32 = 2
	SalesDiagnosisReportSeverityHigh   int32 = 3
)

// SalesDiagnosisReport stores one normalized, printable report for the latest diagnosis results.
type SalesDiagnosisReport struct {
	BaseModel
	DiagnosisID       uint64    `gorm:"column:diagnosis_id;not null;index"`
	Status            int32     `gorm:"column:status;type:tinyint unsigned;not null"`
	TemplateCode      string    `gorm:"column:template_code;type:varchar(64);not null"`
	TemplateVersion   uint32    `gorm:"column:template_version;not null"`
	Title             string    `gorm:"column:title;type:varchar(255);not null"`
	ExecutiveSummary  string    `gorm:"column:executive_summary;type:text;not null"`
	OverallConclusion string    `gorm:"column:overall_conclusion;type:text;not null"`
	Methodology       string    `gorm:"column:methodology;type:text;not null"`
	Disclaimer        string    `gorm:"column:disclaimer;type:text;not null"`
	GeneratedAt       time.Time `gorm:"column:generated_at;not null"`
	Version           uint64    `gorm:"column:version;not null;default:1"`
	IsCurrent         bool      `gorm:"column:is_current;not null;default:true;index"`
}

func (SalesDiagnosisReport) TableName() string { return TableSalesDiagnosisReports }

// SalesDiagnosisReportModel stores one model's normalized report metrics.
type SalesDiagnosisReportModel struct {
	BaseModel
	ReportID                        uint64  `gorm:"column:report_id;not null;index"`
	DiagnosisModelID                uint64  `gorm:"column:diagnosis_model_id;not null;index"`
	ModelName                       string  `gorm:"column:model_name;type:varchar(128);not null"`
	SampleCount                     uint32  `gorm:"column:sample_count;not null"`
	SucceededCount                  uint32  `gorm:"column:succeeded_count;not null"`
	FailedCount                     uint32  `gorm:"column:failed_count;not null"`
	BrandMentionRate                float64 `gorm:"column:brand_mention_rate;type:decimal(12,6);not null"`
	InclusionRate                   float64 `gorm:"column:inclusion_rate;type:decimal(12,6);not null;default:0"`
	CompletenessScore               float64 `gorm:"column:completeness_score;type:decimal(12,6);not null;default:0"`
	AnswerQualityScore              float64 `gorm:"column:answer_quality_score;type:decimal(12,6);not null;default:0"`
	AverageRecommendationPosition   float64 `gorm:"column:average_recommendation_position;type:decimal(12,6);not null;default:0"`
	RecommendationPositionAvailable bool    `gorm:"column:recommendation_position_available;not null;default:false"`
	TimelinessRate                  float64 `gorm:"column:timeliness_rate;type:decimal(12,6);not null;default:0"`
	TimelinessAvailable             bool    `gorm:"column:timeliness_available;not null;default:false"`
	OverallRating                   string  `gorm:"column:overall_rating;type:varchar(16);not null;default:'待评估'"`
	Strengths                       string  `gorm:"column:strengths;type:text"`
	Gaps                            string  `gorm:"column:gaps;type:text"`
	DiagnosisConclusion             string  `gorm:"column:diagnosis_conclusion;type:text"`
	CitationRate                    float64 `gorm:"column:citation_rate;type:decimal(12,6);not null"`
	BrandShareOfVoice               float64 `gorm:"column:brand_share_of_voice;type:decimal(12,6);not null"`
	MentionCount                    uint32  `gorm:"column:mention_count;not null;default:0"`
	Top3Rate                        float64 `gorm:"column:top3_rate;type:decimal(12,6);not null;default:0"`
	Top3Available                   bool    `gorm:"column:top3_available;not null;default:false"`
	ContentAdoptionRate             float64 `gorm:"column:content_adoption_rate;type:decimal(12,6);not null;default:0"`
	ContentAdoptionAvailable        bool    `gorm:"column:content_adoption_available;not null;default:false"`
	CitationAvailable               bool    `gorm:"column:citation_available;not null;default:false"`
	PositiveCount                   uint32  `gorm:"column:positive_count;not null;default:0"`
	NeutralCount                    uint32  `gorm:"column:neutral_count;not null;default:0"`
	NegativeCount                   uint32  `gorm:"column:negative_count;not null;default:0"`
	UnknownSentimentCount           uint32  `gorm:"column:unknown_sentiment_count;not null;default:0"`
	Summary                         string  `gorm:"column:summary;type:text;not null"`
	SortOrder                       int32   `gorm:"column:sort_order;not null;default:0"`
}

func (SalesDiagnosisReportModel) TableName() string { return TableSalesDiagnosisReportModels }

// SalesDiagnosisReportQuestion stores cross-model findings for one question.
type SalesDiagnosisReportQuestion struct {
	BaseModel
	ReportID                    uint64 `gorm:"column:report_id;not null;index"`
	QuestionID                  uint64 `gorm:"column:question_id;not null;index"`
	Question                    string `gorm:"column:question;type:text;not null"`
	SuccessfulModelCount        uint32 `gorm:"column:successful_model_count;not null"`
	FailedModelCount            uint32 `gorm:"column:failed_model_count;not null"`
	BrandMentionedModelCount    uint32 `gorm:"column:brand_mentioned_model_count;not null"`
	CompetitorMentionModelCount uint32 `gorm:"column:competitor_mentioned_model_count;not null"`
	Summary                     string `gorm:"column:summary;type:text;not null"`
	SortOrder                   int32  `gorm:"column:sort_order;not null;default:0"`
}

func (SalesDiagnosisReportQuestion) TableName() string {
	return TableSalesDiagnosisReportQuestions
}

// SalesDiagnosisReportAnswer links the immutable answer used by a report question.
type SalesDiagnosisReportAnswer struct {
	BaseModel
	ReportQuestionID uint64 `gorm:"column:report_question_id;not null;index"`
	ResultID         uint64 `gorm:"column:result_id;not null;index"`
	DiagnosisModelID uint64 `gorm:"column:diagnosis_model_id;not null;index"`
	ModelName        string `gorm:"column:model_name;type:varchar(128);not null"`
	AnswerExcerpt    string `gorm:"column:answer_excerpt;type:text;not null"`
	BrandMentioned   bool   `gorm:"column:brand_mentioned;not null"`
	EvidenceType     int32  `gorm:"column:evidence_type;type:tinyint unsigned;not null"`
	SortOrder        int32  `gorm:"column:sort_order;not null;default:0"`
}

func (SalesDiagnosisReportAnswer) TableName() string { return TableSalesDiagnosisReportAnswers }

// SalesDiagnosisReportFinding stores normalized issues, opportunities, and recommendations.
type SalesDiagnosisReportFinding struct {
	BaseModel
	ReportID     uint64 `gorm:"column:report_id;not null;index"`
	Type         int32  `gorm:"column:finding_type;type:tinyint unsigned;not null;index"`
	Severity     int32  `gorm:"column:severity;type:tinyint unsigned;not null"`
	SectionCode  string `gorm:"column:section_code;type:varchar(32);not null;default:'summary'"`
	Priority     int32  `gorm:"column:priority;type:tinyint unsigned;not null;default:3"`
	ImpactLevel  int32  `gorm:"column:impact_level;type:tinyint unsigned;not null;default:1"`
	UrgencyLevel int32  `gorm:"column:urgency_level;type:tinyint unsigned;not null;default:1"`
	Title        string `gorm:"column:title;type:varchar(255);not null"`
	Content      string `gorm:"column:content;type:text;not null"`
	SortOrder    int32  `gorm:"column:sort_order;not null;default:0"`
}

func (SalesDiagnosisReportFinding) TableName() string { return TableSalesDiagnosisReportFindings }

type SalesDiagnosisFindingEvidence struct {
	BaseModel
	FindingID    uint64  `gorm:"column:finding_id;not null;index"`
	MetricID     *uint64 `gorm:"column:metric_id;index"`
	ResultID     *uint64 `gorm:"column:result_id;index"`
	CitationID   *uint64 `gorm:"column:citation_id;index"`
	EvidenceType int32   `gorm:"column:evidence_type;type:tinyint unsigned;not null"`
	Note         string  `gorm:"column:note;type:varchar(255)"`
}

func (SalesDiagnosisFindingEvidence) TableName() string { return TableSalesDiagnosisFindingEvidences }

type SalesDiagnosisReportEntity struct {
	BaseModel
	ReportID             uint64  `gorm:"column:report_id;not null;index"`
	DiagnosisModelID     *uint64 `gorm:"column:diagnosis_model_id;index"`
	EntityType           int32   `gorm:"column:entity_type;type:tinyint unsigned;not null"`
	EntityName           string  `gorm:"column:entity_name;type:varchar(128);not null"`
	CompetitorLevel      int32   `gorm:"column:competitor_level;type:tinyint unsigned;not null;default:0"`
	ThreatLevel          int32   `gorm:"column:threat_level;type:tinyint unsigned;not null;default:0"`
	Location             string  `gorm:"column:location;type:varchar(128)"`
	RecommendationReason string  `gorm:"column:recommendation_reason;type:text"`
	MentionCount         uint32  `gorm:"column:mention_count;not null;default:0"`
	MentionRate          float64 `gorm:"column:mention_rate;type:decimal(12,6);not null;default:0"`
	AverageRank          float64 `gorm:"column:average_rank;type:decimal(12,6);not null;default:0"`
	Top3Count            uint32  `gorm:"column:top3_count;not null;default:0"`
	PositiveCount        uint32  `gorm:"column:positive_count;not null;default:0"`
	NeutralCount         uint32  `gorm:"column:neutral_count;not null;default:0"`
	NegativeCount        uint32  `gorm:"column:negative_count;not null;default:0"`
	SortOrder            int32   `gorm:"column:sort_order;not null;default:0"`
}

func (SalesDiagnosisReportEntity) TableName() string { return TableSalesDiagnosisReportEntities }

type SalesDiagnosisReportEntityEvidence struct {
	BaseModel
	ReportEntityID  uint64 `gorm:"column:report_entity_id;not null;index"`
	EntityMentionID uint64 `gorm:"column:entity_mention_id;not null;index"`
}

func (SalesDiagnosisReportEntityEvidence) TableName() string {
	return TableSalesDiagnosisReportEntityEvidence
}

type SalesDiagnosisReportSource struct {
	BaseModel
	ReportID         uint64  `gorm:"column:report_id;not null;index"`
	DiagnosisModelID *uint64 `gorm:"column:diagnosis_model_id;index"`
	Domain           string  `gorm:"column:domain;type:varchar(255);not null"`
	SourceName       string  `gorm:"column:source_name;type:varchar(255)"`
	OwnershipType    int32   `gorm:"column:ownership_type;type:tinyint unsigned;not null;default:1"`
	SourceType       int32   `gorm:"column:source_type;type:tinyint unsigned;not null;default:1"`
	CitationCount    uint32  `gorm:"column:citation_count;not null;default:0"`
	ShareRate        float64 `gorm:"column:share_rate;type:decimal(12,6);not null;default:0"`
	SortOrder        int32   `gorm:"column:sort_order;not null;default:0"`
}

func (SalesDiagnosisReportSource) TableName() string { return TableSalesDiagnosisReportSources }

type SalesDiagnosisReportSourceCitation struct {
	BaseModel
	ReportSourceID uint64 `gorm:"column:report_source_id;not null;index"`
	CitationID     uint64 `gorm:"column:citation_id;not null;index"`
}

func (SalesDiagnosisReportSourceCitation) TableName() string {
	return TableSalesDiagnosisReportSourceCitations
}
