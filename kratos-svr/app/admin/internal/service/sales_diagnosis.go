package service

import (
	"context"

	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type SalesDiagnosisService struct {
	v1.UnimplementedSalesDiagnosisServiceServer
	uc         *biz.SalesDiagnosisUsecase
	authorizer *biz.AdminAuthorizationUsecase
}

func NewSalesDiagnosisService(uc *biz.SalesDiagnosisUsecase, authorizer *biz.AdminAuthorizationUsecase) *SalesDiagnosisService {
	return &SalesDiagnosisService{uc: uc, authorizer: authorizer}
}

func (s *SalesDiagnosisService) CreateSalesDiagnosis(ctx context.Context, req *v1.CreateSalesDiagnosisRequest) (*v1.SalesDiagnosis, error) {
	access, err := s.access(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.Create(ctx, biz.CreateSalesDiagnosisCommand{
		Name: req.GetName(), SubjectType: int32(req.GetSubjectType()), OpportunityID: req.GetOpportunityId(),
		EnterpriseID: req.GetEnterpriseId(), CustomerName: req.GetCustomerName(), BrandName: req.GetBrandName(),
		Questions: req.GetQuestions(), WritingModelIDs: req.GetWritingModelIds(),
		OperatorID: access.AdminUserID, Access: access,
	})
	if err != nil {
		return nil, err
	}
	if req.GetStartImmediately() {
		item, err = s.uc.Enqueue(ctx, item.ID, item.Version, access)
		if err != nil {
			return nil, err
		}
	}
	return salesDiagnosisDTO(item), nil
}

func (s *SalesDiagnosisService) GetSalesDiagnosis(ctx context.Context, req *v1.GetSalesDiagnosisRequest) (*v1.SalesDiagnosis, error) {
	access, err := s.access(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.Get(ctx, req.GetId(), access)
	if err != nil {
		return nil, err
	}
	return salesDiagnosisDTO(item), nil
}

func (s *SalesDiagnosisService) ListSalesDiagnoses(ctx context.Context, req *v1.ListSalesDiagnosesRequest) (*v1.ListSalesDiagnosesReply, error) {
	page, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrSalesDiagnosisInvalid
	}
	access, err := s.access(ctx)
	if err != nil {
		return nil, err
	}
	items, total, err := s.uc.List(ctx, biz.SalesDiagnosisListOptions{
		Offset: page.Offset, Limit: page.Limit, Keyword: req.GetKeyword(), Status: int32(req.GetStatus()),
		SubjectType: int32(req.GetSubjectType()), OpportunityID: req.GetOpportunityId(), EnterpriseID: req.GetEnterpriseId(),
	}, access)
	if err != nil {
		return nil, err
	}
	reply := &v1.ListSalesDiagnosesReply{Items: make([]*v1.SalesDiagnosis, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, salesDiagnosisDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *SalesDiagnosisService) RunSalesDiagnosis(ctx context.Context, req *v1.RunSalesDiagnosisRequest) (*v1.SalesDiagnosis, error) {
	access, err := s.access(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.Enqueue(ctx, req.GetId(), req.GetVersion(), access)
	if err != nil {
		return nil, err
	}
	return salesDiagnosisDTO(item), nil
}

func (s *SalesDiagnosisService) CancelSalesDiagnosis(ctx context.Context, req *v1.CancelSalesDiagnosisRequest) (*v1.SalesDiagnosis, error) {
	access, err := s.access(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.Cancel(ctx, biz.SalesDiagnosisCancelCommand{
		ID: req.GetId(), Version: req.GetVersion(), Reason: req.GetReason(), OperatorID: access.AdminUserID, Access: access,
	})
	if err != nil {
		return nil, err
	}
	return salesDiagnosisDTO(item), nil
}

func (s *SalesDiagnosisService) RetrySalesDiagnosisTask(ctx context.Context, req *v1.RetrySalesDiagnosisTaskRequest) (*v1.SalesDiagnosis, error) {
	access, err := s.access(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.RetryTask(ctx, req.GetTaskId(), access.AdminUserID, req.GetReason(), access)
	if err != nil {
		return nil, err
	}
	return salesDiagnosisDTO(item), nil
}

func (s *SalesDiagnosisService) CompareSalesDiagnoses(ctx context.Context, req *v1.CompareSalesDiagnosesRequest) (*v1.CompareSalesDiagnosesReply, error) {
	access, err := s.access(ctx)
	if err != nil {
		return nil, err
	}
	comparison, err := s.uc.Compare(ctx, req.GetBaselineId(), req.GetComparisonId(), access)
	if err != nil {
		return nil, err
	}
	reply := &v1.CompareSalesDiagnosesReply{
		Baseline: salesDiagnosisDTO(comparison.Baseline), Comparison: salesDiagnosisDTO(comparison.Comparison),
		Metrics: make([]*v1.SalesDiagnosisMetricComparison, 0, len(comparison.Metrics)),
	}
	for _, metric := range comparison.Metrics {
		reply.Metrics = append(reply.Metrics, &v1.SalesDiagnosisMetricComparison{
			MetricCode: metric.MetricCode, BaselineValue: metric.BaselineValue, ComparisonValue: metric.ComparisonValue,
			Delta: metric.Delta, BaselineSampleCount: metric.BaselineSampleCount, ComparisonSampleCount: metric.ComparisonSampleCount,
		})
	}
	return reply, nil
}

func (s *SalesDiagnosisService) access(ctx context.Context) (biz.SalesOpportunityAccess, error) {
	operatorID, err := adminOperatorID(ctx)
	if err != nil {
		return biz.SalesOpportunityAccess{}, err
	}
	scope, err := s.authorizer.DataScope(ctx, operatorID)
	if err != nil {
		return biz.SalesOpportunityAccess{}, err
	}
	return biz.SalesOpportunityAccess{AdminUserID: operatorID, DataScope: scope}, nil
}

func salesDiagnosisDTO(item *biz.SalesDiagnosis) *v1.SalesDiagnosis {
	if item == nil {
		return nil
	}
	out := &v1.SalesDiagnosis{
		Id: item.ID, Code: item.Code, Name: item.Name, SubjectType: v1.SalesDiagnosisSubjectType(item.SubjectType),
		OpportunityId: item.OpportunityID, EnterpriseId: item.EnterpriseID, CreatedByAdminId: item.CreatedByAdminID,
		CreatedByDisplayName: item.CreatedByDisplayName, Status: v1.SalesDiagnosisStatus(item.Status),
		QuestionCount: item.QuestionCount, ModelCount: item.ModelCount, TaskCount: item.TaskCount,
		SucceededTaskCount: item.SucceededTaskCount, FailedTaskCount: item.FailedTaskCount,
		Profile: salesDiagnosisProfileDTO(item.Profile), StartedAt: timestampProto(item.StartedAt), CompletedAt: timestampProto(item.CompletedAt),
		Report: salesDiagnosisReportDTO(item.Report), Preparation: salesDiagnosisPreparationDTO(item.Preparation),
		Version: item.Version, CreatedAt: timestamppb.New(item.CreatedAt), UpdatedAt: timestamppb.New(item.UpdatedAt),
		Questions: make([]*v1.SalesDiagnosisQuestion, 0, len(item.Questions)), Models: make([]*v1.SalesDiagnosisModel, 0, len(item.Models)),
		Tasks: make([]*v1.SalesDiagnosisTask, 0, len(item.Tasks)), Metrics: make([]*v1.SalesDiagnosisMetric, 0, len(item.Metrics)),
		BrandTerms: make([]*v1.SalesDiagnosisBrandTerm, 0, len(item.BrandTerms)),
	}
	for _, question := range item.Questions {
		out.Questions = append(out.Questions, &v1.SalesDiagnosisQuestion{
			Id: question.ID, Question: question.Question, SortOrder: question.SortOrder,
			SourceType: question.SourceType, Intent: question.Intent, Reason: question.Reason,
		})
	}
	for _, term := range item.BrandTerms {
		out.BrandTerms = append(out.BrandTerms, &v1.SalesDiagnosisBrandTerm{
			Id: term.ID, Term: term.Term, TermType: v1.SalesDiagnosisBrandTermType(term.TermType),
			Reason: term.Reason, SortOrder: term.SortOrder,
		})
	}
	for _, diagnosisModel := range item.Models {
		out.Models = append(out.Models, &v1.SalesDiagnosisModel{
			Id: diagnosisModel.ID, WritingModelId: diagnosisModel.WritingModelID, DisplayName: diagnosisModel.DisplayName,
			Provider: diagnosisModel.Provider, Protocol: diagnosisModel.Protocol, BaseUrl: diagnosisModel.BaseURL,
			ModelId: diagnosisModel.ModelID, ModelVersion: diagnosisModel.ModelVersion, Temperature: diagnosisModel.Temperature,
			TopP: diagnosisModel.TopP, MaxTokens: diagnosisModel.MaxTokens, TimeoutSeconds: diagnosisModel.TimeoutSeconds,
			CitationCapability: diagnosisModel.CitationCapability, SortOrder: diagnosisModel.SortOrder,
			DiagnosisApiMode:          diagnosisModel.DiagnosisAPIMode,
			DiagnosisWebSearchEnabled: diagnosisModel.DiagnosisWebSearchEnabled,
		})
	}
	for _, task := range item.Tasks {
		out.Tasks = append(out.Tasks, salesDiagnosisTaskDTO(task))
	}
	for _, metric := range item.Metrics {
		metricDTO := &v1.SalesDiagnosisMetric{
			Id: metric.ID, DiagnosisModelId: metric.DiagnosisModelID, MetricCode: metric.MetricCode,
			Numerator: metric.Numerator, Denominator: metric.Denominator, Value: metric.Value,
			SampleCount: metric.SampleCount, AvailabilityStatus: metric.AvailabilityStatus, RuleVersion: metric.RuleVersion,
			Samples: make([]*v1.SalesDiagnosisMetricSample, 0, len(metric.Samples)),
		}
		for _, sample := range metric.Samples {
			metricDTO.Samples = append(metricDTO.Samples, &v1.SalesDiagnosisMetricSample{
				Id: sample.ID, ResultId: sample.ResultID, NumeratorValue: sample.NumeratorValue,
				DenominatorValue: sample.DenominatorValue, Eligible: sample.Eligible, Reason: sample.Reason,
			})
		}
		out.Metrics = append(out.Metrics, metricDTO)
	}
	return out
}

func salesDiagnosisPreparationDTO(item *biz.SalesDiagnosisPreparation) *v1.SalesDiagnosisPreparation {
	if item == nil {
		return nil
	}
	out := &v1.SalesDiagnosisPreparation{
		Id: item.ID, DiagnosisModelId: item.DiagnosisModelID,
		Status: v1.SalesDiagnosisPreparationStatus(item.Status), AttemptCount: item.AttemptCount,
		LastErrorCode: item.LastErrorCode, LastErrorMessage: item.LastErrorMessage,
		StartedAt: timestampProto(item.StartedAt), CompletedAt: timestampProto(item.CompletedAt),
		Attempts: make([]*v1.SalesDiagnosisPreparationAttempt, 0, len(item.Attempts)),
	}
	for _, attempt := range item.Attempts {
		out.Attempts = append(out.Attempts, &v1.SalesDiagnosisPreparationAttempt{
			Id: attempt.ID, AttemptNo: attempt.AttemptNo, Succeeded: attempt.Succeeded,
			Industry: attempt.Industry, BrandSummary: attempt.BrandSummary,
			PromptSnapshot: attempt.PromptSnapshot, RawResponseJson: attempt.RawResponseJSON,
			ProviderRequestId: attempt.ProviderRequestID, ResponseModel: attempt.ResponseModel,
			InputTokens: attempt.InputTokens, OutputTokens: attempt.OutputTokens,
			CostMicros: attempt.CostMicros, DurationMs: attempt.DurationMS,
			ErrorCode: attempt.ErrorCode, ErrorMessage: attempt.ErrorMessage,
			CreatedAt: timestamppb.New(attempt.CreatedAt),
		})
	}
	return out
}

func salesDiagnosisReportDTO(item *biz.SalesDiagnosisReport) *v1.SalesDiagnosisReport {
	if item == nil {
		return nil
	}
	out := &v1.SalesDiagnosisReport{
		Id: item.ID, Status: v1.SalesDiagnosisReportStatus(item.Status),
		TemplateCode: item.TemplateCode, TemplateVersion: item.TemplateVersion, Title: item.Title,
		ExecutiveSummary: item.ExecutiveSummary, OverallConclusion: item.OverallConclusion,
		Methodology: item.Methodology, Disclaimer: item.Disclaimer,
		GeneratedAt: timestamppb.New(item.GeneratedAt), Version: item.Version,
		Models:    make([]*v1.SalesDiagnosisReportModel, 0, len(item.Models)),
		Questions: make([]*v1.SalesDiagnosisReportQuestion, 0, len(item.Questions)),
		Findings:  make([]*v1.SalesDiagnosisReportFinding, 0, len(item.Findings)),
		Entities:  make([]*v1.SalesDiagnosisReportEntity, 0, len(item.Entities)),
		Sources:   make([]*v1.SalesDiagnosisReportSource, 0, len(item.Sources)),
	}
	for _, reportModel := range item.Models {
		out.Models = append(out.Models, &v1.SalesDiagnosisReportModel{
			Id: reportModel.ID, DiagnosisModelId: reportModel.DiagnosisModelID, ModelName: reportModel.ModelName,
			SampleCount: reportModel.SampleCount, SucceededCount: reportModel.SucceededCount, FailedCount: reportModel.FailedCount,
			BrandMentionRate: reportModel.BrandMentionRate, CitationRate: reportModel.CitationRate,
			InclusionRate: reportModel.InclusionRate, CompletenessScore: reportModel.CompletenessScore,
			AnswerQualityScore:              reportModel.AnswerQualityScore,
			AverageRecommendationPosition:   reportModel.AverageRecommendationPosition,
			RecommendationPositionAvailable: reportModel.RecommendationPositionAvailable,
			TimelinessRate:                  reportModel.TimelinessRate, TimelinessAvailable: reportModel.TimelinessAvailable,
			OverallRating: reportModel.OverallRating, Strengths: reportModel.Strengths,
			Gaps: reportModel.Gaps, DiagnosisConclusion: reportModel.DiagnosisConclusion,
			BrandShareOfVoice: reportModel.BrandShareOfVoice, MentionCount: reportModel.MentionCount,
			Top3Rate: reportModel.Top3Rate, Top3Available: reportModel.Top3Available,
			ContentAdoptionRate: reportModel.ContentAdoptionRate, ContentAdoptionAvailable: reportModel.ContentAdoptionAvailable,
			CitationAvailable: reportModel.CitationAvailable, PositiveCount: reportModel.PositiveCount,
			NeutralCount: reportModel.NeutralCount, NegativeCount: reportModel.NegativeCount,
			UnknownSentimentCount: reportModel.UnknownSentimentCount,
			Summary:               reportModel.Summary, SortOrder: reportModel.SortOrder,
		})
	}
	for _, entity := range item.Entities {
		out.Entities = append(out.Entities, &v1.SalesDiagnosisReportEntity{
			Id: entity.ID, DiagnosisModelId: entity.DiagnosisModelID, EntityType: entity.EntityType,
			EntityName: entity.EntityName, MentionCount: entity.MentionCount, MentionRate: entity.MentionRate,
			AverageRank: entity.AverageRank, Top3Count: entity.Top3Count, PositiveCount: entity.PositiveCount,
			NeutralCount: entity.NeutralCount, NegativeCount: entity.NegativeCount, SortOrder: entity.SortOrder,
			EvidenceMentionIds: entity.EvidenceMentionIDs, CompetitorLevel: entity.CompetitorLevel,
			ThreatLevel: entity.ThreatLevel, Location: entity.Location, RecommendationReason: entity.RecommendationReason,
		})
	}
	for _, source := range item.Sources {
		out.Sources = append(out.Sources, &v1.SalesDiagnosisReportSource{
			Id: source.ID, DiagnosisModelId: source.DiagnosisModelID, Domain: source.Domain,
			SourceName: source.SourceName, OwnershipType: source.OwnershipType, CitationCount: source.CitationCount,
			ShareRate: source.ShareRate, SortOrder: source.SortOrder, CitationIds: source.CitationIDs,
			SourceType: source.SourceType,
		})
	}
	for _, reportQuestion := range item.Questions {
		question := &v1.SalesDiagnosisReportQuestion{
			Id: reportQuestion.ID, QuestionId: reportQuestion.QuestionID, Question: reportQuestion.Question,
			SuccessfulModelCount: reportQuestion.SuccessfulModelCount, FailedModelCount: reportQuestion.FailedModelCount,
			BrandMentionedModelCount:      reportQuestion.BrandMentionedModelCount,
			CompetitorMentionedModelCount: reportQuestion.CompetitorMentionedModelCount,
			Summary:                       reportQuestion.Summary, SortOrder: reportQuestion.SortOrder,
			Answers: make([]*v1.SalesDiagnosisReportAnswer, 0, len(reportQuestion.Answers)),
		}
		for _, answer := range reportQuestion.Answers {
			question.Answers = append(question.Answers, &v1.SalesDiagnosisReportAnswer{
				Id: answer.ID, ResultId: answer.ResultID, DiagnosisModelId: answer.DiagnosisModelID,
				ModelName: answer.ModelName, AnswerExcerpt: answer.AnswerExcerpt,
				BrandMentioned: answer.BrandMentioned, EvidenceType: v1.SalesDiagnosisEvidenceType(answer.EvidenceType),
				SortOrder: answer.SortOrder,
			})
		}
		out.Questions = append(out.Questions, question)
	}
	for _, finding := range item.Findings {
		out.Findings = append(out.Findings, &v1.SalesDiagnosisReportFinding{
			Id: finding.ID, Type: v1.SalesDiagnosisReportFindingType(finding.Type),
			Severity: v1.SalesDiagnosisReportSeverity(finding.Severity),
			Title:    finding.Title, Content: finding.Content, SortOrder: finding.SortOrder,
			SectionCode: finding.SectionCode, Priority: finding.Priority,
			ImpactLevel: finding.ImpactLevel, UrgencyLevel: finding.UrgencyLevel,
		})
	}
	return out
}

func salesDiagnosisProfileDTO(item *biz.SalesDiagnosisProfile) *v1.SalesDiagnosisProfile {
	if item == nil {
		return nil
	}
	out := &v1.SalesDiagnosisProfile{
		CustomerName: item.CustomerName, Website: item.Website, Industry: item.Industry, Region: item.Region,
		BrandName: item.BrandName, TargetAudience: item.TargetAudience, CoreValue: item.CoreValue,
		CurrentContent: item.CurrentContent, PainPoints: item.PainPoints, ExpectedGoals: item.ExpectedGoals,
		BrandAliases: item.BrandAliases, SourceVersion: item.SourceVersion,
		Products:    make([]*v1.SalesDiagnosisProfileProduct, 0, len(item.Products)),
		Competitors: make([]*v1.SalesDiagnosisProfileCompetitor, 0, len(item.Competitors)),
		Claims:      make([]*v1.SalesDiagnosisProfileClaim, 0, len(item.Claims)),
	}
	for _, product := range item.Products {
		out.Products = append(out.Products, &v1.SalesDiagnosisProfileProduct{
			Name: product.Name, Description: product.Description, SellingPoints: product.SellingPoints, TargetAudience: product.TargetAudience,
		})
	}
	for _, competitor := range item.Competitors {
		out.Competitors = append(out.Competitors, &v1.SalesDiagnosisProfileCompetitor{
			Name: competitor.Name, Website: competitor.Website, Description: competitor.Description,
		})
	}
	for _, claim := range item.Claims {
		out.Claims = append(out.Claims, &v1.SalesDiagnosisProfileClaim{
			Id: claim.ID, ClaimType: claim.ClaimType, SourceField: claim.SourceField,
			SourceItemId: claim.SourceItemID, ClaimText: claim.ClaimText, SortOrder: claim.SortOrder,
		})
	}
	return out
}

func salesDiagnosisTaskDTO(item *biz.SalesDiagnosisTask) *v1.SalesDiagnosisTask {
	out := &v1.SalesDiagnosisTask{
		Id: item.ID, QuestionId: item.QuestionID, DiagnosisModelId: item.DiagnosisModelID,
		Status: v1.SalesDiagnosisTaskStatus(item.Status), AttemptCount: item.AttemptCount,
		LastErrorCode: item.LastErrorCode, LastErrorMessage: item.LastErrorMessage,
		StartedAt: timestampProto(item.StartedAt), CompletedAt: timestampProto(item.CompletedAt),
		Results: make([]*v1.SalesDiagnosisResult, 0, len(item.Results)),
	}
	for _, result := range item.Results {
		out.Results = append(out.Results, salesDiagnosisResultDTO(result))
	}
	return out
}

func salesDiagnosisResultDTO(item *biz.SalesDiagnosisResult) *v1.SalesDiagnosisResult {
	out := &v1.SalesDiagnosisResult{
		Id: item.ID, AttemptNo: item.AttemptNo, Succeeded: item.Succeeded, Answer: item.Answer,
		RawResponseJson: item.RawResponseJSON, ProviderRequestId: item.ProviderRequestID, ResponseModel: item.ResponseModel,
		PromptSnapshot: item.PromptSnapshot, EvidenceType: v1.SalesDiagnosisEvidenceType(item.EvidenceType),
		InputTokens: item.InputTokens, OutputTokens: item.OutputTokens, CostMicros: item.CostMicros,
		DurationMs: item.DurationMS, BrandMentioned: item.BrandMentioned, BrandPosition: item.BrandPosition,
		ErrorCode: item.ErrorCode, ErrorMessage: item.ErrorMessage, CreatedAt: timestamppb.New(item.CreatedAt),
		Citations:          make([]*v1.SalesDiagnosisCitation, 0, len(item.Citations)),
		CompetitorMentions: make([]*v1.SalesDiagnosisCompetitorMention, 0, len(item.CompetitorMentions)),
	}
	if item.Analysis != nil {
		out.Analysis = &v1.SalesDiagnosisResultAnalysis{
			Id: item.Analysis.ID, AnalysisVersion: item.Analysis.AnalysisVersion, RuleVersion: item.Analysis.RuleVersion,
			AnalyzerKind: item.Analysis.AnalyzerKind, AnalyzerModelName: item.Analysis.AnalyzerModelName,
			PromptSnapshot: item.Analysis.PromptSnapshot, RawResponseJson: item.Analysis.RawResponseJSON,
			Status: item.Analysis.Status, DominantSentiment: item.Analysis.DominantSentiment,
			Confidence: item.Analysis.Confidence, Included: item.Analysis.Included,
			CompletenessScore: item.Analysis.CompletenessScore, AnswerQualityScore: item.Analysis.AnswerQualityScore,
			FreshnessScore: item.Analysis.FreshnessScore, FreshnessAvailable: item.Analysis.FreshnessAvailable,
			RecommendationPosition: item.Analysis.RecommendationPosition,
			AnswerSummary:          item.Analysis.AnswerSummary, Strengths: item.Analysis.Strengths,
			Gaps: item.Analysis.Gaps, ErrorMessage: item.Analysis.ErrorMessage,
			EntityMentions: make([]*v1.SalesDiagnosisEntityMention, 0, len(item.Analysis.EntityMentions)),
			ClaimMatches:   make([]*v1.SalesDiagnosisClaimMatch, 0, len(item.Analysis.ClaimMatches)),
		}
		for _, entity := range item.Analysis.EntityMentions {
			out.Analysis.EntityMentions = append(out.Analysis.EntityMentions, &v1.SalesDiagnosisEntityMention{
				Id: entity.ID, EntityType: entity.EntityType, EntityRefId: entity.EntityRefID,
				EntityName: entity.EntityName, MentionCount: entity.MentionCount, FirstPosition: entity.FirstPosition,
				RankPosition: entity.RankPosition, Sentiment: entity.Sentiment,
				Confidence: entity.Confidence, EvidenceExcerpt: entity.EvidenceExcerpt,
			})
		}
		for _, match := range item.Analysis.ClaimMatches {
			out.Analysis.ClaimMatches = append(out.Analysis.ClaimMatches, &v1.SalesDiagnosisClaimMatch{
				Id: match.ID, ClaimId: match.ClaimID, Matched: match.Matched,
				Confidence: match.Confidence, EvidenceExcerpt: match.EvidenceExcerpt,
			})
		}
	}
	for _, citation := range item.Citations {
		out.Citations = append(out.Citations, &v1.SalesDiagnosisCitation{
			Id: citation.ID, ProviderSourceId: citation.ProviderSourceID, SourceName: citation.SourceName,
			Title: citation.Title, Url: citation.URL, Domain: citation.Domain, Snippet: citation.Snippet,
			Position: citation.Position, OwnershipType: citation.OwnershipType, SourceType: citation.SourceType,
			VerificationStatus: citation.VerificationStatus, CapturedAt: timestampProto(citation.CapturedAt), SortOrder: citation.SortOrder,
		})
	}
	for _, mention := range item.CompetitorMentions {
		out.CompetitorMentions = append(out.CompetitorMentions, &v1.SalesDiagnosisCompetitorMention{
			Id: mention.ID, CompetitorName: mention.CompetitorName, Position: mention.Position,
		})
	}
	return out
}
