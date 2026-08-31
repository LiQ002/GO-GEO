package biz

import (
	"context"
	"github.com/go-kratos/kratos/v3/errors"
	"strings"
	"time"
)

var (
	ErrInclusionSiteNotFound    = errors.NotFound("INCLUSION_SITE_NOT_FOUND", "inclusion site not found")
	ErrInclusionSiteInvalid     = errors.BadRequest("INCLUSION_SITE_INVALID", "invalid inclusion site")
	ErrInclusionSiteConflict    = errors.Conflict("INCLUSION_SITE_CONFLICT", "inclusion site version conflict")
	ErrInclusionSiteIconInvalid = errors.BadRequest("INCLUSION_SITE_ICON_INVALID", "invalid inclusion site icon")
	ErrInclusionSiteIconStorage = errors.InternalServer("INCLUSION_SITE_ICON_STORAGE", "unable to store inclusion site icon")
)

type InclusionSite struct {
	ID                                                            uint64
	Code, Name, EntryURL, Icon, DriverVersion, MaintenanceMessage string
	Status, AuthorizationType                                     int32
	DriverType                                                    int32
	SortOrder                                                     int32
	Version                                                       uint64
	CreatedAt, UpdatedAt                                          time.Time
}
type InclusionSiteListOptions struct {
	Offset, Limit int
	Status        int32
	Keyword       string
}
type InclusionSiteRepo interface {
	Create(context.Context, *InclusionSite) (*InclusionSite, error)
	Get(context.Context, uint64) (*InclusionSite, error)
	List(context.Context, InclusionSiteListOptions) ([]*InclusionSite, int64, error)
	Update(context.Context, *InclusionSite) (*InclusionSite, error)
	Delete(context.Context, uint64, uint64) error
}
type InclusionSiteUsecase struct{ repo InclusionSiteRepo }

func NewInclusionSiteUsecase(repo InclusionSiteRepo) *InclusionSiteUsecase {
	return &InclusionSiteUsecase{repo: repo}
}
func (uc *InclusionSiteUsecase) Create(ctx context.Context, i *InclusionSite) (*InclusionSite, error) {
	if i != nil && i.Status == 0 {
		i.Status = PublishChannelStatusDisabled
	}
	if e := validateInclusionSite(i); e != nil {
		return nil, e
	}
	return uc.repo.Create(ctx, i)
}
func (uc *InclusionSiteUsecase) Get(ctx context.Context, id uint64) (*InclusionSite, error) {
	if id == 0 {
		return nil, ErrInclusionSiteInvalid
	}
	return uc.repo.Get(ctx, id)
}
func (uc *InclusionSiteUsecase) List(ctx context.Context, o InclusionSiteListOptions) ([]*InclusionSite, int64, error) {
	return uc.repo.List(ctx, o)
}
func (uc *InclusionSiteUsecase) Update(ctx context.Context, i *InclusionSite) (*InclusionSite, error) {
	if i == nil || i.ID == 0 || i.Version == 0 {
		return nil, ErrInclusionSiteInvalid
	}
	if e := validateInclusionSite(i); e != nil {
		return nil, e
	}
	return uc.repo.Update(ctx, i)
}
func (uc *InclusionSiteUsecase) Delete(ctx context.Context, id, version uint64) error {
	if id == 0 || version == 0 {
		return ErrInclusionSiteInvalid
	}
	return uc.repo.Delete(ctx, id, version)
}
func validateInclusionSite(i *InclusionSite) error {
	if i == nil || strings.TrimSpace(i.Code) == "" || !inRange(i.DriverType, ModelDriverDeepSeek, ModelDriverZhipu) || strings.TrimSpace(i.Name) == "" || i.AuthorizationType != AuthorizationTypeClientLogin || !inRange(i.Status, PublishChannelStatusActive, PublishChannelStatusMaintenance) {
		return ErrInclusionSiteInvalid
	}
	if !validPlatformLoginURL(i.EntryURL) {
		return ErrInclusionSiteInvalid
	}
	return nil
}
