package data

import (
	"context"
	"testing"
	"time"

	"kratos-svr/internal/data/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestSalesDiagnosisFinalizationReconcilesMissingReportIdempotently(t *testing.T) {
	t.Parallel()

	db := openSalesDiagnosisFinalizationTestDB(t)
	diagnosis := seedCompletedSalesDiagnosis(t, db)
	repo := &salesDiagnosisRepo{data: &Data{db: db}}
	ctx := context.Background()

	candidateID, err := repo.FindPendingFinalization(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if candidateID != diagnosis.ID {
		t.Fatalf("FindPendingFinalization() = %d, want %d", candidateID, diagnosis.ID)
	}
	if err := repo.Finalize(ctx, diagnosis.ID); err != nil {
		t.Fatal(err)
	}

	var finalized model.SalesDiagnosis
	if err := db.First(&finalized, diagnosis.ID).Error; err != nil {
		t.Fatal(err)
	}
	if finalized.Status != model.SalesDiagnosisStatusSucceeded || finalized.SucceededTaskCount != 1 || finalized.FailedTaskCount != 0 || finalized.CompletedAt == nil {
		t.Fatalf("finalized diagnosis = %#v", finalized)
	}
	var reportCount, currentReportCount int64
	if err := db.Model(&model.SalesDiagnosisReport{}).Where("diagnosis_id = ?", diagnosis.ID).Count(&reportCount).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&model.SalesDiagnosisReport{}).Where("diagnosis_id = ? AND is_current = TRUE", diagnosis.ID).Count(&currentReportCount).Error; err != nil {
		t.Fatal(err)
	}
	if reportCount != 1 || currentReportCount != 1 {
		t.Fatalf("reports after reconciliation = total:%d current:%d", reportCount, currentReportCount)
	}
	version := finalized.Version

	if err := repo.Finalize(ctx, diagnosis.ID); err != nil {
		t.Fatal(err)
	}
	if err := db.First(&finalized, diagnosis.ID).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&model.SalesDiagnosisReport{}).Where("diagnosis_id = ?", diagnosis.ID).Count(&reportCount).Error; err != nil {
		t.Fatal(err)
	}
	if finalized.Version != version || reportCount != 1 {
		t.Fatalf("idempotent finalization changed version/report count: version=%d reports=%d", finalized.Version, reportCount)
	}
	candidateID, err = repo.FindPendingFinalization(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if candidateID != 0 {
		t.Fatalf("FindPendingFinalization() after repair = %d, want 0", candidateID)
	}
}

func TestSalesDiagnosisFinalizationPreservesHistoricalMetricEvidenceAfterRetry(t *testing.T) {
	t.Parallel()

	db := openSalesDiagnosisFinalizationTestDB(t)
	diagnosis := seedCompletedSalesDiagnosis(t, db)
	repo := &salesDiagnosisRepo{data: &Data{db: db}}
	ctx := context.Background()

	if err := repo.Finalize(ctx, diagnosis.ID); err != nil {
		t.Fatal(err)
	}
	var firstReport model.SalesDiagnosisReport
	if err := db.Where("diagnosis_id = ? AND is_current = TRUE", diagnosis.ID).First(&firstReport).Error; err != nil {
		t.Fatal(err)
	}
	var firstEvidence model.SalesDiagnosisFindingEvidence
	if err := db.Table(model.TableSalesDiagnosisFindingEvidences+" evidence").
		Select("evidence.*").
		Joins("JOIN "+model.TableSalesDiagnosisReportFindings+" finding ON finding.id = evidence.finding_id").
		Where("finding.report_id = ? AND evidence.metric_id IS NOT NULL", firstReport.ID).
		First(&firstEvidence).Error; err != nil {
		t.Fatal(err)
	}
	if firstEvidence.MetricID == nil {
		t.Fatal("first report evidence has no metric")
	}

	if err := db.Model(&model.SalesDiagnosisReport{}).
		Where("id = ?", firstReport.ID).
		Update("is_current", false).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&model.SalesDiagnosis{}).
		Where("id = ?", diagnosis.ID).
		Updates(map[string]any{
			"status":       model.SalesDiagnosisStatusRunning,
			"completed_at": nil,
		}).Error; err != nil {
		t.Fatal(err)
	}

	if err := repo.Finalize(ctx, diagnosis.ID); err != nil {
		t.Fatal(err)
	}
	var historicalMetric model.SalesDiagnosisMetric
	if err := db.First(&historicalMetric, *firstEvidence.MetricID).Error; err != nil {
		t.Fatalf("load historical evidence metric: %v", err)
	}
	if historicalMetric.Generation != 1 || historicalMetric.IsCurrent {
		t.Fatalf("historical metric generation/current = %d/%v; want 1/false", historicalMetric.Generation, historicalMetric.IsCurrent)
	}

	var reports, currentReports, metricGenerations int64
	if err := db.Model(&model.SalesDiagnosisReport{}).Where("diagnosis_id = ?", diagnosis.ID).Count(&reports).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&model.SalesDiagnosisReport{}).Where("diagnosis_id = ? AND is_current = TRUE", diagnosis.ID).Count(&currentReports).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&model.SalesDiagnosisMetric{}).
		Where("diagnosis_id = ?", diagnosis.ID).
		Distinct("generation").
		Count(&metricGenerations).Error; err != nil {
		t.Fatal(err)
	}
	if reports != 2 || currentReports != 1 || metricGenerations != 2 {
		t.Fatalf("retry reports/current/generations = %d/%d/%d; want 2/1/2", reports, currentReports, metricGenerations)
	}

	var currentEvidenceMetric model.SalesDiagnosisMetric
	if err := db.Table(model.TableSalesDiagnosisMetrics+" metric").
		Select("metric.*").
		Joins("JOIN "+model.TableSalesDiagnosisFindingEvidences+" evidence ON evidence.metric_id = metric.id").
		Joins("JOIN "+model.TableSalesDiagnosisReportFindings+" finding ON finding.id = evidence.finding_id").
		Joins("JOIN "+model.TableSalesDiagnosisReports+" report ON report.id = finding.report_id").
		Where("report.diagnosis_id = ? AND report.is_current = TRUE", diagnosis.ID).
		First(&currentEvidenceMetric).Error; err != nil {
		t.Fatal(err)
	}
	if currentEvidenceMetric.Generation != 2 || !currentEvidenceMetric.IsCurrent {
		t.Fatalf("current evidence metric generation/current = %d/%v; want 2/true", currentEvidenceMetric.Generation, currentEvidenceMetric.IsCurrent)
	}
}

func openSalesDiagnosisFinalizationTestDB(t *testing.T) *gorm.DB {
	t.Helper()
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
	return db
}

func seedCompletedSalesDiagnosis(t *testing.T, db *gorm.DB) model.SalesDiagnosis {
	t.Helper()
	diagnosis := model.SalesDiagnosis{
		Code: "DX-FINALIZE", Name: "补偿测试", SubjectType: model.SalesDiagnosisSubjectOpportunity,
		CreatedByAdminID: 1, Status: model.SalesDiagnosisStatusRunning,
		QuestionCount: 1, ModelCount: 1, TaskCount: 1, Version: 1,
	}
	if err := db.Create(&diagnosis).Error; err != nil {
		t.Fatal(err)
	}
	profile := model.SalesDiagnosisProfile{DiagnosisID: diagnosis.ID, CustomerName: "星河", BrandName: "星河"}
	if err := db.Create(&profile).Error; err != nil {
		t.Fatal(err)
	}
	diagnosisModel := model.SalesDiagnosisModel{
		DiagnosisID: diagnosis.ID, WritingModelID: 1, DisplayName: "模型甲",
		BaseURL: "https://example.com", ModelID: "model-a", ModelVersion: 1,
	}
	if err := db.Create(&diagnosisModel).Error; err != nil {
		t.Fatal(err)
	}
	question := model.SalesDiagnosisQuestion{DiagnosisID: diagnosis.ID, Question: "推荐哪个品牌？"}
	if err := db.Create(&question).Error; err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	task := model.SalesDiagnosisTask{
		DiagnosisID: diagnosis.ID, QuestionID: question.ID, DiagnosisModelID: diagnosisModel.ID,
		Status: model.SalesDiagnosisTaskStatusSucceeded, AttemptCount: 1,
		AvailableAt: now, StartedAt: &now, CompletedAt: &now,
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatal(err)
	}
	result := model.SalesDiagnosisResult{
		TaskID: task.ID, AttemptNo: 1, Succeeded: true, Answer: "推荐星河。",
		EvidenceType: model.SalesDiagnosisEvidenceModelKnowledge, BrandMentioned: true,
	}
	if err := db.Create(&result).Error; err != nil {
		t.Fatal(err)
	}
	return diagnosis
}
