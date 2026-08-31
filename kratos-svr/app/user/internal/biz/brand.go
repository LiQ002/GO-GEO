package biz

import (
	"context"
	"encoding/json"
	"github.com/go-kratos/kratos/v3/errors"
	"strings"
	"time"
)

var (
	ErrBrandNotFound = errors.NotFound("BRAND_NOT_FOUND", "brand not found")
	ErrBrandInvalid  = errors.BadRequest("BRAND_INVALID", "invalid brand")
	ErrBrandConflict = errors.Conflict("BRAND_CONFLICT", "brand version conflict")
)

type Brand struct {
	ID, EnterpriseID                                                                            uint64
	Name, AliasesJSON, OfficialDomain, Description, Industry, Region, TargetAudience, CoreValue string
	Status                                                                                      int32
	Version                                                                                     uint64
	CreatedAt, UpdatedAt                                                                        time.Time
}
type BrandListOptions struct {
	Offset, Limit int
	Status        int32
	Keyword       string
}
type BrandRepo interface {
	Create(context.Context, *Brand) (*Brand, error)
	Get(context.Context, uint64, uint64) (*Brand, error)
	List(context.Context, uint64, BrandListOptions) ([]*Brand, int64, error)
	Update(context.Context, *Brand) (*Brand, error)
	Delete(context.Context, uint64, uint64, uint64) error
}
type BrandUsecase struct{ repo BrandRepo }

func NewBrandUsecase(r BrandRepo) *BrandUsecase { return &BrandUsecase{repo: r} }
func (u *BrandUsecase) Create(c context.Context, i *Brand) (*Brand, error) {
	if e := validateBrand(i); e != nil {
		return nil, e
	}
	if i.Status == 0 {
		i.Status = BrandStatusActive
	}
	return u.repo.Create(c, i)
}
func (u *BrandUsecase) Get(c context.Context, e, id uint64) (*Brand, error) {
	if e == 0 || id == 0 {
		return nil, ErrBrandInvalid
	}
	return u.repo.Get(c, e, id)
}
func (u *BrandUsecase) List(c context.Context, e uint64, o BrandListOptions) ([]*Brand, int64, error) {
	return u.repo.List(c, e, o)
}
func (u *BrandUsecase) Update(c context.Context, i *Brand) (*Brand, error) {
	if i == nil || i.ID == 0 || i.EnterpriseID == 0 || i.Version == 0 || !validBrandStatus(i.Status) {
		return nil, ErrBrandInvalid
	}
	if e := validateBrand(i); e != nil {
		return nil, e
	}
	return u.repo.Update(c, i)
}
func (u *BrandUsecase) Delete(c context.Context, e, id, v uint64) error {
	if e == 0 || id == 0 || v == 0 {
		return ErrBrandInvalid
	}
	return u.repo.Delete(c, e, id, v)
}
func validateBrand(i *Brand) error {
	if i == nil || i.EnterpriseID == 0 || strings.TrimSpace(i.Name) == "" || (i.AliasesJSON != "" && !json.Valid([]byte(i.AliasesJSON))) || (i.Status != 0 && !validBrandStatus(i.Status)) {
		return ErrBrandInvalid
	}
	return nil
}
