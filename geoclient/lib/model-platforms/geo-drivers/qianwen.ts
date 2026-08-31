import type { ModelPlatformGeoDriver } from './types'
import { CHAIN } from './shared'

export const qianwen: ModelPlatformGeoDriver = {
  id: 'qianwen',
  label: '通义千问',
  entryUrl: (baseUrl) => `${baseUrl.replace(/\/$/, '')}`,
  selectors: {
    input: CHAIN`
      [data-slate-editor="true"]
      div[contenteditable="true"][class*="chat-input"]
      div[contenteditable="true"][class*="message-input"]
      div[contenteditable="true"][class*="input-area"]
      textarea[placeholder*="输入"]
      textarea
      [contenteditable="true"]
    `,
    submit: CHAIN`
      button[aria-label="发送消息"]
      button[aria-label*="发送"]
      button[class*="send"]
      [data-testid="send-button"]
      button[type="submit"]
    `,
    answerContainer: CHAIN`
      [class*="answer-item"]
      [class*="receive-message"]
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
      [data-testid*="share" i]
      [aria-label*="分享"]
      [aria-label*="share" i]
      [title*="分享"]
      [class*="share-icon"]
      [class*="share-btn"]
    `,
    createShareLinkButton: CHAIN`
      button:has-text("复制链接")
      button:has-text("复制")
      [class*="share"] button
    `,
    shareLinkInput: CHAIN`
      input[readonly][value*="qianwen"]
      input[value*="/chat/"]
      a[href*="/chat/"]
    `,
  },
  submitWithEnter: true,
  answerAppearTimeoutMs: 20_000,
  completion: { kind: 'stable', idleMs: 3_500, timeoutMs: 180_000 },
  maxTotalWaitMs: 200_000,
  networkShareApi: {
    urlPattern: /qianwen\.com\/api\/v1\/share\/create/i,
    method: 'POST',
    buildUrl: (payload: unknown) => {
      const p = payload as { data?: { share_id?: string } }
      const shareId = p?.data?.share_id
      return shareId ? `https://qianwen.my.cn/share/chat/${shareId}` : undefined
    },
  },
  shareUrlPatterns: ['qianwen\\.my\\.cn\\/share\\/'],
  inputSteps: [
    {
      kind: 'dismiss-popup',
      selector: CHAIN`
        [data-testid="home-guide-carousel"] button[aria-label="关闭"]
        button[aria-label="关闭"][class*="cursor-pointer"]:not([class*="opacity-0"])
        button:has-text("我知道了")
        button:has-text("知道了")
        .driver-popover-close-btn
      `,
      description: '关闭引导弹窗',
    },
    { kind: 'fill', description: '输入消息' },
    { kind: 'click-submit', fallbackEnter: true, description: '点击发送' },
  ],
  inputRetryCount: 2,
}
