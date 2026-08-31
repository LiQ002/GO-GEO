package service

import (
	"context"

	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type CustomerAuthorizationService struct {
	v1.UnimplementedCustomerAuthorizationServiceServer
	v1.UnimplementedSelfMediaAuthorizationServiceServer
	v1.UnimplementedInclusionSiteAuthorizationServiceServer
	uc *biz.CustomerAuthorizationUsecase
}

func NewCustomerAuthorizationService(uc *biz.CustomerAuthorizationUsecase) *CustomerAuthorizationService {
	return &CustomerAuthorizationService{uc: uc}
}

func (s *CustomerAuthorizationService) GetCustomerAuthorization(ctx context.Context, req *v1.GetCustomerAuthorizationRequest) (*v1.CustomerAuthorization, error) {
	item, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return customerAuthorizationDTO(item), nil
}

func (s *CustomerAuthorizationService) ListCustomerAuthorizations(ctx context.Context, req *v1.ListCustomerAuthorizationsRequest) (*v1.ListCustomerAuthorizationsReply, error) {
	page, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrCustomerAuthorizationInvalid
	}
	resourceType, resourceID := req.GetResourceType(), req.GetResourceId()
	if resourceID == 0 && req.GetPublishChannelId() != 0 {
		resourceType, resourceID = "publish_channel", req.GetPublishChannelId()
	}
	items, total, err := s.uc.List(ctx, biz.CustomerAuthorizationListOptions{
		Offset: page.Offset, Limit: page.Limit,
		EnterpriseID: req.GetEnterpriseId(), ResourceType: resourceType, ResourceID: resourceID,
		AuthorizationStatus: req.GetAuthorizationStatus(), UsageStatus: req.GetUsageStatus(),
		Keyword: req.GetKeyword(),
	})
	if err != nil {
		return nil, err
	}
	reply := &v1.ListCustomerAuthorizationsReply{Items: make([]*v1.CustomerAuthorization, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, customerAuthorizationDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *CustomerAuthorizationService) ChangeCustomerAuthorizationStatus(ctx context.Context, req *v1.ChangeCustomerAuthorizationStatusRequest) (*v1.CustomerAuthorization, error) {
	operatorID, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.ChangeStatus(ctx, biz.CustomerAuthorizationAction{
		ID: req.GetId(), Version: req.GetVersion(), OperatorID: operatorID,
		Action: req.GetAction(), Reason: req.GetReason(),
	})
	if err != nil {
		return nil, err
	}
	return customerAuthorizationDTO(item), nil
}

func customerAuthorizationDTO(item *biz.CustomerAuthorization) *v1.CustomerAuthorization {
	if item == nil {
		return nil
	}
	out := &v1.CustomerAuthorization{
		Id: item.ID, EnterpriseId: item.EnterpriseID, EnterpriseCode: item.EnterpriseCode, EnterpriseName: item.EnterpriseName,
		ResourceType: item.ResourceType, ResourceId: item.ResourceID, ResourceCode: item.ResourceCode, ResourceName: item.ResourceName,
		AccountName: item.AccountName, ExternalId: item.ExternalID, MaskedIdentity: item.MaskedIdentity,
		AuthorizationStatus: item.AuthorizationStatus, UsageStatus: item.UsageStatus,
		DailyLimit: item.DailyLimit, IsDefault: item.IsDefault, Version: item.Version,
		CreatedAt: timestamppb.New(item.CreatedAt), UpdatedAt: timestamppb.New(item.UpdatedAt),
	}
	if item.ResourceType == "publish_channel" {
		out.PublishChannelId = item.ResourceID
		out.ChannelCode = item.ResourceCode
		out.ChannelName = item.ResourceName
	}
	if item.ExpiresAt != nil {
		out.ExpiresAt = timestamppb.New(*item.ExpiresAt)
	}
	if item.LastVerifiedAt != nil {
		out.LastVerifiedAt = timestamppb.New(*item.LastVerifiedAt)
	}
	if item.LastUsedAt != nil {
		out.LastUsedAt = timestamppb.New(*item.LastUsedAt)
	}
	return out
}
