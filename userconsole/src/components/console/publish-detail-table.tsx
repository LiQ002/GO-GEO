"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
  type UserV1Article,
  type UserV1Brand,
  type UserV1CatalogItem,
  type UserV1PublishTask,
  userApi,
} from "@/lib/api/user-api.generated";

const PAGE_SIZE = 10;

type PublishDetailItem = {
  key: string;
  articleTitle: string;
  articleId: string;
  brandName: string;
  articleType: string;
  channelId: string;
  channelName: string;
  channelIcon?: string;
  publishedAt: string;
  resultUrl?: string;
};

type PublishDetailTableProps = {
  articles: UserV1Article[];
  brands: UserV1Brand[];
  articleTypes: UserV1CatalogItem[];
  publishChannels: UserV1CatalogItem[];
  publishTargets: UserV1CatalogItem[];
  loading?: boolean;
};

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PublishDetailTable({
  articles,
  brands,
  articleTypes,
  publishChannels,
  publishTargets,
  loading: initialLoading,
}: PublishDetailTableProps) {
  const [tasks, setTasks] = useState<UserV1PublishTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [activeChannelId, setActiveChannelId] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function fetchSucceededTasks() {
      setLoadingTasks(true);
      try {
        let allTasks: UserV1PublishTask[] = [];
        let pageToken: string | undefined;
        
        do {
          const reply = await userApi.publishTask.listSucceededPublishTasks({
            pageSize: 100,
            pageToken,
          });
          if (reply.items) {
            allTasks = allTasks.concat(reply.items);
          }
          pageToken = reply.nextPageToken;
        } while (pageToken);

        if (!cancelled) {
          setTasks(allTasks);
          setLoadingTasks(false);
        }
      } catch (err) {
        console.error("获取成功发布任务失败:", err);
        if (!cancelled) {
          setTasks([]);
          setLoadingTasks(false);
        }
      }
    }

    fetchSucceededTasks();
    return () => {
      cancelled = true;
    };
  }, []);

  const detailItems: PublishDetailItem[] = useMemo(
    () =>
      tasks.map((task) => {
        const articleId = String(task.articleId ?? "");
        const article = articles.find((a) => String(a.id) === articleId);
        const brandId = String(article?.brandId ?? "");
        const brand = brands.find((b) => String(b.id) === brandId);
        const articleTypeId = String(article?.articleTypeId ?? "");
        const articleType = articleTypes.find((t) => String(t.id) === articleTypeId);

        // 先从任务直接获取渠道ID，若为空则通过发布目标的 parentId 关联获取
        let channelId = String(task.publishChannelId ?? "");
        if (!channelId && task.publishTargetId) {
          const target = publishTargets.find((t) => String(t.id) === String(task.publishTargetId));
          if (target?.parentId) {
            channelId = String(target.parentId);
          }
        }
        const channel = channelId
          ? publishChannels.find((c) => String(c.id) === channelId)
          : undefined;

        return {
          key: `task-${task.id}`,
          articleTitle: article?.title ?? `文章 #${articleId}`,
          articleId,
          brandName: brand?.name ?? "-",
          articleType: articleType?.name ?? "未分类",
          channelId,
          channelName: channel?.name ?? "",
          channelIcon: channel?.icon ?? undefined,
          publishedAt: task.completedAt ?? "",
          resultUrl: task.resultUrl ?? undefined,
        };
      }),
    [tasks, articles, brands, articleTypes, publishChannels, publishTargets]
  );

  const sortedItems = useMemo(
    () =>
      [...detailItems].sort((a, b) => {
        const timeA = new Date(a.publishedAt).getTime() || 0;
        const timeB = new Date(b.publishedAt).getTime() || 0;
        return timeB - timeA;
      }),
    [detailItems]
  );

  // 筛选渠道（排除无渠道的）
  const availableChannels = useMemo(() => {
    const channelMap = new Map<string, { id: string; name: string; icon?: string; count: number }>();
    for (const item of sortedItems) {
      if (!item.channelId) continue;
      const existing = channelMap.get(item.channelId);
      if (existing) {
        existing.count++;
      } else {
        channelMap.set(item.channelId, {
          id: item.channelId,
          name: item.channelName,
          icon: item.channelIcon,
          count: 1,
        });
      }
    }
    return Array.from(channelMap.values());
  }, [sortedItems]);

  // 根据选中的渠道筛选
  const filteredItems = useMemo(() => {
    if (activeChannelId === "all") return sortedItems;
    return sortedItems.filter((item) => item.channelId === activeChannelId);
  }, [sortedItems, activeChannelId]);

  // 分页
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedItems = filteredItems.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  );

  const isLoading = initialLoading || loadingTasks;

  // 渠道筛选变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [activeChannelId]);

  // 页码列表生成
  const pages: Array<number | "ellipsis"> = [];
  const addPage = (p: number) => {
    if (p >= 1 && p <= totalPages && !pages.includes(p)) pages.push(p);
  };
  addPage(1);
  if (safeCurrentPage - 2 > 2) pages.push("ellipsis");
  for (let p = safeCurrentPage - 2; p <= safeCurrentPage + 2; p++) addPage(p);
  if (safeCurrentPage + 2 < totalPages - 1) pages.push("ellipsis");
  addPage(totalPages);
  const sortedPages = [...new Set(pages)];

  return (
    <section className="console-card mt-5 overflow-hidden">
      <div className="border-b border-white/70 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[16px] font-semibold tracking-[-.02em] text-[#25252a]">
              发布详情
            </h2>
            <p className="mt-0.5 text-[11px] text-[#717179]">
              已成功发布的文章列表
            </p>
          </div>
          {/* 平台筛选器 */}
          {availableChannels.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveChannelId("all")}
                className={`inline-flex h-7 items-center gap-1 rounded-[8px] px-2.5 text-[11px] font-medium transition ${
                  activeChannelId === "all"
                    ? "bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] text-white shadow"
                    : "bg-white/60 text-[#5f5f66] hover:bg-white hover:text-[#1d1d1f]"
                }`}
              >
                全部
                <span className={`rounded-full px-1.5 text-[10px] ${
                  activeChannelId === "all" ? "bg-white/20" : "bg-[#3f8fff]/10 text-[#3f8fff]"
                }`}>
                  {sortedItems.length}
                </span>
              </button>
              {availableChannels.map((ch) => {
                const isActive = activeChannelId === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setActiveChannelId(ch.id)}
                    className={`inline-flex h-7 items-center gap-1 rounded-[8px] px-2.5 text-[11px] font-medium transition ${
                      isActive
                        ? "bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] text-white shadow"
                        : "bg-white/60 text-[#5f5f66] hover:bg-white hover:text-[#1d1d1f]"
                    }`}
                    title={ch.name}
                  >
                    {ch.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ch.icon}
                        alt={ch.name}
                        className="h-4 w-4 rounded-[2px] object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <span className="max-w-[60px] truncate">{ch.name}</span>
                    <span className={`rounded-full px-1.5 text-[10px] ${
                      isActive ? "bg-white/20" : "bg-[#3f8fff]/10 text-[#3f8fff]"
                    }`}>
                      {ch.count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-white/70 bg-white/40">
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#717179]">
                文章
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#717179]">
                类型
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#717179]">
                所属品牌
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#717179]">
                投放渠道
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#717179]">
                投放时间
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#717179]">
                结果链接
              </th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[12px] text-[#9a9aa0]">
                  {sortedItems.length === 0 ? "暂无发布记录" : "当前平台暂无发布记录"}
                </td>
              </tr>
            ) : null}
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[12px] text-[#9a9aa0]">
                  <Icon name="sparkles" className="mr-1 inline h-4 w-4 animate-pulse" />
                  正在加载…
                </td>
              </tr>
            ) : null}
            {!isLoading
              ? pagedItems.map((item) => (
                  <tr
                    key={item.key}
                    className="border-b border-white/55 last:border-0 hover:bg-white/40"
                  >
                    <td
                      className="max-w-[200px] truncate px-4 py-3 text-[12px] font-medium text-[#3a3a40]"
                      title={item.articleTitle}
                    >
                      {item.articleTitle}
                    </td>
                    <td className="px-4 py-3 text-[12px]">
                      <span className="inline-flex items-center rounded-full bg-[#3f8fff]/10 px-2 py-0.5 text-[10px] font-medium text-[#3f8fff]">
                        {item.articleType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#5f5f66]">
                      {item.brandName}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#5f5f66]">
                      {item.channelName ? (
                        <span className="inline-flex items-center gap-1.5 align-middle">
                          {item.channelIcon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.channelIcon}
                              alt={item.channelName}
                              className="h-4 w-4 shrink-0 rounded-[3px] object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] bg-[#eef0f4] text-[9px] text-[#717179]">
                              {item.channelName.charAt(0)}
                            </span>
                          )}
                          <span className="truncate">{item.channelName}</span>
                        </span>
                      ) : (
                        <span className="text-[#9a9aa0]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#717179]">
                      {formatDateTime(item.publishedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.resultUrl ? (
                        <a
                          href={item.resultUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-[#3f8fff]/10 px-2.5 text-[11px] font-medium text-[#3f8fff] transition hover:bg-[#3f8fff]/20"
                        >
                          <Icon name="eye" className="h-3.5 w-3.5" />
                          查看详情 &gt;
                        </a>
                      ) : (
                        <a
                          href={`/console/articles/${item.articleId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-[#3f8fff]/10 px-2.5 text-[11px] font-medium text-[#3f8fff] transition hover:bg-[#3f8fff]/20"
                        >
                          <Icon name="eye" className="h-3.5 w-3.5" />
                          查看文章 &gt;
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
      {/* 分页 */}
      {!isLoading && filteredItems.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-white/70 px-5 py-3 text-[11px] text-[#717179] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <span className="whitespace-nowrap">
            {safeCurrentPage} / {totalPages} 页 · {PAGE_SIZE}条/页
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => safeCurrentPage > 1 && setCurrentPage(safeCurrentPage - 1)}
              disabled={safeCurrentPage <= 1}
              className="inline-flex h-7 items-center gap-0.5 rounded-[8px] bg-white/60 px-2 text-[11px] font-medium text-[#5f5f66] transition hover:bg-white hover:text-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="arrow-left" className="h-3 w-3" />
              上一页
            </button>
            {sortedPages.map((p, idx) =>
              p === "ellipsis" ? (
                <span key={`e-${idx}`} className="px-1 text-[#9aa5a8]">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-[8px] px-1.5 text-[11px] font-medium transition ${
                    p === safeCurrentPage
                      ? "bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] text-white shadow"
                      : "bg-white/60 text-[#5f5f66] hover:bg-white hover:text-[#1d1d1f]"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => safeCurrentPage < totalPages && setCurrentPage(safeCurrentPage + 1)}
              disabled={safeCurrentPage >= totalPages}
              className="inline-flex h-7 items-center gap-0.5 rounded-[8px] bg-white/60 px-2 text-[11px] font-medium text-[#5f5f66] transition hover:bg-white hover:text-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一页
              <Icon name="arrow-right" className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
