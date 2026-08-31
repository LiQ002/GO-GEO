package service

import (
	"context"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"
)

type AuditLogService struct {
	v1.UnimplementedAuditLogServiceServer
	uc *biz.AdminAuditLogUsecase
}

func NewAuditLogService(uc *biz.AdminAuditLogUsecase) *AuditLogService {
	return &AuditLogService{uc: uc}
}
func (s *AuditLogService) ListAuditLogs(ctx context.Context, req *v1.ListAuditLogsRequest) (*v1.ListAuditLogsReply, error) {
	p, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrAuditLogNotFound
	}
	o := biz.AdminAuditLogListOptions{Offset: p.Offset, Limit: p.Limit, EnterpriseID: req.EnterpriseId, ActorType: req.GetActorType(), ActorID: req.GetActorId(), Action: req.GetAction(), ResourceType: req.GetResourceType(), Result: req.GetResult(), RequestID: req.GetRequestId(), StartedAt: timestampPointer(req.GetStartedAt()), EndedAt: timestampPointer(req.GetEndedAt())}
	xs, total, err := s.uc.List(ctx, o)
	if err != nil {
		return nil, err
	}
	out := &v1.ListAuditLogsReply{TotalSize: total}
	for _, v := range xs {
		out.Items = append(out.Items, auditDTO(v))
	}
	if p.Offset+len(xs) < int(total) {
		out.NextPageToken = query.NextToken(p.Offset + len(xs))
	}
	return out, nil
}
func (s *AuditLogService) GetAuditLog(ctx context.Context, req *v1.GetAuditLogRequest) (*v1.AuditLog, error) {
	v, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return auditDTO(v), nil
}
func auditDTO(v *biz.AdminAuditLog) *v1.AuditLog {
	return &v1.AuditLog{Id: v.ID, EnterpriseId: v.EnterpriseID, EnterpriseName: v.EnterpriseName, ActorType: v.ActorType, ActorId: v.ActorID, ActorName: v.ActorName, Audience: v.Audience, Action: v.Action, ResourceType: v.ResourceType, ResourceId: v.ResourceID, Result: v.Result, Reason: v.Reason, BeforeJson: v.BeforeJSON, AfterJson: v.AfterJSON, IpAddress: v.IPAddress, UserAgent: v.UserAgent, RequestId: v.RequestID, TraceId: v.TraceID, CreatedAt: timestamppb.New(v.CreatedAt)}
}
