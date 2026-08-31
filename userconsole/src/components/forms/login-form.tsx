"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import { createClientID } from "@/lib/client-id";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: String(form.get("username") ?? ""),
          password: String(form.get("password") ?? ""),
          remember: form.get("remember") === "on",
          deviceId: getDeviceID(),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          message?: string;
          reason?: string;
        };
        throw new ApiError(response.status, payload);
      }
      router.replace("/console/dashboard");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "登录失败，请稍后重试",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-[#29434b]">
          企业账号
        </span>
        <input
          required
          type="text"
          name="username"
          autoComplete="username"
          placeholder="请输入企业账号"
          className="h-12 w-full rounded-xl border border-[#d7e3df] bg-white px-4 text-[15px] outline-none transition placeholder:text-[#a5b1b4] focus:border-[#00a98f] focus:ring-4 focus:ring-[#00a98f]/10"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-[#29434b]">
          密码
        </span>
        <input
          required
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="请输入密码"
          defaultValue="geohelper"
          className="h-12 w-full rounded-xl border border-[#d7e3df] bg-white px-4 text-[15px] outline-none transition placeholder:text-[#a5b1b4] focus:border-[#00a98f] focus:ring-4 focus:ring-[#00a98f]/10"
        />
      </label>
      <div className="flex items-center justify-between gap-4 text-sm">
        <label className="flex cursor-pointer items-center gap-2 text-[#5f737a]">
          <input
            name="remember"
            type="checkbox"
            className="h-4 w-4 accent-[#00a98f]"
          />
          记住登录状态
        </label>
        <Link
          href="/forgot-password"
          className="font-medium text-[#008c77] hover:text-[#006d5d]"
        >
          忘记密码？
        </Link>
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#b9473d]"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#071a23] text-[15px] font-semibold text-white shadow-[0_9px_22px_rgba(7,26,35,.16)] transition hover:bg-[#102d37] disabled:cursor-wait disabled:opacity-70"
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : null}
        {loading ? "正在进入工作台…" : "登录 GEOHelper"}
        {loading ? null : <Icon name="arrow-right" className="h-4 w-4" />}
      </button>
      <p className="pt-1 text-center text-xs leading-5 text-[#8b999e]">
        登录即代表你同意
        <Link
          href="#"
          className="mx-1 text-[#5f737a] underline underline-offset-2"
        >
          服务条款
        </Link>
        与
        <Link
          href="#"
          className="ml-1 text-[#5f737a] underline underline-offset-2"
        >
          隐私政策
        </Link>
      </p>
    </form>
  );
}

function getDeviceID() {
  const key = "geo-console-device-id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const value = createClientID();
  window.localStorage.setItem(key, value);
  return value;
}
