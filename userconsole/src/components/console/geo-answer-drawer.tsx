"use client";

import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import {
  type UserV1GeoAnswer,
  type UserV1GeoCitation,
  type UserV1GeoMention,
  userApi,
} from "@/lib/api/user-api.generated";
import { markdownToArticleHTML } from "@/lib/article-content";
import { Icon } from "../ui/icon";
import { Modal } from "./modal";

type GeoAnswerDrawerProps = {
  onClose: () => void;
  open: boolean;
  taskId: string | null;
};

const sentimentLabels: Record<string, string> = {
  positive: "正面",
  neutral: "中性",
  negative: "负面",
};

function formatScore(value?: number) {
  if (value === undefined || value === null) return "-";
  return `${Math.round(value * 100) / 100}`;
}

function formatPercent(value?: number) {
  if (value === undefined || value === null) return "-";
  return `${Math.round(value * 1000) / 10}%`;
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function scoreTone(score?: number) {
  if (score === undefined || score === null) return "text-[#717179]";
  if (score >= 0.8) return "text-[#1f9d63]";
  if (score >= 0.5) return "text-[#d99a1a]";
  return "text-[#d65a50]";
}

function CitationRow({
  citation,
  index,
}: {
  citation: UserV1GeoCitation;
  index: number;
}) {
  const url = citation.url || "";
  const domain = citation.domain || url;
  return (
    <li className="flex items-start gap-3 rounded-[12px] bg-white/55 px-3 py-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#3f8fff]/12 text-[11px] font-semibold text-[#3f8fff]">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {citation.title ? (
            <span className="truncate text-[13px] font-medium text-[#3a3a40]">
              {citation.title}
            </span>
          ) : null}
          {citation.enterpriseSource ? (
            <span className="rounded-full bg-[#1f9d63]/12 px-2 py-0.5 text-[10px] font-semibold text-[#1f9d63]">
              企业来源
            </span>
          ) : null}
        </div>
        {domain ? (
          <a
            href={url || undefined}
            target={url ? "_blank" : undefined}
            rel="noreferrer"
            className={`mt-0.5 block truncate text-[11px] ${url ? "text-[#3f8fff] underline" : "text-[#9a9aa0]"}`}
          >
            {domain}
          </a>
        ) : null}
      </div>
      {citation.position ? (
        <span className="shrink-0 text-[10px] font-medium text-[#9a9aa0]">
          位置 #{citation.position}
        </span>
      ) : null}
    </li>
  );
}

function MentionRow({ mention }: { mention: UserV1GeoMention }) {
  const sentiment =
    sentimentLabels[mention.sentiment ?? ""] ?? mention.sentiment ?? "-";
  const sentimentTone =
    mention.sentiment === "positive"
      ? "text-[#1f9d63]"
      : mention.sentiment === "negative"
        ? "text-[#d65a50]"
        : "text-[#717179]";
  return (
    <li className="flex items-start gap-3 rounded-[12px] bg-white/55 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#6e6af4]/12 px-2 py-0.5 text-[10px] font-semibold text-[#6e6af4]">
            {mention.entityType || "实体"}
          </span>
          {mention.text ? (
            <span className="text-[13px] text-[#3a3a40]">{mention.text}</span>
          ) : null}
        </div>
        {mention.position ? (
          <span className="mt-0.5 block text-[10px] text-[#9a9aa0]">
            位置 #{mention.position}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className={`text-[11px] font-semibold ${sentimentTone}`}>
          {sentiment}
        </span>
        {mention.confidence !== undefined ? (
          <span className="text-[10px] text-[#9a9aa0]">
            {formatPercent(mention.confidence)}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function parseShareUrl(evidenceJson?: string): string {
  if (!evidenceJson) return "";
  try {
    const parsed = JSON.parse(evidenceJson);
    if (typeof parsed === "object" && parsed !== null) {
      const candidates = [
        parsed.share_url,
        parsed.shareUrl,
        parsed.share_link,
        parsed.shareLink,
        parsed.conversation_url,
        parsed.conversationUrl,
        parsed.url,
      ];
      for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.startsWith("http")) {
          return candidate;
        }
      }
    }
  } catch {
    // evidenceJson 不是有效 JSON，尝试直接匹配 URL
    const match = evidenceJson.match(/https?:\/\/[^\s"']+\/share\/[^\s"']+/);
    if (match) return match[0];
  }
  return "";
}

export function GeoAnswerDrawer({
  onClose,
  open,
  taskId,
}: GeoAnswerDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<UserV1GeoAnswer | null>(null);

  useEffect(() => {
    if (!open || !taskId) return;
    let active = true;
    setLoading(true);
    setError("");
    setAnswer(null);
    void userApi.geoMonitor
      .getGeoAnswer(taskId)
      .then((loaded) => {
        if (active) setAnswer(loaded);
      })
      .catch((caught) => {
        if (active)
          setError(caught instanceof Error ? caught.message : "回答加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, taskId]);

  const citations = answer?.citations ?? [];
  const mentions = answer?.mentions ?? [];
  const hasAnswer = Boolean(answer?.answerText);
  const shareUrl = parseShareUrl(answer?.evidenceJson);
  const answerHtml = useMemo(() => {
    if (!answer?.answerText) return "";
    const html = markdownToArticleHTML(answer.answerText);
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  }, [answer?.answerText]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="收录详情"
      description={
        answer?.questionText || "查看 AI 平台对话原文、引用来源与品牌提及"
      }
      size="lg"
    >
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#717179]">
            <Icon name="sparkles" className="h-4 w-4 animate-pulse" />
            正在加载回答…
          </div>
        ) : error ? (
          <p className="rounded-[14px] bg-[#fff0ed]/75 px-4 py-3 text-xs text-[#d65a50]">
            {error}
          </p>
        ) : !answer ? (
          <p className="py-12 text-center text-sm text-[#717179]">
            暂无回答数据
          </p>
        ) : (
          <div className="space-y-5">
            {answer.questionText ? (
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#717179]">
                  问题
                </h3>
                <p className="mt-1.5 text-[14px] leading-6 text-[#25252a]">
                  {answer.questionText}
                </p>
              </section>
            ) : null}

            <section>
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#717179]">
                  对话原文
                </h3>
                {answer.answerStatus ? (
                  <span className="rounded-full bg-[#3f8fff]/12 px-2 py-0.5 text-[10px] font-semibold text-[#3f8fff]">
                    {answer.answerStatus}
                  </span>
                ) : null}
              </div>
              {hasAnswer ? (
                <div
                  className="geo-answer-prose mt-1.5 max-h-60 overflow-y-auto rounded-[14px] bg-white/55 px-4 py-3 text-[13px] leading-6 text-[#3a3a40]"
                  dangerouslySetInnerHTML={{ __html: answerHtml }}
                />
              ) : (
                <p className="mt-1.5 text-[13px] text-[#9a9aa0]">
                  该任务尚未采集到回答文本
                </p>
              )}
            </section>

            {shareUrl ? (
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#717179]">
                  官方对话链接
                </h3>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-2 rounded-[12px] bg-[#3f8fff]/8 px-3 py-2 text-[12px] font-medium text-[#3f8fff] transition hover:bg-[#3f8fff]/15"
                >
                  <Icon name="arrow-right" className="h-3.5 w-3.5" />
                  {shareUrl}
                </a>
                <p className="mt-1 text-[10px] text-[#9a9aa0]">
                  点击查看 AI 平台的原始对话记录与思考过程
                </p>
              </section>
            ) : null}

            {answer.screenshotKey ? (
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#717179]">
                  采集截图
                </h3>
                <div className="mt-1.5 flex items-center gap-2 rounded-[14px] bg-white/55 px-4 py-3">
                  <Icon
                    name="image"
                    className="h-4 w-4 shrink-0 text-[#9a9aa0]"
                  />
                  <code className="truncate text-[11px] text-[#717179]">
                    {answer.screenshotKey}
                  </code>
                </div>
                <p className="mt-1 text-[10px] text-[#9a9aa0]">
                  截图由安全客户端采集，预览需配置对象存储访问地址
                </p>
              </section>
            ) : null}

            <section className="grid grid-cols-3 gap-3">
              <div className="console-card p-3">
                <p className="text-[10px] font-medium text-[#717179]">可见性</p>
                <p
                  className={`mt-1 text-[20px] font-semibold ${scoreTone(answer.visibilityScore)}`}
                >
                  {formatScore(answer.visibilityScore)}
                </p>
              </div>
              <div className="console-card p-3">
                <p className="text-[10px] font-medium text-[#717179]">准确性</p>
                <p
                  className={`mt-1 text-[20px] font-semibold ${scoreTone(answer.accuracyScore)}`}
                >
                  {formatScore(answer.accuracyScore)}
                </p>
              </div>
              <div className="console-card p-3">
                <p className="text-[10px] font-medium text-[#717179]">置信度</p>
                <p
                  className={`mt-1 text-[20px] font-semibold ${scoreTone(answer.confidence)}`}
                >
                  {formatScore(answer.confidence)}
                </p>
              </div>
            </section>

            <section>
              <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#717179]">
                <Icon name="layers" className="h-3.5 w-3.5" />
                引用来源
                <span className="rounded-full bg-[#3f8fff]/12 px-1.5 text-[10px] text-[#3f8fff]">
                  {citations.length}
                </span>
              </h3>
              {citations.length === 0 ? (
                <p className="mt-1.5 text-[13px] text-[#9a9aa0]">
                  未检测到引用
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {citations.map((citation, index) => (
                    <CitationRow
                      key={`${citation.url ?? index}-${index}`}
                      citation={citation}
                      index={index}
                    />
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#717179]">
                <Icon name="target" className="h-3.5 w-3.5" />
                品牌提及
                <span className="rounded-full bg-[#6e6af4]/12 px-1.5 text-[10px] text-[#6e6af4]">
                  {mentions.length}
                </span>
              </h3>
              {mentions.length === 0 ? (
                <p className="mt-1.5 text-[13px] text-[#9a9aa0]">
                  未检测到品牌提及
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {mentions.map((mention, index) => (
                    <MentionRow
                      key={`${mention.text ?? index}-${index}`}
                      mention={mention}
                    />
                  ))}
                </ul>
              )}
            </section>

            <p className="border-t border-white/55 pt-3 text-[10px] text-[#9a9aa0]">
              采集时间：{formatDateTime(answer.observedAt)}
              {answer.snapshotId ? ` · 快照 #${answer.snapshotId}` : ""}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
