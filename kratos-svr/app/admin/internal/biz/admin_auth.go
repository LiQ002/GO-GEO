package biz

import (
	"context"
	"strings"
	"time"

	"kratos-svr/internal/authn"
	"kratos-svr/internal/security"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrAdminCredentials = errors.Unauthorized("ADMIN_CREDENTIALS_INVALID", "invalid username or password")
	ErrAdminLocked      = errors.Forbidden("ADMIN_ACCOUNT_LOCKED", "admin account is locked")
	ErrAdminDisabled    = errors.Forbidden("ADMIN_ACCOUNT_DISABLED", "admin account is disabled")
	ErrAdminSession     = errors.Unauthorized("ADMIN_SESSION_INVALID", "admin session is invalid")
	ErrAdminPassword    = errors.BadRequest("ADMIN_PASSWORD_INVALID", "invalid password")
)

type AdminProfile struct {
	ID                                                 uint64
	Username, DisplayName, Email, Status, PasswordHash string
	Roles, Permissions                                 []string
	FailedLoginCount                                   uint32
	LockedUntil                                        *time.Time
	LastLoginAt                                        *time.Time
}
type SessionMetadata struct{ DeviceID, IPAddress, UserAgent string }
type AdminSession struct {
	ID, SubjectID    uint64
	RefreshTokenHash string
	ExpiresAt        time.Time
	RevokedAt        *time.Time
}
type AdminTokenPair struct {
	AccessToken, RefreshToken string
	AccessExpiresAt           time.Time
	Admin                     *AdminProfile
}

type AdminAuthRepo interface {
	FindByUsername(context.Context, string) (*AdminProfile, error)
	FindByID(context.Context, uint64) (*AdminProfile, error)
	RecordLoginFailure(context.Context, uint64, uint32, time.Time) error
	RecordLoginSuccess(context.Context, uint64, time.Time) error
	CreateSession(context.Context, uint64, SessionMetadata, time.Time) (*AdminSession, error)
	RotateSession(context.Context, uint64, string, time.Time) error
	FindSession(context.Context, uint64, string) (*AdminSession, error)
	RevokeSession(context.Context, uint64, string) error
	RevokeAllSessions(context.Context, uint64, string) error
	UpdatePassword(context.Context, uint64, string, time.Time) error
}
type AdminTokenManager interface {
	IssuePair(uint64, uint64, uint64, string) (string, string, time.Time, error)
	Verify(string, string) (*authn.Claims, error)
	RefreshDuration() time.Duration
}
type AdminAuthUsecase struct {
	repo   AdminAuthRepo
	tokens AdminTokenManager
}

func NewAdminAuthUsecase(repo AdminAuthRepo, tokens AdminTokenManager) *AdminAuthUsecase {
	return &AdminAuthUsecase{repo: repo, tokens: tokens}
}

func (uc *AdminAuthUsecase) Login(ctx context.Context, username, password string, metadata SessionMetadata) (*AdminTokenPair, error) {
	profile, err := uc.repo.FindByUsername(ctx, strings.TrimSpace(username))
	if err != nil {
		return nil, ErrAdminCredentials
	}
	now := time.Now().UTC()
	if profile.LockedUntil != nil && profile.LockedUntil.After(now) {
		return nil, ErrAdminLocked
	}
	if profile.Status != "active" {
		return nil, ErrAdminDisabled
	}
	if !security.ComparePassword(profile.PasswordHash, password) {
		failures := profile.FailedLoginCount + 1
		lockedUntil := time.Time{}
		if failures >= 5 {
			lockedUntil = now.Add(15 * time.Minute)
		}
		_ = uc.repo.RecordLoginFailure(ctx, profile.ID, failures, lockedUntil)
		return nil, ErrAdminCredentials
	}
	session, err := uc.repo.CreateSession(ctx, profile.ID, metadata, now.Add(uc.tokens.RefreshDuration()))
	if err != nil {
		return nil, err
	}
	access, refresh, accessExpiry, err := uc.tokens.IssuePair(profile.ID, 0, session.ID, authn.SubjectTypeAdmin)
	if err != nil {
		return nil, err
	}
	if err := uc.repo.RotateSession(ctx, session.ID, authn.TokenHash(refresh), now.Add(uc.tokens.RefreshDuration())); err != nil {
		return nil, err
	}
	if err := uc.repo.RecordLoginSuccess(ctx, profile.ID, now); err != nil {
		return nil, err
	}
	profile.PasswordHash = ""
	profile.LastLoginAt = &now
	return &AdminTokenPair{AccessToken: access, RefreshToken: refresh, AccessExpiresAt: accessExpiry, Admin: profile}, nil
}
func (uc *AdminAuthUsecase) Refresh(ctx context.Context, raw string) (*AdminTokenPair, error) {
	claims, err := uc.tokens.Verify(raw, authn.TokenKindRefresh)
	if err != nil {
		return nil, ErrAdminSession
	}
	session, err := uc.repo.FindSession(ctx, claims.SessionID, authn.TokenHash(raw))
	if err != nil || session.SubjectID != claims.SubjectID {
		return nil, ErrAdminSession
	}
	profile, err := uc.repo.FindByID(ctx, claims.SubjectID)
	if err != nil || profile.Status != "active" {
		return nil, ErrAdminSession
	}
	access, refresh, expiry, err := uc.tokens.IssuePair(profile.ID, 0, session.ID, authn.SubjectTypeAdmin)
	if err != nil {
		return nil, err
	}
	if err := uc.repo.RotateSession(ctx, session.ID, authn.TokenHash(refresh), time.Now().UTC().Add(uc.tokens.RefreshDuration())); err != nil {
		return nil, err
	}
	profile.PasswordHash = ""
	return &AdminTokenPair{AccessToken: access, RefreshToken: refresh, AccessExpiresAt: expiry, Admin: profile}, nil
}
func (uc *AdminAuthUsecase) Me(ctx context.Context, id uint64) (*AdminProfile, error) {
	profile, err := uc.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	profile.PasswordHash = ""
	return profile, nil
}
func (uc *AdminAuthUsecase) Logout(ctx context.Context, subjectID, sessionID uint64, all bool) error {
	if all {
		return uc.repo.RevokeAllSessions(ctx, subjectID, "user_logout_all")
	}
	return uc.repo.RevokeSession(ctx, sessionID, "user_logout")
}
func (uc *AdminAuthUsecase) ChangePassword(ctx context.Context, id uint64, current, next string) error {
	profile, err := uc.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if !security.ComparePassword(profile.PasswordHash, current) {
		return ErrAdminCredentials
	}
	hash, err := security.HashPassword(next)
	if err != nil {
		return ErrAdminPassword
	}
	if err := uc.repo.UpdatePassword(ctx, id, hash, time.Now().UTC()); err != nil {
		return err
	}
	return uc.repo.RevokeAllSessions(ctx, id, "password_changed")
}
