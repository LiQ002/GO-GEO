// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询系统配置项列表 查询系统配置项列表。 GET /api/admin/v1/system-settings */
export async function systemSettingServiceListSystemSettings(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SystemSettingServiceListSystemSettingsParams,
  options?: { [key: string]: any }
) {
  return request<API.ListSystemSettingsReply>("/api/admin/v1/system-settings", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建系统配置 创建系统配置。 POST /api/admin/v1/system-settings */
export async function systemSettingServiceCreateSystemSetting(
  body: API.CreateSystemSettingRequest,
  options?: { [key: string]: any }
) {
  return request<API.SystemSetting>("/api/admin/v1/system-settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取系统配置 获取系统配置。 GET /api/admin/v1/system-settings/${param0} */
export async function systemSettingServiceGetSystemSetting(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SystemSettingServiceGetSystemSettingParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.SystemSetting>(`/api/admin/v1/system-settings/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除系统配置 删除系统配置。 DELETE /api/admin/v1/system-settings/${param0} */
export async function systemSettingServiceDeleteSystemSetting(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SystemSettingServiceDeleteSystemSettingParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/admin/v1/system-settings/${param0}`, {
    method: "DELETE",
    params: {
      ...queryParams,
    },
    ...(options || {}),
  });
}

/** 更新系统配置 更新系统配置。 PUT /api/admin/v1/system-settings/${param0} */
export async function systemSettingServiceUpdateSystemSetting(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SystemSettingServiceUpdateSystemSettingParams,
  body: API.UpdateSystemSettingRequest,
  options?: { [key: string]: any }
) {
  const { "setting.id": param0, ...queryParams } = params;
  return request<API.SystemSetting>(`/api/admin/v1/system-settings/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
