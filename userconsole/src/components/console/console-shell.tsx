"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Icon, type IconName } from "@/components/ui/icon";
import { ConsoleDataProvider, useConsoleData } from "./console-data-provider";
import { ConsoleHeaderTools } from "./console-header-tools";
import { RealnamePromptModal } from "./realname-prompt-modal";
import { SubscriptionPromptModal } from "./subscription-prompt-modal";
import { useRealnameStatus } from "@/lib/hooks/use-realname-status";

const NO_AUTH_REQUIRED_PATHS = ["/console/dashboard", "/console/realname"];

// 这些路径不需要套餐（套餐购买、订单、设置等）
const NO_SUBSCRIPTION_REQUIRED_PATHS = [
  "/console/plans",
  "/console/orders",
  "/console/subscription",
  "/console/settings",
  "/console/realname",
  "/console/dashboard",
];

/**
 * 实名认证 + 套餐拦截的统一守卫上下文。
 *
 * 设计目的：
 * 1. Sidebar 与 Dashboard 子页面共享同一份状态，避免重复 fetch；
 * 2. 修复"加载中放行点击"的 bug —— loading 中也 preventDefault，
 *    确保拦截逻辑在状态未就绪时不被绕过；
 * 3. Dashboard 内"快速开始/最新动态/查看详情"等 Link 复用同一拦截逻辑。
 */
type RealnameGuardValue = {
  auth: ReturnType<typeof useRealnameStatus>["auth"];
  isVerified: boolean;
  loading: boolean;
  showAuthModal: boolean;
  showSubscriptionModal: boolean;
  setShowAuthModal: (open: boolean) => void;
  setShowSubscriptionModal: (open: boolean) => void;
  /** 返回一个 onClick handler，用于拦截 Link 跳转。 */
  guard: (href: string, onNavigate?: () => void) => (e: MouseEvent) => void;
};

const RealnameGuardContext = createContext<RealnameGuardValue | null>(null);

function useRealnameGuard() {
  const ctx = useContext(RealnameGuardContext);
  if (!ctx) {
    throw new Error("useRealnameGuard 必须在 ConsoleShell 内使用");
  }
  return ctx;
}

// 导出供 ConsoleShell 子页面（如 Dashboard 快速入口）复用拦截逻辑。
export { useRealnameGuard };

function RealnameGuardProvider({ children }: { children: ReactNode }) {
  const { profile } = useConsoleData();
  const { auth, isVerified, loading } = useRealnameStatus();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  const guard = useCallback(
    (href: string, onNavigate?: () => void) => (e: MouseEvent) => {
      // 加载中也阻止跳转：避免在状态未就绪时绕过拦截。
      // 用户可在加载完成后再点击一次。
      if (loading) {
        e.preventDefault();
        return;
      }

      const isNoAuthPath = NO_AUTH_REQUIRED_PATHS.some(
        (p) => href === p || href.startsWith(`${p}/`),
      );
      // 只要未通过认证（包括未提交、待审核、已拒绝），都拦截并弹窗。
      // 之前的逻辑漏掉了 pending 状态，导致"待审核"时点击不弹窗。
      const needAuth = !isVerified;

      if (needAuth && !isNoAuthPath) {
        e.preventDefault();
        setShowAuthModal(true);
        return;
      }

      // 已实名但未开通套餐时，拦截功能模块访问
      if (isVerified && !isNoAuthPath) {
        const subscriptionStatus = profile?.subscriptionStatus;
        const isNoSubscriptionPath = NO_SUBSCRIPTION_REQUIRED_PATHS.some(
          (p) => href === p || href.startsWith(`${p}/`),
        );
        const hasActiveSubscription = subscriptionStatus === "active";

        if (!hasActiveSubscription && !isNoSubscriptionPath) {
          e.preventDefault();
          setShowSubscriptionModal(true);
          return;
        }
      }

      onNavigate?.();
    },
    [auth, isVerified, loading, profile],
  );

  const value = useMemo<RealnameGuardValue>(
    () => ({
      auth,
      isVerified,
      loading,
      showAuthModal,
      showSubscriptionModal,
      setShowAuthModal,
      setShowSubscriptionModal,
      guard,
    }),
    [
      auth,
      isVerified,
      loading,
      showAuthModal,
      showSubscriptionModal,
      guard,
    ],
  );

  return (
    <RealnameGuardContext.Provider value={value}>
      {children}
      <RealnamePromptModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
      <SubscriptionPromptModal
        open={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />
    </RealnameGuardContext.Provider>
  );
}

function SubscriptionBanner() {
  const { profile, accountLoading } = useConsoleData();
  const pathname = usePathname();

  // Don't show banner on plans/orders/subscription pages (user is already there)
  const isBillingPage =
    pathname === "/console/plans" ||
    pathname === "/console/orders" ||
    pathname === "/console/subscription";

  if (accountLoading || !profile || isBillingPage) return null;

  const subscriptionStatus = profile.subscriptionStatus;
  const isNotSubscribed = !subscriptionStatus || subscriptionStatus === "";
  const isExpired = subscriptionStatus === "expired";
  const pointsBalance = Number(profile.pointsBalance ?? "0");
  const isPointsExhausted =
    subscriptionStatus === "active" && pointsBalance <= 0;

  if (!isNotSubscribed && !isExpired && !isPointsExhausted) return null;

  const getBannerContent = () => {
    if (isNotSubscribed) {
      return {
        text: "您暂未开通服务，请联系管理员开通后使用全部功能。",
        buttonText: "联系管理员",
        buttonHref: "/console/subscription",
        className: "border-[#52c41a]/40 bg-[#f6ffed] text-[#389e0d]",
      };
    }
    if (isExpired) {
      return {
        text: "服务有效期已过，部分功能不可用，请续费后恢复使用。",
        buttonText: "立即续费",
        buttonHref: "/console/plans",
        className: "border-[#f3b64d]/40 bg-[#fff8ed] text-[#8a5a16]",
      };
    }
    return {
      text: "点数余额已耗尽，AI 诊断等按次计费功能不可用，请充值点数。",
      buttonText: "去充值",
      buttonHref: "/console/plans",
      className: "border-[#f0c040]/40 bg-[#fffdf0] text-[#7a6a10]",
    };
  };

  const content = getBannerContent();

  return (
    <div className={`mb-4 flex items-center justify-between gap-4 rounded-[16px] border px-5 py-3.5 text-sm ${content.className}`}>
      <div className="flex items-center gap-2">
        <Icon name="bell" className="h-4 w-4 shrink-0" />
        <span className="font-medium">{content.text}</span>
      </div>
      <Link
        href={content.buttonHref}
        className="shrink-0 rounded-[10px] bg-[#3478f6] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#175ccc]"
      >
        {content.buttonText}
      </Link>
    </div>
  );
}

const navGroups: Array<{
  label: string;
  items: Array<{ href: string; label: string; icon: IconName }>;
}> = [
  {
    label: "概览",
    items: [{ href: "/console/dashboard", label: "工作台", icon: "grid" }],
  },
  {
    label: "内容资产",
    items: [
      { href: "/console/brand", label: "品牌中心", icon: "brand" },
      { href: "/console/knowledge", label: "企业知识", icon: "database" },
      { href: "/console/gallery", label: "企业图库", icon: "image" },
      { href: "/console/keywords", label: "关键词与问题", icon: "target" },
      { href: "/console/articles", label: "文章内容", icon: "article" },
    ],
  },
  {
    label: "增长执行",
    items: [
      { href: "/console/publishing", label: "内容投放", icon: "send" },
      { href: "/console/geo", label: "GEO 洞察", icon: "geo" },
      { href: "/console/authorizations", label: "平台授权", icon: "key" },
    ],
  },
  {
    label: "企业管理",
    items: [
      { href: "/console/dashboard-data", label: "数据报表", icon: "trend" },
      // TODO(P0): requiresFeature 守卫后续接入（feature=6 高级报表），暂对全部已登录用户可见
      { href: "/console/brand-board", label: "品牌看板", icon: "board" },
      { href: "/console/subscription", label: "套餐与用量", icon: "wallet" },
      { href: "/console/orders", label: "我的订单", icon: "receipt" },
      { href: "/console/settings", label: "企业设置", icon: "settings" },
      { href: "/console/realname", label: "实名认证", icon: "shield" },
    ],
  },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { profile } = useConsoleData();
  const { guard } = useRealnameGuard();

  // 基于真实配额计算"本月内容额度"使用率：
  // 取所有月度周期（period === "monthly"）配额的平均使用率。
  // 没有月度配额时退化为全部配额的平均；没有配额时显示 0%。
  const usagePercent = (() => {
    const quotas = profile?.quotas ?? [];
    if (quotas.length === 0) return 0;
    const monthly = quotas.filter((q) => q.period === "monthly");
    const pool = monthly.length > 0 ? monthly : quotas;
    const percents = pool
      .map((q) => {
        const limit = Number(q.limitValue ?? 0);
        if (limit <= 0) return null;
        const used = Number(q.usedValue ?? 0) + Number(q.reservedValue ?? 0);
        return Math.min(100, (used / limit) * 100);
      })
      .filter((v): v is number => v !== null);
    if (percents.length === 0) return 0;
    return Math.round(percents.reduce((a, b) => a + b, 0) / percents.length);
  })();

  return (
    <div className="console-glass-sidebar flex h-full flex-col overflow-hidden rounded-[28px] text-[#1d1d1f]">
      <div className="flex h-[72px] items-center border-b border-white/65 px-5">
        <BrandLogo variant="glass" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-2 px-3 text-[10px] font-semibold tracking-[.16em] text-[#8a8a91]">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href === "/console/articles" &&
                    pathname.startsWith("/console/articles/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={guard(item.href, onNavigate)}
                    className={`group flex h-10 items-center gap-3 rounded-[14px] px-3 text-[13px] font-medium transition ${
                      active
                        ? "bg-white/75 text-[#1d1d1f] shadow-[0_7px_22px_rgba(73,91,130,.12),inset_0_1px_0_rgba(255,255,255,.95)] ring-1 ring-white/80"
                        : "text-[#66666d] hover:bg-white/40 hover:text-[#1d1d1f]"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-[9px] transition ${
                        active
                          ? "bg-[linear-gradient(145deg,#4d9aff,#6b72f6)] text-white shadow-[0_4px_10px_rgba(67,118,241,.28)]"
                          : "text-[#77777e] group-hover:bg-white/60 group-hover:text-[#3478f6]"
                      }`}
                    >
                      <Icon name={item.icon} className="h-4 w-4" />
                    </span>
                    {item.label}
                    {item.label === "平台授权" ? (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#f3b64d]" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/60 p-4">
        <div className="rounded-2xl border border-white/75 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#77777e]">本月内容额度</span>
            <span className="font-semibold text-[#3478f6]">{usagePercent}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dfe4ef]/75">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#3c8cff,#7169f7)]"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <Link
            href="/console/subscription"
            className="mt-3 block text-[11px] font-medium text-[#3478f6] hover:text-[#175ccc]"
          >
            查看套餐与用量 →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // 企业管理下的模块：隐藏顶部导航栏（搜索框等）
  const enterpriseManagementPaths = [
    "/console/dashboard-data",
    "/console/brand-board",
    "/console/subscription",
    "/console/plans",
    "/console/orders",
    "/console/settings",
    "/console/realname",
  ];
  const hideHeader = enterpriseManagementPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  return (
    <ConsoleDataProvider>
      <RealnameGuardProvider>
        <div className="console-canvas lg:pl-[270px]">
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
          >
            <span className="console-orb -left-20 top-[18%] h-72 w-72 bg-[#70bfff]/35" />
            <span className="console-orb -right-28 top-[32%] h-96 w-96 bg-[#b494ff]/25" />
            <span className="console-orb bottom-[-8rem] left-[42%] h-80 w-80 bg-[#66dfc7]/24" />
          </div>
          <aside className="fixed inset-y-3 left-3 z-40 hidden w-[244px] lg:block">
            <Sidebar />
          </aside>

          {mobileOpen ? (
            <div className="fixed inset-0 z-50 lg:hidden">
              <button
                type="button"
                aria-label="关闭导航"
                className="absolute inset-0 bg-[#26324b]/25 backdrop-blur-md"
                onClick={() => setMobileOpen(false)}
              />
              <aside className="absolute inset-y-3 left-3 w-[278px] shadow-2xl">
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </aside>
            </div>
          ) : null}

          {hideHeader ? null : (
            <header className="console-glass-header sticky top-3 z-30 mx-3 flex h-[66px] items-center justify-between rounded-[22px] px-3 sm:mx-5 sm:px-4 lg:mx-6 lg:px-5">
              <ConsoleHeaderTools onOpenMenu={() => setMobileOpen(true)} />
            </header>
          )}

          <main className="relative z-10 mx-auto max-w-[1480px] p-4 pt-7 sm:p-6 sm:pt-8 lg:p-8 lg:pt-9">
            <SubscriptionBanner />
            {children}
          </main>
        </div>
      </RealnameGuardProvider>
    </ConsoleDataProvider>
  );
}
