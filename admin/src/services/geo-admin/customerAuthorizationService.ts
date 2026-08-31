// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询客户授权记录列表 查询客户授权记录列表。 GET /api/admin/v1/customer-authorizations */
export async function customerAuthorizationServiceListCustomerAuthorizations(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.CustomerAuthorizationServiceListCustomerAuthorizationsParams,
  options?: { [key: string]: any }
) {
  return request<API.ListCustomerAuthorizationsReply>(
    "/api/admin/v1/customer-authorizations",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取客户授权 获取客户授权。 GET /api/admin/v1/customer-authorizations/${param0} */
export async function customerAuthorizationServiceGetCustomerAuthorization(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.CustomerAuthorizationServiceGetCustomerAuthorizationParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.CustomerAuthorization>(
    `/api/admin/v1/customer-authorizations/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 变更客户授权状态 变更客户授权状态。 POST /api/admin/v1/customer-authorizations/${param0}/status */
export async function customerAuthorizationServiceChangeCustomerAuthorizationStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.CustomerAuthorizationServiceChangeCustomerAuthorizationStatusParams,
  body: API.ChangeCustomerAuthorizationStatusRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.CustomerAuthorization>(
    `/api/admin/v1/customer-authorizations/${param0}/status`,
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
