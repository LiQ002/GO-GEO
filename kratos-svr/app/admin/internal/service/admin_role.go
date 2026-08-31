package service

import (
	"context"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"
)

type AdminRoleService struct {
	v1.UnimplementedAdminRoleServiceServer
	uc *biz.AdminRoleUsecase
}

func NewAdminRoleService(uc *biz.AdminRoleUsecase) *AdminRoleService {
	return &AdminRoleService{uc: uc}
}
func (s *AdminRoleService) CreateAdminRole(ctx context.Context, req *v1.CreateAdminRoleRequest) (*v1.AdminRole, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	v, err := s.uc.Create(ctx, biz.AdminRoleCommand{Role: adminRoleDO(req.GetRole()), PermissionIDs: req.GetPermissionIds(), OperatorID: op, Reason: req.GetReason()})
	if err != nil {
		return nil, err
	}
	return adminRoleDTO(v), nil
}
func (s *AdminRoleService) GetAdminRole(ctx context.Context, req *v1.GetAdminRoleRequest) (*v1.AdminRole, error) {
	v, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return adminRoleDTO(v), nil
}
func (s *AdminRoleService) ListAdminRoles(ctx context.Context, req *v1.ListAdminRolesRequest) (*v1.ListAdminRolesReply, error) {
	p, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrAdminRoleInvalid
	}
	xs, total, err := s.uc.List(ctx, biz.AdminRoleListOptions{Offset: p.Offset, Limit: p.Limit, Status: req.GetStatus(), Keyword: req.GetKeyword()})
	if err != nil {
		return nil, err
	}
	out := &v1.ListAdminRolesReply{TotalSize: total}
	for _, v := range xs {
		out.Items = append(out.Items, adminRoleDTO(v))
	}
	if p.Offset+len(xs) < int(total) {
		out.NextPageToken = query.NextToken(p.Offset + len(xs))
	}
	return out, nil
}
func (s *AdminRoleService) UpdateAdminRole(ctx context.Context, req *v1.UpdateAdminRoleRequest) (*v1.AdminRole, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	v, err := s.uc.Update(ctx, biz.AdminRoleCommand{Role: adminRoleDO(req.GetRole()), OperatorID: op, Reason: req.GetReason()})
	if err != nil {
		return nil, err
	}
	return adminRoleDTO(v), nil
}
func (s *AdminRoleService) DeleteAdminRole(ctx context.Context, req *v1.DeleteAdminRoleRequest) (*emptypb.Empty, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.uc.Delete(ctx, req.GetId(), op, req.GetReason()); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}
func (s *AdminRoleService) ListAdminPermissions(ctx context.Context, req *v1.ListAdminPermissionsRequest) (*v1.ListAdminPermissionsReply, error) {
	xs, err := s.uc.ListPermissions(ctx, req.GetResource(), req.GetKeyword())
	if err != nil {
		return nil, err
	}
	out := &v1.ListAdminPermissionsReply{}
	for _, v := range xs {
		out.Items = append(out.Items, adminPermissionDTO(v))
	}
	return out, nil
}
func (s *AdminRoleService) SetAdminRolePermissions(ctx context.Context, req *v1.SetAdminRolePermissionsRequest) (*v1.AdminRole, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	v, err := s.uc.SetPermissions(ctx, req.GetId(), req.GetPermissionIds(), op, req.GetReason())
	if err != nil {
		return nil, err
	}
	return adminRoleDTO(v), nil
}
func adminRoleDO(v *v1.AdminRole) *biz.AdminRole {
	if v == nil {
		return nil
	}
	return &biz.AdminRole{ID: v.GetId(), Code: v.GetCode(), Name: v.GetName(), Description: v.GetDescription(), DataScope: v.GetDataScope(), Status: v.GetStatus()}
}
func adminPermissionDTO(v *biz.AdminPermission) *v1.AdminPermission {
	return &v1.AdminPermission{Id: v.ID, Code: v.Code, Name: v.Name, Resource: v.Resource, Action: v.Action, Description: v.Description}
}
func adminRoleDTO(v *biz.AdminRole) *v1.AdminRole {
	out := &v1.AdminRole{Id: v.ID, Code: v.Code, Name: v.Name, Description: v.Description, DataScope: v.DataScope, Status: v.Status, CreatedAt: timestamppb.New(v.CreatedAt), UpdatedAt: timestamppb.New(v.UpdatedAt)}
	for _, p := range v.Permissions {
		out.Permissions = append(out.Permissions, adminPermissionDTO(p))
	}
	return out
}
