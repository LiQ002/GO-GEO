import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";

export const metadata: Metadata = {
  title: "GEOHelper - 让品牌成为 AI 答案中的首选",
  alternates: { canonical: "/" },
};

const capabilityCards: Array<{
  icon: IconName;
  eyebrow: string;
  title: string;
  description: string;
  metric: string;
  metricLabel: string;
}> = [
  {
    icon: "geo",
    eyebrow: "MONITOR",
    title: "看清品牌的 AI 可见度",
    description:
      "持续监测主流 AI 平台中的品牌提及、引用位置与竞品差距，还原用户真实决策场景。",
    metric: "12+",
    metricLabel: "主流 AI 与搜索平台",
  },
  {
    icon: "sparkles",
    eyebrow: "OPTIMIZE",
    title: "生成真正可被 AI 理解的内容",
    description:
      "基于品牌知识、目标问题和渠道规则生成高可信内容，并保留来源与版本证据。",
    metric: "3.6×",
    metricLabel: "内容生产效率提升",
  },
  {
    icon: "rocket",
    eyebrow: "GROW",
    title: "把洞察变成持续增长",
    description:
      "从内容投放到收录验证形成闭环，让每个优化动作都能被衡量、复盘与持续迭代。",
    metric: "+42%",
    metricLabel: "平均品牌提及增长",
  },
];

const steps = [
  [
    "01",
    "建立品牌知识",
    "沉淀品牌、产品、案例与专业资料，让 AI 准确理解你是谁。",
  ],
  ["02", "发现关键问题", "识别客户在决策前真正会向 AI 提出的高价值问题。"],
  [
    "03",
    "生成并投放内容",
    "生成符合平台规则的可信内容，按计划分发到目标渠道。",
  ],
  [
    "04",
    "追踪可见度增长",
    "监测提及、引用与排名变化，把有效经验复用到下一轮。",
  ],
];

export default function HomePage() {
  return (
    <>
      <section className="hero-glow site-grid relative overflow-hidden px-5 pb-24 pt-20 lg:px-8 lg:pb-32 lg:pt-28">
        <div className="mx-auto grid max-w-[1200px] items-center gap-16 lg:grid-cols-[1.02fr_.98fr]">
          <div className="fade-up relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#bde7dc] bg-white/85 px-4 py-2 text-xs font-semibold tracking-[.14em] text-[#008c77] shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00b99a] shadow-[0_0_0_5px_rgba(0,185,154,.12)]" />
              GENERATIVE ENGINE OPTIMIZATION
            </div>
            <h1 className="max-w-[680px] text-[44px] font-semibold leading-[1.08] tracking-[-.055em] text-[#071a23] sm:text-[58px] lg:text-[70px]">
              让品牌成为
              <br />
              <span className="text-gradient">AI 答案中的首选</span>
            </h1>
            <p className="mt-7 max-w-[590px] text-[17px] leading-8 text-[#536a72] sm:text-[19px]">
              追踪品牌在主流 AI
              平台中的真实表现，找到增长缺口，持续生产高可信内容，让用户提问时，AI
              更愿意推荐你。
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-[#071a23] px-6 text-[15px] font-semibold text-white shadow-[0_10px_25px_rgba(7,26,35,.18)] transition hover:-translate-y-0.5 hover:bg-[#102e38]"
              >
                免费开始优化
                <Icon name="arrow-right" className="h-4 w-4" />
              </Link>
              <Link
                href="/features"
                className="inline-flex h-13 items-center justify-center rounded-xl border border-[#cfded9] bg-white/70 px-6 text-[15px] font-semibold text-[#17333c] transition hover:border-[#8fcfc0] hover:bg-white"
              >
                查看产品能力
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-[13px] text-[#667b82]">
              {["无需信用卡", "7 天完整试用", "支持主流 AI 平台"].map(
                (text) => (
                  <span key={text} className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#dff8f1] text-[#00947d]">
                      <Icon name="check" className="h-3 w-3" />
                    </span>
                    {text}
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="fade-up-delay relative mx-auto w-full max-w-[580px] lg:mx-0">
            <div className="absolute -left-6 -top-8 h-36 w-36 rounded-full bg-[#69dfc5]/25 blur-3xl" />
            <div className="glass relative overflow-hidden rounded-[28px] p-3 sm:p-5">
              <div className="rounded-[21px] border border-[#dce9e5] bg-[#fbfdfc] p-5 sm:p-7">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-medium text-[#7a8d92]">
                      品牌 AI 可见度
                    </p>
                    <div className="mt-2 flex items-end gap-2">
                      <strong className="text-[44px] font-semibold tracking-[-.06em] text-[#071a23]">
                        72.8
                      </strong>
                      <span className="mb-2 rounded-full bg-[#daf6ee] px-2 py-1 text-[11px] font-semibold text-[#008c77]">
                        ↑ 12.6%
                      </span>
                    </div>
                  </div>
                  <span className="rounded-xl bg-[#e6faf5] p-3 text-[#00a98f]">
                    <Icon name="trend" className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-7 flex h-36 items-end gap-2 rounded-xl bg-gradient-to-b from-[#f4fbf9] to-transparent px-3 pt-4">
                  {[
                    ["07-01", 34],
                    ["07-02", 45],
                    ["07-03", 40],
                    ["07-04", 57],
                    ["07-05", 52],
                    ["07-06", 66],
                    ["07-07", 61],
                    ["07-08", 74],
                    ["07-09", 68],
                    ["07-10", 82],
                    ["07-11", 76],
                    ["07-12", 92],
                  ].map(([date, height], index) => (
                    <div
                      key={date}
                      className="group flex h-full flex-1 items-end"
                    >
                      <div
                        className={`w-full rounded-t-[5px] ${index > 8 ? "bg-[#00a98f]" : "bg-[#b8e8dc]"}`}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between px-2 text-[10px] text-[#9aa8ac]">
                  <span>7 月 01</span>
                  <span>7 月 07</span>
                  <span>7 月 14</span>
                  <span>今天</span>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2.5">
                  {[
                    ["品牌提及", "286", "+38"],
                    ["有效引用", "124", "+19"],
                    ["推荐排名", "Top 3", "+2"],
                  ].map(([label, value, delta]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-[#e2ece9] bg-white p-3"
                    >
                      <p className="text-[10px] text-[#7f9196]">{label}</p>
                      <p className="mt-1.5 text-[16px] font-semibold tracking-tight text-[#18343d]">
                        {value}
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-[#00a98f]">
                        {delta} 本周
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="float-soft absolute -bottom-8 -left-5 hidden rounded-2xl border border-white bg-white p-4 shadow-[0_18px_45px_rgba(7,26,35,.13)] sm:flex sm:items-center sm:gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff3dc] text-[#e49610]">
                <Icon name="sparkles" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] text-[#7b8c91]">新增机会问题</p>
                <p className="mt-1 text-sm font-semibold">
                  发现 18 个高价值问题
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e7eeec] bg-white px-5 py-8 lg:px-8">
        <div className="mx-auto flex max-w-[1050px] flex-col items-center justify-between gap-6 md:flex-row">
          <p className="text-center text-xs font-semibold tracking-[.14em] text-[#91a0a4] md:text-left">
            持续监测主流 AI 平台
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[15px] font-semibold text-[#51666d] sm:gap-x-12">
            <span>DeepSeek</span>
            <span>通义千问</span>
            <span>Kimi</span>
            <span>豆包</span>
            <span>腾讯元宝</span>
          </div>
        </div>
      </section>

      <section
        className="bg-white px-5 py-24 lg:px-8 lg:py-32"
        id="capabilities"
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold tracking-[.18em] text-[#00a98f]">
              FROM SIGNAL TO GROWTH
            </p>
            <h2 className="mt-4 text-[34px] font-semibold tracking-[-.045em] text-[#071a23] sm:text-[44px]">
              不只是监测，更是一套增长闭环
            </h2>
            <p className="mt-5 text-[16px] leading-7 text-[#667b82]">
              把散落的 AI 回答转化为清晰洞察，再转化为可执行、可验证的内容行动。
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {capabilityCards.map((card) => (
              <article
                key={card.title}
                className="lift rounded-[22px] border border-[#dfe9e6] bg-[#fbfdfc] p-7 lg:p-8"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e5f9f4] text-[#00a98f]">
                    <Icon name={card.icon} className="h-6 w-6" />
                  </span>
                  <span className="text-[10px] font-bold tracking-[.18em] text-[#9aa8ac]">
                    {card.eyebrow}
                  </span>
                </div>
                <h3 className="mt-7 text-[22px] font-semibold tracking-[-.03em]">
                  {card.title}
                </h3>
                <p className="mt-4 min-h-24 text-[14px] leading-7 text-[#667b82]">
                  {card.description}
                </p>
                <div className="mt-7 border-t border-[#e4ecea] pt-6">
                  <strong className="text-[30px] font-semibold tracking-[-.04em] text-[#00a98f]">
                    {card.metric}
                  </strong>
                  <p className="mt-1 text-xs text-[#87969a]">
                    {card.metricLabel}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-[#071a23] px-5 py-24 text-white lg:px-8 lg:py-28">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid items-end gap-8 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold tracking-[.18em] text-[#51d7ba]">
                A SIMPLE LOOP
              </p>
              <h2 className="mt-4 max-w-xl text-[34px] font-semibold leading-tight tracking-[-.045em] sm:text-[44px]">
                四步建立你的 AI 品牌增长飞轮
              </h2>
            </div>
            <p className="max-w-lg text-[15px] leading-7 text-[#9eb2b9] md:justify-self-end">
              从品牌资产到最终结果，每个环节都有清晰状态、证据与数据反馈，让团队始终知道下一步该做什么。
            </p>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-[22px] border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-4">
            {steps.map(([number, title, description]) => (
              <div
                key={number}
                className="relative bg-[#0b222c] p-7 lg:min-h-64 lg:p-8"
              >
                <span className="text-[42px] font-light tracking-[-.06em] text-[#28505a]">
                  {number}
                </span>
                <h3 className="mt-8 text-lg font-semibold">{title}</h3>
                <p className="mt-4 text-sm leading-6 text-[#91a8af]">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#eef9f6] px-5 py-24 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-[1120px] items-center gap-12 rounded-[28px] border border-[#cfe9e2] bg-white p-7 shadow-[0_22px_70px_rgba(7,26,35,.08)] md:grid-cols-[.9fr_1.1fr] md:p-12 lg:p-16">
          <div>
            <div className="flex gap-1 text-[#f0a83c]">★★★★★</div>
            <blockquote className="mt-6 text-[23px] font-medium leading-[1.55] tracking-[-.025em] text-[#17333c] sm:text-[28px]">
              “过去我们只知道搜索排名，现在第一次看清品牌在 AI
              决策链条里的真实位置。”
            </blockquote>
            <div className="mt-8 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#dff8f1] text-sm font-semibold text-[#008c77]">
                周
              </span>
              <div>
                <p className="text-sm font-semibold">周予安 · 品牌增长负责人</p>
                <p className="mt-1 text-xs text-[#839398]">某企业服务品牌</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ["8 周", "形成首轮优化闭环"],
              ["+47%", "AI 品牌提及率"],
              ["126", "新增有效引用"],
              ["2.8×", "内容团队产能"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl bg-[#f5faf8] p-5 sm:p-6">
                <strong className="text-[27px] font-semibold tracking-[-.04em] text-[#00a98f] sm:text-[34px]">
                  {value}
                </strong>
                <p className="mt-2 text-xs leading-5 text-[#73868c]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-24 lg:px-8 lg:py-28">
        <div className="site-grid relative mx-auto max-w-[1120px] overflow-hidden rounded-[28px] bg-[#071a23] px-7 py-16 text-center text-white sm:px-12">
          <div className="absolute left-1/2 top-0 h-56 w-96 -translate-x-1/2 rounded-full bg-[#00a98f]/20 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-bold tracking-[.18em] text-[#57d9bd]">
              START YOUR GEO JOURNEY
            </p>
            <h2 className="mx-auto mt-5 max-w-2xl text-[34px] font-semibold tracking-[-.045em] sm:text-[46px]">
              从下一次 AI 提问开始，让客户先看见你
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-[#a8bbc1]">
              7 天完整试用，快速建立第一份品牌 AI 可见度基线。
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex h-13 items-center gap-2 rounded-xl bg-[#22c6a5] px-7 text-sm font-semibold text-[#071a23] transition hover:-translate-y-0.5 hover:bg-[#50d7ba]"
            >
              免费开始优化
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
