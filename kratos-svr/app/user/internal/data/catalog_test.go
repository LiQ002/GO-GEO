package data

import (
	"context"
	"testing"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestCatalogListsActivePlatformConfigurationWithoutEnterpriseGrants(t *testing.T) {
	db := openCatalogTestDB(t)
	activeChannel := model.PublishChannel{Code: "c01", Name: "知乎", Category: model.PublishChannelCategorySelfMedia, Status: model.PublishChannelStatusActive, AuthorizationType: model.AuthorizationTypeClientLogin, ExecutionMode: model.ExecutionModeAutomatic, SortOrder: 2, Version: 1}
	disabledChannel := model.PublishChannel{Code: "c02", Name: "停用渠道", Category: model.PublishChannelCategorySelfMedia, Status: model.PublishChannelStatusDisabled, AuthorizationType: model.AuthorizationTypeClientLogin, ExecutionMode: model.ExecutionModeAutomatic, SortOrder: 1, Version: 1}
	activeSite := model.InclusionSite{Code: "m01", Name: "deepseek", EntryURL: "https://chat.deepseek.com", Status: model.PublishChannelStatusActive, AuthorizationType: model.AuthorizationTypeClientLogin, SortOrder: 1, Version: 1}
	maintenanceSite := model.InclusionSite{Code: "m02", Name: "维护站点", EntryURL: "https://example.com", Status: model.PublishChannelStatusMaintenance, AuthorizationType: model.AuthorizationTypeClientLogin, SortOrder: 2, Version: 1}
	channelsConfig := []model.PublishChannel{activeChannel, disabledChannel}
	if err := db.Create(&channelsConfig).Error; err != nil {
		t.Fatalf("create channel configuration: %v", err)
	}
	if err := db.Create(&[]model.InclusionSite{activeSite, maintenanceSite}).Error; err != nil {
		t.Fatalf("create site configuration: %v", err)
	}
	activeTarget := model.PublishTarget{PublishChannelID: channelsConfig[0].ID, Name: "投稿目标", TargetType: model.PublishChannelCategoryOfficialMedia, Status: model.PublishChannelStatusActive, Version: 1}
	if err := db.Create(&activeTarget).Error; err != nil {
		t.Fatalf("create publish target configuration: %v", err)
	}

	repo := &catalogRepo{data: &Data{db: db}}
	channels, err := repo.ListPublishChannels(context.Background(), 7)
	if err != nil {
		t.Fatalf("ListPublishChannels() error = %v", err)
	}
	if len(channels) != 1 || channels[0].Code != "c01" || !channels[0].AccountRequired {
		t.Fatalf("channels = %+v, want active c01 without enterprise grants", channels)
	}
	sites, err := repo.ListInclusionSites(context.Background(), 7)
	if err != nil {
		t.Fatalf("ListInclusionSites() error = %v", err)
	}
	if len(sites) != 1 || sites[0].Code != "m01" || !sites[0].AccountRequired {
		t.Fatalf("sites = %+v, want active m01 without enterprise grants", sites)
	}
	targets, err := repo.ListPublishTargets(context.Background(), 7, activeTarget.PublishChannelID)
	if err != nil {
		t.Fatalf("ListPublishTargets() error = %v", err)
	}
	if len(targets) != 1 || targets[0].ID != activeTarget.ID {
		t.Fatalf("targets = %+v, want active target without enterprise grants", targets)
	}
}

func TestAuthorizationTargetUsesActivePlatformConfiguration(t *testing.T) {
	db := openCatalogTestDB(t)
	channel := model.PublishChannel{Code: "c01", Name: "知乎", Category: model.PublishChannelCategorySelfMedia, Status: model.PublishChannelStatusActive, AuthorizationType: model.AuthorizationTypeClientLogin, ExecutionMode: model.ExecutionModeAutomatic, Version: 1}
	site := model.InclusionSite{Code: "m01", Name: "deepseek", EntryURL: "https://chat.deepseek.com", Status: model.PublishChannelStatusActive, AuthorizationType: model.AuthorizationTypeClientLogin, Version: 1}
	if err := db.Create(&channel).Error; err != nil {
		t.Fatalf("create channel: %v", err)
	}
	if err := db.Create(&site).Error; err != nil {
		t.Fatalf("create site: %v", err)
	}

	if err := validateAuthorizationTarget(db, 7, biz.AuthorizationResourcePublishChannel, channel.ID); err != nil {
		t.Errorf("validate publish channel without enterprise grant: %v", err)
	}
	if err := validateAuthorizationTarget(db, 7, biz.AuthorizationResourceInclusionSite, site.ID); err != nil {
		t.Errorf("validate inclusion site without enterprise grant: %v", err)
	}
}

func openCatalogTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite database: %v", err)
	}
	if err := db.AutoMigrate(&model.PublishChannel{}, &model.InclusionSite{}, &model.PublishTarget{}); err != nil {
		t.Fatalf("migrate platform configuration: %v", err)
	}
	return db
}
