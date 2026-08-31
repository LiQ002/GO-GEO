"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import {
  type UserV1GeoReportSummary,
  type UserV1GeoReportTrendPoint,
  type UserV1GeoSitePerformance,
  userApi,
} from "@/lib/api/user-api.generated";
import { useConsoleData } from "./console-data-provider";
import { useRealnameGuard } from "./console-shell";

type SummaryReply = UserV1GeoReportSummary;
type TrendPoint = UserV1GeoReportTrendPoint;
type SitePerformance = UserV1GeoSitePerformance;

export function DashboardWorkspace() {
  const { getRecords, profile, resourceError, resourceLoading } =
    useConsoleData();
  // 复用 ConsoleShell 顶层的实名认证 + 套餐拦截逻辑，
  // 让 Dashboard 内的快速入口（查看详情/最新动态/快速开始）与 Sidebar 行为一致。
  const { guard } = useRealnameGuard();
  const [summary, setSummary] = useState<SummaryReply | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [sites, setSites] = useState<SitePerformance[]>([]);
  const [reportError, setReportError] = useState("");
  const [reportLoading, setReportLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setReportLoading(true);
      try {
        const [nextSummary, nextTrend, nextSites] = await Promise.all([
          userApi.geoReport.getGeoReportSummary(),
          userApi.geoReport.listGeoReportTrend(),
          userApi.geoReport.listGeoSitePerformance(),
        ]);
        if (cancelled) return;
        setSummary(nextSummary);
        setTrend(nextTrend.items ?? []);
        setSites(nextSites.items ?? []);
        setReportError("");
      } catch (caught) {
        if (!cancelled) {
          setReportError(
            caught instanceof Error ? caught.message : "GEO 报告加载失败",
          );
        }
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const articles = getRecords("articles");
  const publishing = getRecords("publishing");
  const geoPlans = getRecords("geo");
  const accounts = getRecords("authorizations");
  const pendingCount = [...publishing, ...geoPlans].filter(
    (record) =>
      !["正常", "已完成", "已停止", "已取消"].includes(
        record.values.at(-1) || "",
      ),
  ).length;
  const expiringAccounts = accounts.filter((record) => {
    const raw = record.raw as { expiresAt?: string };
    if (!raw.expiresAt) return false;
    const remaining = new Date(raw.expiresAt).getTime() - Date.now();
    return remaining > 0 && remaining < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const metrics = summary?.metrics;

  const cards: Array<{
    hint: string;
    icon: IconName;
    label: string;
    tone: string;
    value: string;
  }> = [
    {
      hint: "近 30 天平均分",
      icon: "trend",
      label: "AI 可见度评分",
      tone: "bg-[#e4efff]/80 text-[#3478f6]",
      value: decimal(metrics?.averageVisibilityScore),
    },
    {
      hint: `${Number(metrics?.validAnswers || 0)} 个有效回答`,
      icon: "brand",
      label: "品牌提及率",
      tone: "bg-[#eee9ff]/80 text-[#7457e8]",
      value: percent(metrics?.brandMentionRate),
    },
    {
      hint: `共检查 ${Number(metrics?.totalAnswers || 0)} 个回答`,
      icon: "book",
      label: "引用率",
      tone: "bg-[#e4f7f1]/80 text-[#169c7b]",
      value: percent(metrics?.citationRate),
    },
    {
      hint: expiringAccounts
        ? `${expiringAccounts} 个授权即将过期`
        : "暂无临期授权",
      icon: "layers",
      label: "待处理任务",
      tone: "bg-[#fff0e4]/80 text-[#e57b36]",
      value: String(pendingCount),
    },
  ];

  const activities = useMemo(
    () =>
      [
        ...articles.slice(0, 3).map((record) => ({
          href: "/console/articles",
          id: record.id,
          meta: `文章内容 · ${record.values[3] || "-"}`,
          status: record.values.at(-1) || "-",
          title: record.values[0],
        })),
        ...publishing.slice(0, 3).map((record) => ({
          href: "/console/publishing",
          id: record.id,
          meta: `内容投放 · ${record.values[3] || "-"}`,
          status: record.values.at(-1) || "-",
          title: record.values[0],
        })),
      ].slice(0, 5),
    [articles, publishing],
  );

  const chartMax = Math.max(
    1,
    ...trend.map((item) => Number(item.metrics?.averageVisibilityScore || 0)),
  );
  const enterpriseName = profile?.name || "企业用户";

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-[#87969a]">{formatToday()}</p>
          <h1 className="mt-2 text-[27px] font-semibold tracking-[-.04em] text-[#1d1d1f]">
            欢迎回来，{enterpriseName}
          </h1>
          <p className="mt-2 text-sm text-[#717179]">
            当前有 {pendingCount} 项运行计划需要关注，文章库共 {articles.length}{" "}
            篇内容。
          </p>
        </div>
        <div className="glass-control flex w-fit items-center gap-2 rounded-full px-3 py-2 text-xs text-[#717179]">
          <span
            className={`h-2 w-2 rounded-full ${reportError ? "bg-[#e57b36]" : "bg-[#16b887]"}`}
          />
          {reportLoading
            ? "正在更新报告"
            : `更新于 ${formatDateTime(summary?.generatedAt)}`}
        </div>
      </div>

      {reportError || resourceError ? (
        <p className="mt-5 rounded-[14px] bg-[#fff0ed]/75 px-4 py-3 text-xs text-[#d65a50]">
          {reportError || resourceError}
        </p>
      ) : null}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((metric) => (
          <article key={metric.label} className="console-card lift p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-[#71848a]">
                  {metric.label}
                </p>
                <strong className="mt-3 block text-[30px] font-semibold tracking-[-.045em] text-[#25252a]">
                  {reportLoading || resourceLoading ? "—" : metric.value}
                </strong>
              </div>
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-[13px] ${metric.tone}`}
              >
                <Icon name={metric.icon} className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-[11px] text-[#94a1a5]">{metric.hint}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className="console-card p-5 sm:p-6">
          <div>
            <h2 className="text-[16px] font-semibold">品牌 AI 可见度趋势</h2>
            <p className="mt-1 text-xs text-[#839398]">近 30 天真实监测结果</p>
          </div>
          <div className="mt-7 flex h-[240px] items-end gap-2 rounded-[16px] border border-white/65 bg-white/25 px-4 pb-8 pt-5">
            {trend.map((item) => {
              const score = Number(item.metrics?.averageVisibilityScore || 0);
              return (
                <div
                  key={item.date}
                  className="group flex h-full min-w-0 flex-1 items-end"
                  title={`${item.date}: ${decimal(score)}`}
                >
                  <div
                    className="w-full min-w-1 rounded-t-md bg-[linear-gradient(180deg,#4a91ff,#7667f5)] opacity-85"
                    style={{
                      height: `${Math.max(3, (score / chartMax) * 100)}%`,
                    }}
                  />
                </div>
              );
            })}
            {!reportLoading && trend.length === 0 ? (
              <p className="m-auto text-sm text-[#839398]">暂无趋势数据</p>
            ) : null}
          </div>
          {trend.length ? (
            <div className="mt-2 flex justify-between text-[10px] text-[#93a1a5]">
              <span>{trend[0]?.date}</span>
              <span>{trend.at(-1)?.date}</span>
            </div>
          ) : null}
        </section>

        <section className="console-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-semibold">站点表现</h2>
              <p className="mt-1 text-xs text-[#839398]">近 30 天可见度评分</p>
            </div>
            <Link
              href="/console/geo"
              onClick={guard("/console/geo")}
              className="text-xs font-medium text-[#3478f6]"
            >
              查看详情
            </Link>
          </div>
          <div className="mt-6 space-y-5">
            {sites.map((site) => {
              const score = Number(site.metrics?.averageVisibilityScore || 0);
              return (
                <div key={String(site.inclusionSiteId)}>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium">
                      {site.inclusionSiteName ||
                        `站点 #${site.inclusionSiteId}`}
                    </span>
                    <strong>{decimal(score)}</strong>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#edf2f0]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#4494ff,#7568f4)]"
                      style={{ width: `${Math.min(100, score * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {!reportLoading && sites.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#839398]">
                暂无站点表现数据
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className="console-card overflow-hidden">
          <div className="border-b border-[#e5ecea] px-5 py-4 sm:px-6">
            <h2 className="text-[16px] font-semibold">最新动态</h2>
            <p className="mt-1 text-xs text-[#839398]">
              来自文章与投放计划的真实状态
            </p>
          </div>
          <div className="divide-y divide-[#edf2f0]">
            {activities.map((activity) => (
              <Link
                key={`${activity.href}-${activity.id}`}
                href={activity.href}
                onClick={guard(activity.href)}
                className="flex items-center gap-3 px-5 py-4 sm:px-6"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#e8f1ff]/75 text-[#3478f6]">
                  <Icon name="article" className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {activity.title}
                  </p>
                  <p className="mt-1 text-[11px] text-[#92a0a4]">
                    {activity.meta}
                  </p>
                </div>
                <span className="rounded-full bg-[#e8f8f3] px-2.5 py-1 text-[10px] text-[#008c77]">
                  {activity.status}
                </span>
              </Link>
            ))}
            {!resourceLoading && activities.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-[#839398]">
                暂无业务动态
              </p>
            ) : null}
          </div>
        </section>

        <section className="console-card p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold">快速开始</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["创建文章", "article", "/console/articles/new"],
              ["添加知识", "database", "/console/knowledge"],
              ["新建监测", "geo", "/console/geo"],
              ["授权平台", "key", "/console/authorizations"],
            ].map(([label, icon, href]) => (
              <Link
                key={label}
                href={href as string}
                onClick={guard(href as string)}
                className="lift flex min-h-24 flex-col justify-between rounded-[16px] border border-white/75 bg-white/38 p-4 text-[12px] font-medium"
              >
                <Icon
                  name={icon as IconName}
                  className="h-5 w-5 text-[#3478f6]"
                />
                {label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function percent(value?: number) {
  return `${((value || 0) * 100).toFixed(0)}%`;
}

function decimal(value?: number) {
  return `${((value || 0) * 100).toFixed(0)}%`;
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatToday() {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "full",
  }).format(new Date());
}
