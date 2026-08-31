package biz

import (
	"context"
	"github.com/go-kratos/kratos/v3/errors"
	"strings"
	"time"
)

var (
	ErrAlertNotFound = errors.NotFound("ALERT_NOT_FOUND", "alert not found")
	ErrAlertInvalid  = errors.BadRequest("ALERT_INVALID", "invalid alert operation")
)

type AdminAlert struct {
	ID                                                                                                     uint64
	EnterpriseID                                                                                           *uint64
	EnterpriseName, AlertType, Severity, Status, Title, Description, ResourceType, ResourceID, DetailsJSON string
	ResolvedAt                                                                                             *time.Time
	ResolvedBy                                                                                             *uint64
	CreatedAt, UpdatedAt                                                                                   time.Time
}
type AdminAlertListOptions struct {
	Offset, Limit                        int
	EnterpriseID                         *uint64
	Severity, Status, AlertType, Keyword string
}
type ResolveAlertCommand struct {
	ID, OperatorID uint64
	Reason         string
}
type AdminAlertRepo interface {
	List(context.Context, AdminAlertListOptions) ([]*AdminAlert, int64, error)
	Get(context.Context, uint64) (*AdminAlert, error)
	Resolve(context.Context, ResolveAlertCommand) (*AdminAlert, error)
}
type AdminAlertUsecase struct{ repo AdminAlertRepo }

func NewAdminAlertUsecase(repo AdminAlertRepo) *AdminAlertUsecase {
	return &AdminAlertUsecase{repo: repo}
}
func (u *AdminAlertUsecase) List(ctx context.Context, o AdminAlertListOptions) ([]*AdminAlert, int64, error) {
	return u.repo.List(ctx, o)
}
func (u *AdminAlertUsecase) Get(ctx context.Context, id uint64) (*AdminAlert, error) {
	if id == 0 {
		return nil, ErrAlertInvalid
	}
	return u.repo.Get(ctx, id)
}
func (u *AdminAlertUsecase) Resolve(ctx context.Context, c ResolveAlertCommand) (*AdminAlert, error) {
	if c.ID == 0 || c.OperatorID == 0 || strings.TrimSpace(c.Reason) == "" {
		return nil, ErrAlertInvalid
	}
	return u.repo.Resolve(ctx, c)
}
