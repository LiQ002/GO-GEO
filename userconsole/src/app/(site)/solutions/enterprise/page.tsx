import type { Metadata } from "next";
import { ProductPage } from "@/components/marketing/product-page";

export const metadata: Metadata = {
  title: "企业 GEO 解决方案",
  description: "帮助企业建立从品牌知识到 AI 可见度增长的完整机制。",
  alternates: { canonical: "/solutions/enterprise" },
};

export default function EnterpriseSolutionPage() {
  return (
    <ProductPage
      eyebrow="ENTERPRISE SOLUTION"
      title="让品牌知识成为"
      highlight="AI 愿意引用的可信答案"
      description="适合需要建立专业心智、拥有复杂产品线或希望系统化推进 AI 搜索增长的企业团队。"
      items={[
        {
          icon: "database",
          title: "建立统一品牌事实源",
          description:
            "集中维护品牌、产品、案例和行业资料，减少内容团队重复查找与表达漂移。",
          meta: "KNOWLEDGE",
        },
        {
          icon: "target",
          title: "围绕客户决策问题组织内容",
          description:
            "从关键词走向完整问题和决策意图，让内容更贴近 AI 回答的组织方式。",
          meta: "INTENT",
        },
        {
          icon: "layers",
          title: "跨团队协作与版本追溯",
          description:
            "对文章、任务、模板和投放结果保留状态与版本证据，让每次改进都有依据。",
          meta: "WORKFLOW",
        },
        {
          icon: "trend",
          title: "用结果指导下一轮投入",
          description:
            "通过品牌提及、引用和平台差距判断哪些主题有效，形成持续优化的增长飞轮。",
          meta: "GROWTH",
        },
      ]}
    />
  );
}
