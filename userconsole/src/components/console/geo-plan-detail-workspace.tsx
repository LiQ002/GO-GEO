"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CONSOLE_PAGE_SIZE,
  type ResourcePage,
} from "@/lib/api/console-resources";
import {
  type UserV1GeoTask,
  type UserV1MonitorPlan,
  userApi,
} from "@/lib/api/user-api.generated";
import { useGeoEvents } from "@/lib/hooks/use-geo-events";
import {
  MonitorPlanStatus,
  MonitorTerminalType,
  monitorPlanStatusOptions,
  monitorScheduleOptions,
  optionLabel,
} from "@/lib/user-enums";
import { Icon } from "../ui/icon";
import { useConsoleData } from "./console-data-provider";
import { GeoAnswerDrawer } from "./geo-answer-drawer";
import { Toast } from "./modal";

type SiteTarget = {
  inclusion_site_id: number;
  platform_account_id: number;
  model_entry: string;
  locale: string;
  region: string;
  priority: number;
};

type PlanAction = {
  action: string;
  label: string;
  tone?: "danger" | "primary";
};

const planStatusActions: Record<number, PlanAction[]> = {
  [MonitorPlanStatus.active]: [
    { action: "pause", label: "暂停" },
    { action: "stop", label: "停止", tone: "danger" },
  ],
  [MonitorPlanStatus.paused]: [
    { action: "resume", label: "恢复", tone: "primary" },
    { action: "stop", label: "停止", tone: "danger" },
  ],
};

const geoTaskStatusLabels: Record<string, string> = {
  pending: "待执行",
  queued: "已排队",
  running: "执行中",
  succeeded: "已完成",
  failed: "失败",
  skipped: "已跳过",
  timeout: "超时",
};

const geoTaskStatusTone: Record<string, string> = {
  pending: "bg-[#9a9aa0]/15 text-[#717179]",
  queued: "bg-[#9a9aa0]/15 text-[#717179]",
  running: "bg-[#3f8fff]/15 text-[#3f8fff]",
  succeeded: "bg-[#1f9d63]/15 text-[#1f9d63]",
  failed: "bg-[#d65a50]/15 text-[#d65a50]",
  skipped: "bg-[#d99a1a]/15 text-[#d99a1a]",
  timeout: "bg-[#d65a50]/15 text-[#d65a50]",
};

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function safeParseQuestions(json?: string): number[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0);
  } catch {
    return [];
  }
}

function safeParseSiteTargets(json?: string): SiteTarget[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item && typeof item === "object" && Number(item.inclusion_site_id) > 0,
    );
  } catch {
    return [];
  }
}

function statusBadge(status?: string) {
  const label = geoTaskStatusLabels[status ?? ""] ?? status ?? "-";
  const tone =
    geoTaskStatusTone[status ?? ""] ?? "bg-[#9a9aa0]/15 text-[#717179]";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}

// 终端类型标签
function terminalBadge(terminalType?: number) {
  if (terminalType === MonitorTerminalType.mobile) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#9b6dff]/15 px-1.5 py-0.5 text-[9px] font-semibold text-[#9b6dff]">
        移动端
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-[#3f8fff]/15 px-1.5 py-0.5 text-[9px] font-semibold text-[#3f8fff]">
      电脑端
    </span>
  );
}

// 获取终端类型乘数（并行模式需要乘以2）
function getTerminalMultiplier(monitorTerminal?: number): number {
  if (monitorTerminal === MonitorTerminalType.parallel) return 2;
  return 1;
}

type InfoCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
};

function InfoCard({ label, value, hint }: InfoCardProps) {
  return (
    <article className="console-card p-4">
      <p className="text-[11px] font-medium text-[#717179]">{label}</p>
      <p className="mt-1.5 text-[16px] font-semibold tracking-[-.02em] text-[#25252a]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[10px] text-[#9a9aa0]">{hint}</p> : null}
    </article>
  );
}

async function collectGeoTasks(planId: string) {
  const firstReply = await userApi.geoMonitor.listGeoTasks({
    monitorPlanId: planId,
    pageSize: 100,
  });
  const tasks = [...(firstReply.items ?? [])];
  const visitedTokens = new Set<string>();
  let pageToken = firstReply.nextPageToken || "";
  while (pageToken && !visitedTokens.has(pageToken)) {
    visitedTokens.add(pageToken);
    const reply = await userApi.geoMonitor.listGeoTasks({
      monitorPlanId: planId,
      pageSize: 100,
      pageToken,
    });
    tasks.push(...(reply.items ?? []));
    pageToken = reply.nextPageToken || "";
  }
  return tasks;
}

export function GeoPlanDetailWorkspace({ planId }: { planId: string }) {
  const { getChoices, refreshResources } = useConsoleData();
  const [plan, setPlan] = useState<UserV1MonitorPlan | null>(null);
  const [tasks, setTasks] = useState<UserV1GeoTask[]>([]);
  const [allTasks, setAllTasks] = useState<UserV1GeoTask[]>([]);
  const [taskPage, setTaskPage] = useState<ResourcePage | null>(null);
  const [taskPageIndex, setTaskPageIndex] = useState(0);
  const [taskPageTokens, setTaskPageTokens] = useState([""]);
  const taskPageTokenRef = useRef("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [answerTaskId, setAnswerTaskId] = useState<string | null>(null);

  const loadDetail = useCallback(
    async (pageToken = taskPageTokenRef.current) => {
      setLoading(true);
      setError("");
      try {
        const [loadedPlan, loadedTasks] = await Promise.all([
          userApi.geoMonitor.getMonitorPlan(planId),
          userApi.geoMonitor.listGeoTasks({
            monitorPlanId: planId,
            pageSize: CONSOLE_PAGE_SIZE,
            pageToken,
          }),
        ]);
        const loadedAllTasks = await collectGeoTasks(planId);
        setPlan(loadedPlan);
        setTasks(loadedTasks.items ?? []);
        setAllTasks(loadedAllTasks);
        taskPageTokenRef.current = pageToken;
        setTaskPage({
          nextPageToken: loadedTasks.nextPageToken || "",
          pageSize: CONSOLE_PAGE_SIZE,
          pageToken,
          totalSize: Number(loadedTasks.totalSize || 0),
        });
        return true;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "监测计划加载失败");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [planId],
  );

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  // 准实时刷新：页面重新可见时立即拉取 + 30 秒轮询兜底
  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return;
      void loadDetail();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const interval = setInterval(refresh, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      clearInterval(interval);
    };
  }, [loadDetail]);

  // SSE 实时推送：后端写入收录结果后立即推送，收到事件即时刷新
  useGeoEvents({
    onEvent: () => {
      void loadDetail();
    },
  });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const questionIds = useMemo(
    () => safeParseQuestions(plan?.questionIdsJson),
    [plan?.questionIdsJson],
  );
  const siteTargets = useMemo(
    () => safeParseSiteTargets(plan?.siteTargetsJson),
    [plan?.siteTargetsJson],
  );

  const brandChoices = getChoices("brands");
  const questionChoices = getChoices("questions");
  const siteChoices = getChoices("inclusionSites");
  const keywordChoices = getChoices("keywords");

  const brandName = useMemo(() => {
    const brandId = String(plan?.brandId ?? "");
    return (
      brandChoices.find((item) => item.value === brandId)?.label ?? brandId
    );
  }, [brandChoices, plan?.brandId]);

  const questionLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const qid of questionIds) {
      const choice = questionChoices.find((item) => item.value === String(qid));
      map.set(String(qid), choice?.label ?? `问题 #${qid}`);
    }
    return map;
  }, [questionChoices, questionIds]);

  // 关键词标签映射：questionId → keywordText
  const keywordLabels = useMemo(() => {
    const map = new Map<string, string>();
    const keywordMap = new Map(
      keywordChoices.map((item) => [item.value, item.label]),
    );
    for (const qid of questionIds) {
      const qChoice = questionChoices.find(
        (item) => item.value === String(qid),
      );
      const keywordId = qChoice?.keywordId ?? "";
      map.set(String(qid), keywordMap.get(keywordId) ?? "-");
    }
    return map;
  }, [keywordChoices, questionChoices, questionIds]);

  const siteLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const target of siteTargets) {
      const sid = String(target.inclusion_site_id);
      const choice = siteChoices.find((item) => item.value === sid);
      map.set(sid, choice?.label ?? `站点 #${target.inclusion_site_id}`);
    }
    return map;
  }, [siteChoices, siteTargets]);

  // 任务索引：按 `${questionId}-${inclusionSiteId}-${terminalType}` 索引最新一条任务
  const taskIndex = useMemo(() => {
    const map = new Map<string, UserV1GeoTask>();
    for (const task of allTasks) {
      const key = `${task.questionId}-${task.inclusionSiteId}-${task.terminalType ?? MonitorTerminalType.pc}`;
      const existing = map.get(key);
      if (
        !existing ||
        (task.completedAt ?? "") >= (existing.completedAt ?? "")
      ) {
        map.set(key, task);
      }
    }
    return map;
  }, [allTasks]);

  const statusValue = plan?.status ?? MonitorPlanStatus.active;
  const scheduleLabel = optionLabel(monitorScheduleOptions, plan?.scheduleType);
  const planStatusLabel = optionLabel(monitorPlanStatusOptions, statusValue);
  const actions = planStatusActions[statusValue] ?? [];
  const terminalMultiplier = getTerminalMultiplier(plan?.monitorTerminal);
  // 任务总数以后端实际生成的 geo_tasks 为准（部分平台不支持移动端会被跳过，如纳米AI）；
  // allTasks 未加载时回退到理论值（问题×站点×终端）。
  const theoreticalTotal =
    questionIds.length * siteTargets.length * terminalMultiplier;
  const totalQueries = allTasks.length || theoreticalTotal;
  const completedTasks = allTasks.filter(
    (task) => task.status === "succeeded",
  ).length;
  // 收录明细只展示已采集且品牌被提及的任务（未收录的不显示）。
  const includedTasks = tasks.filter(
    (task) => task.status === "succeeded" && task.brandMentioned === true,
  );
  const taskTotalPages = Math.max(
    1,
    Math.ceil((taskPage?.totalSize ?? 0) / CONSOLE_PAGE_SIZE),
  );

  async function changeTaskPage(direction: "next" | "previous") {
    if (!taskPage || loading) return;
    const targetIndex =
      direction === "next" ? taskPageIndex + 1 : taskPageIndex - 1;
    if (targetIndex < 0 || targetIndex >= taskTotalPages) return;
    const pageToken =
      direction === "next"
        ? taskPage.nextPageToken
        : taskPageTokens[targetIndex];
    if (!pageToken && direction === "next") return;
    const loaded = await loadDetail(pageToken);
    if (!loaded) return;
    setTaskPageIndex(targetIndex);
    if (direction === "next") {
      setTaskPageTokens((current) => {
        const next = current.slice(0, targetIndex);
        next[targetIndex] = pageToken;
        return next;
      });
    }
  }

  async function runAction(action: PlanAction) {
    if (!plan) return;
    if (action.tone === "danger") {
      const ok = window.confirm(
        `确认要${action.label}该监测计划吗？停止后将不再生成新的检测任务，已采集的回答仍可查看。`,
      );
      if (!ok) return;
    }
    setActing(true);
    try {
      const updated = await userApi.geoMonitor.changeMonitorPlanStatus(planId, {
        action: action.action,
        id: planId,
        version: String(plan.version ?? ""),
      });
      setPlan(updated);
      setToast(`已${action.label}监测计划`);
      void refreshResources();
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "操作失败");
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#717179]">
        <Icon name="sparkles" className="h-4 w-4 animate-pulse" />
        正在加载监测计划…
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="py-10">
        <p className="rounded-[14px] bg-[#fff0ed]/75 px-4 py-3 text-xs text-[#d65a50]">
          {error || "监测计划不存在"}
        </p>
        <Link
          href="/console/geo"
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-[14px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-4 text-[13px] font-semibold text-white"
        >
          <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
          返回监测列表
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/console/geo"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3478f6] hover:underline"
          >
            <Icon name="arrow-right" className="h-3.5 w-3.5 rotate-180" />
            返回 GEO 监测列表
          </Link>
          <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#3478f6]">
            <Icon name="geo" className="h-4 w-4" />
            GEO 洞察
          </div>
          <h1 className="mt-2 text-[27px] font-semibold tracking-[-.04em]">
            {plan.name || "未命名监测"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#717179]">
            {brandName} · {scheduleLabel}
            {plan.cronExpression ? ` · ${plan.cronExpression}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="glass-control inline-flex h-10 items-center rounded-[14px] px-3 text-xs font-medium text-[#5f5f66]">
            {planStatusLabel}
          </span>
          {actions.map((action) => (
            <button
              key={action.action}
              type="button"
              disabled={acting}
              onClick={() => void runAction(action)}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-[14px] px-4 text-[13px] font-semibold transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 ${
                action.tone === "danger"
                  ? "bg-[#fff0ed] text-[#d65a50]"
                  : action.tone === "primary"
                    ? "bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] text-white"
                    : "glass-control text-[#5f5f66]"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard
          label="所属品牌"
          value={brandName}
          hint={`计划编号 #${planId}`}
        />
        <InfoCard
          label="执行频率"
          value={scheduleLabel}
          hint={
            plan.cronExpression ? `Cron: ${plan.cronExpression}` : undefined
          }
        />
        <InfoCard
          label="下次执行"
          value={formatDateTime(plan.nextRunAt)}
          hint={`最近执行：${formatDateTime(plan.lastRunAt)}`}
        />
        <InfoCard
          label="任务进度"
          value={`${completedTasks} / ${totalQueries || tasks.length || 0}`}
          hint={`${questionIds.length} 个问题 × ${siteTargets.length} 个站点 × ${terminalMultiplier} 个终端`}
        />
      </div>

      {totalQueries === 0 ? (
        <section className="console-card mt-5 p-6">
          <p className="text-sm text-[#717179]">
            该计划尚未配置问题或站点矩阵。请编辑计划补充目标问题与检查站点后再查看任务矩阵。
          </p>
        </section>
      ) : (
        <section className="console-card mt-7 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/70 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-.02em] text-[#25252a]">
                任务矩阵
              </h2>
              <p className="mt-0.5 text-[11px] text-[#717179]">
                {plan?.monitorTerminal === MonitorTerminalType.parallel
                  ? "每个单元格显示「问题 × 平台」在电脑端和移动端的执行状态"
                  : "每个单元格对应一个「问题 × 平台」组合，点击已完成的任务可查看 AI 回答详情"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadDetail()}
              disabled={loading}
              className="glass-control inline-flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-[11px] font-medium text-[#5f5f66] disabled:opacity-60"
            >
              <Icon name="sparkles" className="h-3.5 w-3.5" />
              刷新
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-white/70 bg-white/40">
                  <th className="sticky left-0 z-10 bg-white/70 px-4 py-3 text-left text-[11px] font-semibold text-[#717179]">
                    问题 / 平台
                  </th>
                  {siteTargets.map((target) => (
                    <th
                      key={target.inclusion_site_id}
                      className="px-3 py-3 text-left align-top text-[11px] font-semibold text-[#5f5f66]"
                    >
                      {siteLabels.get(String(target.inclusion_site_id)) ??
                        `站点 #${target.inclusion_site_id}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {questionIds.map((qid) => {
                  const qLabel =
                    questionLabels.get(String(qid)) ?? `问题 #${qid}`;
                  return (
                    <tr
                      key={qid}
                      className="border-b border-white/55 last:border-0"
                    >
                      <td className="sticky left-0 z-10 bg-white/70 px-4 py-3 text-[12px] font-medium text-[#3a3a40]">
                        {qLabel}
                      </td>
                      {siteTargets.map((target) => {
                        const siteId = target.inclusion_site_id;
                        const isParallel = plan?.monitorTerminal === MonitorTerminalType.parallel;
                        
                        if (isParallel) {
                          // 并行模式：显示 PC 和移动端两个状态
                          const pcKey = `${qid}-${siteId}-${MonitorTerminalType.pc}`;
                          const mobileKey = `${qid}-${siteId}-${MonitorTerminalType.mobile}`;
                          const pcTask = taskIndex.get(pcKey);
                          const mobileTask = taskIndex.get(mobileKey);
                          
                          return (
                            <td key={siteId} className="px-2 py-3">
                              <div className="flex flex-col gap-1">
                                {/* PC 端 */}
                                <div className="flex items-center gap-1">
                                  {terminalBadge(MonitorTerminalType.pc)}
                                  {pcTask ? (
                                    <button
                                      type="button"
                                      disabled={pcTask.status !== "succeeded"}
                                      onClick={() => setAnswerTaskId(String(pcTask.id))}
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold transition ${
                                        pcTask.status === "succeeded"
                                          ? "cursor-pointer hover:bg-[#1f9d63]/25"
                                          : "cursor-default"
                                      }`}
                                    >
                                      {statusBadge(pcTask.status)}
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-[#9a9aa0]">—</span>
                                  )}
                                </div>
                                {/* 移动端 */}
                                <div className="flex items-center gap-1">
                                  {terminalBadge(MonitorTerminalType.mobile)}
                                  {mobileTask ? (
                                    <button
                                      type="button"
                                      disabled={mobileTask.status !== "succeeded"}
                                      onClick={() => setAnswerTaskId(String(mobileTask.id))}
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold transition ${
                                        mobileTask.status === "succeeded"
                                          ? "cursor-pointer hover:bg-[#1f9d63]/25"
                                          : "cursor-default"
                                      }`}
                                    >
                                      {statusBadge(mobileTask.status)}
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-[#9a9aa0]">—</span>
                                  )}
                                </div>
                              </div>
                            </td>
                          );
                        } else {
                          // 单终端模式：显示单个状态
                          const key = `${qid}-${siteId}-${plan?.monitorTerminal ?? MonitorTerminalType.pc}`;
                          const task = taskIndex.get(key);
                          const succeeded = task?.status === "succeeded";
                          return (
                            <td key={siteId} className="px-3 py-3">
                              {task ? (
                                <div className="flex items-center gap-1">
                                  {terminalBadge(task.terminalType)}
                                  <button
                                    type="button"
                                    disabled={!succeeded}
                                    onClick={() => setAnswerTaskId(String(task.id))}
                                    className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold transition ${
                                      succeeded
                                        ? "cursor-pointer hover:bg-[#1f9d63]/25"
                                        : "cursor-default"
                                    }`}
                                  >
                                    {statusBadge(task.status)}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-[#9a9aa0]">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        }
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tasks.length === 0 ? null : (
        <section className="console-card mt-5 overflow-hidden">
          <div className="border-b border-white/70 px-5 py-4">
            <h2 className="text-[15px] font-semibold tracking-[-.02em] text-[#25252a]">
              收录明细
            </h2>
            <p className="mt-0.5 text-[11px] text-[#717179]">
              当前页 {includedTasks.length} 条收录成功记录，共{" "}
              {taskPage?.totalSize ?? tasks.length}
              个监测任务；默认按创建时间倒序排列
            </p>
          </div>
          {includedTasks.length === 0 ? (
            <div className="px-5 py-12 text-center text-[12px] text-[#9a9aa0]">
              暂无收录成功的记录；未收录的回答已隐藏，可在执行进度矩阵中查看任务状态。
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse">
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
                    状态
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
                {includedTasks.map((task) => {
                  const qLabel =
                    questionLabels.get(String(task.questionId)) ??
                    `问题 #${task.questionId}`;
                  const kLabel =
                    keywordLabels.get(String(task.questionId)) ?? "-";
                  const sLabel =
                    siteLabels.get(String(task.inclusionSiteId)) ??
                    `站点 #${task.inclusionSiteId}`;
                  const succeeded = task.status === "succeeded";
                  return (
                    <tr
                      key={task.id}
                      className="border-b border-white/55 last:border-0 hover:bg-white/40"
                    >
                      <td
                        className="max-w-[120px] truncate px-4 py-3 text-[12px] font-medium text-[#3a3a40]"
                        title={kLabel}
                      >
                        {kLabel}
                      </td>
                      <td
                        className="max-w-[220px] truncate px-4 py-3 text-[12px] text-[#3a3a40]"
                        title={qLabel}
                      >
                        {qLabel}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#5f5f66]">
                        {sLabel}
                      </td>
                      <td className="px-4 py-3">
                        {terminalBadge(task.terminalType)}
                      </td>
                      <td className="px-4 py-3">
                        {statusBadge(task.status)}
                        {task.errorMessage ? (
                          <p
                            className="mt-1 max-w-[180px] truncate text-[10px] text-[#d65a50]"
                            title={task.errorMessage}
                          >
                            {task.errorMessage}
                          </p>
                        ) : null}
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
                        {formatDateTime(task.completedAt) !== "-"
                          ? formatDateTime(task.completedAt)
                          : formatDateTime(task.scheduledAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {succeeded ? (
                          task.sessionRef ? (
                            <a
                              href={task.sessionRef}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-[#3f8fff]/10 px-2.5 text-[11px] font-medium text-[#3f8fff] transition hover:bg-[#3f8fff]/20"
                            >
                              <Icon name="eye" className="h-3.5 w-3.5" />
                              详情
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAnswerTaskId(String(task.id))}
                              className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-[#3f8fff]/10 px-2.5 text-[11px] font-medium text-[#3f8fff] transition hover:bg-[#3f8fff]/20"
                            >
                              <Icon name="eye" className="h-3.5 w-3.5" />
                              详情
                            </button>
                          )
                        ) : (
                          <span className="text-[11px] text-[#9a9aa0]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-white/70 px-5 py-4 text-[11px] text-[#77777e]">
            <span>每页 {CONSOLE_PAGE_SIZE} 条</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={taskPageIndex === 0 || loading}
                onClick={() => void changeTaskPage("previous")}
                className="glass-control h-8 rounded-[10px] px-3 disabled:cursor-not-allowed disabled:opacity-45"
              >
                上一页
              </button>
              <span className="min-w-16 text-center">
                {taskPageIndex + 1} / {taskTotalPages}
              </span>
              <button
                type="button"
                disabled={
                  !taskPage?.nextPageToken ||
                  taskPageIndex + 1 >= taskTotalPages ||
                  loading
                }
                onClick={() => void changeTaskPage("next")}
                className="glass-control h-8 rounded-[10px] px-3 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? "加载中…" : "下一页"}
              </button>
            </div>
          </div>
        </section>
      )}

      <GeoAnswerDrawer
        open={answerTaskId !== null}
        taskId={answerTaskId}
        onClose={() => setAnswerTaskId(null)}
      />

      <Toast message={toast} />
    </div>
  );
}
