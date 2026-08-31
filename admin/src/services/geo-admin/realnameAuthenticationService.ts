// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询实名审核列表 查询实名审核列表。 GET /api/admin/v1/realname-authentications */
export async function realnameAuthenticationServiceListRealnameAuthentications(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RealnameAuthenticationServiceListRealnameAuthenticationsParams,
  options?: { [key: string]: any }
) {
  return request<API.ListRealnameAuthenticationsReply>(
    "/api/admin/v1/realname-authentications",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 删除实名认证记录 删除实名认证记录。 DELETE /api/admin/v1/realname-authentications/${param0} */
export async function realnameAuthenticationServiceDeleteRealnameAuthentication(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RealnameAuthenticationServiceDeleteRealnameAuthenticationParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.DeleteRealnameAuthenticationReply>(
    `/api/admin/v1/realname-authentications/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 审核通过实名认证 审核通过实名认证。 POST /api/admin/v1/realname-authentications/${param0}/approve */
export async function realnameAuthenticationServiceApproveRealnameAuthentication(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RealnameAuthenticationServiceApproveRealnameAuthenticationParams,
  body: API.ApproveRealnameAuthenticationRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.RealnameAuthenticationDetail>(
    `/api/admin/v1/realname-authentications/${param0}/approve`,
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

/** 驳回实名认证 驳回实名认证。 POST /api/admin/v1/realname-authentications/${param0}/reject */
export async function realnameAuthenticationServiceRejectRealnameAuthentication(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RealnameAuthenticationServiceRejectRealnameAuthenticationParams,
  body: API.RejectRealnameAuthenticationRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.RealnameAuthenticationDetail>(
    `/api/admin/v1/realname-authentications/${param0}/reject`,
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
