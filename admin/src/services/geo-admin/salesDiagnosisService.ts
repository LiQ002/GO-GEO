// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询售前诊断历史 查询售前诊断历史列表。 GET /api/admin/v1/sales-diagnoses */
export async function salesDiagnosisServiceListSalesDiagnoses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SalesDiagnosisServiceListSalesDiagnosesParams,
  options?: { [key: string]: any }
) {
  return request<API.ListSalesDiagnosesReply>("/api/admin/v1/sales-diagnoses", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建售前诊断 创建一次独立的售前诊断。 POST /api/admin/v1/sales-diagnoses */
export async function salesDiagnosisServiceCreateSalesDiagnosis(
  body: API.CreateSalesDiagnosisRequest,
  options?: { [key: string]: any }
) {
  return request<API.SalesDiagnosis>("/api/admin/v1/sales-diagnoses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取售前诊断详情 获取售前诊断详情、任务和历史结果。 GET /api/admin/v1/sales-diagnoses/${param0} */
export async function salesDiagnosisServiceGetSalesDiagnosis(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SalesDiagnosisServiceGetSalesDiagnosisParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.SalesDiagnosis>(
    `/api/admin/v1/sales-diagnoses/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 取消售前诊断 取消尚未完成的售前诊断。 POST /api/admin/v1/sales-diagnoses/${param0}%3Acancel */
export async function salesDiagnosisServiceCancelSalesDiagnosis(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SalesDiagnosisServiceCancelSalesDiagnosisParams,
  body: API.CancelSalesDiagnosisRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.SalesDiagnosis>(
    `/api/admin/v1/sales-diagnoses/${param0}%3Acancel`,
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

/** 启动后台售前诊断 将待处理和失败任务提交到后台执行队列并立即返回。 POST /api/admin/v1/sales-diagnoses/${param0}%3Arun */
export async function salesDiagnosisServiceRunSalesDiagnosis(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SalesDiagnosisServiceRunSalesDiagnosisParams,
  body: API.RunSalesDiagnosisRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.SalesDiagnosis>(
    `/api/admin/v1/sales-diagnoses/${param0}%3Arun`,
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

/** 对比两次售前诊断 对比同一客户的两次售前诊断指标。 GET /api/admin/v1/sales-diagnoses%3Acompare */
export async function salesDiagnosisServiceCompareSalesDiagnoses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SalesDiagnosisServiceCompareSalesDiagnosesParams,
  options?: { [key: string]: any }
) {
  return request<API.CompareSalesDiagnosesReply>(
    "/api/admin/v1/sales-diagnoses%3Acompare",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 重试诊断任务 重试一个失败的模型诊断任务。 POST /api/admin/v1/sales-diagnosis-tasks/${param0}%3Aretry */
export async function salesDiagnosisServiceRetrySalesDiagnosisTask(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SalesDiagnosisServiceRetrySalesDiagnosisTaskParams,
  body: API.RetrySalesDiagnosisTaskRequest,
  options?: { [key: string]: any }
) {
  const { taskId: param0, ...queryParams } = params;
  return request<API.SalesDiagnosis>(
    `/api/admin/v1/sales-diagnosis-tasks/${param0}%3Aretry`,
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
