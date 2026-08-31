import type { IconName } from "@/components/ui/icon";

export type ConsoleSection = {
  action?: string;
  allowDelete?: boolean;
  allowEdit?: boolean;
  columns: string[];
  description: string;
  hasStatus?: boolean;
  icon: IconName;
  title: string;
};

export const consoleSections: Record<string, ConsoleSection> = {
  brand: {
    action: "添加品牌",
    columns: ["品牌名称", "行业", "官方网站", "所在地区", "更新时间", "状态"],
    description:
      "维护企业品牌、产品与核心表达，为内容生成和 GEO 监测提供统一语义基线。",
    icon: "brand",
    title: "品牌中心",
  },
  knowledge: {
    action: "添加知识",
    columns: ["内容标题", "分类", "内容摘要", "更新时间"],
    description:
      "按预置分类直接沉淀企业事实、产品卖点、案例与表达规范，文章生成时会自动引用。",
    hasStatus: false,
    icon: "database",
    title: "企业知识",
  },
  keywords: {
    action: "添加关键词",
    columns: [
      "关键词",
      "所属品牌",
      "目标区域",
      "问题进度",
      "更新时间",
      "蒸馏状态",
    ],
    description:
      "从关键词和可选区域蒸馏真实用户问题，生成后直接用于文章生成与 GEO 监测。",
    icon: "target",
    title: "关键词与问题",
  },
  articles: {
    action: "创建文章",
    columns: ["文章标题", "类型", "所属品牌", "更新时间", "质量评分", "状态"],
    description:
      "从品牌知识生成可信内容，管理版本、审核状态、投放渠道与用量证据。",
    icon: "article",
    title: "文章内容",
  },
  publishing: {
    action: "新建投放",
    allowDelete: false,
    columns: ["计划名称", "投放文章", "平台数", "任务进度", "创建时间", "状态"],
    description:
      "一个投放计划可包含多篇文章×多个平台，展开计划可查看每条投放任务的执行状态。",
    icon: "send",
    title: "内容投放",
  },
  geo: {
    action: "新建监测",
    allowDelete: true,
    columns: [
      "计划名称",
      "所属品牌",
      "执行方式",
      "下次执行",
      "最近执行",
      "状态",
    ],
    description:
      "监测不同 AI 平台的回答、品牌提及与引用证据，识别竞品差距和增长机会。",
    icon: "geo",
    title: "GEO 洞察",
  },
  authorizations: {
    allowDelete: false,
    allowEdit: false,
    columns: ["平台账号", "用途", "授权标识", "最近验证", "有效期", "状态"],
    description:
      "查看内容渠道与 GEO 检查站点的授权状态；新增、更新及撤销授权均需在 GEOHelper 客户端完成。",
    icon: "key",
    title: "平台授权",
  },
};

export const staticSectionSlugs = Object.keys(consoleSections);
