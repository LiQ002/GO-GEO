import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = {
  title: "价格",
  description: "选择适合你当前 GEO 增长阶段的套餐。",
  alternates: { canonical: "/pricing" },
};

const plans = [
  {
    name: "启航版",
    price: "¥1,999",
    description: "适合建立第一份 AI 可见度基线的团队",
    features: [
      "1 个品牌档案",
      "50 个监测问题",
      "20 篇文章 / 月",
      "3 个投放渠道",
    ],
    featured: false,
  },
  {
    name: "增长版",
    price: "¥5,999",
    description: "适合持续运营 GEO 内容闭环的成长企业",
    features: [
      "3 个品牌档案",
      "300 个监测问题",
      "100 篇文章 / 月",
      "全部标准渠道",
      "竞品与机会洞察",
    ],
    featured: true,
  },
  {
    name: "企业版",
    price: "联系顾问",
    description: "适合多品牌、复杂知识与定制流程的企业",
    features: [
      "品牌与用量按需配置",
      "专属数据与安全方案",
      "定制渠道和工作流",
      "专属成功服务",
    ],
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <div className="hero-glow px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[1120px] text-center">
        <p className="text-xs font-bold tracking-[.18em] text-[#00a98f]">
          SIMPLE PRICING
        </p>
        <h1 className="mt-5 text-[42px] font-semibold tracking-[-.055em] sm:text-[56px]">
          从被看见，到被选择
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[16px] leading-7 text-[#667b82]">
          所有套餐均包含 7 天完整试用。正式价格与权益以商务协议为准。
        </p>
      </div>
      <div className="mx-auto mt-14 grid max-w-[1120px] gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.name}
            className={`relative rounded-[24px] border p-7 ${plan.featured ? "border-[#00a98f] bg-[#071a23] text-white shadow-[0_24px_60px_rgba(7,26,35,.18)]" : "border-[#dfe9e6] bg-white"}`}
          >
            {plan.featured ? (
              <span className="absolute -top-3 right-6 rounded-full bg-[#2dd0ae] px-3 py-1 text-[10px] font-bold text-[#071a23]">
                最受欢迎
              </span>
            ) : null}
            <p
              className={`text-sm font-semibold ${plan.featured ? "text-[#60dcc2]" : "text-[#008c77]"}`}
            >
              {plan.name}
            </p>
            <p className="mt-5 text-[31px] font-semibold tracking-[-.045em]">
              {plan.price}
              <span
                className={`text-xs font-normal ${plan.featured ? "text-[#8fa8af]" : "text-[#87969a]"}`}
              >
                {plan.price.startsWith("¥") ? " / 月" : ""}
              </span>
            </p>
            <p
              className={`mt-4 min-h-12 text-sm leading-6 ${plan.featured ? "text-[#9fb3ba]" : "text-[#71848a]"}`}
            >
              {plan.description}
            </p>
            <ul className="mt-7 space-y-4">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Icon
                    name="check"
                    className={`h-4 w-4 ${plan.featured ? "text-[#52d9bd]" : "text-[#00a98f]"}`}
                  />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className={`mt-9 flex h-11 items-center justify-center rounded-xl text-sm font-semibold ${plan.featured ? "bg-[#2bcaaa] text-[#071a23]" : "bg-[#071a23] text-white"}`}
            >
              {plan.price === "联系顾问" ? "联系顾问" : "免费试用"}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
