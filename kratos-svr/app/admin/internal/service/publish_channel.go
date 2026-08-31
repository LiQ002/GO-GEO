package service

import (
	"context"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"
)

type PublishChannelService struct {
	v1.UnimplementedPublishChannelServiceServer
	uc          *biz.PublishChannelUsecase
	iconStorage *IconStorage
}

func NewPublishChannelService(uc *biz.PublishChannelUsecase, iconStorage *IconStorage) *PublishChannelService {
	return &PublishChannelService{uc: uc, iconStorage: iconStorage}
}
func (s *PublishChannelService) CreatePublishChannel(ctx context.Context, r *v1.CreatePublishChannelRequest) (*v1.PublishChannel, error) {
	o, e := s.uc.Create(ctx, publishChannelDO(r.GetPublishChannel()))
	if e != nil {
		return nil, e
	}
	return publishChannelDTO(o), nil
}
func (s *PublishChannelService) GetPublishChannel(ctx context.Context, r *v1.GetPublishChannelRequest) (*v1.PublishChannel, error) {
	o, e := s.uc.Get(ctx, r.GetId())
	if e != nil {
		return nil, e
	}
	return publishChannelDTO(o), nil
}
func (s *PublishChannelService) ListPublishChannels(ctx context.Context, r *v1.ListPublishChannelsRequest) (*v1.ListPublishChannelsReply, error) {
	p, e := query.ParsePage(r.GetPageSize(), r.GetPageToken())
	if e != nil {
		return nil, biz.ErrPublishChannelInvalid
	}
	items, total, e := s.uc.List(ctx, biz.PublishChannelListOptions{Offset: p.Offset, Limit: p.Limit, Category: r.GetCategory(), Status: r.GetStatus(), Keyword: r.GetKeyword()})
	if e != nil {
		return nil, e
	}
	out := &v1.ListPublishChannelsReply{Items: make([]*v1.PublishChannel, 0, len(items)), TotalSize: total}
	for _, i := range items {
		out.Items = append(out.Items, publishChannelDTO(i))
	}
	if p.Offset+len(items) < int(total) {
		out.NextPageToken = query.NextToken(p.Offset + len(items))
	}
	return out, nil
}
func (s *PublishChannelService) UpdatePublishChannel(ctx context.Context, r *v1.UpdatePublishChannelRequest) (*v1.PublishChannel, error) {
	o, e := s.uc.Update(ctx, publishChannelDO(r.GetPublishChannel()))
	if e != nil {
		return nil, e
	}
	return publishChannelDTO(o), nil
}
func (s *PublishChannelService) DeletePublishChannel(ctx context.Context, r *v1.DeletePublishChannelRequest) (*emptypb.Empty, error) {
	if e := s.uc.Delete(ctx, r.GetId(), r.GetVersion()); e != nil {
		return nil, e
	}
	return &emptypb.Empty{}, nil
}
func (s *PublishChannelService) UploadPublishChannelIcon(ctx context.Context, r *v1.UploadPublishChannelIconRequest) (*v1.UploadPublishChannelIconReply, error) {
	url, err := s.iconStorage.SavePublishChannelIcon(ctx, r.GetFilename(), r.GetContentType(), r.GetContent())
	if err != nil {
		return nil, err
	}
	return &v1.UploadPublishChannelIconReply{Url: url}, nil
}
func (s *PublishChannelService) CreatePublishTarget(ctx context.Context, r *v1.CreatePublishTargetRequest) (*v1.PublishTarget, error) {
	i := publishTargetDO(r.GetTarget())
	if i != nil {
		i.PublishChannelID = r.GetPublishChannelId()
	}
	o, e := s.uc.CreateTarget(ctx, i)
	if e != nil {
		return nil, e
	}
	return publishTargetDTO(o), nil
}
func (s *PublishChannelService) ListPublishTargets(ctx context.Context, r *v1.ListPublishTargetsRequest) (*v1.ListPublishTargetsReply, error) {
	items, e := s.uc.ListTargets(ctx, biz.PublishTargetListOptions{PublishChannelID: r.GetPublishChannelId(), TargetType: r.GetTargetType(), Status: r.GetStatus()})
	if e != nil {
		return nil, e
	}
	out := &v1.ListPublishTargetsReply{Items: make([]*v1.PublishTarget, 0, len(items))}
	for _, i := range items {
		out.Items = append(out.Items, publishTargetDTO(i))
	}
	return out, nil
}
func (s *PublishChannelService) UpdatePublishTarget(ctx context.Context, r *v1.UpdatePublishTargetRequest) (*v1.PublishTarget, error) {
	i := publishTargetDO(r.GetTarget())
	if i != nil {
		i.PublishChannelID = r.GetPublishChannelId()
	}
	o, e := s.uc.UpdateTarget(ctx, i)
	if e != nil {
		return nil, e
	}
	return publishTargetDTO(o), nil
}
func (s *PublishChannelService) DeletePublishTarget(ctx context.Context, r *v1.DeletePublishTargetRequest) (*emptypb.Empty, error) {
	if e := s.uc.DeleteTarget(ctx, r.GetPublishChannelId(), r.GetTargetId(), r.GetVersion()); e != nil {
		return nil, e
	}
	return &emptypb.Empty{}, nil
}
func publishChannelDO(i *v1.PublishChannel) *biz.PublishChannel {
	if i == nil {
		return nil
	}
	return &biz.PublishChannel{ID: i.GetId(), Code: i.GetCode(), DriverType: i.GetDriverType(), LoginURL: i.GetLoginUrl(), Name: i.GetName(), Category: i.GetCategory(), Icon: i.GetIcon(), Description: i.GetDescription(), Status: i.GetStatus(), AuthorizationType: i.GetAuthorizationType(), ExecutionMode: i.GetExecutionMode(), DriverVersion: i.GetDriverVersion(), SortOrder: i.GetSortOrder(), Version: i.GetVersion()}
}
func publishChannelDTO(i *biz.PublishChannel) *v1.PublishChannel {
	if i == nil {
		return nil
	}
	return &v1.PublishChannel{Id: i.ID, Code: i.Code, DriverType: i.DriverType, LoginUrl: i.LoginURL, Name: i.Name, Category: i.Category, Icon: i.Icon, Description: i.Description, Status: i.Status, AuthorizationType: i.AuthorizationType, ExecutionMode: i.ExecutionMode, DriverVersion: i.DriverVersion, SortOrder: i.SortOrder, Version: i.Version, CreatedAt: timestamppb.New(i.CreatedAt), UpdatedAt: timestamppb.New(i.UpdatedAt)}
}
func publishTargetDO(i *v1.PublishTarget) *biz.PublishTarget {
	if i == nil {
		return nil
	}
	return &biz.PublishTarget{ID: i.GetId(), PublishChannelID: i.GetPublishChannelId(), Name: i.GetName(), TargetType: i.GetTargetType(), Platform: i.GetPlatform(), EntryURL: i.GetEntryUrl(), SubmissionEmail: i.GetSubmissionEmail(), Region: i.GetRegion(), Industry: i.GetIndustry(), CooperationJSON: i.GetCooperationJson(), RequirementsJSON: i.GetRequirementsJson(), Status: i.GetStatus(), SortOrder: i.GetSortOrder(), Version: i.GetVersion()}
}
func publishTargetDTO(i *biz.PublishTarget) *v1.PublishTarget {
	if i == nil {
		return nil
	}
	return &v1.PublishTarget{Id: i.ID, PublishChannelId: i.PublishChannelID, Name: i.Name, TargetType: i.TargetType, Platform: i.Platform, EntryUrl: i.EntryURL, SubmissionEmail: i.SubmissionEmail, Region: i.Region, Industry: i.Industry, CooperationJson: i.CooperationJSON, RequirementsJson: i.RequirementsJSON, Status: i.Status, SortOrder: i.SortOrder, Version: i.Version, CreatedAt: timestamppb.New(i.CreatedAt), UpdatedAt: timestamppb.New(i.UpdatedAt)}
}
