// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取运营总览 获取运营总览。 GET /api/admin/v1/dashboard */
export async function dashboardServiceGetDashboard(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.DashboardServiceGetDashboardParams,
  options?: { [key: string]: any }
) {
  return request<API.Dashboard>("/api/admin/v1/dashboard", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
