// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询平台管理员账号列表 查询平台管理员账号列表。 GET /api/admin/v1/admin-users */
export async function adminUserServiceListAdminUsers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminUserServiceListAdminUsersParams,
  options?: { [key: string]: any }
) {
  return request<API.ListAdminUsersReply>("/api/admin/v1/admin-users", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建平台账号 创建平台账号。 POST /api/admin/v1/admin-users */
export async function adminUserServiceCreateAdminUser(
  body: API.CreateAdminUserRequest,
  options?: { [key: string]: any }
) {
  return request<API.AdminUser>("/api/admin/v1/admin-users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取平台账号 获取平台账号。 GET /api/admin/v1/admin-users/${param0} */
export async function adminUserServiceGetAdminUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminUserServiceGetAdminUserParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.AdminUser>(`/api/admin/v1/admin-users/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新平台账号 更新平台账号。 PUT /api/admin/v1/admin-users/${param0} */
export async function adminUserServiceUpdateAdminUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminUserServiceUpdateAdminUserParams,
  body: API.UpdateAdminUserRequest,
  options?: { [key: string]: any }
) {
  const { "user.id": param0, ...queryParams } = params;
  return request<API.AdminUser>(`/api/admin/v1/admin-users/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 重置平台管理员用户密码 重置平台管理员用户密码。 POST /api/admin/v1/admin-users/${param0}/reset-password */
export async function adminUserServiceResetAdminUserPassword(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminUserServiceResetAdminUserPasswordParams,
  body: API.ResetAdminUserPasswordRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.AdminUser>(
    `/api/admin/v1/admin-users/${param0}/reset-password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 设置平台管理员用户角色列表 设置平台管理员用户角色列表。 PUT /api/admin/v1/admin-users/${param0}/roles */
export async function adminUserServiceSetAdminUserRoles(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminUserServiceSetAdminUserRolesParams,
  body: API.SetAdminUserRolesRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.AdminUser>(`/api/admin/v1/admin-users/${param0}/roles`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 变更平台管理员用户状态 变更平台管理员用户状态。 POST /api/admin/v1/admin-users/${param0}/status */
export async function adminUserServiceChangeAdminUserStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminUserServiceChangeAdminUserStatusParams,
  body: API.ChangeAdminUserStatusRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.AdminUser>(`/api/admin/v1/admin-users/${param0}/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
