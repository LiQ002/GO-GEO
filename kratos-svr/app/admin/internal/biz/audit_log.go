package biz

import (
	"context"
	"github.com/go-kratos/kratos/v3/errors"
	"time"
)

var ErrAuditLogNotFound = errors.NotFound("AUDIT_LOG_NOT_FOUND", "audit log not found")

type AdminAuditLog struct {
	ID                                                                                                                                     uint64
	EnterpriseID                                                                                                                           *uint64
	EnterpriseName, ActorType                                                                                                              string
	ActorID                                                                                                                                uint64
	ActorName, Audience, Action, ResourceType, ResourceID, Result, Reason, BeforeJSON, AfterJSON, IPAddress, UserAgent, RequestID, TraceID string
	CreatedAt                                                                                                                              time.Time
}
type AdminAuditLogListOptions struct {
	Offset, Limit                           int
	EnterpriseID                            *uint64
	ActorType                               string
	ActorID                                 uint64
	Action, ResourceType, Result, RequestID string
	StartedAt, EndedAt                      *time.Time
}
type AdminAuditLogRepo interface {
	List(context.Context, AdminAuditLogListOptions) ([]*AdminAuditLog, int64, error)
	Get(context.Context, uint64) (*AdminAuditLog, error)
}
type AdminAuditLogUsecase struct{ repo AdminAuditLogRepo }

func NewAdminAuditLogUsecase(repo AdminAuditLogRepo) *AdminAuditLogUsecase {
	return &AdminAuditLogUsecase{repo: repo}
}
func (u *AdminAuditLogUsecase) List(ctx context.Context, o AdminAuditLogListOptions) ([]*AdminAuditLog, int64, error) {
	return u.repo.List(ctx, o)
}
func (u *AdminAuditLogUsecase) Get(ctx context.Context, id uint64) (*AdminAuditLog, error) {
	if id == 0 {
		return nil, ErrAuditLogNotFound
	}
	return u.repo.Get(ctx, id)
}
