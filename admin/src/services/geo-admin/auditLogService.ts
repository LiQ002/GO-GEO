// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询审计日志列表 查询审计日志列表。 GET /api/admin/v1/audit-logs */
export async function auditLogServiceListAuditLogs(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AuditLogServiceListAuditLogsParams,
  options?: { [key: string]: any }
) {
  return request<API.ListAuditLogsReply>("/api/admin/v1/audit-logs", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取审计日志 获取审计日志。 GET /api/admin/v1/audit-logs/${param0} */
export async function auditLogServiceGetAuditLog(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AuditLogServiceGetAuditLogParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.AuditLog>(`/api/admin/v1/audit-logs/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}
