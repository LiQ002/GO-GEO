import type { Metadata } from "next";
import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = {
  title: "登录",
  description: "登录 GEOHelper 企业工作台。",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="w-full">
      <p className="text-xs font-bold tracking-[.16em] text-[#00a98f]">
        WELCOME BACK
      </p>
      <h2 className="mt-3 text-[34px] font-semibold tracking-[-.045em] text-[#071a23]">
        登录企业工作台
      </h2>
      <p className="mt-3 text-[15px] leading-7 text-[#708188]">
        管理品牌知识、内容任务与 AI 可见度表现。
      </p>
      <LoginForm />
      <div className="mt-8 flex items-center gap-3">
        <span className="h-px flex-1 bg-[#e3ebe9]" />
        <span className="text-xs text-[#9ba8ac]">企业账号由平台统一开通</span>
        <span className="h-px flex-1 bg-[#e3ebe9]" />
      </div>
      <p className="mt-7 text-center text-sm text-[#708188]">
        还没有账号？{" "}
        <a
          href="mailto:hello@geohelper.cn"
          className="font-semibold text-[#008c77]"
        >
          联系顾问开通
        </a>
      </p>
    </div>
  );
}
