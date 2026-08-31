"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { consoleSections } from "@/lib/console-sections";
import { useConsoleData } from "./console-data-provider";
import { useRealnameGuard } from "./console-shell";

export function ConsoleHeaderTools({ onOpenMenu }: { onOpenMenu: () => void }) {
  const {
    getRecords,
    logout,
    markAllNotificationsRead,
    markNotificationRead,
    notifications,
    profile,
  } = useConsoleData();
  // 复用 ConsoleShell 顶层的实名认证 + 套餐拦截，让顶部"创建文章"等入口与侧边栏行为一致。
  const { guard } = useRealnameGuard();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalized) return [];
    return Object.entries(consoleSections)
      .flatMap(([section, config]) =>
        getRecords(section).map((record) => ({
          id: record.id,
          label: record.values[0],
          meta: config.title,
          section,
        })),
      )
      .filter((item) =>
        `${item.label} ${item.meta}`
          .toLocaleLowerCase("zh-CN")
          .includes(normalized),
      )
      .slice(0, 6);
  }, [getRecords, query]);

  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const enterpriseName = profile?.name || "企业账号";

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="打开导航"
          className="glass-control flex h-10 w-10 items-center justify-center rounded-[13px] text-[#4a4a50] lg:hidden"
          onClick={onOpenMenu}
        >
          <Icon name="menu" className="h-5 w-5" />
        </button>
        <fieldset
          className="relative min-w-0 border-0 p-0"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setSearchOpen(false);
          }}
        >
          <label className="glass-control hidden h-10 w-[310px] items-center gap-2 rounded-[14px] px-3 text-[#85858b] md:flex">
            <Icon name="search" className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              aria-label="全局搜索"
              placeholder="搜索文章、问题或任务"
              className="min-w-0 flex-1 bg-transparent text-sm text-[#333338] outline-none placeholder:text-[#929299]"
            />
            <kbd className="rounded-md border border-white/80 bg-white/60 px-1.5 py-0.5 text-[10px] text-[#77777e] shadow-sm">
              ⌘ K
            </kbd>
          </label>
          <button
            type="button"
            aria-label="全局搜索"
            className="glass-control flex h-10 w-10 items-center justify-center rounded-[13px] text-[#64646b] md:hidden"
            onClick={() => setSearchOpen((current) => !current)}
          >
            <Icon name="search" className="h-5 w-5" />
          </button>
          {searchOpen ? (
            <div className="console-glass-header absolute left-0 top-12 z-50 w-[min(88vw,420px)] overflow-hidden rounded-[20px] p-2 shadow-[0_22px_50px_rgba(60,72,105,.18)]">
              <label className="glass-control mb-2 flex h-10 items-center gap-2 rounded-[13px] px-3 md:hidden">
                <Icon name="search" className="h-4 w-4 text-[#85858b]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索文章、问题或任务"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
              {!query ? (
                <p className="px-3 py-8 text-center text-xs text-[#85858c]">
                  输入名称可搜索全部业务数据
                </p>
              ) : null}
              {query && results.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-[#85858c]">
                  没有找到匹配内容
                </p>
              ) : null}
              {results.map((result) => {
                const href = `/console/${result.section}?q=${encodeURIComponent(result.label)}`;
                return (
                  <Link
                    key={result.id}
                    href={href}
                    onClick={(e) => {
                      guard(href)(e);
                      if (!e.defaultPrevented) setSearchOpen(false);
                    }}
                    className="flex items-center gap-3 rounded-[14px] px-3 py-3 hover:bg-white/60"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#e6efff]/80 text-[#3478f6]">
                      <Icon name="search" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-[#3a3a40]">
                        {result.label}
                      </span>
                      <span className="mt-1 block text-[10px] text-[#85858c]">
                        {result.meta}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </fieldset>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/console/articles/new"
          onClick={guard("/console/articles/new")}
          className="hidden h-10 items-center gap-2 rounded-[14px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(69,112,235,.25),inset_0_1px_0_rgba(255,255,255,.28)] transition hover:-translate-y-0.5 sm:flex"
        >
          <Icon name="plus" className="h-4 w-4" />
          创建文章
        </Link>
        <fieldset
          className="relative min-w-0 border-0 p-0"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setNotificationsOpen(false);
          }}
        >
          <button
            type="button"
            aria-label={`通知，${unreadCount} 条未读`}
            className="relative flex h-10 w-10 items-center justify-center rounded-[13px] text-[#64646b] hover:bg-white/55"
            onClick={() => setNotificationsOpen((current) => !current)}
          >
            <Icon name="bell" className="h-5 w-5" />
            {unreadCount ? (
              <span className="absolute right-1.5 top-1 min-w-4 rounded-full border-2 border-white bg-[#ef675b] px-0.5 text-[8px] font-bold leading-3 text-white">
                {unreadCount}
              </span>
            ) : null}
          </button>
          {notificationsOpen ? (
            <div className="console-glass-header absolute right-0 top-12 z-50 w-[min(88vw,380px)] overflow-hidden rounded-[20px] shadow-[0_22px_50px_rgba(60,72,105,.18)]">
              <div className="flex items-center justify-between border-b border-white/65 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">通知中心</p>
                  <p className="mt-0.5 text-[10px] text-[#85858c]">
                    {unreadCount} 条未读消息
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void markAllNotificationsRead()}
                  className="text-[11px] font-medium text-[#3478f6]"
                >
                  全部已读
                </button>
              </div>
              <div className="p-2">
                {notifications.map((item) => {
                  const id = String(item.id ?? "");
                  const read = Boolean(item.readAt);
                  const content = notificationContent(
                    item.payloadJson,
                    item.templateCode,
                  );
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        read || !id ? undefined : void markNotificationRead(id)
                      }
                      className="flex w-full gap-3 rounded-[14px] p-3 text-left hover:bg-white/55"
                    >
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${read ? "bg-[#c9c9ce]" : "bg-[#3478f6]"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-[#3a3a40]">
                          {content.title}
                        </span>
                        <span className="mt-1 block text-[11px] leading-5 text-[#77777e]">
                          {content.detail}
                        </span>
                        <span className="mt-1 block text-[10px] text-[#9a9aa0]">
                          {formatNotificationTime(item.createdAt)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </fieldset>
        <div className="h-7 w-px bg-white/75" />
        <fieldset
          className="relative min-w-0 border-0 p-0"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setAccountOpen(false);
          }}
        >
          <button
            type="button"
            aria-label="企业账号菜单"
            className="flex items-center gap-2 rounded-[14px] p-1.5 hover:bg-white/55"
            onClick={() => setAccountOpen((current) => !current)}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-[linear-gradient(145deg,#dbecff,#e8ddff)] text-xs font-semibold text-[#4d65d9] shadow-[inset_0_1px_0_white]">
              {enterpriseName.slice(0, 1)}
            </span>
            <span className="hidden text-left md:block">
              <span className="block text-xs font-semibold text-[#333338]">
                {enterpriseName}
              </span>
              <span className="mt-0.5 block text-[10px] text-[#8b999e]">
                {profile?.planName || "企业版"}
              </span>
            </span>
            <Icon
              name="chevron-down"
              className="hidden h-3.5 w-3.5 text-[#87969a] md:block"
            />
          </button>
          {accountOpen ? (
            <div className="console-glass-header absolute right-0 top-12 z-50 w-56 rounded-[18px] p-2 shadow-[0_22px_50px_rgba(60,72,105,.18)]">
              <div className="border-b border-white/65 px-3 py-3">
                <p className="text-xs font-semibold">{enterpriseName}</p>
                <p className="mt-1 truncate text-[10px] text-[#85858c]">
                  {profile?.contactEmail || profile?.code || "企业账号"}
                </p>
              </div>
              <Link
                href="/console/settings"
                onClick={(e) => {
                  guard("/console/settings")(e);
                  if (!e.defaultPrevented) setAccountOpen(false);
                }}
                className="mt-1 flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-xs font-medium text-[#4d4d54] hover:bg-white/60"
              >
                <Icon name="settings" className="h-4 w-4" />
                企业设置
              </Link>
              <Link
                href="/console/subscription"
                onClick={(e) => {
                  guard("/console/subscription")(e);
                  if (!e.defaultPrevented) setAccountOpen(false);
                }}
                className="flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-xs font-medium text-[#4d4d54] hover:bg-white/60"
              >
                <Icon name="wallet" className="h-4 w-4" />
                套餐与用量
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-xs font-medium text-[#d65a50] hover:bg-[#fff0ed]/70"
              >
                <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
                退出登录
              </button>
            </div>
          ) : null}
        </fieldset>
      </div>
    </>
  );
}

function notificationContent(payloadJSON?: string, templateCode?: string) {
  if (payloadJSON) {
    try {
      const payload = JSON.parse(payloadJSON) as Record<string, unknown>;
      return {
        title: String(
          payload.title ?? payload.subject ?? templateCode ?? "系统通知",
        ),
        detail: String(
          payload.detail ??
            payload.message ??
            payload.content ??
            "请进入相关页面查看详情",
        ),
      };
    } catch {
      // Invalid historical payloads fall back to the template code.
    }
  }
  return {
    title: templateCode || "系统通知",
    detail: "请进入相关页面查看详情",
  };
}

function formatNotificationTime(value?: string) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
