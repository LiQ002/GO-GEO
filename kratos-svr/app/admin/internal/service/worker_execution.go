package service

import (
	"context"

	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
)

type WorkerExecutionService struct {
	v1.UnimplementedWorkerExecutionServiceServer
	uc *biz.WorkerTaskUsecase
}

func NewWorkerExecutionService(uc *biz.WorkerTaskUsecase) *WorkerExecutionService {
	return &WorkerExecutionService{uc: uc}
}

func (s *WorkerExecutionService) Heartbeat(ctx context.Context, req *v1.WorkerHeartbeatRequest) (*v1.WorkerHeartbeatReply, error) {
	worker, err := s.uc.Heartbeat(ctx, req.GetWorkerToken(), req.GetClientVersion(), req.GetCapabilitiesJson(), req.GetSystemInfoJson(), req.GetActiveTasks())
	if err != nil {
		return nil, err
	}
	return &v1.WorkerHeartbeatReply{Accepted: true, Revoked: worker.Status == "revoked"}, nil
}

func (s *WorkerExecutionService) ClaimTask(ctx context.Context, req *v1.ClaimTaskRequest) (*v1.ClaimTaskReply, error) {
	lease, err := s.uc.Claim(ctx, req.GetWorkerToken(), biz.TaskClaimFilter{
		TaskID: req.GetTaskId(), TaskTypes: req.GetTaskTypes(), PublishChannelIDs: req.GetPublishChannelIds(), InclusionSiteIDs: req.GetInclusionSiteIds(),
	})
	if err != nil {
		return nil, err
	}
	return &v1.ClaimTaskReply{Lease: taskLeaseDTO(lease)}, nil
}

func (s *WorkerExecutionService) RenewLease(ctx context.Context, req *v1.RenewLeaseRequest) (*v1.TaskLease, error) {
	lease, err := s.uc.Renew(ctx, req.GetLeaseId(), req.GetLeaseVersion(), req.GetLeaseToken())
	if err != nil {
		return nil, err
	}
	return taskLeaseDTO(lease), nil
}

func (s *WorkerExecutionService) ReleaseLease(ctx context.Context, req *v1.ReleaseLeaseRequest) (*emptypb.Empty, error) {
	if err := s.uc.Release(ctx, req.GetLeaseId(), req.GetLeaseToken(), req.GetReason()); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *WorkerExecutionService) ReportTaskResult(ctx context.Context, req *v1.ReportTaskResultRequest) (*emptypb.Empty, error) {
	err := s.uc.Report(ctx, &biz.TaskResult{
		TaskType: req.GetTaskType(), TaskID: req.GetTaskId(), LeaseID: req.GetLeaseId(), LeaseToken: req.GetLeaseToken(),
		IdempotencyKey: req.GetIdempotencyKey(), Status: req.GetStatus(), ResultJSON: req.GetResultJson(), EvidenceJSON: req.GetEvidenceJson(),
		ErrorCategory: req.GetErrorCategory(), ErrorCode: req.GetErrorCode(), ErrorMessage: req.GetErrorMessage(),
		DurationMS: req.GetDurationMs(), ClientVersion: req.GetClientVersion(),
	})
	if err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func taskLeaseDTO(lease *biz.TaskLease) *v1.TaskLease {
	if lease == nil {
		return nil
	}
	return &v1.TaskLease{
		Id: lease.ID, TaskType: lease.TaskType, TaskId: lease.TaskID, LeaseToken: lease.LeaseToken,
		ExpiresAt: timestamppb.New(lease.ExpiresAt), LeaseVersion: lease.LeaseVersion,
		TaskSnapshotJson: lease.TaskSnapshotJSON, CredentialPayload: append([]byte(nil), lease.CredentialPayload...),
	}
}
