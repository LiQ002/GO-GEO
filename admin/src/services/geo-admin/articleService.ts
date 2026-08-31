// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询文章列表 查询文章列表。 GET /api/admin/v1/articles */
export async function articleServiceListArticles(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ArticleServiceListArticlesParams,
  options?: { [key: string]: any }
) {
  return request<API.ListArticlesReply>("/api/admin/v1/articles", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取文章 获取文章。 GET /api/admin/v1/articles/${param0} */
export async function articleServiceGetArticle(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ArticleServiceGetArticleParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.ArticleDetail>(`/api/admin/v1/articles/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 归档文章 归档文章。 POST /api/admin/v1/articles/${param0}/archive */
export async function articleServiceArchiveArticle(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ArticleServiceArchiveArticleParams,
  body: API.ArchiveArticleRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.ArticleDetail>(
    `/api/admin/v1/articles/${param0}/archive`,
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

/** 审核文章 审核文章。 POST /api/admin/v1/articles/${param0}/review */
export async function articleServiceReviewArticle(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ArticleServiceReviewArticleParams,
  body: API.ReviewArticleRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.ArticleDetail>(`/api/admin/v1/articles/${param0}/review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
