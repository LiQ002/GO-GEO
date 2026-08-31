package biz

import (
	"context"
	"encoding/json"
	"github.com/go-kratos/kratos/v3/errors"
	"time"
)

var (
	ErrWorkerUnauthorized = errors.Unauthorized("WORKER_UNAUTHORIZED", "worker authentication failed")
	ErrWorkerPending      = errors.Forbidden("WORKER_NOT_APPROVED", "worker is not approved")
	ErrWorkerInvalid      = errors.BadRequest("WORKER_INVALID", "invalid worker request")
	ErrLeaseNotFound      = errors.NotFound("LEASE_NOT_FOUND", "task lease not found")
	ErrLeaseConflict      = errors.Conflict("LEASE_CONFLICT", "task lease conflict")
)

type WorkerNode struct {
	ID                                                                                                        uint64
	NodeID, Name, Status, ApprovalStatus, ClientVersion, DriverVersionsJSON, CapabilitiesJSON, SystemInfoJSON string
	MaxConcurrency                                                                                            uint32
	LastHeartbeatAt, RevokedAt                                                                                *time.Time
	Version                                                                                                   uint64
	CreatedAt, UpdatedAt                                                                                      time.Time
}
type TaskLease struct {
	ID, TaskID, LeaseVersion               uint64
	TaskType, LeaseToken, TaskSnapshotJSON string
	CredentialPayload                      []byte
	ExpiresAt                              time.Time
}
type TaskClaimFilter struct {
	TaskID                              uint64
	TaskTypes                           []string
	PublishChannelIDs, InclusionSiteIDs []uint64
}
type TaskResult struct {
	TaskType                                                                                                            string
	TaskID, LeaseID, DurationMS                                                                                         uint64
	LeaseToken, IdempotencyKey, Status, ResultJSON, EvidenceJSON, ErrorCategory, ErrorCode, ErrorMessage, ClientVersion string
}
type WorkerTaskRepo interface {
	Register(context.Context, *WorkerNode) (*WorkerNode, string, error)
	Authenticate(context.Context, string) (*WorkerNode, error)
	Heartbeat(context.Context, uint64, string, string, string, uint32) (*WorkerNode, error)
	Claim(context.Context, *WorkerNode, TaskClaimFilter) (*TaskLease, error)
	Renew(context.Context, uint64, uint64, string) (*TaskLease, error)
	Release(context.Context, uint64, string, string) error
	Report(context.Context, *TaskResult) error
	ListWorkers(context.Context, string) ([]*WorkerNode, error)
	ChangeWorkerStatus(context.Context, uint64, uint64, string) (*WorkerNode, error)
}
type WorkerTaskUsecase struct{ repo WorkerTaskRepo }

func NewWorkerTaskUsecase(r WorkerTaskRepo) *WorkerTaskUsecase { return &WorkerTaskUsecase{repo: r} }
func (u *WorkerTaskUsecase) Register(c context.Context, w *WorkerNode) (*WorkerNode, string, error) {
	if w == nil || w.NodeID == "" || w.Name == "" || !json.Valid([]byte(w.CapabilitiesJSON)) {
		return nil, "", ErrWorkerInvalid
	}
	return u.repo.Register(c, w)
}
func (u *WorkerTaskUsecase) Heartbeat(c context.Context, t, v, cap, sys string, a uint32) (*WorkerNode, error) {
	w, e := u.repo.Authenticate(c, t)
	if e != nil {
		return nil, e
	}
	return u.repo.Heartbeat(c, w.ID, v, cap, sys, a)
}
func (u *WorkerTaskUsecase) Claim(c context.Context, t string, f TaskClaimFilter) (*TaskLease, error) {
	w, e := u.repo.Authenticate(c, t)
	if e != nil {
		return nil, e
	}
	if w.ApprovalStatus != "approved" || w.Status != "active" {
		return nil, ErrWorkerPending
	}
	return u.repo.Claim(c, w, f)
}
func (u *WorkerTaskUsecase) Renew(c context.Context, id, v uint64, t string) (*TaskLease, error) {
	return u.repo.Renew(c, id, v, t)
}
func (u *WorkerTaskUsecase) Release(c context.Context, id uint64, t, reason string) error {
	return u.repo.Release(c, id, t, reason)
}
func (u *WorkerTaskUsecase) Report(c context.Context, r *TaskResult) error {
	if r == nil || r.TaskID == 0 || r.LeaseID == 0 || r.IdempotencyKey == "" || !json.Valid([]byte(r.ResultJSON)) || !json.Valid([]byte(r.EvidenceJSON)) {
		return ErrWorkerInvalid
	}
	return u.repo.Report(c, r)
}
func (u *WorkerTaskUsecase) List(c context.Context, s string) ([]*WorkerNode, error) {
	return u.repo.ListWorkers(c, s)
}
func (u *WorkerTaskUsecase) Change(c context.Context, id, v uint64, a string) (*WorkerNode, error) {
	if !map[string]bool{"approve": true, "revoke": true, "pause": true, "resume": true}[a] {
		return nil, ErrWorkerInvalid
	}
	return u.repo.ChangeWorkerStatus(c, id, v, a)
}

type WorkerHeartbeatRecord struct {
	ID          uint64
	ActiveTasks uint32
	MetricsJSON string
	ReceivedAt  time.Time
}
type WorkerLeaseRecord struct {
	ID, TaskID          uint64
	TaskType, Status    string
	LeasedAt, ExpiresAt time.Time
	ReleasedAt          *time.Time
	ReleaseReason       string
}
type WorkerDetail struct {
	Worker     *WorkerNode
	Heartbeats []*WorkerHeartbeatRecord
	Leases     []*WorkerLeaseRecord
}
type WorkerListOptions struct {
	Offset, Limit                   int
	Status, ApprovalStatus, Keyword string
}
type WorkerStatusCommand struct {
	ID, Version, OperatorID uint64
	Action, Reason          string
}
type WorkerAdminRepo interface {
	List(context.Context, WorkerListOptions) ([]*WorkerNode, int64, error)
	Get(context.Context, uint64) (*WorkerDetail, error)
	ChangeStatus(context.Context, WorkerStatusCommand) (*WorkerDetail, error)
}
type WorkerAdminUsecase struct{ repo WorkerAdminRepo }

func NewWorkerAdminUsecase(repo WorkerAdminRepo) *WorkerAdminUsecase {
	return &WorkerAdminUsecase{repo: repo}
}
func (u *WorkerAdminUsecase) List(ctx context.Context, opts WorkerListOptions) ([]*WorkerNode, int64, error) {
	return u.repo.List(ctx, opts)
}
func (u *WorkerAdminUsecase) Get(ctx context.Context, id uint64) (*WorkerDetail, error) {
	if id == 0 {
		return nil, ErrWorkerInvalid
	}
	return u.repo.Get(ctx, id)
}
func (u *WorkerAdminUsecase) ChangeStatus(ctx context.Context, cmd WorkerStatusCommand) (*WorkerDetail, error) {
	if cmd.ID == 0 || cmd.Version == 0 || cmd.OperatorID == 0 || cmd.Reason == "" || !map[string]bool{"approve": true, "activate": true, "suspend": true, "revoke": true}[cmd.Action] {
		return nil, ErrWorkerInvalid
	}
	return u.repo.ChangeStatus(ctx, cmd)
}
