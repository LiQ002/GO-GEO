"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type UserV1GeoTask,
  type UserV1GeoDashboard,
  userApi,
} from "@/lib/api/user-api.generated";
import { Icon, type IconName } from "@/components/ui/icon";
import { useConsoleData } from "./console-data-provider";
import { GeoAnswerDrawer } from "./geo-answer-drawer";
import { PublishDetailTable } from "./publish-detail-table";
import { useGeoEvents } from "@/lib/hooks/use-geo-events";

type RangeOption = "7d" | "month" | "year";

const rangeTabs: Array<{ key: RangeOption; label: string }> = [
  { key: "7d", label: "近7天" },
  { key: "month", label: "本月" },
  { key: "year", label: "今年" },
];

// 收录明细分页大小
const DASHBOARD_PAGE_SIZE = 10;

// 将 offset 编码为后端 query.NextToken 兼容的 base64 URL-safe token（无 padding）
function encodePageToken(offset: number): string {
  return btoa(String(offset))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function formatNumber(value?: string | number): string {
  if (value === undefined || value === null || value === "") return "0";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString("zh-CN");
}

function formatDateTime(value?: string) {
  // 与 AI 智推数据看板对齐：YYYY-MM-DD HH:mm:ss
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short" }).format(date);
}

export function DashboardDataWorkspace() {
  const { getChoices, resourceSnapshot } = useConsoleData();
  const [dashboard, setDashboard] = useState<UserV1GeoDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<RangeOption>("7d");
  const [siteFilter, setSiteFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [answerTaskId, setAnswerTaskId] = useState<string | null>(null);
  // 更新时间每秒走动，与 AI 智推数据看板对齐
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboard = useCallback(
    async (nextRange: RangeOption, nextSite: string, nextPage: number) => {
      setLoading(true);
      setError("");
      try {
        const offset = Math.max(0, (nextPage - 1) * DASHBOARD_PAGE_SIZE);
        const data = await userApi.geoMonitor.getGeoDashboard({
          range: nextRange,
          pageSize: DASHBOARD_PAGE_SIZE,
          pageToken: encodePageToken(offset),
          inclusionSiteId: nextSite || undefined,
        });
        setDashboard(data);
        setCurrentPage(nextPage);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "数据看板加载失败");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadDashboard(range, siteFilter, 1);
  }, [range, siteFilter, loadDashboard]);

  // SSE 实时推送：后端写入收录/发文结果后立即推送，收到事件即时刷新
  useGeoEvents({
    onEvent: () => {
      void loadDashboard(range, siteFilter, currentPage);
    },
  });

  const questionChoices = getChoices("questions");
  const keywordChoices = getChoices("keywords");
  const siteChoices = getChoices("inclusionSites");

  // Build label lookup maps from choices
  const questionLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of questionChoices) {
      map.set(q.value, q.label);
    }
    return map;
  }, [questionChoices]);

  const keywordTextMap = useMemo(() => {
    const kwTextMap = new Map<string, string>();
    for (const k of keywordChoices) {
      kwTextMap.set(k.value, k.label);
    }
    // Build keywordId -> keyword text via question -> keywordId lookup
    const map = new Map<string, string>();
    for (const q of questionChoices) {
      const kwId = q.keywordId ?? "";
      map.set(q.value, kwTextMap.get(kwId) ?? "-");
    }
    return map;
  }, [questionChoices, keywordChoices]);

  const siteLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of siteChoices) {
      map.set(s.value, s.label);
    }
    return map;
  }, [siteChoices]);

  // 站点图标映射：id -> icon URL（来自 inclusion-sites 配置）。
  // icon 可能是绝对 URL（阿里云 OSS）或相对路径（/uploads/...）。
  // 相对路径通过 Next.js rewrite 规则代理到 admin 后端。
  const siteIconMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of resourceSnapshot?.inclusionSites ?? []) {
      const sid = String(s.id ?? "");
      if (sid && s.icon) {
        map.set(sid, s.icon);
      }
    }
    return map;
  }, [resourceSnapshot]);

  const company = dashboard?.company;
  const overview = dashboard?.overview;
  const trend = dashboard?.trend ?? [];
  const siteStats = dashboard?.siteStats ?? [];
  const topKeywords = dashboard?.topKeywords ?? [];
  const tasks = dashboard?.tasks ?? [];

  // 收录明细平台过滤选项：全部 + 出现在 siteStats 中的所有平台
  const siteFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ value: string; label: string }> = [
      { value: "", label: "全部" },
    ];
    for (const s of siteStats) {
      const sid = String(s.inclusionSiteId ?? "");
      if (!sid || seen.has(sid)) continue;
      seen.add(sid);
      list.push({
        value: sid,
        label: s.siteName || siteLabelMap.get(sid) || `站点 #${sid}`,
      });
    }
    return list;
  }, [siteStats, siteLabelMap]);

  const totalIncluded = Number(overview?.totalIncluded ?? 0);
  const recentIncluded = Number(overview?.recentIncluded ?? 0);
  const publishedArticles = Number(overview?.publishedArticles ?? 0);
  const contactExposure = Number(overview?.contactExposure ?? 0);
  const aiTrainingCount = Number(company?.aiTrainingCount ?? 0);

  const overviewCards: Array<{
    hint: string;
    icon: IconName;
    label: string;
    tone: string;
    value: number;
  }> = [
    {
      hint: "企业级累计收录",
      icon: "trend",
      label: "收录总量",
      tone: "bg-[#e4efff]/80 text-[#3478f6]",
      value: totalIncluded,
    },
    {
      hint: "近 30 天新增收录",
      icon: "sparkles",
      label: "近30天收录量",
      tone: "bg-[#eee9ff]/80 text-[#7457e8]",
      value: recentIncluded,
    },
    {
      hint: "已发布状态的文章数",
      icon: "article",
      label: "文章发布量",
      tone: "bg-[#e4f7f1]/80 text-[#169c7b]",
      value: publishedArticles,
    },
    {
      hint: "AI 回答中提及联系电话的次数",
      icon: "brand",
      label: "联系方式曝光量",
      tone: "bg-[#fff0e4]/80 text-[#e57b36]",
      value: contactExposure,
    },
  ];

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3478f6]">
            <Icon name="trend" className="h-4 w-4" />
            数据报表
          </div>
          <h1 className="mt-2 text-[27px] font-semibold tracking-[-.04em] text-[#1d1d1f]">
            AI 数据报表
          </h1>
          <p className="mt-2 text-sm text-[#717179]">
            企业级 GEO 收录数据总览，实时同步
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadDashboard(range, siteFilter, currentPage)}
            disabled={loading}
            className="glass-control inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[#5f5f66] transition hover:text-[#1d1d1f] disabled:opacity-60"
          >
            <Icon name="sparkles" className="h-3.5 w-3.5" />
            刷新
          </button>
          <div className="glass-control flex w-fit items-center gap-2 rounded-full px-3 py-2 text-xs text-[#717179]">
            <span
              className={`h-2 w-2 rounded-full ${error ? "bg-[#e57b36]" : "bg-[#16b887]"}`}
            />
            {loading
              ? "正在更新"
              : `更新时间 ${formatDateTime(new Date(now).toISOString())}`}
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-5 rounded-[14px] bg-[#fff0ed]/75 px-4 py-3 text-xs text-[#d65a50]">
          {error}
        </p>
      ) : null}

      <div className="mt-7 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <CompanyCard
          name={company?.enterpriseName}
          onlineAt={company?.onlineAt}
          expireAt={company?.expireAt}
          contact={company?.contact}
          website={company?.website}
          aiTrainingCount={aiTrainingCount}
          keywordCount={Number(company?.keywordCount ?? 0)}
          questionCount={Number(company?.questionCount ?? 0)}
          brandName={company?.brandName}
          brandNames={company?.brandNames}
          keywords={company?.keywords ?? []}
          loading={loading}
        />

        <section className="console-card p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold tracking-[-.02em] text-[#25252a]">
            数据总览
          </h2>
          <p className="mt-1 text-xs text-[#717179]">
            企业级 GEO 收录数据汇总
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {overviewCards.map((metric) => (
              <div
                key={metric.label}
                className="lift rounded-[14px] border border-white/70 bg-white/45 p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-[#71848a]">
                    {metric.label}
                  </p>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-[9px] ${metric.tone}`}
                  >
                    <Icon name={metric.icon} className="h-3.5 w-3.5" />
                  </span>
                </div>
                <strong className="mt-3 block text-[24px] font-semibold tracking-[-.035em] text-[#25252a]">
                  {loading ? "—" : formatNumber(metric.value)}
                </strong>
                <p className="mt-1 text-[10px] text-[#94a1a5]">{metric.hint}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="console-card mt-5 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[16px] font-semibold tracking-[-.02em] text-[#25252a]">
              收录量趋势图
            </h2>
            <p className="mt-1 text-xs text-[#717179]">
              按日期聚合的 brand_mentioned=true 收录量
            </p>
          </div>
          <div className="glass-control inline-flex items-center rounded-full p-1">
            {rangeTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setRange(tab.key)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                  range === tab.key
                    ? "bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] text-white shadow"
                    : "text-[#717179] hover:text-[#1d1d1f]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 rounded-[10px] bg-[#f4f8fd] p-3">
          <TrendChart trend={trend} loading={loading} />
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="console-card p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold tracking-[-.02em] text-[#25252a]">
            分平台收录量
          </h2>
          <p className="mt-1 text-xs text-[#717179]">
            按 AI 平台分组的收录次数
          </p>
          <div className="mt-5 rounded-[10px] bg-[#f4f8fd] p-3">
            <SiteRingChart siteStats={siteStats} loading={loading} />
          </div>
        </section>

        <section className="console-card p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold tracking-[-.02em] text-[#25252a]">
            Top 热词榜
          </h2>
          <p className="mt-1 text-xs text-[#717179]">
            AI 收录次数最多的问题排行（Top 10）
          </p>
          <div className="mt-5 rounded-[10px] bg-[#f4f8fd] p-3">
            <TopKeywordGrid topKeywords={topKeywords} loading={loading} />
          </div>
        </section>
      </div>

      <section className="console-card mt-5 overflow-hidden">
        <div className="border-b border-white/70 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[16px] font-semibold tracking-[-.02em] text-[#25252a]">
                收录明细
              </h2>
              <p className="mt-0.5 text-[11px] text-[#717179]">
                申明：AI 大模型搜索结果千人千面，报表检测结果以系统检测结果为准，若有波动属于合理范围，可以尝试多个设备进行检索！
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {siteFilterOptions.map((opt) => (
                <button
                  key={opt.value || "all"}
                  type="button"
                  onClick={() => setSiteFilter(opt.value)}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                    siteFilter === opt.value
                      ? "bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] text-white shadow"
                      : "bg-white/60 text-[#717179] hover:text-[#1d1d1f]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="border-b border-white/70 bg-white/40">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#717179]">
                  关键词
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#717179]">
                  问题
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#717179]">
                  收录平台
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#717179]">
                  监测端
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#717179]">
                  监测状态
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#717179]">
                  查询时间
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#717179]">
                  官方快照
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[12px] text-[#9a9aa0]">
                    暂无收录明细
                  </td>
                </tr>
              ) : null}
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[12px] text-[#9a9aa0]">
                    <Icon name="sparkles" className="mr-1 inline h-4 w-4 animate-pulse" />
                    正在加载…
                  </td>
                </tr>
              ) : null}
              {!loading
                ? tasks.map((task: UserV1GeoTask) => (
                    <TaskRow
                      key={String(task.id)}
                      task={task}
                      questionLabelMap={questionLabelMap}
                      keywordTextMap={keywordTextMap}
                      siteLabelMap={siteLabelMap}
                      siteIconMap={siteIconMap}
                      onViewAnswer={(id) => setAnswerTaskId(id)}
                    />
                  ))
                : null}
            </tbody>
          </table>
        </div>
        <DashboardPagination
          total={Number(dashboard?.totalSize ?? 0)}
          pageSize={DASHBOARD_PAGE_SIZE}
          current={currentPage}
          loading={loading}
          onChange={(page) => void loadDashboard(range, siteFilter, page)}
        />
      </section>

      {/* 发布详情 */}
      <PublishDetailTable
        articles={resourceSnapshot?.articles ?? []}
        brands={resourceSnapshot?.brands ?? []}
        articleTypes={resourceSnapshot?.articleTypes ?? []}
        publishChannels={resourceSnapshot?.publishChannels ?? []}
        publishTargets={resourceSnapshot?.publishTargets ?? []}
        loading={loading}
      />

      <GeoAnswerDrawer
        open={answerTaskId !== null}
        taskId={answerTaskId}
        onClose={() => setAnswerTaskId(null)}
      />
    </div>
  );
}

type CompanyCardProps = {
  name?: string;
  onlineAt?: string;
  expireAt?: string;
  contact?: string;
  website?: string;
  aiTrainingCount: number;
  keywordCount: number;
  questionCount: number;
  brandName?: string;
  brandNames?: string[];
  keywords: string[];
  loading: boolean;
};

function CompanyCard({
  name,
  onlineAt,
  expireAt,
  contact,
  website,
  aiTrainingCount,
  keywordCount,
  questionCount,
  brandName,
  brandNames,
  keywords,
  loading,
}: CompanyCardProps) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "上线时间", value: formatDate(onlineAt) },
    { label: "到期时间", value: formatDate(expireAt) },
    { label: "联系方式", value: contact || "请完善信息" },
    { label: "官网地址", value: website || "请完善信息" },
  ];
  return (
    <section className="console-card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold tracking-[-.02em] text-[#25252a]">
          企业名片
        </h2>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-[12px] border border-white/70 bg-white/40 px-3 py-2.5 text-center">
          <p className="text-[10px] font-medium text-[#71848a]">AI 训练量</p>
          <strong className="mt-1 block text-[18px] font-semibold tracking-[-.02em] text-[#3478f6]">
            {loading ? "—" : formatNumber(aiTrainingCount)}
          </strong>
        </div>
        <div className="rounded-[12px] border border-white/70 bg-white/40 px-3 py-2.5 text-center">
          <p className="text-[10px] font-medium text-[#71848a]">关键词</p>
          <strong className="mt-1 block text-[18px] font-semibold tracking-[-.02em] text-[#7457e8]">
            {loading ? "—" : formatNumber(keywordCount)}
          </strong>
        </div>
        <div className="rounded-[12px] border border-white/70 bg-white/40 px-3 py-2.5 text-center">
          <p className="text-[10px] font-medium text-[#71848a]">词条总量</p>
          <strong className="mt-1 block text-[18px] font-semibold tracking-[-.02em] text-[#169c7b]">
            {loading ? "—" : formatNumber(questionCount)}
          </strong>
        </div>
      </div>
      <p className="mt-3 text-[20px] font-semibold tracking-[-.02em] text-[#1d1d1f]">
        {loading ? "—" : name || "未命名企业"}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <p className="text-[11px] font-medium text-[#71848a]">
              {row.label}
            </p>
            <p className="mt-1 truncate text-[13px] font-medium text-[#3a3a40]" title={row.value}>
              {loading ? "—" : row.value}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-[14px] border border-white/70 bg-white/40 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium text-[#71848a]">AI 画像</p>
          <p className="text-[10px] text-[#9aa5a8]">品牌词 + 关键词</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {loading ? (
            <span className="text-[12px] text-[#9a9aa0]">—</span>
          ) : null}
          {!loading && brandNames && brandNames.length > 0
            ? brandNames.map((bn, idx) => (
                <span
                  key={`brand-${bn}-${idx}`}
                  className="rounded-full bg-[linear-gradient(145deg,#7457e8,#5b3fd6)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm"
                >
                  {bn}
                </span>
              ))
            : null}
          {!loading && (!brandNames || brandNames.length === 0) && brandName ? (
            <span
              className="rounded-full bg-[linear-gradient(145deg,#7457e8,#5b3fd6)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm"
            >
              {brandName}
            </span>
          ) : null}
          {!loading && (!brandNames || brandNames.length === 0) && !brandName ? (
            <span className="text-[12px] text-[#9a9aa0]">暂无品牌词</span>
          ) : null}
          {!loading && keywords.length === 0 ? (
            <span className="text-[12px] text-[#9a9aa0]">暂无关键词</span>
          ) : null}
          {!loading
            ? keywords.map((kw, idx) => (
                <span
                  key={`${kw}-${idx}`}
                  className="rounded-full bg-[#e4efff]/80 px-2.5 py-1 text-[11px] font-medium text-[#3478f6]"
                >
                  {kw}
                </span>
              ))
            : null}
        </div>
      </div>
    </section>
  );
}

type DashboardPaginationProps = {
  total: number;
  pageSize: number;
  current: number;
  loading: boolean;
  onChange: (page: number) => void;
};

// DashboardPagination 收录明细分页：左侧"当前页/总页数 + 每页条数"
// 右侧：上一页 + 页码(1 2 3 4 5 6 … 末页) + 向后5页 + 下一页 + 跳转输入框 + 跳转
// 与参考设计 https://aigeo.hebeirongshi.com/web/#/dashboard 的分页保持一致
function DashboardPagination({
  total,
  pageSize,
  current,
  loading,
  onChange,
}: DashboardPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [jumpValue, setJumpValue] = useState("");

  if (total === 0) {
    return null;
  }

  // 生成页码列表：首页 … 当前页前后两页 … 末页
  const pages: Array<number | "ellipsis"> = [];
  const addPage = (p: number) => {
    if (p >= 1 && p <= totalPages && !pages.includes(p)) pages.push(p);
  };
  addPage(1);
  if (current - 2 > 2) pages.push("ellipsis");
  for (let p = current - 2; p <= current + 2; p++) addPage(p);
  if (current + 2 < totalPages - 1) pages.push("ellipsis");
  addPage(totalPages);
  // 去重并排序
  const sortedPages = [...new Set(pages)];

  const canPrev = current > 1 && !loading;
  const canNext = current < totalPages && !loading;
  // 向后5页：从当前页跳5页，不超过总页数；向前5页同理
  const canForward5 = current + 5 <= totalPages && !loading;
  const canBackward5 = current - 5 >= 1 && !loading;

  const handleJump = () => {
    const p = Number.parseInt(jumpValue, 10);
    if (Number.isFinite(p) && p >= 1 && p <= totalPages) {
      onChange(p);
    }
    setJumpValue("");
  };

  return (
    <div className="flex flex-col gap-2 border-t border-white/70 px-5 py-3 text-[11px] text-[#717179] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      {/* 左侧：当前页 / 总页数 + 每页条数（对齐参考设计） */}
      <span className="whitespace-nowrap">
        {current} / {totalPages} 页 · {pageSize}条/页
      </span>
      {/* 右侧：上一页 + 页码 + 向后5页 + 下一页 + 跳转 */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => canPrev && onChange(current - 1)}
          disabled={!canPrev}
          className="inline-flex h-7 items-center gap-0.5 rounded-[8px] bg-white/60 px-2 text-[11px] font-medium text-[#5f5f66] transition hover:bg-white hover:text-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="arrow-left" className="h-3 w-3" />
          上一页
        </button>
        {/* 向前5页（仅当不在首页区时显示） */}
        {canBackward5 ? (
          <button
            type="button"
            onClick={() => onChange(Math.max(1, current - 5))}
            disabled={loading}
            className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-[8px] bg-white/60 px-1.5 text-[11px] font-medium text-[#5f5f66] transition hover:bg-white hover:text-[#1d1d1f] disabled:opacity-40"
            title={`向前5页 (第${Math.max(1, current - 5)}页)`}
          >
            ‹
          </button>
        ) : null}
        {sortedPages.map((p, idx) =>
          p === "ellipsis" ? (
            <span key={`e-${idx}`} className="px-1 text-[#9aa5a8]">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => !loading && onChange(p)}
              className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-[8px] px-1.5 text-[11px] font-medium transition disabled:opacity-40 ${
                p === current
                  ? "bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] text-white shadow"
                  : "bg-white/60 text-[#5f5f66] hover:bg-white hover:text-[#1d1d1f]"
              }`}
            >
              {p}
            </button>
          ),
        )}
        {/* 向后5页（仅当不在末页区时显示） */}
        {canForward5 ? (
          <button
            type="button"
            onClick={() => onChange(Math.min(totalPages, current + 5))}
            disabled={loading}
            className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-[8px] bg-white/60 px-1.5 text-[11px] font-medium text-[#5f5f66] transition hover:bg-white hover:text-[#1d1d1f] disabled:opacity-40"
            title={`向后5页 (第${Math.min(totalPages, current + 5)}页)`}
          >
            ›
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => canNext && onChange(current + 1)}
          disabled={!canNext}
          className="inline-flex h-7 items-center gap-0.5 rounded-[8px] bg-white/60 px-2 text-[11px] font-medium text-[#5f5f66] transition hover:bg-white hover:text-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-40"
        >
          下一页
          <Icon name="arrow-right" className="h-3 w-3" />
        </button>
        {/* 跳转：超过5页时显示 */}
        {totalPages > 5 ? (
          <span className="ml-1 flex items-center gap-1">
            <input
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJump();
              }}
              className="h-7 w-12 rounded-[8px] border border-white/70 bg-white/60 px-2 text-center text-[11px] text-[#1d1d1f] outline-none focus:border-[#3f8fff]/60"
              placeholder="页码"
            />
            <button
              type="button"
              onClick={handleJump}
              disabled={loading}
              className="inline-flex h-7 items-center rounded-[8px] bg-[#3f8fff]/10 px-2 text-[11px] font-medium text-[#3f8fff] transition hover:bg-[#3f8fff]/20 disabled:opacity-40"
            >
              跳转
            </button>
          </span>
        ) : null}
      </div>
    </div>
  );
}

type TaskRowProps = {
  task: UserV1GeoTask;
  questionLabelMap: Map<string, string>;
  keywordTextMap: Map<string, string>;
  siteLabelMap: Map<string, string>;
  siteIconMap: Map<string, string>;
  onViewAnswer: (id: string) => void;
};

function TaskRow({
  task,
  questionLabelMap,
  keywordTextMap,
  siteLabelMap,
  siteIconMap,
  onViewAnswer,
}: TaskRowProps) {
  const qid = String(task.questionId ?? "");
  const sid = String(task.inclusionSiteId ?? "");
  const qLabel = questionLabelMap.get(qid) ?? `问题 #${task.questionId}`;
  const kLabel = keywordTextMap.get(qid) ?? "-";
  const sLabel =
    siteLabelMap.get(sid) ?? `站点 #${task.inclusionSiteId}`;
  const siteIcon = siteIconMap.get(sid);
  const queryTime = task.completedAt ?? task.scheduledAt;
  const hasSessionRef = Boolean(task.sessionRef);

  return (
    <tr className="border-b border-white/55 last:border-0 hover:bg-white/40">
      <td
        className="max-w-[120px] truncate px-4 py-3 text-[12px] font-medium text-[#3a3a40]"
        title={kLabel}
      >
        {kLabel}
      </td>
      <td
        className="max-w-[260px] truncate px-4 py-3 text-[12px] text-[#3a3a40]"
        title={qLabel}
      >
        {qLabel}
      </td>
      <td className="px-4 py-3 text-[12px] text-[#5f5f66]">
        <span className="inline-flex items-center gap-1.5 align-middle">
          {siteIcon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={siteIcon}
              alt={sLabel}
              className="h-5 w-5 shrink-0 rounded-[3px] object-contain"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <span className="truncate">{sLabel}</span>
        </span>
      </td>
      <td className="px-4 py-3 text-[12px] text-[#5f5f66]">
        {task.terminalType === 2 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#3f8fff]/10 px-2 py-0.5 text-[10px] font-semibold text-[#3f8fff]">
            <Icon name="mobile" className="h-3 w-3" />
            移动端
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#717179]/15 px-2 py-0.5 text-[10px] font-semibold text-[#717179]">
            <Icon name="monitor" className="h-3 w-3" />
            电脑端
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {task.brandMentioned ? (
          <span className="inline-flex items-center rounded-full bg-[#1f9d63]/15 px-2 py-0.5 text-[10px] font-semibold text-[#1f9d63]">
            收录
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-[#9a9aa0]/15 px-2 py-0.5 text-[10px] font-semibold text-[#717179]">
            未收录
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-[11px] text-[#717179]">
        {formatDateTime(queryTime)}
      </td>
      <td className="px-4 py-3 text-right">
        {hasSessionRef ? (
          <a
            href={task.sessionRef}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-[#3f8fff]/10 px-2.5 text-[11px] font-medium text-[#3f8fff] transition hover:bg-[#3f8fff]/20"
          >
            <Icon name="eye" className="h-3.5 w-3.5" />
            查看内容 &gt;
          </a>
        ) : (
          <button
            type="button"
            onClick={() => onViewAnswer(String(task.id))}
            className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-[#3f8fff]/10 px-2.5 text-[11px] font-medium text-[#3f8fff] transition hover:bg-[#3f8fff]/20"
          >
            <Icon name="eye" className="h-3.5 w-3.5" />
            查看内容 &gt;
          </button>
        )}
      </td>
    </tr>
  );
}

// ============================================================
// 图表组件：SVG 实现，无需第三方依赖
// ============================================================

// 趋势图主色严格对齐 AI 智推数据看板 #70A0EB
const TREND_COLORS = ["#70A0EB", "#70A0EB"];
const RING_COLORS = [
  "#3f8fff",
  "#6e6af4",
  "#36c2a8",
  "#ffb547",
  "#ff7a8a",
  "#8b5cf6",
  "#22c55e",
  "#f43f5e",
];

type TrendChartProps = {
  trend: Array<{ date?: string; included?: string | number }>;
  loading: boolean;
};

// TrendChart 收录量趋势图 - 折线图
function TrendChart({ trend, loading }: TrendChartProps) {
  const W = 680;
  const H = 220;
  const padL = 36;
  const padR = 16;
  const padT = 20;
  const padB = 30;
  const plotW = W - padL - padR;
  // 鼠标悬停的数据点索引（对齐 AI 智推数据看板 tooltip 行为）
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const plotH = H - padT - padB;

  const points = trend.map((p) => ({
    date: p.date ?? "",
    v: Number(p.included ?? 0),
  }));
  const maxV = Math.max(1, ...points.map((p) => p.v));
  const n = points.length;

  if (loading) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[11px] text-[#9aa5a8]">
        <Icon name="sparkles" className="mr-1 inline h-4 w-4 animate-pulse" />
        正在加载…
      </div>
    );
  }
  if (n === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[12px] text-[#9aa5a8]">
        暂无趋势数据
      </div>
    );
  }

  const xAt = (i: number) =>
    n === 1 ? padL + plotW / 2 : padL + (plotW * i) / (n - 1);
  const yAt = (v: number) => padT + plotH - (v / maxV) * plotH;

  // 折线图：直线段连接，避免样条曲线在数据突变时过冲凹陷
  const pathD = (() => {
    if (n === 1) return `M ${xAt(0)} ${yAt(points[0].v)}`;
    let d = `M ${xAt(0)} ${yAt(points[0].v)}`;
    for (let i = 1; i < n; i++) {
      d += ` L ${xAt(i)} ${yAt(points[i].v)}`;
    }
    return d;
  })();

  // 面积填充路径：折线 + 沿 X 轴闭合，用于折线下方渐变填充（对齐 AI 智推数据看板）
  const areaD = (() => {
    if (n === 0) return "";
    const baseline = padT + plotH;
    if (n === 1) {
      return `M ${xAt(0)} ${baseline} L ${xAt(0)} ${yAt(points[0].v)} L ${xAt(0)} ${baseline} Z`;
    }
    let d = `M ${xAt(0)} ${baseline} L ${xAt(0)} ${yAt(points[0].v)}`;
    for (let i = 1; i < n; i++) {
      d += ` L ${xAt(i)} ${yAt(points[i].v)}`;
    }
    d += ` L ${xAt(n - 1)} ${baseline} Z`;
    return d;
  })();

  const gridYs = [0, 0.25, 0.5, 0.75, 1];
  // X 轴标签最多展示 7 个
  const labelStep = Math.max(1, Math.ceil(n / 7));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="trendLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={TREND_COLORS[0]} />
          <stop offset="100%" stopColor={TREND_COLORS[1]} />
        </linearGradient>
        <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={TREND_COLORS[0]} stopOpacity={0.32} />
          <stop offset="100%" stopColor={TREND_COLORS[0]} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {/* 网格线 */}
      {gridYs.map((g, i) => {
        const y = padT + plotH - g * plotH;
        const val = Math.round(maxV * g);
        return (
          <g key={i}>
            <line
              x1={padL}
              y1={y}
              x2={W - padR}
              y2={y}
              stroke="#e6eef5"
              strokeWidth={1}
              strokeDasharray={i === 0 ? "0" : "3 3"}
            />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={9} fill="#9aa5a8">
              {val}
            </text>
          </g>
        );
      })}
      {/* 折线下方渐变面积填充 */}
      {n > 0 ? <path d={areaD} fill="url(#trendArea)" stroke="none" /> : null}
      {/* 折线 */}
      <path d={pathD} fill="none" stroke="url(#trendLine)" strokeWidth={2} strokeLinecap="round" />
      {/* 数据点 + 悬停热区 */}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={xAt(i)}
            cy={yAt(p.v)}
            r={hoverIdx === i ? 4 : 2.5}
            fill="#fff"
            stroke={TREND_COLORS[0]}
            strokeWidth={hoverIdx === i ? 2 : 1.5}
          />
          {p.v > 0 && hoverIdx !== i ? (
            <text x={xAt(i)} y={yAt(p.v) - 6} textAnchor="middle" fontSize={9} fill="#3a3a40" fontWeight={600}>
              {p.v}
            </text>
          ) : null}
          {/* 透明热区，捕获鼠标事件 */}
          <circle
            cx={xAt(i)}
            cy={yAt(p.v)}
            r={14}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        </g>
      ))}
      {/* 悬停 tooltip（对齐 AI 智推数据看板样式） */}
      {hoverIdx !== null && points[hoverIdx] ? (() => {
        const p = points[hoverIdx];
        const tx = xAt(hoverIdx);
        const ty = yAt(p.v);
        const tipW = 84;
        const tipH = 38;
        const tipX = Math.max(padL, Math.min(W - padR - tipW, tx - tipW / 2));
        const tipY = Math.max(padT, ty - tipH - 8);
        const label = p.date.length >= 10 ? p.date.slice(5) : p.date;
        return (
          <g style={{ pointerEvents: "none" }}>
            <rect
              x={tipX}
              y={tipY}
              width={tipW}
              height={tipH}
              rx={4}
              fill="#ffffff"
              stroke="#b7b9be"
              strokeWidth={1}
              style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.2))" }}
            />
            <text x={tipX + tipW / 2} y={tipY + 16} textAnchor="middle" fontSize={11} fill="#6d6e73" fontFamily="'Microsoft YaHei',sans-serif">
              {label}
            </text>
            <text x={tipX + tipW / 2} y={tipY + 30} textAnchor="middle" fontSize={11} fill="#6d6e73" fontFamily="'Microsoft YaHei',sans-serif">
              收录量：{p.v}
            </text>
          </g>
        );
      })() : null}
      {/* X 轴标签 */}
      {points.map((p, i) =>
        i % labelStep === 0 || i === n - 1 ? (
          <text
            key={i}
            x={xAt(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={9}
            fill="#9aa5a8"
          >
            {p.date.length >= 10 ? p.date.slice(5) : p.date}
          </text>
        ) : null,
      )}
    </svg>
  );
}

type SiteRingChartProps = {
  siteStats: Array<{
    inclusionSiteId?: string | number;
    siteName?: string;
    included?: string | number;
  }>;
  loading: boolean;
};

// SiteRingChart 分平台收录量 - 环形图 + 图例 + 悬停 tooltip
function SiteRingChart({ siteStats, loading }: SiteRingChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[11px] text-[#9aa5a8]">
        <Icon name="sparkles" className="mr-1 inline h-4 w-4 animate-pulse" />
        正在加载…
      </div>
    );
  }
  const items = siteStats.map((s) => ({
    name: s.siteName || `站点 #${s.inclusionSiteId}`,
    v: Number(s.included ?? 0),
  }));
  const total = items.reduce((sum, it) => sum + it.v, 0);

  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[12px] text-[#9aa5a8]">
        暂无平台收录数据
      </div>
    );
  }

  const R = 70;
  const r = 45;
  const cx = 90;
  const cy = 90;
  const circumference = 2 * Math.PI * R;

  let offset = 0;
  const segments = items.map((it, i) => {
    const ratio = it.v / total;
    const len = ratio * circumference;
    const seg = {
      idx: i,
      color: RING_COLORS[i % RING_COLORS.length],
      name: it.name,
      v: it.v,
      ratio,
      pct: (ratio * 100).toFixed(2),
      dashArray: `${len} ${circumference - len}`,
      dashOffset: -offset,
    };
    offset += len;
    return seg;
  });
  const active = hover !== null ? segments[hover] : null;

  return (
    <div className="relative flex flex-col items-center gap-3 py-2 sm:flex-row sm:gap-4">
      <svg width={180} height={180} viewBox="0 0 180 180" className="shrink-0">
        <g transform="rotate(-90 90 90)">
          {segments.map((s, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={hover === i ? R - r + 6 : R - r}
              strokeDasharray={s.dashArray}
              strokeDashoffset={s.dashOffset}
              style={{
                cursor: "pointer",
                transition: "stroke-width 0.15s ease, opacity 0.15s ease",
                opacity: hover === null || hover === i ? 1 : 0.4,
              }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </g>
        <text x={90} y={82} textAnchor="middle" fontSize={11} fill="#9aa5a8">
          {active ? active.name : "总收录"}
        </text>
        <text
          x={90}
          y={104}
          textAnchor="middle"
          fontSize={active ? 16 : 22}
          fontWeight={700}
          fill={active ? active.color : "#25252a"}
        >
          {active ? `${active.pct}%` : formatNumber(total)}
        </text>
        {active ? (
          <text x={90} y={122} textAnchor="middle" fontSize={10} fill="#9aa5a8">
            {formatNumber(active.v)} 次
          </text>
        ) : null}
      </svg>
      <div className="grid w-full grid-cols-2 gap-x-3 gap-y-1.5">
        {segments.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 rounded-[5px] px-1.5 py-1 text-[11px] transition"
            style={{
              backgroundColor: hover === i ? `${s.color}14` : "transparent",
            }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: s.color }}
            />
            <span className="min-w-0 flex-1 truncate text-[#3a3a40]">{s.name}</span>
            <strong className="text-[#3478f6]">{formatNumber(s.v)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

type TopKeywordGridProps = {
  topKeywords: Array<{
    keywordId?: string | number;
    keyword?: string;
    includedCount?: string | number;
  }>;
  loading: boolean;
};

// TopKeywordGrid Top 热词榜 - 标题 + 动态热度条 + 数值，悬停显示完整内容
function TopKeywordGrid({ topKeywords, loading }: TopKeywordGridProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[11px] text-[#9aa5a8]">
        <Icon name="sparkles" className="mr-1 inline h-4 w-4 animate-pulse" />
        正在加载…
      </div>
    );
  }
  if (topKeywords.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[12px] text-[#9aa5a8]">
        暂无热词数据
      </div>
    );
  }
  const maxV = Math.max(1, ...topKeywords.map((k) => Number(k.includedCount ?? 0)));
  const hoverItem = hoverIdx !== null ? topKeywords[hoverIdx] : null;
  const hoverText = hoverItem
    ? hoverItem.keyword || `问题 #${hoverItem.keywordId}`
    : "";

  return (
    <div className="space-y-1.5">
      {topKeywords.map((k, idx) => {
        const v = Number(k.includedCount ?? 0);
        const rank = idx + 1;
        const fillPct = Math.max(6, Math.round((v / maxV) * 100));
        const barTone =
          rank === 1
            ? "linear-gradient(90deg,#ff9a4a,#ff5e3a)"
            : rank === 2
              ? "linear-gradient(90deg,#8aa0ff,#5b6eff)"
              : rank === 3
                ? "linear-gradient(90deg,#7ed6a6,#3eb87f)"
                : "linear-gradient(90deg,#5fb6ff,#3f8fff)";
        const badgeTone =
          rank === 1
            ? "bg-[linear-gradient(145deg,#ff9a4a,#ff7a3a)] text-white"
            : rank === 2
              ? "bg-[linear-gradient(145deg,#8aa0ff,#6e84ff)] text-white"
              : rank === 3
                ? "bg-[linear-gradient(145deg,#7ed6a6,#4ec28b)] text-white"
                : "bg-[#eef0f4] text-[#717179]";
        return (
          <div
            key={String(k.keywordId)}
            className="group relative flex items-center gap-2 rounded-[5px] px-1.5 py-1 transition"
            style={{ backgroundColor: hoverIdx === idx ? "#ffffff" : "transparent" }}
            onMouseEnter={() => setHoverIdx(idx)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${badgeTone}`}
            >
              {rank}
            </span>
            <p className="min-w-0 w-[120px] shrink-0 truncate text-[11px] font-medium text-[#3a3a40]">
              {k.keyword || `问题 #${k.keywordId}`}
            </p>
            {/* 动态热度条 */}
            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-[#d3dce6]">
              <div
                className="absolute left-0 top-0 h-full rounded-full"
                style={{
                  width: `${fillPct}%`,
                  background: barTone,
                  transition: "width 0.5s cubic-bezier(0.22,1,0.36,1)",
                }}
              />
              {/* 高光扫光效果 */}
              <div
                className="pointer-events-none absolute top-0 h-full rounded-full"
                style={{
                  left: 0,
                  width: `${fillPct}%`,
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.7), rgba(255,255,255,0))",
                  opacity: hoverIdx === idx ? 0.9 : 0.4,
                  transition: "opacity 0.2s",
                }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-[11px] font-bold text-[#3478f6]">
              {formatNumber(v)}
            </span>
          </div>
        );
      })}
      {/* 悬停 tooltip：显示完整问题内容 */}
      {hoverItem ? (
        <div className="pointer-events-none absolute z-50 max-w-[280px] rounded-[8px] bg-[#1d1d1f]/95 px-3 py-2 text-[11px] leading-relaxed text-white shadow-lg">
          {hoverText}
        </div>
      ) : null}
    </div>
  );
}
