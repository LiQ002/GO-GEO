// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取计费项注册表 获取计费项注册表。 GET /api/admin/v1/billing/action-registry */
export async function billingConfigServiceGetActionRegistry(options?: {
  [key: string]: any;
}) {
  return request<API.ActionRegistryReply>(
    "/api/admin/v1/billing/action-registry",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}

/** 获取计费项单价列表 获取计费项单价列表。 GET /api/admin/v1/billing/unit-costs */
export async function billingConfigServiceGetBillingUnitCosts(options?: {
  [key: string]: any;
}) {
  return request<API.BillingUnitCostsReply>(
    "/api/admin/v1/billing/unit-costs",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}

/** 更新单项计费单价 更新单项计费单价。 PUT /api/admin/v1/billing/unit-costs/${param0} */
export async function billingConfigServiceUpdateBillingUnitCost(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.BillingConfigServiceUpdateBillingUnitCostParams,
  body: API.UpdateBillingUnitCostRequest,
  options?: { [key: string]: any }
) {
  const { action: param0, ...queryParams } = params;
  return request<API.BillingUnitCostsReply>(
    `/api/admin/v1/billing/unit-costs/${param0}`,
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

/** 恢复默认单价 恢复默认单价。 POST /api/admin/v1/billing/unit-costs%3Areset */
export async function billingConfigServiceResetBillingUnitCosts(
  body: API.ResetBillingUnitCostsRequest,
  options?: { [key: string]: any }
) {
  return request<API.BillingUnitCostsReply>(
    "/api/admin/v1/billing/unit-costs%3Areset",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}
