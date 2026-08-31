// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询 GEO 检测任务列表 查询 GEO 检测任务列表。 GET /api/admin/v1/geo-tasks */
export async function geoTaskServiceListGeoTasks(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GeoTaskServiceListGeoTasksParams,
  options?: { [key: string]: any }
) {
  return request<API.ListGeoTasksReply>("/api/admin/v1/geo-tasks", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取 GEO 检测任务 获取 GEO 检测任务。 GET /api/admin/v1/geo-tasks/${param0} */
export async function geoTaskServiceGetGeoTask(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GeoTaskServiceGetGeoTaskParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.GeoTaskDetail>(`/api/admin/v1/geo-tasks/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 取消 GEO 检测任务 取消 GEO 检测任务。 POST /api/admin/v1/geo-tasks/${param0}/cancel */
export async function geoTaskServiceCancelGeoTask(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GeoTaskServiceCancelGeoTaskParams,
  body: API.GeoTaskActionRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.GeoTaskDetail>(
    `/api/admin/v1/geo-tasks/${param0}/cancel`,
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

/** 创建人工复核 创建人工复核。 POST /api/admin/v1/geo-tasks/${param0}/manual-reviews */
export async function geoTaskServiceCreateManualReview(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GeoTaskServiceCreateManualReviewParams,
  body: API.CreateManualReviewRequest,
  options?: { [key: string]: any }
) {
  const { taskId: param0, ...queryParams } = params;
  return request<API.GeoTaskDetail>(
    `/api/admin/v1/geo-tasks/${param0}/manual-reviews`,
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

/** 重试 GEO 检测任务 重试 GEO 检测任务。 POST /api/admin/v1/geo-tasks/${param0}/retry */
export async function geoTaskServiceRetryGeoTask(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GeoTaskServiceRetryGeoTaskParams,
  body: API.GeoTaskActionRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.GeoTaskDetail>(`/api/admin/v1/geo-tasks/${param0}/retry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
