package service

import (
	"context"

	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/query"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type ExportJobService struct {
	v1.UnimplementedExportJobServiceServer
	usecase *biz.ExportJobUsecase
}

func NewExportJobService(usecase *biz.ExportJobUsecase) *ExportJobService {
	return &ExportJobService{usecase: usecase}
}

func (s *ExportJobService) CreateExportJob(ctx context.Context, req *v1.CreateExportJobRequest) (*v1.ExportJob, error) {
	enterpriseID, accountID, err := exportPrincipal(ctx)
	if err != nil {
		return nil, err
	}
	job, err := s.usecase.Create(ctx, &biz.ExportJob{
		EnterpriseID: enterpriseID, RequestedByID: accountID, ResourceType: req.GetResourceType(),
		Format: req.GetFormat(), FilterJSON: req.GetFilterJson(), ClientRequestID: req.GetClientRequestId(),
	})
	if err != nil {
		return nil, err
	}
	return exportJobDTO(job), nil
}

func (s *ExportJobService) GetExportJob(ctx context.Context, req *v1.GetExportJobRequest) (*v1.ExportJob, error) {
	enterpriseID, accountID, err := exportPrincipal(ctx)
	if err != nil {
		return nil, err
	}
	job, err := s.usecase.Get(ctx, enterpriseID, accountID, req.GetId())
	if err != nil {
		return nil, err
	}
	return exportJobDTO(job), nil
}

func (s *ExportJobService) ListExportJobs(ctx context.Context, req *v1.ListExportJobsRequest) (*v1.ListExportJobsReply, error) {
	enterpriseID, accountID, err := exportPrincipal(ctx)
	if err != nil {
		return nil, err
	}
	page, err := parseUserPage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrExportJobInvalid
	}
	items, total, err := s.usecase.List(ctx, enterpriseID, accountID, biz.ExportJobListOptions{
		Offset: page.Offset, Limit: page.Limit, ResourceType: req.GetResourceType(), Format: req.GetFormat(), Status: req.GetStatus(),
	})
	if err != nil {
		return nil, err
	}
	reply := &v1.ListExportJobsReply{Items: make([]*v1.ExportJob, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, exportJobDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *ExportJobService) CancelExportJob(ctx context.Context, req *v1.CancelExportJobRequest) (*v1.ExportJob, error) {
	enterpriseID, accountID, err := exportPrincipal(ctx)
	if err != nil {
		return nil, err
	}
	job, err := s.usecase.Cancel(ctx, enterpriseID, accountID, req.GetId())
	if err != nil {
		return nil, err
	}
	return exportJobDTO(job), nil
}

func exportPrincipal(ctx context.Context) (uint64, uint64, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return 0, 0, err
	}
	principal, ok := authn.PrincipalFromContext(ctx)
	if !ok || principal.SubjectID == 0 {
		return 0, 0, biz.ErrExportJobInvalid
	}
	return enterpriseID, principal.SubjectID, nil
}

func exportJobDTO(job *biz.ExportJob) *v1.ExportJob {
	if job == nil {
		return nil
	}
	dto := &v1.ExportJob{
		Id: job.ID, ResourceType: job.ResourceType, Format: job.Format, FilterJson: job.FilterJSON,
		Status: job.Status, ClientRequestId: job.ClientRequestID,
		DownloadReady: job.Status == "completed" && job.ObjectKey != "", FileHash: job.FileHash,
		ErrorMessage: job.ErrorMessage, CreatedAt: timestamppb.New(job.CreatedAt), UpdatedAt: timestamppb.New(job.UpdatedAt),
	}
	if job.ExpiresAt != nil {
		dto.ExpiresAt = timestamppb.New(*job.ExpiresAt)
	}
	if job.CompletedAt != nil {
		dto.CompletedAt = timestamppb.New(*job.CompletedAt)
	}
	if job.CancelledAt != nil {
		dto.CancelledAt = timestamppb.New(*job.CancelledAt)
	}
	return dto
}
