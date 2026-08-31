import type { Metadata } from "next";
import { ProductPage } from "@/components/marketing/product-page";

export const metadata: Metadata = {
  title: "产品能力",
  description: "覆盖监测、洞察、内容生成、投放与验证的 GEO 增长闭环。",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  return (
    <ProductPage
      eyebrow="PRODUCT CAPABILITIES"
      title="从一次 AI 回答"
      highlight="走向可持续品牌增长"
      description="把品牌知识、用户问题、内容生产、渠道投放和效果监测连接在同一套工作流中。"
      items={[
        {
          icon: "geo",
          title: "全平台 AI 可见度监测",
          description:
            "围绕真实用户问题持续采集 AI 回答，识别品牌是否被提及、处于什么位置、引用了哪些来源。",
          meta: "MONITOR",
        },
        {
          icon: "trend",
          title: "竞品差距与机会洞察",
          description:
            "对比同一问题下品牌与竞品的回答表现，发现值得优先覆盖的主题、证据与渠道缺口。",
          meta: "INSIGHT",
        },
        {
          icon: "sparkles",
          title: "可信内容智能生成",
          description:
            "基于企业知识库、文章类型和渠道规则生成内容，保留模板版本、知识来源、模型与用量证据。",
          meta: "CONTENT",
        },
        {
          icon: "send",
          title: "任务化投放与结果验证",
          description:
            "将审核后的不可变内容快照投放到目标渠道，追踪尝试、回执、收录与后续 GEO 表现。",
          meta: "EXECUTE",
        },
      ]}
    />
  );
}
