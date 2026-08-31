// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询销售机会列表 查询销售机会列表。 GET /api/admin/v1/sales-opportunities */
export async function salesOpportunityServiceListSalesOpportunities(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SalesOpportunityServiceListSalesOpportunitiesParams,
  options?: { [key: string]: any }
) {
  return request<API.ListSalesOpportunitiesReply>(
    "/api/admin/v1/sales-opportunities",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 创建销售机会 创建销售机会。 POST /api/admin/v1/sales-opportunities */
export async function salesOpportunityServiceCreateSalesOpportunity(
  body: API.CreateSalesOpportunityRequest,
  options?: { [key: string]: any }
) {
  return request<API.SalesOpportunity>("/api/admin/v1/sales-opportunities", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取销售机会 获取销售机会。 GET /api/admin/v1/sales-opportunities/${param0} */
export async function salesOpportunityServiceGetSalesOpportunity(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SalesOpportunityServiceGetSalesOpportunityParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.SalesOpportunity>(
    `/api/admin/v1/sales-opportunities/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新销售机会和客户资料 更新销售机会和客户资料。 PUT /api/admin/v1/sales-opportunities/${param0} */
export async function salesOpportunityServiceUpdateSalesOpportunity(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SalesOpportunityServiceUpdateSalesOpportunityParams,
  body: API.UpdateSalesOpportunityRequest,
  options?: { [key: string]: any }
) {
  const { "opportunity.id": param0, ...queryParams } = params;
  return request<API.SalesOpportunity>(
    `/api/admin/v1/sales-opportunities/${param0}`,
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

/** 变更销售机会状态 变更销售机会状态。 POST /api/admin/v1/sales-opportunities/${param0}/status */
export async function salesOpportunityServiceChangeSalesOpportunityStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SalesOpportunityServiceChangeSalesOpportunityStatusParams,
  body: API.ChangeSalesOpportunityStatusRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.SalesOpportunity>(
    `/api/admin/v1/sales-opportunities/${param0}/status`,
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

/** 检查销售机会客户重复 检查销售机会中的客户是否重复。 GET /api/admin/v1/sales-opportunities%3Acheck-duplicate */
export async function salesOpportunityServiceCheckSalesOpportunityDuplicate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SalesOpportunityServiceCheckSalesOpportunityDuplicateParams,
  options?: { [key: string]: any }
) {
  return request<API.CheckSalesOpportunityDuplicateReply>(
    "/api/admin/v1/sales-opportunities%3Acheck-duplicate",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 查询销售机会负责人 查询可分配的销售负责人。 GET /api/admin/v1/sales-opportunity-owners */
export async function salesOpportunityServiceListSalesOpportunityOwners(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SalesOpportunityServiceListSalesOpportunityOwnersParams,
  options?: { [key: string]: any }
) {
  return request<API.ListSalesOpportunityOwnersReply>(
    "/api/admin/v1/sales-opportunity-owners",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}
