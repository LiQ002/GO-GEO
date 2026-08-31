import type { ModelPlatformGeoDriver } from './types'
import { CHAIN } from './shared'

export const kimi: ModelPlatformGeoDriver = {
  id: 'kimi',
  label: 'Kimi',
  entryUrl: (baseUrl) => `${baseUrl.replace(/\/$/, '')}`,
  selectors: {
    input: CHAIN`
      textarea[placeholder*="随时@你想要的AI"]
      textarea[placeholder*="给 Kimi 发送消息"]
      textarea
      [contenteditable="true"]
    `,
    submit: CHAIN`
      div.send-button-container
      div[class*="send-button"]
      button:has(svg[data-icon="send"])
      button[class*="send"]
      [data-testid="send-button"]
      button[type="submit"]
    `,
    answerContainer: CHAIN`
      .chat-content-list
      .segment.segment-assistant .markdown
      .segment-assistant .markdown
      .chat-content-item-assistant .markdown
      [class*="chat-content"]:has(.segment-assistant)
      [class*="chat-content"]
    `,
    citation: CHAIN`
      a[href^="http"]
      [class*="source"] a
      [class*="citation"] a
    `,
    shareButton: CHAIN`
      div.icon-button:has(svg[name="Share_a"])
      div.icon-button:has(svg[name*="share" i])
    `,
    createShareLinkButton: CHAIN`
      div.simple-button:has-text("复制链接")
    `,
    shareLinkInput: CHAIN`
      input[readonly][value*="kimi"]
      input[readonly][value*="/share/"]
      input[value*="/share/"]
      a[href*="/share/"]
    `,
  },
  submitWithEnter: true,
  answerAppearTimeoutMs: 20_000,
  completion: {
    kind: 'stop-button',
    selector: CHAIN`
      div.send-button-container.disabled.stop
      div[class*="send-button"][class*="stop"]
      div[class*="stop-button"]
    `,
    timeoutMs: 180_000,
  },
  maxTotalWaitMs: 200_000,
  // 严格校验分享 URL 必须是 kimi.com 域名下，防止误读剪贴板残留的其他平台链接
  // （即使清空剪贴板失败，残留的 doubao/wenxin 等链接也会被 isValidShareUrl 拒绝）
  shareUrlPatterns: ['kimi\\.com\\/share\\/'],
  networkShareApi: {
    urlPattern: /kimi\.com\/apiv2\/kimi\.gateway\.chat\.v1\.ChatService\/CreateChatShare/i,
    method: 'POST',
    buildUrl: (payload: unknown) => {
      const p = payload as { share?: { url?: string; id?: string } }
      const s = p?.share
      if (!s) return undefined
      if (s.url) return s.url
      if (s.id) return `https://www.kimi.com/share/${s.id}`
      return undefined
    },
  },
  inputSteps: [
    {
      kind: 'dismiss-popup',
      selector: CHAIN`
        button:has-text("稍后再说")
        button:has-text("以后再说")
        [class*="modal"] button:has-text("稍后")
      `,
      description: '关闭引导弹窗',
    },
    { kind: 'fill', description: '输入消息' },
    { kind: 'press-key', key: 'Enter', description: '提交' },
  ],
  inputRetryCount: 1,
}
