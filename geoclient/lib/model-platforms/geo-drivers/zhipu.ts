import type { ModelPlatformGeoDriver } from './types'
import { CHAIN } from './shared'

export const zhipu: ModelPlatformGeoDriver = {
  id: 'zhipu',
  label: '智谱清言',
  entryUrl: (baseUrl) => `${baseUrl.replace(/\/$/, '')}`,
  selectors: {
    input: CHAIN`
      textarea[placeholder*="输入"]
      textarea[placeholder]:not([style*="display: none"]):not([style*="display:none"])
      textarea:not([style*="display"])
      [contenteditable="true"]
      [class*="input-area"]
      [class*="chat-input"]
    `,
    submit: CHAIN`
      div.enter-icon-container
      .enter-icon-container
      div[class*="enter-icon"]
      button[class*="send"]
      [data-testid="send-button"]
      button[type="submit"]
    `,
    answerContainer: CHAIN`
      .answer-content .flex1
      .answer-content-wrap .markdown-body
      .answer-content-wrap
      #row-answer-0 .markdown-body
      .markdown-body
      [class*="answer-content"]
      [role="main"] > div:last-child
    `,
    citation: CHAIN`
      a[href^="http"]
      [class*="source"] a
      [class*="reference"] a
    `,
    // 智谱分享按钮：div.share 或 i.share
    // generateShareLink 的 fallback 会用 evaluate 按 SVG path data 匹配
    shareButton: CHAIN`
      div.share > i.share
      div.share
      i.share.el-tooltip__trigger
      i.share
    `,
    createShareLinkButton: CHAIN`
      div.generate-share-source-link:has-text("复制链接")
      div[class*="generate-share-source"]
      button:has-text("复制链接")
      [class*="share"] button
    `,
    shareLinkInput: CHAIN`
      input[readonly][value*="zhipu"]
      input[value*="/chat/"]
      input[value*="/share/"]
      a[href*="/chat/"]
      a[href*="/share/"]
    `,
  },
  submitWithEnter: true,
  answerAppearTimeoutMs: 20_000,
  completion: {
    kind: 'stop-button',
    selector: CHAIN`
      div.enter.is-main-chat.searching
      div[class*="enter"][class*="searching"]
      div[class*="stop"][class*="chat"]
    `,
    timeoutMs: 180_000,
  },
  maxTotalWaitMs: 200_000,
  networkShareApi: {
    urlPattern: /chatglm\.cn\/chatglm\/share-api\/short\/assistant_history/i,
    method: 'POST',
    buildUrl: (payload: unknown) => {
      const p = payload as { result?: { short_url?: string } }
      const shortUrl = p?.result?.short_url
      if (!shortUrl) return undefined
      // short_url 格式为 /share/xxx，需拼接 chatglm.cn 域名（非 t2.chatglm.cn）
      return `https://chatglm.cn${shortUrl}`
    },
  },
  shareUrlPatterns: ['chatglm\\.cn\\/share\\/'],
  inputSteps: [
    { kind: 'fill', description: '输入消息' },
    { kind: 'press-key', key: 'Enter', description: '提交' },
  ],
  inputRetryCount: 1,
  // 智谱移动端：移动版页面没有分享按钮（操作栏只有拷贝，顶部也没有 share-icon-box），
  // 移动端任务跳过分享链接生成，直接用页面 URL 作为 sessionRef。
  // 桌面端正常走 generateShareLink 流程。
  shouldSkipShareLink: (terminalType: number) => terminalType === 2,
}
