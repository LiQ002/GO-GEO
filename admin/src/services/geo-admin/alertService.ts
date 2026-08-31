// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询告警列表 查询告警列表。 GET /api/admin/v1/alerts */
export async function alertServiceListAlerts(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AlertServiceListAlertsParams,
  options?: { [key: string]: any }
) {
  return request<API.ListAlertsReply>("/api/admin/v1/alerts", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取运行告警 获取运行告警。 GET /api/admin/v1/alerts/${param0} */
export async function alertServiceGetAlert(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AlertServiceGetAlertParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.Alert>(`/api/admin/v1/alerts/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 处理运行告警 处理运行告警。 POST /api/admin/v1/alerts/${param0}/resolve */
export async function alertServiceResolveAlert(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AlertServiceResolveAlertParams,
  body: API.ResolveAlertRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.Alert>(`/api/admin/v1/alerts/${param0}/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
