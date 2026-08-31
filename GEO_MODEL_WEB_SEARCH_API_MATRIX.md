# 中国大模型联网搜索 API 能力清单

> 调研日期：2026-08-26
> 用途：GEO 售前诊断的多平台真实问答、引用来源采集与报告汇总。
> 判定原则：只有模型厂商 API 实际返回的 URL、标题、来源名称等结构化数据，才能计入“引用率、引用份额、实际引用来源”等报告指标；模型正文自行生成的链接不算可核验信源。

## 1. 结论清单

| 平台 | 官方联网方式 | API 形态 | 可取得结构化来源 | 当前接入建议 |
| --- | --- | --- | --- | --- |
| DeepSeek | 内置 `web_search` | OpenAI Responses API：`POST /responses` | 支持从完整 Responses 输出中提取 `web_search_call`、正文 annotations 及 URL | P0。本项目诊断改用 Responses API，并强制启用 `web_search`；Base URL 使用 `https://api.deepseek.com` 或兼容配置地址 |
| 阿里云百炼 / 通义千问 | 内置 `web_search`，可组合 `web_extractor` | OpenAI 兼容 Responses API：`POST {base_url}/responses` | 支持，搜索来源位于 `output[].action.sources[]` | P0。本项目诊断改用 Responses API，并强制启用 `web_search`；不依赖 Chat Completions 的私有扩展字段 |
| 火山方舟 / 豆包 | 内置 Web Search | Responses API：`POST /api/v3/responses` | 官方文档说明 Responses 工具可以返回联网搜索过程和来源 | P1。新增豆包供应商后按 Responses 适配器接入，复用本项目通用 Responses 解析器 |
| Kimi / Moonshot | 内置 `$web_search` 或官方 Formula `moonshot/web-search:latest` | Chat Completions Tool Calls + Formula API，不是标准 Responses 流程 | 可由工具调用结果取得搜索数据，但需要执行工具回传的多轮流程 | P1。实现 Kimi 专用 Tool Calls 适配器，不能直接套用 DeepSeek/千问 Responses 请求体 |
| 智谱 GLM | `Web Search in Chat` 或独立 Web Search API | Chat Completions `tools`；独立 `POST /api/paas/v4/web_search` | 支持，独立搜索 API 返回标题、URL、摘要、媒体和发布时间 | P1。优先使用 Web Search in Chat；需要稳定信源明细时可采用“搜索 API + GLM 总结”两段式适配器 |
| 百度千帆 / 文心 | 百度搜索 API；千帆另有 Responses API | 搜索：`POST /v2/ai_search/web_search`；生成：`POST /v2/responses` | 搜索 API 直接返回结构化实时搜索结果 | P2。采用搜索与生成两段式接入；接入前确认目标模型的 Responses 工具支持范围 |
| 腾讯混元 | `EnableEnhancement` 搜索增强，配合 `SearchInfo`、`Citation` | 腾讯云原生 ChatCompletions 或 OpenAI 兼容 Chat API | 命中搜索时可返回 `SearchInfo`，并支持回答角标 | P2。实现混元专用 Chat 参数及 SearchInfo 解析；不是通用 Responses 适配器 |
| MiniMax | 官方文本 API 支持模型生成与工具调用；未在当前官方文本 API 清单中确认内置联网搜索参数 | Chat / Text API；Mini-Agent 可通过 MCP 做 Web Search | 暂未确认模型 API 原生返回联网信源 | 暂缓。不能把 Mini-Agent/MCP 搜索能力当作 MiniMax 模型 API 原生搜索；待官方模型接口明确后再接入 |

## 2. 本项目 P0 接入约定

### 2.1 诊断专用配置

写作、改写等功能继续使用模型原有 Chat Completions 协议。售前诊断单独配置：

- `diagnosis_api_mode = 1`：Chat Completions。
- `diagnosis_api_mode = 2`：Responses API。
- `diagnosis_web_search_enabled = true`：诊断调用加入 `tools: [{"type":"web_search"}]`，并要求模型实际调用搜索工具。
- 启用联网搜索时，`citation_capability` 必须为“接口返回可核验信源元数据”。

这样不会因为诊断改用 Responses API，导致同一个模型的文章生成、问题蒸馏等现有调用失效。

### 2.2 请求与证据保存

DeepSeek、千问的诊断请求统一采用非流式 Responses API：

```json
{
  "model": "provider-model-id",
  "instructions": "诊断系统指令",
  "input": "统一诊断问题",
  "tools": [{ "type": "web_search" }],
  "tool_choice": { "type": "web_search" },
  "store": false
}
```

实际发送时会按供应商适配 `tool_choice`：DeepSeek 使用 `{"type":"web_search"}`，千问使用 `"required"`（当前只有一个 `web_search` 工具，因此等价于强制搜索）。每次调用必须保存：

- 完整请求提示词快照；
- 完整原始 Responses JSON；
- Response ID、实际响应模型、Token 用量和耗时；
- `web_search_call` 搜索来源；
- `output_text.annotations` 中的 URL 引用；
- 去重后的 URL、域名、标题、摘要和来源编号。

报告只聚合数据库中保存的真实调用与真实信源，不从回答正文猜测或补造来源。

## 3. 官方资料

### DeepSeek

- [使用 Responses API](https://api-docs.deepseek.com/zh-cn/guides/responses_api/)
- [Responses API 接口定义](https://api-docs.deepseek.com/api/create-response/)

官方说明 `base_url` 为 `https://api.deepseek.com`；Responses API 支持 `deepseek-v4-flash`、`deepseek-v4-pro` 等模型，并支持服务端执行 `web_search`。

### 阿里云百炼 / 通义千问

- [创建响应（OpenAI 兼容 Responses API）](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-responses)
- [大模型如何联网搜索](https://help.aliyun.com/zh/model-studio/web-search/)

官方说明通过 `tools: [{"type":"web_search"}]` 启用联网搜索；搜索来源位于 `output` 中 `web_search_call.action.sources`。

注意：Responses API 只支持官方页面列出的模型。旧模型名 `qwen-max` 不在当前支持清单中，不能只切换 URL；应另建或调整为官方当前支持的 `qwen-plus`、`qwen3.x-plus/max/flash` 等模型后再启用诊断联网搜索。

### 火山方舟 / 豆包

- [Responses API 工具调用](https://www.volcengine.com/docs/82379/1958524?lang=zh)
- [火山方舟文档入口](https://www.volcengine.com/docs/82379/66619f8df281250274ef4f88?lang=zh)

### Kimi / Moonshot

- [使用 Kimi API 的联网搜索功能](https://platform.kimi.com/docs/guide/use-web-search)
- [如何在 Kimi API 中使用官方工具](https://platform.kimi.com/docs/guide/use-official-tools)

### 智谱 GLM

- [联网搜索能力](https://docs.bigmodel.cn/cn/guide/tools/web-search)
- [网络搜索 API](https://docs.bigmodel.cn/api-reference/%E5%B7%A5%E5%85%B7-api/%E7%BD%91%E7%BB%9C%E6%90%9C%E7%B4%A2)

### 百度千帆

- [百度搜索 API](https://cloud.baidu.com/doc/qianfan/s/2mh4su4uy)
- [创建模型响应](https://cloud.baidu.com/doc/qianfan-api/s/vmhejnuy8)

### 腾讯混元

- [混元 ChatCompletions 参数](https://cloud.tencent.com/document/product/1729/105701)
- [混元 OpenAI 兼容接口](https://cloud.tencent.com/document/product/1729/111007)

### MiniMax

- [MiniMax API 接口概览](https://platform.minimaxi.com/docs/api-reference/api-overview)
- [Mini-Agent 网页搜索与摘要](https://platform.minimaxi.com/docs/token-plan/mini-agent)

## 4. 后续接入顺序

1. DeepSeek Responses + Web Search。
2. 千问 Responses + Web Search。
3. 豆包 Responses + Web Search。
4. Kimi 内置 `$web_search` Tool Calls。
5. 智谱 Web Search in Chat / 独立搜索 API。
6. 百度千帆搜索 + Responses 两段式。
7. 腾讯混元搜索增强。
8. MiniMax 等待模型 API 原生信源能力确认。
