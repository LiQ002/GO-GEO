// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 上传检测模型站点图标 上传检测模型站点图标。 POST /api/admin/v1/inclusion-site-icons */
export async function inclusionSiteServiceUploadInclusionSiteIcon(
  body: API.UploadInclusionSiteIconRequest,
  options?: { [key: string]: any }
) {
  return request<API.UploadInclusionSiteIconReply>(
    "/api/admin/v1/inclusion-site-icons",
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

/** 查询检测模型站点列表 查询检测模型站点列表。 GET /api/admin/v1/inclusion-sites */
export async function inclusionSiteServiceListInclusionSites(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.InclusionSiteServiceListInclusionSitesParams,
  options?: { [key: string]: any }
) {
  return request<API.ListInclusionSitesReply>("/api/admin/v1/inclusion-sites", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建检测模型站点 创建检测模型站点。 POST /api/admin/v1/inclusion-sites */
export async function inclusionSiteServiceCreateInclusionSite(
  body: API.CreateInclusionSiteRequest,
  options?: { [key: string]: any }
) {
  return request<API.InclusionSite>("/api/admin/v1/inclusion-sites", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取检测模型站点 获取检测模型站点。 GET /api/admin/v1/inclusion-sites/${param0} */
export async function inclusionSiteServiceGetInclusionSite(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.InclusionSiteServiceGetInclusionSiteParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.InclusionSite>(`/api/admin/v1/inclusion-sites/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除检测模型站点 删除检测模型站点。 DELETE /api/admin/v1/inclusion-sites/${param0} */
export async function inclusionSiteServiceDeleteInclusionSite(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.InclusionSiteServiceDeleteInclusionSiteParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/admin/v1/inclusion-sites/${param0}`, {
    method: "DELETE",
    params: {
      ...queryParams,
    },
    ...(options || {}),
  });
}

/** 更新检测模型站点 更新检测模型站点。 PUT /api/admin/v1/inclusion-sites/${param0} */
export async function inclusionSiteServiceUpdateInclusionSite(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.InclusionSiteServiceUpdateInclusionSiteParams,
  body: API.UpdateInclusionSiteRequest,
  options?: { [key: string]: any }
) {
  const { "inclusion_site.id": param0, ...queryParams } = params;
  return request<API.InclusionSite>(`/api/admin/v1/inclusion-sites/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
