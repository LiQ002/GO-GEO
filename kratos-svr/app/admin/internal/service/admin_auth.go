package service

import (
	"context"
	"strings"

	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/authn"

	"github.com/go-kratos/kratos/v3/transport"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type AdminAuthService struct {
	v1.UnimplementedAdminAuthServiceServer
	uc *biz.AdminAuthUsecase
}

func NewAdminAuthService(uc *biz.AdminAuthUsecase) *AdminAuthService {
	return &AdminAuthService{uc: uc}
}
func (s *AdminAuthService) Login(ctx context.Context, r *v1.AdminLoginRequest) (*v1.AdminLoginReply, error) {
	pair, err := s.uc.Login(ctx, r.GetUsername(), r.GetPassword(), requestMetadata(ctx, r.GetDeviceId()))
	if err != nil {
		return nil, err
	}
	return adminLoginDTO(pair), nil
}
func (s *AdminAuthService) Refresh(ctx context.Context, r *v1.AdminRefreshRequest) (*v1.AdminLoginReply, error) {
	pair, err := s.uc.Refresh(ctx, r.GetRefreshToken())
	if err != nil {
		return nil, err
	}
	return adminLoginDTO(pair), nil
}
func (s *AdminAuthService) Logout(ctx context.Context, r *v1.AdminLogoutRequest) (*emptypb.Empty, error) {
	p, ok := authn.PrincipalFromContext(ctx)
	if !ok {
		return nil, biz.ErrAdminSession
	}
	if err := s.uc.Logout(ctx, p.SubjectID, p.SessionID, r.GetAllSessions()); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}
func (s *AdminAuthService) GetCurrentAdmin(ctx context.Context, _ *v1.GetCurrentAdminRequest) (*v1.AdminProfile, error) {
	p, ok := authn.PrincipalFromContext(ctx)
	if !ok {
		return nil, biz.ErrAdminSession
	}
	profile, err := s.uc.Me(ctx, p.SubjectID)
	if err != nil {
		return nil, err
	}
	return adminProfileDTO(profile), nil
}
func (s *AdminAuthService) ChangePassword(ctx context.Context, r *v1.AdminChangePasswordRequest) (*emptypb.Empty, error) {
	p, ok := authn.PrincipalFromContext(ctx)
	if !ok {
		return nil, biz.ErrAdminSession
	}
	if err := s.uc.ChangePassword(ctx, p.SubjectID, r.GetCurrentPassword(), r.GetNewPassword()); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}
func adminLoginDTO(p *biz.AdminTokenPair) *v1.AdminLoginReply {
	return &v1.AdminLoginReply{AccessToken: p.AccessToken, RefreshToken: p.RefreshToken, AccessExpiresAt: timestamppb.New(p.AccessExpiresAt), Admin: adminProfileDTO(p.Admin)}
}
func adminProfileDTO(p *biz.AdminProfile) *v1.AdminProfile {
	out := &v1.AdminProfile{Id: p.ID, Username: p.Username, DisplayName: p.DisplayName, Email: p.Email, Status: p.Status, Roles: p.Roles, Permissions: p.Permissions}
	if p.LastLoginAt != nil {
		out.LastLoginAt = timestamppb.New(*p.LastLoginAt)
	}
	return out
}
func requestMetadata(ctx context.Context, deviceID string) biz.SessionMetadata {
	meta := biz.SessionMetadata{DeviceID: deviceID}
	if tr, ok := transport.FromServerContext(ctx); ok {
		meta.UserAgent = tr.RequestHeader().Get("User-Agent")
		meta.IPAddress = tr.RequestHeader().Get("X-Real-IP")
		if meta.IPAddress == "" {
			meta.IPAddress = strings.TrimSpace(strings.Split(tr.RequestHeader().Get("X-Forwarded-For"), ",")[0])
		}
	}
	return meta
}
