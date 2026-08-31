package service

import (
	"context"
	"time"

	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/query"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type EnterpriseService struct {
	v1.UnimplementedEnterpriseServiceServer
	uc *biz.EnterpriseUsecase
}

func NewEnterpriseService(uc *biz.EnterpriseUsecase) *EnterpriseService {
	return &EnterpriseService{uc: uc}
}

func (s *EnterpriseService) CreateEnterprise(ctx context.Context, req *v1.CreateEnterpriseRequest) (*v1.EnterpriseDetail, error) {
	operatorID, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	detail := &biz.EnterpriseDetail{
		Enterprise: enterpriseDO(req.GetEnterprise()),
		Account: &biz.EnterpriseAccount{
			Username: req.GetUsername(), Email: req.GetAccountEmail(), Phone: req.GetAccountPhone(),
		},
		Quotas: make([]*biz.QuotaLimit, 0, len(req.GetQuotas())),
	}
	for _, quota := range req.GetQuotas() {
		detail.Quotas = append(detail.Quotas, quotaDO(quota))
	}
	if req.GetPlanId() != 0 {
		detail.Subscription = &biz.Subscription{PlanID: req.GetPlanId()}
	}
	var expiresAt = timestampValue(req.GetSubscriptionExpiresAt())
	created, err := s.uc.Create(ctx, biz.CreateEnterpriseCommand{
		Detail: detail, InitialPassword: req.GetInitialPassword(),
		SubscriptionExpires: expiresAt, OperatorID: operatorID,
		GrantedPoints: req.GetGrantedPoints(),
	})
	if err != nil {
		return nil, err
	}
	return enterpriseDetailDTO(created), nil
}

func (s *EnterpriseService) GetEnterprise(ctx context.Context, req *v1.GetEnterpriseRequest) (*v1.EnterpriseDetail, error) {
	item, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return enterpriseDetailDTO(item), nil
}

func (s *EnterpriseService) ListEnterprises(ctx context.Context, req *v1.ListEnterprisesRequest) (*v1.ListEnterprisesReply, error) {
	page, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrEnterpriseInvalid
	}
	var agentID *uint64
	if req.AgentId != nil {
		value := req.GetAgentId()
		agentID = &value
	}
	var expiringSoon *bool
	if req.ExpiringSoon != nil {
		value := req.GetExpiringSoon()
		expiringSoon = &value
	}
	items, total, err := s.uc.List(ctx, biz.EnterpriseListOptions{
		Offset: page.Offset, Limit: page.Limit, Keyword: req.GetKeyword(), Status: req.GetStatus(),
		PlanID: req.GetPlanId(), AgentID: agentID, ExpiringSoon: expiringSoon,
	})
	if err != nil {
		return nil, err
	}
	reply := &v1.ListEnterprisesReply{Items: make([]*v1.EnterpriseDetail, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, enterpriseDetailDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *EnterpriseService) UpdateEnterprise(ctx context.Context, req *v1.UpdateEnterpriseRequest) (*v1.EnterpriseDetail, error) {
	operatorID, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.Update(ctx, enterpriseDO(req.GetEnterprise()), operatorID)
	if err != nil {
		return nil, err
	}
	return enterpriseDetailDTO(item), nil
}

func (s *EnterpriseService) ChangeEnterpriseStatus(ctx context.Context, req *v1.ChangeEnterpriseStatusRequest) (*v1.EnterpriseDetail, error) {
	operatorID, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.ChangeStatus(ctx, biz.EnterpriseStatusCommand{
		ID: req.GetId(), Version: req.GetVersion(), OperatorID: operatorID,
		Action: req.GetAction(), Reason: req.GetReason(),
	})
	if err != nil {
		return nil, err
	}
	return enterpriseDetailDTO(item), nil
}

func (s *EnterpriseService) ResetEnterprisePassword(ctx context.Context, req *v1.ResetEnterprisePasswordRequest) (*v1.EnterpriseAccount, error) {
	operatorID, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.ResetPassword(ctx, biz.EnterprisePasswordCommand{
		ID: req.GetId(), OperatorID: operatorID, Reason: req.GetReason(),
	}, req.GetNewPassword())
	if err != nil {
		return nil, err
	}
	return enterpriseAccountDTO(item), nil
}

func (s *EnterpriseService) SetEnterpriseSubscription(ctx context.Context, req *v1.SetEnterpriseSubscriptionRequest) (*v1.Subscription, error) {
	operatorID, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.SetSubscription(ctx, biz.SubscriptionCommand{
		Subscription: &biz.Subscription{
			EnterpriseID: req.GetEnterpriseId(), PlanID: req.GetPlanId(), Status: req.GetStatus(),
			StartsAt: timestampValue(req.GetStartsAt()), ExpiresAt: timestampValue(req.GetExpiresAt()),
			AutoRenew: req.GetAutoRenew(),
		},
		ExpectedVersion: req.GetExpectedVersion(), OperatorID: operatorID, Reason: req.GetReason(),
	})
	if err != nil {
		return nil, err
	}
	return subscriptionDTO(item), nil
}

func (s *EnterpriseService) SetEnterpriseQuota(ctx context.Context, req *v1.SetEnterpriseQuotaRequest) (*v1.QuotaLimit, error) {
	operatorID, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.SetQuota(ctx, biz.QuotaCommand{
		Quota: &biz.QuotaLimit{
			EnterpriseID: req.GetEnterpriseId(), Metric: req.GetMetric(), LimitValue: req.GetLimitValue(),
			Period: req.GetPeriod(), ResetAt: timestampPointer(req.GetResetAt()),
		},
		OperatorID: operatorID, Reason: req.GetReason(),
	})
	if err != nil {
		return nil, err
	}
	return quotaDTO(item), nil
}

func enterpriseDO(item *v1.Enterprise) *biz.Enterprise {
	if item == nil {
		return nil
	}
	var agentID *uint64
	if item.AgentId != nil {
		value := item.GetAgentId()
		agentID = &value
	}
	return &biz.Enterprise{
		ID: item.GetId(), AgentID: agentID, Code: item.GetCode(), Name: item.GetName(), Status: item.GetStatus(),
		Industry: item.GetIndustry(), Region: item.GetRegion(), Timezone: item.GetTimezone(), Locale: item.GetLocale(),
		ContactName: item.GetContactName(), ContactEmail: item.GetContactEmail(), ContactPhone: item.GetContactPhone(),
		NotificationJSON: item.GetNotificationJson(), Remark: item.GetRemark(), Version: item.GetVersion(),
	}
}

func enterpriseDetailDTO(item *biz.EnterpriseDetail) *v1.EnterpriseDetail {
	if item == nil {
		return nil
	}
	reply := &v1.EnterpriseDetail{Enterprise: enterpriseDTO(item.Enterprise), Account: enterpriseAccountDTO(item.Account)}
	if item.Subscription != nil {
		reply.Subscription = subscriptionDTO(item.Subscription)
	}
	reply.Quotas = make([]*v1.QuotaLimit, 0, len(item.Quotas))
	for _, quota := range item.Quotas {
		reply.Quotas = append(reply.Quotas, quotaDTO(quota))
	}
	reply.ArticleCount = item.ArticleCount
	reply.PublishedCount = item.PublishedCount
	reply.PointsBalance = item.PointsBalance
	reply.PointsFrozen = item.PointsFrozen
	return reply
}

func enterpriseDTO(item *biz.Enterprise) *v1.Enterprise {
	if item == nil {
		return nil
	}
	reply := &v1.Enterprise{
		Id: item.ID, Code: item.Code, Name: item.Name, Status: item.Status,
		Industry: item.Industry, Region: item.Region, Timezone: item.Timezone, Locale: item.Locale,
		ContactName: item.ContactName, ContactEmail: item.ContactEmail, ContactPhone: item.ContactPhone,
		NotificationJson: item.NotificationJSON, Remark: item.Remark, Version: item.Version,
		CreatedAt: timestamppb.New(item.CreatedAt), UpdatedAt: timestamppb.New(item.UpdatedAt),
	}
	if item.AgentID != nil {
		reply.AgentId = item.AgentID
	}
	return reply
}

func enterpriseAccountDTO(item *biz.EnterpriseAccount) *v1.EnterpriseAccount {
	if item == nil {
		return nil
	}
	return &v1.EnterpriseAccount{
		Id: item.ID, EnterpriseId: item.EnterpriseID, Username: item.Username, Email: item.Email,
		Phone: item.Phone, Status: item.Status, MustChangePassword: item.MustChangePassword,
		FailedLoginCount: item.FailedLoginCount, LockedUntil: timestampProto(item.LockedUntil), LastLoginAt: timestampProto(item.LastLoginAt),
	}
}

func subscriptionDTO(item *biz.Subscription) *v1.Subscription {
	if item == nil {
		return nil
	}
	return &v1.Subscription{
		Id: item.ID, EnterpriseId: item.EnterpriseID, PlanId: item.PlanID, PlanName: item.PlanName,
		Status: item.Status, StartsAt: timestamppb.New(item.StartsAt), ExpiresAt: timestamppb.New(item.ExpiresAt),
		AutoRenew: item.AutoRenew, Version: item.Version,
	}
}

func quotaDO(item *v1.QuotaLimit) *biz.QuotaLimit {
	if item == nil {
		return nil
	}
	return &biz.QuotaLimit{
		ID: item.GetId(), EnterpriseID: item.GetEnterpriseId(), Metric: item.GetMetric(),
		LimitValue: item.GetLimitValue(), UsedValue: item.GetUsedValue(), ReservedValue: item.GetReservedValue(),
		Period: item.GetPeriod(), ResetAt: timestampPointer(item.GetResetAt()),
	}
}

func quotaDTO(item *biz.QuotaLimit) *v1.QuotaLimit {
	if item == nil {
		return nil
	}
	return &v1.QuotaLimit{
		Id: item.ID, EnterpriseId: item.EnterpriseID, Metric: item.Metric,
		LimitValue: item.LimitValue, UsedValue: item.UsedValue, ReservedValue: item.ReservedValue,
		Period: item.Period, ResetAt: timestampProto(item.ResetAt),
	}
}

func adminOperatorID(ctx context.Context) (uint64, error) {
	principal, ok := authn.PrincipalFromContext(ctx)
	if !ok || principal.SubjectID == 0 || principal.SubjectType != "admin" {
		return 0, biz.ErrAdminSession
	}
	return principal.SubjectID, nil
}

func timestampValue(value *timestamppb.Timestamp) time.Time {
	if value == nil || !value.IsValid() {
		return time.Time{}
	}
	return value.AsTime()
}

func timestampPointer(value *timestamppb.Timestamp) *time.Time {
	parsed := timestampValue(value)
	if parsed.IsZero() {
		return nil
	}
	return &parsed
}

func timestampProto(value *time.Time) *timestamppb.Timestamp {
	if value == nil || value.IsZero() {
		return nil
	}
	return timestamppb.New(*value)
}
