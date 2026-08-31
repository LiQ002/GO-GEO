// Package authn provides audience-separated JWT authentication for all GEO apps.
package authn

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	kratoserrors "github.com/go-kratos/kratos/v3/errors"
	"github.com/go-kratos/kratos/v3/middleware"
	"github.com/go-kratos/kratos/v3/transport"
	"github.com/golang-jwt/jwt/v5"
)

const (
	TokenKindAccess       = "access"
	TokenKindRefresh      = "refresh"
	SubjectTypeAdmin      = "admin"
	SubjectTypeEnterprise = "enterprise"
)

// Config configures token issuance for a single app audience.
type Config struct {
	Issuer          string
	Audience        string
	SubjectType     string
	Secret          string
	AccessDuration  time.Duration
	RefreshDuration time.Duration
	CookieName      string
}

// Claims contains stable identity and tenant information.
type Claims struct {
	SubjectID    uint64 `json:"subject_id"`
	EnterpriseID uint64 `json:"enterprise_id,omitempty"`
	SubjectType  string `json:"subject_type"`
	TokenKind    string `json:"token_kind"`
	SessionID    uint64 `json:"session_id,omitempty"`
	jwt.RegisteredClaims
}

// Principal is the verified request identity stored in context.
type Principal struct {
	SubjectID    uint64
	EnterpriseID uint64
	SubjectType  string
	Audience     string
	SessionID    uint64
}

type principalKey struct{}

// Manager issues and verifies tokens for one audience.
type Manager struct {
	config Config
}

// NewManager constructs a Manager and rejects unsafe production-like config.
func NewManager(config Config) (*Manager, error) {
	if strings.TrimSpace(config.Issuer) == "" || strings.TrimSpace(config.Audience) == "" || strings.TrimSpace(config.SubjectType) == "" {
		return nil, errors.New("auth issuer, audience, and subject type are required")
	}
	if len(config.Secret) < 32 {
		return nil, errors.New("auth secret must contain at least 32 bytes")
	}
	if config.AccessDuration <= 0 || config.RefreshDuration <= 0 {
		return nil, errors.New("token durations must be positive")
	}
	return &Manager{config: config}, nil
}

// IssuePair issues audience-bound access and refresh tokens.
func (m *Manager) IssuePair(subjectID, enterpriseID, sessionID uint64, subjectType string) (string, string, time.Time, error) {
	if subjectID == 0 || subjectType != m.config.SubjectType {
		return "", "", time.Time{}, errors.New("token subject does not match auth application")
	}
	now := time.Now().UTC()
	accessExpiry := now.Add(m.config.AccessDuration)
	access, err := m.issue(subjectID, enterpriseID, sessionID, subjectType, TokenKindAccess, now, accessExpiry)
	if err != nil {
		return "", "", time.Time{}, err
	}
	refresh, err := m.issue(subjectID, enterpriseID, sessionID, subjectType, TokenKindRefresh, now, now.Add(m.config.RefreshDuration))
	if err != nil {
		return "", "", time.Time{}, err
	}
	return access, refresh, accessExpiry, nil
}

// RefreshDuration returns the configured refresh session lifetime.
func (m *Manager) RefreshDuration() time.Duration { return m.config.RefreshDuration }

// CookieName returns the configured cookie name for token extraction.
func (m *Manager) CookieName() string { return m.config.CookieName }

// Verify validates signature, algorithm, issuer, audience, expiration, token kind,
// subject identity, and the subject type assigned to this application.
func (m *Manager) Verify(rawToken, tokenKind string) (*Claims, error) {
	claims := new(Claims)
	token, err := jwt.ParseWithClaims(rawToken, claims, func(token *jwt.Token) (any, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("unexpected signing method %q", token.Method.Alg())
		}
		return []byte(m.config.Secret), nil
	},
		jwt.WithAudience(m.config.Audience),
		jwt.WithIssuer(m.config.Issuer),
		jwt.WithExpirationRequired(),
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
	)
	if err != nil || !token.Valid || claims.TokenKind != tokenKind || claims.SubjectID == 0 || claims.SubjectType != m.config.SubjectType || claims.Subject != strconv.FormatUint(claims.SubjectID, 10) {
		return nil, kratoserrors.Unauthorized("AUTH_INVALID_TOKEN", "invalid or expired token")
	}
	return claims, nil
}

func (m *Manager) issue(subjectID, enterpriseID, sessionID uint64, subjectType, tokenKind string, issuedAt, expiresAt time.Time) (string, error) {
	jwtID, err := RandomToken(24)
	if err != nil {
		return "", err
	}
	claims := Claims{
		SubjectID:    subjectID,
		EnterpriseID: enterpriseID,
		SubjectType:  subjectType,
		TokenKind:    tokenKind,
		SessionID:    sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.config.Issuer,
			Subject:   strconv.FormatUint(subjectID, 10),
			Audience:  jwt.ClaimStrings{m.config.Audience},
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			NotBefore: jwt.NewNumericDate(issuedAt),
			IssuedAt:  jwt.NewNumericDate(issuedAt),
			ID:        jwtID,
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(m.config.Secret))
}

// Middleware authenticates every operation except explicitly public ones.
func Middleware(manager *Manager, publicOperations ...string) middleware.Middleware {
	public := make(map[string]struct{}, len(publicOperations))
	for _, operation := range publicOperations {
		public[operation] = struct{}{}
	}
	return func(next middleware.Handler) middleware.Handler {
		return func(ctx context.Context, req any) (any, error) {
			tr, ok := transport.FromServerContext(ctx)
			if !ok {
				return nil, kratoserrors.Unauthorized("AUTH_CONTEXT_MISSING", "transport context missing")
			}
			if _, allowed := public[tr.Operation()]; allowed {
				return next(ctx, req)
			}
			authorization := tr.RequestHeader().Get("Authorization")
			rawToken := ""
			if strings.TrimSpace(authorization) != "" {
				rawToken = bearerToken(authorization)
				if rawToken == "" {
					return nil, kratoserrors.Unauthorized("AUTH_INVALID_TOKEN", "invalid or expired token")
				}
			} else if manager.config.CookieName != "" {
				rawToken = cookieValue(tr.RequestHeader().Get("Cookie"), manager.config.CookieName)
			}
			if rawToken == "" {
				return nil, kratoserrors.Unauthorized("AUTH_REQUIRED", "authentication required")
			}
			claims, err := manager.Verify(rawToken, TokenKindAccess)
			if err != nil {
				return nil, err
			}
			principal := Principal{
				SubjectID: claims.SubjectID, EnterpriseID: claims.EnterpriseID,
				SubjectType: claims.SubjectType, Audience: manager.config.Audience, SessionID: claims.SessionID,
			}
			return next(context.WithValue(ctx, principalKey{}, principal), req)
		}
	}
}

// PrincipalFromContext returns the verified request identity.
func PrincipalFromContext(ctx context.Context) (Principal, bool) {
	principal, ok := ctx.Value(principalKey{}).(Principal)
	return principal, ok
}

// WithPrincipal injects a verified Principal into the context.
// It is intended for legacy/compatibility handlers that perform their own
// token verification but still need downstream services to read the identity.
func WithPrincipal(ctx context.Context, p Principal) context.Context {
	return context.WithValue(ctx, principalKey{}, p)
}

// RequireEnterprise returns the trusted tenant id from context.
func RequireEnterprise(ctx context.Context) (uint64, error) {
	principal, ok := PrincipalFromContext(ctx)
	if !ok || principal.EnterpriseID == 0 {
		return 0, kratoserrors.Forbidden("ENTERPRISE_CONTEXT_REQUIRED", "enterprise context required")
	}
	return principal.EnterpriseID, nil
}

// RandomToken generates a cryptographically secure base64url token.
func RandomToken(byteLength int) (string, error) {
	if byteLength < 16 {
		return "", errors.New("token entropy is too small")
	}
	value := make([]byte, byteLength)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("read random token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

// TokenHash creates a non-reversible database lookup value for a refresh token.
func TokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func bearerToken(header string) string {
	parts := strings.Fields(header)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return parts[1]
}

func cookieValue(header, name string) string {
	for part := range strings.SplitSeq(header, ";") {
		key, value, ok := strings.Cut(strings.TrimSpace(part), "=")
		if ok && key == name {
			return value
		}
	}
	return ""
}
