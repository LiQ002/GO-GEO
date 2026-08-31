package service

import (
	"context"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"
)

type SystemSettingService struct {
	v1.UnimplementedSystemSettingServiceServer
	uc *biz.SystemSettingUsecase
}

func NewSystemSettingService(uc *biz.SystemSettingUsecase) *SystemSettingService {
	return &SystemSettingService{uc: uc}
}
func (s *SystemSettingService) CreateSystemSetting(ctx context.Context, req *v1.CreateSystemSettingRequest) (*v1.SystemSetting, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	v, err := s.uc.Create(ctx, biz.SystemSettingCommand{Setting: settingDO(req.GetSetting()), OperatorID: op, Reason: req.GetReason()})
	if err != nil {
		return nil, err
	}
	return settingDTO(v), nil
}
func (s *SystemSettingService) GetSystemSetting(ctx context.Context, req *v1.GetSystemSettingRequest) (*v1.SystemSetting, error) {
	v, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return settingDTO(v), nil
}
func (s *SystemSettingService) ListSystemSettings(ctx context.Context, req *v1.ListSystemSettingsRequest) (*v1.ListSystemSettingsReply, error) {
	p, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrSystemSettingInvalid
	}
	xs, total, err := s.uc.List(ctx, biz.SystemSettingListOptions{Offset: p.Offset, Limit: p.Limit, Namespace: req.GetNamespace(), Keyword: req.GetKeyword()})
	if err != nil {
		return nil, err
	}
	out := &v1.ListSystemSettingsReply{TotalSize: total}
	for _, v := range xs {
		out.Items = append(out.Items, settingDTO(v))
	}
	if p.Offset+len(xs) < int(total) {
		out.NextPageToken = query.NextToken(p.Offset + len(xs))
	}
	return out, nil
}
func (s *SystemSettingService) UpdateSystemSetting(ctx context.Context, req *v1.UpdateSystemSettingRequest) (*v1.SystemSetting, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	v, err := s.uc.Update(ctx, biz.SystemSettingCommand{Setting: settingDO(req.GetSetting()), OperatorID: op, Reason: req.GetReason()})
	if err != nil {
		return nil, err
	}
	return settingDTO(v), nil
}
func (s *SystemSettingService) DeleteSystemSetting(ctx context.Context, req *v1.DeleteSystemSettingRequest) (*emptypb.Empty, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.uc.Delete(ctx, biz.DeleteSystemSettingCommand{ID: req.GetId(), Version: req.GetVersion(), OperatorID: op, Reason: req.GetReason()}); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}
func settingDO(v *v1.SystemSetting) *biz.SystemSetting {
	if v == nil {
		return nil
	}
	return &biz.SystemSetting{ID: v.GetId(), Namespace: v.GetNamespace(), Key: v.GetKey(), ValueJSON: v.GetValueJson(), Description: v.GetDescription(), Sensitive: v.GetSensitive(), Version: v.GetVersion()}
}
func settingDTO(v *biz.SystemSetting) *v1.SystemSetting {
	return &v1.SystemSetting{Id: v.ID, Namespace: v.Namespace, Key: v.Key, ValueJson: v.ValueJSON, Description: v.Description, Sensitive: v.Sensitive, Version: v.Version, CreatedAt: timestamppb.New(v.CreatedAt), UpdatedAt: timestamppb.New(v.UpdatedAt)}
}
