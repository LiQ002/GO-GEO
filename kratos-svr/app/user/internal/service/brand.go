package service

import (
	"context"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/query"
)

type BrandService struct {
	v1.UnimplementedBrandServiceServer
	uc *biz.BrandUsecase
}

func NewBrandService(u *biz.BrandUsecase) *BrandService { return &BrandService{uc: u} }
func (s *BrandService) CreateBrand(c context.Context, r *v1.CreateBrandRequest) (*v1.Brand, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	i := brandDO(r.GetBrand())
	if i != nil {
		i.EnterpriseID = e
	}
	o, x := s.uc.Create(c, i)
	if x != nil {
		return nil, x
	}
	return brandDTO(o), nil
}
func (s *BrandService) GetBrand(c context.Context, r *v1.GetBrandRequest) (*v1.Brand, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.Get(c, e, r.GetId())
	if x != nil {
		return nil, x
	}
	return brandDTO(o), nil
}
func (s *BrandService) ListBrands(c context.Context, r *v1.ListBrandsRequest) (*v1.ListBrandsReply, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	p, x := parseUserPage(r.GetPageSize(), r.GetPageToken())
	if x != nil {
		return nil, biz.ErrBrandInvalid
	}
	items, total, x := s.uc.List(c, e, biz.BrandListOptions{Offset: p.Offset, Limit: p.Limit, Status: r.GetStatus(), Keyword: r.GetKeyword()})
	if x != nil {
		return nil, x
	}
	o := &v1.ListBrandsReply{Items: make([]*v1.Brand, 0, len(items)), TotalSize: total}
	for _, i := range items {
		o.Items = append(o.Items, brandDTO(i))
	}
	if p.Offset+len(items) < int(total) {
		o.NextPageToken = query.NextToken(p.Offset + len(items))
	}
	return o, nil
}
func (s *BrandService) UpdateBrand(c context.Context, r *v1.UpdateBrandRequest) (*v1.Brand, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	i := brandDO(r.GetBrand())
	if i != nil {
		i.EnterpriseID = e
	}
	o, x := s.uc.Update(c, i)
	if x != nil {
		return nil, x
	}
	return brandDTO(o), nil
}
func (s *BrandService) DeleteBrand(c context.Context, r *v1.DeleteBrandRequest) (*emptypb.Empty, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	if x = s.uc.Delete(c, e, r.GetId(), r.GetVersion()); x != nil {
		return nil, x
	}
	return &emptypb.Empty{}, nil
}
func brandDO(i *v1.Brand) *biz.Brand {
	if i == nil {
		return nil
	}
	return &biz.Brand{ID: i.GetId(), Name: i.GetName(), AliasesJSON: i.GetAliasesJson(), OfficialDomain: i.GetOfficialDomain(), Description: i.GetDescription(), Industry: i.GetIndustry(), Region: i.GetRegion(), TargetAudience: i.GetTargetAudience(), CoreValue: i.GetCoreValue(), Status: i.GetStatus(), Version: i.GetVersion()}
}
func brandDTO(i *biz.Brand) *v1.Brand {
	if i == nil {
		return nil
	}
	return &v1.Brand{Id: i.ID, Name: i.Name, AliasesJson: i.AliasesJSON, OfficialDomain: i.OfficialDomain, Description: i.Description, Industry: i.Industry, Region: i.Region, TargetAudience: i.TargetAudience, CoreValue: i.CoreValue, Status: i.Status, Version: i.Version, CreatedAt: timestamppb.New(i.CreatedAt), UpdatedAt: timestamppb.New(i.UpdatedAt)}
}
