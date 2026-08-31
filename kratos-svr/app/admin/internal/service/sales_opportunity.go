package service

import (
	"context"

	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type SalesOpportunityService struct {
	v1.UnimplementedSalesOpportunityServiceServer
	uc         *biz.SalesOpportunityUsecase
	authorizer *biz.AdminAuthorizationUsecase
}

func NewSalesOpportunityService(uc *biz.SalesOpportunityUsecase, authorizer *biz.AdminAuthorizationUsecase) *SalesOpportunityService {
	return &SalesOpportunityService{uc: uc, authorizer: authorizer}
}

func (s *SalesOpportunityService) CreateSalesOpportunity(ctx context.Context, req *v1.CreateSalesOpportunityRequest) (*v1.SalesOpportunity, error) {
	access, err := s.access(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.Create(ctx, salesOpportunityDO(req.GetOpportunity()), access)
	if err != nil {
		return nil, err
	}
	return salesOpportunityDTO(item), nil
}

func (s *SalesOpportunityService) GetSalesOpportunity(ctx context.Context, req *v1.GetSalesOpportunityRequest) (*v1.SalesOpportunity, error) {
	access, err := s.access(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.Get(ctx, req.GetId(), access)
	if err != nil {
		return nil, err
	}
	return salesOpportunityDTO(item), nil
}

func (s *SalesOpportunityService) ListSalesOpportunities(ctx context.Context, req *v1.ListSalesOpportunitiesRequest) (*v1.ListSalesOpportunitiesReply, error) {
	page, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrSalesOpportunityInvalid
	}
	access, err := s.access(ctx)
	if err != nil {
		return nil, err
	}
	var ownerID *uint64
	if req.OwnerAdminId != nil {
		value := req.GetOwnerAdminId()
		ownerID = &value
	}
	items, total, err := s.uc.List(ctx, biz.SalesOpportunityListOptions{
		Offset: page.Offset, Limit: page.Limit, Keyword: req.GetKeyword(), Status: int32(req.GetStatus()), OwnerAdminID: ownerID,
	}, access)
	if err != nil {
		return nil, err
	}
	reply := &v1.ListSalesOpportunitiesReply{Items: make([]*v1.SalesOpportunity, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, salesOpportunityDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *SalesOpportunityService) UpdateSalesOpportunity(ctx context.Context, req *v1.UpdateSalesOpportunityRequest) (*v1.SalesOpportunity, error) {
	access, err := s.access(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.Update(ctx, salesOpportunityDO(req.GetOpportunity()), access)
	if err != nil {
		return nil, err
	}
	return salesOpportunityDTO(item), nil
}

func (s *SalesOpportunityService) ChangeSalesOpportunityStatus(ctx context.Context, req *v1.ChangeSalesOpportunityStatusRequest) (*v1.SalesOpportunity, error) {
	access, err := s.access(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.ChangeStatus(ctx, biz.SalesOpportunityStatusCommand{
		ID: req.GetId(), Version: req.GetVersion(), Status: int32(req.GetStatus()), Reason: req.GetReason(),
		OperatorID: access.AdminUserID, Access: access,
	})
	if err != nil {
		return nil, err
	}
	return salesOpportunityDTO(item), nil
}

func (s *SalesOpportunityService) CheckSalesOpportunityDuplicate(ctx context.Context, req *v1.CheckSalesOpportunityDuplicateRequest) (*v1.CheckSalesOpportunityDuplicateReply, error) {
	access, err := s.access(ctx)
	if err != nil {
		return nil, err
	}
	var excludeID *uint64
	if req.ExcludeId != nil {
		value := req.GetExcludeId()
		excludeID = &value
	}
	duplicated, matches, err := s.uc.CheckDuplicate(ctx, biz.SalesOpportunityDuplicateOptions{
		CustomerName: req.GetCustomerName(), Website: req.GetWebsite(), ExcludeID: excludeID, Access: access,
	})
	if err != nil {
		return nil, err
	}
	reply := &v1.CheckSalesOpportunityDuplicateReply{Duplicated: duplicated, Matches: make([]*v1.SalesOpportunity, 0, len(matches))}
	for _, item := range matches {
		reply.Matches = append(reply.Matches, salesOpportunityDTO(item))
	}
	return reply, nil
}

func (s *SalesOpportunityService) ListSalesOpportunityOwners(ctx context.Context, req *v1.ListSalesOpportunityOwnersRequest) (*v1.ListSalesOpportunityOwnersReply, error) {
	access, err := s.access(ctx)
	if err != nil {
		return nil, err
	}
	items, canAssignOthers, err := s.uc.ListOwners(ctx, req.GetKeyword(), access)
	if err != nil {
		return nil, err
	}
	reply := &v1.ListSalesOpportunityOwnersReply{Items: make([]*v1.SalesOpportunityOwner, 0, len(items)), CanAssignOthers: canAssignOthers}
	for _, item := range items {
		reply.Items = append(reply.Items, &v1.SalesOpportunityOwner{
			Id: item.ID, Username: item.Username, DisplayName: item.DisplayName, Email: item.Email,
		})
	}
	return reply, nil
}

func (s *SalesOpportunityService) access(ctx context.Context) (biz.SalesOpportunityAccess, error) {
	operatorID, err := adminOperatorID(ctx)
	if err != nil {
		return biz.SalesOpportunityAccess{}, err
	}
	scope, err := s.authorizer.DataScope(ctx, operatorID)
	if err != nil {
		return biz.SalesOpportunityAccess{}, err
	}
	return biz.SalesOpportunityAccess{AdminUserID: operatorID, DataScope: scope}, nil
}

func salesOpportunityDO(item *v1.SalesOpportunity) *biz.SalesOpportunity {
	if item == nil {
		return nil
	}
	out := &biz.SalesOpportunity{
		ID: item.GetId(), Code: item.GetCode(), Name: item.GetName(), OwnerAdminID: item.GetOwnerAdminId(),
		CustomerName: item.GetCustomerName(), Website: item.GetWebsite(), Industry: item.GetIndustry(), Region: item.GetRegion(),
		ContactName: item.GetContactName(), ContactPhone: item.GetContactPhone(), ContactEmail: item.GetContactEmail(),
		BrandName: item.GetBrandName(), TargetAudience: item.GetTargetAudience(), CoreValue: item.GetCoreValue(),
		CurrentContent: item.GetCurrentContent(), PainPoints: item.GetPainPoints(), ExpectedGoals: item.GetExpectedGoals(),
		BudgetMinMinorUnits: item.GetBudgetMinMinorUnits(), BudgetMaxMinorUnits: item.GetBudgetMaxMinorUnits(),
		Currency: item.GetCurrency(), Status: int32(item.GetStatus()), Remark: item.GetRemark(), Version: item.GetVersion(),
		BrandAliases: make([]*biz.SalesOpportunityBrandAlias, 0, len(item.GetBrandAliases())),
		Products:     make([]*biz.SalesOpportunityProduct, 0, len(item.GetProducts())),
		Competitors:  make([]*biz.SalesOpportunityCompetitor, 0, len(item.GetCompetitors())),
	}
	for _, alias := range item.GetBrandAliases() {
		out.BrandAliases = append(out.BrandAliases, &biz.SalesOpportunityBrandAlias{ID: alias.GetId(), Alias: alias.GetAlias(), SortOrder: alias.GetSortOrder()})
	}
	for _, product := range item.GetProducts() {
		out.Products = append(out.Products, &biz.SalesOpportunityProduct{
			ID: product.GetId(), Name: product.GetName(), Description: product.GetDescription(),
			SellingPoints: product.GetSellingPoints(), TargetAudience: product.GetTargetAudience(), SortOrder: product.GetSortOrder(),
		})
	}
	for _, competitor := range item.GetCompetitors() {
		out.Competitors = append(out.Competitors, &biz.SalesOpportunityCompetitor{
			ID: competitor.GetId(), Name: competitor.GetName(), Website: competitor.GetWebsite(),
			Description: competitor.GetDescription(), SortOrder: competitor.GetSortOrder(),
		})
	}
	return out
}

func salesOpportunityDTO(item *biz.SalesOpportunity) *v1.SalesOpportunity {
	if item == nil {
		return nil
	}
	out := &v1.SalesOpportunity{
		Id: item.ID, Code: item.Code, Name: item.Name, OwnerAdminId: item.OwnerAdminID, OwnerDisplayName: item.OwnerDisplayName,
		CustomerName: item.CustomerName, Website: item.Website, Industry: item.Industry, Region: item.Region,
		ContactName: item.ContactName, ContactPhone: item.ContactPhone, ContactEmail: item.ContactEmail,
		BrandName: item.BrandName, TargetAudience: item.TargetAudience, CoreValue: item.CoreValue,
		CurrentContent: item.CurrentContent, PainPoints: item.PainPoints, ExpectedGoals: item.ExpectedGoals,
		BudgetMinMinorUnits: item.BudgetMinMinorUnits, BudgetMaxMinorUnits: item.BudgetMaxMinorUnits,
		Currency: item.Currency, Status: v1.SalesOpportunityStatus(item.Status), Remark: item.Remark,
		Version: item.Version, ClosedAt: timestampProto(item.ClosedAt), CreatedAt: timestamppb.New(item.CreatedAt), UpdatedAt: timestamppb.New(item.UpdatedAt),
		BrandAliases: make([]*v1.SalesOpportunityBrandAlias, 0, len(item.BrandAliases)),
		Products:     make([]*v1.SalesOpportunityProduct, 0, len(item.Products)),
		Competitors:  make([]*v1.SalesOpportunityCompetitor, 0, len(item.Competitors)),
	}
	for _, alias := range item.BrandAliases {
		out.BrandAliases = append(out.BrandAliases, &v1.SalesOpportunityBrandAlias{Id: alias.ID, Alias: alias.Alias, SortOrder: alias.SortOrder})
	}
	for _, product := range item.Products {
		out.Products = append(out.Products, &v1.SalesOpportunityProduct{
			Id: product.ID, Name: product.Name, Description: product.Description,
			SellingPoints: product.SellingPoints, TargetAudience: product.TargetAudience, SortOrder: product.SortOrder,
		})
	}
	for _, competitor := range item.Competitors {
		out.Competitors = append(out.Competitors, &v1.SalesOpportunityCompetitor{
			Id: competitor.ID, Name: competitor.Name, Website: competitor.Website,
			Description: competitor.Description, SortOrder: competitor.SortOrder,
		})
	}
	return out
}
