import type { GeoCitation } from '../../ipc-contract'

/**
 * Per-model-platform GEO query automation driver.
 *
 * Selectors are ordered by preference; the runner tries each until one matches.
 * These selectors are best-effort snapshots of the public chat UIs and will
 * need tuning as platforms evolve. The runner always falls back to generic
 * body-text extraction if every driver-specific selector fails.
 */

export type SelectorChain = string[]

export type CompletionStrategy =
  // minDurationAfterStartMs: 回答开始后至少等待的时间（毫秒），避免流式回答中途暂停被误判为完成。
  // 元宝等流式回答平台在中途会有数秒暂停（等搜索/推理），仅靠 idleMs 不足。
  | { kind: 'stable'; idleMs: number; timeoutMs: number; minDurationAfterStartMs?: number }
  | { kind: 'stop-button'; selector: SelectorChain; timeoutMs: number }
  | { kind: 'fixed'; waitMs: number }

export interface GeoQuerySelectors {
  /** New conversation trigger (optional). */
  newConversation?: SelectorChain
  /** Question input element: textarea or contenteditable. */
  input: SelectorChain
  /** Submit/send button. */
  submit: SelectorChain
  /** 回答内容所在的 iframe 选择器（如纳米 AI 的 iframe.size-full）。未配置时在主文档查找 */
  answerIframe?: SelectorChain
  /** Container of the latest assistant answer. */
  answerContainer: SelectorChain
  /** Citation / source links inside the answer container. */
  citation: SelectorChain
  /** 来源列表容器（底部"引用来源"卡片，通常是 <ol>）。优先于 citation 抓取真实来源。 */
  citationList?: SelectorChain
  /** 分享按钮（右上角"分享"图标按钮），点击后弹出分享对话框。 */
  shareButton?: SelectorChain
  /** 创建分享链接按钮（在分享对话框中，点击后生成可分享的 URL）。 */
  createShareLinkButton?: SelectorChain
  /** 分享链接输入框或文本元素（生成后从中读取 URL）。 */
  shareLinkInput?: SelectorChain
}

/**
 * 输入+提交步骤。借鉴 auth helper 的 step_list 模式，每平台独立配置
 * 从"页面加载完成"到"问题提交"之间的全部自动化操作。
 * 步骤按顺序执行，optional 步骤失败仅告警不中断。
 */
export type InputStep =
  | {
      /** 关闭遮挡输入框的弹窗/浮层（如"稍后再说"、引导卡片） */
      kind: 'dismiss-popup'
      selector: SelectorChain
      optional?: boolean
      /** 等待弹窗出现的最长时长（毫秒），默认 6000。页面加载后弹窗可能延迟渲染 */
      timeoutMs?: number
      description?: string
    }
  | {
      /** 等待页面 URL 匹配 glob 模式（如元宝 /chat/* 表示会话已建立） */
      kind: 'wait-url'
      urlPattern: string
      timeoutMs?: number
      description?: string
    }
  | {
      /** 等待选择器元素出现（is_exist=1）或消失（is_exist=0） */
      kind: 'wait-selector'
      selector: SelectorChain
      /** 1=等待出现（默认），0=等待消失 */
      isExist?: 0 | 1
      timeoutMs?: number
      description?: string
    }
  | {
      /** 点击功能开关（如"智能搜索""联网搜索"），activeClass 存在表示已激活则跳过 */
      kind: 'click-toggle'
      selector: SelectorChain
      activeClass?: string
      optional?: boolean
      description?: string
    }
  | {
      /** 点击按钮/元素（通用点击，存在则点） */
      kind: 'click'
      selector: SelectorChain
      optional?: boolean
      description?: string
    }
  | {
      /** 输入问题到指定元素。未指定 selector 时用 driver.selectors.input */
      kind: 'fill'
      selector?: SelectorChain
      /** 输入方式：auto=自动检测 textarea/contenteditable/slate；exec=用 execCommand */
      mode?: 'auto' | 'exec'
      description?: string
    }
  | {
      /** 按键提交（通常是 Enter） */
      kind: 'press-key'
      key: string
      description?: string
    }
  | {
      /** 点击提交按钮，自动检测 disabled 状态。未指定 selector 时用 driver.selectors.submit */
      kind: 'click-submit'
      selector?: SelectorChain
      /** 按钮仍 disabled 时是否回退到 Enter */
      fallbackEnter?: boolean
      description?: string
    }

export interface ModelPlatformGeoDriver {
  id: string
  label: string
  /** Build the initial URL to open. */
  entryUrl: (baseUrl: string) => string
  /** How to start a fresh isolated conversation, if not automatic by URL. */
  newConversationStrategy?: { kind: 'url-param'; param: string; value: string } | { kind: 'click'; selector: SelectorChain }
  selectors: GeoQuerySelectors
  /** Whether pressing Enter submits the question (used as fallback when submit button is absent/disabled). */
  submitWithEnter: boolean
  /** How long to wait for the answer container to appear after submit. */
  answerAppearTimeoutMs: number
  /** How to decide the answer has finished streaming. */
  completion: CompletionStrategy
  /** Max total time for one question, including streaming. */
  maxTotalWaitMs: number
  /**
   * 输入+提交步骤序列。借鉴 auth helper 的 step_list：
   * 每平台独立配置从页面就绪到问题提交的全部操作（关弹窗→等会话→点开关→输入→提交）。
   * 未配置时回退到旧的 typeQuestion+submitQuestion 逻辑。
   */
  inputSteps?: InputStep[]
  /**
   * inputSteps 整体失败时的重试次数。默认 0（一次失败即放弃）。
   */
  inputRetryCount?: number

  // ─── 平台特化钩子（桌面端/移动端区分） ──────────────────────────────

  /**
   * 移动端专用入口 URL。
   * terminalType=2 时优先使用此 URL（覆盖 authUrl / entryUrl）。
   * 典型场景：纳米AI桌面端 www.n.cn 移动端会跳转下载页，
   * 移动端需用 so.n.cn/tools/aiagent/chat/aiagentv001 才能正常聊天。
   */
  mobileEntryUrl?: string

  /**
   * 判断是否跳过分享链接生成。
   * 返回 true 时，worker 不调用 generateShareLink，直接用页面 URL 作为 sessionRef。
   * 典型场景：移动端智谱没有分享按钮，terminalType=2 时跳过。
   *
   * @param terminalType 1=桌面端, 2=移动端
   */
  shouldSkipShareLink?: (terminalType: number) => boolean

  /**
   * 平台分享 URL 的路径标识（正则源字符串数组）。
   * 用于校验提取到的 URL 是否是该平台的真分享链接。
   * 未配置时回退到通用白名单（/share/ /chat/ /s/ /thread/ 等）。
   * 典型场景：平台未来改 URL 格式时，只需更新 driver 配置，无需改 worker 代码。
   *
   * @example deepseek: ['\\/share\\/']
   */
  shareUrlPatterns?: string[]

  /**
   * 网络接口监听式分享链接提取（优先于 DOM / 剪贴板方案）。
   *
   * 原理：点击"分享"按钮会触发一个后端 API 请求（ POST /api/conversations/v2/share ），
   * 返回体中包含 shareId。监听该响应，提取 shareId 并拼接成可访问的分享 URL。
   *
   * 相比 DOM / 剪贴板方案的优势：
   * - 不依赖剪贴板权限授权（ read() 在部分系统上会被拦截）
   * - 不依赖分享对话框的 DOM 结构（ UI 改版不会断）
   * - 响应体结构稳定（ { shareId: string }）
   *
   * 配置样例（元宝）：
   *   networkShareApi: {
   *     urlPattern: /yuanbao\.tencent\.com\/api\/conversations\/v2\/share/i,
   *     method: 'POST',
   *     buildUrl: (payload) => payload.shareId ? `https://yb.tencent.com/s/${payload.shareId}` : undefined,
   *   }
   */
  networkShareApi?: {
    /** 匹配分享 API 请求 URL 的正则 */
    urlPattern: RegExp
    /** 期望的 HTTP 方法（可选，默认 POST） */
    method?: string
    /** 从响应体 JSON 中构造最终分享 URL，失败时返回 undefined */
    buildUrl: (payload: unknown) => string | undefined
  }
}
