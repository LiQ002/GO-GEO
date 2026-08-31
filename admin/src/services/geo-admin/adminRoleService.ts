// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询平台管理员权限列表 查询平台管理员权限列表。 GET /api/admin/v1/admin-permissions */
export async function adminRoleServiceListAdminPermissions(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminRoleServiceListAdminPermissionsParams,
  options?: { [key: string]: any }
) {
  return request<API.ListAdminPermissionsReply>(
    "/api/admin/v1/admin-permissions",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 查询平台管理员角色列表 查询平台管理员角色列表。 GET /api/admin/v1/admin-roles */
export async function adminRoleServiceListAdminRoles(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminRoleServiceListAdminRolesParams,
  options?: { [key: string]: any }
) {
  return request<API.ListAdminRolesReply>("/api/admin/v1/admin-roles", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建平台角色 创建平台角色。 POST /api/admin/v1/admin-roles */
export async function adminRoleServiceCreateAdminRole(
  body: API.CreateAdminRoleRequest,
  options?: { [key: string]: any }
) {
  return request<API.AdminRole>("/api/admin/v1/admin-roles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取平台角色 获取平台角色。 GET /api/admin/v1/admin-roles/${param0} */
export async function adminRoleServiceGetAdminRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminRoleServiceGetAdminRoleParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.AdminRole>(`/api/admin/v1/admin-roles/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除平台角色 删除平台角色。 DELETE /api/admin/v1/admin-roles/${param0} */
export async function adminRoleServiceDeleteAdminRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminRoleServiceDeleteAdminRoleParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/admin/v1/admin-roles/${param0}`, {
    method: "DELETE",
    params: {
      ...queryParams,
    },
    ...(options || {}),
  });
}

/** 更新平台角色 更新平台角色。 PUT /api/admin/v1/admin-roles/${param0} */
export async function adminRoleServiceUpdateAdminRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminRoleServiceUpdateAdminRoleParams,
  body: API.UpdateAdminRoleRequest,
  options?: { [key: string]: any }
) {
  const { "role.id": param0, ...queryParams } = params;
  return request<API.AdminRole>(`/api/admin/v1/admin-roles/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 设置平台管理员角色权限列表 设置平台管理员角色权限列表。 PUT /api/admin/v1/admin-roles/${param0}/permissions */
export async function adminRoleServiceSetAdminRolePermissions(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminRoleServiceSetAdminRolePermissionsParams,
  body: API.SetAdminRolePermissionsRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.AdminRole>(
    `/api/admin/v1/admin-roles/${param0}/permissions`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}
