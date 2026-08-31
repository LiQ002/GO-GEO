package service

import (
	"context"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"
)

type AdminUserService struct {
	v1.UnimplementedAdminUserServiceServer
	uc *biz.AdminUserUsecase
}

func NewAdminUserService(uc *biz.AdminUserUsecase) *AdminUserService {
	return &AdminUserService{uc: uc}
}
func (s *AdminUserService) CreateAdminUser(ctx context.Context, req *v1.CreateAdminUserRequest) (*v1.AdminUser, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	v, err := s.uc.Create(ctx, biz.AdminUserCommand{User: adminUserDO(req.GetUser()), InitialPassword: req.GetInitialPassword(), RoleIDs: req.GetRoleIds(), OperatorID: op, Reason: req.GetReason()})
	if err != nil {
		return nil, err
	}
	return adminUserDTO(v), nil
}
func (s *AdminUserService) GetAdminUser(ctx context.Context, req *v1.GetAdminUserRequest) (*v1.AdminUser, error) {
	v, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return adminUserDTO(v), nil
}
func (s *AdminUserService) ListAdminUsers(ctx context.Context, req *v1.ListAdminUsersRequest) (*v1.ListAdminUsersReply, error) {
	p, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrAdminUserInvalid
	}
	xs, total, err := s.uc.List(ctx, biz.AdminUserListOptions{Offset: p.Offset, Limit: p.Limit, Status: req.GetStatus(), Keyword: req.GetKeyword(), RoleID: req.GetRoleId()})
	if err != nil {
		return nil, err
	}
	out := &v1.ListAdminUsersReply{TotalSize: total}
	for _, v := range xs {
		out.Items = append(out.Items, adminUserDTO(v))
	}
	if p.Offset+len(xs) < int(total) {
		out.NextPageToken = query.NextToken(p.Offset + len(xs))
	}
	return out, nil
}
func (s *AdminUserService) UpdateAdminUser(ctx context.Context, req *v1.UpdateAdminUserRequest) (*v1.AdminUser, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	v, err := s.uc.Update(ctx, biz.AdminUserCommand{User: adminUserDO(req.GetUser()), OperatorID: op, Reason: req.GetReason()})
	if err != nil {
		return nil, err
	}
	return adminUserDTO(v), nil
}
func (s *AdminUserService) ChangeAdminUserStatus(ctx context.Context, req *v1.ChangeAdminUserStatusRequest) (*v1.AdminUser, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	v, err := s.uc.ChangeStatus(ctx, req.GetId(), req.GetAction(), op, req.GetReason())
	if err != nil {
		return nil, err
	}
	return adminUserDTO(v), nil
}
func (s *AdminUserService) ResetAdminUserPassword(ctx context.Context, req *v1.ResetAdminUserPasswordRequest) (*v1.AdminUser, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	v, err := s.uc.ResetPassword(ctx, req.GetId(), req.GetNewPassword(), op, req.GetReason())
	if err != nil {
		return nil, err
	}
	return adminUserDTO(v), nil
}
func (s *AdminUserService) SetAdminUserRoles(ctx context.Context, req *v1.SetAdminUserRolesRequest) (*v1.AdminUser, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	v, err := s.uc.SetRoles(ctx, req.GetId(), req.GetRoleIds(), op, req.GetReason())
	if err != nil {
		return nil, err
	}
	return adminUserDTO(v), nil
}
func adminUserDO(v *v1.AdminUser) *biz.ManagedAdminUser {
	if v == nil {
		return nil
	}
	return &biz.ManagedAdminUser{ID: v.GetId(), Username: v.GetUsername(), DisplayName: v.GetDisplayName(), Email: v.GetEmail(), Status: v.GetStatus()}
}
func adminUserDTO(v *biz.ManagedAdminUser) *v1.AdminUser {
	out := &v1.AdminUser{Id: v.ID, Username: v.Username, DisplayName: v.DisplayName, Email: v.Email, Status: v.Status, FailedLoginCount: v.FailedLoginCount, LockedUntil: timestampProto(v.LockedUntil), LastLoginAt: timestampProto(v.LastLoginAt), CreatedAt: timestamppb.New(v.CreatedAt), UpdatedAt: timestamppb.New(v.UpdatedAt)}
	for _, r := range v.Roles {
		out.Roles = append(out.Roles, adminRoleDTO(r))
	}
	return out
}
