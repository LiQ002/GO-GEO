package data

import (
	"context"
	"errors"
	"testing"
	"time"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestNextPlatformAccountState(t *testing.T) {
	tests := []struct {
		name                    string
		authorization, usage    int32
		action                  string
		wantAuthorization, want int32
		ok                      bool
	}{
		{name: "pause active", authorization: biz.AuthorizationStatusActive, usage: biz.AuthorizationUsageEnabled, action: "pause", wantAuthorization: biz.AuthorizationStatusActive, want: biz.AuthorizationUsagePaused, ok: true},
		{name: "resume paused", authorization: biz.AuthorizationStatusActive, usage: biz.AuthorizationUsagePaused, action: "resume", wantAuthorization: biz.AuthorizationStatusActive, want: biz.AuthorizationUsageEnabled, ok: true},
		{name: "revoke active", authorization: biz.AuthorizationStatusActive, usage: biz.AuthorizationUsageEnabled, action: "revoke", wantAuthorization: biz.AuthorizationStatusRevoked, want: biz.AuthorizationUsageDisabled, ok: true},
		{name: "cannot resume revoked", authorization: biz.AuthorizationStatusRevoked, usage: biz.AuthorizationUsageDisabled, action: "resume", wantAuthorization: biz.AuthorizationStatusRevoked, want: biz.AuthorizationUsageDisabled, ok: false},
		{name: "cannot resume expired", authorization: biz.AuthorizationStatusExpired, usage: biz.AuthorizationUsageDisabled, action: "resume", wantAuthorization: biz.AuthorizationStatusExpired, want: biz.AuthorizationUsageDisabled, ok: false},
		{name: "cannot revoke twice", authorization: biz.AuthorizationStatusRevoked, usage: biz.AuthorizationUsageDisabled, action: "revoke", wantAuthorization: biz.AuthorizationStatusRevoked, want: biz.AuthorizationUsageDisabled, ok: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			authorization, usage, ok := nextPlatformAccountState(tt.authorization, tt.usage, tt.action)
			if authorization != tt.wantAuthorization || usage != tt.want || ok != tt.ok {
				t.Fatalf("nextPlatformAccountState() = (%d, %d, %v)", authorization, usage, ok)
			}
		})
	}
}

func TestClientCredentialEnvelopeMarksSharedAESCiphertext(t *testing.T) {
	t.Parallel()

	expiresAt := time.Date(2027, time.January, 2, 3, 4, 5, 0, time.UTC)
	envelope := clientCredentialEnvelope(7, 11, "aes:v2:c2hhcmVkLWNpcGhlcnRleHQ=", &expiresAt)

	if envelope.CredentialPayload != "aes:v2:c2hhcmVkLWNpcGhlcnRleHQ=" {
		t.Fatalf("credential payload = %q; want original shared ciphertext", envelope.CredentialPayload)
	}
	if envelope.Algorithm != "aes-256-gcm-shared-v2" || envelope.KeyID != "shared-client-v1" {
		t.Fatalf("shared credential metadata = (%q, %q)", envelope.Algorithm, envelope.KeyID)
	}
	if envelope.ExpiresAt == nil || !envelope.ExpiresAt.Equal(expiresAt) {
		t.Fatalf("credential expiration = %v; want %v", envelope.ExpiresAt, expiresAt)
	}
}

func TestGetCredentialReturnsLatestActiveServerCredential(t *testing.T) {
	t.Parallel()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&model.AuthorizationAccountID{},
		&model.SelfMediaAuthorization{},
		&model.InclusionSiteAuthorization{},
		&model.CredentialEnvelope{},
	); err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	if err := db.Create(&model.AuthorizationAccountID{
		ID: 11, ResourceType: biz.AuthorizationResourcePublishChannel, CreatedAt: now,
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.SelfMediaAuthorization{
		ID: 11, EnterpriseID: 7, PublishChannelID: 101, AccountName: "搜狐号",
		AuthorizationStatus: biz.AuthorizationStatusActive,
		UsageStatus:         biz.AuthorizationUsageEnabled,
		Version:             1,
	}).Error; err != nil {
		t.Fatal(err)
	}
	credentials := []model.CredentialEnvelope{
		clientCredentialEnvelope(7, 11, "aes:v2:first-account", nil),
		clientCredentialEnvelope(7, 11, "aes:v2:second-account", nil),
	}
	if err := db.Create(&credentials).Error; err != nil {
		t.Fatal(err)
	}

	repo := &platformAccountRepo{data: &Data{db: db}}
	payload, err := repo.GetCredential(context.Background(), 7, 11)
	if err != nil {
		t.Fatal(err)
	}
	if payload != "aes:v2:second-account" {
		t.Fatalf("GetCredential() = %q; want latest credential", payload)
	}
	if _, err := repo.GetCredential(context.Background(), 8, 11); !errors.Is(err, biz.ErrPlatformAccountNotFound) {
		t.Fatalf("cross-enterprise GetCredential() error = %v; want account not found", err)
	}
}

func TestAuthorizationModelsKeepResourceDomainsSeparate(t *testing.T) {
	t.Parallel()

	selfMedia := selfMediaAuthorizationDO(&model.SelfMediaAuthorization{
		ID: 11, EnterpriseID: 7, PublishChannelID: 101, AccountName: "媒体账号",
	})
	if selfMedia.ResourceType != biz.AuthorizationResourcePublishChannel || selfMedia.ResourceID != 101 {
		t.Fatalf("self-media resource = (%d, %d); want (%d, 101)", selfMedia.ResourceType, selfMedia.ResourceID, biz.AuthorizationResourcePublishChannel)
	}

	inclusion := inclusionSiteAuthorizationDO(&model.InclusionSiteAuthorization{
		ID: 12, EnterpriseID: 7, InclusionSiteID: 202, AccountName: "检测账号",
	})
	if inclusion.ResourceType != biz.AuthorizationResourceInclusionSite || inclusion.ResourceID != 202 {
		t.Fatalf("inclusion resource = (%d, %d); want (%d, 202)", inclusion.ResourceType, inclusion.ResourceID, biz.AuthorizationResourceInclusionSite)
	}
}
