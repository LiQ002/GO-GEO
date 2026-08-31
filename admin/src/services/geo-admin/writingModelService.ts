// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询写作模型列表 查询写作模型列表。 GET /api/admin/v1/writing-models */
export async function writingModelServiceListWritingModels(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.WritingModelServiceListWritingModelsParams,
  options?: { [key: string]: any }
) {
  return request<API.ListWritingModelsReply>("/api/admin/v1/writing-models", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建写作模型 创建写作模型。 POST /api/admin/v1/writing-models */
export async function writingModelServiceCreateWritingModel(
  body: API.CreateWritingModelRequest,
  options?: { [key: string]: any }
) {
  return request<API.WritingModel>("/api/admin/v1/writing-models", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取写作模型 获取写作模型。 GET /api/admin/v1/writing-models/${param0} */
export async function writingModelServiceGetWritingModel(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.WritingModelServiceGetWritingModelParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.WritingModel>(`/api/admin/v1/writing-models/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除写作模型 删除写作模型。 DELETE /api/admin/v1/writing-models/${param0} */
export async function writingModelServiceDeleteWritingModel(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.WritingModelServiceDeleteWritingModelParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/admin/v1/writing-models/${param0}`, {
    method: "DELETE",
    params: {
      ...queryParams,
    },
    ...(options || {}),
  });
}

/** 更新写作模型 更新写作模型。 PUT /api/admin/v1/writing-models/${param0} */
export async function writingModelServiceUpdateWritingModel(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.WritingModelServiceUpdateWritingModelParams,
  body: API.UpdateWritingModelRequest,
  options?: { [key: string]: any }
) {
  const { "writing_model.id": param0, ...queryParams } = params;
  return request<API.WritingModel>(`/api/admin/v1/writing-models/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 测试写作模型 测试写作模型。 POST /api/admin/v1/writing-models/${param0}/test */
export async function writingModelServiceTestWritingModel(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.WritingModelServiceTestWritingModelParams,
  body: API.TestWritingModelRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.TestWritingModelReply>(
    `/api/admin/v1/writing-models/${param0}/test`,
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
