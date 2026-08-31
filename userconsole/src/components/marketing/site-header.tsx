"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Icon } from "@/components/ui/icon";

const links = [
  { href: "/features", label: "产品能力" },
  { href: "/solutions/enterprise", label: "解决方案" },
  { href: "/pricing", label: "价格" },
  { href: "/download", label: "客户端下载" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[#e3ece9]/80 bg-white/88 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-5 lg:px-8">
        <BrandLogo />

        <nav className="hidden items-center gap-8 text-[14px] font-medium text-[#496169] md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-[#00a98f]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="px-3 py-2 text-[14px] font-medium text-[#28434b] hover:text-[#00a98f]"
          >
            登录
          </Link>
          <Link
            href="/login"
            className="rounded-xl bg-[#071a23] px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_7px_18px_rgba(7,26,35,.14)] transition hover:-translate-y-0.5 hover:bg-[#102d37]"
          >
            免费开始
          </Link>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce7e4] text-[#17333c] md:hidden"
          aria-label={open ? "关闭菜单" : "打开菜单"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? "x" : "menu"} className="h-5 w-5" />
        </button>
      </div>

      {open ? (
        <div className="border-t border-[#e7efed] bg-white px-5 py-5 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl px-3 py-3 text-[15px] font-medium text-[#29434c] hover:bg-[#f1f8f6]"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              href="/login"
              className="rounded-xl border border-[#dce7e4] px-4 py-3 text-center text-sm font-semibold"
            >
              登录
            </Link>
            <Link
              href="/login"
              className="rounded-xl bg-[#071a23] px-4 py-3 text-center text-sm font-semibold text-white"
            >
              免费开始
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
