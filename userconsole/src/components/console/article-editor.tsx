"use client";

import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import DOMPurify from "dompurify";
import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { type SelectChoice, statusLabel } from "@/lib/api/console-resources";
import { type UserV1Article, userApi } from "@/lib/api/user-api.generated";
import {
  articleHTMLToMarkdown,
  markdownToArticleHTML,
} from "@/lib/article-content";
import { Icon } from "../ui/icon";
import { useConsoleData } from "./console-data-provider";
import { Toast } from "./modal";

const articleExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: {
      HTMLAttributes: {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      },
      autolink: true,
      openOnClick: false,
    },
  }),
  Highlight.configure({ multicolor: true }),
  Image.configure({
    HTMLAttributes: {
      style:
        "display:block;max-width:min(100%,560px);height:auto;margin:16px auto;border-radius:8px;",
    },
    resize: {
      alwaysPreserveAspectRatio: true,
      enabled: true,
      minHeight: 80,
      minWidth: 80,
    },
  }),
  TableKit.configure({
    table: {
      HTMLAttributes: {
        style: "border-collapse:collapse;width:100%;margin:20px 0;",
      },
      resizable: true,
    },
    tableCell: {
      HTMLAttributes: {
        style: "border:1px solid #d9d9d9;padding:8px 10px;",
      },
    },
    tableHeader: {
      HTMLAttributes: {
        style:
          "border:1px solid #d9d9d9;padding:8px 10px;background:#f5f7fa;font-weight:600;",
      },
    },
  }),
  TextAlign.configure({
    alignments: ["left", "center", "right", "justify"],
    types: ["heading", "paragraph"],
  }),
  TextStyleKit,
  Typography,
];

type ArticleEditorMode = "edit" | "view";

type ArticleStatusAction = {
  action: string;
  label: string;
  tone?: "danger" | "primary";
};

const articleStatusActions: Record<string, ArticleStatusAction[]> = {
  draft: [
    { action: "approve", label: "审核通过", tone: "primary" },
    { action: "disable", label: "禁用", tone: "danger" },
  ],
  pending_review: [
    { action: "approve", label: "审核通过", tone: "primary" },
    { action: "disable", label: "禁用", tone: "danger" },
  ],
  normal: [
    { action: "disable", label: "禁用", tone: "danger" },
    { action: "review", label: "重新审核" },
  ],
  disabled: [
    { action: "review", label: "重新审核", tone: "primary" },
    { action: "approve", label: "恢复为正常" },
  ],
};

export function ArticleEditor({
  articleId,
  mode,
}: {
  articleId: string;
  mode: ArticleEditorMode;
}) {
  const { getChoices, refreshResources } = useConsoleData();
  const [article, setArticle] = useState<UserV1Article | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [brandId, setBrandId] = useState("");
  const [articleTypeId, setArticleTypeId] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const contentRef = useRef("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const readOnly = mode === "view";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void userApi.article
      .getArticle(articleId)
      .then((loaded) => {
        if (!active) return;
        const source =
          loaded.contentHtml?.trim() ||
          markdownToArticleHTML(loaded.contentMarkdown ?? "");
        const safeHTML = DOMPurify.sanitize(source, {
          USE_PROFILES: { html: true },
        });
        setArticle(loaded);
        setTitle(loaded.title ?? "");
        setSummary(loaded.summary ?? "");
        setBrandId(String(loaded.brandId ?? ""));
        setArticleTypeId(String(loaded.articleTypeId ?? ""));
        setEditorContent(safeHTML);
        contentRef.current = safeHTML;
        setDirty(false);
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "文章加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [articleId]);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const warnBeforeNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      const link =
        target instanceof Element
          ? target.closest<HTMLAnchorElement>("a")
          : null;
      if (!link || link.target === "_blank") return;
      if (!window.confirm("文章还有未保存的修改，确认离开当前页面吗？")) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", warnBeforeNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", warnBeforeNavigation, true);
    };
  }, [dirty]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleContentChange = useCallback((html: string) => {
    contentRef.current = html;
    setDirty(true);
  }, []);

  function updateField(setter: (value: string) => void, value: string) {
    setter(value);
    setDirty(true);
  }

  async function saveArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!article || readOnly) return;
    // 文章状态已简化为三态（pending_review / normal / disabled），
    // 已投放文章保持 normal 状态，可继续编辑和投放到其他平台。
    if (article.status === "disabled") return;
    if (!title.trim() || !brandId) {
      setError("请填写文章标题并选择所属品牌");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const contentHtml = contentRef.current;
      const updated = await userApi.article.updateArticle(articleId, {
        article: {
          ...article,
          articleTypeId,
          brandId,
          contentHtml,
          contentMarkdown: articleHTMLToMarkdown(contentHtml),
          summary: summary.trim(),
          title: title.trim(),
        },
        changeSummary: "用户控制台富文本编辑",
      });
      setArticle(updated);
      setEditorContent(contentHtml);
      contentRef.current = contentHtml;
      setDirty(false);
      setToast("文章已保存并生成新版本");
      await refreshResources();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "文章保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(statusAction: ArticleStatusAction) {
    if (!article || changingStatus) return;
    if (dirty) {
      setError("文章有未保存的修改，请先保存文章，再调整状态");
      return;
    }

    let reason = "";
    if (statusAction.action === "disable") {
      const enteredReason = window.prompt("请填写禁用原因");
      if (enteredReason === null) return;
      reason = enteredReason.trim();
      if (!reason) {
        setError("禁用文章时必须填写原因");
        return;
      }
    } else if (!window.confirm(`确认执行“${statusAction.label}”吗？`)) {
      return;
    }

    setChangingStatus(true);
    setError("");
    try {
      const updated = await userApi.article.changeArticleStatus(articleId, {
        action: statusAction.action,
        reason,
        version: article.version,
      });
      setArticle(updated);
      setToast(`文章状态已更新为“${statusLabel(updated.status)}”`);
      await refreshResources();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "文章状态更新失败");
    } finally {
      setChangingStatus(false);
    }
  }

  if (loading) {
    return (
      <div className="console-card flex min-h-[520px] items-center justify-center">
        <p className="text-sm text-[#717179]">正在加载文章内容…</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="console-card p-8">
        <p className="text-sm text-[#d65a50]">{error || "未找到文章"}</p>
        <Link
          href="/console/articles"
          className="mt-4 inline-flex text-xs font-semibold text-[#3478f6]"
        >
          返回文章列表
        </Link>
      </div>
    );
  }

  const locked = article.status === "disabled";
  const editable = !readOnly && !locked;
  const brands = withCurrentChoice(getChoices("brands"), brandId);
  const articleTypes = withCurrentChoice(
    getChoices("articleTypes"),
    articleTypeId,
  );
  const statusActions = articleStatusActions[article.status ?? ""] ?? [];

  return (
    <form onSubmit={saveArticle}>
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <Link
            href="/console/articles"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#74747c] hover:text-[#3478f6]"
          >
            <Icon name="arrow-right" className="h-3.5 w-3.5 rotate-180" />
            返回文章列表
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h1 className="text-[27px] font-semibold tracking-[-.04em]">
              {readOnly ? "查看文章" : "编辑文章"}
            </h1>
            <span className="rounded-full border border-white/80 bg-[#eaf2ff]/75 px-2.5 py-1 text-[11px] font-medium text-[#3478f6]">
              {statusLabel(article.status)}
            </span>
            {dirty ? (
              <span className="text-[11px] font-medium text-[#d27b35]">
                有未保存修改
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-[#717179]">
            HTML 富文本用于保留排版，保存时同步生成 Markdown 兼容副本。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {readOnly && !locked ? (
            <Link
              href={`/console/articles/${articleId}`}
              className="inline-flex h-10 items-center gap-2 rounded-[13px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-5 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(69,112,235,.22)]"
            >
              <Icon name="edit" className="h-4 w-4" />
              编辑文章
            </Link>
          ) : !readOnly ? (
            <button
              type="submit"
              disabled={saving || locked}
              className="h-10 rounded-[13px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-5 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(69,112,235,.22)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {saving ? "正在保存…" : "保存文章"}
            </button>
          ) : null}
        </div>
      </div>

      {locked ? (
        <p className="mt-5 rounded-[14px] bg-[#fff6e8]/80 px-4 py-3 text-xs text-[#9a662f]">
          当前文章已被禁用，不可继续修改。如需修改，请先调整为“重新审核”或“恢复为正常”状态。
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-[14px] bg-[#fff0ed]/75 px-4 py-3 text-xs text-[#d65a50]">
          {error}
        </p>
      ) : null}

      <section className="console-card mt-5 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-sm font-semibold text-[#34343a]">文章状态</h2>
            <p className="mt-1 text-xs leading-5 text-[#777780]">
              当前状态：
              <span className="font-semibold text-[#3478f6]">
                {statusLabel(article.status)}
              </span>
              。状态变更后会立即同步到文章列表。
            </p>
          </div>
          {statusActions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {statusActions.map((statusAction) => (
                <button
                  key={statusAction.action}
                  type="button"
                  disabled={changingStatus || dirty}
                  onClick={() => void changeStatus(statusAction)}
                  className={`h-9 rounded-[12px] border px-4 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    statusAction.tone === "primary"
                      ? "border-transparent bg-[#3478f6] text-white shadow-[0_7px_16px_rgba(52,120,246,.2)]"
                      : statusAction.tone === "danger"
                        ? "border-[#ffd4ce] bg-[#fff2f0] text-[#cf5349]"
                        : "border-[#dfe5ee] bg-white/75 text-[#5f6470] hover:border-[#bfcde0]"
                  }`}
                >
                  {changingStatus ? "处理中…" : statusAction.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#8a8a92]">当前状态无需人工调整</p>
          )}
        </div>
        {dirty ? (
          <p className="mt-3 text-[11px] text-[#b77935]">
            请先保存未保存的文章内容，再调整状态。
          </p>
        ) : null}
      </section>

      <section className="console-card mt-6 p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <label className="block lg:col-span-2">
            <span className="text-xs font-semibold text-[#4d4d54]">
              文章标题
              <em className="ml-1 not-italic text-[#df5c4f]">*</em>
            </span>
            <input
              required
              disabled={!editable}
              value={title}
              onChange={(event) => updateField(setTitle, event.target.value)}
              className="input-control mt-2 h-12 text-base font-semibold disabled:opacity-70"
            />
          </label>
          <div className="lg:col-span-2">
            <span className="text-xs font-semibold text-[#4d4d54]">
              文章封面
            </span>
            <div className="mt-2 overflow-hidden rounded-[16px] border border-white/80 bg-[#f4f6fa]/75">
              {article.coverImageUrl ? (
                // biome-ignore lint/performance/noImgElement: enterprise gallery images have arbitrary remote hosts and must preserve their original aspect ratio.
                <img
                  src={article.coverImageUrl}
                  alt={article.title ? `${article.title}封面` : "文章封面"}
                  className="mx-auto block h-auto max-h-[480px] w-full max-w-2xl object-contain"
                />
              ) : (
                <div className="flex min-h-40 items-center justify-center px-6 py-10 text-xs text-[#8a8a92]">
                  暂无文章封面
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-[#85858c]">
              封面按图片原始比例完整展示，不会裁切。
            </p>
          </div>
          <ArticleSelect
            disabled={!editable}
            label="文章类型"
            options={articleTypes}
            value={articleTypeId}
            onChange={(value) => updateField(setArticleTypeId, value)}
          />
          <ArticleSelect
            required
            disabled={!editable}
            label="所属品牌"
            options={brands}
            value={brandId}
            onChange={(value) => updateField(setBrandId, value)}
          />
          <label className="block lg:col-span-2">
            <span className="text-xs font-semibold text-[#4d4d54]">
              文章摘要
            </span>
            <textarea
              disabled={!editable}
              value={summary}
              rows={3}
              onChange={(event) => updateField(setSummary, event.target.value)}
              className="input-control mt-2 resize-y py-3 disabled:opacity-70"
              placeholder="概括文章核心观点，用于列表和渠道摘要"
            />
          </label>
        </div>
      </section>

      <section className="console-card mt-5">
        <div className="border-b border-white/70 px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold text-[#34343a]">文章正文</h2>
          <p className="mt-1 text-[11px] leading-5 text-[#7a7a82]">
            建议使用标题、段落、列表、表格和基础颜色等通用格式；最终样式仍可能由目标媒体平台二次规范化。
          </p>
        </div>
        <RichTextEditor
          key={`${article.id}-${article.version}-${mode}`}
          editable={editable}
          initialContent={editorContent}
          onChange={handleContentChange}
        />
      </section>
      <Toast message={toast} />
    </form>
  );
}

function ArticleSelect({
  disabled,
  label,
  onChange,
  options,
  required = false,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  options: SelectChoice[];
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#4d4d54]">
        {label}
        {required ? (
          <em className="ml-1 not-italic text-[#df5c4f]">*</em>
        ) : null}
      </span>
      <select
        required={required}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-control mt-2 disabled:opacity-70"
      >
        <option value="">请选择</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RichTextEditor({
  editable,
  initialContent,
  onChange,
}: {
  editable: boolean;
  initialContent: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    content: initialContent,
    editable,
    editorProps: {
      attributes: {
        "aria-label": editable ? "文章正文富文本编辑器" : "文章正文",
      },
    },
    extensions: articleExtensions,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor) {
        return {
          blockType: "paragraph",
          bold: false,
          bulletList: false,
          characterCount: 0,
          italic: false,
          orderedList: false,
          strike: false,
          underline: false,
        };
      }
      return {
        blockType: currentEditor.isActive("heading", { level: 1 })
          ? "h1"
          : currentEditor.isActive("heading", { level: 2 })
            ? "h2"
            : currentEditor.isActive("heading", { level: 3 })
              ? "h3"
              : "paragraph",
        bold: currentEditor.isActive("bold"),
        bulletList: currentEditor.isActive("bulletList"),
        characterCount: currentEditor.getText().replace(/\s/g, "").length,
        italic: currentEditor.isActive("italic"),
        orderedList: currentEditor.isActive("orderedList"),
        strike: currentEditor.isActive("strike"),
        underline: currentEditor.isActive("underline"),
      };
    },
  });

  return (
    <div className="article-rich-text">
      {editable ? (
        <RichTextToolbar editor={editor} state={editorState} />
      ) : null}
      <EditorContent editor={editor} />
      <div className="flex items-center justify-between border-t border-white/70 px-5 py-3 text-[10px] text-[#85858c] sm:px-6">
        <span>富文本 HTML · 自动同步 Markdown</span>
        <span>{editorState?.characterCount ?? 0} 字</span>
      </div>
    </div>
  );
}

function RichTextToolbar({
  editor,
  state,
}: {
  editor: ReturnType<typeof useEditor> | null;
  state: {
    blockType: string;
    bold: boolean;
    bulletList: boolean;
    characterCount: number;
    italic: boolean;
    orderedList: boolean;
    strike: boolean;
    underline: boolean;
  } | null;
}) {
  if (!editor) {
    return <div className="h-[92px] border-b border-white/70" />;
  }
  const activeEditor = editor;

  function setLink() {
    const previous = activeEditor.getAttributes("link").href as
      | string
      | undefined;
    const href = window.prompt("请输入链接地址", previous ?? "https://");
    if (href === null) return;
    if (!href.trim()) {
      activeEditor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    activeEditor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: href.trim() })
      .run();
  }

  function insertImage() {
    const src = window.prompt("请输入图片的 HTTPS 地址");
    if (!src?.trim()) return;
    try {
      const url = new URL(src.trim());
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("unsupported protocol");
      }
      activeEditor.chain().focus().setImage({ src: url.toString() }).run();
    } catch {
      window.alert("请输入有效的 HTTP 或 HTTPS 图片地址");
    }
  }

  return (
    <div className="sticky top-[72px] z-20 space-y-2 border-b border-white/75 bg-white/72 p-3 backdrop-blur-xl sm:px-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          aria-label="正文段落样式"
          value={state?.blockType ?? "paragraph"}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "paragraph") {
              editor.chain().focus().setParagraph().run();
              return;
            }
            editor
              .chain()
              .focus()
              .setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 })
              .run();
          }}
          className="rich-toolbar-select"
        >
          <option value="paragraph">正文</option>
          <option value="h1">一级标题</option>
          <option value="h2">二级标题</option>
          <option value="h3">三级标题</option>
        </select>
        <select
          aria-label="字号"
          defaultValue=""
          onChange={(event) => {
            const value = event.target.value;
            if (value) editor.chain().focus().setFontSize(value).run();
            else editor.chain().focus().unsetFontSize().run();
          }}
          className="rich-toolbar-select"
        >
          <option value="">默认字号</option>
          <option value="14px">14px</option>
          <option value="16px">16px</option>
          <option value="18px">18px</option>
          <option value="20px">20px</option>
          <option value="24px">24px</option>
          <option value="30px">30px</option>
        </select>
        <select
          aria-label="行高"
          defaultValue=""
          onChange={(event) => {
            const value = event.target.value;
            if (value) editor.chain().focus().setLineHeight(value).run();
            else editor.chain().focus().unsetLineHeight().run();
          }}
          className="rich-toolbar-select"
        >
          <option value="">默认行高</option>
          <option value="1.4">紧凑</option>
          <option value="1.75">舒适</option>
          <option value="2">宽松</option>
        </select>
        <ToolbarButton
          active={state?.bold}
          label="加粗"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </ToolbarButton>
        <ToolbarButton
          active={state?.italic}
          label="斜体"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <i>I</i>
        </ToolbarButton>
        <ToolbarButton
          active={state?.underline}
          label="下划线"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <u>U</u>
        </ToolbarButton>
        <ToolbarButton
          active={state?.strike}
          label="删除线"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <s>S</s>
        </ToolbarButton>
        <label className="rich-toolbar-color" title="文字颜色">
          <span>A</span>
          <input
            type="color"
            aria-label="文字颜色"
            defaultValue="#1d1d1f"
            onChange={(event) =>
              editor.chain().focus().setColor(event.target.value).run()
            }
          />
        </label>
        <label className="rich-toolbar-color" title="高亮颜色">
          <span className="rounded bg-[#fff0a8] px-0.5">A</span>
          <input
            type="color"
            aria-label="高亮颜色"
            defaultValue="#fff0a8"
            onChange={(event) =>
              editor
                .chain()
                .focus()
                .toggleHighlight({ color: event.target.value })
                .run()
            }
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <ToolbarButton
          label="左对齐"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          左
        </ToolbarButton>
        <ToolbarButton
          label="居中"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          中
        </ToolbarButton>
        <ToolbarButton
          label="右对齐"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          右
        </ToolbarButton>
        <ToolbarButton
          label="两端对齐"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          齐
        </ToolbarButton>
        <ToolbarButton
          active={state?.bulletList}
          label="无序列表"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • 列表
        </ToolbarButton>
        <ToolbarButton
          active={state?.orderedList}
          label="有序列表"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. 列表
        </ToolbarButton>
        <ToolbarButton
          label="引用"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          引用
        </ToolbarButton>
        <ToolbarButton label="链接" onClick={setLink}>
          链接
        </ToolbarButton>
        <ToolbarButton label="图片" onClick={insertImage}>
          图片
        </ToolbarButton>
        <ToolbarButton
          label="插入表格"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ cols: 3, rows: 3, withHeaderRow: true })
              .run()
          }
        >
          表格
        </ToolbarButton>
        <ToolbarButton
          label="分隔线"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          分隔线
        </ToolbarButton>
        <ToolbarButton
          label="清除格式"
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        >
          清除格式
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-[#dfe3eb]" />
        <ToolbarButton
          disabled={!editor.can().chain().focus().undo().run()}
          label="撤销"
          onClick={() => editor.chain().focus().undo().run()}
        >
          撤销
        </ToolbarButton>
        <ToolbarButton
          disabled={!editor.can().chain().focus().redo().run()}
          label="重做"
          onClick={() => editor.chain().focus().redo().run()}
        >
          重做
        </ToolbarButton>
      </div>
    </div>
  );
}

function ToolbarButton({
  active = false,
  children,
  disabled = false,
  label,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      title={label}
      onClick={onClick}
      className={`rich-toolbar-button ${active ? "rich-toolbar-button-active" : ""}`}
    >
      {children}
    </button>
  );
}

function withCurrentChoice(
  choices: SelectChoice[],
  currentValue: string,
): SelectChoice[] {
  if (
    !currentValue ||
    choices.some((choice) => choice.value === currentValue)
  ) {
    return choices;
  }
  return [
    ...choices,
    {
      label: `编号 ${currentValue}`,
      value: currentValue,
    },
  ];
}
