package biz

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

const clientCredentialPrefix = "aes:v2:"

var (
	ErrPlatformAccountNotFound    = errors.NotFound("PLATFORM_ACCOUNT_NOT_FOUND", "platform account not found")
	ErrPlatformCredentialNotFound = errors.NotFound("PLATFORM_CREDENTIAL_NOT_FOUND", "platform credential not found")
	ErrAuthorizationSession       = errors.Unauthorized("AUTHORIZATION_SESSION_INVALID", "authorization session is invalid")
	ErrPlatformAccountInvalid     = errors.BadRequest("PLATFORM_ACCOUNT_INVALID", "invalid platform account request")
	ErrPlatformAccountConflict    = errors.Conflict("PLATFORM_ACCOUNT_CONFLICT", "platform account version conflict")
)

type PlatformAccount struct {
	ID, EnterpriseID, ResourceID                          uint64
	AccountName, ExternalID, MaskedIdentity, MetadataJSON string
	ResourceType, AuthorizationStatus, UsageStatus        int32
	ExpiresAt, LastVerifiedAt, LastUsedAt                 *time.Time
	DailyLimit                                            int64
	IsDefault                                             bool
	Version                                               uint64
}
type AuthorizationSession struct {
	ID, EnterpriseID, ResourceID, PlatformAccountID uint64
	SessionToken, DeviceID                          string
	ResourceType, Status                            int32
	ExpiresAt                                       time.Time
	CompletedAt                                     *time.Time
}
type PlatformAccountFilter struct {
	ResourceType int32
	ResourceID   uint64
	Status       int32
}
type ClientConfig struct {
	MinimumVersion, LatestVersion, DownloadURL string
	ForceUpgrade                               bool
}
type PlatformAccountRepo interface {
	List(context.Context, uint64, PlatformAccountFilter) ([]*PlatformAccount, error)
	GetCredential(context.Context, uint64, uint64) (string, error)
	CreateSession(context.Context, uint64, string, int32, uint64, uint64) (*AuthorizationSession, error)
	GetSession(context.Context, uint64, uint64) (*AuthorizationSession, error)
	ChangeStatus(context.Context, uint64, uint64, uint64, string) (*PlatformAccount, error)
	Delete(context.Context, uint64, uint64, uint64) error
	SubmitAuthorization(context.Context, string, *PlatformAccount, string, string) (*PlatformAccount, error)
	Heartbeat(context.Context, string, string, string) (*AuthorizationSession, error)
	GetClientConfig(context.Context) (*ClientConfig, error)
}
type PlatformAccountUsecase struct{ repo PlatformAccountRepo }

func NewPlatformAccountUsecase(r PlatformAccountRepo) *PlatformAccountUsecase {
	return &PlatformAccountUsecase{repo: r}
}
func (u *PlatformAccountUsecase) List(c context.Context, e uint64, f PlatformAccountFilter) ([]*PlatformAccount, error) {
	if e == 0 || (f.ResourceType != 0 && !validAuthorizationResourceType(f.ResourceType)) || (f.ResourceID != 0 && f.ResourceType == 0) {
		return nil, ErrPlatformAccountInvalid
	}
	return u.repo.List(c, e, f)
}
func (u *PlatformAccountUsecase) GetCredential(c context.Context, enterpriseID, accountID uint64) (string, error) {
	if enterpriseID == 0 || accountID == 0 {
		return "", ErrPlatformAccountInvalid
	}
	return u.repo.GetCredential(c, enterpriseID, accountID)
}
func (u *PlatformAccountUsecase) CreateSession(c context.Context, e uint64, device string, typ int32, resourceID, accountID uint64) (*AuthorizationSession, error) {
	if e == 0 || strings.TrimSpace(device) == "" || resourceID == 0 || !validAuthorizationResourceType(typ) {
		return nil, ErrPlatformAccountInvalid
	}
	return u.repo.CreateSession(c, e, device, typ, resourceID, accountID)
}
func (u *PlatformAccountUsecase) GetSession(c context.Context, e, id uint64) (*AuthorizationSession, error) {
	return u.repo.GetSession(c, e, id)
}
func (u *PlatformAccountUsecase) ChangeStatus(c context.Context, e, id, v uint64, action string) (*PlatformAccount, error) {
	if !map[string]bool{"pause": true, "resume": true, "revoke": true}[action] {
		return nil, ErrPlatformAccountInvalid
	}
	return u.repo.ChangeStatus(c, e, id, v, action)
}
func (u *PlatformAccountUsecase) Delete(c context.Context, e, id, v uint64) error {
	return u.repo.Delete(c, e, id, v)
}
func (u *PlatformAccountUsecase) Submit(c context.Context, token string, a *PlatformAccount, credential string, clientVersion string) (*PlatformAccount, error) {
	credential = strings.TrimSpace(credential)
	if strings.TrimSpace(token) == "" || a == nil || strings.TrimSpace(a.AccountName) == "" || !validClientCredential(credential) || (a.MetadataJSON != "" && !json.Valid([]byte(a.MetadataJSON))) {
		return nil, ErrPlatformAccountInvalid
	}
	return u.repo.SubmitAuthorization(c, token, a, credential, clientVersion)
}

func validClientCredential(credential string) bool {
	value := strings.TrimSpace(credential)
	return strings.HasPrefix(value, clientCredentialPrefix) && len(value) > len(clientCredentialPrefix)
}
func (u *PlatformAccountUsecase) Heartbeat(c context.Context, token, status, version string) (*AuthorizationSession, error) {
	return u.repo.Heartbeat(c, token, status, version)
}
func (u *PlatformAccountUsecase) Config(c context.Context) (*ClientConfig, error) {
	return u.repo.GetClientConfig(c)
}
