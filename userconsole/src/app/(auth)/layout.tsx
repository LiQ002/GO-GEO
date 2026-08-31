import { BrandLogo } from "@/components/ui/brand-logo";
import { Icon } from "@/components/ui/icon";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[#071a23] px-12 py-10 text-white lg:flex lg:flex-col xl:px-20">
        <div className="absolute inset-0 opacity-40 site-grid" />
        <div className="absolute -left-20 bottom-10 h-96 w-96 rounded-full bg-[#00a98f]/20 blur-3xl" />
        <div className="relative [&_span]:text-white">
          <BrandLogo />
        </div>
        <div className="relative my-auto max-w-[580px] py-16">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#4b6e74] bg-white/5 text-[#4fd8bb]">
            <Icon name="sparkles" className="h-6 w-6" />
          </div>
          <h1 className="text-[46px] font-semibold leading-[1.16] tracking-[-.05em] xl:text-[56px]">
            让每一次 AI 提问，都成为品牌机会
          </h1>
          <p className="mt-6 max-w-[500px] text-[16px] leading-8 text-[#9fb3ba]">
            从监测品牌可见度，到生成内容、完成投放与验证结果，一站式建立可持续的
            GEO 增长闭环。
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              ["12+", "监测平台"],
              ["98.6%", "任务可追溯"],
              ["7×24", "持续洞察"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[.04] p-4"
              >
                <strong className="text-xl text-[#54d9bd]">{value}</strong>
                <p className="mt-2 text-xs text-[#8da4ac]">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-[#66828a]">
          © 2026 GEOHelper · AI 时代的品牌增长引擎
        </p>
      </section>
      <section className="flex min-h-screen flex-col px-5 py-7 sm:px-10 lg:px-14 xl:px-24">
        <div className="lg:hidden">
          <BrandLogo />
        </div>
        <div className="mx-auto flex w-full max-w-[430px] flex-1 items-center py-12">
          {children}
        </div>
      </section>
    </main>
  );
}
