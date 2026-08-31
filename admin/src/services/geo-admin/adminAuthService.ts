// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 变更密码 变更密码。 POST /api/admin/v1/auth/change-password */
export async function adminAuthServiceChangePassword(
  body: API.AdminChangePasswordRequest,
  options?: { [key: string]: any }
) {
  return request<any>("/api/admin/v1/auth/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 登录 登录。 POST /api/admin/v1/auth/login */
export async function adminAuthServiceLogin(
  body: API.AdminLoginRequest,
  options?: { [key: string]: any }
) {
  return request<API.AdminLoginReply>("/api/admin/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 退出登录 退出登录。 POST /api/admin/v1/auth/logout */
export async function adminAuthServiceLogout(
  body: API.AdminLogoutRequest,
  options?: { [key: string]: any }
) {
  return request<any>("/api/admin/v1/auth/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取当前平台管理员 获取当前平台管理员。 GET /api/admin/v1/auth/me */
export async function adminAuthServiceGetCurrentAdmin(options?: {
  [key: string]: any;
}) {
  return request<API.AdminProfile>("/api/admin/v1/auth/me", {
    method: "GET",
    ...(options || {}),
  });
}

/** 刷新登录令牌 刷新登录令牌。 POST /api/admin/v1/auth/refresh */
export async function adminAuthServiceRefresh(
  body: API.AdminRefreshRequest,
  options?: { [key: string]: any }
) {
  return request<API.AdminLoginReply>("/api/admin/v1/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
