package data

import (
	"context"
	"errors"
	"gorm.io/gorm"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/data/model"
	"time"
)

type authRepo struct{ data *Data }

func NewAuthRepo(data *Data) biz.AuthRepo { return &authRepo{data: data} }
func (r *authRepo) FindByUsername(ctx context.Context, u string) (*biz.EnterpriseProfile, error) {
	var a model.EnterpriseAccount
	if e := r.data.DB(ctx).Where("username = ?", u).First(&a).Error; e != nil {
		return nil, mapAuthError(e)
	}
	return r.profile(ctx, &a)
}
func (r *authRepo) FindByAccountID(ctx context.Context, id uint64) (*biz.EnterpriseProfile, error) {
	var a model.EnterpriseAccount
	if e := r.data.DB(ctx).First(&a, id).Error; e != nil {
		return nil, mapAuthError(e)
	}
	return r.profile(ctx, &a)
}
func (r *authRepo) profile(ctx context.Context, a *model.EnterpriseAccount) (*biz.EnterpriseProfile, error) {
	var e model.Enterprise
	if err := r.data.DB(ctx).First(&e, a.EnterpriseID).Error; err != nil {
		return nil, mapAuthError(err)
	}
	p := &biz.EnterpriseProfile{EnterpriseID: e.ID, AccountID: a.ID, Code: e.Code, Name: e.Name, Status: e.Status, Industry: e.Industry, Region: e.Region, Timezone: e.Timezone, Locale: e.Locale, ContactName: e.ContactName, ContactEmail: e.ContactEmail, ContactPhone: e.ContactPhone, NotificationJSON: string(e.NotificationJSON), Version: e.Version, Username: a.Username, PasswordHash: a.PasswordHash, AccountStatus: a.Status, FailedLoginCount: a.FailedLoginCount, LockedUntil: a.LockedUntil}
	var s model.Subscription
	if err := r.data.DB(ctx).Where("enterprise_id = ? AND status = ?", e.ID, "active").Order("expires_at DESC").First(&s).Error; err == nil {
		p.SubscriptionExpiresAt = &s.ExpiresAt
		var plan model.Plan
		if r.data.DB(ctx).First(&plan, s.PlanID).Error == nil {
			p.PlanName = plan.Name
		}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	// 订阅状态：根据过期时间判定 active / expired。
	if p.SubscriptionExpiresAt != nil && p.SubscriptionExpiresAt.After(time.Now()) {
		p.SubscriptionStatus = "active"
	} else {
		p.SubscriptionStatus = "expired"
	}
	// 点数余额：无记录视为零余额。
	var pb model.PointsBalance
	if err := r.data.DB(ctx).Where("enterprise_id = ?", e.ID).First(&pb).Error; err == nil {
		p.PointsBalance = pb.Balance
		p.PointsFrozen = pb.Frozen
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	var qs []model.QuotaLimit
	if err := r.data.DB(ctx).Where("enterprise_id = ?", e.ID).Find(&qs).Error; err != nil {
		return nil, err
	}
	p.Quotas = make([]*biz.Quota, 0, len(qs))
	for _, q := range qs {
		p.Quotas = append(p.Quotas, &biz.Quota{Metric: q.Metric, LimitValue: q.LimitValue, UsedValue: q.UsedValue, ReservedValue: q.ReservedValue, Period: q.Period, ResetAt: q.ResetAt})
	}
	return p, nil
}
func (r *authRepo) RecordLoginFailure(ctx context.Context, id uint64, c uint32, locked time.Time) error {
	u := map[string]any{"failed_login_count": c}
	if locked.IsZero() {
		u["locked_until"] = nil
	} else {
		u["locked_until"] = locked
	}
	return r.data.DB(ctx).Model(&model.EnterpriseAccount{}).Where("id = ?", id).Updates(u).Error
}
func (r *authRepo) RecordLoginSuccess(ctx context.Context, id uint64, at time.Time) error {
	return r.data.DB(ctx).Model(&model.EnterpriseAccount{}).Where("id = ?", id).Updates(map[string]any{"failed_login_count": 0, "locked_until": nil, "last_login_at": at}).Error
}
func (r *authRepo) CreateSession(ctx context.Context, subjectID, enterpriseID uint64, m biz.SessionMetadata, expiry time.Time) (*biz.LoginSession, error) {
	token, e := authn.RandomToken(32)
	if e != nil {
		return nil, e
	}
	po := &model.LoginSession{EnterpriseID: &enterpriseID, SubjectType: "enterprise", SubjectID: subjectID, Audience: "geo-user", RefreshTokenHash: authn.TokenHash(token), DeviceID: m.DeviceID, IPAddress: m.IPAddress, UserAgent: m.UserAgent, ExpiresAt: expiry, LastSeenAt: time.Now().UTC()}
	if e = r.data.DB(ctx).Create(po).Error; e != nil {
		return nil, e
	}
	return loginSessionDO(po), nil
}
func (r *authRepo) RotateSession(ctx context.Context, id uint64, hash string, expiry time.Time) error {
	res := r.data.DB(ctx).Model(&model.LoginSession{}).Where("id = ? AND subject_type = ? AND revoked_at IS NULL", id, "enterprise").Updates(map[string]any{"refresh_token_hash": hash, "expires_at": expiry, "last_seen_at": time.Now().UTC()})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected != 1 {
		return biz.ErrSessionInvalid
	}
	return nil
}
func (r *authRepo) FindSession(ctx context.Context, id uint64, hash string) (*biz.LoginSession, error) {
	var po model.LoginSession
	if e := r.data.DB(ctx).Where("id = ? AND subject_type = ? AND refresh_token_hash = ? AND revoked_at IS NULL AND expires_at > ?", id, "enterprise", hash, time.Now().UTC()).First(&po).Error; e != nil {
		return nil, biz.ErrSessionInvalid
	}
	return loginSessionDO(&po), nil
}
func (r *authRepo) ListSessions(ctx context.Context, enterpriseID, subjectID uint64) ([]*biz.LoginSession, error) {
	var rows []model.LoginSession
	if e := r.data.DB(ctx).Where("enterprise_id = ? AND subject_id = ? AND subject_type = ? AND revoked_at IS NULL", enterpriseID, subjectID, "enterprise").Order("last_seen_at DESC").Find(&rows).Error; e != nil {
		return nil, e
	}
	out := make([]*biz.LoginSession, 0, len(rows))
	for i := range rows {
		out = append(out, loginSessionDO(&rows[i]))
	}
	return out, nil
}
func (r *authRepo) RevokeSession(ctx context.Context, enterpriseID, subjectID, sessionID uint64, reason string) error {
	return r.data.DB(ctx).Model(&model.LoginSession{}).Where("id = ? AND enterprise_id = ? AND subject_id = ? AND subject_type = ? AND revoked_at IS NULL", sessionID, enterpriseID, subjectID, "enterprise").Updates(map[string]any{"revoked_at": time.Now().UTC(), "revoke_reason": reason}).Error
}
func (r *authRepo) RevokeAllSessions(ctx context.Context, subjectID uint64, reason string) error {
	return r.data.DB(ctx).Model(&model.LoginSession{}).Where("subject_id = ? AND subject_type = ? AND revoked_at IS NULL", subjectID, "enterprise").Updates(map[string]any{"revoked_at": time.Now().UTC(), "revoke_reason": reason}).Error
}
func (r *authRepo) UpdatePassword(ctx context.Context, id uint64, hash string, at time.Time) error {
	return r.data.DB(ctx).Model(&model.EnterpriseAccount{}).Where("id = ?", id).Updates(map[string]any{"password_hash": hash, "must_change_password": false, "updated_at": at}).Error
}
func (r *authRepo) UpdateProfile(ctx context.Context, p *biz.EnterpriseProfile) (*biz.EnterpriseProfile, error) {
	u := map[string]any{"name": p.Name, "industry": p.Industry, "region": p.Region, "timezone": p.Timezone, "locale": p.Locale, "contact_name": p.ContactName, "contact_email": p.ContactEmail, "contact_phone": p.ContactPhone, "notification_json": []byte(p.NotificationJSON), "version": gorm.Expr("version + 1")}
	res := r.data.DB(ctx).Model(&model.Enterprise{}).Where("id = ? AND version = ?", p.EnterpriseID, p.Version).Updates(u)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected != 1 {
		return nil, biz.ErrProfileConflict
	}
	var a model.EnterpriseAccount
	if e := r.data.DB(ctx).Where("enterprise_id = ?", p.EnterpriseID).First(&a).Error; e != nil {
		return nil, e
	}
	return r.profile(ctx, &a)
}
func loginSessionDO(p *model.LoginSession) *biz.LoginSession {
	o := &biz.LoginSession{ID: p.ID, SubjectID: p.SubjectID, DeviceID: p.DeviceID, IPAddress: p.IPAddress, UserAgent: p.UserAgent, RefreshTokenHash: p.RefreshTokenHash, LastSeenAt: p.LastSeenAt, ExpiresAt: p.ExpiresAt, RevokedAt: p.RevokedAt}
	if p.EnterpriseID != nil {
		o.EnterpriseID = *p.EnterpriseID
	}
	return o
}
func mapAuthError(e error) error {
	if errors.Is(e, gorm.ErrRecordNotFound) {
		return biz.ErrCredentials
	}
	return e
}
