package biz

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrExportJobNotFound = errors.NotFound("EXPORT_JOB_NOT_FOUND", "export job not found")
	ErrExportJobInvalid  = errors.BadRequest("EXPORT_JOB_INVALID", "invalid export job")
	ErrExportJobConflict = errors.Conflict("EXPORT_JOB_CONFLICT", "export job state conflict")
)

type ExportJob struct {
	ID              uint64
	EnterpriseID    uint64
	RequestedByID   uint64
	ResourceType    string
	Format          string
	FilterJSON      string
	ClientRequestID string
	Status          string
	ObjectKey       string
	FileHash        string
	ExpiresAt       *time.Time
	ErrorMessage    string
	CompletedAt     *time.Time
	CancelledAt     *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type ExportJobListOptions struct {
	Offset       int
	Limit        int
	ResourceType string
	Format       string
	Status       string
}

type ExportJobRepo interface {
	Create(context.Context, *ExportJob) (*ExportJob, error)
	Get(context.Context, uint64, uint64, uint64) (*ExportJob, error)
	List(context.Context, uint64, uint64, ExportJobListOptions) ([]*ExportJob, int64, error)
	Cancel(context.Context, uint64, uint64, uint64) (*ExportJob, error)
}

type ExportJobUsecase struct {
	repo ExportJobRepo
}

func NewExportJobUsecase(repo ExportJobRepo) *ExportJobUsecase {
	return &ExportJobUsecase{repo: repo}
}

func (u *ExportJobUsecase) Create(ctx context.Context, job *ExportJob) (*ExportJob, error) {
	if err := validateExportJob(job); err != nil {
		return nil, err
	}
	job.ResourceType = strings.TrimSpace(job.ResourceType)
	job.Format = strings.ToLower(strings.TrimSpace(job.Format))
	job.ClientRequestID = strings.TrimSpace(job.ClientRequestID)
	if strings.TrimSpace(job.FilterJSON) == "" {
		job.FilterJSON = "{}"
	}
	job.Status = "queued"
	return u.repo.Create(ctx, job)
}

func (u *ExportJobUsecase) Get(ctx context.Context, enterpriseID, accountID, id uint64) (*ExportJob, error) {
	if enterpriseID == 0 || accountID == 0 || id == 0 {
		return nil, ErrExportJobInvalid
	}
	return u.repo.Get(ctx, enterpriseID, accountID, id)
}

func (u *ExportJobUsecase) List(ctx context.Context, enterpriseID, accountID uint64, opts ExportJobListOptions) ([]*ExportJob, int64, error) {
	if enterpriseID == 0 || accountID == 0 || opts.Offset < 0 || opts.Limit <= 0 {
		return nil, 0, ErrExportJobInvalid
	}
	opts.ResourceType = strings.TrimSpace(opts.ResourceType)
	opts.Format = strings.ToLower(strings.TrimSpace(opts.Format))
	opts.Status = strings.ToLower(strings.TrimSpace(opts.Status))
	if opts.ResourceType != "" && !validExportResource(opts.ResourceType) {
		return nil, 0, ErrExportJobInvalid
	}
	if opts.Format != "" && !validExportFormat(opts.Format) {
		return nil, 0, ErrExportJobInvalid
	}
	if opts.Status != "" && !validExportStatus(opts.Status) {
		return nil, 0, ErrExportJobInvalid
	}
	return u.repo.List(ctx, enterpriseID, accountID, opts)
}

func (u *ExportJobUsecase) Cancel(ctx context.Context, enterpriseID, accountID, id uint64) (*ExportJob, error) {
	if enterpriseID == 0 || accountID == 0 || id == 0 {
		return nil, ErrExportJobInvalid
	}
	return u.repo.Cancel(ctx, enterpriseID, accountID, id)
}

func validateExportJob(job *ExportJob) error {
	if job == nil || job.EnterpriseID == 0 || job.RequestedByID == 0 || strings.TrimSpace(job.ClientRequestID) == "" || len(strings.TrimSpace(job.ClientRequestID)) > 128 {
		return ErrExportJobInvalid
	}
	resourceType := strings.TrimSpace(job.ResourceType)
	format := strings.ToLower(strings.TrimSpace(job.Format))
	if !validExportResource(resourceType) || !validExportFormat(format) || !exportFormatAllowed(resourceType, format) {
		return ErrExportJobInvalid
	}
	filter := strings.TrimSpace(job.FilterJSON)
	if filter != "" && (!json.Valid([]byte(filter)) || filter[0] != '{') {
		return ErrExportJobInvalid
	}
	return nil
}

func validExportResource(resourceType string) bool {
	switch resourceType {
	case "geo_report", "articles", "publish_tasks", "geo_tasks", "geo_answers":
		return true
	default:
		return false
	}
}

func validExportFormat(format string) bool {
	switch format {
	case "csv", "xlsx", "pdf", "json":
		return true
	default:
		return false
	}
}

func exportFormatAllowed(resourceType, format string) bool {
	if resourceType == "geo_report" {
		return format == "pdf" || format == "xlsx" || format == "csv"
	}
	return format != "pdf"
}

func validExportStatus(status string) bool {
	switch status {
	case "queued", "running", "completed", "failed", "cancelled", "expired":
		return true
	default:
		return false
	}
}
