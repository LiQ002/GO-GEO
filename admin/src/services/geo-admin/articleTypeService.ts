// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询文章类型列表 查询文章类型列表。 GET /api/admin/v1/article-types */
export async function articleTypeServiceListArticleTypes(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ArticleTypeServiceListArticleTypesParams,
  options?: { [key: string]: any }
) {
  return request<API.ListArticleTypesReply>("/api/admin/v1/article-types", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建文章类型 创建文章类型。 POST /api/admin/v1/article-types */
export async function articleTypeServiceCreateArticleType(
  body: API.CreateArticleTypeRequest,
  options?: { [key: string]: any }
) {
  return request<API.ArticleType>("/api/admin/v1/article-types", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 更新文章类型 更新文章类型。 PUT /api/admin/v1/article-types/${param0} */
export async function articleTypeServiceUpdateArticleType(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ArticleTypeServiceUpdateArticleTypeParams,
  body: API.UpdateArticleTypeRequest,
  options?: { [key: string]: any }
) {
  const { "article_type.id": param0, ...queryParams } = params;
  return request<API.ArticleType>(`/api/admin/v1/article-types/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 获取文章类型 获取文章类型。 GET /api/admin/v1/article-types/${param0} */
export async function articleTypeServiceGetArticleType(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ArticleTypeServiceGetArticleTypeParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.ArticleType>(`/api/admin/v1/article-types/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除文章类型 删除文章类型。 DELETE /api/admin/v1/article-types/${param0} */
export async function articleTypeServiceDeleteArticleType(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ArticleTypeServiceDeleteArticleTypeParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/admin/v1/article-types/${param0}`, {
    method: "DELETE",
    params: {
      ...queryParams,
    },
    ...(options || {}),
  });
}

/** 回滚文章类型 回滚文章类型。 POST /api/admin/v1/article-types/${param0}/rollback */
export async function articleTypeServiceRollbackArticleType(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ArticleTypeServiceRollbackArticleTypeParams,
  body: API.RollbackArticleTypeRequest,
  options?: { [key: string]: any }
) {
  const { articleTypeId: param0, ...queryParams } = params;
  return request<API.ArticleType>(
    `/api/admin/v1/article-types/${param0}/rollback`,
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

/** 查询文章类型版本列表 查询文章类型版本列表。 GET /api/admin/v1/article-types/${param0}/versions */
export async function articleTypeServiceListArticleTypeVersions(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ArticleTypeServiceListArticleTypeVersionsParams,
  options?: { [key: string]: any }
) {
  const { articleTypeId: param0, ...queryParams } = params;
  return request<API.ListArticleTypeVersionsReply>(
    `/api/admin/v1/article-types/${param0}/versions`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 创建文章类型版本 创建文章类型版本（旧客户端兼容；新流程保存文章类型时自动生成修订）。 POST /api/admin/v1/article-types/${param0}/versions */
export async function articleTypeServiceCreateArticleTypeVersion(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ArticleTypeServiceCreateArticleTypeVersionParams,
  body: API.CreateArticleTypeVersionRequest,
  options?: { [key: string]: any }
) {
  const { articleTypeId: param0, ...queryParams } = params;
  return request<API.ArticleTypeVersion>(
    `/api/admin/v1/article-types/${param0}/versions`,
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

/** 发布文章类型版本 发布文章类型版本（旧客户端兼容；新流程无需手工发布）。 POST /api/admin/v1/article-types/${param0}/versions/${param1}/publish */
export async function articleTypeServicePublishArticleTypeVersion(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ArticleTypeServicePublishArticleTypeVersionParams,
  body: API.PublishArticleTypeVersionRequest,
  options?: { [key: string]: any }
) {
  const { articleTypeId: param0, versionId: param1, ...queryParams } = params;
  return request<API.ArticleType>(
    `/api/admin/v1/article-types/${param0}/versions/${param1}/publish`,
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
