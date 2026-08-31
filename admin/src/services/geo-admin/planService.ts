// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询计划列表 查询计划列表。 GET /api/admin/v1/plans */
export async function planServiceListPlans(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PlanServiceListPlansParams,
  options?: { [key: string]: any }
) {
  return request<API.ListPlansReply>("/api/admin/v1/plans", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建套餐 创建套餐。 POST /api/admin/v1/plans */
export async function planServiceCreatePlan(
  body: API.CreatePlanRequest,
  options?: { [key: string]: any }
) {
  return request<API.Plan>("/api/admin/v1/plans", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取套餐 获取套餐。 GET /api/admin/v1/plans/${param0} */
export async function planServiceGetPlan(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PlanServiceGetPlanParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.Plan>(`/api/admin/v1/plans/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除套餐 删除套餐。 DELETE /api/admin/v1/plans/${param0} */
export async function planServiceDeletePlan(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PlanServiceDeletePlanParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/admin/v1/plans/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新套餐 更新套餐。 PUT /api/admin/v1/plans/${param0} */
export async function planServiceUpdatePlan(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PlanServiceUpdatePlanParams,
  body: API.UpdatePlanRequest,
  options?: { [key: string]: any }
) {
  const { "plan.id": param0, ...queryParams } = params;
  return request<API.Plan>(`/api/admin/v1/plans/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
