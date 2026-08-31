// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询检测模型站点授权记录列表 查询检测模型站点授权记录列表。 GET /api/admin/v1/inclusion-site-authorizations */
export async function inclusionSiteAuthorizationServiceListInclusionSiteAuthorizations(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.InclusionSiteAuthorizationServiceListInclusionSiteAuthorizationsParams,
  options?: { [key: string]: any }
) {
  return request<API.ListInclusionSiteAuthorizationsReply>(
    "/api/admin/v1/inclusion-site-authorizations",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取检测站点客户授权 获取检测站点客户授权。 GET /api/admin/v1/inclusion-site-authorizations/${param0} */
export async function inclusionSiteAuthorizationServiceGetInclusionSiteAuthorization(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.InclusionSiteAuthorizationServiceGetInclusionSiteAuthorizationParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.CustomerAuthorization>(
    `/api/admin/v1/inclusion-site-authorizations/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 变更检测模型站点授权状态 变更检测模型站点授权状态。 POST /api/admin/v1/inclusion-site-authorizations/${param0}/status */
export async function inclusionSiteAuthorizationServiceChangeInclusionSiteAuthorizationStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.InclusionSiteAuthorizationServiceChangeInclusionSiteAuthorizationStatusParams,
  body: API.ChangeInclusionSiteAuthorizationStatusRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.CustomerAuthorization>(
    `/api/admin/v1/inclusion-site-authorizations/${param0}/status`,
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
