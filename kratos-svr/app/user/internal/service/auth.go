package service

import (
	"context"
	"github.com/go-kratos/kratos/v3/transport"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"
	"strings"
)

type AuthService struct {
	v1.UnimplementedAuthServiceServer
	uc *biz.AuthUsecase
}

func NewAuthService(uc *biz.AuthUsecase) *AuthService { return &AuthService{uc: uc} }
func (s *AuthService) Login(ctx context.Context, r *v1.LoginRequest) (*v1.LoginReply, error) {
	p, e := s.uc.Login(ctx, r.GetUsername(), r.GetPassword(), sessionMetadata(ctx, r.GetDeviceId()))
	if e != nil {
		return nil, e
	}
	return loginDTO(p), nil
}
func (s *AuthService) Refresh(ctx context.Context, r *v1.RefreshRequest) (*v1.LoginReply, error) {
	p, e := s.uc.Refresh(ctx, r.GetRefreshToken())
	if e != nil {
		return nil, e
	}
	return loginDTO(p), nil
}
func (s *AuthService) Logout(ctx context.Context, r *v1.LogoutRequest) (*emptypb.Empty, error) {
	p, ok := authn.PrincipalFromContext(ctx)
	if !ok {
		return nil, biz.ErrSessionInvalid
	}
	if e := s.uc.Logout(ctx, p.EnterpriseID, p.SubjectID, p.SessionID, r.GetAllSessions()); e != nil {
		return nil, e
	}
	return &emptypb.Empty{}, nil
}
func (s *AuthService) GetCurrentEnterprise(ctx context.Context, _ *v1.GetCurrentEnterpriseRequest) (*v1.EnterpriseProfile, error) {
	p, ok := authn.PrincipalFromContext(ctx)
	if !ok {
		return nil, biz.ErrSessionInvalid
	}
	o, e := s.uc.Me(ctx, p.SubjectID)
	if e != nil {
		return nil, e
	}
	return enterpriseDTO(o), nil
}
func (s *AuthService) UpdateEnterpriseProfile(ctx context.Context, r *v1.UpdateEnterpriseProfileRequest) (*v1.EnterpriseProfile, error) {
	p, ok := authn.PrincipalFromContext(ctx)
	if !ok {
		return nil, biz.ErrSessionInvalid
	}
	o, e := s.uc.UpdateProfile(ctx, p.EnterpriseID, enterpriseDO(r.GetEnterprise()))
	if e != nil {
		return nil, e
	}
	return enterpriseDTO(o), nil
}
func (s *AuthService) ChangePassword(ctx context.Context, r *v1.ChangePasswordRequest) (*emptypb.Empty, error) {
	p, ok := authn.PrincipalFromContext(ctx)
	if !ok {
		return nil, biz.ErrSessionInvalid
	}
	if e := s.uc.ChangePassword(ctx, p.SubjectID, r.GetCurrentPassword(), r.GetNewPassword()); e != nil {
		return nil, e
	}
	return &emptypb.Empty{}, nil
}
func (s *AuthService) ListSessions(ctx context.Context, _ *v1.ListSessionsRequest) (*v1.ListSessionsReply, error) {
	p, ok := authn.PrincipalFromContext(ctx)
	if !ok {
		return nil, biz.ErrSessionInvalid
	}
	items, e := s.uc.ListSessions(ctx, p.EnterpriseID, p.SubjectID)
	if e != nil {
		return nil, e
	}
	out := &v1.ListSessionsReply{Items: make([]*v1.Session, 0, len(items))}
	for _, i := range items {
		out.Items = append(out.Items, &v1.Session{Id: i.ID, DeviceId: i.DeviceID, IpAddress: i.IPAddress, UserAgent: i.UserAgent, LastSeenAt: timestamppb.New(i.LastSeenAt), ExpiresAt: timestamppb.New(i.ExpiresAt), Current: i.ID == p.SessionID})
	}
	return out, nil
}
func (s *AuthService) RevokeSession(ctx context.Context, r *v1.RevokeSessionRequest) (*emptypb.Empty, error) {
	p, ok := authn.PrincipalFromContext(ctx)
	if !ok {
		return nil, biz.ErrSessionInvalid
	}
	if e := s.uc.RevokeSession(ctx, p.EnterpriseID, p.SubjectID, r.GetSessionId()); e != nil {
		return nil, e
	}
	return &emptypb.Empty{}, nil
}
func sessionMetadata(ctx context.Context, deviceID string) biz.SessionMetadata {
	m := biz.SessionMetadata{DeviceID: deviceID}
	if tr, ok := transport.FromServerContext(ctx); ok {
		m.UserAgent = tr.RequestHeader().Get("User-Agent")
		m.IPAddress = tr.RequestHeader().Get("X-Real-IP")
		if m.IPAddress == "" {
			parts := strings.Split(tr.RequestHeader().Get("X-Forwarded-For"), ",")
			if len(parts) > 0 {
				m.IPAddress = strings.TrimSpace(parts[0])
			}
		}
	}
	return m
}
func loginDTO(p *biz.TokenPair) *v1.LoginReply {
	return &v1.LoginReply{AccessToken: p.AccessToken, RefreshToken: p.RefreshToken, AccessExpiresAt: timestamppb.New(p.AccessExpiresAt), Enterprise: enterpriseDTO(p.Enterprise)}
}
func enterpriseDO(i *v1.EnterpriseProfile) *biz.EnterpriseProfile {
	if i == nil {
		return nil
	}
	return &biz.EnterpriseProfile{EnterpriseID: i.GetEnterpriseId(), Code: i.GetCode(), Name: i.GetName(), Status: i.GetStatus(), Industry: i.GetIndustry(), Region: i.GetRegion(), Timezone: i.GetTimezone(), Locale: i.GetLocale(), ContactName: i.GetContactName(), ContactEmail: i.GetContactEmail(), ContactPhone: i.GetContactPhone(), NotificationJSON: i.GetNotificationJson(), Version: i.GetVersion()}
}
func enterpriseDTO(i *biz.EnterpriseProfile) *v1.EnterpriseProfile {
	if i == nil {
		return nil
	}
	o := &v1.EnterpriseProfile{EnterpriseId: i.EnterpriseID, Code: i.Code, Name: i.Name, Status: i.Status, Industry: i.Industry, Region: i.Region, Timezone: i.Timezone, Locale: i.Locale, ContactName: i.ContactName, ContactEmail: i.ContactEmail, ContactPhone: i.ContactPhone, NotificationJson: i.NotificationJSON, Version: i.Version, PlanName: i.PlanName, PointsBalance: i.PointsBalance, PointsFrozen: i.PointsFrozen, SubscriptionStatus: i.SubscriptionStatus, Quotas: make([]*v1.Quota, 0, len(i.Quotas))}
	if i.SubscriptionExpiresAt != nil {
		o.SubscriptionExpiresAt = timestamppb.New(*i.SubscriptionExpiresAt)
	}
	for _, q := range i.Quotas {
		x := &v1.Quota{Metric: q.Metric, LimitValue: q.LimitValue, UsedValue: q.UsedValue, ReservedValue: q.ReservedValue, Period: q.Period}
		if q.ResetAt != nil {
			x.ResetAt = timestamppb.New(*q.ResetAt)
		}
		o.Quotas = append(o.Quotas, x)
	}
	return o
}
