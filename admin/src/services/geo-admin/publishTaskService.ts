// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询发布任务列表 查询发布任务列表。 GET /api/admin/v1/publish-tasks */
export async function publishTaskServiceListPublishTasks(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PublishTaskServiceListPublishTasksParams,
  options?: { [key: string]: any }
) {
  return request<API.ListPublishTasksReply>("/api/admin/v1/publish-tasks", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取发布任务 获取发布任务。 GET /api/admin/v1/publish-tasks/${param0} */
export async function publishTaskServiceGetPublishTask(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PublishTaskServiceGetPublishTaskParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.PublishTaskDetail>(
    `/api/admin/v1/publish-tasks/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 取消发布任务 取消发布任务。 POST /api/admin/v1/publish-tasks/${param0}/cancel */
export async function publishTaskServiceCancelPublishTask(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PublishTaskServiceCancelPublishTaskParams,
  body: API.PublishTaskActionRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.PublishTaskDetail>(
    `/api/admin/v1/publish-tasks/${param0}/cancel`,
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

/** 保存投稿回执 保存投稿回执。 PUT /api/admin/v1/publish-tasks/${param0}/receipt */
export async function publishTaskServiceSaveSubmissionReceipt(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PublishTaskServiceSaveSubmissionReceiptParams,
  body: API.SaveSubmissionReceiptRequest,
  options?: { [key: string]: any }
) {
  const { taskId: param0, ...queryParams } = params;
  return request<API.PublishTaskDetail>(
    `/api/admin/v1/publish-tasks/${param0}/receipt`,
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

/** 重试发布任务 重试发布任务。 POST /api/admin/v1/publish-tasks/${param0}/retry */
export async function publishTaskServiceRetryPublishTask(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PublishTaskServiceRetryPublishTaskParams,
  body: API.PublishTaskActionRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.PublishTaskDetail>(
    `/api/admin/v1/publish-tasks/${param0}/retry`,
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
