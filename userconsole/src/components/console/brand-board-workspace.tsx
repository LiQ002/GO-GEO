"use client";

import * as echarts from "echarts";
import { toPng } from "html-to-image";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "@/components/ui/icon";
import {
  type UserV1ArticlePublishTrendPoint,
  type UserV1BrandCompanyInfo,
  type UserV1BrandDashboard,
  type UserV1BrandIndexBottom,
  type UserV1BrandIndexMain,
  type UserV1BrandIndexTop,
  type UserV1BrandOptimizeStats,
  type UserV1BrandQuestionStat,
  type UserV1BrandRecommendation,
  type UserV1BrandRecord,
  type UserV1BrandSentimentStat,
  type UserV1BrandSourceAnalysis,
  type UserV1BrandSummary,
  type UserV1BrandTrendPoint,
  type UserV1CatalogItem,
  type UserV1CompetitorBlankKeywordsPage,
  type UserV1CompetitorComparePage,
  type UserV1CompetitorRankingPage,
  type UserV1MediaArticleBreakdown,
  type UserV1SourceArticleStat,
  type UserV1SourcePlatformStat,
  userApi,
} from "@/lib/api/user-api.generated";
import { useGeoEvents } from "@/lib/hooks/use-geo-events";

// ============================================================
// 常量与类型
// ============================================================

type RangeOption = "7d" | "month" | "year";
type OpinionPeriod = "week" | "month";
type ReportPeriod = "week" | "month";
type SubTab = "dashboard" | "week" | "month" | "diagnose" | "source" | "competitor";

const rangeTabs: Array<{ key: RangeOption; label: string }> = [
  { key: "7d", label: "近7天" },
  { key: "month", label: "本月" },
  { key: "year", label: "今年" },
];

const opinionTabs: Array<{ key: OpinionPeriod; label: string }> = [
  { key: "week", label: "周结" },
  { key: "month", label: "月结" },
];

// 情感展示顺序与中文标签（sentiment: positive/neutral/negative → 正/无/负）
const SENTIMENT_ORDER: Array<{ key: string; label: string }> = [
  { key: "neutral", label: "无" },
  { key: "positive", label: "正" },
  { key: "negative", label: "负" },
];

// 视觉规格（对齐 §10.5）
const BRAND_BLUE = "#227DEF";
const BUTTON_BLUE = "#007CFF";
const BRAND_BOX_SHADOW = "rgba(34,125,239,0.1) 0 0 20px";

// 平台图标配色映射（对齐盘古视觉）
const PLATFORM_COLORS: Record<string, string> = {
  DeepSeek: "#227DEF",
  豆包: "#F97316",
  腾讯元宝: "#F59E0B",
  元宝: "#F59E0B",
  文心助手: "#EF4444",
  文心一言: "#EF4444",
  千问: "#8B5CF6",
  知乎: "#0066FF",
  微信: "#07C160",
  KIMI: "#14B8A6",
  // 智普清言 - 翠绿色（视觉清爽，与青色系区分）
  智谱: "#059669",
  智普清言: "#059669",
  // 纳米AI - 靛蓝色（鲜明醒目，与紫色系拉开差距）
  纳米: "#6366F1",
  纳米AI: "#6366F1",
};

function platformColor(name: string): string {
  return PLATFORM_COLORS[name] ?? "#6B7280";
}

// InfoTip 悬停提示：用于解释指标口径（避免大盘 318 vs 竞品柱状图 315 这类混淆）。
// 采用 CSS hover 显示，避免引入额外依赖。
function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-flex shrink-0 items-center">
      <span className="inline-flex h-3.5 w-3.5 cursor-help select-none items-center justify-center rounded-full border border-[#cbd2d9] bg-white text-[9px] font-bold leading-none text-[#6b7782]">
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 hidden w-56 -translate-x-1/2 whitespace-normal rounded-md bg-[#25252a] px-3 py-2 text-left text-[11px] leading-snug text-white shadow-lg group-hover:block"
      >
        {text}
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#25252a]" />
      </span>
    </span>
  );
}

// Resolve a potentially relative icon URL to absolute.
function resolveIconUrl(iconUrl?: string): string | undefined {
  if (!iconUrl) return undefined;
  if (/^https?:\/\//i.test(iconUrl)) return iconUrl;
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}${iconUrl.startsWith("/") ? "" : "/"}${iconUrl}`;
}

// ============================================================
// 辅助函数
// ============================================================

function formatNumber(value?: string | number): string {
  if (value === undefined || value === null || value === "") return "0";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString("zh-CN");
}

function formatPercent(value?: number): string {
  if (value === undefined || value === null || !Number.isFinite(value))
    return "0%";
  // 占比上限 100%（对齐 §3.2 指标定义：不做加权）；统一显示整数百分比
  return `${Math.min(100, Math.round(value))}%`;
}

function formatDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getSunday(d: Date): Date {
  const monday = getMonday(d);
  monday.setDate(monday.getDate() + 6);
  return monday;
}

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return Math.ceil((days + start.getDay() + 1) / 7);
}

function formatDateTime(value?: string | number) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short" }).format(date);
}

function sentimentLabel(sentiment?: string): string {
  if (!sentiment) return "-";
  const found = SENTIMENT_ORDER.find((s) => s.key === sentiment);
  return found ? found.label : sentiment;
}

// ============================================================
// 主组件
// ============================================================

export function BrandBoardWorkspace() {
  const [companyInfo, setCompanyInfo] = useState<UserV1BrandCompanyInfo | null>(
    null,
  );
  const [indexTop, setIndexTop] = useState<UserV1BrandIndexTop | null>(null);
  const [dashboard, setDashboard] = useState<UserV1BrandDashboard | null>(null);
  const [indexMain, setIndexMain] = useState<UserV1BrandIndexMain | null>(null);
  const [indexMainYear, setIndexMainYear] =
    useState<UserV1BrandIndexMain | null>(null);
  const [indexBottom, setIndexBottom] = useState<UserV1BrandIndexBottom | null>(
    null,
  );
  const [reportData, setReportData] = useState<UserV1BrandSummary | null>(null);
  const [recordPage, setRecordPage] = useState<UserV1BrandRecord[]>([]);
  const [recordTotal, setRecordTotal] = useState(0);
  const [recordLoading, setRecordLoading] = useState(false);
  const [optimizeStats, setOptimizeStats] =
    useState<UserV1BrandOptimizeStats | null>(null);
  const [recordSiteFilter, setRecordSiteFilter] = useState<string>("");
  const [recordStatusFilter, setRecordStatusFilter] = useState<string>("");
  const [questionTotalCount, setQuestionTotalCount] = useState<number>(0);
  const [sourceData, setSourceData] = useState<UserV1BrandSourceAnalysis | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceRange, setSourceRange] = useState<RangeOption>("7d");
  const [competitorRanking, setCompetitorRanking] = useState<UserV1CompetitorRankingPage | null>(null);
  const [competitorRankingLoading, setCompetitorRankingLoading] = useState(false);
  const [competitorCompare, setCompetitorCompare] = useState<UserV1CompetitorComparePage | null>(null);
  const [competitorCompareLoading, setCompetitorCompareLoading] = useState(false);
  const [competitorBlankKeywords, setCompetitorBlankKeywords] = useState<UserV1CompetitorBlankKeywordsPage | null>(null);
  const [competitorBlankLoading, setCompetitorBlankLoading] = useState(false);
  const [competitorBlankPage, setCompetitorBlankPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);
  const [opinionLoading, setOpinionLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [indexTopLoading, setIndexTopLoading] = useState(false);
  const [reportDate, setReportDate] = useState<string>(""); // YYYY-MM-DD, empty = current
  const [error, setError] = useState("");

  const [range, setRange] = useState<RangeOption>("7d");
  const [opinionPeriod, setOpinionPeriod] = useState<OpinionPeriod>("week");
  const [subTab, setSubTab] = useState<SubTab>("dashboard");
  const [platformIcons, setPlatformIcons] = useState<Map<string, string>>(
    () => new Map(),
  );

  // 更新时间每秒走动，与 dashboard-data 看板对齐
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 基础数据（不依赖 range）：企业信息 + 推荐度 + 数据大盘 + 问题总数
  const loadBase = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [info, top, dash, questionsReply] = await Promise.all([
        userApi.geoBrandBoard.getBrandCompanyInfo({}),
        userApi.geoBrandBoard.getBrandIndexTop({}),
        userApi.geoBrandBoard.getBrandDashboard({}),
        userApi.question.listQuestions({ status: 2, pageSize: 1 }),
      ]);
      setCompanyInfo(info);
      setIndexTop(top);
      setDashboard(dash);
      setQuestionTotalCount(Number(questionsReply.totalSize ?? 0));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "品牌看板加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // 周报/月报平台明细（依赖 subTab + reportDate）
  // 大盘模式下 indexTop 由 loadBase 加载（当日范围），
  // 周报/月报模式下需按选定周期重新加载平台明细数据。
  const loadIndexTop = useCallback(async (periodType?: string, periodDate?: string) => {
    setIndexTopLoading(true);
    try {
      const query: { periodType?: string; periodDate?: string } = {};
      if (periodType) {
        query.periodType = periodType;
        if (periodDate) query.periodDate = periodDate;
      }
      const top = await userApi.geoBrandBoard.getBrandIndexTop(query);
      setIndexTop(top);
    } catch {
      // 静默：主错误已在 loadBase 体现
    } finally {
      setIndexTopLoading(false);
    }
  }, []);

  // 主区趋势 + 情感（依赖 range）
  const loadIndexMain = useCallback(
    async (r: RangeOption, periodType?: string, periodDate?: string) => {
      setTrendLoading(true);
      try {
        const query: {
          range: RangeOption;
          periodType?: string;
          periodDate?: string;
        } = { range: r };
        if (periodType) {
          query.periodType = periodType;
          if (periodDate) query.periodDate = periodDate;
        }
        const main = await userApi.geoBrandBoard.getBrandIndexMain(query);
        setIndexMain(main);
      } catch {
        // 静默：主错误已在 loadBase 体现，避免 range 切换时整页报错
      } finally {
        setTrendLoading(false);
      }
    },
    [],
  );

  // 舆情分析（依赖 opinionPeriod）
  const loadIndexBottom = useCallback(async (p: OpinionPeriod) => {
    setOpinionLoading(true);
    try {
      const bottom = await userApi.geoBrandBoard.getBrandIndexBottom({
        range: p,
      });
      setIndexBottom(bottom);
    } catch {
      // 静默
    } finally {
      setOpinionLoading(false);
    }
  }, []);

  // 周报/月报摘要（依赖 subTab + reportDate）
  const loadReport = useCallback(
    async (period: ReportPeriod, date?: string) => {
      setReportLoading(true);
      try {
        const query: { periodType: string; periodDate?: string } = {
          periodType: period,
        };
        if (date) query.periodDate = date;
        const summary = await userApi.geoBrandBoard.getBrandSummary(query);
        setReportData(summary);
      } catch {
        setReportData(null);
      } finally {
        setReportLoading(false);
      }
    },
    [],
  );

  // 优化记录：统计卡
  const loadOptimizeStats = useCallback(async () => {
    try {
      const stats = await userApi.geoBrandBoard.getBrandOptimizeStats({});
      setOptimizeStats(stats);
    } catch {
      // 静默
    }
  }, []);

  // 优化记录：列表
  const loadRecords = useCallback(
    async (page: number, siteFilter: string, statusFilter: string) => {
      setRecordLoading(true);
      try {
        const query: {
          pageSize: number;
          pageToken: string;
          inclusionSiteId?: string;
          statusFilter?: string;
        } = {
          pageSize: 10,
          pageToken: page > 1 ? String((page - 1) * 10) : "",
        };
        if (siteFilter) query.inclusionSiteId = siteFilter;
        if (statusFilter) query.statusFilter = statusFilter;
        const resp = await userApi.geoBrandBoard.listBrandRecords(query);
        setRecordPage(resp.records ?? []);
        setRecordTotal(Number(resp.totalSize ?? 0));
      } catch {
        setRecordPage([]);
      } finally {
        setRecordLoading(false);
      }
    },
    [],
  );

  // 信源分析数据加载
  const loadSourceAnalysis = useCallback(async (rng: RangeOption) => {
    setSourceLoading(true);
    try {
      const resp = await userApi.geoBrandBoard.getBrandSourceAnalysis({ range: rng });
      setSourceData(resp);
    } catch {
      setSourceData(null);
    } finally {
      setSourceLoading(false);
    }
  }, []);

  // 竞品品牌排序加载
  const loadCompetitorRanking = useCallback(async () => {
    setCompetitorRankingLoading(true);
    try {
      const resp = await userApi.geoBrandBoard.getCompetitorRanking({});
      setCompetitorRanking(resp);
    } catch {
      setCompetitorRanking(null);
    } finally {
      setCompetitorRankingLoading(false);
    }
  }, []);

  // 空白词条加载
  const loadCompetitorBlankKeywords = useCallback(async (page: number) => {
    setCompetitorBlankLoading(true);
    try {
      const resp = await userApi.geoBrandBoard.listCompetitorBlankKeywords({
        pageSize: 10,
        pageToken: page > 1 ? String((page - 1) * 10) : "",
      });
      setCompetitorBlankKeywords(resp);
    } catch {
      setCompetitorBlankKeywords(null);
    } finally {
      setCompetitorBlankLoading(false);
    }
  }, []);

  // 竞品核心指标对比加载
  const loadCompetitorCompare = useCallback(async () => {
    setCompetitorCompareLoading(true);
    try {
      const resp = await userApi.geoBrandBoard.getCompetitorCompare({});
      setCompetitorCompare(resp);
    } catch {
      setCompetitorCompare(null);
    } finally {
      setCompetitorCompareLoading(false);
    }
  }, []);

  // 初始挂载：拉基础数据
  useEffect(() => {
    void loadBase();
    // 加载平台图标映射
    userApi.catalog
      .listInclusionSites()
      .then((reply) => {
        const map = new Map<string, string>();
        for (const item of reply.items ?? []) {
          if (item.name && item.icon) {
            const url = resolveIconUrl(item.icon);
            if (url) map.set(item.name, url);
          }
        }
        setPlatformIcons(map);
      })
      .catch(() => {
        // 静默失败：不影响主数据展示
      });
  }, [loadBase]);

  // range 切换（含初始）：重拉 indexMain（大盘模式下按 range，周报/月报模式下按周期）
  useEffect(() => {
    if (subTab === "week" || subTab === "month") {
      void loadIndexMain(range, subTab, reportDate || undefined);
    } else {
      void loadIndexMain(range);
    }
  }, [range, subTab, reportDate, loadIndexMain]);

  // opinionPeriod 切换（含初始）：重拉 indexBottom
  useEffect(() => {
    void loadIndexBottom(opinionPeriod);
  }, [opinionPeriod, loadIndexBottom]);

  // subTab / reportDate 切换到周报/月报：加载报表数据 + 按周期重载平台明细
  useEffect(() => {
    if (subTab === "week" || subTab === "month") {
      void loadReport(subTab, reportDate || undefined);
      void loadIndexTop(subTab, reportDate || undefined);
    } else if (subTab === "dashboard") {
      // 切回大盘模式时重新加载当日平台数据
      void loadIndexTop();
    }
  }, [subTab, reportDate, loadReport, loadIndexTop]);

  // subTab 切换到优化记录：加载优化记录数据
  const [diagnosePage, setDiagnosePage] = useState(1);
  useEffect(() => {
    if (subTab === "diagnose") {
      void loadOptimizeStats();
      void loadRecords(diagnosePage, recordSiteFilter, recordStatusFilter);
      // 优化记录的收录柱状图：用 month 范围拉取近30天日数据（覆盖近7天和本月视图）
      void loadIndexMain("month" as RangeOption);
      // 预加载 year 范围数据（用于"今年"视图）
      userApi.geoBrandBoard
        .getBrandIndexMain({ range: "year" as RangeOption })
        .then(setIndexMainYear)
        .catch(() => {
          /* 静默 */
        });
    }
  }, [
    subTab,
    diagnosePage,
    recordSiteFilter,
    recordStatusFilter,
    loadOptimizeStats,
    loadRecords,
    loadIndexMain,
  ]);

  // subTab 切换到信源分析：加载信源分析数据
  useEffect(() => {
    if (subTab === "source") {
      void loadSourceAnalysis(sourceRange);
    }
  }, [subTab, sourceRange, loadSourceAnalysis]);

  // subTab 切换到竞品分析：加载竞品排序、竞品对比和空白词条 + 近7天趋势
  useEffect(() => {
    if (subTab === "competitor") {
      void loadCompetitorRanking();
      void loadCompetitorCompare();
      void loadCompetitorBlankKeywords(competitorBlankPage);
      void loadIndexMain("7d");
    }
  }, [subTab, competitorBlankPage, loadCompetitorRanking, loadCompetitorCompare, loadCompetitorBlankKeywords, loadIndexMain]);

  // SSE：收到事件全部重拉（复用 useGeoEvents hook）
  useGeoEvents({
    onEvent: () => {
      void loadBase();
      if (subTab === "week" || subTab === "month") {
        void loadIndexMain(range, subTab, reportDate || undefined);
        void loadReport(subTab, reportDate || undefined);
        void loadIndexTop(subTab, reportDate || undefined);
      } else if (subTab === "diagnose") {
        void loadOptimizeStats();
        void loadRecords(diagnosePage, recordSiteFilter, recordStatusFilter);
          void loadIndexMain("month" as RangeOption);
        userApi.geoBrandBoard
          .getBrandIndexMain({ range: "year" as RangeOption })
          .then(setIndexMainYear)
          .catch(() => {/* 静默 */});
      } else if (subTab === "source") {
        void loadSourceAnalysis(sourceRange);
      } else {
        void loadIndexMain(range);
      }
      void loadIndexBottom(opinionPeriod);
    },
  });

  const handleRefresh = useCallback(() => {
    void loadBase();
    if (subTab === "week" || subTab === "month") {
      void loadIndexMain(range, subTab, reportDate || undefined);
      void loadReport(subTab, reportDate || undefined);
      void loadIndexTop(subTab, reportDate || undefined);
    } else if (subTab === "diagnose") {
      void loadOptimizeStats();
      void loadRecords(diagnosePage, recordSiteFilter, recordStatusFilter);
    } else if (subTab === "competitor") {
      void loadCompetitorRanking();
      void loadCompetitorCompare();
      void loadCompetitorBlankKeywords(competitorBlankPage);
    } else {
      void loadIndexMain(range);
    }
    void loadIndexBottom(opinionPeriod);
  }, [loadBase, loadIndexMain, loadIndexBottom, loadReport, loadIndexTop, loadOptimizeStats, loadRecords, loadCompetitorRanking, loadCompetitorCompare, loadCompetitorBlankKeywords, competitorBlankPage, range, opinionPeriod, subTab, reportDate, diagnosePage, recordSiteFilter, recordStatusFilter]);

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#227DEF]">
            <Icon name="board" className="h-4 w-4" />
            品牌看板
          </div>
          <h1 className="mt-2 text-[27px] font-semibold tracking-[-.04em] text-[#1d1d1f]">
            品牌 GEO 大盘
          </h1>
          <p className="mt-2 text-sm text-[#717179]">
            跨平台品牌可见度与舆情全局视角，实时同步
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
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

      {/* 子 tab：顶部 tab 导航（品牌GEO大盘/周报/月报/优化记录） */}
      <div className="mt-5">
        <SubTabs
          current={subTab}
          onChange={setSubTab}
          opinionPeriod={opinionPeriod}
        />
      </div>

      {/* 主内容 */}
      {subTab === "diagnose" ? (
        <div className="mt-5">
          <DiagnosePanel
            loading={recordLoading}
            stats={optimizeStats}
            records={recordPage}
            total={recordTotal}
            currentPage={diagnosePage}
            pageSize={10}
            siteFilter={recordSiteFilter}
            statusFilter={recordStatusFilter}
            platformIcons={platformIcons}
            dashboard={dashboard}
            companyInfo={companyInfo}
            indexMain={indexMain}
            indexMainYear={indexMainYear}
            onPageChange={(page) => setDiagnosePage(page)}
            onSiteFilterChange={(v) => {
              setRecordSiteFilter(v);
              setDiagnosePage(1);
            }}
            onStatusFilterChange={(v) => {
              setRecordStatusFilter(v);
              setDiagnosePage(1);
            }}
          />
        </div>
      ) : subTab === "source" ? (
        <div className="mt-5">
          <SourceAnalysisPanel
            data={sourceData}
            loading={sourceLoading}
            range={sourceRange}
            onRangeChange={setSourceRange}
          />
        </div>
      ) : subTab === "competitor" ? (
        <div className="mt-5">
          <CompetitorAnalysisPanel
            dashboard={dashboard}
            indexTop={indexTop}
            indexMain={indexMain}
            companyInfo={companyInfo}
            platformIcons={platformIcons}
            loading={loading}
            trendLoading={trendLoading}
            range={range}
            onRangeChange={setRange}
            rankingData={competitorRanking}
            rankingLoading={competitorRankingLoading}
            compareData={competitorCompare}
            compareLoading={competitorCompareLoading}
            blankData={competitorBlankKeywords}
            blankLoading={competitorBlankLoading}
            blankPage={competitorBlankPage}
            onBlankPageChange={setCompetitorBlankPage}
          />
        </div>
      ) : subTab === "week" || subTab === "month" ? (
        <div className="mt-5">
          <ReportPanel
            data={reportData}
            loading={reportLoading}
            indexTopLoading={indexTopLoading}
            period={subTab as ReportPeriod}
            platformIcons={platformIcons}
            companyInfo={companyInfo}
            dashboard={dashboard}
            indexTop={indexTop}
            indexMain={indexMain}
            reportDate={reportDate}
            onReportDateChange={setReportDate}
            questionTotalCount={questionTotalCount}
          />
        </div>
      ) : (
        <>
          {/* 顶栏：数据大盘（左）+ 企业名片（右） 左右布局 */}
          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_300px]">
            <div
              className="border border-white/70 bg-white/45"
              style={{ borderRadius: 12 }}
            >
              <DashboardPanel
                data={dashboard}
                companyInfo={companyInfo}
                loading={loading}
                embedded
              />
            </div>
            <CompanyInfoSidebar data={companyInfo} loading={loading} />
          </div>

          <section
            className="mt-5"
            style={{ borderRadius: 12, boxShadow: BRAND_BOX_SHADOW }}
          >
            {/* 品牌推荐度 */}
            <div
              className="border border-white/70 bg-white/45"
              style={{ borderRadius: 12 }}
            >
              <RecommendationPanel
                data={indexTop}
                loading={loading}
                platformIcons={platformIcons}
                embedded
              />
            </div>

            {/* 趋势分析 */}
            <div className="mt-5">
              <TrendsPanel
                data={indexMain}
                loading={trendLoading}
                range={range}
                onRangeChange={setRange}
                embedded
              />
            </div>
            <OpinionPanel
              data={indexBottom}
              loading={opinionLoading}
              period={opinionPeriod}
              onPeriodChange={setOpinionPeriod}
              embedded
            />
            {/* 情感倾向分析（独立一行） */}
            <div className="mt-5">
              <SentimentTable
                data={indexMain?.sentimentBreakdown}
                loading={trendLoading}
                embedded
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ============================================================
// 子组件 1：CompanyInfoSidebar（右侧企业名片）
// ============================================================

type CompanyInfoSidebarProps = {
  data: UserV1BrandCompanyInfo | null;
  loading: boolean;
};

function CompanyInfoSidebar({ data, loading }: CompanyInfoSidebarProps) {
  return (
    <div
      className="border border-white/70 bg-white/55 p-5"
      style={{ borderRadius: 12, boxShadow: BRAND_BOX_SHADOW }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold tracking-[-.02em] text-[#25252a]">
          企业名片
        </h2>
        <span className="text-[10px] text-[#9aa5a8]">
          {data?.brandName || "—"}
        </span>
      </div>
      <p className="mt-2 text-[18px] font-semibold tracking-[-.02em] text-[#1d1d1f]">
        {loading ? "—" : data?.enterpriseName || "未命名企业"}
      </p>
      <div className="mt-3 space-y-2 text-[11px]">
        <div className="flex justify-between">
          <span className="text-[#71848a]">上线时间</span>
          <span className="text-[#3a3a40]">
            {loading ? "—" : formatDate(data?.startedAt)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#71848a]">到期时间</span>
          <span className="text-[#3a3a40]">
            {loading ? "—" : formatDate(data?.expiresAt)}
          </span>
        </div>
        <div>
          <span className="text-[#71848a]">官网地址</span>
          <p className="mt-0.5 truncate text-[#3a3a40]" title={data?.website}>
            {loading ? "—" : data?.website || "请完善信息"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {loading ? <span className="text-[11px] text-[#9a9aa0]">—</span> : null}
        {!loading && (data?.brandKeywords ?? []).length === 0 ? (
          <span className="text-[11px] text-[#9a9aa0]">暂无品牌词</span>
        ) : null}
        {!loading
          ? (data?.brandKeywords ?? []).map((kw, idx) => (
              <span
                key={`${kw}-${idx}`}
                className="rounded-full bg-[#e4efff]/80 px-2 py-0.5 text-[10px] font-medium text-[#227DEF]"
              >
                {kw}
              </span>
            ))
          : null}
      </div>
    </div>
  );
}

// ============================================================
// 子组件 2：SubTabs（品牌GEO大盘 / 周报 / 月报 / 优化记录）
// ============================================================

type SubTabsProps = {
  current: SubTab;
  onChange: (tab: SubTab) => void;
  opinionPeriod: OpinionPeriod;
};

function SubTabs({ current, onChange }: SubTabsProps) {
  const tabBtnClass = (active: boolean) =>
    `rounded-full px-3 py-1 text-[11px] font-medium transition ${
      active ? "text-white" : "text-[#5f5f66] hover:text-[#1d1d1f]"
    }`;

  return (
    <div className="glass-control inline-flex flex-wrap items-center gap-1 rounded-full p-1">
      <button
        type="button"
        onClick={() => onChange("dashboard")}
        className={tabBtnClass(current === "dashboard")}
        style={
          current === "dashboard" ? { background: BUTTON_BLUE } : undefined
        }
      >
        品牌GEO大盘
      </button>
      <button
        type="button"
        onClick={() => onChange("week")}
        className={tabBtnClass(current === "week")}
        style={current === "week" ? { background: BUTTON_BLUE } : undefined}
      >
        周报
      </button>
      <button
        type="button"
        onClick={() => onChange("month")}
        className={tabBtnClass(current === "month")}
        style={current === "month" ? { background: BUTTON_BLUE } : undefined}
      >
        月报
      </button>
      <button
        type="button"
        onClick={() => onChange("diagnose")}
        className={tabBtnClass(current === "diagnose")}
        style={current === "diagnose" ? { background: BUTTON_BLUE } : undefined}
      >
        优化记录
      </button>
      <button
        type="button"
        onClick={() => onChange("source")}
        className={tabBtnClass(current === "source")}
        style={
          current === "source" ? { background: BUTTON_BLUE } : undefined
        }
      >
        信源分析
      </button>
      <button
        type="button"
        onClick={() => onChange("competitor")}
        className={tabBtnClass(current === "competitor")}
        style={
          current === "competitor" ? { background: BUTTON_BLUE } : undefined
        }
      >
        竞品分析
      </button>
    </div>
  );
}

// ============================================================
// 子组件 3：RecommendationPanel（7 平台推荐度进度条）
// ============================================================

type RecommendationPanelProps = {
  data: UserV1BrandIndexTop | null;
  loading: boolean;
  platformIcons: Map<string, string>;
  embedded?: boolean;
};

function RecommendationPanel({
  data,
  loading,
  platformIcons,
  embedded = false,
}: RecommendationPanelProps) {
  const platforms: UserV1BrandRecommendation[] = useMemo(() => {
    if (data?.platforms && data.platforms.length > 0) {
      return [...data.platforms];
    }
    // 无当日数据时，基于平台图标列表展示空数据圆环（0%）与详情数据格
    return Array.from(platformIcons.keys()).map((name) => ({
      platform: name,
      recommendation: 0,
      inclusionCount: "0",
      visibilityRate: 0,
      mentionCount: "0",
    }));
  }, [data, platformIcons]);

  // 品牌可见度圆环区块所有指标均来自 indexTop 当日数据（与圆环口径一致），
  // 不再混用 dashboard 全量数据，避免"圆环=当日/数据格=全量"的口径错位。
  // PlatformDataCell 直接从 brandRecommendation 取 visibilityRate/mentionCount。

  return (
    <section
      className={
        embedded
          ? "p-5 sm:p-6"
          : "border border-white/70 bg-white/45 p-5 sm:p-6"
      }
      style={embedded ? undefined : { borderRadius: 12, boxShadow: "none" }}
    >
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-.02em] text-[#25252a]">
            品牌可见度
          </h2>
          <p className="mt-1 text-xs text-[#717179]">
            各 AI 平台当日品牌可见度（收录数 / 总查询数 × 100%）
          </p>
        </div>
        <span className="text-[10px] text-[#9aa5a8]">
          数据监测维度为当日数据情况
        </span>
      </div>
      {/* 统一横向滚动容器：圆环 + 数据网格 对齐 */}
      <div
        className="mt-5 py-2"
        style={{
          width: "100%",
          overflowX: "auto",
        }}
      >
        <div
          className="flex flex-col"
          style={{ width: "max-content", minWidth: "100%" }}
        >
          {platforms.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#9aa5a8]">
              {loading || platformIcons.size === 0
                ? "加载中…"
                : "暂无品牌可见度数据"}
            </div>
          ) : (
            <>
              {/* 第一行：圆环进度 */}
              <div className="flex flex-row items-start justify-center gap-4 py-2">
                {platforms.map((p) => {
                  const pct = Math.max(
                    0,
                    Math.min(100, Number(p.recommendation ?? 0)),
                  );
                  return (
                    <PlatformRingCard
                      key={p.platform ?? ""}
                      platform={p.platform ?? ""}
                      pct={pct}
                      loading={loading}
                      iconUrl={platformIcons.get(p.platform ?? "")}
                    />
                  );
                })}
              </div>
              {/* 第二行：数据网格（与圆环对齐，共享列宽） */}
              <div className="mt-4 border-t border-white/70 pt-4">
                <div className="flex flex-row justify-center gap-4">
                  {platforms.map((p) => {
                    const name = p.platform ?? "";
                    return (
                      <PlatformDataCell
                        key={name}
                        platform={name}
                        recommendation={p}
                        iconUrl={platformIcons.get(name)}
                        loading={loading}
                      />
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// PlatformRingCard 单平台圆形进度卡（对齐盘古布局）：
// 圆环 + 平台图标 + 平台名；圆环使用线性渐变 + 脉冲呼吸动效
const PLATFORM_COL_W = 140; // 每列统一宽度（圆环 + 数据网格共用，调大后需相应加宽）

function PlatformRingCard({
  platform,
  pct,
  loading,
  iconUrl,
}: {
  platform: string;
  pct: number;
  loading: boolean;
  iconUrl?: string;
}) {
  const size = 96;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  const color = platformColor(platform);
  // 唯一 ID（防止多平台渐变/动画互相覆盖）
  const uid = useId().replace(/[:]/g, "");
  const gradId = `ring-grad-${uid}`;
  const pulseClass = `ring-pulse-${uid}`;
  const displayPct = loading ? "—" : `${Math.round(pct)}%`;

  return (
    <div
      className="group flex shrink-0 flex-col items-center transition-transform hover:-translate-y-1"
      style={{ width: PLATFORM_COL_W, padding: "8px 4px" }}
    >
      <style>{`
        @keyframes ${pulseClass}-k {
          0%, 100% { opacity: 0.92; filter: drop-shadow(0 0 2px ${color}88); }
          50% { opacity: 1; filter: drop-shadow(0 0 8px ${color}); }
        }
        .${pulseClass} {
          animation: ${pulseClass}-k 2.4s ease-in-out infinite;
          transform-origin: center;
        }
      `}</style>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0 transition-all group-hover:drop-shadow-lg"
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="50%" stopColor={color} stopOpacity="0.85" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#e4efff"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <circle
            className={pulseClass}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round"
            style={{
              transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)",
            }}
          />
        </g>
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={20}
          fontWeight={700}
          fill={color}
        >
          {displayPct}
        </text>
      </svg>
      {/* 平台图标 + 名称 左右布局 */}
      <div
        className="mt-2.5 flex items-center justify-center gap-1.5"
        style={{ minHeight: 22 }}
      >
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={platform}
            className="rounded-full object-contain"
            style={{ width: 18, height: 18 }}
          />
        ) : null}
        <span
          className="truncate text-[12px] font-medium text-[#3a3a40]"
          style={{ maxWidth: PLATFORM_COL_W - 28 }}
          title={platform}
        >
          {platform}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// 子组件 3b：PlatformDataCell（单个平台数据格，与圆环对齐）
// 显示三项当日指标：可见度（%）、收录（收录成功条数）、情感（主导倾向）
// 数据全部来自 indexTop.platforms[]，与圆环口径一致（当日范围）。
// ============================================================

type PlatformDataCellProps = {
  platform: string;
  recommendation: UserV1BrandRecommendation;
  iconUrl?: string;
  loading: boolean;
};

function PlatformDataCell({
  platform,
  recommendation,
  iconUrl,
  loading,
}: PlatformDataCellProps) {
  const sentLabel = sentimentLabel(recommendation.sentiment);
  const sentTone =
    recommendation.sentiment === "positive"
      ? "text-[#1f9d63]"
      : recommendation.sentiment === "negative"
        ? "text-[#d65a50]"
        : "text-[#717179]";

  return (
    <div
      className="shrink-0 transition-colors hover:bg-white/40"
      style={{ width: PLATFORM_COL_W, padding: "12px 6px" }}
    >
      {/* 平台图标 + 名称 左右布局 */}
      <div className="mb-2 flex items-center gap-1.5">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={platform}
            className="rounded-full object-contain"
            style={{ width: 16, height: 16 }}
          />
        ) : null}
        <span
          className="truncate text-[12px] font-medium text-[#3a3a40]"
          style={{ maxWidth: PLATFORM_COL_W - 22 }}
          title={platform}
        >
          {platform}
        </span>
      </div>
      {/* 三项数据：可见度 / 收录 / 情感 */}
      <div className="space-y-1.5 text-[12px]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[#717179]">
            <span
              className="inline-block rounded-full"
              style={{ width: 5, height: 5, background: BRAND_BLUE }}
            />
            可见度
          </span>
          <span className="font-semibold text-[#227DEF]">
            {loading ? "—" : formatPercent(recommendation.visibilityRate)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[#717179]">
            <span
              className="inline-block rounded-full"
              style={{ width: 5, height: 5, background: BRAND_BLUE }}
            />
            收录
          </span>
          <span className="font-semibold text-[#227DEF]">
            {loading ? "—" : formatNumber(recommendation.mentionCount)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[#717179]">
            <span
              className="inline-block rounded-full"
              style={{
                width: 5,
                height: 5,
                background:
                  recommendation.sentiment === "positive"
                    ? "#1f9d63"
                    : recommendation.sentiment === "negative"
                      ? "#d65a50"
                      : "#9aa5a8",
              }}
            />
            情感倾向
          </span>
          <span className={`font-semibold ${sentTone}`}>
            {loading ? "—" : sentLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 子组件 4：DashboardPanel（5 主指标 + 4 辅助指标）
// ============================================================

type DashboardPanelProps = {
  data: UserV1BrandDashboard | null;
  companyInfo: UserV1BrandCompanyInfo | null;
  loading: boolean;
  embedded?: boolean;
};

function DashboardPanel({
  data,
  companyInfo,
  loading,
  embedded = false,
}: DashboardPanelProps) {
  const mainMetrics: Array<{
    hint: string;
    label: string;
    value: string;
    dot: string;
    tipText?: string;
  }> = [
    {
      hint: "收录成功数 / 查收录总数",
      label: "品牌可见度",
      value: formatPercent(data?.visibilityRate),
      dot: BRAND_BLUE,
    },
    {
      hint: "排名≤3 的收录占比",
      label: "品牌TOP3",
      value: formatPercent(data?.top3Rate),
      dot: BRAND_BLUE,
    },
    {
      hint: "正向情感收录数 / 提及次数",
      label: "正向情感倾向",
      value: data && (data.positiveRate ?? 0) > 0 ? "↑正" : "正",
      dot: "#1f9d63",
    },
    {
      hint: "品牌被提及的回答数（单条回答只计 1 次）",
      label: "提及次数",
      value: formatNumber(data?.mentionCount),
      dot: BRAND_BLUE,
      tipText:
        "全企业范围：所有监测问题中，被 AI 平台提及品牌或企业名称的回答数，一条回答只计 1 次。竞品分析里的“品牌提及次数”是按品牌拆分后的子集，可能小于本数。",
    },
    {
      hint: "查询快照总数",
      label: "对话轮次",
      value: formatNumber(data?.dialogueRounds),
      dot: BRAND_BLUE,
    },
  ];

  const auxMetrics: Array<{ label: string; value: string | undefined }> = [
    {
      label: "关键词量",
      value: companyInfo?.keywordCount,
    },
    {
      label: "词条量",
      value: companyInfo?.termCount,
    },
    {
      label: "收录总量",
      value: companyInfo?.totalInclusion,
    },
    {
      label: "文章发布总量",
      value: companyInfo?.articleCount,
    },
  ];

  return (
    <section
      className={
        embedded
          ? "p-5 sm:p-6"
          : "border border-white/70 bg-white/45 p-5 sm:p-6"
      }
      style={embedded ? undefined : { borderRadius: 12, boxShadow: "none" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-.02em] text-[#25252a]">
            数据大盘
          </h2>
          <p className="mt-1 text-xs text-[#717179]">全量聚合指标概览</p>
        </div>
      </div>

      {/* 5 主指标 + 4 辅助指标 */}
      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
        {/* 5 主指标 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {mainMetrics.map((m) => (
            <div
              key={m.label}
              className="rounded-[10px] bg-white/50 px-3 py-3 transition-colors hover:bg-white/70"
            >
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#71848a]">
                <span
                  className="inline-block rounded-full"
                  style={{ width: 5, height: 5, background: m.dot }}
                />
                {m.label}
                {"tipText" in m && m.tipText ? (
                  <InfoTip text={(m as { tipText?: string }).tipText ?? ""} />
                ) : null}
              </p>
              <strong
                className="mt-2 block text-[22px] font-semibold tracking-[-.02em] text-[#227DEF]"
                style={{ fontFamily: "'DIN-Medium','OPPOSans',sans-serif" }}
              >
                {loading ? "—" : m.value}
              </strong>
              <p className="mt-0.5 text-[10px] text-[#94a1a5]">{m.hint}</p>
            </div>
          ))}
        </div>

        {/* 4 辅助指标 */}
        <div className="flex flex-col gap-2 rounded-[10px] bg-white/50 px-4 py-3">
          <div className="flex items-center gap-2 border-b border-white/50 pb-2">
            <span className="rounded-full bg-[#e4efff] px-2 py-0.5 text-[10px] font-semibold text-[#227DEF]">
              已优化
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {auxMetrics.map((m) => (
              <div key={m.label} className="text-center">
                <strong
                  className="block text-[20px] font-semibold tracking-[-.02em] text-[#227DEF]"
                  style={{ fontFamily: "'DIN-Medium','OPPOSans',sans-serif" }}
                >
                  {loading ? "—" : formatNumber(m.value)}
                </strong>
                <p className="text-[10px] text-[#717179]">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SentimentBadge({ sentiment }: { sentiment?: string }) {
  const label = sentimentLabel(sentiment);
  const tone =
    sentiment === "positive"
      ? "bg-[#1f9d63]/15 text-[#1f9d63]"
      : sentiment === "negative"
        ? "bg-[#d65a50]/15 text-[#d65a50]"
        : "bg-[#9a9aa0]/15 text-[#717179]";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}

// ============================================================
// 子组件 5：TrendsPanel（3 ECharts 折线 + RangeSelector）
// ============================================================

type TrendsPanelProps = {
  data: UserV1BrandIndexMain | null;
  loading: boolean;
  range: RangeOption;
  onRangeChange: (r: RangeOption) => void;
  embedded?: boolean;
};

function TrendsPanel({
  data,
  loading,
  range,
  onRangeChange,
  embedded = false,
}: TrendsPanelProps) {
  return (
    <section
      className={embedded ? "p-5 sm:p-6" : "border border-white/50 bg-white/25 p-5 sm:p-6"}
      style={embedded ? undefined : { borderRadius: 12, boxShadow: "none" }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-.02em] text-[#25252a]">
            趋势分析
          </h2>
          <p className="mt-1 text-xs text-[#717179]">
            总收录 / 品牌可见度 / 提及次数 按日聚合
          </p>
        </div>
        <RangeSelector current={range} onChange={onRangeChange} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <TrendChartCard title="总收录" loading={loading}>
          <TrendChart
            data={data?.inclusionTrend}
            valueKey="value"
            loading={loading}
          />
        </TrendChartCard>
        <TrendChartCard title="品牌可见度" loading={loading}>
          <TrendChart
            data={data?.visibilityTrend}
            valueKey="rate"
            unit="%"
            loading={loading}
          />
        </TrendChartCard>
        <TrendChartCard title="提及次数" loading={loading}>
          <TrendChart
            data={data?.mentionTrend}
            valueKey="value"
            loading={loading}
          />
        </TrendChartCard>
      </div>
    </section>
  );
}

function RangeSelector({
  current,
  onChange,
}: {
  current: RangeOption;
  onChange: (r: RangeOption) => void;
}) {
  return (
    <div className="glass-control inline-flex items-center rounded-full p-1">
      {rangeTabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className="rounded-full px-3 py-1 text-[11px] font-medium transition"
          style={
            current === tab.key
              ? { background: BUTTON_BLUE, color: "#FFF" }
              : { color: "#5f5f66" }
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function TrendChartCard({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[10px] bg-transparent p-0">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[12px] font-semibold text-[#3a3a40]">
          {title}
        </span>
        {loading ? (
          <Icon
            name="sparkles"
            className="h-3 w-3 animate-pulse text-[#9aa5a8]"
          />
        ) : null}
      </div>
      {children}
    </div>
  );
}

// ============================================================
// 子组件 6：TrendChart（ECharts 折线，对齐 §10.5 tooltip 规格）
// ============================================================

type TrendChartProps = {
  data: Array<UserV1BrandTrendPoint> | undefined;
  valueKey: "value" | "rate";
  unit?: string;
  loading: boolean;
};

function TrendChart({ data, valueKey, unit, loading }: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // 初始化 ECharts 实例（浏览器端）
  useEffect(() => {
    if (!containerRef.current) return;
    chartRef.current = echarts.init(containerRef.current);
    const handleResize = () => chartRef.current?.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  // 数据更新
  useEffect(() => {
    if (!chartRef.current) return;
    const points = (data ?? []).map((p) => ({
      date: p.date ?? "",
      v: valueKey === "rate" ? Number(p.rate ?? 0) : Number(p.value ?? 0),
    }));

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: "axis",
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 6,
        padding: [8, 12],
        textStyle: { color: "#374151", fontSize: 12 },
        shadowColor: "rgba(0, 0, 0, 0.08)",
        shadowBlur: 8,
        shadowOffsetX: 0,
        shadowOffsetY: 2,
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params];
          const p = list[0];
          if (!p) return "";
          const date = String(p.name ?? "");
          const mmdd =
            date.length >= 10 ? date.slice(5).replace("-", ".") : date;
          const val =
            typeof p.value === "number" ? p.value : Number(p.value) || 0;
          return `${mmdd}<br/>数据: <b>${val}${unit ?? ""}</b>`;
        },
      },
      grid: { left: 40, right: 16, top: 16, bottom: 32 },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: points.map((p) => p.date),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          color: "#9ca3af",
          fontSize: 11,
          margin: 8,
          formatter: (val: string) => {
            if (val.length >= 10) return val.slice(5).replace("-", ".");
            return val;
          },
        },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#f3f4f6", type: "dashed" } },
        axisLabel: { color: "#9ca3af", fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: "line",
          data: points.map((p) => p.v),
          smooth: false,
          symbol: "circle",
          symbolSize: 6,
          showSymbol: true,
          lineStyle: { color: "#227DEF", width: 2 },
          itemStyle: { color: "#227DEF", borderColor: "#fff", borderWidth: 2 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(34,125,239,0.25)" },
                { offset: 1, color: "rgba(34,125,239,0.01)" },
              ],
            },
          },
        },
      ],
    };
    chartRef.current.setOption(option, true);
  }, [data, valueKey, unit]);

  const empty = !loading && (!data || data.length === 0);

  return (
    <div className="relative">
      {/* canvas 高度 260px，对齐盘古设计 */}
      <div ref={containerRef} style={{ width: "100%", height: 260 }} />
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-[#9aa5a8]">
          <Icon name="sparkles" className="mr-1 inline h-4 w-4 animate-pulse" />
          正在加载…
        </div>
      ) : null}
      {empty ? (
        <div className="absolute inset-0 flex items-center justify-center text-[12px] text-[#9aa5a8]">
          暂无趋势数据
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// 子组件 7：SentimentTable（情感 3 档表：无/正/负 + 收录量 + 占比）
// ============================================================

type SentimentTableProps = {
  data: Array<UserV1BrandSentimentStat> | undefined;
  loading: boolean;
  embedded?: boolean;
};

function SentimentTable({
  data,
  loading,
  embedded = false,
}: SentimentTableProps) {
  const rows = useMemo(() => {
    const map = new Map<string, UserV1BrandSentimentStat>();
    for (const s of data ?? []) {
      if (s.sentiment) map.set(s.sentiment, s);
    }
    return SENTIMENT_ORDER.map(
      (s) =>
        map.get(s.key) ?? {
          sentiment: s.key,
          count: "0",
          rate: 0,
        },
    );
  }, [data]);

  return (
    <section
      className={
        embedded
          ? "p-5 sm:p-6"
          : "border border-white/70 bg-white/45 p-5 sm:p-6"
      }
      style={embedded ? undefined : { borderRadius: 12, boxShadow: "none" }}
    >
      <h2 className="text-[16px] font-semibold tracking-[-.02em] text-[#25252a]">
        情感倾向分析
      </h2>
      <p className="mt-1 text-xs text-[#717179]">
        情感倾向三档分布（无 / 正 / 负）
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[360px] border-collapse">
          <thead>
            <tr className="border-b border-white/70 bg-white/40">
              <th className="px-4 py-4 text-left text-[11px] font-semibold text-[#717179]">
                情感倾向
              </th>
              <th className="px-4 py-4 text-right text-[11px] font-semibold text-[#717179]">
                收录量
              </th>
              <th className="px-4 py-4 text-right text-[11px] font-semibold text-[#717179]">
                占比
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-12 text-center text-[12px] text-[#9a9aa0]"
                >
                  <Icon
                    name="sparkles"
                    className="mr-1 inline h-4 w-4 animate-pulse"
                  />
                  正在加载…
                </td>
              </tr>
            ) : null}
            {!loading
              ? rows.map((r) => {
                  const found = SENTIMENT_ORDER.find(
                    (s) => s.key === r.sentiment,
                  );
                  return (
                    <tr
                      key={r.sentiment}
                      className="border-b border-white/55 last:border-0 hover:bg-white/40"
                    >
                      <td className="px-4 py-4 text-[12px] font-medium text-[#3a3a40]">
                        <SentimentBadge sentiment={r.sentiment} />
                        <span className="ml-2 text-[#9aa5a8]">
                          {found?.label ?? r.sentiment}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-[12px] text-[#3a3a40]">
                        {formatNumber(r.count)}
                      </td>
                      <td className="px-4 py-4 text-right text-[12px] font-semibold text-[#227DEF]">
                        {formatPercent(r.rate)}
                      </td>
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ============================================================
// 子组件 8：OpinionPanel（舆情周/月结 + 空态）
// ============================================================

type OpinionPanelProps = {
  data: UserV1BrandIndexBottom | null;
  loading: boolean;
  period: OpinionPeriod;
  onPeriodChange: (p: OpinionPeriod) => void;
  embedded?: boolean;
};

function OpinionPanel({
  data,
  loading,
  period,
  onPeriodChange,
  embedded = false,
}: OpinionPanelProps) {
  const opinions = data?.opinions ?? [];

  return (
    <section
      className={
        embedded
          ? "p-5 sm:p-6"
          : "border border-white/70 bg-white/45 p-5 sm:p-6"
      }
      style={embedded ? undefined : { borderRadius: 12, boxShadow: "none" }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-.02em] text-[#25252a]">
            舆情分析
          </h2>
          <p className="mt-1 text-xs text-[#717179]">
            {period === "week" ? "本周舆情结" : "本月舆情结"}
          </p>
        </div>
        <div className="glass-control inline-flex items-center rounded-full p-1">
          {opinionTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onPeriodChange(tab.key)}
              className="rounded-full px-3 py-1 text-[11px] font-medium transition"
              style={
                period === tab.key
                  ? { background: BUTTON_BLUE, color: "#FFF" }
                  : { color: "#5f5f66" }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="flex h-[240px] items-center justify-center text-[12px] text-[#9aa5a8]">
            <Icon
              name="sparkles"
              className="mr-1 inline h-4 w-4 animate-pulse"
            />
            正在加载…
          </div>
        ) : (
            (data?.negativeEvents?.length ?? 0) === 0 &&
            (opinions.length === 0 ||
              opinions.every(
                (o) => !o.sentiment || o.sentiment === "neutral",
              ))
          ) ? (
          // 无舆情分析空态
          <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-[#9aa5a8]">
            <Icon name="bell" className="h-8 w-8 opacity-40" />
            <p className="text-[12px]">暂无舆情分析</p>
            <p className="text-[11px]">
              {period === "week" ? "本周" : "本月"}未检测到需关注的品牌舆情
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 统一舆情分析卡片（盘古风格） */}
            {opinions.length > 0 && (
              <div
                className="rounded-[12px] border p-5"
                style={{
                  background:
                    "linear-gradient(135deg, #fef2f2 0%, #fff1f2 50%, #fff7ed 100%)",
                  borderColor: "#fecaca",
                }}
              >
                <ul className="space-y-4">
                  {opinions.map((o, idx) => (
                    <li key={`${o.title}-${idx}`}>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: "#e11d48" }}
                        />
                        <span className="text-[13px] font-semibold text-[#9f1239]">
                          {o.title || "未命名"}
                        </span>
                      </div>
                      <p className="mt-1.5 pl-3.5 whitespace-pre-wrap text-[12px] leading-[1.8] text-[#3f3f46]">
                        {o.summary || "暂无摘要"}
                      </p>
                    </li>
                  ))}
                </ul>
                {opinions[0]?.occurredAt ? (
                  <p className="mt-4 text-[10px] text-[#9aa5a8]">
                    生成于 {formatDateTime(opinions[0].occurredAt)}
                  </p>
                ) : null}
              </div>
            )}

            {/* 负面事件明细列表 */}
            {(data?.negativeEvents?.length ?? 0) > 0 && (
              <div>
                <p className="mb-3 text-[13px] font-semibold text-[#25252a]">
                  负面事件列表（{data?.negativeEvents?.length ?? 0} 条）
                </p>
                <ul className="space-y-3">
                  {(data?.negativeEvents ?? []).map((ev, idx) => (
                    <li
                      key={`neg-${idx}`}
                      className="rounded-[10px] border border-red-100 bg-red-50/40 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <SentimentBadge sentiment="negative" />
                          <span className="text-[11px] text-[#717179]">
                            {ev.platform || "未知平台"}
                          </span>
                        </div>
                        {ev.observedAt ? (
                          <span className="text-[10px] text-[#9aa5a8]">
                            {formatDateTime(ev.observedAt)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 truncate text-[12px] font-medium text-[#25252a]">
                        Q: {ev.question || "—"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-[1.6] text-[#3f3f46]">
                        A: {ev.answerPreview || "—"}
                      </p>
                      {ev.shareUrl ? (
                        <a
                          href={ev.shareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-[11px] text-blue-600 hover:underline"
                        >
                          查看完整对话 →
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================
// 子组件 9：DiagnosePanel（优化记录 - 盘古风格）
// ============================================================

type DiagnosePanelProps = {
  loading: boolean;
  stats: UserV1BrandOptimizeStats | null;
  records: UserV1BrandRecord[];
  total: number;
  currentPage: number;
  pageSize: number;
  siteFilter: string;
  statusFilter: string;
  platformIcons: Map<string, string>;
  dashboard: UserV1BrandDashboard | null;
  companyInfo: UserV1BrandCompanyInfo | null;
  indexMain: UserV1BrandIndexMain | null;
  indexMainYear: UserV1BrandIndexMain | null;
  onPageChange: (page: number) => void;
  onSiteFilterChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
};

// 将 ISO 日期格式化为 "MM-DD HH:mm"
function formatRecordDateTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}

// 将 ISO 日期格式化为 "MM.DD"（盘古风格）
function formatRecordDate(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}.${dd}`;
}

const STATUS_FILTER_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "", label: "全部" },
  { key: "included", label: "已收录" },
  { key: "not_included", label: "未收录" },
];

function DiagnosePanel({
  loading,
  stats,
  records,
  total,
  currentPage,
  pageSize,
  siteFilter,
  statusFilter,
  platformIcons,
  dashboard,
  companyInfo,
  indexMain,
  indexMainYear,
  onPageChange,
  onSiteFilterChange,
  onStatusFilterChange,
}: DiagnosePanelProps) {
  // 累计收录明细数据（从 indexMain.inclusionTrend 取）
  const complianceData = useMemo(() => {
    const trend = indexMain?.inclusionTrend ?? [];
    return trend.map((p) => ({
      date: p.date ?? "",
      count: Number(p.value ?? 0),
      qualified: Number(p.value ?? 0) > 0,
    }));
  }, [indexMain]);

  // 优化数据区交互状态
  const [hoveredPlatform, setHoveredPlatform] = useState<string>("");
  const [keywordModalOpen, setKeywordModalOpen] = useState(false);
  const [keywordListData, setKeywordListData] = useState<
    UserV1BrandQuestionStat[]
  >([]);
  const [keywordListLoading, setKeywordListLoading] = useState(false);
  const [questionTotalCount, setQuestionTotalCount] = useState<number>(0);

  // 加载词条列表（从月度摘要接口获取 question 聚合数据，用于弹窗展示收录次数）
  const loadKeywordList = useCallback(async () => {
    setKeywordListLoading(true);
    try {
      const [summary, questionsReply] = await Promise.all([
        userApi.geoBrandBoard.getBrandSummary({ periodType: "month" }),
        userApi.question.listQuestions({ status: 2, pageSize: 1 }),
      ]);
      setKeywordListData(summary.questions ?? []);
      setQuestionTotalCount(Number(questionsReply.totalSize ?? 0));
    } catch {
      setKeywordListData([]);
      setQuestionTotalCount(0);
    } finally {
      setKeywordListLoading(false);
    }
  }, []);

  // 组件挂载时加载关键词问题数据（用于卡片显示数量）
  useEffect(() => {
    void loadKeywordList();
  }, [loadKeywordList]);

  const filteredComplianceData = useMemo(() => {
    const now = new Date();
    const sorted = [...complianceData].sort((a, b) => a.date.localeCompare(b.date));
    const trendMap = new Map(sorted.map((d) => [d.date, d]));
    const result: Array<{ date: string; count: number; qualified: boolean }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const existing = trendMap.get(dateStr);
      result.push({
        date: dateStr,
        count: existing?.count ?? 0,
        qualified: existing?.qualified ?? false,
      });
    }
    return result;
  }, [complianceData]);

  // 收录柱状图时间范围切换
  const [chartRange, setChartRange] = useState<"近7天" | "本月" | "今年">(
    "近7天",
  );

  // 年度数据（按月分桶，来自 indexMainYear）
  const yearData = useMemo(() => {
    const trend = indexMainYear?.inclusionTrend ?? [];
    return trend.map((p) => ({
      date: p.date ?? "",
      count: Number(p.value ?? 0),
      qualified: Number(p.value ?? 0) > 0,
    }));
  }, [indexMainYear]);

  const chartData = useMemo(() => {
    const now = new Date();

    if (chartRange === "近7天") {
      // 生成最近7天完整日期序列（含今天），缺失补0
      const sorted = [...complianceData].sort((a, b) => a.date.localeCompare(b.date));
      const trendMap = new Map(sorted.map((d) => [d.date, d]));
      const result: Array<{ date: string; count: number; qualified: boolean }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const existing = trendMap.get(dateStr);
        result.push({
          date: dateStr,
          count: existing?.count ?? 0,
          qualified: existing?.qualified ?? false,
        });
      }
      return result;
    }
    if (chartRange === "本月") {
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      return complianceData.filter((d) => d.date.startsWith(yearMonth));
    }
    // 今年：使用年度数据（按月分桶），若未加载则回退到现有数据
    if (yearData.length > 0) {
      return yearData;
    }
    const year = `${now.getFullYear()}`;
    return complianceData.filter((d) => d.date.startsWith(year));
  }, [complianceData, yearData, chartRange]);

  // 平台分布饼图数据（基于收录量 inclusionCount）
  const platformPieData = useMemo(() => {
    const platforms = dashboard?.platforms ?? [];
    const total = platforms.reduce(
      (sum, p) => sum + Number(p.inclusionCount ?? 0),
      0,
    );
    if (total === 0) {
      // 无数据时从平台图标列表生成
      return Array.from(platformIcons.keys()).map((name) => ({
        name,
        value: 0,
        percentage: 0,
      }));
    }
    return platforms.map((p) => {
      const val = Number(p.inclusionCount ?? 0);
      return {
        name: p.platform ?? "未知",
        value: val,
        percentage: Math.min(100, Math.round((val / total) * 100)),
      };
    });
  }, [dashboard, platformIcons]);

  // 平台列表数据（从 dashboard.platforms 取）
  const platformListData = useMemo(() => {
    const platforms = dashboard?.platforms ?? [];
    if (platforms.length > 0) return platforms;
    // 无数据时从平台图标列表生成空数据
    return Array.from(platformIcons.keys()).map((name) => ({
      platform: name,
      visibilityRate: 0,
      mentionCount: "0",
      sentiment: "",
      inclusionCount: "0",
    }));
  }, [dashboard, platformIcons]);

  // 分页页码
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageItems = useMemo(() => {
    const items: Array<React.ReactNode> = [];
    for (let page = 1; page <= totalPages; page += 1) {
      if (
        page === 1 ||
        page === totalPages ||
        (page >= currentPage - 1 && page <= currentPage + 1)
      ) {
        items.push(
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`min-w-[28px] rounded-md px-2 py-1 text-[12px] font-medium transition ${
              page === currentPage
                ? "bg-[#227DEF] text-white"
                : "text-[#5a5a62] hover:bg-[#f4f6f9]"
            }`}
          >
            {page}
          </button>,
        );
      } else if (
        (page === currentPage - 2 || page === currentPage + 2) &&
        page !== 1 &&
        page !== totalPages
      ) {
        items.push(
          <span
            key={`ellipsis-${page}`}
            className="px-1 text-[12px] text-[#9aa5a8]"
          >
            …
          </span>,
        );
      }
    }
    return items;
  }, [currentPage, totalPages, onPageChange]);

  // 平台筛选项
  const platformNames = useMemo(
    () => Array.from(platformIcons.keys()),
    [platformIcons],
  );

  return (
    <div className="space-y-5">
      {/* 企业信息 + 品牌词区 */}
      <section
        className="border border-white/70 bg-white/45 p-5 sm:p-6"
        style={{ borderRadius: 12 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Icon name="building" className="h-4 w-4 text-[#227DEF]" />
          <h2 className="text-[15px] font-semibold text-[#25252a]">
            {companyInfo?.enterpriseName || "企业信息"}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {(companyInfo?.brandKeywords ?? []).length > 0 ? (
            (companyInfo?.brandKeywords ?? []).map((kw, idx) => (
              <span
                key={`${kw}-${idx}`}
                className="rounded-full bg-gradient-to-r from-[#227DEF]/10 to-[#6e6af4]/10 px-3 py-1.5 text-[13px] font-semibold text-[#227DEF] ring-1 ring-[#227DEF]/20 transition hover:from-[#227DEF]/20 hover:to-[#6e6af4]/20"
              >
                {kw}
              </span>
            ))
          ) : (
            <span className="text-[13px] text-[#9aa5a8]">暂无品牌词</span>
          )}
        </div>
      </section>

      {/* 收录数据 */}
      <section
        className="border border-white/70 bg-white/45 p-5 sm:p-6"
        style={{ borderRadius: 12 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Icon name="database" className="h-4 w-4 text-[#227DEF]" />
          <h2 className="text-[15px] font-semibold text-[#25252a]">收录数据</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-[340px_1fr_1fr] items-stretch">
          {/* 左侧：统计卡 */}
          <div className="grid grid-cols-2 gap-2 content-start">
            {/* 累计优化天数 */}
            <div className="rounded-[12px] bg-gradient-to-br from-[#e6f0ff] to-white p-3 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#717179]">
                <Icon name="clock" className="h-3.5 w-3.5 text-[#227DEF]" />
                累计优化天数
              </p>
              <p
                className="mt-1 text-[22px] font-bold text-[#227DEF]"
                style={{ fontFamily: "'DIN-Medium',sans-serif" }}
              >
                {loading
                  ? "—"
                  : (() => {
                      const startMs = companyInfo?.startedAt
                        ? new Date(companyInfo.startedAt).getTime()
                        : 0;
                      if (!startMs) return "0";
                      const dayMs = 24 * 60 * 60 * 1000;
                      return String(
                        Math.max(0, Math.floor((Date.now() - startMs) / dayMs)),
                      );
                    })()}
              </p>
            </div>
            {/* 今日收录条数 */}
            <div className="rounded-[12px] bg-gradient-to-br from-[#e6f7ef] to-white p-3 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#717179]">
                <Icon name="trend" className="h-3.5 w-3.5 text-[#1f9d63]" />
                今日收录条数
              </p>
              <p
                className="mt-1 text-[22px] font-bold text-[#1f9d63]"
                style={{ fontFamily: "'DIN-Medium',sans-serif" }}
              >
                {loading ? "—" : (stats?.todayInclusion ?? "0")}
              </p>
            </div>
            {/* 累计达标天数 */}
            <div className="rounded-[12px] bg-gradient-to-br from-[#fff1e0] to-white p-3 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#717179]">
                <Icon name="check" className="h-3.5 w-3.5 text-[#F59E0B]" />
                累计达标天数
              </p>
              <p
                className="mt-1 text-[22px] font-bold text-[#F59E0B]"
                style={{ fontFamily: "'DIN-Medium',sans-serif" }}
              >
                {loading ? "—" : (stats?.totalQualifiedDays ?? "0")}
              </p>
            </div>
            {/* 今日PC收录 */}
            <div className="rounded-[12px] bg-gradient-to-br from-[#f0eaff] to-white p-3 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#717179]">
                <Icon name="monitor" className="h-3.5 w-3.5 text-[#8B5CF6]" />
                今日PC收录
              </p>
              <p
                className="mt-1 text-[22px] font-bold text-[#8B5CF6]"
                style={{ fontFamily: "'DIN-Medium',sans-serif" }}
              >
                {loading ? "—" : (stats?.todayPcInclusion ?? "0")}
              </p>
            </div>
            {/* 优化剩余天数 */}
            <div className="rounded-[12px] bg-gradient-to-br from-[#fdecee] to-white p-3 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#717179]">
                <Icon name="target" className="h-3.5 w-3.5 text-[#ef4444]" />
                优化剩余天数
              </p>
              <p
                className="mt-1 text-[22px] font-bold text-[#ef4444]"
                style={{ fontFamily: "'DIN-Medium',sans-serif" }}
              >
                {loading
                  ? "—"
                  : (() => {
                      const endMs = companyInfo?.expiresAt
                        ? new Date(companyInfo.expiresAt).getTime()
                        : 0;
                      if (!endMs) return "0";
                      const dayMs = 24 * 60 * 60 * 1000;
                      return String(
                        Math.max(0, Math.ceil((endMs - Date.now()) / dayMs)),
                      );
                    })()}
              </p>
            </div>
            {/* 今日移动端收录 */}
            <div className="rounded-[12px] bg-gradient-to-br from-[#e0f7f4] to-white p-3 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#717179]">
                <Icon name="mobile" className="h-3.5 w-3.5 text-[#14B8A6]" />
                今日移动端收录
              </p>
              <p
                className="mt-1 text-[22px] font-bold text-[#14B8A6]"
                style={{ fontFamily: "'DIN-Medium',sans-serif" }}
              >
                {loading ? "—" : (stats?.todayMobileInclusion ?? "0")}
              </p>
            </div>
          </div>

          {/* 中间：累计达标明细 */}
          <div className="min-w-0 flex h-full flex-col">
            <div className="flex shrink-0 items-center justify-between mb-2">
              <h3 className="text-[13px] font-semibold text-[#3a3a40]">
                累计达标明细（近7天）
              </h3>
            </div>
            <div className="overflow-y-auto overflow-x-hidden rounded-[10px] border border-[#e4efff] bg-white flex-1 min-h-0">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-[#f0f0f0] bg-[#f8fafd]">
                    <th className="py-2 px-3 text-left font-semibold text-[#717179]">
                      日期
                    </th>
                    <th className="py-2 px-3 text-right font-semibold text-[#717179]">
                      收录条数
                    </th>
                    <th className="py-2 px-3 text-center font-semibold text-[#717179]">
                      状态
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-6 text-center text-[#9aa5a8]"
                      >
                        加载中...
                      </td>
                    </tr>
                  ) : filteredComplianceData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-6 text-center text-[#9aa5a8]"
                      >
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    filteredComplianceData.map((d) => (
                      <tr
                        key={d.date}
                        className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#f8fafd] transition-colors"
                      >
                        <td className="py-2 px-3 text-[#3a3a40]">
                          {formatRecordDate(d.date)}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-[#227DEF]">
                          {d.count}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {d.qualified ? (
                            <span className="inline-flex items-center rounded-full bg-[#e6f7ef] px-2 py-0.5 text-[11px] font-medium text-[#1f9d63]">
                              达标
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-[#f0f1f3] px-2 py-0.5 text-[11px] font-medium text-[#9aa5a8]">
                              未达标
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 右侧：累计收录柱状图 */}
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center justify-between mb-2">
              <h3 className="text-[13px] font-semibold text-[#3a3a40]">
                累计收录柱状图
              </h3>
              <div className="flex items-center gap-1 rounded-full bg-[#f0f4fa] p-0.5">
                {(["近7天", "本月", "今年"] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setChartRange(range)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                      chartRange === range
                        ? "bg-[#227DEF] text-white shadow-sm"
                        : "text-[#717179] hover:text-[#227DEF]"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ComplianceBarChart data={chartData} loading={loading} />
            </div>
          </div>
        </div>
      </section>

      {/* 优化数据 */}
      <section
        className="border border-white/70 bg-white/45 p-5 sm:p-6"
        style={{ borderRadius: 12 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Icon name="trend" className="h-4 w-4 text-[#227DEF]" />
          <h2 className="text-[15px] font-semibold text-[#25252a]">优化数据</h2>
        </div>

        <div className="flex gap-4">
          {/* 左侧：统计卡（窄列） */}
          <div className="w-[200px] shrink-0">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {/* 关键词 */}
              <div className="rounded-[12px] bg-gradient-to-br from-[#f0f9ff] to-white p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-[11px] font-medium text-[#717179]">关键词</p>
                <p
                  className="mt-1 text-[22px] font-bold text-[#227DEF]"
                  style={{ fontFamily: "'DIN-Medium',sans-serif" }}
                >
                  {loading ? "—" : formatNumber(companyInfo?.keywordCount)}
                </p>
              </div>
              {/* 词条量（关键词问题数量，可点击弹窗按收录次数排序） */}
              <div
                className="cursor-pointer rounded-[12px] bg-gradient-to-br from-[#e6f0ff] to-white p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => setKeywordModalOpen(true)}
              >
                <p className="text-[11px] font-medium text-[#717179]">词条量</p>
                <p
                  className="mt-1 text-[22px] font-bold text-[#227DEF]"
                  style={{ fontFamily: "'DIN-Medium',sans-serif" }}
                >
                  {keywordListLoading ? "—" : formatNumber(questionTotalCount)}
                </p>
                <p className="mt-0.5 text-[10px] text-[#9aa5a8]">
                  点击查看详情
                </p>
              </div>
              <div className="rounded-[12px] bg-gradient-to-br from-[#e6f7ef] to-white p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-[11px] font-medium text-[#717179]">
                  收录总量
                </p>
                <p
                  className="mt-1 text-[22px] font-bold text-[#1f9d63]"
                  style={{ fontFamily: "'DIN-Medium',sans-serif" }}
                >
                  {loading ? "—" : formatNumber(companyInfo?.totalInclusion)}
                </p>
              </div>
              <div className="rounded-[12px] bg-gradient-to-br from-[#f0eaff] to-white p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-[11px] font-medium text-[#717179]">
                  文章发布总量
                </p>
                <p
                  className="mt-1 text-[22px] font-bold text-[#8B5CF6]"
                  style={{ fontFamily: "'DIN-Medium',sans-serif" }}
                >
                  {loading ? "—" : formatNumber(companyInfo?.articleCount)}
                </p>
              </div>
            </div>
          </div>

          {/* 右侧：合并的平台分布&占比 + 平台数据 */}
          <div className="flex-1 rounded-[12px] bg-white/60 p-2">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-[13px] font-semibold text-[#3a3a40]">
                平台分布&占比
              </h3>
            </div>
            <div className="flex items-stretch gap-2">
              {/* 左列：前半平台 */}
              <div className="flex flex-col justify-between gap-1 min-w-0">
                {platformListData
                  .slice(0, Math.ceil(platformListData.length / 2))
                  .map((p, idx) => {
                    const name = p.platform ?? "未知";
                    const pColor = platformColor(name);
                    const iconUrl = platformIcons.get(name);
                    const sentLabel = sentimentLabel(p.sentiment);
                    const sentColor =
                      p.sentiment === "positive"
                        ? "#1f9d63"
                        : p.sentiment === "negative"
                          ? "#d65a50"
                          : "#9aa5a8";
                    const isHovered = hoveredPlatform === name;
                    return (
                      <div
                        key={`${name}-${idx}`}
                        className={`flex flex-1 flex-col justify-center rounded-[8px] px-2 py-1 transition min-h-0 ${
                          isHovered
                            ? "bg-[#e6f0ff] shadow-sm"
                            : "bg-white/60 hover:bg-white hover:shadow-sm"
                        }`}
                        onMouseEnter={() => setHoveredPlatform(name)}
                        onMouseLeave={() => setHoveredPlatform("")}
                      >
                        <div className="flex items-center gap-1.5">
                          {iconUrl ? (
                            <img
                              src={iconUrl}
                              alt={name}
                              className="rounded-full object-contain shrink-0"
                              style={{ width: 16, height: 16 }}
                            />
                          ) : (
                            <span
                              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                              style={{ background: pColor }}
                            >
                              {name.slice(0, 1)}
                            </span>
                          )}
                          <span className="text-[12px] font-semibold text-[#3a3a40] truncate">
                            {name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px]">
                          <span className="text-[#717179]">
                            可见度{" "}
                            <b className="text-[#3a3a40]">
                              {formatPercent(p.visibilityRate)}
                            </b>
                          </span>
                          <span className="text-[#717179]">
                            收录{" "}
                            <b className="text-[#227DEF]">
                              {formatNumber(p.inclusionCount)}
                            </b>
                          </span>
                          <span className="text-[#717179]">
                            情感
                            <span
                              className="inline-flex items-center rounded-full px-1.5 py-[1px] text-[10px] font-medium ml-1"
                              style={{
                                background: `${sentColor}15`,
                                color: sentColor,
                              }}
                            >
                              {sentLabel}
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* 饼图 */}
              <PlatformPieChart
                data={platformPieData}
                loading={loading}
                platformIcons={platformIcons}
                hoveredName={hoveredPlatform}
                onPieHover={(name) => setHoveredPlatform(name)}
                onPieLeave={() => setHoveredPlatform("")}
              />

              {/* 右列：后半平台 */}
              <div className="flex flex-col justify-between gap-1">
                {platformListData
                  .slice(Math.ceil(platformListData.length / 2))
                  .map((p, idx) => {
                    const name = p.platform ?? "未知";
                    const pColor = platformColor(name);
                    const iconUrl = platformIcons.get(name);
                    const sentLabel = sentimentLabel(p.sentiment);
                    const sentColor =
                      p.sentiment === "positive"
                        ? "#1f9d63"
                        : p.sentiment === "negative"
                          ? "#d65a50"
                          : "#9aa5a8";
                    const isHovered = hoveredPlatform === name;
                    return (
                      <div
                        key={`${name}-r-${idx}`}
                        className={`flex flex-1 flex-col justify-center rounded-[8px] px-2 py-1 transition min-h-0 ${
                          isHovered
                            ? "bg-[#e6f0ff] shadow-sm"
                            : "bg-white/60 hover:bg-white hover:shadow-sm"
                        }`}
                        onMouseEnter={() => setHoveredPlatform(name)}
                        onMouseLeave={() => setHoveredPlatform("")}
                      >
                        <div className="flex items-center gap-1.5">
                          {iconUrl ? (
                            <img
                              src={iconUrl}
                              alt={name}
                              className="rounded-full object-contain shrink-0"
                              style={{ width: 16, height: 16 }}
                            />
                          ) : (
                            <span
                              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                              style={{ background: pColor }}
                            >
                              {name.slice(0, 1)}
                            </span>
                          )}
                          <span className="text-[12px] font-semibold text-[#3a3a40] truncate">
                            {name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px]">
                          <span className="text-[#717179]">
                            可见度{" "}
                            <b className="text-[#3a3a40]">
                              {formatPercent(p.visibilityRate)}
                            </b>
                          </span>
                          <span className="text-[#717179]">
                            收录{" "}
                            <b className="text-[#227DEF]">
                              {formatNumber(p.inclusionCount)}
                            </b>
                          </span>
                          <span className="text-[#717179]">
                            情感
                            <span
                              className="inline-flex items-center rounded-full px-1.5 py-[1px] text-[10px] font-medium ml-1"
                              style={{
                                background: `${sentColor}15`,
                                color: sentColor,
                              }}
                            >
                              {sentLabel}
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* 词条详情弹窗 */}
        <KeywordDetailModal
          open={keywordModalOpen}
          onClose={() => setKeywordModalOpen(false)}
          data={keywordListData}
          loading={keywordListLoading}
        />
      </section>

      {/* 收录明细 */}
      <section
        className="border border-white/70 bg-white/45 p-5 sm:p-6"
        style={{ borderRadius: 12 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="article" className="h-4 w-4 text-[#227DEF]" />
            <h2 className="text-[15px] font-semibold text-[#25252a]">
              收录明细
            </h2>
          </div>
        </div>

        {/* 筛选栏 */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-[#717179]">
              平台：
            </span>
            <button
              type="button"
              onClick={() => onSiteFilterChange("")}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                siteFilter === ""
                  ? "bg-gradient-to-r from-[#227DEF] to-[#007CFF] text-white shadow-sm"
                  : "bg-[#f4f6f9] text-[#5a5a62] hover:bg-[#e8eef5]"
              }`}
            >
              全部
            </button>
            {platformNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onSiteFilterChange(name)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                  siteFilter === name
                    ? "bg-gradient-to-r from-[#227DEF] to-[#007CFF] text-white shadow-sm"
                    : "bg-[#f4f6f9] text-[#5a5a62] hover:bg-[#e8eef5]"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-[#717179]">
              状态：
            </span>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <button
                key={option.key || "all"}
                type="button"
                onClick={() => onStatusFilterChange(option.key)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                  statusFilter === option.key
                    ? "bg-gradient-to-r from-[#227DEF] to-[#007CFF] text-white shadow-sm"
                    : "bg-[#f4f6f9] text-[#5a5a62] hover:bg-[#e8eef5]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* 收录明细表 - 复用数据报表设计 */}
        <div className="overflow-x-auto rounded-[12px] border border-white/70">
          <table className="w-full min-w-[1080px] border-collapse">
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
                  情感倾向
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#717179]">
                  联系方式
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
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-[12px] text-[#9aa5a8]"
                  >
                    正在加载...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-[12px] text-[#9aa5a8]"
                  >
                    暂无收录明细
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => {
                  const pName = r.platform ?? "—";
                  const pColor = platformColor(pName);
                  const iconUrl = r.platformIcon
                    ? resolveIconUrl(r.platformIcon)
                    : platformIcons.get(pName);
                  return (
                    <tr
                      key={r.id ?? `${pName}-${idx}`}
                      className="border-b border-white/55 last:border-0 hover:bg-white/40"
                    >
                      <td
                        className="max-w-[120px] truncate px-4 py-3 text-[12px] font-medium text-[#3a3a40]"
                        title={r.keyword ?? ""}
                      >
                        {r.keyword ?? "-"}
                      </td>
                      <td
                        className="max-w-[260px] truncate px-4 py-3 text-[12px] text-[#3a3a40]"
                        title={r.question ?? ""}
                      >
                        {r.question ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#5f5f66]">
                        <span className="inline-flex items-center gap-1.5 align-middle">
                          {iconUrl ? (
                            <img
                              src={iconUrl}
                              alt={pName}
                              className="h-5 w-5 shrink-0 rounded-[3px] object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span
                              className="flex h-5 w-5 items-center justify-center rounded-[3px] text-[9px] font-bold text-white"
                              style={{ background: pColor }}
                            >
                              {pName.slice(0, 1)}
                            </span>
                          )}
                          <span className="truncate">{pName}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#5f5f66]">
                        {r.terminalType === 2 ? (
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
                        {r.included ? (
                          <span className="inline-flex items-center rounded-full bg-[#1f9d63]/15 px-2 py-0.5 text-[10px] font-semibold text-[#1f9d63]">
                            收录
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-[#9a9aa0]/15 px-2 py-0.5 text-[10px] font-semibold text-[#717179]">
                            未收录
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.sentiment === "positive" ? (
                          <span className="inline-flex items-center rounded-full bg-[#1f9d63]/15 px-2 py-0.5 text-[10px] font-semibold text-[#1f9d63]">
                            正
                          </span>
                        ) : r.sentiment === "negative" ? (
                          <span className="inline-flex items-center rounded-full bg-[#d65a50]/15 px-2 py-0.5 text-[10px] font-semibold text-[#d65a50]">
                            负
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-[#9a9aa0]/15 px-2 py-0.5 text-[10px] font-semibold text-[#717179]">
                            无
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#5f5f66]">
                        {r.contactExposed ? (
                          <span className="inline-flex items-center rounded-full bg-[#3f8fff]/15 px-2 py-0.5 text-[10px] font-semibold text-[#3f8fff]">
                            是
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-[#9a9aa0]/15 px-2 py-0.5 text-[10px] font-semibold text-[#717179]">
                            否
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[#717179]">
                        {formatRecordDateTime(r.observedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.sessionRef ? (
                          <a
                            href={r.sessionRef}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-[#3f8fff]/10 px-2.5 text-[11px] font-medium text-[#3f8fff] transition hover:bg-[#3f8fff]/20"
                          >
                            <Icon name="eye" className="h-3.5 w-3.5" />
                            查看内容 &gt;
                          </a>
                        ) : (
                          <span className="text-[12px] text-[#9aa5a8]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12px] text-[#9aa5a8]">共 {total} 条</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="rounded-md px-3 py-1 text-[12px] font-medium text-[#5a5a62] transition hover:bg-[#f4f6f9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              上一页
            </button>
            {pageItems}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="rounded-md px-3 py-1 text-[12px] font-medium text-[#5a5a62] transition hover:bg-[#f4f6f9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      </section>


      {/* 底部申明 */}
      <p className="text-center text-[11px] text-[#9aa5a8]">
        AI大模型搜索结果千人千面，报表检测结果以系统检测结果为准
      </p>
    </div>
  );
}

// ============================================================
// 子组件 9a：ComplianceBarChart（累计收录柱状图 - 盘古风格）
// ============================================================

type ComplianceBarChartProps = {
  data: Array<{ date: string; count: number; qualified: boolean }>;
  loading: boolean;
};

function ComplianceBarChart({ data, loading }: ComplianceBarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    chartRef.current = echarts.init(containerRef.current);
    const handleResize = () => chartRef.current?.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: "axis",
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#e4efff",
        borderRadius: 8,
        padding: [8, 12],
        textStyle: { color: "#3a3a40", fontSize: 12 },
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params];
          const p = list[0];
          if (!p) return "";
          const date = String(p.name ?? "");
          const mmdd =
            date.length >= 10 ? date.slice(5).replace("-", ".") : date;
          const qualified = (p.data as { qualified?: boolean })?.qualified;
          return `<div style="font-weight:600;margin-bottom:4px">${mmdd}</div>收录: <b style="color:#227DEF">${p.value}</b>${qualified === false ? ' <span style="color:#9aa5a8;font-size:11px">(未达标)</span>' : ""}`;
        },
      },
      grid: { left: 35, right: 15, top: 20, bottom: 25 },
      xAxis: {
        type: "category",
        data: data.map((d) => formatRecordDate(d.date)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#e6eef5" } },
        axisLabel: {
          color: "#9aa5a8",
          fontSize: 10,
          margin: 8,
        },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#e6eef5", type: "dashed" } },
        axisLabel: { color: "#9aa5a8", fontSize: 10 },
      },
      series: [
        {
          type: "bar",
          data: data.map((d) => ({
            value: d.count,
            qualified: d.qualified,
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
              color: d.qualified
                ? {
                    type: "linear",
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: "#227DEF" },
                      { offset: 1, color: "#6e6af4" },
                    ],
                  }
                : {
                    type: "linear",
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: "#c8c8cc" },
                      { offset: 1, color: "#e0e0e0" },
                    ],
                  },
            },
          })),
          barWidth: "45%",
          emphasis: {
            itemStyle: {
              shadowBlur: 12,
              shadowOffsetX: 0,
              shadowColor: "rgba(34,125,239,0.4)",
              borderRadius: [6, 6, 0, 0],
            },
          },
          select: {
            itemStyle: {
              shadowBlur: 12,
              shadowColor: "rgba(34,125,239,0.4)",
            },
          },
        },
      ],
    };
    chartRef.current.setOption(option, true);
  }, [data]);

  return (
    <div className="rounded-[10px] bg-[#f4f8fd] p-3 h-full flex flex-col">
      <div ref={containerRef} className="flex-1" style={{ minHeight: 280 }} />
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center text-[12px] text-[#9aa5a8]">
          加载中...
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// 子组件 9b：PlatformPieChart（平台分布&占比饼图）
// ============================================================

type PlatformPieChartProps = {
  data: Array<{ name: string; value: number; percentage: number }>;
  loading: boolean;
  platformIcons: Map<string, string>;
  onPieHover?: (name: string) => void;
  onPieLeave?: () => void;
  hoveredName?: string;
};

function PlatformPieChart({
  data,
  loading,
  onPieHover,
  onPieLeave,
  hoveredName,
}: PlatformPieChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const onPieHoverRef = useRef(onPieHover);
  const onPieLeaveRef = useRef(onPieLeave);

  useEffect(() => {
    onPieHoverRef.current = onPieHover;
  }, [onPieHover]);
  useEffect(() => {
    onPieLeaveRef.current = onPieLeave;
  }, [onPieLeave]);

  // 1. 初始化图表（只执行一次）
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;
    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // 2. 事件绑定（只执行一次，通过 ref 获取最新回调）
  const mouseOverHandlerRef = useRef<((p: unknown) => void) | null>(null);
  const mouseOutHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    mouseOverHandlerRef.current = (params: unknown) => {
      const p = params as { name?: string };
      if (p?.name) onPieHoverRef.current?.(p.name);
    };
    mouseOutHandlerRef.current = () => {
      onPieLeaveRef.current?.();
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const handleMouseOver = (params: unknown) =>
      mouseOverHandlerRef.current?.(params);
    const handleMouseOut = () => mouseOutHandlerRef.current?.();
    chart.on(
      "mouseover",
      handleMouseOver as unknown as (event: unknown) => void,
    );
    chart.on("mouseout", handleMouseOut as unknown as (event: unknown) => void);
    chart.on(
      "globalout",
      handleMouseOut as unknown as (event: unknown) => void,
    );
    if (chart.getZr()) {
      chart
        .getZr()
        ?.on("mouseout", handleMouseOut as unknown as (event: unknown) => void);
    }
    return () => {
      if (!chart.isDisposed()) {
        chart.off(
          "mouseover",
          handleMouseOver as unknown as (event: unknown) => void,
        );
        chart.off(
          "mouseout",
          handleMouseOut as unknown as (event: unknown) => void,
        );
        chart.off(
          "globalout",
          handleMouseOut as unknown as (event: unknown) => void,
        );
        const zr = chart.getZr();
        if (zr) {
          zr.off(
            "mouseout",
            handleMouseOut as unknown as (event: unknown) => void,
          );
        }
      }
    };
  }, []);

  // 3. 初始化图表配置（只在数据变化时更新，用 setOption 合并）
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || chart.isDisposed()) return;
    const colors = data.map((d) => platformColor(d.name));
    const total = data.reduce((sum, d) => sum + d.value, 0);

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: "item",
        backgroundColor: "#fff",
        borderWidth: 0,
        borderRadius: 4,
        padding: 8,
        textStyle: { color: "#3a3a40", fontSize: 12 },
        formatter: (params: unknown) => {
          const p = (Array.isArray(params) ? params[0] : params) as {
            name?: string;
            percent?: number;
          };
          return `${p.name ?? ""}<br/>占比: <b>${p.percent ?? 0}%</b>`;
        },
      },
      legend: { show: false },
      graphic: [
        {
          type: "text",
          left: "center",
          top: "38%",
          silent: true,
          style: { text: "收录总量", fontSize: 12, fill: "#717179" },
        },
        {
          type: "text",
          left: "center",
          top: "50%",
          silent: true,
          style: {
            text: `${total}`,
            fontSize: 22,
            fontWeight: 700,
            fill: "#227DEF",
            fontFamily: "'DIN-Medium', sans-serif",
          },
        },
      ],
      series: [
        {
          type: "pie",
          radius: ["42%", "76%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
          label: { show: false },
          emphasis: {
            focus: "self",
            scale: false,
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0,0,0,0.2)",
            },
          },
          selectedMode: false,
          labelLine: { show: false },
          data: data.map((d, i) => ({
            name: d.name,
            value: d.value,
            itemStyle: { color: colors[i % colors.length], opacity: 1 },
          })),
        },
      ],
    };
    chart.setOption(option, true);
  }, [data]);

  // 4. 悬浮状态更新（只更新 graphic 和 data，不重建整个 option）
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || chart.isDisposed()) return;
    const colors = data.map((d) => platformColor(d.name));
    const total = data.reduce((sum, d) => sum + d.value, 0);

    let centerText = `${total}`;
    let centerSubText = "收录总量";
    if (hoveredName) {
      const item = data.find((d) => d.name === hoveredName);
      if (item) {
        centerText = `${item.value}`;
        centerSubText =
          item.name.length > 6 ? `${item.name.slice(0, 6)}…` : item.name;
      }
    }

    chart.dispatchAction({ type: "downplay" });

    chart.setOption({
      graphic: [
        {
          type: "text",
          left: "center",
          top: "38%",
          silent: true,
          style: { text: centerSubText, fontSize: 12, fill: "#717179" },
        },
        {
          type: "text",
          left: "center",
          top: "50%",
          silent: true,
          style: {
            text: centerText,
            fontSize: 22,
            fontWeight: 700,
            fill: "#227DEF",
            fontFamily: "'DIN-Medium', sans-serif",
          },
        },
      ],
      series: [
        {
          data: data.map((d, i) => ({
            name: d.name,
            value: d.value,
            itemStyle: {
              color: colors[i % colors.length],
              opacity: hoveredName && hoveredName !== d.name ? 0.4 : 1,
            },
          })),
        },
      ],
    });
  }, [data, hoveredName]);

  return (
    <div
      className="flex-shrink-0 rounded-[10px] bg-[#f4f8fd] p-2"
      style={{ width: 300, height: 300 }}
      onMouseLeave={() => onPieLeaveRef.current?.()}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center text-[12px] text-[#9aa5a8]">
          加载中...
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// 子组件 9c：KeywordDetailModal（词条详情弹窗）
// ============================================================

type KeywordDetailModalProps = {
  open: boolean;
  onClose: () => void;
  data: UserV1BrandQuestionStat[];
  loading?: boolean;
};

function KeywordDetailModal({
  open,
  onClose,
  data,
  loading,
}: KeywordDetailModalProps) {
  if (!open) return null;
  const sorted = [...data].sort(
    (a, b) => Number(b.totalCount ?? 0) - Number(a.totalCount ?? 0),
  );
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-[16px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e4efff] bg-gradient-to-r from-[#227DEF] to-[#007CFF] px-6 py-4">
          <h3 className="text-[16px] font-semibold text-white">词条</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-[13px] text-[#9aa5a8]">
              加载中...
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-[#9aa5a8]">
              暂无词条数据
            </div>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[#e4efff] bg-[#f4f8fd]">
                  <th className="px-6 py-3 text-left text-[12px] font-semibold text-[#717179]">
                    问题词条
                  </th>
                  <th className="px-6 py-3 text-right text-[12px] font-semibold text-[#717179]">
                    收录次数
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item, idx) => (
                  <tr
                    key={`${item.question}-${idx}`}
                    className="border-b border-[#f4f6f9] last:border-0 hover:bg-[#f8fafd]"
                  >
                    <td className="px-6 py-3 text-[13px] text-[#3a3a40]">
                      {item.question ?? "-"}
                    </td>
                    <td className="px-6 py-3 text-right text-[13px] font-semibold text-[#227DEF]">
                      {formatNumber(item.totalCount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 子组件 10：SourceAnalysisPanel（信源分析）
// ============================================================

type SourceAnalysisPanelProps = {
  data: UserV1BrandSourceAnalysis | null;
  loading: boolean;
  range: RangeOption;
  onRangeChange: (r: RangeOption) => void;
};

function SourceAnalysisPanel({ data, loading, range, onRangeChange }: SourceAnalysisPanelProps) {
  const articleCount = formatNumber(data?.articlePublishCount);
  const citationCount = formatNumber(data?.articleCitationCount);
  const sourceCount = formatNumber(data?.sourceReferenceCount);
  const media = data?.mediaBreakdown;

  const topArticles = data?.topArticles ?? [];
  const topSources = data?.topSourcePlatforms ?? [];
  const publishTrend = data?.publishTrend ?? [];

  // 文章发布趋势 ECharts
  const trendRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!trendRef.current || publishTrend.length === 0) return;
    const chart = echarts.init(trendRef.current);
    chart.setOption({
      tooltip: { trigger: "axis" },
      grid: { left: 40, right: 20, top: 20, bottom: 30 },
      xAxis: {
        type: "category",
        data: publishTrend.map((p) => p.date ?? ""),
        axisLabel: { fontSize: 10, color: "#8a8a8a" },
        axisLine: { lineStyle: { color: "#e0e0e0" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 10, color: "#8a8a8a" },
        splitLine: { lineStyle: { color: "#f0f0f0" } },
      },
      series: [{
        type: "bar",
        data: publishTrend.map((p) => Number(p.count ?? 0)),
        itemStyle: { color: BRAND_BLUE, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 24,
      }],
    });
    const handle = () => chart.resize();
    window.addEventListener("resize", handle);
    return () => { window.removeEventListener("resize", handle); chart.dispose(); };
  }, [publishTrend]);

  // Top10 信源平台分布 ECharts（横向柱状图）
  const sourceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sourceRef.current || topSources.length === 0) return;
    const chart = echarts.init(sourceRef.current);
    chart.setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 100, right: 30, top: 10, bottom: 20 },
      xAxis: {
        type: "value",
        axisLabel: { fontSize: 10, color: "#8a8a8a" },
        splitLine: { lineStyle: { color: "#f0f0f0" } },
      },
      yAxis: {
        type: "category",
        data: topSources.map((s) => (s.title ? s.title : s.domain ?? "")).reverse(),
        axisLabel: { fontSize: 10, color: "#5f5f66" },
        axisLine: { lineStyle: { color: "#e0e0e0" } },
      },
      series: [{
        type: "bar",
        data: topSources.map((s) => Number(s.citationCount ?? 0)).reverse(),
        itemStyle: { color: "#22C55E", borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 20,
        label: { show: true, position: "right", fontSize: 10, color: "#5f5f66" },
      }],
    });
    const handle = () => chart.resize();
    window.addEventListener("resize", handle);
    return () => { window.removeEventListener("resize", handle); chart.dispose(); };
  }, [topSources]);

  const rangeBtnClass = (active: boolean) =>
    `rounded-full px-2.5 py-0.5 text-[10px] font-medium transition ${
      active ? "text-white" : "text-[#5f5f66] hover:text-[#1d1d1f]"
    }`;

  const cardClass = "border border-white/70 bg-white/45";
  const cardStyle = { borderRadius: 12 };

  return (
    <div className="space-y-5">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1d1d1f]">信源分析</h3>
          <p className="mt-0.5 text-[11px] text-[#8a8a8a]">分析平台引用的内容与来源，为优化提供创意</p>
        </div>
      </div>

      {/* 顶部 3 指标卡 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "文章发布量", value: articleCount, color: BRAND_BLUE },
          { label: "文章引用量", value: citationCount, color: "#F59E0B" },
          { label: "引用信源量", value: sourceCount, color: "#22C55E" },
        ].map((item) => (
          <div
            key={item.label}
            className={cardClass}
            style={{ ...cardStyle, boxShadow: `0 0 20px ${item.color}10` }}
          >
            <div className="px-5 py-4">
              <p className="text-[11px] text-[#8a8a8a]">{item.label}</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: item.color }}>
                {loading ? "—" : item.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 第一行：媒体文章分布（左）+ Top10 文章引用（右） */}
      <div className="grid gap-5 xl:grid-cols-[2fr_3fr]">
        {/* 媒体文章分布 */}
        <div className={`${cardClass} flex flex-col`} style={cardStyle}>
          <div className="flex items-center justify-between border-b border-[#f0f0f0] px-5 py-3">
            <div className="flex items-center gap-2">
              <Icon name="article" className="h-4 w-4 text-[#8a8a8a]" />
              <span className="text-sm font-semibold text-[#1d1d1f]">发布媒体</span>
            </div>
            <span className="text-[11px] text-[#8a8a8a]">
              总发布 {formatNumber(media?.total)}
            </span>
          </div>
          <div className="flex flex-col gap-3 px-5 py-4 flex-1 min-h-[380px]">
            {[
              {
                label: "自媒体",
                value: media?.selfMediaCount ?? 0,
                color: BRAND_BLUE,
                barColor: BRAND_BLUE,
                borderColor: "border-l-[#227DEF]",
              },
              {
                label: "官方媒体",
                value: media?.commercialMediaCount ?? 0,
                color: "#22C55E",
                barColor: "#22C55E",
                borderColor: "border-l-[#22C55E]",
              },
              {
                label: "KOL",
                value: media?.officialKbCount ?? 0,
                color: "#F59E0B",
                barColor: "#F59E0B",
                borderColor: "border-l-[#F59E0B]",
              },
            ].map((item) => {
              const total = Number(media?.total ?? 0);
              const pct = total > 0 ? (Number(item.value) / total) * 100 : 0;
              return (
                <div key={item.label} className={`flex-1 flex flex-col justify-center rounded-lg border border-[#eef0f2] border-l-3 ${item.borderColor} bg-white px-5`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: item.color }}
                      />
                      <span className="text-sm font-medium text-[#3d3d3d]">
                        {item.label}
                      </span>
                    </div>
                    <span
                      className="text-xl font-bold tabular-nums"
                      style={{ color: item.color }}
                    >
                      {loading ? "—" : formatNumber(item.value)}
                    </span>
                  </div>
                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#f0f0f0]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: item.barColor,
                        minWidth: pct > 0 ? 4 : 0,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top10 文章引用 */}
        <div className={cardClass} style={cardStyle}>
          <div className="flex items-center justify-between border-b border-[#f0f0f0] px-5 py-3">
            <div className="flex items-center gap-2">
              <Icon name="article" className="h-4 w-4 text-[#8a8a8a]" />
              <span className="text-sm font-semibold text-[#1d1d1f]">Top10 文章引用</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8a8a8a]">近一周</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md bg-[#f0f6ff] px-2.5 py-1 text-[11px] font-medium text-[#227DEF] hover:bg-[#e0efff] transition-colors"
                onClick={() => {
                  if (topArticles.length === 0) return;
                  const header = ["排名", "文章标题", "引用次数"];
                  const rows = topArticles.map((a) => [
                    a.rank ?? "",
                    a.title ?? "",
                    a.citationCount ?? "",
                  ]);
                  const csv = [header, ...rows]
                    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
                    .join("\n");
                  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `top10-article-citations-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Icon name="download" className="h-3 w-3" />
                导出
              </button>
            </div>
          </div>
          <div>
            <table className="w-full text-[12px]">
              <thead className="bg-[#fafbfc]">
                <tr className="border-b border-[#f0f0f0] text-[#8a8a8a]">
                  <th className="px-3 py-2.5 text-center font-medium w-16">排行</th>
                  <th className="px-3 py-2.5 text-center font-medium">文章标题</th>
                  <th className="px-3 py-2.5 text-center font-medium w-20">引用次数</th>
                  <th className="px-3 py-2.5 text-center font-medium w-16">操作</th>
                </tr>
              </thead>
              <tbody>
                {topArticles.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#8a8a8a]">暂无文章引用数据</td>
                  </tr>
                ) : (
                  topArticles.map((article) => {
                    const rank = article.rank ?? 0;
                    const isTop3 = rank <= 3 && rank > 0;
                    const medalColors = ["#F5C542", "#C0C0C0", "#CD7F32"];
                    const medalEmojis = ["🥇", "🥈", "🥉"];
                    return (
                      <tr
                        key={article.articleId}
                        className="border-b border-[#f5f5f5] hover:bg-[#f8faff] transition-colors"
                      >
                        <td className="px-3 py-2.5 text-center">
                          {isTop3 ? (
                            <span
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                              style={{ background: medalColors[rank - 1] }}
                            >
                              {medalEmojis[rank - 1]}
                            </span>
                          ) : (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#f0f0f0] text-[11px] font-semibold text-[#5f5f66]">
                              {rank}
                            </span>
                          )}
                        </td>
                        <td
                          className="px-3 py-2.5 text-center text-[#3d3d3d] truncate max-w-[320px]"
                          title={article.title}
                        >
                          {article.title}
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-[#1d1d1f] tabular-nums">
                          {formatNumber(article.citationCount)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {article.url ? (
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-[12px] font-medium text-[#227DEF] hover:underline hover:text-[#1a5fbf] transition-colors"
                            >
                              跳转
                            </a>
                          ) : (
                            <span className="text-[12px] text-[#bbb]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 第二行：文章发布趋势（左）+ Top10 信源平台分布（右） */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* 文章发布趋势 */}
        <div className={cardClass} style={cardStyle}>
          <div className="flex items-center justify-between border-b border-[#f0f0f0] px-5 py-3">
            <span className="text-sm font-semibold text-[#1d1d1f]">文章发布</span>
            <div className="glass-control inline-flex items-center gap-0.5 rounded-full p-0.5">
              {rangeTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onRangeChange(tab.key)}
                  className={rangeBtnClass(range === tab.key)}
                  style={range === tab.key ? { background: BUTTON_BLUE } : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div ref={trendRef} style={{ width: "100%", height: 280 }} />
        </div>

        {/* Top10 信源平台分布 */}
        <div className={cardClass} style={cardStyle}>
          <div className="flex items-center justify-between border-b border-[#f0f0f0] px-5 py-3">
            <span className="text-sm font-semibold text-[#1d1d1f]">Top10 信源平台分布</span>
            <span className="text-[11px] text-[#8a8a8a]">近一周</span>
          </div>
          <div ref={sourceRef} style={{ width: "100%", height: 280 }} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 子组件 11：ReportPanel（周报/月报）
// ============================================================

type ReportPanelProps = {
  data: UserV1BrandSummary | null;
  loading: boolean;
  indexTopLoading: boolean;
  period: ReportPeriod;
  platformIcons: Map<string, string>;
  companyInfo: UserV1BrandCompanyInfo | null;
  dashboard: UserV1BrandDashboard | null;
  indexTop: UserV1BrandIndexTop | null;
  indexMain: UserV1BrandIndexMain | null;
  reportDate: string;
  onReportDateChange: (date: string) => void;
  questionTotalCount: number;
};

function ReportPanel({
  data,
  loading,
  indexTopLoading,
  period,
  platformIcons,
  companyInfo,
  dashboard,
  indexTop,
  indexMain,
  reportDate,
  onReportDateChange,
  questionTotalCount,
}: ReportPanelProps) {
  const isWeek = period === "week";
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerViewDate, setPickerViewDate] = useState<Date>(() =>
    reportDate ? new Date(reportDate) : new Date(),
  );

  // 当外部日期变化时同步内部视图
  useEffect(() => {
    if (reportDate) {
      setPickerViewDate(new Date(reportDate));
    }
  }, [reportDate]);

  const periodLabel = isWeek ? "周报" : "月报";
  const periodTitle =
    companyInfo?.brandName || companyInfo?.enterpriseName || "品牌";

  // 周期标识（显示用）
  const periodBadge = useMemo(() => {
    if (!data?.periodStart) return "";
    const d = new Date(data.periodStart);
    if (Number.isNaN(d.getTime())) return "";
    if (isWeek) {
      const start = new Date(d.getFullYear(), 0, 1);
      const days = Math.floor((d.getTime() - start.getTime()) / 86400000);
      const week = Math.ceil((days + start.getDay() + 1) / 7);
      return `${d.getFullYear()}年第${week}周`;
    } else {
      return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, "0")}月`;
    }
  }, [data?.periodStart, isWeek]);

  // 获取当前选中的日期（来自 reportDate 或 periodStart 或今天）
  const currentSelDate = useMemo(() => {
    if (reportDate) return new Date(reportDate);
    if (data?.periodStart) return new Date(data.periodStart);
    return new Date();
  }, [reportDate, data?.periodStart]);

  // 周报表：显示该周的日期范围
  const weekRangeText = useMemo(() => {
    const mon = getMonday(currentSelDate);
    const sun = getSunday(currentSelDate);
    return `${mon.getMonth() + 1}月${mon.getDate()}日 - ${sun.getMonth() + 1}月${sun.getDate()}日`;
  }, [currentSelDate]);

  // 环比显示：delta=-1 表示上期无数据，显示"-"
  const deltaArrow = (delta?: number | string) => {
    if (delta === undefined || delta === null || delta === "") return null;
    const n = typeof delta === "string" ? Number(delta) : delta;
    if (!Number.isFinite(n) || n === -1 || n === 0) return null;
    return n > 0 ? "↑" : "↓";
  };

  const deltaColor = (delta?: number | string) => {
    if (delta === undefined || delta === null || delta === "")
      return "text-[#9a9aa0]";
    const n = typeof delta === "string" ? Number(delta) : delta;
    if (!Number.isFinite(n) || n === -1 || n === 0) return "text-[#9a9aa0]";
    return n > 0 ? "text-[#1f9d63]" : "text-[#d65a50]";
  };

  // 环比值：-1 表示上期无数据，显示"-"
  const deltaText = (delta?: number | string, unit = "%") => {
    if (delta === undefined || delta === null || delta === "") return "-";
    const n = typeof delta === "string" ? Number(delta) : delta;
    if (!Number.isFinite(n) || n === -1) return "-";
    return `${Math.abs(Math.round(n))}${unit}`;
  };

  // 截图下载
  const handleDownload = async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(reportRef.current, {
        backgroundColor: "#f4f8fd",
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `${companyInfo?.enterpriseName || "品牌"}-${periodLabel}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("导出截图失败", e);
      alert("导出截图失败，请重试");
    } finally {
      setExporting(false);
    }
  };

  // 核心指标（使用 summary 数据或 dashboard 数据）
  const metrics = useMemo(() => {
    return {
      visibilityRate: data?.visibilityRate ?? dashboard?.visibilityRate ?? 0,
      visibilityDelta: data?.visibilityDelta ?? 0,
      top3Rate: data?.top3Rate ?? dashboard?.top3Rate ?? 0,
      top3RateDelta: data?.top3RateDelta ?? -1,
      positiveRate: dashboard?.positiveRate ?? 0,
      mentionCount: data?.mentionCount ?? dashboard?.mentionCount ?? "0",
      mentionDelta: data?.mentionDelta ?? "0",
      totalInclusion: data?.totalInclusion ?? dashboard?.dialogueRounds ?? "0",
      inclusionDelta: data?.inclusionDelta ?? "0",
    };
  }, [data, dashboard]);

  const questions = data?.questions ?? [];
  const platforms = indexTop?.platforms ?? [];

  // 优化数据统计
  // 累计优化天数 = 套餐服务开通时间(startsAt) 至今的天数
  // 优化剩余天数 = 服务到期时间(expiresAt) 距今天的天数（已过期则为 0）
  const optData = useMemo(() => {
    const now = new Date();
    const startMs = companyInfo?.startedAt
      ? new Date(companyInfo.startedAt).getTime()
      : 0;
    const endMs = companyInfo?.expiresAt
      ? new Date(companyInfo.expiresAt).getTime()
      : 0;
    const dayMs = 24 * 60 * 60 * 1000;
    const totalOptDays = startMs
      ? Math.max(0, Math.floor((now.getTime() - startMs) / dayMs))
      : 0;
    const remainingDays = endMs
      ? Math.max(0, Math.ceil((endMs - now.getTime()) / dayMs))
      : 0;
    return {
      totalOptDays,
      remainingDays,
      keywordCount: String(questionTotalCount),
      totalInclusion: data?.totalInclusion ?? "0",
      articleCount: companyInfo?.articleCount ?? "0",
      siteCount: dashboard?.dialogueRounds ?? "0",
    };
  }, [companyInfo, data, dashboard, questionTotalCount]);

  return (
    <div ref={reportRef} className="relative">
      {/* 浮动下载按钮 */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={exporting}
        className="fixed right-6 top-1/2 z-50 flex items-center gap-1.5 rounded-full bg-[#007CFF] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-[#007CFF]/30 transition hover:opacity-90 disabled:opacity-60"
      >
        <Icon name="download" className="h-4 w-4" />
        {exporting ? "导出中…" : `${periodLabel}下载`}
      </button>

      <section
        className="overflow-hidden rounded-[16px] bg-white"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
      >
        {/* 头部 */}
        <div
          className="px-6 py-6"
          style={{
            background: "linear-gradient(135deg, #f0f6ff 0%, #e8f1ff 100%)",
            borderBottom: "1px solid #e4efff",
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-[22px] font-bold tracking-[-.02em] text-[#1d1d1f]">
                  {periodTitle}
                </h2>
              </div>
              <div className="mt-2 flex items-center gap-4 text-[12px] text-[#5f5f66]">
                <span className="flex items-center gap-1.5">
                  <Icon
                    name="building"
                    className="h-3.5 w-3.5 text-[#227DEF]"
                  />
                  {companyInfo?.enterpriseName ?? "—"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="target" className="h-3.5 w-3.5 text-[#227DEF]" />
                  监测周期：
                  {data?.periodStart && data?.periodEnd
                    ? `${formatDate(data.periodStart)} 至 ${formatDate(data.periodEnd)}`
                    : isWeek
                      ? "最近7天"
                      : "最近30天"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onReportDateChange("");
                  setPickerOpen(false);
                }}
                className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition ${
                  isWeek
                    ? "bg-[#007CFF] text-white"
                    : "bg-white text-[#5f5f66] hover:bg-[#f4f8fd]"
                }`}
              >
                周报
              </button>
              <button
                type="button"
                onClick={() => {
                  onReportDateChange("");
                  setPickerOpen(false);
                }}
                className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition ${
                  !isWeek
                    ? "bg-[#007CFF] text-white"
                    : "bg-white text-[#5f5f66] hover:bg-[#f4f8fd]"
                }`}
              >
                月报
              </button>

              {/* 日期选择器触发按钮 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPickerOpen(!pickerOpen)}
                  className="flex items-center gap-1.5 rounded-full border border-[#e4efff] bg-white px-3 py-1.5 text-[12px] font-medium text-[#5f5f66] transition hover:border-[#007CFF] hover:text-[#007CFF]"
                >
                  <Icon name="calendar" className="h-3.5 w-3.5" />
                  <span>{periodBadge || (isWeek ? "本周" : "本月")}</span>
                  {reportDate && (
                    <span
                      className="ml-0.5 rounded-full bg-[#007CFF]/10 px-1.5 py-0.5 text-[10px] text-[#007CFF]"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReportDateChange("");
                      }}
                    >
                      重置
                    </span>
                  )}
                </button>

                {/* 日期选择器弹出面板 */}
                {pickerOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setPickerOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-50 mt-2 w-[320px] rounded-xl border border-[#e4efff] bg-white p-3 shadow-lg shadow-[#007CFF]/10">
                      {isWeek ? (
                        <WeekPicker
                          viewDate={pickerViewDate}
                          onViewDateChange={setPickerViewDate}
                          onSelect={(d) => {
                            onReportDateChange(formatDateInput(d));
                            setPickerOpen(false);
                          }}
                          selectedDate={currentSelDate}
                          getMonday={getMonday}
                          getWeekNumber={getWeekNumber}
                          weekRangeText={weekRangeText}
                        />
                      ) : (
                        <MonthPicker
                          viewYear={pickerViewDate.getFullYear()}
                          onViewYearChange={(y) =>
                            setPickerViewDate(
                              new Date(y, pickerViewDate.getMonth(), 1),
                            )
                          }
                          onSelect={(year, month) => {
                            onReportDateChange(
                              `${year}-${String(month + 1).padStart(2, "0")}-01`,
                            );
                            setPickerOpen(false);
                          }}
                          selectedYear={currentSelDate.getFullYear()}
                          selectedMonth={currentSelDate.getMonth()}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 数据大盘 */}
        <div className="px-6 py-5">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="board" className="h-4 w-4 text-[#227DEF]" />
            <h3 className="text-[15px] font-semibold text-[#25252a]">
              数据大盘
            </h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 品牌可见度 */}
            <div className="rounded-[12px] border border-[#e4efff] bg-white p-4 transition hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4efff]">
                  <Icon name="eye" className="h-5 w-5 text-[#227DEF]" />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-[#71848a]">
                    品牌可见度
                  </p>
                  <p
                    className="mt-1 text-[24px] font-bold tracking-[-.02em] text-[#227DEF]"
                    style={{ fontFamily: "'DIN-Medium','OPPOSans',sans-serif" }}
                  >
                    {loading ? "—" : formatPercent(metrics.visibilityRate)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px]">
                <span className="text-[#9aa5a8]">环比</span>
                <span
                  className={`font-semibold ${deltaColor(metrics.visibilityDelta)}`}
                >
                  {loading
                    ? "-"
                    : `${deltaArrow(metrics.visibilityDelta) ?? ""} ${deltaText(metrics.visibilityDelta)}`.trim()}
                </span>
              </div>
            </div>

            {/* 品牌TOP3 */}
            <div className="rounded-[12px] border border-[#e4efff] bg-white p-4 transition hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4efff]">
                  <Icon name="brand" className="h-5 w-5 text-[#227DEF]" />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-[#71848a]">
                    品牌TOP3
                  </p>
                  <p
                    className="mt-1 text-[24px] font-bold tracking-[-.02em] text-[#227DEF]"
                    style={{ fontFamily: "'DIN-Medium','OPPOSans',sans-serif" }}
                  >
                    {loading ? "—" : formatPercent(metrics.top3Rate)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px]">
                <span className="text-[#9aa5a8]">环比</span>
                <span
                  className={`font-semibold ${deltaColor(metrics.top3RateDelta)}`}
                >
                  {loading
                    ? "-"
                    : `${deltaArrow(metrics.top3RateDelta) ?? ""} ${deltaText(metrics.top3RateDelta, "%")}`.trim()}
                </span>
              </div>
            </div>

            {/* 提及次数 */}
            <div className="rounded-[12px] border border-[#e4efff] bg-white p-4 transition hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff3e6]">
                  <Icon name="monitor" className="h-5 w-5 text-[#F97316]" />
                </div>
                <div className="flex-1">
                  <p className="flex items-center text-[12px] font-medium text-[#71848a]">
                    提及次数
                    <InfoTip text="本周期内被 AI 平台提及品牌或企业名称的回答数（一条回答只计 1 次）。周报/月报为周期级口径，全企业级口径请看 GEO 大盘首页。" />
                  </p>
                  <p
                    className="mt-1 text-[24px] font-bold tracking-[-.02em] text-[#227DEF]"
                    style={{ fontFamily: "'DIN-Medium','OPPOSans',sans-serif" }}
                  >
                    {loading ? "—" : formatNumber(metrics.mentionCount)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px]">
                <span className="text-[#9aa5a8]">环比</span>
                <span
                  className={`font-semibold ${deltaColor(metrics.mentionDelta)}`}
                >
                  {loading
                    ? "-"
                    : `${deltaArrow(metrics.mentionDelta) ?? ""} ${deltaText(metrics.mentionDelta)}`.trim()}
                </span>
              </div>
            </div>

            {/* 收录总量 */}
            <div className="rounded-[12px] border border-[#e4efff] bg-white p-4 transition hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6f7ef]">
                  <Icon name="database" className="h-5 w-5 text-[#059669]" />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-[#71848a]">
                    收录总量
                  </p>
                  <p
                    className="mt-1 text-[24px] font-bold tracking-[-.02em] text-[#227DEF]"
                    style={{ fontFamily: "'DIN-Medium','OPPOSans',sans-serif" }}
                  >
                    {loading ? "—" : formatNumber(metrics.totalInclusion)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px]">
                <span className="text-[#9aa5a8]">环比</span>
                <span
                  className={`font-semibold ${deltaColor(metrics.inclusionDelta)}`}
                >
                  {loading
                    ? "-"
                    : `${deltaArrow(metrics.inclusionDelta) ?? ""} ${deltaText(metrics.inclusionDelta)}`.trim()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 平台明细 - 卡片网格布局，两行四列 */}
        <div className="border-t border-[#f0f0f0] px-6 py-5">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="grid" className="h-4 w-4 text-[#227DEF]" />
            <h3 className="text-[15px] font-semibold text-[#25252a]">平台明细</h3>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {indexTopLoading ? (
              <div className="col-span-4 py-8 text-center text-[12px] text-[#9aa5a8]">
                <Icon name="sparkles" className="mr-1 inline h-4 w-4 animate-pulse" />
                正在加载…
              </div>
            ) : platforms.length === 0 ? (
              <div className="col-span-4 py-8 text-center text-[12px] text-[#9aa5a8]">
                暂无平台数据
              </div>
            ) : (
              platforms.map((p, idx) => {
                  const pName = p.platform ?? "—";
                  const pColor = platformColor(pName);
                  const iconUrl = platformIcons.get(pName);
                  const sentLabel = sentimentLabel(p.sentiment);
                  const sentColor =
                    p.sentiment === "positive"
                      ? "text-[#1f9d63]"
                      : p.sentiment === "negative"
                        ? "text-[#d65a50]"
                        : "text-[#9a9aa0]";
                  const sentDotColor =
                    p.sentiment === "positive"
                      ? "#1f9d63"
                      : p.sentiment === "negative"
                        ? "#d65a50"
                        : "#9a9aa0";
                  return (
                    <div
                      key={`${pName}-${idx}`}
                      className="rounded-[12px] border border-[#e8edf2] bg-white p-4 transition hover:shadow-md"
                    >
                      {/* 平台图标 + 名称 */}
                      <div className="mb-3 flex items-center gap-2">
                        {iconUrl ? (
                          <img
                            src={iconUrl}
                            alt={pName}
                            className="rounded-full object-contain"
                            style={{ width: 22, height: 22 }}
                          />
                        ) : (
                          <span
                            className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ background: pColor }}
                          >
                            {pName.slice(0, 1)}
                          </span>
                        )}
                        <span className="truncate text-[13px] font-medium text-[#3a3a40]" title={pName}>
                          {pName}
                        </span>
                      </div>

                      {/* 三项指标 */}
                      <div className="space-y-2 text-[12px]">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[#717179]">
                            <span
                              className="inline-block rounded-full"
                              style={{ width: 5, height: 5, background: pColor }}
                            />
                            品牌可见度
                          </span>
                          <span className="font-semibold" style={{ color: pColor }}>
                            {formatPercent(p.visibilityRate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[#717179]">
                            <span
                              className="inline-block rounded-full"
                              style={{ width: 5, height: 5, background: pColor }}
                            />
                            品牌提及次数
                          </span>
                          <span className="font-semibold text-[#3a3a40]">
                            {formatNumber(p.inclusionCount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[#717179]">
                            <span
                              className="inline-block rounded-full"
                              style={{ width: 5, height: 5, background: sentDotColor }}
                            />
                            品牌情感倾向
                          </span>
                          <span className={`font-semibold ${sentColor}`}>
                            {sentLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        {/* 趋势图 */}
        <div className="border-t border-[#f0f0f0] px-6 py-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportTrendChart
              title="总收录趋势"
              data={indexMain?.inclusionTrend}
              valueKey="value"
              loading={loading}
            />
            <ReportTrendChart
              title="品牌可见度"
              data={indexMain?.visibilityTrend}
              valueKey="rate"
              unit="%"
              loading={loading}
            />
          </div>
        </div>

        {/* 优化数据 */}
        <div className="border-t border-[#f0f0f0] px-6 py-5">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="sparkles" className="h-4 w-4 text-[#227DEF]" />
            <h3 className="text-[15px] font-semibold text-[#25252a]">
              优化数据
            </h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* 收录数据 */}
            <div className="rounded-[12px] border border-[#e4efff] bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-[#e4efff] px-2 py-0.5 text-[11px] font-semibold text-[#227DEF]">
                  收录数据
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-[11px] text-[#71848a]">累计优化天数</p>
                  <p
                    className="mt-1 text-[22px] font-bold text-[#227DEF]"
                    style={{ fontFamily: "'DIN-Medium','OPPOSans',sans-serif" }}
                  >
                    {loading ? "—" : optData.totalOptDays}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-[#71848a]">优化剩余天数</p>
                  <p
                    className="mt-1 text-[22px] font-bold text-[#227DEF]"
                    style={{ fontFamily: "'DIN-Medium','OPPOSans',sans-serif" }}
                  >
                    {loading ? "—" : optData.remainingDays}
                  </p>
                </div>
              </div>
            </div>

            {/* 收录及发布情况 */}
            <div className="rounded-[12px] border border-[#e4efff] bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-[#e6f7ef] px-2 py-0.5 text-[11px] font-semibold text-[#059669]">
                  收录及发布情况
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-[11px] text-[#71848a]">词条量</p>
                  <p
                    className="mt-1 text-[22px] font-bold text-[#227DEF]"
                    style={{ fontFamily: "'DIN-Medium','OPPOSans',sans-serif" }}
                  >
                    {loading ? "—" : formatNumber(optData.keywordCount)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-[#71848a]">收录总量</p>
                  <p
                    className="mt-1 text-[22px] font-bold text-[#227DEF]"
                    style={{ fontFamily: "'DIN-Medium','OPPOSans',sans-serif" }}
                  >
                    {loading ? "—" : formatNumber(optData.totalInclusion)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-[#71848a]">文章发布总量</p>
                  <p
                    className="mt-1 text-[22px] font-bold text-[#227DEF]"
                    style={{ fontFamily: "'DIN-Medium','OPPOSans',sans-serif" }}
                  >
                    {loading ? "—" : formatNumber(optData.articleCount)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 收录详情 */}
        {questions.length > 0 ? (
          <div className="border-t border-[#f0f0f0] px-6 py-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="receipt" className="h-4 w-4 text-[#227DEF]" />
                <h3 className="text-[15px] font-semibold text-[#25252a]">
                  收录详情
                </h3>
              </div>
              <p className="text-[10px] text-[#9aa5a8]">
                申明：AI大模型搜索结果千人千面，报表检测结果以系统检测结果为准，若有波动属于合理范围，可以尝试多个设备进行检索！
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#007CFF] bg-[#f0f6ff]">
                    <th className="py-3 px-4 text-center text-[12px] font-semibold text-[#1d1d1f]">
                      问题词条
                    </th>
                    <th className="py-3 px-4 text-center text-[12px] font-semibold text-[#1d1d1f]">
                      总收录次数
                    </th>
                    <th className="py-3 px-4 text-center text-[12px] font-semibold text-[#1d1d1f]">
                      {isWeek ? "周收录次数" : "月收录次数"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-8 text-center text-[12px] text-[#9aa5a8]"
                      >
                        <Icon
                          name="sparkles"
                          className="mr-1 inline h-4 w-4 animate-pulse"
                        />
                        正在加载…
                      </td>
                    </tr>
                  ) : (
                    questions.map((q, idx) => (
                      <tr
                        key={`${q.question}-${idx}`}
                        className="border-b border-[#f5f5f5] hover:bg-[#f8fafd]"
                      >
                        <td className="py-3 px-4 text-[13px] text-[#3a3a40]">
                          {q.question || "—"}
                        </td>
                        <td className="py-3 px-4 text-center text-[13px] font-semibold text-[#3a3a40]">
                          {formatNumber(q.totalCount)}
                        </td>
                        <td className="py-3 px-4 text-center text-[13px] font-semibold text-[#227DEF]">
                          {formatNumber(q.periodCount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* 底部说明 */}
        <div className="border-t border-[#f0f0f0] px-6 py-4 text-[10px] text-[#9aa5a8]">
          数据统计范围：
          {data?.periodStart && data?.periodEnd
            ? `${formatDate(data.periodStart)} 至 ${formatDate(data.periodEnd)}`
            : isWeek
              ? "最近7天"
              : "最近30天"}
          。品牌可见度 = 品牌被提及数 / 总回答数 × 100%
        </div>
      </section>
    </div>
  );
}

// ============================================================
// 子组件 10b：ReportTrendChart（报表专用折线图）
// ============================================================

type ReportTrendChartProps = {
  data: Array<UserV1BrandTrendPoint> | undefined;
  valueKey: "value" | "rate";
  unit?: string;
  loading: boolean;
  title?: string;
};

function ReportTrendChart({
  data,
  valueKey,
  unit,
  loading,
  title,
}: ReportTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    chartRef.current = echarts.init(containerRef.current);
    const handleResize = () => chartRef.current?.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    const points = (data ?? []).map((p) => ({
      date: p.date ?? "",
      v: valueKey === "rate" ? Number(p.rate ?? 0) : Number(p.value ?? 0),
    }));

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: "axis",
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e4efff",
        borderRadius: 8,
        padding: 10,
        textStyle: { color: "#3a3a40", fontSize: 12 },
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params];
          const p = list[0];
          if (!p) return "";
          const date = String(p.name ?? "");
          const mmdd =
            date.length >= 10 ? date.slice(5).replace("-", ".") : date;
          const val =
            typeof p.value === "number" ? p.value : Number(p.value) || 0;
          return `${mmdd}<br/>数据: <b>${val}${unit ?? ""}</b>`;
        },
      },
      grid: { left: 40, right: 20, top: 20, bottom: 30 },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: points.map((p) => p.date),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#e6eef5" } },
        axisLabel: { color: "#9aa5a8", fontSize: 10 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#e6eef5", type: "dashed" } },
        axisLabel: { color: "#9aa5a8", fontSize: 10 },
      },
      series: [
        {
          type: "line",
          data: points.map((p) => p.v),
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { color: "#227DEF", width: 2.5 },
          itemStyle: { color: "#227DEF", borderColor: "#fff", borderWidth: 2 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(34,125,239,0.25)" },
                { offset: 1, color: "rgba(34,125,239,0.02)" },
              ],
            },
          },
        },
      ],
    };
    chartRef.current.setOption(option, true);
  }, [data, valueKey, unit]);

  return (
    <div className="rounded-[12px] border border-[#e4efff] bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#3a3a40]">
          {title ?? (valueKey === "value" ? "总收录趋势" : "品牌可见度")}
        </span>
      </div>
      <div ref={containerRef} style={{ width: "100%", height: 200 }} />
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-[#9aa5a8]">
          <Icon name="sparkles" className="mr-1 inline h-4 w-4 animate-pulse" />
          正在加载…
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// 子组件 11：WeekPicker（周报日期选择器 - 周视图）
// ============================================================

type WeekPickerProps = {
  viewDate: Date;
  onViewDateChange: (d: Date) => void;
  onSelect: (d: Date) => void;
  selectedDate: Date;
  getMonday: (d: Date) => Date;
  getWeekNumber: (d: Date) => number;
  weekRangeText: string;
};

function WeekPicker({
  viewDate,
  onViewDateChange,
  onSelect,
  selectedDate,
  getMonday,
  getWeekNumber,
  weekRangeText,
}: WeekPickerProps) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // 计算当月的日历网格
  const firstDay = new Date(year, month, 1);
  const startDay = (firstDay.getDay() + 6) % 7; // 周一为0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selMonday = getMonday(selectedDate);
  const selSunday = new Date(selMonday);
  selSunday.setDate(selSunday.getDate() + 6);

  const handlePrevMonth = () => {
    onViewDateChange(new Date(year, month - 1, 1));
  };
  const handleNextMonth = () => {
    onViewDateChange(new Date(year, month + 1, 1));
  };

  return (
    <div>
      {/* 标题栏 */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#717179] transition hover:bg-[#f4f8fd] hover:text-[#007CFF]"
        >
          <Icon name="chevron-left" className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-[#25252a]">
          {year}年{month + 1}月
        </span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#717179] transition hover:bg-[#f4f8fd] hover:text-[#007CFF]"
        >
          <Icon name="chevron-right" className="h-4 w-4" />
        </button>
      </div>

      {/* 星期表头 */}
      <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[11px] text-[#9aa5a8]">
        {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const cellDate = new Date(year, month, day);
          const cellMonday = getMonday(cellDate);
          const cellSunday = new Date(cellMonday);
          cellSunday.setDate(cellSunday.getDate() + 6);

          const isToday = cellDate.getTime() === today.getTime();
          const isSelectedWeek = cellMonday.getTime() === selMonday.getTime();
          const isWeekStart = cellDate.getTime() === cellMonday.getTime();
          const inSelectedWeek =
            cellDate >= cellMonday && cellDate <= cellSunday;

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(cellDate)}
              className={`
                relative flex h-8 items-center justify-center rounded-md text-xs transition
                ${
                  isSelectedWeek && inSelectedWeek
                    ? "bg-[#007CFF]/10 text-[#007CFF] font-medium"
                    : isToday
                      ? "bg-[#007CFF]/5 text-[#007CFF]"
                      : "text-[#3a3a40] hover:bg-[#f4f8fd]"
                }
                ${isWeekStart ? "font-semibold" : ""}
              `}
            >
              {day}
              {isSelectedWeek && isWeekStart && (
                <span className="absolute -bottom-0.5 text-[8px] text-[#007CFF]">
                  W{getWeekNumber(cellDate)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 当前选中周的范围 */}
      <div className="mt-3 rounded-lg bg-[#f4f8fd] px-3 py-2 text-center text-[11px] text-[#5f5f66]">
        选中：{getWeekNumber(selectedDate)}周 · {weekRangeText}
      </div>
    </div>
  );
}

// ============================================================
// 子组件 12：MonthPicker（月报日期选择器 - 年/月视图）
// ============================================================

type MonthPickerProps = {
  viewYear: number;
  onViewYearChange: (y: number) => void;
  onSelect: (year: number, month: number) => void;
  selectedYear: number;
  selectedMonth: number;
};

function MonthPicker({
  viewYear,
  onViewYearChange,
  onSelect,
  selectedYear,
  selectedMonth,
}: MonthPickerProps) {
  const months = [
    "一月",
    "二月",
    "三月",
    "四月",
    "五月",
    "六月",
    "七月",
    "八月",
    "九月",
    "十月",
    "十一月",
    "十二月",
  ];

  const handlePrevYear = () => onViewYearChange(viewYear - 1);
  const handleNextYear = () => onViewYearChange(viewYear + 1);

  return (
    <div>
      {/* 年份切换 */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevYear}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#717179] transition hover:bg-[#f4f8fd] hover:text-[#007CFF]"
        >
          <Icon name="chevron-left" className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-[#25252a]">
          {viewYear}年
        </span>
        <button
          type="button"
          onClick={handleNextYear}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#717179] transition hover:bg-[#f4f8fd] hover:text-[#007CFF]"
        >
          <Icon name="chevron-right" className="h-4 w-4" />
        </button>
      </div>

      {/* 月份网格 */}
      <div className="grid grid-cols-3 gap-2">
        {months.map((m, i) => {
          const isSelected = viewYear === selectedYear && i === selectedMonth;
          const isCurrentYear = viewYear === new Date().getFullYear();
          const isCurrentMonth = isCurrentYear && i === new Date().getMonth();

          return (
            <button
              key={m}
              type="button"
              onClick={() => onSelect(viewYear, i)}
              className={`
                rounded-lg px-3 py-3 text-xs font-medium transition
                ${
                  isSelected
                    ? "bg-[#007CFF] text-white shadow-sm"
                    : isCurrentMonth
                      ? "bg-[#007CFF]/5 text-[#007CFF] hover:bg-[#007CFF]/10"
                      : "text-[#5f5f66] hover:bg-[#f4f8fd] hover:text-[#007CFF]"
                }
              `}
            >
              {m}
            </button>
          );
        })}
      </div>

      {/* 提示 */}
      <div className="mt-3 rounded-lg bg-[#f4f8fd] px-3 py-2 text-center text-[11px] text-[#5f5f66]">
        选中：{selectedYear}年{selectedMonth + 1}月
      </div>
    </div>
  );
}

// ============================================================
// 子组件 13：CompetitorAnalysisPanel（竞品分析）
// 布局/排版/样式/交互对齐盘古 BrandBoard 竞品分析页
// ============================================================

type CompetitorAnalysisPanelProps = {
  dashboard: UserV1BrandDashboard | null;
  indexTop: UserV1BrandIndexTop | null;
  indexMain: UserV1BrandIndexMain | null;
  companyInfo: UserV1BrandCompanyInfo | null;
  platformIcons: Map<string, string>;
  loading: boolean;
  trendLoading: boolean;
  range: RangeOption;
  onRangeChange: (r: RangeOption) => void;
  rankingData: UserV1CompetitorRankingPage | null;
  rankingLoading: boolean;
  compareData: UserV1CompetitorComparePage | null;
  compareLoading: boolean;
  blankData: UserV1CompetitorBlankKeywordsPage | null;
  blankLoading: boolean;
  blankPage: number;
  onBlankPageChange: (page: number) => void;
};

function CompetitorAnalysisPanel({
  dashboard,
  indexTop,
  indexMain,
  companyInfo,
  platformIcons,
  loading,
  trendLoading,
  range,
  onRangeChange,
  rankingData,
  rankingLoading,
  compareData,
  compareLoading,
  blankData,
  blankLoading,
  blankPage,
  onBlankPageChange,
}: CompetitorAnalysisPanelProps) {
  const mentionRate = dashboard?.visibilityRate ?? 0;
  const mentionCount = Number(dashboard?.mentionCount ?? 0);
  const platforms: UserV1BrandRecommendation[] = useMemo(() => {
    if (indexTop?.platforms && indexTop.platforms.length > 0) {
      return [...indexTop.platforms];
    }
    return Array.from(platformIcons.keys()).map((name) => ({
      platform: name,
      recommendation: 0,
      inclusionCount: "0",
      visibilityRate: 0,
      mentionCount: "0",
    }));
  }, [indexTop, platformIcons]);

  const brandName = companyInfo?.brandName || companyInfo?.enterpriseName || "当前品牌";
  const mentionTrend = indexMain?.mentionTrend ?? [];

  // 提及率/提及次数 条形图（按平台）
  const rateBarRef = useRef<HTMLDivElement>(null);
  const countBarRef = useRef<HTMLDivElement>(null);
  const trendRef = useRef<HTMLDivElement>(null);

  // 规范化百分比：后端可能返回 0-1、0-100 或 0-10000，统一转为 0-100
  const normPct = (v?: number): number => {
    let n = v ?? 0;
    if (n > 100) n = n / 100;
    if (n <= 1.5 && n > 0) n = n * 100;
    return Math.min(100, Math.max(0, n));
  };

  // 前五名品牌（含本品牌，按 answerCount 降序）
  // brand + enterprise 合并为本品牌，用品牌名展示
  const top5Brands = useMemo(() => {
    const items = compareData?.items ?? [];
    if (items.length === 0) {
      return [{ name: brandName, isOwnBrand: true, visibilityRate: normPct(mentionRate), answerCount: String(mentionCount), adoptionRate: 0, top3Rate: 0 }];
    }
    // 合并所有 isOwnBrand 的项（百岁山+景田集团）
    // 注意：answerCount 是 COUNT(DISTINCT snapshot)，同一条回答里两个品牌名都出现了但只算 1 次
    // 所以不能简单相加，取最大值即可（两者覆盖的 snapshot 集合几乎完全重叠）
    const ownItems = items.filter((i) => i.isOwnBrand);
    const competitorItems = items.filter((i) => !i.isOwnBrand);
    const mergedOwn = ownItems.length > 0
      ? [{
          name: brandName,
          isOwnBrand: true,
          visibilityRate: ownItems[0]?.visibilityRate ?? 0,
          answerCount: String(Math.max(...ownItems.map((i) => Number(i.answerCount ?? 0)))),
          adoptionRate: ownItems[0]?.adoptionRate ?? 0,
          top3Rate: ownItems[0]?.top3Rate ?? 0,
        }]
      : [];
    const merged = [...mergedOwn, ...competitorItems];
    // 按 answerCount 降序取前 5
    const sorted = merged
      .slice()
      .sort((a, b) => Number(b.answerCount ?? 0) - Number(a.answerCount ?? 0))
      .slice(0, 5);
    return sorted;
  }, [compareData, brandName, mentionRate, mentionCount]);

  // 5 种不同颜色（本品牌蓝色，竞品用其他色）
  const chartPalette = ["#F97316", "#22C55E", "#EC4899", "#8B5CF6"];

  // 1. 提及率条形图（百分比 0-100%，纵坐标=品牌名）
  useEffect(() => {
    if (!rateBarRef.current) return;
    const chart = echarts.init(rateBarRef.current);
    const names = top5Brands.map((item) => item.name ?? "");
    const rates = top5Brands.map((item) => Number(normPct(item.visibilityRate).toFixed(1)));
    const colors = top5Brands.map((item, idx) =>
      item.isOwnBrand ? BRAND_BLUE : chartPalette[(idx - 1 + 4) % 4]
    );
    chart.setOption({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#fff",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        textStyle: { color: "#374151", fontSize: 12 },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `${p.name}<br/>品牌可见度: <b>${p.value}%</b>`;
        },
      },
      grid: { left: 100, right: 30, top: 10, bottom: 20 },
      xAxis: {
        type: "value",
        max: 100,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#9ca3af", fontSize: 11, formatter: "{value}%" },
        splitLine: { lineStyle: { color: "#f3f4f6", type: "dashed" } },
      },
      yAxis: {
        type: "category",
        data: names,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#374151",
          fontSize: 12,
          formatter: (val: string) => val.length > 8 ? val.slice(0, 7) + "…" : val,
        },
      },
      series: [{
        name: "品牌可见度",
        type: "bar",
        data: rates.map((v, idx) => ({
          value: v,
          itemStyle: { color: colors[idx], borderRadius: [0, 4, 4, 0] },
        })),
        barWidth: 16,
        label: {
          show: true,
          position: "right",
          formatter: "{c}%",
          fontSize: 11,
          color: "#6b7280",
        },
      }],
    });
    const handle = () => chart.resize();
    window.addEventListener("resize", handle);
    return () => { window.removeEventListener("resize", handle); chart.dispose(); };
  }, [top5Brands]);

  // 2. 提及次数条形图（整数，纵坐标=品牌名）
  useEffect(() => {
    if (!countBarRef.current) return;
    const chart = echarts.init(countBarRef.current);
    const names = top5Brands.map((item) => item.name ?? "");
    const counts = top5Brands.map((item) => Math.round(Number(item.answerCount ?? 0)));
    const colors = top5Brands.map((item, idx) =>
      item.isOwnBrand ? BRAND_BLUE : chartPalette[(idx - 1 + 4) % 4]
    );
    chart.setOption({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#fff",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        textStyle: { color: "#374151", fontSize: 12 },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `${p.name}<br/>提及次数: <b>${p.value}</b>`;
        },
      },
      grid: { left: 100, right: 30, top: 10, bottom: 20 },
      xAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#9ca3af", fontSize: 11, formatter: (val: number) => Math.round(val).toString() },
        splitLine: { lineStyle: { color: "#f3f4f6", type: "dashed" } },
      },
      yAxis: {
        type: "category",
        data: names,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#374151",
          fontSize: 12,
          formatter: (val: string) => val.length > 8 ? val.slice(0, 7) + "…" : val,
        },
      },
      series: [{
        name: "提及次数",
        type: "bar",
        data: counts.map((v, idx) => ({
          value: v,
          itemStyle: { color: colors[idx], borderRadius: [0, 4, 4, 0] },
        })),
        barWidth: 16,
        label: {
          show: true,
          position: "right",
          formatter: "{c}",
          fontSize: 11,
          color: "#6b7280",
        },
      }],
    });
    const handle = () => chart.resize();
    window.addEventListener("resize", handle);
    return () => { window.removeEventListener("resize", handle); chart.dispose(); };
  }, [top5Brands]);

  // 3. 提及趋势折线图 — 只统计前五名（含本品牌），不同颜色区分
  // 使用后端返回的 trendDates + trendData
  useEffect(() => {
    if (!trendRef.current) return;
    const chart = echarts.init(trendRef.current);

    // 优先使用后端返回的竞品趋势数据
    const trendDates = compareData?.trendDates ?? [];
    const trendData = compareData?.trendData ?? {};

    // 如果有后端趋势数据，用后端的
    if (trendDates.length > 0 && Object.keys(trendData).length > 0) {
      const seriesList: any[] = top5Brands.map((item, idx) => {
        const isOwn = item.isOwnBrand;
        const color = isOwn ? BRAND_BLUE : chartPalette[(idx - 1 + 4) % 4];
        const rawValues = trendData[item.name ?? ""]?.values ?? [];
        const data = rawValues.map((v) => Number(v));

        return {
          name: item.name,
          type: "line",
          data,
          smooth: false,
          symbol: isOwn ? "circle" : "diamond",
          symbolSize: isOwn ? 6 : 5,
          showSymbol: true,
          lineStyle: { color, width: isOwn ? 2.5 : 2, type: isOwn ? "solid" : "dashed" },
          itemStyle: { color, borderColor: "#fff", borderWidth: 2 },
          areaStyle: isOwn ? {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(34,125,239,0.25)" },
                { offset: 1, color: "rgba(34,125,239,0.01)" },
              ],
            },
          } : undefined,
        };
      });

      chart.setOption({
        tooltip: { trigger: "axis", backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 6, padding: [8, 12], textStyle: { color: "#374151", fontSize: 12 } },
        legend: { top: 0, right: 0, textStyle: { color: "#6b7280", fontSize: 11 }, itemWidth: 12, itemHeight: 4 },
        grid: { left: 40, right: 20, top: 30, bottom: 32 },
        xAxis: { type: "category", boundaryGap: false, data: trendDates, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: "#9ca3af", fontSize: 11, margin: 8, formatter: (val: string) => val.length >= 10 ? val.slice(5).replace("-", ".") : val } },
        yAxis: { type: "value", splitLine: { lineStyle: { color: "#f3f4f6", type: "dashed" } }, axisLabel: { color: "#9ca3af", fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
        series: seriesList,
      });
    } else {
      // 降级：使用本品牌 mentionTrend
      const points = mentionTrend.map((p) => ({ date: p.date ?? "", v: Number(p.value ?? 0) }));
      const seriesList: any[] = [{
        name: brandName,
        type: "line",
        data: points.map((p) => p.v),
        smooth: false,
        symbol: "circle",
        symbolSize: 6,
        showSymbol: true,
        lineStyle: { color: BRAND_BLUE, width: 2.5 },
        itemStyle: { color: BRAND_BLUE, borderColor: "#fff", borderWidth: 2 },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(34,125,239,0.25)" }, { offset: 1, color: "rgba(34,125,239,0.01)" }] } },
      }];
      chart.setOption({
        tooltip: { trigger: "axis", backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 6, padding: [8, 12], textStyle: { color: "#374151", fontSize: 12 } },
        legend: { top: 0, right: 0, textStyle: { color: "#6b7280", fontSize: 11 }, itemWidth: 12, itemHeight: 4 },
        grid: { left: 40, right: 20, top: 30, bottom: 32 },
        xAxis: { type: "category", boundaryGap: false, data: points.map((p) => p.date), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: "#9ca3af", fontSize: 11, margin: 8, formatter: (val: string) => val.length >= 10 ? val.slice(5).replace("-", ".") : val } },
        yAxis: { type: "value", splitLine: { lineStyle: { color: "#f3f4f6", type: "dashed" } }, axisLabel: { color: "#9ca3af", fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
        series: seriesList,
      });
    }
    const handle = () => chart.resize();
    window.addEventListener("resize", handle);
    return () => { window.removeEventListener("resize", handle); chart.dispose(); };
  }, [mentionTrend, top5Brands, brandName, compareData]);

  // 竞品对比表格数据（本品牌合并展示）
  const compareItems = useMemo(() => {
    const items = compareData?.items ?? [];
    if (items.length === 0) {
      return [{
        name: brandName,
        isOwnBrand: true,
        visibilityRate: normPct(mentionRate),
        adoptionRate: normPct(dashboard?.top3Rate),
        answerCount: String(mentionCount),
        top3Rate: normPct(dashboard?.top3Rate),
      }];
    }
    // 合并本品牌行（取最大值，不重复相加）
    const ownItems = items.filter((i) => i.isOwnBrand);
    const competitorItems = items.filter((i) => !i.isOwnBrand);
    const merged = ownItems.length > 0
      ? [{
          name: brandName,
          isOwnBrand: true,
          visibilityRate: normPct(ownItems[0]?.visibilityRate),
          adoptionRate: normPct(ownItems[0]?.adoptionRate),
          answerCount: String(Math.max(...ownItems.map((i) => Number(i.answerCount ?? 0)))),
          top3Rate: normPct(ownItems[0]?.top3Rate),
        }]
      : [];
    return [...merged, ...competitorItems.map((it) => ({
      ...it,
      visibilityRate: normPct(it.visibilityRate),
      adoptionRate: normPct(it.adoptionRate),
      top3Rate: normPct(it.top3Rate),
    }))];
  }, [compareData, brandName, mentionRate, mentionCount, dashboard]);

  const cardClass = "border border-white/70 bg-white/45 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]";
  const cardStyle = { borderRadius: 12 };

  return (
    <div className="space-y-5">
      {/* 页面标题 */}
      <div className="flex items-end justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1d1d1f]">竞品分析</h3>
          <p className="mt-0.5 text-[11px] text-[#8a8a8a]">
            竞品分析 目标品牌与竞品核心指标对比
          </p>
        </div>
      </div>

      {/* 顶部 3 指标卡：品牌提及率 + 品牌提及次数 + 品牌提及趋势 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 品牌提及率 - 条形图 */}
        <div className={cardClass} style={{ ...cardStyle, boxShadow: `0 0 20px ${BRAND_BLUE}10` }}>
          <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: `${BRAND_BLUE}15`, color: BRAND_BLUE }}>
                <Icon name="sparkles" className="h-3 w-3" />
              </span>
              <span className="text-[12px] font-semibold text-[#25252a]">品牌提及率</span>
            </div>
            <span className="text-[11px] text-[#8a8a8a]">全部数据</span>
          </div>
          <div className="px-2 py-1">
            <div ref={rateBarRef} style={{ width: "100%", height: 200 }} />
          </div>
        </div>

        {/* 品牌提及次数 - 条形图 */}
        <div className={cardClass} style={{ ...cardStyle, boxShadow: `0 0 20px #F59E0B10` }}>
          <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: "#F59E0B15", color: "#F59E0B" }}>
                <Icon name="sparkles" className="h-3 w-3" />
              </span>
              <span className="text-[12px] font-semibold text-[#25252a]">品牌提及次数</span>
              <InfoTip text="按品牌拆分：各品牌被 AI 平台提及的回答数，一条回答只计 1 次。同一条回答同时提及多个品牌时各品牌各计 1 次，因此各柱相加可能大于 GEO 大盘首页的“提及次数”。" />
            </div>
            <span className="text-[11px] text-[#8a8a8a]">全部数据</span>
          </div>
          <div className="px-2 py-1">
            <div ref={countBarRef} style={{ width: "100%", height: 200 }} />
          </div>
        </div>

        {/* 品牌提及趋势 - 折线图 */}
        <div className={cardClass} style={{ ...cardStyle, boxShadow: BRAND_BOX_SHADOW }}>
          <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: `${BRAND_BLUE}15`, color: BRAND_BLUE }}>
                <Icon name="sparkles" className="h-3 w-3" />
              </span>
              <span className="text-[12px] font-semibold text-[#25252a]">品牌提及趋势</span>
            </div>
            <span className="text-[11px] text-[#8a8a8a]">近七天</span>
          </div>
          <div className="px-2 py-1">
            <div ref={trendRef} style={{ width: "100%", height: 200 }} />
          </div>
        </div>
      </div>

      {/* 品牌排序：各 AI 平台前 5 名（横向卡片滚动） */}
      <div className={`${cardClass}`} style={{ ...cardStyle, boxShadow: BRAND_BOX_SHADOW }}>
        <div className="flex items-center justify-between border-b border-[#f0f0f0] px-5 py-3">
          <div className="flex items-center gap-2">
            <Icon name="sparkles" className="h-4 w-4" style={{ color: BRAND_BLUE }} />
            <h4 className="text-[14px] font-semibold text-[#25252a]">品牌排序</h4>
            <span className="text-[11px] text-[#8a8a8a]">各 AI 平台前 5 名品牌提及</span>
          </div>
        </div>
        <div className="overflow-x-auto px-5 py-4" style={{ scrollbarWidth: "thin" }}>
          {rankingLoading ? (
            <div className="w-full py-8 text-center text-[12px] text-[#9aa5a8]">
              <Icon name="sparkles" className="mr-1 inline h-4 w-4 animate-pulse" />
              正在加载…
            </div>
          ) : !rankingData?.platforms || rankingData.platforms.length === 0 ? (
            <div className="w-full py-8 text-center text-[12px] text-[#9aa5a8]">
              暂无品牌排序数据
            </div>
          ) : (
            <div className="flex gap-4">
              {rankingData.platforms.map((pf) => {
                const pfName = pf.platform ?? "";
                const pfColor = platformColor(pfName);
                const pfIconUrl = platformIcons.get(pfName);
                return (
                  <div
                    key={pfName}
                    className="group flex shrink-0 flex-col rounded-[10px] border border-[#f0f0f0] bg-white/80 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#227def]/30 hover:shadow-[0_6px_20px_rgba(34,125,239,0.08)]"
                    style={{ width: 200 }}
                  >
                    {/* 平台头部 */}
                    <div className="flex items-center gap-2 border-b border-[#f0f0f0] pb-2">
                      {pfIconUrl ? (
                        <img src={pfIconUrl} alt={pfName} className="h-5 w-5 rounded-full object-contain" />
                      ) : (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: pfColor }}>
                          {pfName.slice(0, 1)}
                        </span>
                      )}
                      <span className="text-[13px] font-semibold text-[#25252a]">{pfName}</span>
                    </div>
                    {/* 前 5 名列表 */}
                    <div className="mt-2 space-y-1.5">
                      {(pf.items ?? []).map((item, idx) => {
                        const itemColor = item.isOwnBrand ? BRAND_BLUE : "#6B7280";
                        return (
                          <div key={idx} className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: item.isOwnBrand ? BRAND_BLUE : "#9ca3af" }}>
                                {item.rank || idx + 1}
                              </span>
                              <span className="truncate font-medium" style={{ color: itemColor, maxWidth: 110 }} title={item.name ?? ""}>
                                {item.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#9aa5a8]">{item.mentionCount ?? 0}次</span>
                          </div>
                        );
                      })}
                      {(!pf.items || pf.items.length === 0) && (
                        <div className="py-2 text-center text-[11px] text-[#9aa5a8]">暂无数据</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 空白词条：表格 */}
      <div className={`${cardClass}`} style={{ ...cardStyle, boxShadow: BRAND_BOX_SHADOW }}>
        <div className="flex items-center justify-between border-b border-[#f0f0f0] px-5 py-3">
          <div className="flex items-center gap-2">
            <Icon name="sparkles" className="h-4 w-4" style={{ color: BRAND_BLUE }} />
            <h4 className="text-[14px] font-semibold text-[#25252a]">空白词条</h4>
            <span className="text-[11px] text-[#8a8a8a]">
              分析词条仅竞品出现，当前品牌未出现，填补问题空白缺口
            </span>
          </div>
          {blankData?.totalSize ? (
            <span className="text-[11px] text-[#9aa5a8]">共 {blankData.totalSize} 条</span>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#f0f0f0] text-[11px] text-[#8a8a8a]">
                <th className="px-5 py-3 font-medium">关键词</th>
                <th className="px-5 py-3 font-medium">问题</th>
                <th className="px-5 py-3 font-medium">竞品词</th>
                <th className="px-5 py-3 font-medium">AI平台</th>
                <th className="px-5 py-3 font-medium">AI问答时间</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {blankLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[12px] text-[#9aa5a8]">
                    <Icon name="sparkles" className="mr-1 inline h-4 w-4 animate-pulse" />
                    正在加载…
                  </td>
                </tr>
              ) : !blankData?.items || blankData.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[12px] text-[#9aa5a8]">
                    暂无空白词条数据
                  </td>
                </tr>
              ) : (
                blankData.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]">
                    <td className="px-5 py-3 text-[#3a3a40]">{item.keyword || "—"}</td>
                    <td className="px-5 py-3 max-w-[240px] truncate text-[#3a3a40]" title={item.question ?? ""}>{item.question || "—"}</td>
                    <td className="px-5 py-3 font-medium" style={{ color: BRAND_BLUE }}>{item.competitorText || "—"}</td>
                    <td className="px-5 py-3 text-[#8a8a8a]">{item.platform || "—"}</td>
                    <td className="px-5 py-3 text-[#8a8a8a]">{item.observedAt || "—"}</td>
                    <td className="px-5 py-3">
                      {item.sessionRef ? (
                        <a href={item.sessionRef} target="_blank" rel="noopener noreferrer"
                          className="rounded-md px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:opacity-90"
                          style={{ background: BRAND_BLUE }}
                        >对话详情</a>
                      ) : (
                        <span className="text-[#9aa5a8]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* 分页 */}
        {blankData?.totalSize && Number(blankData.totalSize) > 10 ? (
          <div className="flex items-center justify-between border-t border-[#f0f0f0] px-5 py-3 text-[11px]">
            <span className="text-[#9aa5a8]">
              第 {blankPage} 页 / 共 {Math.ceil(Number(blankData.totalSize) / 10)} 页
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={blankPage <= 1}
                onClick={() => onBlankPageChange(blankPage - 1)}
                className="rounded px-2 py-1 text-[#5f5f66] transition-colors hover:bg-[#f4f8fd] disabled:cursor-not-allowed disabled:opacity-40"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={blankPage * 10 >= Number(blankData.totalSize)}
                onClick={() => onBlankPageChange(blankPage + 1)}
                className="rounded px-2 py-1 text-[#5f5f66] transition-colors hover:bg-[#f4f8fd] disabled:cursor-not-allowed disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
