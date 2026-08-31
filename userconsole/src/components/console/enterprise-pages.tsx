"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { LoginSession, Quota } from "@/lib/api/types";
import {
  type UserV1PurchasablePlan,
  type UserV1UserSubscriptionOrder,
  userApi,
} from "@/lib/api/user-api.generated";
import { useConsoleData } from "./console-data-provider";
import { ConfirmDialog, Modal, Toast } from "./modal";

const settingsPageSize = 10;

function useTemporaryToast() {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return [toast, setToast] as const;
}

export function SubscriptionWorkspace() {
  const { accountError, accountLoading, profile, updateProfile } =
    useConsoleData();
  const [toast, setToast] = useTemporaryToast();
  const quotas = profile?.quotas ?? [];

  function exportUsage() {
    const rows = quotas.map((quota) =>
      [
        quotaLabel(quota.metric),
        numericValue(quota.usedValue),
        numericValue(quota.reservedValue),
        numericValue(quota.limitValue),
        quota.period || "-",
        quota.resetAt || "-",
      ]
        .map(csvCell)
        .join(","),
    );
    const csv = ["资源,已使用,已预留,总额度,周期,重置时间", ...rows].join("\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `geohelper-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setToast("用量明细已导出");
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold text-[#3478f6]">企业管理</p>
          <h1 className="mt-2 text-[27px] font-semibold tracking-[-.04em]">
            套餐与用量
          </h1>
          <p className="mt-2 text-sm text-[#717179]">
            查看当前套餐权益、任务额度和本周期用量。
          </p>
        </div>
        <button
          type="button"
          onClick={exportUsage}
          className="glass-control inline-flex h-10 items-center justify-center gap-2 rounded-[14px] px-4 text-xs font-semibold text-[#4d4d54]"
        >
          <Icon name="download" className="h-4 w-4" />
          导出用量
        </button>
      </div>
      <section className="mt-7 overflow-hidden rounded-[24px] border border-white/60 bg-[linear-gradient(135deg,rgba(48,111,230,.92),rgba(111,79,222,.86))] p-6 text-white shadow-[0_24px_55px_rgba(67,85,170,.24),inset_0_1px_0_rgba(255,255,255,.32)] backdrop-blur-2xl sm:p-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold tracking-[.14em] text-[#b9dcff]">
              CURRENT PLAN
            </p>
            <div className="mt-3 flex items-center gap-3">
              <h2 className="text-2xl font-semibold">
                {accountLoading ? "正在加载…" : profile?.planName || "未配置套餐"}
              </h2>
              {profile?.subscriptionStatus ? (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                    profile.subscriptionStatus === "active"
                      ? "bg-white/25 text-white"
                      : "bg-[#fff0ed]/80 text-[#d65a50]"
                  }`}
                >
                  {profile.subscriptionStatus === "active" ? "生效中" : "已过期"}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-white/65">
              有效期至：{formatDate(profile?.subscriptionExpiresAt)}
            </p>
            <p className="mt-1 text-sm text-white/65">
              点数余额：
              <span className="font-semibold text-white">
                {formatPoints(profile?.pointsBalance)}
              </span>
              点
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/console/plans"
              className="h-11 rounded-[14px] border border-white/70 bg-white/75 px-5 text-center text-sm font-semibold leading-[44px] text-[#3159b4] shadow-[0_8px_22px_rgba(24,47,112,.16),inset_0_1px_0_white] hover:bg-white"
            >
              购买 / 续费
            </Link>
            <Link
              href="/console/orders"
              className="h-11 rounded-[14px] border border-white/40 bg-white/10 px-5 text-center text-sm font-semibold leading-[44px] text-white hover:bg-white/20"
            >
              我的订单
            </Link>
          </div>
        </div>
      </section>
      {accountError ? (
        <p className="mt-4 rounded-[14px] bg-[#fff0ed]/75 px-4 py-3 text-xs text-[#d65a50]">
          {accountError}
        </p>
      ) : null}
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {quotas.map((quota) => {
          const percent = quotaPercent(quota);
          return (
            <article key={quota.metric} className="console-card p-5">
              <p className="text-xs text-[#71848a]">
                {quotaLabel(quota.metric)}
              </p>
              <p className="mt-3 text-lg font-semibold">
                {numericValue(quota.usedValue).toLocaleString("zh-CN")} /{" "}
                {numericValue(quota.limitValue).toLocaleString("zh-CN")}
              </p>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#edf2f0]/75">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#4a91ff,#7667f5)]"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-2 text-right text-[11px] text-[#87969a]">
                已使用 {Math.round(percent)}%
              </p>
            </article>
          );
        })}
        {!accountLoading && quotas.length === 0 ? (
          <div className="console-card p-5 text-sm text-[#71848a] md:col-span-3">
            当前套餐尚未配置可用额度，请联系平台运营人员。
          </div>
        ) : null}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="console-card p-5">
          <h2 className="text-sm font-semibold">账单信息</h2>
          <dl className="mt-5 space-y-4 text-xs">
            <div className="flex justify-between">
              <dt className="text-[#7c7c83]">下次续费日期</dt>
              <dd className="font-medium">
                {formatDate(profile?.subscriptionExpiresAt)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#7c7c83]">支付方式</dt>
              <dd className="font-medium">请联系平台确认</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#7c7c83]">账单邮箱</dt>
              <dd className="font-medium">
                {profile?.contactEmail || "未设置"}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => setToast("请在企业设置中修改联系邮箱")}
            className="mt-5 text-xs font-medium text-[#3478f6]"
          >
            编辑账单信息
          </button>
        </section>
        <section className="console-card p-5">
          <h2 className="text-sm font-semibold">额度提醒</h2>
          <p className="mt-2 text-xs leading-6 text-[#77777e]">
            文章额度达到 80% 和 100% 时向管理员发送通知。
          </p>
          <label className="mt-5 flex items-center justify-between rounded-[14px] bg-white/35 p-4 text-xs font-medium">
            <span>启用额度预警</span>
            <input
              type="checkbox"
              checked={quotaWarningEnabled(profile?.notificationJson)}
              disabled={!profile}
              onChange={(event) => {
                const notificationJson = updateNotificationPreference(
                  profile?.notificationJson,
                  "quotaWarningEnabled",
                  event.target.checked,
                );
                void updateProfile({ notificationJson })
                  .then(() => setToast("额度提醒设置已保存"))
                  .catch((caught: unknown) =>
                    setToast(
                      caught instanceof Error
                        ? caught.message
                        : "额度提醒设置保存失败",
                    ),
                  );
              }}
              className="h-4 w-4 accent-[#3478f6]"
            />
          </label>
        </section>
      </div>
      <Toast message={toast} />
    </div>
  );
}

// --- PlansWorkspace (可购套餐) ---

const planMetricLabels: Record<number, string> = {
  1: "文章生成",
  2: "发布任务",
  3: "GEO 检测",
  4: "知识库容量",
  6: "AI 蒸馏",
  7: "品牌档案数",
  9: "关键词总数",
};
const planPeriodLabels: Record<number, string> = {
  1: "每日",
  2: "每月",
  3: "每年",
  4: "套餐期内",
  5: "永久",
};

function formatYuan(minorUnits?: string) {
  if (!minorUnits) return "-";
  const n = Number(minorUnits);
  if (Number.isNaN(n)) return minorUnits;
  return `¥${(n / 100).toFixed(2)}`;
}

function formatPoints(milliPoints?: string) {
  if (!milliPoints) return "-";
  const n = Number(milliPoints);
  if (Number.isNaN(n)) return milliPoints;
  return (n / 1000).toFixed(1);
}

export function PlansWorkspace() {
  const [plans, setPlans] = useState<UserV1PurchasablePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useTemporaryToast();
  const [purchaseTarget, setPurchaseTarget] =
    useState<UserV1PurchasablePlan | null>(null);
  const [purchaseCycle, setPurchaseCycle] = useState("yearly");
  const [purchaseRemark, setPurchaseRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeYuan, setRechargeYuan] = useState("");
  const [rechargeRemark, setRechargeRemark] = useState("");

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reply = await userApi.subscriptionOrder.listPurchasablePlans();
      setPlans(reply.items ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载套餐失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  async function submitPurchase(event: FormEvent) {
    event.preventDefault();
    if (!purchaseTarget?.id) return;
    setSubmitting(true);
    try {
      const amount =
        purchaseCycle === "half_yearly"
          ? purchaseTarget.halfYearlyPriceMinorUnits
          : purchaseTarget.yearlyPriceMinorUnits;
      await userApi.subscriptionOrder.createSubscriptionOrder({
        planId: purchaseTarget.id,
        orderType: "plan",
        cycle: purchaseCycle,
        amountMinorUnits: amount,
        remark: purchaseRemark,
      });
      setToast("购买请求已提交，等待管理员确认");
      setPurchaseTarget(null);
      setPurchaseRemark("");
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRecharge(event: FormEvent) {
    event.preventDefault();
    const credits = Number(rechargeAmount);
    if (!credits || credits <= 0) {
      setToast("请输入有效的充值点数");
      return;
    }
    setSubmitting(true);
    try {
      await userApi.subscriptionOrder.rechargeCredits({
        creditsAmount: String(Math.round(credits * 1000)),
        amountMinorUnits: String(Math.round(Number(rechargeYuan || 0) * 100)),
        remark: rechargeRemark,
      });
      setToast("充值请求已提交，等待管理员确认");
      setRechargeOpen(false);
      setRechargeAmount("");
      setRechargeYuan("");
      setRechargeRemark("");
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "充值失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold text-[#3478f6]">企业管理</p>
          <h1 className="mt-2 text-[27px] font-semibold tracking-[-.04em]">
            可购套餐
          </h1>
          <p className="mt-2 text-sm text-[#717179]">
            选择适合企业的套餐方案，提交后由管理员确认开通。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRechargeOpen(true)}
          className="glass-control inline-flex h-10 items-center justify-center gap-2 rounded-[14px] px-4 text-xs font-semibold text-[#4d4d54]"
        >
          <Icon name="wallet" className="h-4 w-4" />
          充值点数
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-[14px] bg-[#fff0ed]/75 px-4 py-3 text-xs text-[#d65a50]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-center text-sm text-[#717179]">正在加载套餐…</p>
      ) : plans.length === 0 ? (
        <p className="mt-8 text-center text-sm text-[#717179]">
          暂无可购套餐，请联系顾问。
        </p>
      ) : (
        <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="console-card flex flex-col p-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {plan.seriesCode ? (
                  <span className="rounded-full bg-[#eef3ff] px-2.5 py-1 text-[10px] font-semibold text-[#3159b4]">
                    {plan.seriesCode}
                  </span>
                ) : null}
              </div>
              {plan.description ? (
                <p className="mt-2 text-xs leading-5 text-[#7b8c91]">
                  {plan.description}
                </p>
              ) : null}
              <div className="mt-4 flex items-end gap-2">
                {Number(plan.yearlyPriceMinorUnits ?? 0) > 0 ? (
                  <>
                    <span className="text-2xl font-bold text-[#1d1d1f]">
                      {formatYuan(plan.yearlyPriceMinorUnits)}
                    </span>
                    <span className="mb-1 text-xs text-[#717179]">/ 年</span>
                    {Number(plan.halfYearlyPriceMinorUnits ?? 0) > 0 ? (
                      <span className="mb-1 ml-2 text-xs text-[#717179]">
                        半年付 {formatYuan(plan.halfYearlyPriceMinorUnits)}
                      </span>
                    ) : null}
                  </>
                ) : Number(plan.halfYearlyPriceMinorUnits ?? 0) > 0 ? (
                  <>
                    <span className="text-2xl font-bold text-[#1d1d1f]">
                      {formatYuan(plan.halfYearlyPriceMinorUnits)}
                    </span>
                    <span className="mb-1 text-xs text-[#717179]">/ 半年</span>
                  </>
                ) : (
                  <span className="text-base font-semibold text-[#717179]">
                    联系顾问报价
                  </span>
                )}
              </div>
              {Number(plan.grantedPoints ?? 0) > 0 ? (
                <p className="mt-2 text-xs text-[#3159b4]">
                  赠送 {formatPoints(plan.grantedPoints)} 点
                </p>
              ) : null}
              <div className="mt-4 space-y-1.5 border-t border-[#f0f0f3] pt-4">
                {(plan.limits ?? []).map((limit, index) => (
                  <div
                    key={limit.metric ?? index}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-[#717179]">
                      {planMetricLabels[limit.metric ?? 0] ?? `指标 ${limit.metric}`}
                    </span>
                    <span className="font-medium">
                      {numericValue(limit.limitValue).toLocaleString()}
                      <span className="ml-1 text-[#a0a0a8]">
                        / {planPeriodLabels[limit.period ?? 0] ?? "-"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPurchaseTarget(plan);
                  // 根据可用价格自动选择默认周期：优先年付，否则半年付
                  const hasYearly = Number(plan.yearlyPriceMinorUnits ?? 0) > 0;
                  const hasHalfYearly = Number(plan.halfYearlyPriceMinorUnits ?? 0) > 0;
                  setPurchaseCycle(hasYearly ? "yearly" : hasHalfYearly ? "half_yearly" : "yearly");
                  setPurchaseRemark("");
                }}
                className="mt-5 h-11 rounded-[14px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] text-sm font-semibold text-white"
              >
                购买此套餐
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 购买套餐 Modal */}
      <Modal
        open={Boolean(purchaseTarget)}
        onClose={() => setPurchaseTarget(null)}
        title="购买套餐"
        description={purchaseTarget?.name}
      >
        <form onSubmit={submitPurchase} className="space-y-4 p-5 sm:p-6">
          <label className="block">
            <span className="text-xs font-semibold text-[#4d4d54]">计费周期</span>
            <div className="mt-2 flex gap-3">
              {(["half_yearly", "yearly"] as const)
                .filter((cycle) =>
                  cycle === "half_yearly"
                    ? Number(purchaseTarget?.halfYearlyPriceMinorUnits ?? 0) > 0
                    : Number(purchaseTarget?.yearlyPriceMinorUnits ?? 0) > 0,
                )
                .map((cycle) => (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() => setPurchaseCycle(cycle)}
                    className={`h-11 flex-1 rounded-[14px] text-sm font-semibold ${
                      purchaseCycle === cycle
                        ? "bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] text-white"
                        : "glass-control text-[#4d4d54]"
                    }`}
                  >
                    {cycle === "half_yearly" ? "半年付" : "年付"}
                    <span className="ml-2 text-xs opacity-80">
                      {cycle === "half_yearly"
                        ? formatYuan(purchaseTarget?.halfYearlyPriceMinorUnits)
                        : formatYuan(purchaseTarget?.yearlyPriceMinorUnits)}
                    </span>
                  </button>
                ))}
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#4d4d54]">备注（可选）</span>
            <textarea
              value={purchaseRemark}
              onChange={(e) => setPurchaseRemark(e.target.value)}
              rows={3}
              className="input-control mt-2 w-full rounded-[14px] px-3 py-2 text-sm"
              placeholder="如有特殊需求请说明"
            />
          </label>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setPurchaseTarget(null)}
              className="glass-control h-10 rounded-[13px] px-4 text-xs font-semibold"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 rounded-[13px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "提交中…" : "提交购买"}
            </button>
          </div>
        </form>
      </Modal>

      {/* 充值点数 Modal */}
      <Modal
        open={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
        title="充值点数"
        description="提交后由管理员确认到账。1 点 = 1000 毫点。"
      >
        <form onSubmit={submitRecharge} className="space-y-4 p-5 sm:p-6">
          <label className="block">
            <span className="text-xs font-semibold text-[#4d4d54]">充值点数</span>
            <input
              type="number"
              min="1"
              step="1"
              required
              value={rechargeAmount}
              onChange={(e) => setRechargeAmount(e.target.value)}
              className="input-control mt-2 h-11 w-full rounded-[14px] px-3 text-sm"
              placeholder="输入充值点数"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#4d4d54]">支付金额（元）</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rechargeYuan}
              onChange={(e) => setRechargeYuan(e.target.value)}
              className="input-control mt-2 h-11 w-full rounded-[14px] px-3 text-sm"
              placeholder="输入支付金额"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#4d4d54]">备注（可选）</span>
            <textarea
              value={rechargeRemark}
              onChange={(e) => setRechargeRemark(e.target.value)}
              rows={2}
              className="input-control mt-2 w-full rounded-[14px] px-3 py-2 text-sm"
              placeholder="如有特殊需求请说明"
            />
          </label>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setRechargeOpen(false)}
              className="glass-control h-10 rounded-[13px] px-4 text-xs font-semibold"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 rounded-[13px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "提交中…" : "提交充值"}
            </button>
          </div>
        </form>
      </Modal>

      <Toast message={toast} />
    </div>
  );
}

// --- OrdersWorkspace (我的订单) ---

const orderTypeLabels: Record<string, string> = {
  plan: "开通套餐",
  renew: "续费",
  addon: "加购额度",
  credits: "充值点数",
  refund: "退款",
};
const orderStatusLabels: Record<string, string> = {
  pending: "待确认",
  paid: "已支付",
  approved: "已确认",
  cancelled: "已取消",
  refunded: "已退款",
};
const orderStatusColors: Record<string, string> = {
  pending: "bg-[#fff7e6] text-[#b97300]",
  paid: "bg-[#e6f4ff] text-[#1c6ed3]",
  approved: "bg-[#f0f9eb] text-[#4d8b3a]",
  cancelled: "bg-[#f5f5f5] text-[#8a8a91]",
  refunded: "bg-[#fff0ed] text-[#d65a50]",
};
const orderSourceLabels: Record<string, string> = {
  enterprise_self: "企业自购",
  admin_grant: "管理员开通",
  admin_edit: "管理员编辑",
};

export function OrdersWorkspace() {
  const [activeTab, setActiveTab] = useState<"orders" | "plans">("orders");
  const [orders, setOrders] = useState<UserV1UserSubscriptionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useTemporaryToast();
  const [detail, setDetail] = useState<UserV1UserSubscriptionOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("");

  const loadOrders = useCallback(
    async (orderType?: string) => {
      setLoading(true);
      setError(null);
      try {
        const reply = await userApi.subscriptionOrder.listMyOrders(
          orderType ? { orderType } : {},
        );
        setOrders(reply.items ?? []);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "加载订单失败");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function openDetail(order: UserV1UserSubscriptionOrder) {
    if (!order.id) return;
    setDetail(order);
    setDetailLoading(true);
    try {
      const fresh = await userApi.subscriptionOrder.getMyOrder(order.id);
      setDetail(fresh);
    } catch {
      // keep the list item as fallback
    } finally {
      setDetailLoading(false);
    }
  }

  if (activeTab === "plans") {
    return (
      <div>
        <div className="flex gap-2 border-b border-[#f0f0f3] pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("plans")}
            className="h-9 rounded-[12px] px-4 text-xs font-semibold bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] text-white"
          >
            可购套餐
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className="h-9 rounded-[12px] px-4 text-xs font-semibold glass-control text-[#4d4d54]"
          >
            我的订单
          </button>
        </div>
        <PlansWorkspace />
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 border-b border-[#f0f0f3] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("plans")}
          className="h-9 rounded-[12px] px-4 text-xs font-semibold glass-control text-[#4d4d54]"
        >
          可购套餐
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          className="h-9 rounded-[12px] px-4 text-xs font-semibold bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] text-white"
        >
          我的订单
        </button>
      </div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold text-[#3478f6]">企业管理</p>
          <h1 className="mt-2 text-[27px] font-semibold tracking-[-.04em]">
            我的订单
          </h1>
          <p className="mt-2 text-sm text-[#717179]">
            查看套餐购买、续费、充值等订单记录及状态。
          </p>
        </div>
      </div>

      {/* 类型筛选 */}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setFilterType("");
            loadOrders();
          }}
          className={`h-9 rounded-[12px] px-4 text-xs font-semibold ${
            filterType === ""
              ? "bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] text-white"
              : "glass-control text-[#4d4d54]"
          }`}
        >
          全部
        </button>
        {Object.entries(orderTypeLabels).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setFilterType(value);
              loadOrders(value);
            }}
            className={`h-9 rounded-[12px] px-4 text-xs font-semibold ${
              filterType === value
                ? "bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] text-white"
                : "glass-control text-[#4d4d54]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-[14px] bg-[#fff0ed]/75 px-4 py-3 text-xs text-[#d65a50]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-center text-sm text-[#717179]">正在加载订单…</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 text-center text-sm text-[#717179]">暂无订单记录。</p>
      ) : (
        <div className="console-card mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#f0f0f3] text-xs text-[#717179]">
                  <th className="px-5 py-3 font-semibold">订单号</th>
                  <th className="px-5 py-3 font-semibold">类型</th>
                  <th className="px-5 py-3 font-semibold">套餐</th>
                  <th className="px-5 py-3 font-semibold">金额</th>
                  <th className="px-5 py-3 font-semibold">状态</th>
                  <th className="px-5 py-3 font-semibold">来源</th>
                  <th className="px-5 py-3 font-semibold">创建时间</th>
                  <th className="px-5 py-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-[#f5f5f8] last:border-0"
                  >
                    <td className="px-5 py-3 font-mono text-xs">
                      {order.orderNo ?? "-"}
                    </td>
                    <td className="px-5 py-3">
                      {orderTypeLabels[order.orderType ?? ""] ?? order.orderType}
                    </td>
                    <td className="px-5 py-3">
                      {order.planName ?? "-"}
                    </td>
                    <td className="px-5 py-3">
                      {formatYuan(order.amountMinorUnits)}
                      {order.creditsAmount ? (
                        <span className="ml-1 text-xs text-[#717179]">
                          ({formatPoints(order.creditsAmount)} 点)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                          orderStatusColors[order.status ?? ""] ??
                          "bg-[#f5f5f5] text-[#8a8a91]"
                        }`}
                      >
                        {orderStatusLabels[order.status ?? ""] ?? order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {orderSourceLabels[order.source ?? ""] ?? order.source ?? "-"}
                    </td>
                    <td className="px-5 py-3 text-xs text-[#717179]">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => openDetail(order)}
                        className="text-xs font-semibold text-[#3159b4] hover:underline"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 订单详情 Modal */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="订单详情"
        description={detail?.orderNo}
      >
        <div className={`p-5 sm:p-6 ${detailLoading ? "opacity-60" : ""}`}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-[#717179]">订单号</dt>
              <dd className="mt-1 font-mono text-xs">
                {detail?.orderNo ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#717179]">类型</dt>
              <dd className="mt-1">
                {orderTypeLabels[detail?.orderType ?? ""] ?? detail?.orderType}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#717179]">套餐</dt>
              <dd className="mt-1">{detail?.planName ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#717179]">金额</dt>
              <dd className="mt-1">{formatYuan(detail?.amountMinorUnits)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#717179]">币种</dt>
              <dd className="mt-1">{detail?.currency ?? "-"}</dd>
            </div>
            {detail?.creditsAmount ? (
              <div>
                <dt className="text-xs text-[#717179]">充值点数</dt>
                <dd className="mt-1">{formatPoints(detail.creditsAmount)} 点</dd>
              </div>
            ) : null}
            {detail?.cycle ? (
              <div>
                <dt className="text-xs text-[#717179]">计费周期</dt>
                <dd className="mt-1">
                  {detail.cycle === "half_yearly" ? "半年付" : "年付"}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs text-[#717179]">状态</dt>
              <dd className="mt-1">
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                    orderStatusColors[detail?.status ?? ""] ??
                    "bg-[#f5f5f5] text-[#8a8a91]"
                  }`}
                >
                  {orderStatusLabels[detail?.status ?? ""] ?? detail?.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#717179]">来源</dt>
              <dd className="mt-1">
                {orderSourceLabels[detail?.source ?? ""] ?? detail?.source ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#717179]">创建时间</dt>
              <dd className="mt-1 text-xs">
                {formatDateTime(detail?.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#717179]">更新时间</dt>
              <dd className="mt-1 text-xs">
                {formatDateTime(detail?.updatedAt)}
              </dd>
            </div>
          </dl>
          {detail?.remark ? (
            <div className="mt-4 rounded-[14px] bg-[#f9f9fb] px-4 py-3">
              <p className="text-xs font-semibold text-[#4d4d54]">备注</p>
              <p className="mt-1 text-xs text-[#717179]">{detail.remark}</p>
            </div>
          ) : null}
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="glass-control h-10 rounded-[13px] px-4 text-xs font-semibold"
            >
              关闭
            </button>
          </div>
        </div>
      </Modal>

      <Toast message={toast} />
    </div>
  );
}

type SettingsForm = {
  company: string;
  contact: string;
  email: string;
  industry: string;
  phone: string;
  region: string;
};

export function SettingsWorkspace() {
  const {
    accountError,
    accountLoading,
    changePassword: changeAccountPassword,
    profile,
    revokeSession,
    sessions,
    updateProfile,
  } = useConsoleData();
  const [form, setForm] = useState<SettingsForm>({
    company: "",
    contact: "",
    email: "",
    industry: "",
    phone: "",
    region: "",
  });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<LoginSession | null>(null);
  const [sessionPageIndex, setSessionPageIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useTemporaryToast();
  const sessionTotalPages = Math.max(
    1,
    Math.ceil(sessions.length / settingsPageSize),
  );
  const visibleSessions = sessions.slice(
    sessionPageIndex * settingsPageSize,
    (sessionPageIndex + 1) * settingsPageSize,
  );

  useEffect(() => {
    if (!profile) return;
    setForm({
      company: profile.name || "",
      contact: profile.contactName || "",
      email: profile.contactEmail || "",
      industry: profile.industry || "",
      phone: profile.contactPhone || "",
      region: profile.region || "",
    });
  }, [profile]);

  function updateField(field: keyof SettingsForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        contactEmail: form.email,
        contactName: form.contact,
        contactPhone: form.phone,
        industry: form.industry,
        name: form.company,
        region: form.region,
      });
      setToast("企业资料已保存");
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "企业资料保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const currentPassword = String(data.get("current_password"));
    const nextPassword = String(data.get("next_password"));
    if (nextPassword.length < 8) {
      setPasswordError("新密码至少需要 8 个字符");
      return;
    }
    if (nextPassword !== String(data.get("confirm_password"))) {
      setPasswordError("两次输入的新密码不一致");
      return;
    }
    try {
      await changeAccountPassword(currentPassword, nextPassword);
      setPasswordError("");
      setPasswordOpen(false);
      setToast("登录密码已更新");
    } catch (caught) {
      setPasswordError(
        caught instanceof Error ? caught.message : "密码修改失败",
      );
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold text-[#3478f6]">企业管理</p>
      <h1 className="mt-2 text-[27px] font-semibold tracking-[-.04em]">
        企业设置
      </h1>
      <p className="mt-2 text-sm text-[#717179]">
        管理企业基础资料、通知偏好和数据安全设置。
      </p>
      {accountError ? (
        <p className="mt-4 rounded-[14px] bg-[#fff0ed]/75 px-4 py-3 text-xs text-[#d65a50]">
          {accountError}
        </p>
      ) : null}
      <div className="mt-7 grid gap-5 xl:grid-cols-[1fr_320px]">
        <form onSubmit={saveProfile} className="console-card p-6">
          <h2 className="text-[16px] font-semibold">基础信息</h2>
          <p className="mt-1 text-xs text-[#839398]">
            这些信息用于企业识别和报告展示。
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <SettingsInput
              label="企业名称"
              value={form.company}
              onChange={(value) => updateField("company", value)}
            />
            <SettingsInput
              label="所属行业"
              value={form.industry}
              onChange={(value) => updateField("industry", value)}
            />
            <SettingsInput
              label="联系人"
              value={form.contact}
              onChange={(value) => updateField("contact", value)}
            />
            <SettingsInput
              label="联系电话"
              value={form.phone}
              onChange={(value) => updateField("phone", value)}
            />
            <SettingsInput
              label="联系邮箱"
              type="email"
              value={form.email}
              onChange={(value) => updateField("email", value)}
            />
            <SettingsInput
              label="所在地区"
              value={form.region}
              onChange={(value) => updateField("region", value)}
            />
          </div>
          <button
            type="submit"
            disabled={saving || accountLoading || !profile}
            className="mt-6 h-10 rounded-[14px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-5 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(69,112,235,.22)]"
          >
            {saving ? "正在保存…" : "保存设置"}
          </button>
        </form>
        <aside className="space-y-4">
          <div className="console-card p-5">
            <h3 className="text-sm font-semibold">账号安全</h3>
            <p className="mt-2 text-xs leading-5 text-[#7b8c91]">
              企业编号：{profile?.code || "-"}
              <br />
              当前状态：{profile?.status || "-"}
            </p>
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="mt-4 text-xs font-medium text-[#3478f6]"
            >
              修改登录密码
            </button>
          </div>
          <div className="console-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">登录设备</h3>
              <span className="text-[10px] text-[#85858c]">
                {sessions.length} 台
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {visibleSessions.map((session) => (
                <div
                  key={String(session.id)}
                  className="flex items-center justify-between rounded-[12px] bg-white/35 px-3 py-3"
                >
                  <div>
                    <p className="text-[11px] font-medium">
                      {sessionName(session)}
                    </p>
                    <p className="mt-1 text-[10px] text-[#8a8a91]">
                      {session.current
                        ? "当前在线"
                        : `活跃于 ${formatDateTime(session.lastSeenAt)}`}
                    </p>
                  </div>
                  {!session.current ? (
                    <button
                      type="button"
                      onClick={() => setRevokeTarget(session)}
                      className="text-[10px] font-medium text-[#d65a50]"
                    >
                      下线
                    </button>
                  ) : null}
                </div>
              ))}
              {!accountLoading && sessions.length === 0 ? (
                <p className="py-3 text-center text-[11px] text-[#8a8a91]">
                  暂无登录设备
                </p>
              ) : null}
            </div>
            {sessions.length > settingsPageSize ? (
              <div className="mt-3 flex items-center justify-between border-t border-white/60 pt-3 text-[10px] text-[#85858c]">
                <span>每页 {settingsPageSize} 台</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={sessionPageIndex === 0}
                    onClick={() =>
                      setSessionPageIndex((current) => Math.max(0, current - 1))
                    }
                    className="disabled:opacity-40"
                  >
                    上一页
                  </button>
                  <span>
                    {sessionPageIndex + 1}/{sessionTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={sessionPageIndex + 1 >= sessionTotalPages}
                    onClick={() =>
                      setSessionPageIndex((current) =>
                        Math.min(sessionTotalPages - 1, current + 1),
                      )
                    }
                    className="disabled:opacity-40"
                  >
                    下一页
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="console-card p-5">
            <h3 className="text-sm font-semibold">数据与隐私</h3>
            <p className="mt-2 text-xs leading-5 text-[#7b8c91]">
              企业数据按租户隔离，敏感凭据不会在网页端明文保存。
            </p>
          </div>
        </aside>
      </div>
      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="修改登录密码"
        description="修改后其他登录设备将保持在线，可在设备列表中手动下线。"
      >
        <form onSubmit={changePassword} className="space-y-4 p-5 sm:p-6">
          <PasswordInput name="current_password" label="当前密码" />
          <PasswordInput name="next_password" label="新密码" />
          <PasswordInput name="confirm_password" label="确认新密码" />
          {passwordError ? (
            <p className="rounded-[12px] bg-[#fff0ed]/75 px-3 py-2 text-xs text-[#d65a50]">
              {passwordError}
            </p>
          ) : null}
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setPasswordOpen(false)}
              className="glass-control h-10 rounded-[13px] px-4 text-xs font-semibold"
            >
              取消
            </button>
            <button
              type="submit"
              className="h-10 rounded-[13px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-5 text-xs font-semibold text-white"
            >
              确认修改
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="下线登录设备"
        description={`确认让“${revokeTarget ? sessionName(revokeTarget) : ""}”退出登录吗？该设备需要重新验证企业账号。`}
        confirmLabel="确认下线"
        onCancel={() => setRevokeTarget(null)}
        onConfirm={async () => {
          if (!revokeTarget?.id) return;
          try {
            await revokeSession(String(revokeTarget.id));
            if (visibleSessions.length === 1 && sessionPageIndex > 0) {
              setSessionPageIndex((current) => current - 1);
            }
            setRevokeTarget(null);
            setToast("登录设备已下线");
          } catch (caught) {
            setToast(caught instanceof Error ? caught.message : "设备下线失败");
          }
        }}
      />
      <Toast message={toast} />
    </div>
  );
}

function SettingsInput({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: "email" | "text";
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-[#536a72]">
        {label}
      </span>
      <input
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-control h-11 w-full rounded-[14px] px-3 text-sm"
      />
    </label>
  );
}

function PasswordInput({ label, name }: { label: string; name: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-[#536a72]">
        {label}
      </span>
      <input
        required
        minLength={8}
        type="password"
        name={name}
        autoComplete={
          name === "current_password" ? "current-password" : "new-password"
        }
        className="input-control h-11 w-full rounded-[14px] px-3 text-sm"
      />
    </label>
  );
}

function numericValue(value?: number | string) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function quotaPercent(quota: Quota) {
  const limit = numericValue(quota.limitValue);
  if (limit <= 0) return 0;
  return Math.min(100, (numericValue(quota.usedValue) / limit) * 100);
}

function quotaLabel(metric?: string) {
  const labels: Record<string, string> = {
    article_generations: "词条数",
    publish_tasks: "发布篇数",
    geo_queries: "GEO 监测",
    knowledge_bytes: "知识库容量",
    ai_distills: "AI蒸馏使用次数",
    brand_keywords: "品牌关键词",
    custom_keywords: "产品关键词",
  };
  return (metric && labels[metric]) || metric || "未命名资源";
}

function csvCell(value: number | string) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatDate(value?: string) {
  if (!value) return "未设置";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "long" }).format(date);
}

function formatDateTime(value?: string) {
  if (!value) return "未知时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function sessionName(session: LoginSession) {
  const agent = session.userAgent?.split(" ").slice(0, 3).join(" ");
  return [agent || session.deviceId || "未知设备", session.ipAddress]
    .filter(Boolean)
    .join(" · ");
}

function parseNotificationPreferences(value?: string) {
  if (!value) return {} as Record<string, unknown>;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

function quotaWarningEnabled(value?: string) {
  return parseNotificationPreferences(value).quotaWarningEnabled !== false;
}

function updateNotificationPreference(
  value: string | undefined,
  key: string,
  enabled: boolean,
) {
  return JSON.stringify({
    ...parseNotificationPreferences(value),
    [key]: enabled,
  });
}
