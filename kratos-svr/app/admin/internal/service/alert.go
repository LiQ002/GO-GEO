package service

import (
	"context"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"
)

type AlertService struct {
	v1.UnimplementedAlertServiceServer
	uc *biz.AdminAlertUsecase
}

func NewAlertService(uc *biz.AdminAlertUsecase) *AlertService { return &AlertService{uc: uc} }
func (s *AlertService) ListAlerts(ctx context.Context, req *v1.ListAlertsRequest) (*v1.ListAlertsReply, error) {
	p, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrAlertInvalid
	}
	xs, total, err := s.uc.List(ctx, biz.AdminAlertListOptions{Offset: p.Offset, Limit: p.Limit, EnterpriseID: req.EnterpriseId, Severity: req.GetSeverity(), Status: req.GetStatus(), AlertType: req.GetAlertType(), Keyword: req.GetKeyword()})
	if err != nil {
		return nil, err
	}
	out := &v1.ListAlertsReply{TotalSize: total}
	for _, v := range xs {
		out.Items = append(out.Items, alertDTO(v))
	}
	if p.Offset+len(xs) < int(total) {
		out.NextPageToken = query.NextToken(p.Offset + len(xs))
	}
	return out, nil
}
func (s *AlertService) GetAlert(ctx context.Context, req *v1.GetAlertRequest) (*v1.Alert, error) {
	v, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return alertDTO(v), nil
}
func (s *AlertService) ResolveAlert(ctx context.Context, req *v1.ResolveAlertRequest) (*v1.Alert, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	v, err := s.uc.Resolve(ctx, biz.ResolveAlertCommand{ID: req.GetId(), OperatorID: op, Reason: req.GetReason()})
	if err != nil {
		return nil, err
	}
	return alertDTO(v), nil
}
func alertDTO(v *biz.AdminAlert) *v1.Alert {
	return &v1.Alert{Id: v.ID, EnterpriseId: v.EnterpriseID, EnterpriseName: v.EnterpriseName, AlertType: v.AlertType, Severity: v.Severity, Status: v.Status, Title: v.Title, Description: v.Description, ResourceType: v.ResourceType, ResourceId: v.ResourceID, DetailsJson: v.DetailsJSON, ResolvedAt: timestampProto(v.ResolvedAt), ResolvedBy: v.ResolvedBy, CreatedAt: timestamppb.New(v.CreatedAt), UpdatedAt: timestamppb.New(v.UpdatedAt)}
}
