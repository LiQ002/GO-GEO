package data

import (
	"context"
	"strings"
	"testing"
	"time"

	"kratos-svr/internal/data/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestDiagnosisReportExcerptPreservesUnicode(t *testing.T) {
	t.Parallel()

	value := strings.Repeat("诊", diagnosisReportExcerptLimit+10)
	got := diagnosisReportExcerpt(value)
	if len([]rune(got)) != diagnosisReportExcerptLimit+2 || !strings.HasSuffix(got, "……") {
		t.Fatalf("diagnosisReportExcerpt() rune count = %d", len([]rune(got)))
	}
}

func TestReplaceSalesDiagnosisReportAggregatesMultipleModels(t *testing.T) {
	t.Parallel()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&model.SalesDiagnosis{}, &model.SalesDiagnosisProfile{}, &model.SalesDiagnosisModel{},
		&model.SalesDiagnosisPreparation{}, &model.SalesDiagnosisPreparationAttempt{},
		&model.SalesDiagnosisQuestion{}, &model.SalesDiagnosisTask{}, &model.SalesDiagnosisResult{},
		&model.SalesDiagnosisCitation{}, &model.SalesDiagnosisCompetitorMention{},
		&model.SalesDiagnosisResultAnalysis{}, &model.SalesDiagnosisEntityMention{},
		&model.SalesDiagnosisProfileClaim{}, &model.SalesDiagnosisClaimMatch{},
		&model.SalesDiagnosisMetric{}, &model.SalesDiagnosisMetricSample{},
		&model.SalesDiagnosisReport{}, &model.SalesDiagnosisReportModel{},
		&model.SalesDiagnosisReportQuestion{}, &model.SalesDiagnosisReportAnswer{},
		&model.SalesDiagnosisReportFinding{}, &model.SalesDiagnosisFindingEvidence{},
		&model.SalesDiagnosisReportEntity{}, &model.SalesDiagnosisReportEntityEvidence{},
		&model.SalesDiagnosisReportSource{}, &model.SalesDiagnosisReportSourceCitation{},
	); err != nil {
		t.Fatal(err)
	}
	diagnosis := model.SalesDiagnosis{
		Code: "DX-TEST", Name: "测试", SubjectType: model.SalesDiagnosisSubjectOpportunity,
		CreatedByAdminID: 1, Status: model.SalesDiagnosisStatusRunning,
		QuestionCount: 1, ModelCount: 2, TaskCount: 2, Version: 2,
	}
	if err := db.Create(&diagnosis).Error; err != nil {
		t.Fatal(err)
	}
	profile := model.SalesDiagnosisProfile{DiagnosisID: diagnosis.ID, CustomerName: "星河", BrandName: "星河", Region: "上海"}
	if err := db.Create(&profile).Error; err != nil {
		t.Fatal(err)
	}
	models := []model.SalesDiagnosisModel{
		{DiagnosisID: diagnosis.ID, WritingModelID: 1, DisplayName: "模型甲", BaseURL: "https://a.example", ModelID: "a", ModelVersion: 1},
		{DiagnosisID: diagnosis.ID, WritingModelID: 2, DisplayName: "模型乙", BaseURL: "https://b.example", ModelID: "b", ModelVersion: 1, SortOrder: 1},
	}
	if err := db.Create(&models).Error; err != nil {
		t.Fatal(err)
	}
	question := model.SalesDiagnosisQuestion{DiagnosisID: diagnosis.ID, Question: "推荐哪个品牌？"}
	if err := db.Create(&question).Error; err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	tasks := []model.SalesDiagnosisTask{
		{DiagnosisID: diagnosis.ID, QuestionID: question.ID, DiagnosisModelID: models[0].ID, Status: model.SalesDiagnosisTaskStatusSucceeded, AttemptCount: 1, AvailableAt: now},
		{DiagnosisID: diagnosis.ID, QuestionID: question.ID, DiagnosisModelID: models[1].ID, Status: model.SalesDiagnosisTaskStatusSucceeded, AttemptCount: 1, AvailableAt: now},
	}
	if err := db.Create(&tasks).Error; err != nil {
		t.Fatal(err)
	}
	results := []model.SalesDiagnosisResult{
		{TaskID: tasks[0].ID, AttemptNo: 1, Succeeded: true, Answer: "推荐星河。", EvidenceType: model.SalesDiagnosisEvidenceModelKnowledge, BrandMentioned: true},
		{TaskID: tasks[1].ID, AttemptNo: 1, Succeeded: true, Answer: "建议比较其他品牌。", EvidenceType: model.SalesDiagnosisEvidenceModelKnowledge},
	}
	if err := db.Create(&results).Error; err != nil {
		t.Fatal(err)
	}
	analyses := []model.SalesDiagnosisResultAnalysis{
		{ResultID: results[0].ID, AnalysisVersion: 1, Status: 1, Included: true, CompletenessScore: 0.8, AnswerQualityScore: 0.7, FreshnessScore: 0.6, FreshnessAvailable: true, RecommendationPosition: 2, Strengths: "品牌已被推荐", Gaps: "信源类型仍需扩充"},
		{ResultID: results[1].ID, AnalysisVersion: 1, Status: 1, Included: false, CompletenessScore: 0.3, AnswerQualityScore: 0.5, Gaps: "品牌未被提及"},
	}
	if err := db.Create(&analyses).Error; err != nil {
		t.Fatal(err)
	}
	entityMentions := []model.SalesDiagnosisEntityMention{
		{AnalysisID: analyses[0].ID, EntityType: 1, EntityName: "星河", MentionCount: 1, RankPosition: 2, Sentiment: model.SalesDiagnosisSentimentPositive, EvidenceExcerpt: "推荐星河"},
		{AnalysisID: analyses[0].ID, EntityType: 2, EntityName: "竞品甲", MentionCount: 1, RankPosition: 1, Sentiment: model.SalesDiagnosisSentimentNeutral, EvidenceExcerpt: "竞品甲排名靠前"},
	}
	if err := db.Create(&entityMentions).Error; err != nil {
		t.Fatal(err)
	}
	citation := model.SalesDiagnosisCitation{
		ResultID: results[0].ID, Title: "星河官方资料", URL: "https://xinghe.example/about",
		Domain: "xinghe.example", SourceName: "星河官网", OwnershipType: 2,
		VerificationStatus: 1, SourceType: model.SalesDiagnosisSourceOfficial,
	}
	if err := db.Create(&citation).Error; err != nil {
		t.Fatal(err)
	}
	metrics := []model.SalesDiagnosisMetric{
		{DiagnosisID: diagnosis.ID, MetricCode: "brand_mention_rate", Numerator: 1, Denominator: 2, Value: 0.5, SampleCount: 2},
		{DiagnosisID: diagnosis.ID, MetricCode: "citation_rate", Denominator: 2, SampleCount: 2},
		{DiagnosisID: diagnosis.ID, MetricCode: "brand_share_of_voice", Numerator: 1, Denominator: 1, Value: 1, SampleCount: 1},
	}
	for _, diagnosisModel := range models {
		modelID := diagnosisModel.ID
		metrics = append(metrics,
			model.SalesDiagnosisMetric{DiagnosisID: diagnosis.ID, ModelID: &modelID, MetricCode: "brand_mention_rate", Denominator: 1, SampleCount: 1},
			model.SalesDiagnosisMetric{DiagnosisID: diagnosis.ID, ModelID: &modelID, MetricCode: "citation_rate", Denominator: 1, SampleCount: 1},
			model.SalesDiagnosisMetric{DiagnosisID: diagnosis.ID, ModelID: &modelID, MetricCode: "brand_share_of_voice", Denominator: 1, SampleCount: 1},
		)
	}
	if err := db.Create(&metrics).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.WithContext(context.Background()).Transaction(func(tx *gorm.DB) error {
		return replaceSalesDiagnosisReport(tx, &diagnosis, model.SalesDiagnosisStatusSucceeded, 2, 0)
	}); err != nil {
		t.Fatal(err)
	}
	var report model.SalesDiagnosisReport
	if err := db.Where("diagnosis_id = ?", diagnosis.ID).First(&report).Error; err != nil {
		t.Fatal(err)
	}
	var modelCount, questionCount, answerCount int64
	db.Model(&model.SalesDiagnosisReportModel{}).Where("report_id = ?", report.ID).Count(&modelCount)
	db.Model(&model.SalesDiagnosisReportQuestion{}).Where("report_id = ?", report.ID).Count(&questionCount)
	db.Model(&model.SalesDiagnosisReportAnswer{}).Count(&answerCount)
	if modelCount != 2 || questionCount != 1 || answerCount != 2 {
		t.Fatalf("report children = models:%d questions:%d answers:%d", modelCount, questionCount, answerCount)
	}
	if report.TemplateCode != "sales_diagnosis_v4" || report.TemplateVersion != 4 {
		t.Fatalf("report template = %s v%d", report.TemplateCode, report.TemplateVersion)
	}
	if !strings.Contains(report.ExecutiveSummary, "2 个 AI 平台模型") {
		t.Fatalf("report summary = %q", report.ExecutiveSummary)
	}
	var platform model.SalesDiagnosisReportModel
	if err := db.Where("report_id = ? AND diagnosis_model_id = ?", report.ID, models[0].ID).First(&platform).Error; err != nil {
		t.Fatal(err)
	}
	if platform.InclusionRate != 1 || platform.CompletenessScore != 0.8 || !platform.RecommendationPositionAvailable || platform.AverageRecommendationPosition != 2 {
		t.Fatalf("platform V4 evidence = %#v", platform)
	}
	var reportEntity model.SalesDiagnosisReportEntity
	if err := db.Where("report_id = ? AND entity_name = ? AND diagnosis_model_id IS NULL", report.ID, "竞品甲").First(&reportEntity).Error; err != nil {
		t.Fatal(err)
	}
	if reportEntity.CompetitorLevel != 1 || len(loadReportEntityEvidenceIDs(t, db, reportEntity.ID)) != 1 {
		t.Fatalf("competitor traceability = %#v", reportEntity)
	}
	var reportSource model.SalesDiagnosisReportSource
	if err := db.Where("report_id = ? AND diagnosis_model_id IS NULL", report.ID).First(&reportSource).Error; err != nil {
		t.Fatal(err)
	}
	if reportSource.SourceType != model.SalesDiagnosisSourceOfficial {
		t.Fatalf("report source type = %d", reportSource.SourceType)
	}
	var sourceEvidenceCount int64
	db.Model(&model.SalesDiagnosisReportSourceCitation{}).Where("report_source_id = ? AND citation_id = ?", reportSource.ID, citation.ID).Count(&sourceEvidenceCount)
	if sourceEvidenceCount != 1 {
		t.Fatalf("source evidence count = %d", sourceEvidenceCount)
	}
	var optimizationCount int64
	db.Model(&model.SalesDiagnosisReportFinding{}).Where("report_id = ? AND section_code = ?", report.ID, "optimization").Count(&optimizationCount)
	if optimizationCount != 4 {
		t.Fatalf("optimization findings = %d, want 4", optimizationCount)
	}
	if err := db.WithContext(context.Background()).Transaction(func(tx *gorm.DB) error {
		return replaceSalesDiagnosisReport(tx, &diagnosis, model.SalesDiagnosisStatusSucceeded, 2, 0)
	}); err != nil {
		t.Fatal(err)
	}
	var reportCount, currentCount int64
	db.Model(&model.SalesDiagnosisReport{}).Where("diagnosis_id = ?", diagnosis.ID).Count(&reportCount)
	db.Model(&model.SalesDiagnosisReport{}).Where("diagnosis_id = ? AND is_current = ?", diagnosis.ID, true).Count(&currentCount)
	if reportCount != 2 || currentCount != 1 {
		t.Fatalf("versioned reports = total:%d current:%d", reportCount, currentCount)
	}
}

func loadReportEntityEvidenceIDs(t *testing.T, db *gorm.DB, reportEntityID uint64) []uint64 {
	t.Helper()
	var rows []model.SalesDiagnosisReportEntityEvidence
	if err := db.Where("report_entity_id = ?", reportEntityID).Find(&rows).Error; err != nil {
		t.Fatal(err)
	}
	ids := make([]uint64, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.EntityMentionID)
	}
	return ids
}

func TestBuildDiagnosisReportFindingsUsesDeterministicThresholds(t *testing.T) {
	t.Parallel()

	items := buildDiagnosisReportFindings(1, "星河", "云计算", 0.2, 0, 0.3, 0, 0.2, false, false, true, 2)
	if len(items) < 5 {
		t.Fatalf("buildDiagnosisReportFindings() count = %d", len(items))
	}
	if items[0].Type != model.SalesDiagnosisReportFindingIssue || items[0].Severity != model.SalesDiagnosisReportSeverityHigh {
		t.Fatalf("first finding = %#v", items[0])
	}
}
