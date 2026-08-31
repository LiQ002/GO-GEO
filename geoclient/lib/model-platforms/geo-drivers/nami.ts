import type { ModelPlatformGeoDriver } from './types'
import { CHAIN } from './shared'

export const nami: ModelPlatformGeoDriver = {
  id: 'nami',
  label: '纳米 AI',
  entryUrl: (baseUrl) => `${baseUrl.replace(/\/$/, '')}`,
  selectors: {
    input: CHAIN`
      div[data-placeholder="输入任何问题"]
      div[data-placeholder*="输入"]
      section[data-id="chat-input-empty"] [contenteditable="true"]
      textarea[placeholder*="输入"]
      #NM-ASSISTANT_chat_input
      textarea
      [contenteditable="true"]
    `,
    submit: CHAIN`
      button[class*="send"]
      [data-testid="send-button"]
      button[type="submit"]
    `,
    answerIframe: CHAIN`
      iframe.size-full
      iframe[class*="size-full"]
    `,
    answerContainer: CHAIN`
      [class*="answer-content"]
      [class*="chat-message-content"]
      [class*="message-content"]
      [class*="markdown-body"]
      [class*="markdown"]
      [role="main"] > div:last-child
    `,
    citation: CHAIN`
      a[href^="http"]
      [class*="source"] a
      [class*="reference"] a
    `,
    shareButton: CHAIN`
      .js-action-share
      div.js-action-share
      div:has(use[href="#icon-action_share"])
    `,
    createShareLinkButton: CHAIN`
      div.cursor-pointer:has-text("复制链接")
      div[class*="bg-button-bg-normal"]
      button:has-text("复制链接")
      [class*="share"] button
    `,
    shareLinkInput: CHAIN`
      input[readonly][value*="nami"]
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
      button.stop-btn
      button[class*="stop-btn"]
      button[class*="stop"]
    `,
    timeoutMs: 180_000,
  },
  maxTotalWaitMs: 200_000,
  // 纳米：PC 端走 API 捕获，移动端降级到剪贴板
  networkShareApi: {
    urlPattern: /n\.cn\/api\/share\/gen/i,
    method: 'POST',
    buildUrl: (payload: unknown) => {
      const p = payload as { data?: { id?: string } }
      const id = p?.data?.id
      return id ? `https://www.n.cn/share/mcp?id=${id}&from=pc` : undefined
    },
  },
  shareUrlPatterns: ['n\\.cn\\/(?:share|search)\\b'],
  inputSteps: [
    { kind: 'fill', description: '输入消息' },
    { kind: 'press-key', key: 'Enter', description: '提交' },
  ],
  inputRetryCount: 1,
  // 纳米AI移动端：www.n.cn 在移动UA下会跳转App下载页，
  // 需用 so.n.cn/tools/aiagent/chat/aiagentv001 才能正常聊天。
  // cookie 域名 .n.cn 对 so.n.cn 子域同样有效。
  mobileEntryUrl: 'https://so.n.cn/tools/aiagent/chat/aiagentv001',
}
