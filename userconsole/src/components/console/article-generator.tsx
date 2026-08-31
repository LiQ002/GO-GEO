"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { SelectChoice } from "@/lib/api/console-resources";
import {
  type CommonV1ArticleTypeInputField,
  type UserV1ArticleGenerationTask,
  userApi,
} from "@/lib/api/user-api.generated";
import { createClientID } from "@/lib/client-id";
import { useConsoleData } from "./console-data-provider";

const steps = ["品牌与类型", "关键词与内容", "知识、图库与模型", "确认生成"];

type GenerationTask = UserV1ArticleGenerationTask;
type InputValue = string | string[];

export function ArticleGenerator() {
  const { getChoices, refreshResources, resourceError, resourceLoading } =
    useConsoleData();
  const brands = getChoices("brands");
  const articleTypes = getChoices("articleTypes");
  const models = getChoices("writingModels");
  const channels = getChoices("publishChannels");
  const keywords = getChoices("keywords");
  const questions = getChoices("questions");
  const knowledgeDocuments = getChoices("knowledgeDocuments");
  const galleryAlbums = getChoices("galleryAlbums");

  const [step, setStep] = useState(0);
  const [brandId, setBrandId] = useState("");
  const [articleTypeId, setArticleTypeId] = useState("");
  const [keywordId, setKeywordId] = useState("");
  const [questionId, setQuestionId] = useState("");
  const [inputValues, setInputValues] = useState<Record<string, InputValue>>(
    {},
  );
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedKnowledgeDocumentIds, setSelectedKnowledgeDocumentIds] =
    useState<string[]>([]);
  const [selectedGalleryAlbumId, setSelectedGalleryAlbumId] = useState("");
  const [galleryImageCount, setGalleryImageCount] = useState(0);
  const [modelId, setModelId] = useState("");
  const [brief, setBrief] = useState("");
  const [status, setStatus] = useState<
    "editing" | "generating" | "created" | "failed"
  >("editing");
  const [task, setTask] = useState<GenerationTask | null>(null);
  const [error, setError] = useState("");

  const selectedTypeChoice = useMemo(
    () => articleTypes.find((item) => item.value === articleTypeId),
    [articleTypeId, articleTypes],
  );
  const selectedType = selectedTypeChoice?.articleType;
  const config = selectedType?.config;
  const inputFields = useMemo(() => config?.inputFields ?? [], [config]);
  const availableModels = useMemo(
    () => filterConfiguredChoices(models, config?.writingModelIds),
    [config?.writingModelIds, models],
  );
  const availableChannels = useMemo(
    () => filterConfiguredChoices(channels, config?.publishChannelIds),
    [channels, config?.publishChannelIds],
  );
  const availableKeywords = useMemo(
    () => keywords.filter((item) => item.brandId === brandId),
    [brandId, keywords],
  );
  const availableQuestions = useMemo(
    () =>
      questions.filter(
        (item) => item.brandId === brandId && item.keywordId === keywordId,
      ),
    [brandId, keywordId, questions],
  );
  const selectedGallery = galleryAlbums.find(
    (album) => album.value === selectedGalleryAlbumId,
  );
  const selectedGalleryImageTotal = Number(selectedGallery?.imageCount || 0);

  useEffect(() => {
    setBrandId((current) => current || brands[0]?.value || "");
    setArticleTypeId((current) =>
      articleTypes.some((item) => item.value === current)
        ? current
        : articleTypes[0]?.value || "",
    );
  }, [articleTypes, brands]);

  useEffect(() => {
    setKeywordId((current) =>
      availableKeywords.some((item) => item.value === current)
        ? current
        : availableKeywords[0]?.value || "",
    );
  }, [availableKeywords]);

  useEffect(() => {
    setQuestionId((current) =>
      availableQuestions.some((item) => item.value === current)
        ? current
        : availableQuestions[0]?.value || "",
    );
  }, [availableQuestions]);

  useEffect(() => {
    setInputValues((current) =>
      Object.fromEntries(
        inputFields.flatMap((field) => {
          if (!field.key) return [];
          const currentValue = current[field.key];
          const defaultValue =
            field.inputType === 5
              ? field.defaultValue
                ? field.defaultValue
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                : []
              : (field.defaultValue ?? "");
          return [[field.key, currentValue ?? defaultValue]];
        }),
      ),
    );
  }, [inputFields]);

  useEffect(() => {
    setModelId((current) => {
      if (availableModels.some((item) => item.value === current))
        return current;
      if (
        config?.defaultWritingModelId &&
        availableModels.some(
          (item) => item.value === config.defaultWritingModelId,
        )
      ) {
        return config.defaultWritingModelId;
      }
      return availableModels[0]?.value || "";
    });
    setSelectedChannels((current) => {
      const allowed = current.filter((id) =>
        availableChannels.some((item) => item.value === id),
      );
      return allowed.length
        ? allowed
        : availableChannels.slice(0, 2).map((item) => item.value);
    });
  }, [availableChannels, availableModels, config?.defaultWritingModelId]);

  useEffect(() => {
    setSelectedKnowledgeDocumentIds((current) =>
      current.filter((id) =>
        knowledgeDocuments.some((item) => item.value === id),
      ),
    );
    setSelectedGalleryAlbumId((current) =>
      galleryAlbums.some(
        (item) => item.value === current && item.disabled !== true,
      )
        ? current
        : "",
    );
  }, [galleryAlbums, knowledgeDocuments]);

  useEffect(() => {
    setGalleryImageCount((current) =>
      Math.min(current, selectedGalleryImageTotal, 20),
    );
  }, [selectedGalleryImageTotal]);

  const labels = useMemo(
    () => ({
      articleType: selectedTypeChoice?.label || "-",
      brand: choiceLabel(brands, brandId),
      model: choiceLabel(availableModels, modelId),
      keyword: choiceLabel(availableKeywords, keywordId),
      question: choiceLabel(availableQuestions, questionId),
      knowledge:
        selectedKnowledgeDocumentIds
          .map((id) => choiceLabel(knowledgeDocuments, id))
          .join("、") || "未选择",
      gallery: selectedGalleryAlbumId
        ? choiceLabel(galleryAlbums, selectedGalleryAlbumId)
        : "不使用图库",
    }),
    [
      availableKeywords,
      availableModels,
      availableQuestions,
      brandId,
      brands,
      galleryAlbums,
      keywordId,
      knowledgeDocuments,
      modelId,
      questionId,
      selectedGalleryAlbumId,
      selectedKnowledgeDocumentIds,
      selectedTypeChoice?.label,
    ],
  );

  const requiredInputsReady = inputFields.every(
    (field) =>
      !field.required || !isEmptyInputValue(inputValues[field.key ?? ""]),
  );
  const gallerySelectionReady = selectedGalleryAlbumId
    ? galleryImageCount >= 1 && galleryImageCount <= selectedGalleryImageTotal
    : galleryImageCount === 0;
  const ready = Boolean(
    brandId &&
      articleTypeId &&
      keywordId &&
      questionId &&
      modelId &&
      selectedKnowledgeDocumentIds.length > 0 &&
      gallerySelectionReady &&
      requiredInputsReady,
  );
  const canContinue =
    (step === 0 && Boolean(brandId && articleTypeId)) ||
    (step === 1 && keywordId && questionId && requiredInputsReady) ||
    (step === 2 &&
      modelId &&
      selectedKnowledgeDocumentIds.length > 0 &&
      gallerySelectionReady);

  function toggleChannel(channelId: string) {
    setSelectedChannels((current) =>
      current.includes(channelId)
        ? current.filter((item) => item !== channelId)
        : [...current, channelId],
    );
  }

  function toggleKnowledgeDocument(knowledgeDocumentId: string) {
    setSelectedKnowledgeDocumentIds((current) =>
      current.includes(knowledgeDocumentId)
        ? current.filter((item) => item !== knowledgeDocumentId)
        : [...current, knowledgeDocumentId],
    );
  }

  function selectGalleryAlbum(albumId: string) {
    const imageTotal = Number(
      galleryAlbums.find((album) => album.value === albumId)?.imageCount || 0,
    );
    setSelectedGalleryAlbumId(albumId);
    setGalleryImageCount((current) =>
      imageTotal === 0 ? 0 : Math.min(current || 4, imageTotal, 20),
    );
  }

  async function startGeneration() {
    if (!ready) {
      setError(
        "请完整选择品牌、文章类型、关键词、目标问题、企业知识、编写模型并填写必填内容",
      );
      return;
    }
    setError("");
    setStatus("generating");
    try {
      const created = await userApi.articleGeneration.createArticleGeneration({
        articleTypeId,
        brandId,
        clientRequestId: createClientID(),
        galleryAlbumIds: selectedGalleryAlbumId ? [selectedGalleryAlbumId] : [],
        galleryImageCount,
        knowledgeDocumentIds: selectedKnowledgeDocumentIds,
        keywordId,
        questionId,
        inputJson: JSON.stringify({
          ...inputValues,
          target_channels: selectedChannels.map((id) =>
            choiceLabel(availableChannels, id),
          ),
        }),
        userInstruction: brief.trim(),
        writingModelId: modelId,
      });
      if (!created.id) throw new Error("生成任务未返回任务编号");
      let current = created;
      setTask(current);
      for (let attempt = 0; attempt < 200; attempt++) {
        if (current.status === "completed") {
          await refreshResources();
          setStatus("created");
          return;
        }
        if (current.status === "failed") {
          setError(current.errorMessage || "模型生成失败，请稍后重试");
          setStatus("failed");
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
        current = await userApi.articleGeneration.getArticleGeneration(
          String(created.id),
        );
        setTask(current);
      }
      setError("文章仍在后台生成，请稍后到文章列表查看结果");
      setStatus("failed");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成任务提交失败");
      setStatus("failed");
    }
  }

  if (status === "created" || status === "failed") {
    const succeeded = status === "created";
    return (
      <div className="console-card flex min-h-[560px] flex-col items-center justify-center p-8 text-center">
        <span
          className={`flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/80 shadow-[0_14px_30px_rgba(75,102,194,.18),inset_0_1px_0_white] ${succeeded ? "bg-[linear-gradient(145deg,#e4f0ff,#ede7ff)] text-[#4d70e8]" : "bg-[#fff0ed] text-[#d85842]"}`}
        >
          <Icon name={succeeded ? "check" : "x"} className="h-8 w-8" />
        </span>
        <p className="mt-7 text-xs font-semibold tracking-[.14em] text-[#3478f6]">
          {succeeded ? "GENERATION COMPLETED" : "GENERATION FAILED"}
        </p>
        <h2 className="mt-3 text-[28px] font-semibold tracking-[-.04em]">
          {succeeded ? "文章生成已完成" : "文章生成未完成"}
        </h2>
        <p className="mt-4 max-w-lg text-sm leading-7 text-[#717179]">
          {succeeded
            ? `生成结果已保存，并锁定了“${labels.articleType}”的当时配置修订。`
            : error}
        </p>
        <div className="mt-7 grid w-full max-w-xl grid-cols-3 gap-3 text-left">
          {[
            ["任务编号", task?.id ? `#${task.id}` : "-"],
            ["任务状态", task?.status || (succeeded ? "completed" : "failed")],
            [
              "Token 用量",
              `${Number(task?.inputTokens || 0) + Number(task?.outputTokens || 0)}`,
            ],
          ].map(([label, value]) => (
            <div
              key={`${label}-${String(value).slice(0, 20)}`}
              className="rounded-[16px] border border-white/75 bg-white/42 p-4 shadow-[inset_0_1px_0_white]"
            >
              <p className="text-[10px] text-[#8b999e]">{label}</p>
              <p className="mt-2 truncate text-xs font-semibold text-[#3a3a40]">
                {value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {succeeded ? (
            <Link
              href="/console/articles"
              className="flex h-11 items-center justify-center rounded-[14px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(69,112,235,.22)]"
            >
              查看文章列表
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setStatus("editing");
              setStep(succeeded ? 0 : 3);
            }}
            className="glass-control h-11 rounded-[14px] px-5 text-sm font-semibold text-[#3a3a40]"
          >
            {succeeded ? "继续创建文章" : "返回修改"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
      <section className="console-card overflow-hidden">
        <div className="border-b border-[#e4ece9] px-5 py-5 sm:px-7">
          <div className="grid grid-cols-4 gap-2">
            {steps.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => index < step && setStep(index)}
                className="text-left"
              >
                <span
                  className={`mb-3 block h-1 rounded-full ${index <= step ? "bg-[linear-gradient(90deg,#438fff,#7169f5)]" : "bg-white/60"}`}
                />
                <span
                  className={`hidden text-[11px] font-medium sm:block ${index === step ? "text-[#3478f6]" : "text-[#9999a0]"}`}
                >
                  {index + 1}. {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[500px] p-5 sm:p-7">
          {resourceError ? (
            <p className="mb-5 rounded-[14px] bg-[#fff0ed]/75 px-4 py-3 text-xs text-[#d65a50]">
              {resourceError}
            </p>
          ) : null}

          {step === 0 ? (
            <div>
              <StepHeader
                eyebrow="BRAND & ARTICLE TYPE"
                title="选择品牌和文章类型"
                description="文章类型是本次生成的主提示词，决定文章方向、结构、语气、GEO 规则和可用模型。"
              />
              <div className="mt-8">
                <Field label="所属品牌" hint="决定企业知识和品牌上下文">
                  <ChoiceSelect
                    label="所属品牌"
                    value={brandId}
                    choices={brands}
                    onChange={setBrandId}
                  />
                </Field>
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {articleTypes.map((type) => {
                  const selected = articleTypeId === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setArticleTypeId(type.value)}
                      className={`rounded-[18px] border p-5 text-left transition ${selected ? "border-[#7c9bf0] bg-[#eaf1ff]/75 ring-2 ring-[#5d81ed]/20" : "border-white/65 bg-white/35"}`}
                    >
                      <Icon name="article" className="h-5 w-5 text-[#4a76eb]" />
                      <h3 className="mt-4 text-sm font-semibold">
                        {type.label}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#71848a]">
                        {type.hint}
                      </p>
                    </button>
                  );
                })}
                {!resourceLoading && articleTypes.length === 0 ? (
                  <p className="text-sm text-[#d85842]">
                    当前企业尚无可用文章类型，请联系平台管理员配置。
                  </p>
                ) : null}
              </div>
              {config ? (
                <InfoBox>
                  当前选中配置修订 v{selectedType?.configRevision ?? 0}
                  ，建议篇幅 {config.recommendedMinWords ?? 0}–
                  {config.recommendedMaxWords ?? 0} 字， 共{" "}
                  {config.sections?.length ?? 0} 个章节。
                </InfoBox>
              ) : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div>
              <StepHeader
                eyebrow="QUESTION & ARTICLE INPUT"
                title="选择目标问题并填写内容"
                description="先选择关键词及其目标问题，文章标题和正文将直接围绕该问题生成。"
              />
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <Field label="目标关键词" hint="仅显示当前品牌下的关键词">
                  <ChoiceSelect
                    label="目标关键词"
                    value={keywordId}
                    choices={availableKeywords}
                    onChange={setKeywordId}
                  />
                </Field>
                <Field label="目标问题" hint="该问题将成为文章标题与内容的核心">
                  <ChoiceSelect
                    label="目标问题"
                    value={questionId}
                    choices={availableQuestions}
                    onChange={setQuestionId}
                  />
                </Field>
              </div>
              {!keywordId ? (
                <InfoBox>
                  当前品牌没有关键词，请先到“关键词与问题”添加关键词并完成问题蒸馏。
                </InfoBox>
              ) : !questionId ? (
                <InfoBox>
                  当前关键词还没有可用问题，请先点击“蒸馏问题”生成。
                </InfoBox>
              ) : null}
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                {inputFields.map((field) => (
                  <DynamicInput
                    key={field.key}
                    field={field}
                    value={inputValues[field.key ?? ""] ?? ""}
                    onChange={(value) => {
                      const key = field.key;
                      if (!key) return;
                      setInputValues((current) => ({
                        ...current,
                        [key]: value,
                      }));
                    }}
                  />
                ))}
              </div>
              {inputFields.length === 0 ? (
                <InfoBox>该文章类型无需额外输入，可直接继续。</InfoBox>
              ) : null}
              {!requiredInputsReady ? (
                <p className="mt-5 rounded-[14px] bg-[#fff0ed]/75 px-4 py-3 text-xs text-[#c05e4b]">
                  请完整填写所有带 * 的必填项。
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <StepHeader
                eyebrow="KNOWLEDGE, GALLERY & MODEL"
                title="选择企业知识、图库与编写模型"
                description="所选企业知识作为事实上下文；系统从所选图库随机抽取图片，第 1 张作为封面，其余图片插入正文合适位置。"
              />
              <div className="mt-8">
                <Field
                  label="参考企业知识 *"
                  hint="数据来自“企业知识”，支持多选且只引用本次选中的内容"
                >
                  <MultiSelectDropdown
                    choices={knowledgeDocuments}
                    label="参考企业知识"
                    selected={selectedKnowledgeDocumentIds}
                    onToggle={toggleKnowledgeDocument}
                    onClear={() => setSelectedKnowledgeDocumentIds([])}
                    emptyText="当前企业没有已解析的知识内容，请先到“企业知识”添加资料。"
                  />
                </Field>
              </div>
              <div className="mt-6">
                <Field
                  label="文章图库"
                  hint="单选；选择后至少使用 1 张作为封面，正文配图不会与封面重复"
                >
                  <ChoiceSelect
                    choices={galleryAlbums}
                    label="文章图库"
                    value={selectedGalleryAlbumId}
                    onChange={selectGalleryAlbum}
                  />
                </Field>
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field
                  label="文章用图总数（含封面）"
                  hint={`所选图库共 ${selectedGalleryImageTotal} 张可用图片；第 1 张为封面，其余为正文配图，每篇最多 20 张`}
                >
                  <input
                    type="number"
                    min={selectedGalleryAlbumId ? 1 : 0}
                    max={Math.min(20, selectedGalleryImageTotal)}
                    value={galleryImageCount}
                    disabled={selectedGalleryImageTotal === 0}
                    onChange={(event) =>
                      setGalleryImageCount(
                        Math.max(
                          selectedGalleryAlbumId ? 1 : 0,
                          Math.min(
                            20,
                            selectedGalleryImageTotal,
                            Number(event.target.value) || 0,
                          ),
                        ),
                      )
                    }
                    className="input-control disabled:opacity-50"
                  />
                </Field>
                <Field
                  label="文章编写模型 *"
                  hint="已同时按文章类型配置和企业授权范围过滤"
                >
                  <ChoiceSelect
                    label="文章编写模型"
                    value={modelId}
                    choices={availableModels}
                    onChange={setModelId}
                  />
                </Field>
              </div>
              <div className="mt-8">
                <Field
                  label="适用渠道"
                  hint="页面只显示文章类型允许的渠道，并作为生成上下文保存"
                >
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {availableChannels.map((channel) => (
                      <button
                        key={channel.value}
                        type="button"
                        onClick={() => toggleChannel(channel.value)}
                        className={`h-9 rounded-[11px] border px-3 text-left text-xs font-medium transition ${
                          selectedChannels.includes(channel.value)
                            ? "border-[#7c9bf0] bg-[#eaf1ff]/75 text-[#3760c9]"
                            : "border-[#c5ced2] bg-white/20 text-[#59636b] hover:border-[#8fa1aa] hover:bg-white/40"
                        }`}
                      >
                        {channel.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="mt-5">
                <Field label="补充要求" hint="仅对本次生成生效，最多 4,000 字">
                  <textarea
                    value={brief}
                    maxLength={4000}
                    onChange={(event) => setBrief(event.target.value)}
                    rows={4}
                    className="input-control resize-none py-3"
                    placeholder="例如：重点结合制造业的实际场景"
                  />
                </Field>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <StepHeader
                eyebrow="REVIEW"
                title="确认生成任务"
                description="只提交文章类型 ID，后端会锁定当前配置修订并记录到生成快照。"
              />
              <div className="mt-8 overflow-hidden rounded-2xl border border-[#dfe8e5]">
                {[
                  ["所属品牌", labels.brand],
                  [
                    "文章类型",
                    `${labels.articleType} · 修订 v${selectedType?.configRevision ?? 0}`,
                  ],
                  ["目标关键词", labels.keyword],
                  ["目标问题", labels.question],
                  ...inputFields.map((field) => [
                    field.label || field.key || "输入项",
                    formatInputValue(inputValues[field.key ?? ""]),
                  ]),
                  [
                    "适用渠道",
                    selectedChannels
                      .map((id) => choiceLabel(availableChannels, id))
                      .join("、") || "未选择",
                  ],
                  ["编写模型", labels.model],
                  ["参考企业知识", labels.knowledge],
                  ["文章图库", labels.gallery],
                  ["文章用图", `${galleryImageCount} 张（含封面）`],
                ].map(([label, value]) => (
                  <div
                    key={`${label}-${String(value).slice(0, 20)}`}
                    className="grid gap-2 border-b border-[#e8efed] px-5 py-4 last:border-0 sm:grid-cols-[110px_1fr]"
                  >
                    <p className="text-xs text-[#87969a]">{label}</p>
                    <p className="text-[13px] leading-6 text-[#3a3a40]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              {error ? (
                <p className="mt-5 rounded-[14px] bg-[#fff0ed]/75 px-4 py-3 text-xs text-[#d65a50]">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-white/70 bg-white/28 px-5 py-4 sm:px-7">
          <button
            type="button"
            disabled={step === 0 || status === "generating"}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            className="glass-control h-10 rounded-[14px] px-5 text-xs font-semibold disabled:opacity-40"
          >
            上一步
          </button>
          {step < 3 ? (
            <button
              type="button"
              disabled={resourceLoading || !canContinue}
              onClick={() => setStep((current) => current + 1)}
              className="h-10 rounded-[14px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              继续
            </button>
          ) : (
            <button
              type="button"
              disabled={status === "generating" || !ready}
              onClick={() => void startGeneration()}
              className="flex h-10 min-w-28 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {status === "generating" ? "模型生成中…" : "开始生成"}
            </button>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="console-card p-5">
          <h2 className="text-sm font-semibold">本次任务</h2>
          <div className="mt-5 space-y-4 text-xs">
            <SummaryLine label="品牌" value={labels.brand} />
            <SummaryLine label="文章类型" value={labels.articleType} />
            <SummaryLine label="目标关键词" value={labels.keyword} />
            <SummaryLine label="目标问题" value={labels.question} />
            <SummaryLine
              label="配置修订"
              value={`v${selectedType?.configRevision ?? 0}`}
            />
            <SummaryLine label="模型" value={labels.model} />
            <SummaryLine label="企业知识" value={labels.knowledge} />
            <SummaryLine
              label="图库用图"
              value={
                galleryImageCount > 0
                  ? `${galleryImageCount} 张（1 张封面，其余正文）`
                  : "不使用图库"
              }
            />
          </div>
        </section>
        {config ? (
          <section className="rounded-[20px] border border-white/75 bg-[#eaf1ff]/65 p-5">
            <Icon name="book" className="h-5 w-5 text-[#4c78e8]" />
            <h3 className="mt-4 text-sm font-semibold text-[#3a4f81]">
              文章类型主提示词
            </h3>
            <p className="mt-2 text-xs leading-6 text-[#69738d]">
              {config.contentGoal}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(config.sections ?? []).map((section) => (
                <span
                  key={section.title}
                  className="rounded-full bg-white/55 px-3 py-1 text-[10px] text-[#5d6f91]"
                >
                  {section.title}
                </span>
              ))}
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function DynamicInput({
  field,
  onChange,
  value,
}: {
  field: CommonV1ArticleTypeInputField;
  onChange: (value: InputValue) => void;
  value: InputValue;
}) {
  const label = `${field.label || field.key || "输入项"}${field.required ? " *" : ""}`;
  const hint = field.helpText || field.placeholder || "根据当前文章类型配置";
  if (field.inputType === 2) {
    return (
      <Field label={label} hint={hint}>
        <textarea
          value={typeof value === "string" ? value : value.join("\n")}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          className="input-control resize-none py-3"
          placeholder={field.placeholder}
        />
      </Field>
    );
  }
  if (field.inputType === 4) {
    return (
      <Field label={label} hint={hint}>
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className="input-control"
        >
          <option value="">请选择</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>
    );
  }
  if (field.inputType === 5) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <Field label={label} hint={`${hint}（可多选）`}>
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() =>
                onChange(
                  selected.includes(option)
                    ? selected.filter((item) => item !== option)
                    : [...selected, option],
                )
              }
              className={`rounded-[12px] border px-3 py-2 text-xs ${selected.includes(option) ? "border-[#7c9bf0] bg-[#eaf1ff]/75 text-[#3760c9]" : "border-white/65 bg-white/30"}`}
            >
              {option}
            </button>
          ))}
        </div>
      </Field>
    );
  }
  return (
    <Field label={label} hint={hint}>
      <input
        type={field.inputType === 3 ? "number" : "text"}
        value={typeof value === "string" ? value : value.join(",")}
        onChange={(event) => onChange(event.target.value)}
        className="input-control"
        placeholder={field.placeholder}
      />
    </Field>
  );
}

function StepHeader({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-[.16em] text-[#3478f6]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-[22px] font-semibold tracking-[-.035em]">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#717179]">{description}</p>
    </div>
  );
}

function Field({
  children,
  hint,
  label,
}: {
  children: React.ReactNode;
  hint: string;
  label: string;
}) {
  return (
    <div className="block">
      <span className="text-sm font-medium text-[#3a3a40]">{label}</span>
      <span className="mt-1 block min-h-5 text-[11px] text-[#93a1a5]">
        {hint}
      </span>
      <span className="mt-2 block">{children}</span>
    </div>
  );
}

function ChoiceSelect({
  choices,
  label,
  onChange,
  value,
}: {
  choices: SelectChoice[];
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="input-control"
    >
      <option value="">请选择</option>
      {choices.map((item) => (
        <option key={item.value} value={item.value} disabled={item.disabled}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

function MultiSelectDropdown({
  choices,
  emptyText,
  label,
  onClear,
  onToggle,
  selected,
}: {
  choices: SelectChoice[];
  emptyText: string;
  label: string;
  onClear: () => void;
  onToggle: (value: string) => void;
  selected: string[];
}) {
  if (choices.length === 0) {
    return (
      <p className="rounded-[14px] border border-dashed border-[#cfdad7] bg-white/25 px-4 py-5 text-xs leading-6 text-[#87969a]">
        {emptyText}
      </p>
    );
  }
  const selectedLabels = choices
    .filter((choice) => selected.includes(choice.value))
    .map((choice) => choice.label);
  return (
    <details className="group relative">
      <summary
        aria-label={label}
        className="input-control flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden"
      >
        <span
          className={`truncate ${
            selectedLabels.length > 0 ? "text-[#35353b]" : "text-[#8f9a9f]"
          }`}
        >
          {selectedLabels.length > 0
            ? `已选择 ${selectedLabels.length} 项：${selectedLabels.join("、")}`
            : "请选择企业知识"}
        </span>
        <Icon
          name="chevron-down"
          className="h-4 w-4 shrink-0 text-[#77858a] transition group-open:rotate-180"
        />
      </summary>
      <div
        role="listbox"
        aria-multiselectable="true"
        className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-[14px] border border-[#ccd8d5] bg-white/95 p-2 shadow-[0_18px_45px_rgba(48,67,79,.18)] backdrop-blur-xl"
      >
        <div className="mb-1 flex items-center justify-between px-2 py-1">
          <span className="text-[11px] text-[#879499]">
            已选择 {selected.length} 项
          </span>
          {selected.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] font-medium text-[#4779e8] hover:text-[#315dc3]"
            >
              清空
            </button>
          ) : null}
        </div>
        {choices.map((choice) => {
          const active = selected.includes(choice.value);
          return (
            <button
              key={choice.value}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onToggle(choice.value)}
              className={`flex w-full items-start gap-3 rounded-[10px] px-3 py-2.5 text-left transition ${
                active
                  ? "bg-[#edf3ff] text-[#315fc7]"
                  : "text-[#3f484c] hover:bg-[#f2f6f5]"
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  active
                    ? "border-[#5679e8] bg-[#5679e8] text-white"
                    : "border-[#aebbc0] bg-white text-transparent"
                }`}
              >
                <Icon name="check" className="h-3 w-3" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">
                  {choice.label}
                </span>
                {choice.hint ? (
                  <span className="mt-0.5 block truncate text-[11px] text-[#849397]">
                    {choice.hint}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </details>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 flex gap-3 rounded-[16px] border border-white/80 bg-[#eaf1ff]/65 p-4 text-xs leading-6 text-[#69738d]">
      <Icon name="sparkles" className="h-5 w-5 shrink-0 text-[#4a76eb]" />
      {children}
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#87969a]">{label}</span>
      <span className="max-w-[165px] truncate text-right font-medium text-[#3a3a40]">
        {value || "-"}
      </span>
    </div>
  );
}

function filterConfiguredChoices(
  choices: SelectChoice[],
  configuredIds?: string[],
) {
  if (!configuredIds?.length) return choices;
  const allowed = new Set(configuredIds);
  return choices.filter((item) => allowed.has(item.value));
}

function choiceLabel(choices: SelectChoice[], value: string) {
  return choices.find((item) => item.value === value)?.label || "-";
}

function isEmptyInputValue(value?: InputValue) {
  return Array.isArray(value) ? value.length === 0 : !value?.trim();
}

function formatInputValue(value?: InputValue) {
  if (Array.isArray(value)) return value.join("、") || "未填写";
  return value?.trim() || "未填写";
}
