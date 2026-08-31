package service

import (
	"context"

	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"
)

func (s *CustomerAuthorizationService) GetSelfMediaAuthorization(ctx context.Context, req *v1.GetSelfMediaAuthorizationRequest) (*v1.CustomerAuthorization, error) {
	item, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	if item.ResourceType != "publish_channel" {
		return nil, biz.ErrCustomerAuthorizationNotFound
	}
	return customerAuthorizationDTO(item), nil
}

func (s *CustomerAuthorizationService) ListSelfMediaAuthorizations(ctx context.Context, req *v1.ListSelfMediaAuthorizationsRequest) (*v1.ListSelfMediaAuthorizationsReply, error) {
	page, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrCustomerAuthorizationInvalid
	}
	items, total, err := s.uc.List(ctx, biz.CustomerAuthorizationListOptions{
		Offset: page.Offset, Limit: page.Limit, EnterpriseID: req.GetEnterpriseId(),
		ResourceType: "publish_channel", ResourceID: req.GetPublishChannelId(),
		AuthorizationStatus: req.GetAuthorizationStatus(), UsageStatus: req.GetUsageStatus(),
		Keyword: req.GetKeyword(),
	})
	if err != nil {
		return nil, err
	}
	reply := &v1.ListSelfMediaAuthorizationsReply{
		Items:     make([]*v1.CustomerAuthorization, 0, len(items)),
		TotalSize: total,
	}
	for _, item := range items {
		reply.Items = append(reply.Items, customerAuthorizationDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *CustomerAuthorizationService) ChangeSelfMediaAuthorizationStatus(ctx context.Context, req *v1.ChangeSelfMediaAuthorizationStatusRequest) (*v1.CustomerAuthorization, error) {
	operatorID, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.ChangeStatus(ctx, biz.CustomerAuthorizationAction{
		ID: req.GetId(), Version: req.GetVersion(), OperatorID: operatorID,
		ResourceType: "publish_channel", Action: req.GetAction(), Reason: req.GetReason(),
	})
	if err != nil {
		return nil, err
	}
	return customerAuthorizationDTO(item), nil
}
