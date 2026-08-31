package service

import (
	"context"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"
)

type InclusionSiteService struct {
	v1.UnimplementedInclusionSiteServiceServer
	uc          *biz.InclusionSiteUsecase
	iconStorage *IconStorage
}

func NewInclusionSiteService(uc *biz.InclusionSiteUsecase, iconStorage *IconStorage) *InclusionSiteService {
	return &InclusionSiteService{uc: uc, iconStorage: iconStorage}
}
func (s *InclusionSiteService) CreateInclusionSite(ctx context.Context, r *v1.CreateInclusionSiteRequest) (*v1.InclusionSite, error) {
	o, e := s.uc.Create(ctx, inclusionSiteDO(r.GetInclusionSite()))
	if e != nil {
		return nil, e
	}
	return inclusionSiteDTO(o), nil
}
func (s *InclusionSiteService) GetInclusionSite(ctx context.Context, r *v1.GetInclusionSiteRequest) (*v1.InclusionSite, error) {
	o, e := s.uc.Get(ctx, r.GetId())
	if e != nil {
		return nil, e
	}
	return inclusionSiteDTO(o), nil
}
func (s *InclusionSiteService) ListInclusionSites(ctx context.Context, r *v1.ListInclusionSitesRequest) (*v1.ListInclusionSitesReply, error) {
	p, e := query.ParsePage(r.GetPageSize(), r.GetPageToken())
	if e != nil {
		return nil, biz.ErrInclusionSiteInvalid
	}
	items, total, e := s.uc.List(ctx, biz.InclusionSiteListOptions{Offset: p.Offset, Limit: p.Limit, Status: r.GetStatus(), Keyword: r.GetKeyword()})
	if e != nil {
		return nil, e
	}
	out := &v1.ListInclusionSitesReply{Items: make([]*v1.InclusionSite, 0, len(items)), TotalSize: total}
	for _, i := range items {
		out.Items = append(out.Items, inclusionSiteDTO(i))
	}
	if p.Offset+len(items) < int(total) {
		out.NextPageToken = query.NextToken(p.Offset + len(items))
	}
	return out, nil
}
func (s *InclusionSiteService) UpdateInclusionSite(ctx context.Context, r *v1.UpdateInclusionSiteRequest) (*v1.InclusionSite, error) {
	o, e := s.uc.Update(ctx, inclusionSiteDO(r.GetInclusionSite()))
	if e != nil {
		return nil, e
	}
	return inclusionSiteDTO(o), nil
}
func (s *InclusionSiteService) DeleteInclusionSite(ctx context.Context, r *v1.DeleteInclusionSiteRequest) (*emptypb.Empty, error) {
	if e := s.uc.Delete(ctx, r.GetId(), r.GetVersion()); e != nil {
		return nil, e
	}
	return &emptypb.Empty{}, nil
}
func (s *InclusionSiteService) UploadInclusionSiteIcon(ctx context.Context, r *v1.UploadInclusionSiteIconRequest) (*v1.UploadInclusionSiteIconReply, error) {
	url, err := s.iconStorage.SaveInclusionSiteIcon(ctx, r.GetFilename(), r.GetContentType(), r.GetContent())
	if err != nil {
		return nil, err
	}
	return &v1.UploadInclusionSiteIconReply{Url: url}, nil
}
func inclusionSiteDO(i *v1.InclusionSite) *biz.InclusionSite {
	if i == nil {
		return nil
	}
	return &biz.InclusionSite{ID: i.GetId(), Code: i.GetCode(), DriverType: i.GetDriverType(), Name: i.GetName(), EntryURL: i.GetEntryUrl(), Icon: i.GetIcon(), Status: i.GetStatus(), AuthorizationType: i.GetAuthorizationType(), DriverVersion: i.GetDriverVersion(), MaintenanceMessage: i.GetMaintenanceMessage(), SortOrder: i.GetSortOrder(), Version: i.GetVersion()}
}
func inclusionSiteDTO(i *biz.InclusionSite) *v1.InclusionSite {
	if i == nil {
		return nil
	}
	return &v1.InclusionSite{Id: i.ID, Code: i.Code, DriverType: i.DriverType, Name: i.Name, EntryUrl: i.EntryURL, Icon: i.Icon, Status: i.Status, AuthorizationType: i.AuthorizationType, DriverVersion: i.DriverVersion, MaintenanceMessage: i.MaintenanceMessage, SortOrder: i.SortOrder, Version: i.Version, CreatedAt: timestamppb.New(i.CreatedAt), UpdatedAt: timestamppb.New(i.UpdatedAt)}
}
