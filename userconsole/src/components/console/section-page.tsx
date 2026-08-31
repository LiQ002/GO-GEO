"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
  CONSOLE_PAGE_SIZE,
  type SelectChoice,
  statusLabel,
} from "@/lib/api/console-resources";
import {
  type UserV1Article,
  type UserV1CatalogItem,
  type UserV1PublishPlan,
  type UserV1PublishTask,
  userApi,
} from "@/lib/api/user-api.generated";
import {
  type ConsoleFormConfig,
  type ConsoleFormField,
  type ConsoleFormValue,
  consoleFormConfigs,
  getStatusOptions,
} from "@/lib/console-forms";
import type { ConsoleSection } from "@/lib/console-sections";
import {
  brandStatusOptions,
  monitorPlanStatusOptions,
  publishPlanStatusOptions,
} from "@/lib/user-enums";
import { ArticleDetailModal } from "./article-detail-modal";
import { type ConsoleRecord, useConsoleData } from "./console-data-provider";
import { ConfirmDialog, Modal, Toast } from "./modal";

type EditorMode = "create" | "edit" | "view" | null;
type StatusFilter = number | string;

const articleStatusOptions = [
  { label: "草稿", value: "draft" },
  { label: "生成中", value: "generating" },
  { label: "已生成", value: "generated" },
  { label: "待审核", value: "pending_review" },
  { label: "已通过", value: "approved" },
  { label: "已驳回", value: "rejected" },
  { label: "投放中", value: "publishing" },
  { label: "已投放", value: "published" },
  { label: "失败", value: "failed" },
];

const serverSearchSections = new Set(["articles", "brand", "knowledge"]);

export function SectionPage({
  section,
  slug,
}: {
  section: ConsoleSection;
  slug: string;
}) {
  const {
    addRecord,
    deleteRecord,
    getChoices,
    getResourcePage,
    getRecords,
    loadRecordPage,
    resourceError,
    resourceLoading,
    resourcePageLoading,
    resourceSnapshot,
    updateRecord,
  } = useConsoleData();
  const searchParams = useSearchParams();
  const records = getRecords(slug);
  const resourcePage = getResourcePage(slug);
  const formConfig = consoleFormConfigs[slug];
  const hasStatus = section.hasStatus !== false;
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [selectedRecord, setSelectedRecord] = useState<ConsoleRecord | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<ConsoleRecord | null>(null);
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [status, setStatus] = useState<StatusFilter>(0);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageTokens, setPageTokens] = useState([""]);
  const previousServerQueryRef = useRef("");

  const serverPaginated = Boolean(resourcePage);
  const clientPaginated = slug === "authorizations";
  const paginated = serverPaginated || clientPaginated;
  const totalRecords = resourcePage?.totalSize ?? records.length;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(
      () => setToast(null),
      toast.includes("客户端令牌") ? 10_000 : 2400,
    );
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    if (clientPaginated) setPageIndex(0);
  }, [clientPaginated, searchParams]);

  useEffect(() => {
    if (resourcePage?.pageToken !== "") return;
    setPageIndex(0);
    setPageTokens([""]);
  }, [resourcePage?.pageToken]);

  const statusOptions = useMemo(() => {
    if (!hasStatus) return [];
    if (slug === "brand") return brandStatusOptions;
    if (slug === "articles") return articleStatusOptions;
    if (slug === "publishing") return publishPlanStatusOptions;
    if (slug === "geo") return monitorPlanStatusOptions;
    return getStatusOptions(records.map((record) => record.values));
  }, [hasStatus, records, slug]);
  const healthyCount = useMemo(
    () =>
      records.filter((record) =>
        ["正常", "可用", "已完成", "已投放", "已通过"].includes(
          record.values.at(-1) || "",
        ),
      ).length,
    [records],
  );

  const visibleRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    const filtered = records.filter((record) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        record.values.some((value) =>
          value.toLocaleLowerCase("zh-CN").includes(normalizedQuery),
        );
      const selectedStatus = statusOptions.find(
        (option) => option.value === status,
      )?.label;
      const matchesStatus =
        !hasStatus || status === 0 || record.values.at(-1) === selectedStatus;
      return matchesQuery && matchesStatus;
    });
    return filtered;
  }, [hasStatus, query, records, status, statusOptions]);
  const filteredTotalRecords = clientPaginated
    ? visibleRecords.length
    : totalRecords;
  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredTotalRecords / (resourcePage?.pageSize ?? CONSOLE_PAGE_SIZE),
    ),
  );
  const displayedRecords = clientPaginated
    ? visibleRecords.slice(
        pageIndex * CONSOLE_PAGE_SIZE,
        (pageIndex + 1) * CONSOLE_PAGE_SIZE,
      )
    : visibleRecords;

  useEffect(() => {
    if (!serverPaginated || !serverSearchSections.has(slug)) return;
    if (previousServerQueryRef.current === query) return;
    const timer = window.setTimeout(() => {
      previousServerQueryRef.current = query;
      setPageIndex(0);
      setPageTokens([""]);
      void loadRecordPage(slug, {
        keyword: query.trim(),
        pageSize: CONSOLE_PAGE_SIZE,
        pageToken: "",
        status,
      }).catch(() => undefined);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [loadRecordPage, query, serverPaginated, slug, status]);

  function openEditor(mode: EditorMode, record: ConsoleRecord | null = null) {
    setSelectedRecord(record);
    setEditorMode(mode);
  }

  function closeEditor() {
    setEditorMode(null);
    setSelectedRecord(null);
  }

  async function changeStatusFilter(nextStatus: StatusFilter) {
    if (!serverPaginated) {
      setStatus(nextStatus);
      setPageIndex(0);
      return;
    }
    const previousStatus = status;
    const previousPageIndex = pageIndex;
    const previousPageTokens = pageTokens;
    setStatus(nextStatus);
    setPageIndex(0);
    setPageTokens([""]);
    try {
      await loadRecordPage(slug, {
        keyword: query.trim(),
        pageSize: CONSOLE_PAGE_SIZE,
        pageToken: "",
        status: nextStatus,
      });
    } catch (caught) {
      setStatus(previousStatus);
      setPageIndex(previousPageIndex);
      setPageTokens(previousPageTokens);
      setToast(caught instanceof Error ? caught.message : "分页数据加载失败");
    }
  }

  async function changePage(direction: "next" | "previous") {
    const targetIndex = direction === "next" ? pageIndex + 1 : pageIndex - 1;
    if (targetIndex < 0 || targetIndex >= totalPages) return;
    if (clientPaginated) {
      setPageIndex(targetIndex);
      return;
    }
    if (!resourcePage || resourcePageLoading) return;
    const pageToken =
      direction === "next"
        ? resourcePage.nextPageToken
        : pageTokens[targetIndex];
    if (direction === "next" && !pageToken) return;
    try {
      await loadRecordPage(slug, {
        keyword: query.trim(),
        pageSize: resourcePage.pageSize,
        pageToken,
        status,
      });
      setPageIndex(targetIndex);
      if (direction === "next") {
        setPageTokens((current) => {
          const next = current.slice(0, targetIndex);
          next[targetIndex] = pageToken;
          return next;
        });
      }
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "分页数据加载失败");
    }
  }

  async function saveRecord(values: ConsoleFormValue[]) {
    setSaving(true);
    let saved = false;
    try {
      if (editorMode === "edit" && selectedRecord) {
        await updateRecord(slug, selectedRecord, values);
        setToast(`${String(values[0])} 已更新`);
      } else {
        const message = await addRecord(slug, values);
        setToast(message || `${String(values[0])} 已创建`);
      }
      saved = true;
      closeEditor();
      if (serverPaginated) {
        const editing = editorMode === "edit";
        const targetIndex = editing ? pageIndex : 0;
        const pageToken = editing ? (resourcePage?.pageToken ?? "") : "";
        await loadRecordPage(slug, {
          keyword: query.trim(),
          pageSize: resourcePage?.pageSize ?? CONSOLE_PAGE_SIZE,
          pageToken,
          status,
        });
        if (!editing) {
          setPageIndex(0);
          setPageTokens([""]);
        } else {
          setPageIndex(targetIndex);
        }
      } else if (clientPaginated) setPageIndex(0);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "操作失败";
      setToast(saved ? `内容已保存，但列表刷新失败：${message}` : message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    let deleted = false;
    try {
      await deleteRecord(slug, deleteTarget);
      deleted = true;
      setToast(`${deleteTarget.values[0]} 已删除`);
      setDeleteTarget(null);
      if (serverPaginated && resourcePage) {
        const moveToPreviousPage = records.length === 1 && pageIndex > 0;
        const targetIndex = moveToPreviousPage ? pageIndex - 1 : pageIndex;
        const pageToken = moveToPreviousPage
          ? pageTokens[targetIndex]
          : resourcePage.pageToken;
        await loadRecordPage(slug, {
          keyword: query.trim(),
          pageSize: resourcePage.pageSize,
          pageToken,
          status,
        });
        if (moveToPreviousPage) setPageIndex(targetIndex);
      } else if (
        clientPaginated &&
        displayedRecords.length === 1 &&
        pageIndex > 0
      ) {
        setPageIndex((current) => current - 1);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "删除失败";
      setToast(deleted ? `记录已删除，但列表刷新失败：${message}` : message);
    }
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3478f6]">
            <Icon name={section.icon} className="h-4 w-4" />
            企业内容增长
          </div>
          <h1 className="mt-2 text-[27px] font-semibold tracking-[-.04em]">
            {section.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#717179]">
            {section.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!section.action ? null : slug === "articles" ? (
            <Link
              href="/console/articles/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(69,112,235,.24),inset_0_1px_0_rgba(255,255,255,.28)] transition hover:-translate-y-0.5"
            >
              <Icon name="plus" className="h-4 w-4" />
              {section.action}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => openEditor("create")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(69,112,235,.24),inset_0_1px_0_rgba(255,255,255,.28)] transition hover:-translate-y-0.5"
            >
              <Icon name="plus" className="h-4 w-4" />
              {section.action}
            </button>
          )}
        </div>
      </div>

      {resourceError ? (
        <p className="mt-5 rounded-[14px] bg-[#fff0ed]/75 px-4 py-3 text-xs text-[#d65a50]">
          {resourceError}
        </p>
      ) : null}

      {hasStatus ? (
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {[
            {
              label: "全部记录",
              value: totalRecords,
              note: "来自当前企业数据",
            },
            {
              label: "正常 / 已完成",
              value: healthyCount,
              note: paginated ? "当前页可正常使用" : "当前可正常使用",
            },
            {
              label: "其他状态",
              value: Math.max(0, records.length - healthyCount),
              note: paginated ? "当前页其他状态" : "含草稿、处理中及已暂停",
            },
          ].map((stat) => (
            <article key={stat.label} className="console-card p-5">
              <p className="text-xs font-medium text-[#71848a]">{stat.label}</p>
              <strong className="mt-3 block text-[28px] font-semibold tracking-[-.045em]">
                {stat.value}
              </strong>
              <p className="mt-2 text-[11px] font-medium text-[#3478f6]">
                {stat.note}
              </p>
            </article>
          ))}
        </div>
      ) : null}

      <section
        className={`console-card overflow-hidden ${hasStatus ? "mt-5" : "mt-7"}`}
      >
        <div className="flex flex-col gap-3 border-b border-white/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <label className="glass-control flex h-10 max-w-sm flex-1 items-center gap-2 rounded-[14px] px-3 text-[#85858c]">
            <Icon name="search" className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (clientPaginated) setPageIndex(0);
              }}
              aria-label={`搜索${section.title}`}
              placeholder={`搜索${section.title}…`}
              className="min-w-0 flex-1 bg-transparent text-sm text-[#3a3a40] outline-none"
            />
            {query ? (
              <button
                type="button"
                aria-label="清空搜索"
                onClick={() => setQuery("")}
              >
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
          <div className="flex gap-2">
            {hasStatus ? (
              <select
                value={status}
                disabled={resourcePageLoading}
                onChange={(event) => {
                  const value = event.target.value;
                  const nextStatus =
                    value === "0"
                      ? 0
                      : (statusOptions.find(
                          (option) => String(option.value) === value,
                        )?.value ?? 0);
                  void changeStatusFilter(nextStatus);
                }}
                aria-label="按状态筛选"
                className="glass-control h-10 rounded-[14px] px-3 text-xs font-medium text-[#5f5f66] outline-none disabled:cursor-wait disabled:opacity-60"
              >
                <option value={0}>全部状态</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : null}
            <span className="glass-control inline-flex h-10 items-center rounded-[14px] px-4 text-xs font-medium text-[#5f5f66]">
              最新创建优先
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr>
                {section.columns.map((column) => (
                  <th
                    key={column}
                    className="border-b border-white/70 px-5 py-3 text-[11px] font-semibold text-[#7f7f87]"
                  >
                    {column}
                  </th>
                ))}
                <th className="border-b border-white/70 px-5 py-3 text-right text-[11px] font-semibold text-[#7f7f87]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/55">
              {displayedRecords.map((record) => (
                <tr key={record.id} className="transition-colors">
                  {record.values.map((cell, index) => (
                    <td
                      key={`${record.id}-${section.columns[index]}`}
                      className={`whitespace-nowrap px-5 py-4 text-[12px] ${index === 0 ? "font-medium text-[#34343a]" : hasStatus && index === record.values.length - 1 ? "text-[#3478f6]" : "text-[#707078]"}`}
                    >
                      {hasStatus && index === record.values.length - 1 ? (
                        <span className="rounded-full border border-white/80 bg-[#eaf2ff]/75 px-2.5 py-1 font-medium shadow-[inset_0_1px_0_white]">
                          {cell}
                        </span>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      {slug === "articles" ? (
                        <>
                          <ActionLink
                            href={`/console/articles/${record.id}?mode=view`}
                            label="查看"
                            icon="eye"
                          />
                          {section.allowEdit !== false ? (
                            <ActionLink
                              href={`/console/articles/${record.id}`}
                              label="编辑"
                              icon="edit"
                            />
                          ) : null}
                        </>
                      ) : slug === "geo" ? (
                        <>
                          <ActionLink
                            href={`/console/geo/${record.id}`}
                            label="查看"
                            icon="eye"
                          />
                          {section.allowEdit !== false ? (
                            <ActionButton
                              label="编辑"
                              icon="edit"
                              onClick={() => openEditor("edit", record)}
                            />
                          ) : null}
                        </>
                      ) : (
                        <>
                          <ActionButton
                            label="查看"
                            icon="eye"
                            onClick={() => openEditor("view", record)}
                          />
                          {section.allowEdit !== false ? (
                            <ActionButton
                              label="编辑"
                              icon="edit"
                              onClick={() => openEditor("edit", record)}
                            />
                          ) : null}
                        </>
                      )}
                      {section.allowDelete !== false ? (
                        <ActionButton
                          label="删除"
                          icon="trash"
                          danger
                          onClick={() => setDeleteTarget(record)}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {displayedRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={section.columns.length + 1}
                    className="px-5 py-16 text-center"
                  >
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/50 text-[#818188]">
                      <Icon name="search" className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-[#55555c]">
                      {resourceLoading
                        ? "正在加载业务数据…"
                        : resourcePageLoading
                          ? "正在加载业务数据…"
                          : "没有找到匹配内容"}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        void changeStatusFilter(0);
                      }}
                      className="mt-2 text-xs text-[#3478f6]"
                    >
                      清除筛选条件
                    </button>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-white/70 px-5 py-4 text-[11px] text-[#77777e] sm:flex-row sm:items-center sm:justify-between">
          <span>
            当前页显示 {displayedRecords.length} 条，共 {filteredTotalRecords}{" "}
            条记录
          </span>
          {paginated ? (
            <nav aria-label="内容投放分页" className="flex items-center gap-2">
              <button
                type="button"
                disabled={pageIndex === 0 || resourcePageLoading}
                onClick={() => void changePage("previous")}
                className="glass-control h-8 rounded-[10px] px-3 font-medium text-[#59656a] disabled:cursor-not-allowed disabled:opacity-45"
              >
                上一页
              </button>
              <span className="min-w-20 rounded-[10px] bg-[linear-gradient(145deg,#438fff,#706af4)] px-3 py-2 text-center text-white shadow-sm">
                {pageIndex + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={
                  (!clientPaginated && !resourcePage?.nextPageToken) ||
                  pageIndex + 1 >= totalPages ||
                  resourcePageLoading
                }
                onClick={() => void changePage("next")}
                className="glass-control h-8 rounded-[10px] px-3 font-medium text-[#59656a] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {resourcePageLoading ? "加载中…" : "下一页"}
              </button>
            </nav>
          ) : (
            <span className="rounded-lg bg-[linear-gradient(145deg,#438fff,#706af4)] px-3 py-1.5 text-white shadow-sm">
              1
            </span>
          )}
        </div>
      </section>

      {formConfig ? (
        <RecordFormModal
          key={`${editorMode}-${selectedRecord?.id ?? "new"}`}
          config={formConfig}
          getChoices={getChoices}
          loading={saving}
          mode={editorMode}
          record={selectedRecord}
          onClose={closeEditor}
          onSave={saveRecord}
        />
      ) : null}
      {slug === "articles" ? (
        <ArticleDetailModal
          article={
            (editorMode === "view"
              ? selectedRecord?.raw
              : null) as UserV1Article | null
          }
          onClose={closeEditor}
        />
      ) : slug === "publishing" ? (
        <PublishPlanDetailModal
          record={editorMode === "view" ? selectedRecord : null}
          articles={resourceSnapshot?.articles ?? []}
          publishChannels={resourceSnapshot?.publishChannels ?? []}
          onClose={closeEditor}
        />
      ) : (
        <RecordDetailModal
          columns={section.columns}
          record={editorMode === "view" ? selectedRecord : null}
          onClose={closeEditor}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`删除${section.title}记录`}
        description={`确认删除“${deleteTarget?.values[0] ?? ""}”吗？删除后当前页面会立即更新，此操作无法撤销。`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
      <Toast message={toast} />
    </div>
  );
}

function ActionLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: "edit" | "eye";
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#606068] transition hover:bg-white/70 hover:text-[#3478f6]"
    >
      <Icon name={icon} className="h-4 w-4" />
    </Link>
  );
}

function ActionButton({
  danger = false,
  icon,
  label,
  onClick,
}: {
  danger?: boolean;
  icon: "edit" | "eye" | "trash";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-[10px] transition ${danger ? "text-[#d85b50] hover:bg-[#fff0ed]/80" : "text-[#606068] hover:bg-white/70 hover:text-[#3478f6]"}`}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

function RecordFormModal({
  config,
  getChoices,
  loading,
  mode,
  onClose,
  onSave,
  record,
}: {
  config: ConsoleFormConfig;
  getChoices: ReturnType<typeof useConsoleData>["getChoices"];
  loading: boolean;
  mode: EditorMode;
  onClose: () => void;
  onSave: (values: ConsoleFormValue[]) => Promise<void>;
  record: ConsoleRecord | null;
}) {
  const [values, setValues] = useState(() => [
    ...(record?.formValues ?? config.defaults),
  ]);
  const open = mode === "create" || mode === "edit";
  const title =
    mode === "edit"
      ? `编辑 ${record?.values[0] ?? "记录"}`
      : config.createTitle;

  function updateValue(index: number, value: ConsoleFormValue) {
    setValues((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }

  function resolveOptions(field: ConsoleFormField): SelectChoice[] {
    if (field.dynamicOptionSource === "publishExecutor") {
      const category = Number(values[2]);
      if (category === 1) return getChoices("publishAccounts");
      if (category === 2) return getChoices("officialMediaPlatforms");
      if (category === 3) return getChoices("kolPlatforms");
      return [];
    }
    if (field.dynamicOptionSource === "geoExecutor") {
      return getChoices("geoExecutor");
    }
    if (field.dynamicOptionSource === "keywordsByBrand") {
      // GEO 监测：values[1] 是所属品牌，按品牌过滤关键词下拉
      const brandId = String(values[1] ?? "");
      return getChoices("keywords").filter(
        (item) => !brandId || item.brandId === brandId,
      );
    }
    if (field.dynamicOptionSource === "questionsByKeyword") {
      // GEO 监测：values[2] 是关键词，按关键词过滤问题库多选列表
      const keywordId = String(values[2] ?? "");
      return getChoices("questions").filter(
        (item) => !keywordId || item.keywordId === keywordId,
      );
    }
    return getChoices(field.optionSource);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(values);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={config.createDescription}
      size={config.modalSize}
    >
      <form onSubmit={handleSubmit} className="p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {config.fields
            .filter((field) => mode === "create" || !field.createOnly)
            .filter((field) => !field.visibleWhen || field.visibleWhen(values))
            .map((field) => (
              <FormField
                key={field.index}
                field={field}
                options={resolveOptions(field)}
                value={values[field.index] ?? ""}
                onChange={(value) => updateValue(field.index, value)}
              />
            ))}
        </div>
        <div className="mt-7 flex justify-end gap-3 border-t border-white/65 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="glass-control h-10 rounded-[13px] px-4 text-xs font-semibold text-[#55555c]"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded-[13px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-5 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(69,112,235,.22)]"
          >
            {loading ? "正在提交…" : mode === "edit" ? "保存修改" : "确认创建"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormField({
  field,
  onChange,
  options: dynamicOptions,
  value,
}: {
  field: ConsoleFormField;
  onChange: (value: ConsoleFormValue) => void;
  options: Array<{ label: string; value: string }>;
  value: ConsoleFormValue;
}) {
  const className = "input-control mt-2 min-h-11 rounded-[13px]";
  const label = (
    <>
      <span className="text-xs font-semibold text-[#4d4d54]">
        {field.label}
        {field.required ? (
          <em className="ml-1 not-italic text-[#df5c4f]">*</em>
        ) : null}
      </span>
      {field.helper ? (
        <span className="mt-1 block text-[10px] text-[#909097]">
          {field.helper}
        </span>
      ) : null}
    </>
  );

  if (field.type === "file") {
    return (
      <label className="block sm:col-span-2">
        {label}
        <span className="mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-[16px] border border-dashed border-[#9eb9e9] bg-white/38 px-4 text-center transition hover:bg-white/58">
          <Icon name="download" className="h-5 w-5 text-[#3478f6]" />
          <span className="mt-2 text-xs font-medium text-[#4d4d54]">
            {String(value || "点击选择文件")}
          </span>
          <span className="mt-1 text-[10px] text-[#909097]">
            PDF、Word、Excel 或 ZIP
          </span>
          <input
            type="file"
            required={field.required && !value}
            className="sr-only"
            onChange={(event) => onChange(event.target.files?.[0]?.name ?? "")}
          />
        </span>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="block sm:col-span-2">
        {label}
        <textarea
          required={field.required}
          value={String(value)}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          rows={field.textareaRows ?? 4}
          className={`${className} w-full resize-y py-3`}
        />
      </label>
    );
  }

  if (field.type === "select") {
    const staticOptions = field.options ?? [];
    const options = [...dynamicOptions, ...staticOptions];
    if (
      value !== "" &&
      !options.some((option) => String(option.value) === String(value))
    ) {
      options.push({ label: String(value), value: String(value) });
    }
    return (
      <label className="block">
        {label}
        <select
          required={field.required}
          value={String(value)}
          onChange={(event) => {
            const raw = event.target.value;
            // 仅当 option value 为数字字符串时才转 Number，否则保持字符串（如 per_platform）
            const isNumeric = raw !== "" && !Number.isNaN(Number(raw));
            onChange(isNumeric ? Number(raw) : raw);
          }}
          className={`${className} w-full`}
        >
          <option value="" disabled>
            请选择
          </option>
          {options.map((option, index) => (
            <option key={`${option.value}-${index}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "multiSelect") {
    const staticOptions = field.options ?? [];
    const options = [...dynamicOptions, ...staticOptions];
    const selectedValues = Array.isArray(value)
      ? (value as string[])
      : value !== ""
        ? [String(value)]
        : [];
    function toggleMultiSelectValue(optionValue: string) {
      const next = selectedValues.includes(optionValue)
        ? selectedValues.filter((item) => item !== optionValue)
        : [...selectedValues, optionValue];
      onChange(next);
    }
    return (
      <div className="block sm:col-span-2">
        <span>{label}</span>
        <div className="mt-2 max-h-44 overflow-y-auto rounded-[13px] border border-[#9eb9e9] bg-white/38 p-2">
          {options.length === 0 ? (
            <span className="block px-3 py-2 text-xs text-[#909097]">
              暂无可选项
            </span>
          ) : (
            options.map((option, index) => {
              const checked = selectedValues.includes(String(option.value));
              return (
                <label
                  key={`${option.value}-${index}`}
                  className="flex cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-xs text-[#4d4d54] hover:bg-white/60"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      toggleMultiSelectValue(String(option.value))
                    }
                    className="h-4 w-4 rounded border-[#9eb9e9] accent-[#3f8fff]"
                  />
                  <span className="font-medium">{option.label}</span>
                </label>
              );
            })
          )}
        </div>
        {selectedValues.length > 0 ? (
          <span className="mt-1 block text-[10px] text-[#909097]">
            已选 {selectedValues.length} 项
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <label className="block">
      {label}
      <input
        required={field.required}
        type={field.type ?? "text"}
        value={String(value)}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`${className} w-full`}
      />
    </label>
  );
}

function RecordDetailModal({
  columns,
  onClose,
  record,
}: {
  columns: string[];
  onClose: () => void;
  record: ConsoleRecord | null;
}) {
  return (
    <Modal
      open={Boolean(record)}
      onClose={onClose}
      title={record?.values[0] ?? "记录详情"}
      description="查看当前记录的完整业务信息。"
    >
      <dl className="grid gap-px bg-white/50 sm:grid-cols-2">
        {record?.values.map((value, index) => (
          <div
            key={`${record.id}-${columns[index]}`}
            className="bg-white/35 p-5"
          >
            <dt className="text-[11px] font-medium text-[#85858c]">
              {columns[index]}
            </dt>
            <dd className="mt-2 text-sm font-medium leading-6 text-[#35353b]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex justify-end p-5">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-[13px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-5 text-xs font-semibold text-white"
        >
          关闭
        </button>
      </div>
    </Modal>
  );
}

function PublishPlanDetailModal({
  articles,
  onClose,
  publishChannels,
  record,
}: {
  articles: UserV1Article[];
  onClose: () => void;
  publishChannels: UserV1CatalogItem[];
  record: ConsoleRecord | null;
}) {
  const [tasks, setTasks] = useState<UserV1PublishTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = record?.raw as UserV1PublishPlan | null;

  useEffect(() => {
    if (!record) {
      setTasks([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    userApi.publishTask
      .getPublishPlan(record.id)
      .then((detail) => {
        setTasks(detail.tasks ?? []);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "加载任务列表失败");
      })
      .finally(() => setLoading(false));
  }, [record]);

  const articleNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of articles) {
      if (a.id) map[String(a.id)] = a.title || `文章 #${a.id}`;
    }
    return map;
  }, [articles]);

  const channelMap = useMemo(() => {
    const map: Record<string, UserV1CatalogItem> = {};
    for (const c of publishChannels) {
      if (c.id) map[String(c.id)] = c;
    }
    return map;
  }, [publishChannels]);

  const isSuccess = (status?: string) =>
    status === "succeeded" || status === "published" || status === "completed";
  const isFailed = (status?: string) =>
    status === "failed" || status === "error";

  const taskColumns = [
    {
      key: "article",
      title: "文章",
      render: (t: UserV1PublishTask) => (
        <span className="text-[#35353b]">
          {articleNames[String(t.articleId ?? "")] ||
            plan?.articleTitle ||
            `文章 #${t.articleId || "-"}`}
        </span>
      ),
    },
    {
      key: "channel",
      title: "渠道",
      render: (t: UserV1PublishTask) => {
        const ch = channelMap[String(t.publishChannelId ?? "")];
        const name = ch?.name || `渠道 #${t.publishChannelId || "-"}`;
        const icon = ch?.icon;
        return (
          <span className="flex items-center gap-1.5 text-[#35353b]">
            {icon ? (
              <img
                src={icon}
                alt=""
                className="h-4 w-4 rounded object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Icon name="send" className="h-3.5 w-3.5 text-[#85858c]" />
            )}
            <span className="text-[12px]">{name}</span>
          </span>
        );
      },
    },
    {
      key: "status",
      title: "状态",
      render: (t: UserV1PublishTask) => {
        if (isSuccess(t.status)) {
          return (
            <span className="inline-flex items-center rounded-full bg-[#e8f7ee] px-2.5 py-0.5 text-[11px] font-medium text-[#1a9d4a]">
              发布成功
            </span>
          );
        }
        if (isFailed(t.status)) {
          return (
            <span className="inline-flex items-center rounded-full bg-[#fff0ed] px-2.5 py-0.5 text-[11px] font-medium text-[#d65a50]">
              失败
            </span>
          );
        }
        return (
          <span className="inline-flex items-center rounded-full bg-[#f0f0f5] px-2.5 py-0.5 text-[11px] font-medium text-[#707078]">
            {statusLabel(t.status)}
          </span>
        );
      },
    },
    {
      key: "result",
      title: "结果链接",
      render: (t: UserV1PublishTask) =>
        isSuccess(t.status) && t.resultUrl ? (
          <a
            href={t.resultUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3478f6] underline hover:opacity-80"
          >
            查看原文
          </a>
        ) : (
          <span className="text-[#c8c8ce]">-</span>
        ),
    },
  ];

  return (
    <Modal
      open={Boolean(record)}
      onClose={onClose}
      title={record?.values[0] ?? "投放计划详情"}
      description={
        plan
          ? `${plan.articleCount || 0} 篇文章 × ${plan.platformCount || 0} 个平台 · ${plan.succeededCount || 0}/${plan.taskCount || 0} 成功`
          : "查看投放计划下的任务执行状态。"
      }
      size="lg"
    >
      <div className="p-5 sm:p-6">
        {loading ? (
          <p className="py-8 text-center text-sm text-[#909097]">
            正在加载任务列表…
          </p>
        ) : error ? (
          <p className="rounded-[14px] bg-[#fff0ed]/75 px-4 py-3 text-xs text-[#d65a50]">
            {error}
          </p>
        ) : tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#909097]">
            暂无投放任务
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr>
                  {taskColumns.map((col) => (
                    <th
                      key={col.key}
                      className="border-b border-white/70 px-4 py-3 text-[11px] font-semibold text-[#7f7f87]"
                    >
                      {col.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/55">
                {tasks.map((task) => (
                  <tr key={task.id}>
                    {taskColumns.map((col) => (
                      <td
                        key={`${task.id}-${col.key}`}
                        className="whitespace-nowrap px-4 py-3 text-[12px] text-[#707078]"
                      >
                        {col.render(task)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex justify-end border-t border-white/65 p-5">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-[13px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-5 text-xs font-semibold text-white"
        >
          关闭
        </button>
      </div>
    </Modal>
  );
}
