package service

import (
	"context"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"
)

type PlatformAccountService struct {
	v1.UnimplementedPlatformAccountServiceServer
	uc *biz.PlatformAccountUsecase
}

func NewPlatformAccountService(u *biz.PlatformAccountUsecase) *PlatformAccountService {
	return &PlatformAccountService{uc: u}
}

type ClientAuthorizationService struct {
	v1.UnimplementedClientAuthorizationServiceServer
	uc      *biz.PlatformAccountUsecase
	catalog *biz.CatalogUsecase
}

func NewClientAuthorizationService(u *biz.PlatformAccountUsecase, c *biz.CatalogUsecase) *ClientAuthorizationService {
	return &ClientAuthorizationService{uc: u, catalog: c}
}
func (s *PlatformAccountService) ListPlatformAccounts(c context.Context, r *v1.ListPlatformAccountsRequest) (*v1.ListPlatformAccountsReply, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	items, x := s.uc.List(c, e, biz.PlatformAccountFilter{ResourceType: r.GetResourceType(), ResourceID: r.GetResourceId(), Status: r.GetStatus()})
	if x != nil {
		return nil, x
	}
	o := &v1.ListPlatformAccountsReply{Items: make([]*v1.PlatformAccount, 0, len(items))}
	for _, i := range items {
		o.Items = append(o.Items, platformAccountDTO(i))
	}
	return o, nil
}
func (s *PlatformAccountService) GetPlatformAccountCredential(c context.Context, r *v1.GetPlatformAccountCredentialRequest) (*v1.PlatformAccountCredential, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	payload, x := s.uc.GetCredential(c, e, r.GetAccountId())
	if x != nil {
		return nil, x
	}
	return &v1.PlatformAccountCredential{AccountId: r.GetAccountId(), CredentialPayload: payload}, nil
}
func (s *PlatformAccountService) CreateAuthorizationSession(c context.Context, r *v1.CreateAuthorizationSessionRequest) (*v1.AuthorizationSession, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.CreateSession(c, e, r.GetDeviceId(), r.GetResourceType(), r.GetResourceId(), r.GetPlatformAccountId())
	if x != nil {
		return nil, x
	}
	return authorizationSessionDTO(o), nil
}
func (s *PlatformAccountService) GetAuthorizationSession(c context.Context, r *v1.GetAuthorizationSessionRequest) (*v1.AuthorizationSession, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.GetSession(c, e, r.GetSessionId())
	if x != nil {
		return nil, x
	}
	return authorizationSessionDTO(o), nil
}
func (s *PlatformAccountService) ChangePlatformAccountStatus(c context.Context, r *v1.ChangePlatformAccountStatusRequest) (*v1.PlatformAccount, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.ChangeStatus(c, e, r.GetAccountId(), r.GetVersion(), r.GetAction())
	if x != nil {
		return nil, x
	}
	return platformAccountDTO(o), nil
}
func (s *PlatformAccountService) DeletePlatformAccount(c context.Context, r *v1.DeletePlatformAccountRequest) (*emptypb.Empty, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	if x = s.uc.Delete(c, e, r.GetAccountId(), r.GetVersion()); x != nil {
		return nil, x
	}
	return &emptypb.Empty{}, nil
}
func (s *ClientAuthorizationService) GetClientConfig(c context.Context, r *v1.GetClientConfigRequest) (*v1.ClientConfig, error) {
	p, ok := authn.PrincipalFromContext(c)
	if !ok || p.EnterpriseID == 0 {
		return nil, biz.ErrSessionInvalid
	}
	cfg, x := s.uc.Config(c)
	if x != nil {
		return nil, x
	}
	channels, x := s.catalog.ListPublishChannels(c, p.EnterpriseID)
	if x != nil {
		return nil, x
	}
	sites, x := s.catalog.ListInclusionSites(c, p.EnterpriseID)
	if x != nil {
		return nil, x
	}
	targets := append(channels, sites...)
	authorizationTargets := targets[:0]
	for _, target := range targets {
		if target.AccountRequired {
			authorizationTargets = append(authorizationTargets, target)
		}
	}
	return &v1.ClientConfig{MinimumVersion: cfg.MinimumVersion, LatestVersion: cfg.LatestVersion, ForceUpgrade: cfg.ForceUpgrade, DownloadUrl: cfg.DownloadURL, AuthorizationTargets: catalogDTO(authorizationTargets)}, nil
}
func (s *ClientAuthorizationService) SubmitAuthorization(c context.Context, r *v1.SubmitAuthorizationRequest) (*v1.PlatformAccount, error) {
	a := &biz.PlatformAccount{AccountName: r.GetAccountName(), ExternalID: r.GetExternalId(), MaskedIdentity: r.GetMaskedIdentity(), MetadataJSON: r.GetMetadataJson()}
	if r.GetExpiresAt() != nil {
		t := r.GetExpiresAt().AsTime()
		a.ExpiresAt = &t
	}
	o, x := s.uc.Submit(c, r.GetSessionToken(), a, r.GetCredentialPayload(), r.GetClientVersion())
	if x != nil {
		return nil, x
	}
	return platformAccountDTO(o), nil
}
func (s *ClientAuthorizationService) ReportAuthorizationHeartbeat(c context.Context, r *v1.ReportAuthorizationHeartbeatRequest) (*v1.AuthorizationSession, error) {
	o, x := s.uc.Heartbeat(c, r.GetSessionToken(), r.GetStatus(), r.GetClientVersion())
	if x != nil {
		return nil, x
	}
	return authorizationSessionDTO(o), nil
}
func platformAccountDTO(i *biz.PlatformAccount) *v1.PlatformAccount {
	if i == nil {
		return nil
	}
	o := &v1.PlatformAccount{Id: i.ID, ResourceType: i.ResourceType, ResourceId: i.ResourceID, AccountName: i.AccountName, ExternalId: i.ExternalID, MaskedIdentity: i.MaskedIdentity, AuthorizationStatus: i.AuthorizationStatus, UsageStatus: i.UsageStatus, DailyLimit: i.DailyLimit, IsDefault: i.IsDefault, MetadataJson: i.MetadataJSON, Version: i.Version}
	if i.ExpiresAt != nil {
		o.ExpiresAt = timestamppb.New(*i.ExpiresAt)
	}
	if i.LastVerifiedAt != nil {
		o.LastVerifiedAt = timestamppb.New(*i.LastVerifiedAt)
	}
	if i.LastUsedAt != nil {
		o.LastUsedAt = timestamppb.New(*i.LastUsedAt)
	}
	return o
}
func authorizationSessionDTO(i *biz.AuthorizationSession) *v1.AuthorizationSession {
	if i == nil {
		return nil
	}
	o := &v1.AuthorizationSession{Id: i.ID, SessionToken: i.SessionToken, DeviceId: i.DeviceID, ResourceType: i.ResourceType, ResourceId: i.ResourceID, PlatformAccountId: i.PlatformAccountID, Status: i.Status, ExpiresAt: timestamppb.New(i.ExpiresAt)}
	if i.CompletedAt != nil {
		o.CompletedAt = timestamppb.New(*i.CompletedAt)
	}
	return o
}
