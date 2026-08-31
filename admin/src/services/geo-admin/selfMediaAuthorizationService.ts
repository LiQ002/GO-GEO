// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询自媒体授权记录列表 查询自媒体授权记录列表。 GET /api/admin/v1/self-media-authorizations */
export async function selfMediaAuthorizationServiceListSelfMediaAuthorizations(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SelfMediaAuthorizationServiceListSelfMediaAuthorizationsParams,
  options?: { [key: string]: any }
) {
  return request<API.ListSelfMediaAuthorizationsReply>(
    "/api/admin/v1/self-media-authorizations",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取自媒体客户授权 获取自媒体客户授权。 GET /api/admin/v1/self-media-authorizations/${param0} */
export async function selfMediaAuthorizationServiceGetSelfMediaAuthorization(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SelfMediaAuthorizationServiceGetSelfMediaAuthorizationParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.CustomerAuthorization>(
    `/api/admin/v1/self-media-authorizations/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 变更自媒体授权状态 变更自媒体授权状态。 POST /api/admin/v1/self-media-authorizations/${param0}/status */
export async function selfMediaAuthorizationServiceChangeSelfMediaAuthorizationStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SelfMediaAuthorizationServiceChangeSelfMediaAuthorizationStatusParams,
  body: API.ChangeSelfMediaAuthorizationStatusRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.CustomerAuthorization>(
    `/api/admin/v1/self-media-authorizations/${param0}/status`,
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
