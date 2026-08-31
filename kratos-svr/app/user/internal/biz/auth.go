package biz

import (
	"context"
	"github.com/go-kratos/kratos/v3/errors"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/security"
	"strings"
	"time"
)

var (
	ErrCredentials        = errors.Unauthorized("CREDENTIALS_INVALID", "invalid username or password")
	ErrAccountLocked      = errors.Forbidden("ACCOUNT_LOCKED", "account is locked")
	ErrEnterpriseDisabled = errors.Forbidden("ENTERPRISE_DISABLED", "enterprise account is disabled")
	ErrSessionInvalid     = errors.Unauthorized("SESSION_INVALID", "session is invalid")
	ErrPasswordInvalid    = errors.BadRequest("PASSWORD_INVALID", "invalid password")
	ErrProfileConflict    = errors.Conflict("PROFILE_CONFLICT", "enterprise profile version conflict")
)

type EnterpriseProfile struct {
	EnterpriseID, AccountID                                                                                           uint64
	Code, Name, Status, Industry, Region, Timezone, Locale, ContactName, ContactEmail, ContactPhone, NotificationJSON string
	Version                                                                                                           uint64
	Username, PasswordHash, AccountStatus                                                                             string
	FailedLoginCount                                                                                                  uint32
	LockedUntil                                                                                                       *time.Time
	PlanName                                                                                                          string
	SubscriptionExpiresAt                                                                                             *time.Time
	SubscriptionStatus                                                                                                string
	PointsBalance, PointsFrozen                                                                                       int64
	Quotas                                                                                                            []*Quota
}
type Quota struct {
	Metric                               string
	LimitValue, UsedValue, ReservedValue int64
	Period                               string
	ResetAt                              *time.Time
}
type SessionMetadata struct{ DeviceID, IPAddress, UserAgent string }
type LoginSession struct {
	ID, SubjectID, EnterpriseID                      uint64
	DeviceID, IPAddress, UserAgent, RefreshTokenHash string
	LastSeenAt, ExpiresAt                            time.Time
	RevokedAt                                        *time.Time
}
type TokenPair struct {
	AccessToken, RefreshToken string
	AccessExpiresAt           time.Time
	Enterprise                *EnterpriseProfile
}
type AuthRepo interface {
	FindByUsername(context.Context, string) (*EnterpriseProfile, error)
	FindByAccountID(context.Context, uint64) (*EnterpriseProfile, error)
	RecordLoginFailure(context.Context, uint64, uint32, time.Time) error
	RecordLoginSuccess(context.Context, uint64, time.Time) error
	CreateSession(context.Context, uint64, uint64, SessionMetadata, time.Time) (*LoginSession, error)
	RotateSession(context.Context, uint64, string, time.Time) error
	FindSession(context.Context, uint64, string) (*LoginSession, error)
	ListSessions(context.Context, uint64, uint64) ([]*LoginSession, error)
	RevokeSession(context.Context, uint64, uint64, uint64, string) error
	RevokeAllSessions(context.Context, uint64, string) error
	UpdatePassword(context.Context, uint64, string, time.Time) error
	UpdateProfile(context.Context, *EnterpriseProfile) (*EnterpriseProfile, error)
}
type TokenManager interface {
	IssuePair(uint64, uint64, uint64, string) (string, string, time.Time, error)
	Verify(string, string) (*authn.Claims, error)
	RefreshDuration() time.Duration
}
type AuthUsecase struct {
	repo   AuthRepo
	tokens TokenManager
}

func NewAuthUsecase(repo AuthRepo, tokens TokenManager) *AuthUsecase {
	return &AuthUsecase{repo: repo, tokens: tokens}
}
func (uc *AuthUsecase) Login(ctx context.Context, username, password string, meta SessionMetadata) (*TokenPair, error) {
	p, e := uc.repo.FindByUsername(ctx, strings.TrimSpace(username))
	if e != nil {
		return nil, ErrCredentials
	}
	now := time.Now().UTC()
	if p.LockedUntil != nil && p.LockedUntil.After(now) {
		return nil, ErrAccountLocked
	}
	if p.Status != "active" || p.AccountStatus != "active" {
		return nil, ErrEnterpriseDisabled
	}
	if !security.ComparePassword(p.PasswordHash, password) {
		count := p.FailedLoginCount + 1
		locked := time.Time{}
		if count >= 5 {
			locked = now.Add(15 * time.Minute)
		}
		_ = uc.repo.RecordLoginFailure(ctx, p.AccountID, count, locked)
		return nil, ErrCredentials
	}
	session, e := uc.repo.CreateSession(ctx, p.AccountID, p.EnterpriseID, meta, now.Add(uc.tokens.RefreshDuration()))
	if e != nil {
		return nil, e
	}
	access, refresh, expiry, e := uc.tokens.IssuePair(p.AccountID, p.EnterpriseID, session.ID, authn.SubjectTypeEnterprise)
	if e != nil {
		return nil, e
	}
	if e = uc.repo.RotateSession(ctx, session.ID, authn.TokenHash(refresh), now.Add(uc.tokens.RefreshDuration())); e != nil {
		return nil, e
	}
	if e = uc.repo.RecordLoginSuccess(ctx, p.AccountID, now); e != nil {
		return nil, e
	}
	p.PasswordHash = ""
	return &TokenPair{AccessToken: access, RefreshToken: refresh, AccessExpiresAt: expiry, Enterprise: p}, nil
}
func (uc *AuthUsecase) Refresh(ctx context.Context, raw string) (*TokenPair, error) {
	claims, e := uc.tokens.Verify(raw, authn.TokenKindRefresh)
	if e != nil {
		return nil, ErrSessionInvalid
	}
	session, e := uc.repo.FindSession(ctx, claims.SessionID, authn.TokenHash(raw))
	if e != nil || session.SubjectID != claims.SubjectID || session.EnterpriseID != claims.EnterpriseID {
		return nil, ErrSessionInvalid
	}
	p, e := uc.repo.FindByAccountID(ctx, claims.SubjectID)
	if e != nil || p.Status != "active" || p.AccountStatus != "active" {
		return nil, ErrSessionInvalid
	}
	access, refresh, expiry, e := uc.tokens.IssuePair(p.AccountID, p.EnterpriseID, session.ID, authn.SubjectTypeEnterprise)
	if e != nil {
		return nil, e
	}
	if e = uc.repo.RotateSession(ctx, session.ID, authn.TokenHash(refresh), time.Now().UTC().Add(uc.tokens.RefreshDuration())); e != nil {
		return nil, e
	}
	p.PasswordHash = ""
	return &TokenPair{AccessToken: access, RefreshToken: refresh, AccessExpiresAt: expiry, Enterprise: p}, nil
}
func (uc *AuthUsecase) Me(ctx context.Context, accountID uint64) (*EnterpriseProfile, error) {
	p, e := uc.repo.FindByAccountID(ctx, accountID)
	if e != nil {
		return nil, e
	}
	p.PasswordHash = ""
	return p, nil
}
func (uc *AuthUsecase) UpdateProfile(ctx context.Context, enterpriseID uint64, p *EnterpriseProfile) (*EnterpriseProfile, error) {
	if p == nil || p.Version == 0 || strings.TrimSpace(p.Name) == "" {
		return nil, ErrProfileConflict
	}
	p.EnterpriseID = enterpriseID
	return uc.repo.UpdateProfile(ctx, p)
}
func (uc *AuthUsecase) Logout(ctx context.Context, enterpriseID, accountID, sessionID uint64, all bool) error {
	if all {
		return uc.repo.RevokeAllSessions(ctx, accountID, "user_logout_all")
	}
	return uc.repo.RevokeSession(ctx, enterpriseID, accountID, sessionID, "user_logout")
}
func (uc *AuthUsecase) ChangePassword(ctx context.Context, accountID uint64, current, next string) error {
	p, e := uc.repo.FindByAccountID(ctx, accountID)
	if e != nil {
		return e
	}
	if !security.ComparePassword(p.PasswordHash, current) {
		return ErrCredentials
	}
	hash, e := security.HashPassword(next)
	if e != nil {
		return ErrPasswordInvalid
	}
	if e = uc.repo.UpdatePassword(ctx, accountID, hash, time.Now().UTC()); e != nil {
		return e
	}
	return uc.repo.RevokeAllSessions(ctx, accountID, "password_changed")
}
func (uc *AuthUsecase) ListSessions(ctx context.Context, enterpriseID, accountID uint64) ([]*LoginSession, error) {
	return uc.repo.ListSessions(ctx, enterpriseID, accountID)
}
func (uc *AuthUsecase) RevokeSession(ctx context.Context, enterpriseID, accountID, sessionID uint64) error {
	if sessionID == 0 {
		return ErrSessionInvalid
	}
	return uc.repo.RevokeSession(ctx, enterpriseID, accountID, sessionID, "user_revoked")
}
