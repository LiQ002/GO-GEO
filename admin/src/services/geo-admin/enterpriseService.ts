// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询企业列表 查询企业列表。 GET /api/admin/v1/enterprises */
export async function enterpriseServiceListEnterprises(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.EnterpriseServiceListEnterprisesParams,
  options?: { [key: string]: any }
) {
  return request<API.ListEnterprisesReply>("/api/admin/v1/enterprises", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建企业 创建企业。 POST /api/admin/v1/enterprises */
export async function enterpriseServiceCreateEnterprise(
  body: API.CreateEnterpriseRequest,
  options?: { [key: string]: any }
) {
  return request<API.EnterpriseDetail>("/api/admin/v1/enterprises", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 更新企业 更新企业。 PUT /api/admin/v1/enterprises/${param0} */
export async function enterpriseServiceUpdateEnterprise(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.EnterpriseServiceUpdateEnterpriseParams,
  body: API.UpdateEnterpriseRequest,
  options?: { [key: string]: any }
) {
  const { "enterprise.id": param0, ...queryParams } = params;
  return request<API.EnterpriseDetail>(`/api/admin/v1/enterprises/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 获取企业 获取企业。 GET /api/admin/v1/enterprises/${param0} */
export async function enterpriseServiceGetEnterprise(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.EnterpriseServiceGetEnterpriseParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.EnterpriseDetail>(`/api/admin/v1/enterprises/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 设置企业配额 设置企业配额。 PUT /api/admin/v1/enterprises/${param0}/quotas/${param1} */
export async function enterpriseServiceSetEnterpriseQuota(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.EnterpriseServiceSetEnterpriseQuotaParams,
  body: API.SetEnterpriseQuotaRequest,
  options?: { [key: string]: any }
) {
  const { enterpriseId: param0, metric: param1, ...queryParams } = params;
  return request<API.QuotaLimit>(
    `/api/admin/v1/enterprises/${param0}/quotas/${param1}`,
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

/** 重置企业密码 重置企业密码。 POST /api/admin/v1/enterprises/${param0}/reset-password */
export async function enterpriseServiceResetEnterprisePassword(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.EnterpriseServiceResetEnterprisePasswordParams,
  body: API.ResetEnterprisePasswordRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.EnterpriseAccount>(
    `/api/admin/v1/enterprises/${param0}/reset-password`,
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

/** 变更企业状态 变更企业状态。 POST /api/admin/v1/enterprises/${param0}/status */
export async function enterpriseServiceChangeEnterpriseStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.EnterpriseServiceChangeEnterpriseStatusParams,
  body: API.ChangeEnterpriseStatusRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.EnterpriseDetail>(
    `/api/admin/v1/enterprises/${param0}/status`,
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

/** 设置企业订阅 设置企业订阅。 PUT /api/admin/v1/enterprises/${param0}/subscription */
export async function enterpriseServiceSetEnterpriseSubscription(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.EnterpriseServiceSetEnterpriseSubscriptionParams,
  body: API.SetEnterpriseSubscriptionRequest,
  options?: { [key: string]: any }
) {
  const { enterpriseId: param0, ...queryParams } = params;
  return request<API.Subscription>(
    `/api/admin/v1/enterprises/${param0}/subscription`,
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
