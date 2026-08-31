// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询订单列表 查询订单列表。 GET /api/admin/v1/subscription-orders */
export async function subscriptionOrderServiceListSubscriptionOrders(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SubscriptionOrderServiceListSubscriptionOrdersParams,
  options?: { [key: string]: any }
) {
  return request<API.ListSubscriptionOrdersReply>(
    "/api/admin/v1/subscription-orders",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取订单详情 获取订单详情。 GET /api/admin/v1/subscription-orders/${param0} */
export async function subscriptionOrderServiceGetSubscriptionOrder(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SubscriptionOrderServiceGetSubscriptionOrderParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.SubscriptionOrder>(
    `/api/admin/v1/subscription-orders/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 取消订单 取消订单。 POST /api/admin/v1/subscription-orders/${param0}/cancel */
export async function subscriptionOrderServiceCancelOrder(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SubscriptionOrderServiceCancelOrderParams,
  body: API.CancelOrderRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.SubscriptionOrder>(
    `/api/admin/v1/subscription-orders/${param0}/cancel`,
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

/** 确认到账 确认到账（pending → approved）。 POST /api/admin/v1/subscription-orders/${param0}/confirm */
export async function subscriptionOrderServiceConfirmReceipt(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SubscriptionOrderServiceConfirmReceiptParams,
  body: API.ConfirmReceiptRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.SubscriptionOrder>(
    `/api/admin/v1/subscription-orders/${param0}/confirm`,
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

/** 加购额度 加购额度。 POST /api/admin/v1/subscription-orders/addon */
export async function subscriptionOrderServiceAddonQuota(
  body: API.AddonQuotaRequest,
  options?: { [key: string]: any }
) {
  return request<API.SubscriptionOrder>(
    "/api/admin/v1/subscription-orders/addon",
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

/** 管理员开通套餐 管理员开通套餐。 POST /api/admin/v1/subscription-orders/open-plan */
export async function subscriptionOrderServiceOpenPlan(
  body: API.OpenPlanRequest,
  options?: { [key: string]: any }
) {
  return request<API.SubscriptionOrder>(
    "/api/admin/v1/subscription-orders/open-plan",
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

/** 充值点数 充值点数。 POST /api/admin/v1/subscription-orders/recharge */
export async function subscriptionOrderServiceRechargeCredits(
  body: API.RechargeCreditsRequest,
  options?: { [key: string]: any }
) {
  return request<API.SubscriptionOrder>(
    "/api/admin/v1/subscription-orders/recharge",
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

/** 退款 退款。 POST /api/admin/v1/subscription-orders/refund */
export async function subscriptionOrderServiceRefundOrder(
  body: API.RefundOrderRequest,
  options?: { [key: string]: any }
) {
  return request<API.SubscriptionOrder>(
    "/api/admin/v1/subscription-orders/refund",
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

/** 续费 续费。 POST /api/admin/v1/subscription-orders/renew */
export async function subscriptionOrderServiceRenewSubscription(
  body: API.RenewSubscriptionRequest,
  options?: { [key: string]: any }
) {
  return request<API.SubscriptionOrder>(
    "/api/admin/v1/subscription-orders/renew",
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
