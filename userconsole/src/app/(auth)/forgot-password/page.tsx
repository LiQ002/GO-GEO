import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "找回密码",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="w-full">
      <p className="text-xs font-bold tracking-[.16em] text-[#00a98f]">
        ACCOUNT RECOVERY
      </p>
      <h2 className="mt-3 text-[34px] font-semibold tracking-[-.045em]">
        找回登录密码
      </h2>
      <p className="mt-3 text-[15px] leading-7 text-[#708188]">
        输入企业账号邮箱，我们会发送密码重置指引。
      </p>
      <form className="mt-8 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#29434b]">
            登录邮箱
          </span>
          <input
            type="email"
            required
            placeholder="name@company.com"
            className="h-12 w-full rounded-xl border border-[#d7e3df] px-4 outline-none focus:border-[#00a98f] focus:ring-4 focus:ring-[#00a98f]/10"
          />
        </label>
        <button
          type="submit"
          className="h-12 w-full rounded-xl bg-[#071a23] text-sm font-semibold text-white"
        >
          发送重置邮件
        </button>
      </form>
      <Link
        href="/login"
        className="mt-7 block text-center text-sm font-medium text-[#008c77]"
      >
        返回登录
      </Link>
    </div>
  );
}
