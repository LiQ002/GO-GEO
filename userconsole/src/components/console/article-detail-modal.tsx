"use client";

import { useMemo } from "react";
import type { UserV1Article } from "@/lib/api/user-api.generated";
import { Modal } from "./modal";

type ImageEntry = { alt: string; url: string };

function extractImages(markdown?: string, html?: string): ImageEntry[] {
  const images: ImageEntry[] = [];
  const seen = new Set<string>();
  const push = (alt: string, url: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    images.push({ alt: alt || "配图", url });
  };
  const md = markdown ?? "";
  const mdImage = /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g;
  let match: RegExpExecArray | null = mdImage.exec(md);
  while (match !== null) {
    push(match[1], match[2]);
    match = mdImage.exec(md);
  }
  const htmlText = html ?? "";
  const htmlImage =
    /<img[^>]*\bsrc=["']([^"']+)["'][^>]*\balt=["']([^"']*)["']/g;
  match = htmlImage.exec(htmlText);
  while (match !== null) {
    push(match[2], match[1]);
    match = htmlImage.exec(htmlText);
  }
  const htmlImage2 = /<img[^>]*\bsrc=["']([^"']+)["'][^>]*>/g;
  match = htmlImage2.exec(htmlText);
  while (match !== null) {
    push("", match[1]);
    match = htmlImage2.exec(htmlText);
  }
  return images;
}

function renderInline(text: string, keyBase: string) {
  const nodes: React.ReactNode[] = [];
  const regex =
    /(!\[([^\]]*)\]\(([^)\s]+)[^)]*\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let index = 0;
  let match: RegExpExecArray | null = regex.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[3]) {
      nodes.push(
        // biome-ignore lint/performance/noImgElement: inline markdown images from generated content.
        <img
          key={`${keyBase}-img-${index}`}
          src={match[3]}
          alt={match[2]}
          className="my-3 h-auto w-full rounded-[14px] border border-white/65 object-contain"
        />,
      );
    } else if (match[5]) {
      nodes.push(
        <a
          key={`${keyBase}-a-${index}`}
          href={match[5]}
          target="_blank"
          rel="noreferrer"
          className="text-[#3f8fff] underline"
        >
          {match[4]}
        </a>,
      );
    } else if (match[6] !== undefined) {
      nodes.push(
        <strong key={`${keyBase}-b-${index}`} className="font-semibold">
          {match[6]}
        </strong>,
      );
    } else if (match[7] !== undefined) {
      nodes.push(<em key={`${keyBase}-i-${index}`}>{match[7]}</em>);
    } else if (match[8] !== undefined) {
      nodes.push(
        <code
          key={`${keyBase}-c-${index}`}
          className="rounded bg-black/5 px-1.5 py-0.5 text-[12px] text-[#b5406a]"
        >
          {match[8]}
        </code>,
      );
    }
    lastIndex = regex.lastIndex;
    index++;
    match = regex.exec(text);
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes.length ? nodes : text;
}

function renderMarkdown(markdown?: string) {
  const source = (markdown ?? "").trim();
  if (!source) {
    return <p className="text-sm text-[#9a9aa0]">暂无正文内容。</p>;
  }
  const blocks: React.ReactNode[] = [];
  const lines = source.split(/\r?\n/);
  let list: string[] = [];
  let ordered = false;
  let paragraph: string[] = [];
  let key = 0;

  function flushParagraph() {
    if (!paragraph.length) return;
    const text = paragraph.join(" ");
    blocks.push(
      <p key={`p-${key}`} className="text-[14px] leading-7 text-[#3a3a40]">
        {renderInline(text, `p${key}`)}
      </p>,
    );
    key++;
    paragraph = [];
  }
  function flushList() {
    if (!list.length) return;
    const items = [...list];
    const listKey = key;
    blocks.push(
      ordered ? (
        <ol
          key={`ol-${listKey}`}
          className="ml-5 list-decimal space-y-1 text-[14px] leading-7 text-[#3a3a40]"
        >
          {items.map((item) => (
            <li key={`${listKey}-${item.slice(0, 16)}`}>
              {renderInline(item, `ol-${listKey}-${item.slice(0, 8)}`)}
            </li>
          ))}
        </ol>
      ) : (
        <ul
          key={`ul-${listKey}`}
          className="ml-5 list-disc space-y-1 text-[14px] leading-7 text-[#3a3a40]"
        >
          {items.map((item) => (
            <li key={`${listKey}-${item.slice(0, 16)}`}>
              {renderInline(item, `ul-${listKey}-${item.slice(0, 8)}`)}
            </li>
          ))}
        </ul>
      ),
    );
    key++;
    list = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const cls =
        level <= 1
          ? "mt-6 text-[20px] font-bold text-[#25252a]"
          : level === 2
            ? "mt-5 text-[17px] font-bold text-[#2a2a30]"
            : "mt-4 text-[15px] font-semibold text-[#33333a]";
      blocks.push(
        <h3 key={`h-${key}`} className={cls}>
          {renderInline(headingMatch[2], `h${key}`)}
        </h3>,
      );
      key++;
      continue;
    }
    const quoteMatch = /^>\s+(.*)$/.exec(trimmed);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      blocks.push(
        <blockquote
          key={`q-${key}`}
          className="border-l-[3px] border-[#7c9bf0] bg-[#eaf1ff]/55 py-2 pl-4 text-[14px] italic leading-6 text-[#5a6377]"
        >
          {renderInline(quoteMatch[1], `q${key}`)}
        </blockquote>,
      );
      key++;
      continue;
    }
    const orderedMatch = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (orderedMatch) {
      if (!ordered || paragraph.length) {
        flushParagraph();
        if (!ordered) flushList();
        ordered = true;
        list = [];
      }
      list.push(orderedMatch[1]);
      continue;
    }
    const bulletMatch = /^[-*+]\s+(.*)$/.exec(trimmed);
    if (bulletMatch) {
      if (ordered || paragraph.length) {
        flushParagraph();
        if (ordered) flushList();
        ordered = false;
        list = [];
      }
      list.push(bulletMatch[1]);
      continue;
    }
    if (paragraph.length || list.length) flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  return <div className="space-y-3">{blocks}</div>;
}

export function ArticleDetailModal({
  article,
  onClose,
}: {
  article: UserV1Article | null;
  onClose: () => void;
}) {
  const cover = useMemo(() => {
    const embeddedImages = extractImages(
      article?.contentMarkdown,
      article?.contentHtml,
    );
    const boundCover = article?.coverImageUrl
      ? { alt: article.title || "文章封面", url: article.coverImageUrl }
      : undefined;
    return boundCover ?? embeddedImages[0];
  }, [article]);

  return (
    <Modal
      open={Boolean(article)}
      onClose={onClose}
      title={article?.title || "文章详情"}
      description="查看文章标题、封面、正文与配图。"
      size="lg"
    >
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full bg-[#eaf1ff]/75 px-3 py-1 text-[#3760c9]">
            {article?.status || "草稿"}
          </span>
          {article?.qualityScore ? (
            <span className="rounded-full bg-[#fff6e6]/80 px-3 py-1 text-[#b07a1e]">
              质量评分 {Math.round(article.qualityScore)} 分
            </span>
          ) : null}
          {article?.publishedAt ? (
            <span className="rounded-full bg-white/55 px-3 py-1 text-[#5d6f91]">
              发布于 {article.publishedAt.slice(0, 10)}
            </span>
          ) : null}
        </div>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-[#3a3a40]">
            文章封面
          </h3>
          {cover ? (
            <a
              href={cover.url}
              target="_blank"
              rel="noreferrer"
              className="flex w-full justify-center overflow-hidden rounded-[18px] border border-white/65 bg-white/35"
            >
              {/* biome-ignore lint/performance/noImgElement: enterprise gallery cover uses its original aspect ratio. */}
              <img
                src={cover.url}
                alt={cover.alt}
                className="h-auto w-full object-contain"
              />
            </a>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-[18px] border border-dashed border-[#cfd9e8] bg-white/25 text-xs text-[#8d98a7]">
              暂无封面；正文中的第一张图片将自动作为封面
            </div>
          )}
        </section>

        {article?.summary ? (
          <p className="rounded-[14px] bg-white/45 px-4 py-3 text-[13px] leading-6 text-[#5a6068]">
            {article.summary}
          </p>
        ) : null}

        <section>
          <h3 className="mb-3 text-sm font-semibold text-[#3a3a40]">正文</h3>
          <div className="rounded-[18px] border border-white/65 bg-white/35 p-5">
            {renderMarkdown(article?.contentMarkdown)}
          </div>
        </section>
      </div>
      <div className="flex justify-end border-t border-white/65 px-5 py-4 sm:px-6">
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
