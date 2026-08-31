// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询工作节点列表 查询工作节点列表。 GET /api/admin/v1/workers */
export async function workerServiceListWorkers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.WorkerServiceListWorkersParams,
  options?: { [key: string]: any }
) {
  return request<API.ListWorkersReply>("/api/admin/v1/workers", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取工作节点 获取工作节点。 GET /api/admin/v1/workers/${param0} */
export async function workerServiceGetWorker(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.WorkerServiceGetWorkerParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.WorkerDetail>(`/api/admin/v1/workers/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 变更工作节点状态 变更工作节点状态。 POST /api/admin/v1/workers/${param0}/status */
export async function workerServiceChangeWorkerStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.WorkerServiceChangeWorkerStatusParams,
  body: API.ChangeWorkerStatusRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.WorkerDetail>(`/api/admin/v1/workers/${param0}/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 注册工作节点 注册工作节点；仅平台管理员可调用。 POST /api/admin/v1/workers/register */
export async function workerServiceRegisterWorker(
  body: API.RegisterWorkerRequest,
  options?: { [key: string]: any }
) {
  return request<API.RegisterWorkerReply>("/api/admin/v1/workers/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
