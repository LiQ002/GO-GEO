package data

import (
	"context"
	"errors"
	"strconv"
	"time"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type customerAuthorizationRepo struct {
	data *Data
}

type customerAuthorizationRow struct {
	ID, EnterpriseID, ResourceID                               uint64
	EnterpriseCode, EnterpriseName, ResourceCode, ResourceName string
	AccountName, ExternalID, MaskedIdentity                    string
	ResourceType, AuthorizationStatus, UsageStatus             int32
	ExpiresAt, LastVerifiedAt, LastUsedAt                      *time.Time
	DailyLimit                                                 int64
	IsDefault                                                  bool
	Version                                                    uint64
	CreatedAt, UpdatedAt                                       time.Time
}

func NewCustomerAuthorizationRepo(data *Data) biz.CustomerAuthorizationRepo {
	return &customerAuthorizationRepo{data: data}
}

func (r *customerAuthorizationRepo) Get(ctx context.Context, id uint64) (*biz.CustomerAuthorization, error) {
	var row customerAuthorizationRow
	if err := r.authorizationQuery(ctx).Where("account.id = ?", id).Scan(&row).Error; err != nil {
		return nil, mapCustomerAuthorizationError(err)
	}
	if row.ID == 0 {
		return nil, biz.ErrCustomerAuthorizationNotFound
	}
	return customerAuthorizationDO(&row), nil
}

func (r *customerAuthorizationRepo) List(ctx context.Context, opts biz.CustomerAuthorizationListOptions) ([]*biz.CustomerAuthorization, int64, error) {
	db := r.authorizationQuery(ctx)
	if opts.EnterpriseID != 0 {
		db = db.Where("account.enterprise_id = ?", opts.EnterpriseID)
	}
	if opts.ResourceType != "" {
		code, ok := customerAuthorizationResourceCode(opts.ResourceType)
		if !ok {
			return []*biz.CustomerAuthorization{}, 0, nil
		}
		db = db.Where("account.resource_type = ?", code)
	}
	if opts.ResourceID != 0 {
		db = db.Where("account.resource_id = ?", opts.ResourceID)
	}
	if opts.AuthorizationStatus != "" {
		code, ok := customerAuthorizationStatusCode(opts.AuthorizationStatus)
		if !ok {
			return []*biz.CustomerAuthorization{}, 0, nil
		}
		db = db.Where("account.authorization_status = ?", code)
	}
	if opts.UsageStatus != "" {
		code, ok := customerAuthorizationUsageCode(opts.UsageStatus)
		if !ok {
			return []*biz.CustomerAuthorization{}, 0, nil
		}
		db = db.Where("account.usage_status = ?", code)
	}
	if opts.Keyword != "" {
		keyword := "%" + opts.Keyword + "%"
		db = db.Where("enterprise.name LIKE ? OR enterprise.code LIKE ? OR channel.name LIKE ? OR channel.code LIKE ? OR site.name LIKE ? OR site.code LIKE ? OR account.account_name LIKE ? OR account.masked_identity LIKE ?", keyword, keyword, keyword, keyword, keyword, keyword, keyword, keyword)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, mapCustomerAuthorizationError(err)
	}
	var rows []customerAuthorizationRow
	if err := db.Order("account.id DESC").Offset(opts.Offset).Limit(opts.Limit).Scan(&rows).Error; err != nil {
		return nil, 0, mapCustomerAuthorizationError(err)
	}
	items := make([]*biz.CustomerAuthorization, 0, len(rows))
	for i := range rows {
		items = append(items, customerAuthorizationDO(&rows[i]))
	}
	return items, total, nil
}

func (r *customerAuthorizationRepo) ChangeStatus(ctx context.Context, action biz.CustomerAuthorizationAction) (*biz.CustomerAuthorization, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		account, record, err := lockCustomerAuthorization(tx, action.ID, action.Version, action.ResourceType)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return biz.ErrCustomerAuthorizationConflict
			}
			return err
		}
		if err := ensureCustomerAuthorizationResource(tx, account.ResourceType, account.ResourceID); err != nil {
			return err
		}
		authorizationStatus, usageStatus, ok := nextCustomerAuthorizationState(account.AuthorizationStatus, account.UsageStatus, action.Action)
		if !ok {
			return biz.ErrCustomerAuthorizationConflict
		}
		updates := map[string]any{
			"authorization_status": mustCustomerAuthorizationStatusCode(authorizationStatus),
			"usage_status":         mustCustomerAuthorizationUsageCode(usageStatus),
			"version":              gorm.Expr("version + 1"),
		}
		if err := tx.Model(record).Updates(updates).Error; err != nil {
			return err
		}
		if action.Action == "revoke" {
			now := time.Now().UTC()
			if err := tx.Model(&model.CredentialEnvelope{}).
				Where("enterprise_id = ? AND platform_account_id = ? AND destroyed_at IS NULL", account.EnterpriseID, account.ID).
				Updates(map[string]any{"credential_payload": "", "ciphertext": []byte{}, "nonce": []byte{}, "status": "destroyed", "destroyed_at": now}).Error; err != nil {
				return err
			}
		}
		return writeAdminAudit(ctx, tx, action.OperatorID, "customer_authorization.status."+action.Action, account.ResourceType+"_authorization", strconv.FormatUint(account.ID, 10), "success", action.Reason, record, updates)
	})
	if err != nil {
		return nil, mapCustomerAuthorizationError(err)
	}
	return r.Get(ctx, action.ID)
}

func (r *customerAuthorizationRepo) authorizationQuery(ctx context.Context) *gorm.DB {
	accountUnion := r.data.DB(ctx).Raw(`
		SELECT id, enterprise_id, 1 AS resource_type,
			publish_channel_id AS resource_id, account_name, external_id,
			masked_identity, authorization_status, usage_status, expires_at,
			last_verified_at, last_used_at, daily_limit, is_default, version,
			created_at, updated_at
		FROM sec_self_media_authorizations
		WHERE deleted_at IS NULL
		UNION ALL
		SELECT id, enterprise_id, 2 AS resource_type,
			inclusion_site_id AS resource_id, account_name, external_id,
			masked_identity, authorization_status, usage_status, expires_at,
			last_verified_at, last_used_at, daily_limit, is_default, version,
			created_at, updated_at
		FROM sec_inclusion_site_authorizations
		WHERE deleted_at IS NULL`)
	return r.data.DB(ctx).
		Table("(?) AS account", accountUnion).
		Select(`account.id, account.enterprise_id, account.resource_type, account.resource_id,
			enterprise.code AS enterprise_code, enterprise.name AS enterprise_name,
			COALESCE(channel.code, site.code) AS resource_code,
			COALESCE(channel.name, site.name) AS resource_name,
			account.account_name, account.external_id, account.masked_identity,
			account.authorization_status, account.usage_status, account.expires_at,
			account.last_verified_at, account.last_used_at, account.daily_limit,
			account.is_default, account.version, account.created_at, account.updated_at`).
		Joins("JOIN "+model.TableEnterprises+" AS enterprise ON enterprise.id = account.enterprise_id AND enterprise.deleted_at IS NULL").
		Joins("LEFT JOIN "+model.TablePublishChannels+" AS channel ON account.resource_type = ? AND channel.id = account.resource_id AND channel.deleted_at IS NULL", model.AuthorizationResourcePublishChannel).
		Joins("LEFT JOIN "+model.TableInclusionSites+" AS site ON account.resource_type = ? AND site.id = account.resource_id AND site.deleted_at IS NULL", model.AuthorizationResourceInclusionSite).
		Where("(account.resource_type = ? AND channel.id IS NOT NULL) OR (account.resource_type = ? AND site.id IS NOT NULL)", model.AuthorizationResourcePublishChannel, model.AuthorizationResourceInclusionSite)
}

func lockCustomerAuthorization(tx *gorm.DB, id, version uint64, expectedResourceType string) (*biz.CustomerAuthorization, any, error) {
	var identity model.AuthorizationAccountID
	if err := tx.Select("id", "resource_type").First(&identity, id).Error; err != nil {
		return nil, nil, err
	}
	if expectedResourceType != "" {
		expectedCode, ok := customerAuthorizationResourceCode(expectedResourceType)
		if !ok || identity.ResourceType != expectedCode {
			return nil, nil, gorm.ErrRecordNotFound
		}
	}
	query := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND version = ?", id, version)
	switch identity.ResourceType {
	case model.AuthorizationResourcePublishChannel:
		var record model.SelfMediaAuthorization
		if err := query.First(&record).Error; err != nil {
			return nil, nil, err
		}
		return &biz.CustomerAuthorization{
			ID: record.ID, EnterpriseID: record.EnterpriseID, ResourceType: "publish_channel",
			ResourceID: record.PublishChannelID, AuthorizationStatus: customerAuthorizationStatusName(record.AuthorizationStatus),
			UsageStatus: customerAuthorizationUsageName(record.UsageStatus),
		}, &record, nil
	case model.AuthorizationResourceInclusionSite:
		var record model.InclusionSiteAuthorization
		if err := query.First(&record).Error; err != nil {
			return nil, nil, err
		}
		return &biz.CustomerAuthorization{
			ID: record.ID, EnterpriseID: record.EnterpriseID, ResourceType: "inclusion_site",
			ResourceID: record.InclusionSiteID, AuthorizationStatus: customerAuthorizationStatusName(record.AuthorizationStatus),
			UsageStatus: customerAuthorizationUsageName(record.UsageStatus),
		}, &record, nil
	default:
		return nil, nil, biz.ErrCustomerAuthorizationNotFound
	}
}

func ensureCustomerAuthorizationResource(tx *gorm.DB, resourceType string, resourceID uint64) error {
	var err error
	switch resourceType {
	case "publish_channel":
		err = tx.Select("id").First(&model.PublishChannel{}, resourceID).Error
	case "inclusion_site":
		err = tx.Select("id").First(&model.InclusionSite{}, resourceID).Error
	default:
		return biz.ErrCustomerAuthorizationNotFound
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrCustomerAuthorizationNotFound
	}
	return err
}

func nextCustomerAuthorizationState(authorizationStatus, usageStatus, action string) (string, string, bool) {
	switch action {
	case "pause":
		if authorizationStatus == "active" && usageStatus == "enabled" {
			return authorizationStatus, "paused", true
		}
	case "resume":
		if authorizationStatus == "active" && usageStatus == "paused" {
			return authorizationStatus, "enabled", true
		}
	case "revoke":
		if authorizationStatus != "revoked" {
			return "revoked", "disabled", true
		}
	}
	return authorizationStatus, usageStatus, false
}

func customerAuthorizationResourceCode(value string) (int32, bool) {
	switch value {
	case "publish_channel":
		return model.AuthorizationResourcePublishChannel, true
	case "inclusion_site":
		return model.AuthorizationResourceInclusionSite, true
	default:
		return 0, false
	}
}

func customerAuthorizationResourceName(value int32) string {
	switch value {
	case model.AuthorizationResourcePublishChannel:
		return "publish_channel"
	case model.AuthorizationResourceInclusionSite:
		return "inclusion_site"
	default:
		return ""
	}
}

func customerAuthorizationStatusCode(value string) (int32, bool) {
	switch value {
	case "pending":
		return model.AuthorizationStatusPending, true
	case "authorizing":
		return model.AuthorizationStatusAuthorizing, true
	case "active":
		return model.AuthorizationStatusActive, true
	case "expired":
		return model.AuthorizationStatusExpired, true
	case "revoked":
		return model.AuthorizationStatusRevoked, true
	case "failed", "error":
		return model.AuthorizationStatusFailed, true
	default:
		return 0, false
	}
}

func customerAuthorizationStatusName(value int32) string {
	switch value {
	case model.AuthorizationStatusPending:
		return "pending"
	case model.AuthorizationStatusAuthorizing:
		return "authorizing"
	case model.AuthorizationStatusActive:
		return "active"
	case model.AuthorizationStatusExpired:
		return "expired"
	case model.AuthorizationStatusRevoked:
		return "revoked"
	case model.AuthorizationStatusFailed:
		return "failed"
	default:
		return ""
	}
}

func customerAuthorizationUsageCode(value string) (int32, bool) {
	switch value {
	case "enabled":
		return model.AuthorizationUsageEnabled, true
	case "paused":
		return model.AuthorizationUsagePaused, true
	case "disabled":
		return model.AuthorizationUsageDisabled, true
	default:
		return 0, false
	}
}

func customerAuthorizationUsageName(value int32) string {
	switch value {
	case model.AuthorizationUsageEnabled:
		return "enabled"
	case model.AuthorizationUsagePaused:
		return "paused"
	case model.AuthorizationUsageDisabled:
		return "disabled"
	default:
		return ""
	}
}

func mustCustomerAuthorizationStatusCode(value string) int32 {
	code, _ := customerAuthorizationStatusCode(value)
	return code
}

func mustCustomerAuthorizationUsageCode(value string) int32 {
	code, _ := customerAuthorizationUsageCode(value)
	return code
}

func customerAuthorizationDO(row *customerAuthorizationRow) *biz.CustomerAuthorization {
	return &biz.CustomerAuthorization{
		ID: row.ID, EnterpriseID: row.EnterpriseID, ResourceID: row.ResourceID,
		EnterpriseCode: row.EnterpriseCode, EnterpriseName: row.EnterpriseName,
		ResourceType: customerAuthorizationResourceName(row.ResourceType), ResourceCode: row.ResourceCode, ResourceName: row.ResourceName,
		AccountName: row.AccountName, ExternalID: row.ExternalID, MaskedIdentity: row.MaskedIdentity,
		AuthorizationStatus: customerAuthorizationStatusName(row.AuthorizationStatus), UsageStatus: customerAuthorizationUsageName(row.UsageStatus),
		ExpiresAt: row.ExpiresAt, LastVerifiedAt: row.LastVerifiedAt, LastUsedAt: row.LastUsedAt,
		DailyLimit: row.DailyLimit, IsDefault: row.IsDefault, Version: row.Version,
		CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
}

func mapCustomerAuthorizationError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrCustomerAuthorizationNotFound
	}
	return err
}
