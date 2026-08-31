import {
  BrandStatus,
  brandStatusOptions,
  KnowledgeCategory,
  knowledgeCategoryOptions,
  MonitorPlanStatus,
  MonitorScheduleType,
  monitorPlanStatusOptions,
  monitorScheduleOptions,
  monitorTerminalOptions,
  type NumericOption,
  PublishPlanStatus,
  publishPlanStatusOptions,
} from "./user-enums";

export type ConsoleFormValue = string | number | string[];

export type ConsoleFormField = {
  createOnly?: boolean;
  dynamicOptionSource?: string;
  helper?: string;
  index: number;
  label: string;
  optionSource?: string;
  options?: NumericOption[];
  placeholder?: string;
  required?: boolean;
  textareaRows?: number;
  type?:
    | "text"
    | "number"
    | "textarea"
    | "select"
    | "file"
    | "datetime-local"
    | "multiSelect";
  visibleWhen?: (values: ConsoleFormValue[]) => boolean;
};

export type ConsoleFormConfig = {
  createDescription: string;
  createTitle: string;
  defaults: ConsoleFormValue[];
  fields: ConsoleFormField[];
  modalSize?: "sm" | "md" | "lg";
};

const statuses = [
  "待完善",
  "可用",
  "待审核",
  "已完成",
  "执行中",
  "待执行",
  "正常",
  "需处理",
];

export const consoleFormConfigs: Record<string, ConsoleFormConfig> = {
  brand: {
    createTitle: "添加品牌",
    createDescription: "建立品牌语义基线，后续可继续补充产品、定位和知识资料。",
    defaults: ["", "", "", "", "", BrandStatus.active],
    fields: [
      {
        index: 0,
        label: "品牌名称",
        required: true,
        placeholder: "例如：示例科技",
      },
      {
        index: 1,
        label: "所属行业",
        required: true,
        placeholder: "例如：企业服务 / 软件",
      },
      { index: 2, label: "官方网站", placeholder: "https://example.com" },
      { index: 3, label: "所在地区", placeholder: "例如：中国" },
      {
        index: 4,
        label: "品牌说明",
        type: "textarea",
        placeholder: "品牌定位、核心产品与目标受众",
      },
      {
        index: 5,
        label: "档案状态",
        type: "select",
        options: brandStatusOptions,
      },
    ],
  },
  knowledge: {
    createTitle: "添加企业知识",
    createDescription:
      "直接录入会在 GEO 文章中作为事实上下文的企业知识，无需先创建知识库。",
    defaults: ["", KnowledgeCategory.enterpriseProfile, ""],
    modalSize: "lg",
    fields: [
      {
        index: 0,
        label: "内容标题",
        required: true,
        placeholder: "例如：公司简介 / 核心产品能力",
      },
      {
        index: 1,
        label: "知识分类",
        type: "select",
        options: knowledgeCategoryOptions,
        required: true,
        helper: "分类会随内容一并加入文章生成上下文，帮助模型区分事实用途。",
      },
      {
        index: 2,
        label: "知识内容",
        type: "textarea",
        required: true,
        helper:
          "请填写可核实、可直接引用的事实；客户数据、资质和禁用表述建议单独归类。",
        placeholder: "输入企业、产品、案例或规范的详细内容",
        textareaRows: 12,
      },
    ],
  },
  keywords: {
    createTitle: "添加关键词",
    createDescription:
      "保存关键词后，在关键词主表选择该项并点击“蒸馏问题”配置数量。",
    defaults: ["", "", "", 50],
    fields: [
      {
        index: 0,
        label: "关键词",
        required: true,
        placeholder: "例如：农夫山泉",
      },
      {
        index: 1,
        label: "所属品牌",
        type: "select",
        optionSource: "brands",
        required: true,
      },
      {
        index: 2,
        label: "目标区域（可选）",
        placeholder: "例如：北京；不填写则生成通用问题",
      },
      {
        index: 3,
        label: "优先级",
        type: "number",
        placeholder: "0–100",
      },
    ],
  },
  articles: {
    createTitle: "编辑文章",
    createDescription:
      "修改文章基础信息与审核状态。正文编辑器将在详情页中打开。",
    defaults: ["", "", "", "", "", "draft"],
    fields: [
      { index: 0, label: "文章标题", required: true },
      {
        index: 1,
        label: "文章类型",
        type: "select",
        optionSource: "articleTypes",
        required: true,
      },
      {
        index: 2,
        label: "所属品牌",
        type: "select",
        optionSource: "brands",
        required: true,
      },
      { index: 3, label: "文章摘要", type: "textarea" },
      { index: 4, label: "Markdown 正文", type: "textarea" },
    ],
  },
  publishing: {
    createTitle: "新建投放计划",
    createDescription:
      "支持一次选择多篇内容、多个平台，按去重策略生成投放任务，由安全执行节点领取。",
    defaults: ["", [], "", [], "", "per_platform", PublishPlanStatus.pending],
    fields: [
      {
        index: 0,
        label: "计划名称",
        required: true,
        placeholder: "例如：行业报告首轮投放",
      },
      {
        index: 1,
        createOnly: true,
        label: "投放文章（可多选）",
        type: "multiSelect",
        optionSource: "articles",
        required: true,
        helper: "支持选择多篇内容，所有文章共享同一组投放平台与去重策略。",
      },
      {
        index: 2,
        createOnly: true,
        label: "投稿目标",
        type: "select",
        options: [
          { label: "个人自媒体", value: 1 },
          { label: "官方媒体", value: 2 },
          { label: "大 V", value: 3 },
        ],
        required: true,
      },
      {
        index: 3,
        createOnly: true,
        label: "执行账号/平台（可多选）",
        type: "multiSelect",
        dynamicOptionSource: "publishExecutor",
        required: true,
        helper: "支持选择多个平台。每篇文章将按去重策略分配到这些平台。",
      },
      {
        index: 4,
        createOnly: true,
        label: "计划执行时间",
        type: "datetime-local",
      },
      {
        index: 5,
        createOnly: true,
        label: "去重策略",
        type: "select",
        options: [
          { label: "单平台去重（推荐）", value: "per_platform" },
          { label: "全部去重（轮询分配）", value: "all_unique" },
          { label: "不去重", value: "no_dedup" },
        ],
        required: true,
        helper:
          "单平台去重：同文章不同平台允许，同平台不重复；全部去重：每篇文章只分配一个平台；不去重：允许重复发布。",
      },
      {
        index: 6,
        label: "任务状态",
        type: "select",
        options: publishPlanStatusOptions,
      },
    ],
  },
  geo: {
    createTitle: "新建 GEO 监测",
    createDescription:
      "选择品牌与关键词，从问题库挑选蒸馏问题，指定已授权的 AI 平台，按频率自动查收录并扣减点数。",
    defaults: [
      "",
      "",
      "",
      [],
      [],
      3, // 默认并行：PC + 移动端
      MonitorScheduleType.once,
      "",
      "",
      MonitorPlanStatus.active,
    ],
    fields: [
      {
        index: 0,
        label: "监测计划名称",
        required: true,
        placeholder: "例如：核心品牌问题每日监测",
      },
      {
        index: 1,
        createOnly: true,
        label: "所属品牌",
        type: "select",
        optionSource: "brands",
        required: true,
      },
      {
        index: 2,
        createOnly: true,
        label: "关键词",
        type: "select",
        dynamicOptionSource: "keywordsByBrand",
        required: true,
        helper: "选择品牌下的关键词，问题列表将根据关键词自动过滤。",
      },
      {
        index: 3,
        createOnly: true,
        label: "问题库（可多选）",
        type: "multiSelect",
        dynamicOptionSource: "questionsByKeyword",
        required: true,
        helper:
          "选中关键词后显示对应的已审核问题列表，支持多选。每个问题将在所有选中站点执行查询。",
        visibleWhen: (values) => Boolean(values[2]),
      },
      {
        index: 4,
        createOnly: true,
        label: "检查站点（可多选）",
        type: "multiSelect",
        dynamicOptionSource: "geoExecutor",
        required: true,
        helper: "选择已授权的 AI 平台（如 DeepSeek、豆包、千问等），支持多选。",
      },
      {
        index: 5,
        createOnly: true,
        label: "监测终端",
        type: "select",
        options: monitorTerminalOptions,
        required: true,
        helper:
          "选择查收录的终端类型。并行模式会同时在电脑端和移动端执行，结果在数据报表中分别展示。",
      },
      {
        index: 6,
        createOnly: true,
        label: "执行频率",
        type: "select",
        options: monitorScheduleOptions,
        required: true,
        helper:
          "查收录按次扣费，请根据预算选择合适的频率。单次=执行一轮即结束；周期=按 Cron 自动循环。",
      },
      {
        index: 7,
        createOnly: true,
        label: "执行时间",
        type: "datetime-local",
        helper:
          "单次执行的计划开始时间；周期频率下作为首次执行时间。留空则立即执行。",
        visibleWhen: (values) => {
          const schedule = Number(values[6]);
          return (
            schedule !== MonitorScheduleType.manual &&
            schedule !== MonitorScheduleType.hourly
          );
        },
      },
      {
        index: 8,
        createOnly: true,
        label: "Cron 表达式",
        type: "text",
        placeholder: "例如：0 9 * * 1-5（工作日每天 9 点）",
        required: true,
        helper:
          "标准 5 段 Cron：分 时 日 月 周。仅「自定义 Cron」频率下需要填写。",
        visibleWhen: (values) => Number(values[6]) === MonitorScheduleType.cron,
      },
      {
        index: 9,
        label: "监测状态",
        type: "select",
        options: monitorPlanStatusOptions,
      },
    ],
  },
};

export function getStatusOptions(rows: string[][]) {
  return Array.from(
    new Set([...statuses, ...rows.map((row) => row[row.length - 1])]),
  )
    .filter(Boolean)
    .map((label, index) => ({ label, value: index + 1 }));
}
