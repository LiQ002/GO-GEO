"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "@/components/ui/icon";
import {
  CONSOLE_PAGE_SIZE,
  type ResourcePage,
} from "@/lib/api/console-resources";
import {
  type UserV1Keyword,
  type UserV1Question,
  userApi,
} from "@/lib/api/user-api.generated";
import { createClientID } from "@/lib/client-id";
import {
  KeywordDistillationStatus,
  keywordDistillationStatusOptions,
  type NumericOption,
  optionLabel,
  QuestionFunnel,
  QuestionIntent,
  QuestionStatus,
  questionFunnelOptions,
  questionIntentOptions,
} from "@/lib/user-enums";
import { useConsoleData } from "./console-data-provider";
import { ConfirmDialog, Modal, Toast } from "./modal";

type KeywordEditor = { keyword: UserV1Keyword | null; mode: "create" | "edit" };

const questionUsageStatusOptions = [
  { label: "待审核", value: QuestionStatus.pending },
  { label: "可用", value: QuestionStatus.approved },
  { label: "不可用", value: QuestionStatus.rejected },
];

export function KeywordWorkspace() {
  const {
    getChoices,
    getRecords,
    getResourcePage,
    loadRecordPage,
    refreshResources,
    resourceError,
    resourceLoading,
    resourcePageLoading,
    resourceSnapshot,
  } = useConsoleData();
  const keywords = useMemo(
    () =>
      getRecords("keywords").flatMap((record) =>
        record.raw ? [record.raw as UserV1Keyword] : [],
      ),
    [getRecords],
  );
  const keywordPage = getResourcePage("keywords");
  const allQuestions = resourceSnapshot?.questions ?? [];
  const brands = getChoices("brands");

  const [selectedKeywordID, setSelectedKeywordID] = useState("");
  const [query, setQuery] = useState("");
  const [keywordPageIndex, setKeywordPageIndex] = useState(0);
  const [keywordPageTokens, setKeywordPageTokens] = useState([""]);
  const [questions, setQuestions] = useState<UserV1Question[]>([]);
  const [questionPage, setQuestionPage] = useState<ResourcePage | null>(null);
  const [questionPageIndex, setQuestionPageIndex] = useState(0);
  const [questionPageTokens, setQuestionPageTokens] = useState([""]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const previousQueryRef = useRef("");
  const [keywordEditor, setKeywordEditor] = useState<KeywordEditor | null>(
    null,
  );
  const [distilling, setDistilling] = useState<UserV1Keyword | null>(null);
  const [manualAdding, setManualAdding] = useState<UserV1Keyword | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<UserV1Question | null>(
    null,
  );
  const [deletingKeyword, setDeletingKeyword] = useState<UserV1Keyword | null>(
    null,
  );
  const [deletingQuestion, setDeletingQuestion] =
    useState<UserV1Question | null>(null);
  const [busyID, setBusyID] = useState("");
  const [selectedQuestionIDs, setSelectedQuestionIDs] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const selectedKeywordExists = keywords.some(
    (item) => String(item.id) === selectedKeywordID,
  );
  const firstKeywordID = String(keywords[0]?.id || "");
  useEffect(() => {
    if (selectedKeywordID && selectedKeywordExists) return;
    setSelectedKeywordID(firstKeywordID);
  }, [firstKeywordID, selectedKeywordExists, selectedKeywordID]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const brandNames = useMemo(
    () => new Map(brands.map((item) => [item.value, item.label])),
    [brands],
  );
  const filteredKeywords = keywords;
  const selectedKeyword = keywords.find(
    (item) => String(item.id) === selectedKeywordID,
  );
  const selectedQuestions = questions;
  const selectedQuestionIDSet = useMemo(
    () => new Set(selectedQuestionIDs),
    [selectedQuestionIDs],
  );
  const allQuestionsSelected =
    selectedQuestions.length > 0 &&
    selectedQuestions.every((item) =>
      selectedQuestionIDSet.has(String(item.id)),
    );

  useEffect(() => {
    if (selectedKeywordID) setSelectedQuestionIDs([]);
  }, [selectedKeywordID]);

  useEffect(() => {
    const available = new Set(selectedQuestions.map((item) => String(item.id)));
    setSelectedQuestionIDs((current) =>
      current.filter((id) => available.has(id)),
    );
  }, [selectedQuestions]);
  const completedCount = keywords.filter(
    (item) => item.distillationStatus === KeywordDistillationStatus.completed,
  ).length;
  const keywordIDs = new Set(
    (resourceSnapshot?.keywords ?? []).map((item) => String(item.id)),
  );
  const totalQuestions = allQuestions.filter(
    (item) =>
      item.status === QuestionStatus.approved &&
      keywordIDs.has(String(item.keywordId)),
  ).length;

  const keywordTotalPages = Math.max(
    1,
    Math.ceil((keywordPage?.totalSize ?? 0) / CONSOLE_PAGE_SIZE),
  );
  const questionTotalPages = Math.max(
    1,
    Math.ceil((questionPage?.totalSize ?? 0) / CONSOLE_PAGE_SIZE),
  );

  const loadQuestions = useCallback(
    async (keywordID: string, pageToken = "") => {
      if (!keywordID) {
        setQuestions([]);
        setQuestionPage(null);
        return true;
      }
      setQuestionsLoading(true);
      try {
        const reply = await userApi.question.listQuestions({
          keywordId: keywordID,
          pageSize: CONSOLE_PAGE_SIZE,
          pageToken,
        });
        setQuestions(reply.items ?? []);
        setQuestionPage({
          nextPageToken: reply.nextPageToken || "",
          pageSize: CONSOLE_PAGE_SIZE,
          pageToken,
          totalSize: Number(reply.totalSize || 0),
        });
        return true;
      } catch (caught) {
        setQuestions([]);
        setToast(caught instanceof Error ? caught.message : "问题列表加载失败");
        return false;
      } finally {
        setQuestionsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setQuestionPageIndex(0);
    setQuestionPageTokens([""]);
    void loadQuestions(selectedKeywordID);
  }, [loadQuestions, selectedKeywordID]);

  useEffect(() => {
    if (previousQueryRef.current === query) return;
    const timer = window.setTimeout(() => {
      previousQueryRef.current = query;
      setKeywordPageIndex(0);
      setKeywordPageTokens([""]);
      void loadRecordPage("keywords", {
        keyword: query.trim(),
        pageSize: CONSOLE_PAGE_SIZE,
        pageToken: "",
      }).catch(() => undefined);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [loadRecordPage, query]);

  async function changeKeywordPage(direction: "next" | "previous") {
    if (!keywordPage || resourcePageLoading) return;
    const targetIndex =
      direction === "next" ? keywordPageIndex + 1 : keywordPageIndex - 1;
    if (targetIndex < 0 || targetIndex >= keywordTotalPages) return;
    const pageToken =
      direction === "next"
        ? keywordPage.nextPageToken
        : keywordPageTokens[targetIndex];
    if (!pageToken && direction === "next") return;
    try {
      await loadRecordPage("keywords", {
        keyword: query.trim(),
        pageSize: CONSOLE_PAGE_SIZE,
        pageToken,
      });
      setKeywordPageIndex(targetIndex);
      if (direction === "next") {
        setKeywordPageTokens((current) => {
          const next = current.slice(0, targetIndex);
          next[targetIndex] = pageToken;
          return next;
        });
      }
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "关键词分页加载失败");
    }
  }

  async function changeQuestionPage(direction: "next" | "previous") {
    if (!questionPage || questionsLoading) return;
    const targetIndex =
      direction === "next" ? questionPageIndex + 1 : questionPageIndex - 1;
    if (targetIndex < 0 || targetIndex >= questionTotalPages) return;
    const pageToken =
      direction === "next"
        ? questionPage.nextPageToken
        : questionPageTokens[targetIndex];
    if (!pageToken && direction === "next") return;
    const loaded = await loadQuestions(selectedKeywordID, pageToken);
    if (!loaded) return;
    setQuestionPageIndex(targetIndex);
    if (direction === "next") {
      setQuestionPageTokens((current) => {
        const next = current.slice(0, targetIndex);
        next[targetIndex] = pageToken;
        return next;
      });
    }
  }

  async function run(
    id: string,
    action: () => Promise<unknown>,
    message: string,
  ) {
    setBusyID(id);
    try {
      await action();
      await refreshResources();
      if (selectedKeywordID) {
        await loadQuestions(selectedKeywordID, questionPage?.pageToken || "");
      }
      setToast(message);
      return true;
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "操作失败");
      return false;
    } finally {
      setBusyID("");
    }
  }

  async function saveKeyword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!keywordEditor) return;
    const form = new FormData(event.currentTarget);
    const text = String(form.get("text") || "").trim();
    const brandID = String(form.get("brandId") || "");
    const region = String(form.get("region") || "").trim();
    const priority = Number(form.get("priority")) || 0;
    if (!text || !brandID) {
      setToast("请填写关键词并选择所属品牌");
      return;
    }

    if (keywordEditor.mode === "create") {
      setBusyID("keyword-create");
      try {
        const keyword = await userApi.keyword.createKeyword({
          keyword: {
            brandId: brandID,
            priority,
            region,
            source: "manual",
            status: "active",
            tagsJson: "[]",
            text,
          },
        });
        await refreshResources();
        setSelectedKeywordID(String(keyword.id || ""));
        setKeywordEditor(null);
        setToast("关键词已添加，请点击“蒸馏问题”配置数量并执行");
      } catch (caught) {
        setToast(caught instanceof Error ? caught.message : "添加关键词失败");
      } finally {
        setBusyID("");
      }
      return;
    }

    const current = keywordEditor.keyword;
    if (!current?.id) return;
    const saved = await run(
      String(current.id),
      () =>
        userApi.keyword.updateKeyword(String(current.id), {
          keyword: {
            ...current,
            brandId: brandID,
            priority,
            region,
            text,
          },
        }),
      "关键词已更新",
    );
    if (saved) setKeywordEditor(null);
  }

  async function distillQuestions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!distilling?.id) return;
    const form = new FormData(event.currentTarget);
    const count = Number(form.get("questionCount"));
    const region = String(form.get("region") || "").trim();
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      setToast("蒸馏问题数量必须是 1–100 之间的整数");
      return;
    }

    const keywordID = String(distilling.id);
    setBusyID(`distill-${keywordID}`);
    try {
      const task = await userApi.keyword.distillKeywordQuestions(keywordID, {
        clientRequestId: createClientID(),
        keywordId: keywordID,
        questionCount: count,
        region,
      });
      if (task.status === KeywordDistillationStatus.failed) {
        setToast(task.errorMessage || "问题蒸馏失败，请检查模型配置");
        return;
      }
      setDistilling(null);
      setToast(`正在后台蒸馏 ${count} 个问题，完成后自动刷新…`);
      const maxAttempts = 60;
      const interval = 3000;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, interval));
        const target = await userApi.keyword.getKeyword(keywordID);
        const status = target.distillationStatus;
        if (status === KeywordDistillationStatus.completed) {
          await Promise.all([refreshResources(), loadQuestions(keywordID)]);
          setSelectedKeywordID(keywordID);
          setToast(`已蒸馏完成 ${count} 个问题，可用于文章生成和 GEO 监测`);
          return;
        }
        if (status === KeywordDistillationStatus.failed) {
          await refreshResources();
          setToast(target.distillationError || "问题蒸馏失败，请检查模型配置");
          return;
        }
      }
      await Promise.all([refreshResources(), loadQuestions(keywordID)]);
      setToast("蒸馏仍在进行中，请稍后刷新页面查看结果");
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "问题蒸馏失败");
    } finally {
      setBusyID("");
    }
  }
  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingQuestion?.id) return;
    const form = new FormData(event.currentTarget);
    const id = String(editingQuestion.id);
    const saved = await run(
      id,
      () =>
        userApi.question.updateQuestion(id, {
          question: {
            ...editingQuestion,
            audience: String(form.get("audience") || "").trim(),
            funnelStage:
              Number(form.get("funnelStage")) || QuestionFunnel.consideration,
            intent: Number(form.get("intent")) || QuestionIntent.research,
            priority: Number(form.get("priority")) || 0,
            status:
              Number(form.get("status")) ||
              editingQuestion.status ||
              QuestionStatus.pending,
            text: String(form.get("text") || "").trim(),
          },
        }),
      "问题已更新",
    );
    if (saved) setEditingQuestion(null);
  }

  async function createManualQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualAdding?.id) return;
    const form = new FormData(event.currentTarget);
    // 支持textarea多行批量录入：每行一个问题
    const raw = String(form.get("text") || "");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setToast("请填写问题内容");
      return;
    }
    const keywordID = String(manualAdding.id);
    const brandID = String(manualAdding.brandId || "");
    const region = String(form.get("region") || "").trim();
    const intent = Number(form.get("intent")) || QuestionIntent.research;
    const funnelStage =
      Number(form.get("funnelStage")) || QuestionFunnel.consideration;
    const status = Number(form.get("status")) || QuestionStatus.pending;
    setBusyID(`manual-${keywordID}`);
    try {
      const results = await Promise.allSettled(
        lines.map((text) =>
          userApi.question.createQuestion({
            question: {
              brandId: brandID,
              funnelStage,
              intent,
              keywordId: keywordID,
              priority: 0,
              region,
              source: 1, // 手工创建
              status,
              text,
            },
          }),
        ),
      );
      await Promise.all([refreshResources(), loadQuestions(keywordID)]);
      const failed = results.filter((r) => r.status === "rejected");
      const success = results.length - failed.length;
      if (failed.length === 0) {
        setToast(`已添加 ${success} 个问题`);
        setManualAdding(null);
      } else if (success === 0) {
        setToast("添加失败，请检查内容或重试");
      } else {
        setToast(`已添加 ${success} 个，${failed.length} 个失败`);
      }
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "添加问题失败");
    } finally {
      setBusyID("");
    }
  }

  async function deleteSelectedKeyword() {
    if (!deletingKeyword?.id) return;
    const id = String(deletingKeyword.id);
    const deleted = await run(
      id,
      () =>
        userApi.keyword.deleteKeyword(id, {
          version: String(deletingKeyword.version || ""),
        }),
      "关键词已删除",
    );
    if (deleted) {
      setDeletingKeyword(null);
      setSelectedKeywordID("");
    }
  }

  async function deleteSelectedQuestion() {
    if (!deletingQuestion?.id) return;
    const id = String(deletingQuestion.id);
    const deleted = await run(
      id,
      () =>
        userApi.question.deleteQuestion(id, {
          version: deletingQuestion.version,
        }),
      "问题已删除",
    );
    if (deleted) setDeletingQuestion(null);
  }

  function toggleQuestion(questionID: string) {
    setSelectedQuestionIDs((current) =>
      current.includes(questionID)
        ? current.filter((id) => id !== questionID)
        : [...current, questionID],
    );
  }

  function toggleAllQuestions() {
    setSelectedQuestionIDs(
      allQuestionsSelected
        ? []
        : selectedQuestions.map((item) => String(item.id)),
    );
  }

  async function updateSelectedQuestionStatus(status: number) {
    const targets = selectedQuestions.filter(
      (question) =>
        selectedQuestionIDSet.has(String(question.id)) &&
        question.status !== status,
    );
    if (targets.length === 0) {
      setToast(
        selectedQuestionIDs.length > 0
          ? `所选问题已经是“${questionStatusLabel(status)}”状态`
          : "请先选择需要调整状态的问题",
      );
      return;
    }

    setBusyID("questions-status");
    try {
      const results = await Promise.allSettled(
        targets.map((question) =>
          userApi.question.updateQuestion(String(question.id), {
            question: { ...question, status },
          }),
        ),
      );
      await Promise.all([
        refreshResources(),
        loadQuestions(selectedKeywordID, questionPage?.pageToken || ""),
      ]);
      const failedIDs = results.flatMap((result, index) =>
        result.status === "rejected" ? [String(targets[index].id)] : [],
      );
      const successCount = targets.length - failedIDs.length;
      setSelectedQuestionIDs(failedIDs);
      setToast(
        failedIDs.length
          ? `已更新 ${successCount} 个，${failedIDs.length} 个更新失败并已保留选择`
          : `已将 ${successCount} 个问题设为“${questionStatusLabel(status)}”`,
      );
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "批量更新状态失败");
    } finally {
      setBusyID("");
    }
  }

  return (
    <div>
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3478f6]">
            <Icon name="target" className="h-4 w-4" />
            企业内容增长
          </div>
          <h1 className="mt-2 text-[27px] font-semibold tracking-[-.04em]">
            关键词与问题
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#717179]">
            左侧选择关键词，右侧管理该关键词蒸馏出的全部问题；新问题默认为待审核，设为可用后才能进入文章生成与
            GEO 监测。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setKeywordEditor({ keyword: null, mode: "create" })}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(69,112,235,.24),inset_0_1px_0_rgba(255,255,255,.28)] transition hover:-translate-y-0.5"
        >
          <Icon name="plus" className="h-4 w-4" />
          添加关键词
        </button>
      </header>

      {resourceError ? (
        <p className="mt-5 rounded-[14px] bg-[#fff0ed]/75 px-4 py-3 text-xs text-[#d65a50]">
          {resourceError}
        </p>
      ) : null}

      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {[
          [
            "关键词",
            keywordPage?.totalSize ?? keywords.length,
            "当前企业关键词",
          ],
          ["已完成蒸馏", completedCount, "当前页已完成蒸馏"],
          ["可用问题", totalQuestions, "已启用，可用于创作与监测"],
        ].map(([label, value, note]) => (
          <article key={label} className="console-card p-5">
            <p className="text-xs font-medium text-[#71848a]">{label}</p>
            <strong className="mt-3 block text-[28px] font-semibold tracking-[-.045em]">
              {value}
            </strong>
            <p className="mt-2 text-[11px] font-medium text-[#3478f6]">
              {note}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid min-h-[600px] gap-5 xl:grid-cols-[minmax(390px,.85fr)_minmax(600px,1.35fr)]">
        <section className="console-card overflow-hidden">
          <div className="border-b border-white/70 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">关键词主表</h2>
                <p className="mt-1 text-[11px] text-[#859398]">
                  选择一行后，右侧切换对应问题
                </p>
              </div>
              <span className="rounded-full bg-white/55 px-3 py-1 text-[10px] text-[#67767b]">
                当前页 {filteredKeywords.length} 条
              </span>
            </div>
            <label className="glass-control mt-4 flex h-10 items-center gap-2 rounded-[13px] px-3 text-[#85858c]">
              <Icon name="search" className="h-4 w-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索关键词"
                className="min-w-0 flex-1 bg-transparent text-xs text-[#3a3a40] outline-none"
              />
            </label>
          </div>

          <div className="max-h-[620px] overflow-y-auto">
            {filteredKeywords.map((keyword) => {
              const id = String(keyword.id || "");
              const selected = selectedKeywordID === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedKeywordID(id)}
                  className={`block w-full border-b border-white/55 p-4 text-left transition ${selected ? "bg-[#eaf1ff]/75 shadow-[inset_3px_0_0_#5f7fea]" : "hover:bg-white/32"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#34343a]">
                        {keyword.text}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-[#808b8f]">
                        {brandNames.get(String(keyword.brandId)) ||
                          `品牌 #${keyword.brandId}`}
                        {" · "}
                        {keyword.region || "不限区域"}
                      </p>
                    </div>
                    <StatusBadge status={keyword.distillationStatus} />
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-3">
                    <span className="text-[10px] text-[#9aa4a8]">
                      {formatDateTime(keyword.updatedAt)}
                    </span>
                  </div>
                </button>
              );
            })}
            {!resourceLoading && filteredKeywords.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <Icon
                  name="target"
                  className="mx-auto h-8 w-8 text-[#9eb1d8]"
                />
                <p className="mt-4 text-sm font-medium">暂无关键词</p>
                <p className="mt-2 text-xs text-[#8a969a]">
                  添加关键词后，再通过蒸馏按钮生成问题。
                </p>
              </div>
            ) : null}
          </div>
          <PaginationFooter
            currentPage={keywordPageIndex + 1}
            loading={resourcePageLoading}
            nextDisabled={!keywordPage?.nextPageToken}
            onNext={() => void changeKeywordPage("next")}
            onPrevious={() => void changeKeywordPage("previous")}
            pageSize={CONSOLE_PAGE_SIZE}
            totalPages={keywordTotalPages}
            totalSize={keywordPage?.totalSize ?? keywords.length}
          />
        </section>

        <section className="console-card overflow-hidden">
          {selectedKeyword ? (
            <>
              <div className="border-b border-white/70 p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-[10px] font-bold tracking-[.14em] text-[#3478f6]">
                      当前关键词
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">
                      {selectedKeyword.text}
                    </h2>
                    <p className="mt-2 text-xs text-[#7c898d]">
                      {brandNames.get(String(selectedKeyword.brandId)) ||
                        `品牌 #${selectedKeyword.brandId}`}
                      {" · "}
                      {selectedKeyword.region || "不限区域"}
                    </p>
                  </div>
                  <div className="flex flex-nowrap gap-2">
                    <button
                      type="button"
                      onClick={() => setManualAdding(selectedKeyword)}
                      className="glass-control h-10 shrink-0 rounded-[13px] px-4 text-xs font-semibold"
                    >
                      <Icon
                        name="plus"
                        className="mr-1 inline h-4 w-4 align-[-2px]"
                      />
                      手动添加
                    </button>
                    <button
                      type="button"
                      onClick={() => setDistilling(selectedKeyword)}
                      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[13px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-4 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(69,112,235,.22)]"
                    >
                      <Icon name="sparkles" className="h-4 w-4" />
                      蒸馏问题
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setKeywordEditor({
                          keyword: selectedKeyword,
                          mode: "edit",
                        })
                      }
                      className="glass-control h-10 shrink-0 rounded-[13px] px-4 text-xs font-semibold"
                    >
                      编辑关键词
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingKeyword(selectedKeyword)}
                      className="glass-control h-10 shrink-0 rounded-[13px] px-4 text-xs font-semibold text-[#d85842]"
                    >
                      删除
                    </button>
                  </div>
                </div>

                {selectedKeyword.distillationStatus ===
                KeywordDistillationStatus.failed ? (
                  <div className="mt-4 rounded-[14px] border border-[#f0c8c0]/70 bg-[#fff0ed]/70 px-4 py-3 text-xs text-[#a35348]">
                    上次蒸馏失败：
                    {selectedKeyword.distillationError ||
                      "请检查问题蒸馏模型配置后重试"}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 border-b border-white/70 bg-white/20 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#55555c]">
                  <input
                    type="checkbox"
                    checked={allQuestionsSelected}
                    onChange={toggleAllQuestions}
                    className="h-4 w-4 accent-[#5f7fea]"
                  />
                  全选当前问题
                  <span className="font-normal text-[#8a969a]">
                    已选 {selectedQuestionIDs.length} /{" "}
                    {selectedQuestions.length}
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <StatusActionButton
                    label="设为可用"
                    tone="success"
                    disabled={
                      selectedQuestionIDs.length === 0 ||
                      busyID === "questions-status"
                    }
                    onClick={() =>
                      void updateSelectedQuestionStatus(QuestionStatus.approved)
                    }
                  />
                  <StatusActionButton
                    label="设为待审核"
                    tone="pending"
                    disabled={
                      selectedQuestionIDs.length === 0 ||
                      busyID === "questions-status"
                    }
                    onClick={() =>
                      void updateSelectedQuestionStatus(QuestionStatus.pending)
                    }
                  />
                  <StatusActionButton
                    label="设为不可用"
                    tone="danger"
                    disabled={
                      selectedQuestionIDs.length === 0 ||
                      busyID === "questions-status"
                    }
                    onClick={() =>
                      void updateSelectedQuestionStatus(QuestionStatus.rejected)
                    }
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left">
                  <thead>
                    <tr className="text-[11px] text-[#7f7f87]">
                      <th className="w-12 border-b border-white/70 px-5 py-3">
                        <span className="sr-only">选择</span>
                      </th>
                      {[
                        "蒸馏问题",
                        "区域",
                        "用户意图",
                        "漏斗阶段",
                        "用途",
                        "操作",
                      ].map((label) => (
                        <th
                          key={label}
                          className="border-b border-white/70 px-5 py-3 font-semibold"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/55">
                    {selectedQuestions.map((question) => (
                      <tr key={question.id}>
                        <td className="px-5 py-4">
                          <input
                            type="checkbox"
                            aria-label={`选择问题：${question.text || question.id}`}
                            checked={selectedQuestionIDSet.has(
                              String(question.id),
                            )}
                            onChange={() => toggleQuestion(String(question.id))}
                            className="h-4 w-4 accent-[#5f7fea]"
                          />
                        </td>
                        <td className="max-w-[330px] whitespace-normal px-5 py-4 text-xs font-medium leading-5">
                          {question.text}
                        </td>
                        <td className="px-5 py-4 text-xs text-[#707078]">
                          {question.region || "不限区域"}
                        </td>
                        <td className="px-5 py-4 text-xs text-[#707078]">
                          {optionLabel(questionIntentOptions, question.intent)}
                        </td>
                        <td className="px-5 py-4 text-xs text-[#707078]">
                          {optionLabel(
                            questionFunnelOptions,
                            question.funnelStage,
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs">
                          {(() => {
                            const availability = questionAvailability(
                              question.status,
                            );
                            return (
                              <span
                                className={`rounded-full px-2.5 py-1 font-medium ${availability.className}`}
                              >
                                {availability.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex gap-1">
                            <SmallButton
                              label="编辑"
                              onClick={() => setEditingQuestion(question)}
                            />
                            <SmallButton
                              label="删除"
                              danger
                              onClick={() => setDeletingQuestion(question)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {selectedQuestions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-5 py-20 text-center text-xs text-[#92929a]"
                        >
                          该关键词还没有问题，点击右上角“蒸馏问题”，配置数量后执行。
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <PaginationFooter
                currentPage={questionPageIndex + 1}
                loading={questionsLoading}
                nextDisabled={!questionPage?.nextPageToken}
                onNext={() => void changeQuestionPage("next")}
                onPrevious={() => void changeQuestionPage("previous")}
                pageSize={CONSOLE_PAGE_SIZE}
                totalPages={questionTotalPages}
                totalSize={questionPage?.totalSize ?? selectedQuestions.length}
              />
            </>
          ) : (
            <div className="flex min-h-[500px] flex-col items-center justify-center px-6 text-center">
              <Icon name="sparkles" className="h-10 w-10 text-[#9eb1d8]" />
              <h2 className="mt-5 text-lg font-semibold">选择一个关键词</h2>
              <p className="mt-2 text-xs leading-6 text-[#8a969a]">
                左侧选择关键词后，这里会显示对应的蒸馏问题和操作。
              </p>
            </div>
          )}
        </section>
      </div>

      <KeywordModal
        editor={keywordEditor}
        brands={brands}
        busy={
          busyID === "keyword-create" ||
          (!!selectedKeywordID && busyID === selectedKeywordID)
        }
        onClose={() => setKeywordEditor(null)}
        onSubmit={saveKeyword}
      />
      <DistillationModal
        keyword={distilling}
        busy={busyID === `distill-${distilling?.id}`}
        onClose={() => setDistilling(null)}
        onSubmit={distillQuestions}
      />
      <ManualQuestionModal
        keyword={manualAdding}
        busy={!!manualAdding?.id && busyID === `manual-${manualAdding.id}`}
        onClose={() => setManualAdding(null)}
        onSubmit={createManualQuestion}
      />
      <QuestionModal
        question={editingQuestion}
        busy={!!editingQuestion?.id && busyID === String(editingQuestion.id)}
        onClose={() => setEditingQuestion(null)}
        onSubmit={saveQuestion}
      />
      <ConfirmDialog
        open={Boolean(deletingKeyword)}
        title="删除关键词"
        description={`确认删除“${deletingKeyword?.text || "该关键词"}”吗？关联问题将不再出现在文章和监测选择中。`}
        onCancel={() => setDeletingKeyword(null)}
        onConfirm={() => void deleteSelectedKeyword()}
      />
      <ConfirmDialog
        open={Boolean(deletingQuestion)}
        title="删除蒸馏问题"
        description={`确认删除“${deletingQuestion?.text || "该问题"}”吗？删除后不能再用于文章生成或 GEO 监测。`}
        onCancel={() => setDeletingQuestion(null)}
        onConfirm={() => void deleteSelectedQuestion()}
      />
      <Toast message={toast} />
    </div>
  );
}

function KeywordModal({
  brands,
  busy,
  editor,
  onClose,
  onSubmit,
}: {
  brands: Array<{ label: string; value: string }>;
  busy: boolean;
  editor: KeywordEditor | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const keyword = editor?.keyword;
  return (
    <Modal
      open={Boolean(editor)}
      onClose={onClose}
      title={editor?.mode === "edit" ? "编辑关键词" : "添加关键词"}
      description="这里只保存关键词；保存后通过“蒸馏问题”按钮单独配置数量并执行。"
    >
      <form onSubmit={onSubmit} className="space-y-5 p-5 sm:p-6">
        <label className="block text-xs font-medium">
          关键词 *
          <input
            name="text"
            required
            defaultValue={keyword?.text}
            placeholder="例如：农夫山泉"
            className="input-control mt-2"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium">
            所属品牌 *
            <select
              name="brandId"
              required
              defaultValue={String(keyword?.brandId || brands[0]?.value || "")}
              className="input-control mt-2"
            >
              <option value="">请选择品牌</option>
              {brands.map((brand) => (
                <option key={brand.value} value={brand.value}>
                  {brand.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            默认区域（可选）
            <input
              name="region"
              defaultValue={keyword?.region}
              placeholder="例如：北京"
              className="input-control mt-2"
            />
          </label>
        </div>
        <label className="block text-xs font-medium">
          优先级
          <input
            name="priority"
            type="number"
            defaultValue={keyword?.priority || 50}
            min={0}
            max={100}
            className="input-control mt-2"
          />
        </label>
        <ModalActions busy={busy} onCancel={onClose} submitLabel="保存关键词" />
      </form>
    </Modal>
  );
}

function DistillationModal({
  busy,
  keyword,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  keyword: UserV1Keyword | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      open={Boolean(keyword)}
      onClose={onClose}
      title={`蒸馏问题 · ${keyword?.text || ""}`}
      description="配置本次生成数量和区域，提交后立即调用问题蒸馏模型；生成的问题无需审核。"
    >
      <form onSubmit={onSubmit} className="space-y-5 p-5 sm:p-6">
        <div className="rounded-[16px] border border-white/75 bg-[#eaf1ff]/65 p-4 text-xs leading-6 text-[#64738c]">
          本次操作会新增一批问题。建议首次生成 5–10
          个，后续可再次蒸馏扩充不同意图的问题。
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium">
            蒸馏问题数量 *
            <input
              name="questionCount"
              type="number"
              required
              min={1}
              max={100}
              step={1}
              defaultValue={keyword?.requestedQuestionCount || 5}
              className="input-control mt-2"
            />
            <span className="mt-1 block text-[10px] text-[#909097]">
              每次可生成 1–100 个问题
            </span>
          </label>
          <label className="block text-xs font-medium">
            本次目标区域（可选）
            <input
              name="region"
              defaultValue={keyword?.region}
              placeholder="不填写则生成通用问题"
              className="input-control mt-2"
            />
            <span className="mt-1 block text-[10px] text-[#909097]">
              可覆盖关键词保存的默认区域
            </span>
          </label>
        </div>
        <ModalActions busy={busy} onCancel={onClose} submitLabel="开始蒸馏" />
      </form>
    </Modal>
  );
}

function ManualQuestionModal({
  busy,
  keyword,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  keyword: UserV1Keyword | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      open={Boolean(keyword)}
      onClose={onClose}
      title={`手动添加问题 · ${keyword?.text || ""}`}
      description="可批量录入自定义长尾词问题，每行一个问题；保存后默认进入待审核，可在列表中设为可用。"
    >
      <form onSubmit={onSubmit} className="space-y-5 p-5 sm:p-6">
        <label className="block text-xs font-medium">
          问题内容 *
          <textarea
            name="text"
            required
            rows={6}
            placeholder={
              "每行一个问题，例如：\n农夫山泉和怡宝哪个好\n矿泉水品牌排名前十\n运动后喝什么水好，求推荐"
            }
            className="input-control mt-2 resize-none py-3 font-mono text-xs"
          />
          <span className="mt-1 block text-[10px] text-[#909097]">
            支持多行批量录入，每行一个问题
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            name="status"
            label="使用状态"
            value={QuestionStatus.pending}
            options={questionUsageStatusOptions}
          />
          <SelectField
            name="intent"
            label="用户意图"
            value={QuestionIntent.research}
            options={questionIntentOptions}
          />
          <SelectField
            name="funnelStage"
            label="漏斗阶段"
            value={QuestionFunnel.consideration}
            options={questionFunnelOptions}
          />
        </div>
        <label className="block text-xs font-medium">
          区域（可选）
          <input
            name="region"
            defaultValue={keyword?.region}
            placeholder="不填写则使用关键词默认区域"
            className="input-control mt-2"
          />
        </label>
        <ModalActions busy={busy} onCancel={onClose} submitLabel="添加问题" />
      </form>
    </Modal>
  );
}

function QuestionModal({
  busy,
  onClose,
  onSubmit,
  question,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  question: UserV1Question | null;
}) {
  return (
    <Modal
      open={Boolean(question)}
      onClose={onClose}
      title="编辑蒸馏问题"
      description="可同时调整问题内容与使用状态；只有“可用”问题会进入文章生成和 GEO 监测。"
    >
      {question ? (
        <form onSubmit={onSubmit} className="space-y-5 p-5 sm:p-6">
          <label className="block text-xs font-medium">
            问题内容 *
            <textarea
              name="text"
              required
              defaultValue={question.text}
              rows={4}
              className="input-control mt-2 resize-none py-3"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              name="status"
              label="使用状态"
              value={question.status || QuestionStatus.pending}
              options={questionUsageStatusOptions}
            />
            <SelectField
              name="intent"
              label="用户意图"
              value={question.intent || QuestionIntent.research}
              options={questionIntentOptions}
            />
            <SelectField
              name="funnelStage"
              label="漏斗阶段"
              value={question.funnelStage || QuestionFunnel.consideration}
              options={questionFunnelOptions}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium">
              目标受众
              <input
                name="audience"
                defaultValue={question.audience}
                className="input-control mt-2"
              />
            </label>
            <label className="block text-xs font-medium">
              优先级
              <input
                name="priority"
                type="number"
                defaultValue={question.priority || 0}
                className="input-control mt-2"
              />
            </label>
          </div>
          <ModalActions busy={busy} onCancel={onClose} submitLabel="保存修改" />
        </form>
      ) : null}
    </Modal>
  );
}

function ModalActions({
  busy,
  onCancel,
  submitLabel,
}: {
  busy: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 border-t border-white/65 pt-5">
      <button
        type="button"
        onClick={onCancel}
        className="glass-control h-10 rounded-[13px] px-4 text-xs font-semibold"
      >
        取消
      </button>
      <button
        type="submit"
        disabled={busy}
        className="h-10 rounded-[13px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {busy ? "正在处理…" : submitLabel}
      </button>
    </div>
  );
}

function PaginationFooter({
  currentPage,
  loading,
  nextDisabled,
  onNext,
  onPrevious,
  pageSize,
  totalPages,
  totalSize,
}: {
  currentPage: number;
  loading: boolean;
  nextDisabled: boolean;
  onNext: () => void;
  onPrevious: () => void;
  pageSize: number;
  totalPages: number;
  totalSize: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/70 px-4 py-3 text-[11px] text-[#77777e]">
      <span>
        每页 {pageSize} 条，共 {totalSize} 条
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={currentPage <= 1 || loading}
          onClick={onPrevious}
          className="glass-control h-8 rounded-[10px] px-3 disabled:cursor-not-allowed disabled:opacity-45"
        >
          上一页
        </button>
        <span className="min-w-16 text-center font-medium text-[#59656a]">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={nextDisabled || currentPage >= totalPages || loading}
          onClick={onNext}
          className="glass-control h-8 rounded-[10px] px-3 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? "加载中…" : "下一页"}
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: number }) {
  const label = optionLabel(
    keywordDistillationStatusOptions,
    status || KeywordDistillationStatus.pending,
  );
  const className =
    status === KeywordDistillationStatus.completed
      ? "bg-[#e9f8f0] text-[#258866]"
      : status === KeywordDistillationStatus.failed
        ? "bg-[#fff0ed] text-[#b45a4d]"
        : "bg-[#eaf2ff] text-[#456cd2]";
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function SmallButton({
  danger = false,
  label,
  onClick,
}: {
  danger?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[10px] px-2.5 py-1.5 text-[11px] font-medium ${danger ? "text-[#d85842]" : "text-[#456cd2] hover:bg-[#eaf2ff]/70"}`}
    >
      {label}
    </button>
  );
}

function StatusActionButton({
  disabled,
  label,
  onClick,
  tone,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  tone: "danger" | "pending" | "success";
}) {
  const toneClass =
    tone === "success"
      ? "bg-[#e9f8f0] text-[#258866]"
      : tone === "danger"
        ? "bg-[#fff0ed] text-[#b45a4d]"
        : "bg-[#fff6e6] text-[#a56e18]";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-8 rounded-[10px] px-3 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${toneClass}`}
    >
      {label}
    </button>
  );
}

function questionStatusLabel(status: number) {
  return optionLabel(questionUsageStatusOptions, status);
}

function questionAvailability(status?: number) {
  if (status === QuestionStatus.approved) {
    return { className: "bg-[#e9f8f0] text-[#258866]", label: "可用" };
  }
  if (status === QuestionStatus.rejected) {
    return { className: "bg-[#fff0ed] text-[#b45a4d]", label: "不可用" };
  }
  return { className: "bg-[#fff6e6] text-[#a56e18]", label: "待审核" };
}

function SelectField({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: NumericOption[];
  value: number;
}) {
  return (
    <label className="block text-xs font-medium">
      {label}
      <select name={name} defaultValue={value} className="input-control mt-2">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
