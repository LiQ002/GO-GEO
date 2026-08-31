import type { Metadata } from "next";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = {
  title: "客户端下载",
  description: "下载 GEOHelper 企业授权客户端。",
  alternates: { canonical: "/download" },
};

export default function DownloadPage() {
  return (
    <section className="hero-glow site-grid px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto grid max-w-[1100px] items-center gap-14 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold tracking-[.18em] text-[#00a98f]">
            DESKTOP CLIENT
          </p>
          <h1 className="mt-5 text-[44px] font-semibold leading-[1.1] tracking-[-.055em] sm:text-[56px]">
            安全连接你的
            <br />
            <span className="text-gradient">企业平台账号</span>
          </h1>
          <p className="mt-6 max-w-xl text-[16px] leading-8 text-[#667b82]">
            授权客户端只处理需要网页登录态的渠道授权与检查任务。敏感凭据不会进入网页或普通业务日志。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              className="flex h-12 items-center gap-2 rounded-xl bg-[#071a23] px-6 text-sm font-semibold text-white"
            >
              <Icon name="download" className="h-4 w-4" />
              下载 macOS 版
            </button>
            <button
              type="button"
              className="flex h-12 items-center gap-2 rounded-xl border border-[#cfddd9] bg-white px-6 text-sm font-semibold text-[#29434b]"
            >
              <Icon name="download" className="h-4 w-4" />
              下载 Windows 版
            </button>
          </div>
          <p className="mt-4 text-xs text-[#93a1a5]">
            当前版本 v0.1.0 · 支持 macOS 13+ / Windows 10+
          </p>
        </div>
        <div className="glass rounded-[28px] p-5">
          <div className="overflow-hidden rounded-[20px] border border-[#dce8e4] bg-white">
            <div className="flex h-11 items-center gap-2 border-b border-[#e5ecea] bg-[#f8faf9] px-4">
              <i className="h-2.5 w-2.5 rounded-full bg-[#ef7d6b]" />
              <i className="h-2.5 w-2.5 rounded-full bg-[#f2bd52]" />
              <i className="h-2.5 w-2.5 rounded-full bg-[#52c58a]" />
              <span className="ml-3 text-[10px] text-[#9aa8ac]">
                GEOHelper Client
              </span>
            </div>
            <div className="p-7">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e3f8f2] text-[#00a98f]">
                <Icon name="key" className="h-6 w-6" />
              </span>
              <h2 className="mt-5 text-xl font-semibold">平台授权中心</h2>
              <p className="mt-2 text-xs leading-6 text-[#71848a]">
                3 个账号连接正常，1 个账号需要更新授权。
              </p>
              <div className="mt-6 space-y-3">
                {[
                  ["知乎 · 示例科技官方", "连接正常"],
                  ["微信公众号 · 示例科技", "5 天后过期"],
                  ["百家号 · 示例科技", "连接正常"],
                ].map(([name, status], index) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-xl bg-[#f5f8f7] p-4 text-xs"
                  >
                    <span className="font-medium text-[#29434b]">{name}</span>
                    <span
                      className={
                        index === 1 ? "text-[#d48623]" : "text-[#00a98f]"
                      }
                    >
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
