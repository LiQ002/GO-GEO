package data

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type platformAccountRepo struct{ data *Data }

type platformAccountRow struct {
	ID, EnterpriseID, ResourceID                   uint64
	AccountName, ExternalID, MaskedIdentity        string
	ResourceType, AuthorizationStatus, UsageStatus int32
	ExpiresAt, LastVerifiedAt, LastUsedAt          *time.Time
	DailyLimit                                     int64
	IsDefault                                      bool
	MetadataJSON                                   []byte
	Version                                        uint64
}

func NewPlatformAccountRepo(d *Data) biz.PlatformAccountRepo {
	return &platformAccountRepo{data: d}
}

func (r *platformAccountRepo) List(ctx context.Context, enterpriseID uint64, filter biz.PlatformAccountFilter) ([]*biz.PlatformAccount, error) {
	accountUnion := r.data.DB(ctx).Raw(`
		SELECT a.id, a.enterprise_id, 1 AS resource_type,
			a.publish_channel_id AS resource_id, a.account_name, a.external_id,
			a.masked_identity, a.authorization_status, a.usage_status, a.expires_at,
			a.last_verified_at, a.last_used_at, a.daily_limit, a.is_default,
			a.metadata_json, a.version, a.created_at, a.updated_at
		FROM sec_self_media_authorizations a
		INNER JOIN cfg_publish_channels ch ON ch.id = a.publish_channel_id
			AND ch.status = ? AND ch.deleted_at IS NULL
		WHERE a.deleted_at IS NULL
		UNION ALL
		SELECT b.id, b.enterprise_id, 2 AS resource_type,
			b.inclusion_site_id AS resource_id, b.account_name, b.external_id,
			b.masked_identity, b.authorization_status, b.usage_status, b.expires_at,
			b.last_verified_at, b.last_used_at, b.daily_limit, b.is_default,
			b.metadata_json, b.version, b.created_at, b.updated_at
		FROM sec_inclusion_site_authorizations b
		INNER JOIN cfg_inclusion_sites s ON s.id = b.inclusion_site_id
			AND s.status = ? AND s.deleted_at IS NULL
		WHERE b.deleted_at IS NULL`, model.PublishChannelStatusActive, model.PublishChannelStatusActive)
	db := r.data.DB(ctx).Table("(?) AS account", accountUnion).
		Where("account.enterprise_id = ?", enterpriseID)
	if filter.ResourceType != 0 {
		db = db.Where("account.resource_type = ?", filter.ResourceType)
	}
	if filter.ResourceID != 0 {
		db = db.Where("account.resource_id = ?", filter.ResourceID)
	}
	if filter.Status != 0 {
		db = db.Where("account.authorization_status = ?", filter.Status)
	}
	var rows []platformAccountRow
	if err := db.Order("account.created_at DESC, account.id DESC").Scan(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]*biz.PlatformAccount, 0, len(rows))
	for i := range rows {
		items = append(items, platformAccountRowDO(&rows[i]))
	}
	return items, nil
}

func (r *platformAccountRepo) GetCredential(ctx context.Context, enterpriseID, accountID uint64) (string, error) {
	account, _, err := findPlatformAccount(r.data.DB(ctx), enterpriseID, accountID, 0, 0, 0, false)
	if err != nil {
		return "", mapPlatformAccountError(err)
	}
	if account.AuthorizationStatus != biz.AuthorizationStatusActive || account.UsageStatus != biz.AuthorizationUsageEnabled {
		return "", biz.ErrPlatformCredentialNotFound
	}

	var credential model.CredentialEnvelope
	err = r.data.DB(ctx).
		Where("enterprise_id = ? AND platform_account_id = ? AND status = ? AND destroyed_at IS NULL", enterpriseID, accountID, "active").
		Where("expires_at IS NULL OR expires_at > ?", time.Now().UTC()).
		Order("id DESC").
		First(&credential).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", biz.ErrPlatformCredentialNotFound
		}
		return "", err
	}
	if credential.CredentialPayload == "" {
		return "", biz.ErrPlatformCredentialNotFound
	}
	return credential.CredentialPayload, nil
}

func (r *platformAccountRepo) CreateSession(ctx context.Context, enterpriseID uint64, deviceID string, resourceType int32, resourceID, accountID uint64) (*biz.AuthorizationSession, error) {
	rawToken, err := authn.RandomToken(32)
	if err != nil {
		return nil, err
	}
	session := &model.AuthorizationSession{
		TenantModel:      model.TenantModel{EnterpriseID: enterpriseID},
		SessionTokenHash: authn.TokenHash(rawToken),
		DeviceID:         deviceID,
		ResourceType:     resourceType,
		ResourceID:       resourceID,
		Status:           biz.AuthorizationSessionPending,
		ExpiresAt:        time.Now().UTC().Add(10 * time.Minute),
		Version:          1,
	}
	if accountID != 0 {
		session.PlatformAccountID = &accountID
	}
	err = r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		if err := validateAuthorizationTarget(tx, enterpriseID, resourceType, resourceID); err != nil {
			return err
		}
		if accountID != 0 {
			if _, _, err := findPlatformAccount(tx, enterpriseID, accountID, resourceType, resourceID, 0, false); err != nil {
				return biz.ErrPlatformAccountInvalid
			}
		}
		return tx.Create(session).Error
	})
	if err != nil {
		return nil, err
	}
	result := authorizationSessionDO(session)
	result.SessionToken = rawToken
	return result, nil
}

func (r *platformAccountRepo) GetSession(ctx context.Context, enterpriseID, id uint64) (*biz.AuthorizationSession, error) {
	var session model.AuthorizationSession
	if err := r.data.DB(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&session).Error; err != nil {
		return nil, mapPlatformAccountError(err)
	}
	return authorizationSessionDO(&session), nil
}

func (r *platformAccountRepo) ChangeStatus(ctx context.Context, enterpriseID, id, version uint64, action string) (*biz.PlatformAccount, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		account, record, err := findPlatformAccount(tx, enterpriseID, id, 0, 0, version, true)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return biz.ErrPlatformAccountConflict
			}
			return err
		}
		authorizationStatus, usageStatus, ok := nextPlatformAccountState(account.AuthorizationStatus, account.UsageStatus, action)
		if !ok {
			return biz.ErrPlatformAccountConflict
		}
		if err := tx.Model(record).Updates(map[string]any{
			"authorization_status": authorizationStatus,
			"usage_status":         usageStatus,
			"version":              gorm.Expr("version + 1"),
		}).Error; err != nil {
			return err
		}
		if action == "revoke" {
			return destroyPlatformCredentials(tx, enterpriseID, id, time.Now().UTC())
		}
		return nil
	})
	if err != nil {
		return nil, mapPlatformAccountError(err)
	}
	return r.get(ctx, enterpriseID, id)
}

func (r *platformAccountRepo) Delete(ctx context.Context, enterpriseID, id, version uint64) error {
	return r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		_, record, err := findPlatformAccount(tx, enterpriseID, id, 0, 0, version, true)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return biz.ErrPlatformAccountConflict
			}
			return err
		}
		if result := tx.Delete(record); result.Error != nil {
			return result.Error
		} else if result.RowsAffected != 1 {
			return biz.ErrPlatformAccountConflict
		}
		return destroyPlatformCredentials(tx, enterpriseID, id, time.Now().UTC())
	})
}

func (r *platformAccountRepo) SubmitAuthorization(ctx context.Context, rawToken string, input *biz.PlatformAccount, credential string, clientVersion string) (*biz.PlatformAccount, error) {
	var savedAccount *biz.PlatformAccount
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var session model.AuthorizationSession
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("session_token_hash = ? AND status IN ? AND expires_at > ?", authn.TokenHash(rawToken), []int32{biz.AuthorizationSessionPending, biz.AuthorizationSessionAuthorizing}, time.Now().UTC()).
			First(&session).Error; err != nil {
			return biz.ErrAuthorizationSession
		}
		if err := validateAuthorizationTarget(tx, session.EnterpriseID, session.ResourceType, session.ResourceID); err != nil {
			return err
		}
		now := time.Now().UTC()
		updates := map[string]any{
			"account_name":         input.AccountName,
			"external_id":          input.ExternalID,
			"masked_identity":      input.MaskedIdentity,
			"authorization_status": biz.AuthorizationStatusActive,
			"usage_status":         biz.AuthorizationUsageEnabled,
			"expires_at":           input.ExpiresAt,
			"last_verified_at":     now,
			"metadata_json":        []byte(input.MetadataJSON),
			"version":              gorm.Expr("version + 1"),
		}
		if session.PlatformAccountID != nil {
			account, record, err := findPlatformAccount(tx, session.EnterpriseID, *session.PlatformAccountID, session.ResourceType, session.ResourceID, 0, true)
			if err != nil {
				return err
			}
			if err := tx.Model(record).Updates(updates).Error; err != nil {
				return err
			}
			account.AccountName = input.AccountName
			account.ExternalID = input.ExternalID
			account.MaskedIdentity = input.MaskedIdentity
			account.AuthorizationStatus = biz.AuthorizationStatusActive
			account.UsageStatus = biz.AuthorizationUsageEnabled
			account.ExpiresAt = input.ExpiresAt
			account.LastVerifiedAt = &now
			account.MetadataJSON = input.MetadataJSON
			savedAccount = account
		} else {
			identity := &model.AuthorizationAccountID{ResourceType: session.ResourceType}
			if err := tx.Create(identity).Error; err != nil {
				return err
			}
			account, err := createPlatformAccount(tx, identity.ID, &session, input, now)
			if err != nil {
				return err
			}
			savedAccount = account
		}
		if err := tx.Model(&model.CredentialEnvelope{}).
			Where("enterprise_id = ? AND platform_account_id = ? AND destroyed_at IS NULL", session.EnterpriseID, savedAccount.ID).
			Updates(destroyedCredentialUpdates(now)).Error; err != nil {
			return err
		}
		envelope := clientCredentialEnvelope(session.EnterpriseID, savedAccount.ID, credential, input.ExpiresAt)
		if err := tx.Create(&envelope).Error; err != nil {
			return err
		}
		return tx.Model(&session).Updates(map[string]any{
			"platform_account_id": savedAccount.ID,
			"status":              biz.AuthorizationSessionCompleted,
			"completed_at":        now,
			"client_version":      clientVersion,
			"version":             gorm.Expr("version + 1"),
		}).Error
	})
	if err != nil {
		return nil, mapPlatformAccountError(err)
	}
	return r.get(ctx, savedAccount.EnterpriseID, savedAccount.ID)
}

func createPlatformAccount(tx *gorm.DB, id uint64, session *model.AuthorizationSession, input *biz.PlatformAccount, now time.Time) (*biz.PlatformAccount, error) {
	account := &biz.PlatformAccount{
		ID: id, EnterpriseID: session.EnterpriseID, ResourceType: session.ResourceType, ResourceID: session.ResourceID,
		AccountName: input.AccountName, ExternalID: input.ExternalID, MaskedIdentity: input.MaskedIdentity,
		AuthorizationStatus: biz.AuthorizationStatusActive, UsageStatus: biz.AuthorizationUsageEnabled, ExpiresAt: input.ExpiresAt,
		LastVerifiedAt: &now, MetadataJSON: input.MetadataJSON, Version: 1,
	}
	switch session.ResourceType {
	case biz.AuthorizationResourcePublishChannel:
		record := &model.SelfMediaAuthorization{
			ID: id, EnterpriseID: session.EnterpriseID, PublishChannelID: session.ResourceID,
			AccountName: input.AccountName, ExternalID: input.ExternalID, MaskedIdentity: input.MaskedIdentity,
			AuthorizationStatus: biz.AuthorizationStatusActive, UsageStatus: biz.AuthorizationUsageEnabled, ExpiresAt: input.ExpiresAt,
			LastVerifiedAt: &now, MetadataJSON: []byte(input.MetadataJSON), Version: 1,
		}
		return account, tx.Create(record).Error
	case biz.AuthorizationResourceInclusionSite:
		record := &model.InclusionSiteAuthorization{
			ID: id, EnterpriseID: session.EnterpriseID, InclusionSiteID: session.ResourceID,
			AccountName: input.AccountName, ExternalID: input.ExternalID, MaskedIdentity: input.MaskedIdentity,
			AuthorizationStatus: biz.AuthorizationStatusActive, UsageStatus: biz.AuthorizationUsageEnabled, ExpiresAt: input.ExpiresAt,
			LastVerifiedAt: &now, MetadataJSON: []byte(input.MetadataJSON), Version: 1,
		}
		return account, tx.Create(record).Error
	default:
		return nil, biz.ErrPlatformAccountInvalid
	}
}

func findPlatformAccount(db *gorm.DB, enterpriseID, id uint64, resourceType int32, resourceID, version uint64, lock bool) (*biz.PlatformAccount, any, error) {
	if resourceType == 0 {
		var identity model.AuthorizationAccountID
		if err := db.Select("id", "resource_type").First(&identity, id).Error; err != nil {
			return nil, nil, err
		}
		resourceType = identity.ResourceType
	}
	query := db.Where("enterprise_id = ? AND id = ?", enterpriseID, id)
	if resourceID != 0 {
		resourceColumn := "publish_channel_id"
		if resourceType == biz.AuthorizationResourceInclusionSite {
			resourceColumn = "inclusion_site_id"
		}
		query = query.Where(resourceColumn+" = ?", resourceID)
	}
	if version != 0 {
		query = query.Where("version = ?", version)
	}
	if lock {
		query = query.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	switch resourceType {
	case biz.AuthorizationResourcePublishChannel:
		var record model.SelfMediaAuthorization
		if err := query.First(&record).Error; err != nil {
			return nil, nil, err
		}
		return selfMediaAuthorizationDO(&record), &record, nil
	case biz.AuthorizationResourceInclusionSite:
		var record model.InclusionSiteAuthorization
		if err := query.First(&record).Error; err != nil {
			return nil, nil, err
		}
		return inclusionSiteAuthorizationDO(&record), &record, nil
	default:
		return nil, nil, biz.ErrPlatformAccountInvalid
	}
}

func validateAuthorizationTarget(tx *gorm.DB, _ uint64, resourceType int32, resourceID uint64) error {
	var count int64
	var err error
	switch resourceType {
	case biz.AuthorizationResourcePublishChannel:
		err = tx.Table(model.TablePublishChannels+" AS resource").
			Where("resource.id = ? AND resource.status = ? AND resource.authorization_type = ? AND resource.deleted_at IS NULL", resourceID, model.PublishChannelStatusActive, model.AuthorizationTypeClientLogin).
			Count(&count).Error
	case biz.AuthorizationResourceInclusionSite:
		err = tx.Table(model.TableInclusionSites+" AS resource").
			Where("resource.id = ? AND resource.status = ? AND resource.deleted_at IS NULL", resourceID, model.PublishChannelStatusActive).
			Count(&count).Error
	default:
		return biz.ErrPlatformAccountInvalid
	}
	if err != nil {
		return err
	}
	if count != 1 {
		return biz.ErrPlatformAccountInvalid
	}
	return nil
}

func (r *platformAccountRepo) Heartbeat(ctx context.Context, rawToken, status, version string) (*biz.AuthorizationSession, error) {
	statusCode, ok := authorizationSessionStatusFromClient(status)
	if !ok {
		return nil, biz.ErrPlatformAccountInvalid
	}
	result := r.data.DB(ctx).Model(&model.AuthorizationSession{}).
		Where("session_token_hash = ? AND expires_at > ?", authn.TokenHash(rawToken), time.Now().UTC()).
		Updates(map[string]any{"status": statusCode, "client_version": version, "version": gorm.Expr("version + 1")})
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected != 1 {
		return nil, biz.ErrAuthorizationSession
	}
	var session model.AuthorizationSession
	if err := r.data.DB(ctx).Where("session_token_hash = ?", authn.TokenHash(rawToken)).First(&session).Error; err != nil {
		return nil, biz.ErrAuthorizationSession
	}
	return authorizationSessionDO(&session), nil
}

func (r *platformAccountRepo) GetClientConfig(ctx context.Context) (*biz.ClientConfig, error) {
	config := &biz.ClientConfig{MinimumVersion: "1.0.0", LatestVersion: "1.0.0"}
	var setting model.SystemSetting
	if err := r.data.DB(ctx).Where("namespace = ? AND key_name = ?", "client", "authorization").First(&setting).Error; err == nil {
		_ = json.Unmarshal(setting.ValueJSON, config)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	return config, nil
}

func (r *platformAccountRepo) get(ctx context.Context, enterpriseID, id uint64) (*biz.PlatformAccount, error) {
	account, _, err := findPlatformAccount(r.data.DB(ctx), enterpriseID, id, 0, 0, 0, false)
	if err != nil {
		return nil, mapPlatformAccountError(err)
	}
	return account, nil
}

func nextPlatformAccountState(authorizationStatus, usageStatus int32, action string) (int32, int32, bool) {
	switch action {
	case "pause":
		if authorizationStatus == biz.AuthorizationStatusActive && usageStatus == biz.AuthorizationUsageEnabled {
			return authorizationStatus, biz.AuthorizationUsagePaused, true
		}
	case "resume":
		if authorizationStatus == biz.AuthorizationStatusActive && usageStatus == biz.AuthorizationUsagePaused {
			return authorizationStatus, biz.AuthorizationUsageEnabled, true
		}
	case "revoke":
		if authorizationStatus != biz.AuthorizationStatusRevoked {
			return biz.AuthorizationStatusRevoked, biz.AuthorizationUsageDisabled, true
		}
	}
	return authorizationStatus, usageStatus, false
}

func authorizationSessionStatusFromClient(status string) (int32, bool) {
	switch status {
	case "pending":
		return biz.AuthorizationSessionPending, true
	case "authorizing":
		return biz.AuthorizationSessionAuthorizing, true
	case "completed":
		return biz.AuthorizationSessionCompleted, true
	case "expired":
		return biz.AuthorizationSessionExpired, true
	case "failed", "error":
		return biz.AuthorizationSessionFailed, true
	default:
		return 0, false
	}
}

func destroyPlatformCredentials(tx *gorm.DB, enterpriseID, accountID uint64, now time.Time) error {
	return tx.Model(&model.CredentialEnvelope{}).
		Where("enterprise_id = ? AND platform_account_id = ? AND destroyed_at IS NULL", enterpriseID, accountID).
		Updates(destroyedCredentialUpdates(now)).Error
}

func clientCredentialEnvelope(enterpriseID, accountID uint64, credential string, expiresAt *time.Time) model.CredentialEnvelope {
	return model.CredentialEnvelope{
		ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: enterpriseID},
		PlatformAccountID:    accountID,
		KeyID:                "shared-client-v1",
		Algorithm:            "aes-256-gcm-shared-v2",
		CredentialPayload:    credential,
		EnvelopeVersion:      1,
		Status:               "active",
		ExpiresAt:            expiresAt,
	}
}

func destroyedCredentialUpdates(now time.Time) map[string]any {
	return map[string]any{
		"credential_payload": "",
		"ciphertext":         []byte{},
		"nonce":              []byte{},
		"status":             "destroyed",
		"destroyed_at":       now,
	}
}

func platformAccountRowDO(row *platformAccountRow) *biz.PlatformAccount {
	return &biz.PlatformAccount{
		ID: row.ID, EnterpriseID: row.EnterpriseID, ResourceType: row.ResourceType, ResourceID: row.ResourceID,
		AccountName: row.AccountName, ExternalID: row.ExternalID, MaskedIdentity: row.MaskedIdentity,
		AuthorizationStatus: row.AuthorizationStatus, UsageStatus: row.UsageStatus,
		ExpiresAt: row.ExpiresAt, LastVerifiedAt: row.LastVerifiedAt, LastUsedAt: row.LastUsedAt,
		DailyLimit: row.DailyLimit, IsDefault: row.IsDefault, MetadataJSON: string(row.MetadataJSON), Version: row.Version,
	}
}

func selfMediaAuthorizationDO(record *model.SelfMediaAuthorization) *biz.PlatformAccount {
	return &biz.PlatformAccount{
		ID: record.ID, EnterpriseID: record.EnterpriseID, ResourceType: biz.AuthorizationResourcePublishChannel, ResourceID: record.PublishChannelID,
		AccountName: record.AccountName, ExternalID: record.ExternalID, MaskedIdentity: record.MaskedIdentity,
		AuthorizationStatus: record.AuthorizationStatus, UsageStatus: record.UsageStatus,
		ExpiresAt: record.ExpiresAt, LastVerifiedAt: record.LastVerifiedAt, LastUsedAt: record.LastUsedAt,
		DailyLimit: record.DailyLimit, IsDefault: record.IsDefault, MetadataJSON: string(record.MetadataJSON), Version: record.Version,
	}
}

func inclusionSiteAuthorizationDO(record *model.InclusionSiteAuthorization) *biz.PlatformAccount {
	return &biz.PlatformAccount{
		ID: record.ID, EnterpriseID: record.EnterpriseID, ResourceType: biz.AuthorizationResourceInclusionSite, ResourceID: record.InclusionSiteID,
		AccountName: record.AccountName, ExternalID: record.ExternalID, MaskedIdentity: record.MaskedIdentity,
		AuthorizationStatus: record.AuthorizationStatus, UsageStatus: record.UsageStatus,
		ExpiresAt: record.ExpiresAt, LastVerifiedAt: record.LastVerifiedAt, LastUsedAt: record.LastUsedAt,
		DailyLimit: record.DailyLimit, IsDefault: record.IsDefault, MetadataJSON: string(record.MetadataJSON), Version: record.Version,
	}
}

func authorizationSessionDO(session *model.AuthorizationSession) *biz.AuthorizationSession {
	result := &biz.AuthorizationSession{
		ID: session.ID, EnterpriseID: session.EnterpriseID, DeviceID: session.DeviceID,
		ResourceType: session.ResourceType, ResourceID: session.ResourceID, Status: session.Status,
		ExpiresAt: session.ExpiresAt, CompletedAt: session.CompletedAt,
	}
	if session.PlatformAccountID != nil {
		result.PlatformAccountID = *session.PlatformAccountID
	}
	return result
}

func mapPlatformAccountError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrPlatformAccountNotFound
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return biz.ErrPlatformAccountConflict
	}
	return err
}
