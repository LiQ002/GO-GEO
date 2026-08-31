package biz

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrSalesDiagnosisNotFound  = errors.NotFound("SALES_DIAGNOSIS_NOT_FOUND", "sales diagnosis not found")
	ErrSalesDiagnosisInvalid   = errors.BadRequest("SALES_DIAGNOSIS_INVALID", "invalid sales diagnosis data")
	ErrSalesDiagnosisConflict  = errors.Conflict("SALES_DIAGNOSIS_CONFLICT", "sales diagnosis data has changed")
	ErrSalesDiagnosisForbidden = errors.Forbidden("SALES_DIAGNOSIS_FORBIDDEN", "sales diagnosis is outside the current data scope")
)

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

	SalesDiagnosisAnalysisStatusSucceeded int32 = 1
	SalesDiagnosisAnalysisStatusPartial   int32 = 2
	SalesDiagnosisAnalysisStatusFailed    int32 = 3
	SalesDiagnosisAnalyzerHybrid          int32 = 3

	SalesDiagnosisEntityTargetBrand          int32 = 1
	SalesDiagnosisEntityConfiguredCompetitor int32 = 2
	SalesDiagnosisEntityOtherBrand           int32 = 3

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

type SalesDiagnosisProfileProduct struct {
	Name           string
	Description    string
	SellingPoints  string
	TargetAudience string
}

type SalesDiagnosisProfileCompetitor struct {
	Name        string
	Website     string
	Description string
}

type SalesDiagnosisProfileClaim struct {
	ID           uint64
	ClaimType    int32
	SourceField  string
	SourceItemID uint64
	ClaimText    string
	SortOrder    int32
}

type SalesDiagnosisProfile struct {
	CustomerName   string
	Website        string
	Industry       string
	Region         string
	BrandName      string
	TargetAudience string
	CoreValue      string
	CurrentContent string
	PainPoints     string
	ExpectedGoals  string
	BrandAliases   []string
	Products       []*SalesDiagnosisProfileProduct
	Competitors    []*SalesDiagnosisProfileCompetitor
	Claims         []*SalesDiagnosisProfileClaim
	SourceVersion  uint64
}

type SalesDiagnosisQuestion struct {
	ID         uint64
	Question   string
	SourceType int32
	Intent     string
	Reason     string
	SortOrder  int32
}

type SalesDiagnosisBrandTerm struct {
	ID        uint64
	Term      string
	TermType  int32
	Reason    string
	SortOrder int32
}

type SalesDiagnosisPreparationAttempt struct {
	ID                uint64
	AttemptNo         uint32
	Succeeded         bool
	Industry          string
	BrandSummary      string
	PromptSnapshot    string
	RawResponseJSON   string
	ProviderRequestID string
	ResponseModel     string
	InputTokens       uint64
	OutputTokens      uint64
	CostMicros        int64
	DurationMS        uint64
	ErrorCode         string
	ErrorMessage      string
	CreatedAt         time.Time
}

type SalesDiagnosisPreparation struct {
	ID               uint64
	DiagnosisModelID uint64
	Status           int32
	AttemptCount     uint32
	LastErrorCode    string
	LastErrorMessage string
	StartedAt        *time.Time
	CompletedAt      *time.Time
	Attempts         []*SalesDiagnosisPreparationAttempt
}

type SalesDiagnosisModel struct {
	ID                                uint64
	WritingModelID                    uint64
	DisplayName                       string
	Provider                          int32
	Protocol                          int32
	BaseURL                           string
	ModelID                           string
	ModelVersion                      uint64
	Temperature                       float64
	TopP                              float64
	MaxTokens                         uint32
	TimeoutSeconds                    uint32
	InputPriceMicrosPerMillionTokens  int64
	OutputPriceMicrosPerMillionTokens int64
	CitationCapability                int32
	DiagnosisAPIMode                  int32
	DiagnosisWebSearchEnabled         bool
	SortOrder                         int32
}

type SalesDiagnosisCitation struct {
	ID                 uint64
	ProviderSourceID   string
	SourceName         string
	Title              string
	URL                string
	Domain             string
	Snippet            string
	Position           int32
	OwnershipType      int32
	SourceType         int32
	VerificationStatus int32
	CapturedAt         *time.Time
	SortOrder          int32
}

type SalesDiagnosisCompetitorMention struct {
	ID             uint64
	CompetitorName string
	Position       int32
}

type SalesDiagnosisEntityMention struct {
	ID              uint64
	EntityType      int32
	EntityRefID     uint64
	EntityName      string
	MentionCount    uint32
	FirstPosition   int32
	RankPosition    int32
	Sentiment       int32
	Confidence      float64
	EvidenceExcerpt string
}

type SalesDiagnosisClaimMatch struct {
	ID              uint64
	ClaimID         uint64
	Matched         bool
	Confidence      float64
	EvidenceExcerpt string
}

type SalesDiagnosisResultAnalysis struct {
	ID                     uint64
	AnalysisVersion        uint32
	RuleVersion            string
	AnalyzerKind           int32
	AnalyzerModelName      string
	PromptSnapshot         string
	RawResponseJSON        string
	Status                 int32
	DominantSentiment      int32
	Confidence             float64
	Included               bool
	CompletenessScore      float64
	AnswerQualityScore     float64
	FreshnessScore         float64
	FreshnessAvailable     bool
	RecommendationPosition int32
	AnswerSummary          string
	Strengths              string
	Gaps                   string
	ErrorMessage           string
	EntityMentions         []*SalesDiagnosisEntityMention
	ClaimMatches           []*SalesDiagnosisClaimMatch
}

type SalesDiagnosisResult struct {
	ID                 uint64
	TaskID             uint64
	AttemptNo          uint32
	Succeeded          bool
	Answer             string
	RawResponseJSON    string
	ProviderRequestID  string
	ResponseModel      string
	PromptSnapshot     string
	EvidenceType       int32
	InputTokens        uint64
	OutputTokens       uint64
	CostMicros         int64
	DurationMS         uint64
	BrandMentioned     bool
	BrandPosition      int32
	ErrorCode          string
	ErrorMessage       string
	LeaseToken         string
	Citations          []*SalesDiagnosisCitation
	CompetitorMentions []*SalesDiagnosisCompetitorMention
	Analysis           *SalesDiagnosisResultAnalysis
	CreatedAt          time.Time
}

type SalesDiagnosisTask struct {
	ID               uint64
	QuestionID       uint64
	DiagnosisModelID uint64
	Status           int32
	AttemptCount     uint32
	LastErrorCode    string
	LastErrorMessage string
	StartedAt        *time.Time
	CompletedAt      *time.Time
	Results          []*SalesDiagnosisResult
}

type SalesDiagnosisMetric struct {
	ID                 uint64
	DiagnosisModelID   uint64
	MetricCode         string
	Numerator          int64
	Denominator        int64
	Value              float64
	SampleCount        uint32
	AvailabilityStatus int32
	RuleVersion        string
	Samples            []*SalesDiagnosisMetricSample
}

type SalesDiagnosisMetricSample struct {
	ID               uint64
	ResultID         uint64
	NumeratorValue   float64
	DenominatorValue float64
	Eligible         bool
	Reason           string
}

const (
	SalesDiagnosisReportStatusReady int32 = 1

	SalesDiagnosisReportFindingIssue          int32 = 1
	SalesDiagnosisReportFindingOpportunity    int32 = 2
	SalesDiagnosisReportFindingRecommendation int32 = 3

	SalesDiagnosisReportSeverityInfo   int32 = 1
	SalesDiagnosisReportSeverityMedium int32 = 2
	SalesDiagnosisReportSeverityHigh   int32 = 3
)

type SalesDiagnosisReportAnswer struct {
	ID               uint64
	ResultID         uint64
	DiagnosisModelID uint64
	ModelName        string
	AnswerExcerpt    string
	BrandMentioned   bool
	EvidenceType     int32
	SortOrder        int32
}

type SalesDiagnosisReportQuestion struct {
	ID                            uint64
	QuestionID                    uint64
	Question                      string
	SuccessfulModelCount          uint32
	FailedModelCount              uint32
	BrandMentionedModelCount      uint32
	CompetitorMentionedModelCount uint32
	Summary                       string
	SortOrder                     int32
	Answers                       []*SalesDiagnosisReportAnswer
}

type SalesDiagnosisReportModel struct {
	ID                              uint64
	DiagnosisModelID                uint64
	ModelName                       string
	SampleCount                     uint32
	SucceededCount                  uint32
	FailedCount                     uint32
	BrandMentionRate                float64
	InclusionRate                   float64
	CompletenessScore               float64
	AnswerQualityScore              float64
	AverageRecommendationPosition   float64
	RecommendationPositionAvailable bool
	TimelinessRate                  float64
	TimelinessAvailable             bool
	OverallRating                   string
	Strengths                       string
	Gaps                            string
	DiagnosisConclusion             string
	CitationRate                    float64
	BrandShareOfVoice               float64
	MentionCount                    uint32
	Top3Rate                        float64
	Top3Available                   bool
	ContentAdoptionRate             float64
	ContentAdoptionAvailable        bool
	CitationAvailable               bool
	PositiveCount                   uint32
	NeutralCount                    uint32
	NegativeCount                   uint32
	UnknownSentimentCount           uint32
	Summary                         string
	SortOrder                       int32
}

type SalesDiagnosisReportFinding struct {
	ID           uint64
	Type         int32
	Severity     int32
	SectionCode  string
	Priority     int32
	ImpactLevel  int32
	UrgencyLevel int32
	Title        string
	Content      string
	SortOrder    int32
}

type SalesDiagnosisReportEntity struct {
	ID                   uint64
	DiagnosisModelID     uint64
	EntityType           int32
	EntityName           string
	CompetitorLevel      int32
	ThreatLevel          int32
	Location             string
	RecommendationReason string
	MentionCount         uint32
	MentionRate          float64
	AverageRank          float64
	Top3Count            uint32
	PositiveCount        uint32
	NeutralCount         uint32
	NegativeCount        uint32
	SortOrder            int32
	EvidenceMentionIDs   []uint64
}

type SalesDiagnosisReportSource struct {
	ID               uint64
	DiagnosisModelID uint64
	Domain           string
	SourceName       string
	OwnershipType    int32
	SourceType       int32
	CitationCount    uint32
	ShareRate        float64
	SortOrder        int32
	CitationIDs      []uint64
}

type SalesDiagnosisReport struct {
	ID                uint64
	Status            int32
	TemplateCode      string
	TemplateVersion   uint32
	Title             string
	ExecutiveSummary  string
	OverallConclusion string
	Methodology       string
	Disclaimer        string
	GeneratedAt       time.Time
	Version           uint64
	Models            []*SalesDiagnosisReportModel
	Questions         []*SalesDiagnosisReportQuestion
	Findings          []*SalesDiagnosisReportFinding
	Entities          []*SalesDiagnosisReportEntity
	Sources           []*SalesDiagnosisReportSource
}

type SalesDiagnosis struct {
	ID                   uint64
	Code                 string
	Name                 string
	SubjectType          int32
	OpportunityID        uint64
	EnterpriseID         uint64
	CreatedByAdminID     uint64
	CreatedByDisplayName string
	Status               int32
	QuestionCount        uint32
	ModelCount           uint32
	TaskCount            uint32
	SucceededTaskCount   uint32
	FailedTaskCount      uint32
	Profile              *SalesDiagnosisProfile
	Preparation          *SalesDiagnosisPreparation
	BrandTerms           []*SalesDiagnosisBrandTerm
	Questions            []*SalesDiagnosisQuestion
	Models               []*SalesDiagnosisModel
	Tasks                []*SalesDiagnosisTask
	Metrics              []*SalesDiagnosisMetric
	Report               *SalesDiagnosisReport
	StartedAt            *time.Time
	CompletedAt          *time.Time
	Version              uint64
	CreatedAt            time.Time
	UpdatedAt            time.Time
}

type CreateSalesDiagnosisCommand struct {
	Code            string
	Name            string
	SubjectType     int32
	OpportunityID   uint64
	EnterpriseID    uint64
	CustomerName    string
	BrandName       string
	Questions       []string
	WritingModelIDs []uint64
	OperatorID      uint64
	Access          SalesOpportunityAccess
}

type SalesDiagnosisListOptions struct {
	Offset        int
	Limit         int
	Keyword       string
	Status        int32
	SubjectType   int32
	OpportunityID uint64
	EnterpriseID  uint64
}

type SalesDiagnosisCancelCommand struct {
	ID         uint64
	Version    uint64
	Reason     string
	OperatorID uint64
	Access     SalesOpportunityAccess
}

type SalesDiagnosisMetricComparison struct {
	MetricCode            string
	BaselineValue         float64
	ComparisonValue       float64
	Delta                 float64
	BaselineSampleCount   uint32
	ComparisonSampleCount uint32
}

type SalesDiagnosisComparison struct {
	Baseline   *SalesDiagnosis
	Comparison *SalesDiagnosis
	Metrics    []*SalesDiagnosisMetricComparison
}

type SalesDiagnosisRunTask struct {
	DiagnosisID uint64
	TaskID      uint64
	AttemptNo   uint32
	LeaseToken  string
	Question    string
	Profile     *SalesDiagnosisProfile
	Model       *SalesDiagnosisModel
	BrandTerms  []*SalesDiagnosisBrandTerm
}

type SalesDiagnosisGeneratedQuestion struct {
	Question string
	Intent   string
	Reason   string
}

type SalesDiagnosisPreparationTask struct {
	DiagnosisID   uint64
	PreparationID uint64
	AttemptNo     uint32
	LeaseToken    string
	Profile       *SalesDiagnosisProfile
	Model         *SalesDiagnosisModel
}

type SalesDiagnosisPreparationResult struct {
	PreparationID     uint64
	AttemptNo         uint32
	LeaseToken        string
	Succeeded         bool
	Industry          string
	BrandSummary      string
	PromptSnapshot    string
	RawResponseJSON   string
	ProviderRequestID string
	ResponseModel     string
	InputTokens       uint64
	OutputTokens      uint64
	CostMicros        int64
	DurationMS        uint64
	ErrorCode         string
	ErrorMessage      string
	BrandTerms        []*SalesDiagnosisBrandTerm
	Questions         []*SalesDiagnosisGeneratedQuestion
}

type SalesDiagnosisRepo interface {
	Create(context.Context, CreateSalesDiagnosisCommand) (*SalesDiagnosis, error)
	Get(context.Context, uint64, SalesOpportunityAccess) (*SalesDiagnosis, error)
	List(context.Context, SalesDiagnosisListOptions, SalesOpportunityAccess) ([]*SalesDiagnosis, int64, error)
	Enqueue(context.Context, uint64, uint64, SalesOpportunityAccess) error
	ClaimNextPreparation(context.Context, string, time.Time, time.Duration) (*SalesDiagnosisPreparationTask, error)
	RecordPreparation(context.Context, *SalesDiagnosisPreparationResult) error
	ClaimNext(context.Context, string, time.Time, time.Duration) (*SalesDiagnosisRunTask, error)
	RecordResult(context.Context, *SalesDiagnosisResult) error
	FindPendingFinalization(context.Context) (uint64, error)
	Finalize(context.Context, uint64) error
	Cancel(context.Context, SalesDiagnosisCancelCommand) error
	PrepareRetry(context.Context, uint64, uint64, string, SalesOpportunityAccess) (uint64, error)
	Compare(context.Context, uint64, uint64, SalesOpportunityAccess) (*SalesDiagnosisComparison, error)
}

type SalesDiagnosisRunner interface {
	Prepare(context.Context, *SalesDiagnosisPreparationTask) (*SalesDiagnosisPreparationResult, error)
	Run(context.Context, *SalesDiagnosisRunTask) (*SalesDiagnosisResult, error)
}

type SalesDiagnosisUsecase struct {
	repo   SalesDiagnosisRepo
	runner SalesDiagnosisRunner
}

func NewSalesDiagnosisUsecase(repo SalesDiagnosisRepo, runner SalesDiagnosisRunner) *SalesDiagnosisUsecase {
	return &SalesDiagnosisUsecase{repo: repo, runner: runner}
}

func (uc *SalesDiagnosisUsecase) Create(ctx context.Context, cmd CreateSalesDiagnosisCommand) (*SalesDiagnosis, error) {
	if cmd.OperatorID == 0 || cmd.OperatorID != cmd.Access.AdminUserID || !validSalesOpportunityAccess(cmd.Access) {
		return nil, ErrSalesDiagnosisInvalid
	}
	cmd.Name = strings.TrimSpace(cmd.Name)
	cmd.CustomerName = strings.TrimSpace(cmd.CustomerName)
	cmd.BrandName = strings.TrimSpace(cmd.BrandName)
	if cmd.Name == "" && cmd.BrandName != "" {
		cmd.Name = cmd.BrandName + " GEO 售前诊断"
	}
	if cmd.Name == "" || !validDiagnosisSubject(cmd.SubjectType, cmd.OpportunityID, cmd.EnterpriseID, cmd.CustomerName, cmd.BrandName) {
		return nil, ErrSalesDiagnosisInvalid
	}
	if cmd.SubjectType == SalesDiagnosisSubjectEnterprise && !cmd.Access.CanAccessAll() {
		return nil, ErrSalesDiagnosisForbidden
	}
	cmd.Questions = normalizeDiagnosisQuestions(cmd.Questions)
	cmd.WritingModelIDs = normalizeDiagnosisModelIDs(cmd.WritingModelIDs)
	if len(cmd.Questions) > 50 || len(cmd.WritingModelIDs) > 10 {
		return nil, ErrSalesDiagnosisInvalid
	}
	code, err := newSalesDiagnosisCode(time.Now().UTC())
	if err != nil {
		return nil, ErrSalesDiagnosisInvalid
	}
	cmd.Code = code
	return uc.repo.Create(ctx, cmd)
}

func (uc *SalesDiagnosisUsecase) Get(ctx context.Context, id uint64, access SalesOpportunityAccess) (*SalesDiagnosis, error) {
	if id == 0 || !validSalesOpportunityAccess(access) {
		return nil, ErrSalesDiagnosisInvalid
	}
	return uc.repo.Get(ctx, id, access)
}

func (uc *SalesDiagnosisUsecase) List(ctx context.Context, opts SalesDiagnosisListOptions, access SalesOpportunityAccess) ([]*SalesDiagnosis, int64, error) {
	if !validSalesOpportunityAccess(access) || opts.Status < 0 || opts.Status > SalesDiagnosisStatusCancelled || opts.SubjectType < 0 || opts.SubjectType > SalesDiagnosisSubjectQuickBrand {
		return nil, 0, ErrSalesDiagnosisInvalid
	}
	opts.Keyword = strings.TrimSpace(opts.Keyword)
	return uc.repo.List(ctx, opts, access)
}

func (uc *SalesDiagnosisUsecase) Enqueue(ctx context.Context, id, version uint64, access SalesOpportunityAccess) (*SalesDiagnosis, error) {
	if id == 0 || version == 0 || !validSalesOpportunityAccess(access) {
		return nil, ErrSalesDiagnosisInvalid
	}
	if err := uc.repo.Enqueue(ctx, id, version, access); err != nil {
		return nil, err
	}
	return uc.repo.Get(ctx, id, access)
}

func (uc *SalesDiagnosisUsecase) ProcessNext(ctx context.Context, workerID string, leaseDuration time.Duration) (bool, error) {
	workerID = strings.TrimSpace(workerID)
	if workerID == "" || leaseDuration <= 0 {
		return false, ErrSalesDiagnosisInvalid
	}
	preparation, err := uc.repo.ClaimNextPreparation(ctx, workerID, time.Now().UTC(), leaseDuration)
	if err != nil {
		return false, err
	}
	if preparation != nil {
		if preparation.Model == nil {
			return true, ErrSalesDiagnosisInvalid
		}
		timeout := time.Duration(preparation.Model.TimeoutSeconds)*time.Second + 5*time.Second
		if timeout <= 5*time.Second {
			timeout = 2 * time.Minute
		}
		runCtx, cancel := context.WithTimeout(ctx, timeout)
		result, runErr := uc.runner.Prepare(runCtx, preparation)
		cancel()
		if result == nil {
			result = &SalesDiagnosisPreparationResult{
				PreparationID: preparation.PreparationID,
				AttemptNo:     preparation.AttemptNo,
			}
		}
		result.LeaseToken = preparation.LeaseToken
		if runErr != nil {
			result.Succeeded = false
			result.ErrorCode = "PREPARATION_MODEL_CALL_FAILED"
			result.ErrorMessage = runErr.Error()
		}
		if err := uc.repo.RecordPreparation(ctx, result); err != nil {
			return true, err
		}
		return true, nil
	}
	task, err := uc.repo.ClaimNext(ctx, workerID, time.Now().UTC(), leaseDuration)
	if err != nil || task == nil {
		return false, err
	}
	if task.Model == nil {
		return true, ErrSalesDiagnosisInvalid
	}
	timeout := time.Duration(task.Model.TimeoutSeconds)*time.Second + 5*time.Second
	if timeout <= 5*time.Second {
		timeout = 2 * time.Minute
	}
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	result, runErr := uc.runner.Run(runCtx, task)
	if result == nil {
		result = &SalesDiagnosisResult{TaskID: task.TaskID, AttemptNo: task.AttemptNo}
	}
	result.LeaseToken = task.LeaseToken
	if runErr != nil {
		result.Succeeded = false
		result.ErrorCode = "MODEL_CALL_FAILED"
		result.ErrorMessage = runErr.Error()
	}
	if err := uc.repo.RecordResult(ctx, result); err != nil {
		return true, err
	}
	if err := uc.repo.Finalize(ctx, task.DiagnosisID); err != nil {
		return true, fmt.Errorf("finalize diagnosis %d: %w", task.DiagnosisID, err)
	}
	return true, nil
}

// ReconcileNext completes one diagnosis whose model tasks are terminal but whose
// counters, metrics, or current report were not committed successfully.
func (uc *SalesDiagnosisUsecase) ReconcileNext(ctx context.Context) (bool, error) {
	diagnosisID, err := uc.repo.FindPendingFinalization(ctx)
	if err != nil || diagnosisID == 0 {
		return false, err
	}
	if err := uc.repo.Finalize(ctx, diagnosisID); err != nil {
		return true, fmt.Errorf("reconcile diagnosis %d: %w", diagnosisID, err)
	}
	return true, nil
}

func (uc *SalesDiagnosisUsecase) Cancel(ctx context.Context, cmd SalesDiagnosisCancelCommand) (*SalesDiagnosis, error) {
	cmd.Reason = strings.TrimSpace(cmd.Reason)
	if cmd.ID == 0 || cmd.Version == 0 || cmd.OperatorID == 0 || cmd.Reason == "" || !validSalesOpportunityAccess(cmd.Access) {
		return nil, ErrSalesDiagnosisInvalid
	}
	if err := uc.repo.Cancel(ctx, cmd); err != nil {
		return nil, err
	}
	return uc.repo.Get(ctx, cmd.ID, cmd.Access)
}

func (uc *SalesDiagnosisUsecase) RetryTask(ctx context.Context, taskID, operatorID uint64, reason string, access SalesOpportunityAccess) (*SalesDiagnosis, error) {
	reason = strings.TrimSpace(reason)
	if taskID == 0 || operatorID == 0 || operatorID != access.AdminUserID || reason == "" || !validSalesOpportunityAccess(access) {
		return nil, ErrSalesDiagnosisInvalid
	}
	diagnosisID, err := uc.repo.PrepareRetry(ctx, taskID, operatorID, reason, access)
	if err != nil {
		return nil, err
	}
	return uc.repo.Get(ctx, diagnosisID, access)
}

func (uc *SalesDiagnosisUsecase) Compare(ctx context.Context, baselineID, comparisonID uint64, access SalesOpportunityAccess) (*SalesDiagnosisComparison, error) {
	if baselineID == 0 || comparisonID == 0 || baselineID == comparisonID || !validSalesOpportunityAccess(access) {
		return nil, ErrSalesDiagnosisInvalid
	}
	return uc.repo.Compare(ctx, baselineID, comparisonID, access)
}

func validDiagnosisSubject(subjectType int32, opportunityID, enterpriseID uint64, customerName, brandName string) bool {
	return subjectType == SalesDiagnosisSubjectOpportunity && opportunityID != 0 && enterpriseID == 0 ||
		subjectType == SalesDiagnosisSubjectEnterprise && enterpriseID != 0 && opportunityID == 0 ||
		subjectType == SalesDiagnosisSubjectQuickBrand && opportunityID == 0 && enterpriseID == 0 && customerName != "" && brandName != ""
}

func normalizeDiagnosisQuestions(values []string) []string {
	items := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		key := strings.ToLower(value)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		items = append(items, value)
	}
	return items
}

func normalizeDiagnosisModelIDs(values []uint64) []uint64 {
	items := make([]uint64, 0, len(values))
	seen := make(map[uint64]struct{}, len(values))
	for _, value := range values {
		if value == 0 {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		items = append(items, value)
	}
	return items
}

func newSalesDiagnosisCode(now time.Time) (string, error) {
	var suffix [4]byte
	if _, err := rand.Read(suffix[:]); err != nil {
		return "", err
	}
	return "DX-" + now.UTC().Format("20060102-150405-") + strings.ToUpper(hex.EncodeToString(suffix[:])), nil
}
