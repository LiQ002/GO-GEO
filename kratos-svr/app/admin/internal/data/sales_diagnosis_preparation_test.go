package data

import (
	"context"
	"testing"
	"time"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestRecordPreparationCreatesQuestionByModelTasksIdempotently(t *testing.T) {
	t.Parallel()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&model.SalesDiagnosis{}, &model.SalesDiagnosisModel{},
		&model.SalesDiagnosisPreparation{}, &model.SalesDiagnosisPreparationAttempt{},
		&model.SalesDiagnosisBrandTerm{}, &model.SalesDiagnosisQuestion{}, &model.SalesDiagnosisTask{},
	); err != nil {
		t.Fatal(err)
	}
	diagnosis := model.SalesDiagnosis{
		Code: "DX-PREP", Name: "准备测试", SubjectType: model.SalesDiagnosisSubjectQuickBrand,
		CreatedByAdminID: 1, Status: model.SalesDiagnosisStatusRunning, ModelCount: 1, Version: 2,
	}
	if err := db.Create(&diagnosis).Error; err != nil {
		t.Fatal(err)
	}
	diagnosisModel := model.SalesDiagnosisModel{
		DiagnosisID: diagnosis.ID, WritingModelID: 1, DisplayName: "模型甲",
		BaseURL: "https://example.com", ModelID: "model-a", ModelVersion: 1,
	}
	if err := db.Create(&diagnosisModel).Error; err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	preparation := model.SalesDiagnosisPreparation{
		DiagnosisID: diagnosis.ID, DiagnosisModelID: &diagnosisModel.ID,
		Status: model.SalesDiagnosisPreparationStatusRunning, AttemptCount: 1,
		AvailableAt: now, LeaseToken: "lease-1", LeaseOwner: "worker-1", LeaseExpiresAt: timePointer(now.Add(time.Minute)),
	}
	if err := db.Create(&preparation).Error; err != nil {
		t.Fatal(err)
	}
	repo := &salesDiagnosisRepo{data: &Data{db: db}}
	result := &biz.SalesDiagnosisPreparationResult{
		PreparationID: preparation.ID, AttemptNo: 1, LeaseToken: "lease-1", Succeeded: true,
		Industry: "企业服务", BrandSummary: "星河云提供企业云服务。",
		BrandTerms: []*biz.SalesDiagnosisBrandTerm{{
			Term: "星河云", TermType: biz.SalesDiagnosisBrandTermTypeBrand,
		}},
		Questions: []*biz.SalesDiagnosisGeneratedQuestion{
			{Question: "星河云是否会被推荐？", Intent: "品类推荐"},
			{Question: "星河云与竞品相比如何？", Intent: "竞品对比"},
		},
	}
	if err := repo.RecordPreparation(context.Background(), result); err != nil {
		t.Fatal(err)
	}
	var gotDiagnosis model.SalesDiagnosis
	if err := db.First(&gotDiagnosis, diagnosis.ID).Error; err != nil {
		t.Fatal(err)
	}
	if gotDiagnosis.QuestionCount != 2 || gotDiagnosis.TaskCount != 2 || gotDiagnosis.Version != 3 {
		t.Fatalf("diagnosis after preparation = %#v", gotDiagnosis)
	}
	var taskCount, attemptCount int64
	if err := db.Model(&model.SalesDiagnosisTask{}).Count(&taskCount).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&model.SalesDiagnosisPreparationAttempt{}).Count(&attemptCount).Error; err != nil {
		t.Fatal(err)
	}
	if taskCount != 2 || attemptCount != 1 {
		t.Fatalf("created tasks=%d attempts=%d", taskCount, attemptCount)
	}
	if err := repo.RecordPreparation(context.Background(), result); err == nil {
		t.Fatal("second RecordPreparation() should reject an already completed lease")
	}
}
