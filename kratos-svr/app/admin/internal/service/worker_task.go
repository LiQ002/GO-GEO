package service

import (
	"context"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"
)

type WorkerService struct {
	v1.UnimplementedWorkerServiceServer
	uc        *biz.WorkerAdminUsecase
	execution *biz.WorkerTaskUsecase
}

func NewWorkerService(uc *biz.WorkerAdminUsecase, execution *biz.WorkerTaskUsecase) *WorkerService {
	return &WorkerService{uc: uc, execution: execution}
}
func (s *WorkerService) RegisterWorker(ctx context.Context, req *v1.RegisterWorkerRequest) (*v1.RegisterWorkerReply, error) {
	worker, token, err := s.execution.Register(ctx, &biz.WorkerNode{
		NodeID: req.GetNodeId(), Name: req.GetName(), ClientVersion: req.GetClientVersion(),
		CapabilitiesJSON: req.GetCapabilitiesJson(), SystemInfoJSON: req.GetSystemInfoJson(),
		MaxConcurrency: req.GetMaxConcurrency(),
	})
	if err != nil {
		return nil, err
	}
	return &v1.RegisterWorkerReply{Worker: workerDTO(worker), WorkerToken: token}, nil
}
func (s *WorkerService) ListWorkers(ctx context.Context, req *v1.ListWorkersRequest) (*v1.ListWorkersReply, error) {
	p, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrWorkerInvalid
	}
	xs, total, err := s.uc.List(ctx, biz.WorkerListOptions{Offset: p.Offset, Limit: p.Limit, Status: req.GetStatus(), ApprovalStatus: req.GetApprovalStatus(), Keyword: req.GetKeyword()})
	if err != nil {
		return nil, err
	}
	out := &v1.ListWorkersReply{TotalSize: total}
	for _, v := range xs {
		out.Items = append(out.Items, workerDTO(v))
	}
	if p.Offset+len(xs) < int(total) {
		out.NextPageToken = query.NextToken(p.Offset + len(xs))
	}
	return out, nil
}
func (s *WorkerService) GetWorker(ctx context.Context, req *v1.GetWorkerRequest) (*v1.WorkerDetail, error) {
	v, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return workerDetailDTO(v), nil
}
func (s *WorkerService) ChangeWorkerStatus(ctx context.Context, req *v1.ChangeWorkerStatusRequest) (*v1.WorkerDetail, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	v, err := s.uc.ChangeStatus(ctx, biz.WorkerStatusCommand{ID: req.GetId(), Version: req.GetVersion(), OperatorID: op, Action: req.GetAction(), Reason: req.GetReason()})
	if err != nil {
		return nil, err
	}
	return workerDetailDTO(v), nil
}
func workerDTO(v *biz.WorkerNode) *v1.WorkerNode {
	return &v1.WorkerNode{Id: v.ID, NodeId: v.NodeID, Name: v.Name, Status: v.Status, ApprovalStatus: v.ApprovalStatus, ClientVersion: v.ClientVersion, DriverVersionsJson: v.DriverVersionsJSON, CapabilitiesJson: v.CapabilitiesJSON, SystemInfoJson: v.SystemInfoJSON, MaxConcurrency: v.MaxConcurrency, LastHeartbeatAt: timestampProto(v.LastHeartbeatAt), RevokedAt: timestampProto(v.RevokedAt), Version: v.Version, CreatedAt: timestamppb.New(v.CreatedAt), UpdatedAt: timestamppb.New(v.UpdatedAt)}
}
func workerDetailDTO(d *biz.WorkerDetail) *v1.WorkerDetail {
	out := &v1.WorkerDetail{Worker: workerDTO(d.Worker)}
	for _, v := range d.Heartbeats {
		out.Heartbeats = append(out.Heartbeats, &v1.WorkerHeartbeatRecord{Id: v.ID, ActiveTasks: v.ActiveTasks, MetricsJson: v.MetricsJSON, ReceivedAt: timestamppb.New(v.ReceivedAt)})
	}
	for _, v := range d.Leases {
		out.Leases = append(out.Leases, &v1.WorkerLease{Id: v.ID, TaskType: v.TaskType, TaskId: v.TaskID, Status: v.Status, LeasedAt: timestamppb.New(v.LeasedAt), ExpiresAt: timestamppb.New(v.ExpiresAt), ReleasedAt: timestampProto(v.ReleasedAt), ReleaseReason: v.ReleaseReason})
	}
	return out
}
