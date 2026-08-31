package data

import (
	"testing"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestDiagnosisModelSnapshotsAutomaticallySelectsActiveDiagnosisModels(t *testing.T) {
	t.Parallel()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.WritingModel{}, &model.WritingModelPurpose{}); err != nil {
		t.Fatal(err)
	}
	models := []model.WritingModel{
		{Code: "active", DisplayName: "可用模型", Provider: model.WritingModelProviderQwen, Protocol: model.WritingModelProtocolOpenAICompatible, BaseURL: "https://example.com", ModelID: "active", Status: model.WritingModelStatusActive, SortOrder: 2, Version: 1},
		{Code: "disabled", DisplayName: "停用模型", Provider: model.WritingModelProviderDeepSeek, Protocol: model.WritingModelProtocolOpenAICompatible, BaseURL: "https://example.com", ModelID: "disabled", Status: model.WritingModelStatusDisabled, SortOrder: 1, Version: 1},
	}
	if err := db.Create(&models).Error; err != nil {
		t.Fatal(err)
	}
	purposes := []model.WritingModelPurpose{
		{WritingModelID: models[0].ID, Purpose: model.WritingModelPurposeSalesDiagnosis},
		{WritingModelID: models[1].ID, Purpose: model.WritingModelPurposeSalesDiagnosis},
	}
	if err := db.Create(&purposes).Error; err != nil {
		t.Fatal(err)
	}

	snapshots, err := diagnosisModelSnapshots(db, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshots) != 1 || snapshots[0].WritingModelID != models[0].ID {
		t.Fatalf("diagnosisModelSnapshots() = %#v, want only active diagnosis model", snapshots)
	}
}

func TestDiagnosisProfileSnapshotSupportsQuickBrand(t *testing.T) {
	t.Parallel()

	profile, aliases, products, competitors, err := diagnosisProfileSnapshot(nil, biz.CreateSalesDiagnosisCommand{
		SubjectType:  biz.SalesDiagnosisSubjectQuickBrand,
		CustomerName: "星河科技有限公司",
		BrandName:    "星河云",
	})
	if err != nil {
		t.Fatal(err)
	}
	if profile.CustomerName != "星河科技有限公司" || profile.BrandName != "星河云" || profile.SourceVersion != 1 {
		t.Fatalf("diagnosisProfileSnapshot() = %#v", profile)
	}
	if len(aliases) != 0 || len(products) != 0 || len(competitors) != 0 {
		t.Fatalf("quick profile children = %#v/%#v/%#v", aliases, products, competitors)
	}
}
