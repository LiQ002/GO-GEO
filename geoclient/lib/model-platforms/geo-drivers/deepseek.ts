import type { ModelPlatformGeoDriver } from './types'
import { CHAIN } from './shared'

export const deepseek: ModelPlatformGeoDriver = {
  id: 'deepseek',
  label: 'DeepSeek',
  entryUrl: (baseUrl) => `${baseUrl.replace(/\/$/, '')}`,
  selectors: {
    newConversation: CHAIN`
      [data-testid="new-conversation-button"]
      button:has-text("新对话")
      button:has(svg)
      [aria-label="new chat"]
    `,
    input: CHAIN`
      #chat-input
      textarea[placeholder*="发送消息"]
      textarea[placeholder*="Message DeepSeek"]
      textarea
      [contenteditable="true"]
    `,
    submit: CHAIN`
      [data-testid="send-button"]
      div.ds-button--primary[role="button"]
      div[role="button"][class*="send"]
      button:has-text("发送")
      button[type="submit"]
      button:has(svg)
    `,
    answerContainer: CHAIN`
      .ds-markdown
      .message-content
      [data-testid="message-content"]
      [class*="markdown"]
      [role="main"] > div:last-child
    `,
    citation: CHAIN`
      a[href^="http"]
      .ds-citation a
      [class*="citation"] a
    `,
    citationList: CHAIN`
      .ds-markdown__citation
      .ds-citations
      [data-citation-list]
    `,
    shareButton: CHAIN`
      [aria-label="分享"]
      [aria-label*="share" i]
      .ds-icon-btn[aria-label*="share" i]
      div[role="button"]:has(svg path[d*="7.95889"])
      div[role="button"]:has(svg path[d*="7.72451"])
    `,
    createShareLinkButton: CHAIN`
      .ds-button:has(.ds-button__content):has-text("创建分享链接")
      .ds-button:has(.ds-button__content):has-text("创建并复制")
      button:has-text("创建分享链接")
      button:has-text("创建并复制")
      button:has-text("复制链接")
      .ds-button:has(.ds-button__content)
    `,
    shareLinkInput: CHAIN`
      input[readonly][value*="share"]
      input[value*="/share/"]
      a[href*="/share/"]
      span.ds-copyable-text-line__text
      span[class*="copyable-text"]
    `,
  },
  submitWithEnter: true,
  answerAppearTimeoutMs: 20_000,
  completion: { kind: 'stable', idleMs: 2_500, timeoutMs: 120_000 },
  maxTotalWaitMs: 150_000,
  inputSteps: [
    { kind: 'fill', description: '输入消息' },
    { kind: 'click-submit', fallbackEnter: true, description: '点击发送' },
  ],
  inputRetryCount: 1,
  // DeepSeek 分享 URL 格式：https://chat.deepseek.com/share/<id>
  // 配置特化 pattern，平台改 URL 格式时只需更新此处，无需改 worker 代码
  shareUrlPatterns: ['\\/share\\/'],
  networkShareApi: {
    urlPattern: /chat\.deepseek\.com\/api\/v0\/share\/create/i,
    method: 'POST',
    buildUrl: (payload: unknown) => {
      const p = payload as { data?: { biz_data?: { share_id?: string } } }
      const shareId = p?.data?.biz_data?.share_id
      return shareId ? `https://chat.deepseek.com/share/${shareId}` : undefined
    },
  },
}
