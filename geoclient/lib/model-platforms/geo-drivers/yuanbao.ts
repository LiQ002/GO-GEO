import type { ModelPlatformGeoDriver } from './types'
import { CHAIN } from './shared'

export const yuanbao: ModelPlatformGeoDriver = {
  id: 'yuanbao',
  label: '腾讯元宝',
  entryUrl: (baseUrl) => `${baseUrl.replace(/\/$/, '')}/chat`,
  selectors: {
    input: CHAIN`
      .ql-editor.ql-blank
      .ql-editor
      textarea[placeholder*="问她"]
      textarea[placeholder*="输入"]
      textarea
      [contenteditable="true"]
    `,
    submit: CHAIN`
      #yuanbao-send-btn
      a[aria-label="发送"]
      a[class*="send-btn"]
      button[class*="send"]
      [data-testid="send-button"]
      button[type="submit"]
    `,
    answerContainer: CHAIN`
      #chat-content
      .agent-dialogue__content--common__content
      .hyc-common-markdown
      [class*="chat-message"]
      [role="main"] > div:last-child
    `,
    citation: CHAIN`
      .hyc-common-markdown__ref-list a[href^="http"]
      .hyc-common-markdown__ref-list__item a[href^="http"]
      a[href^="http"]
    `,
    citationList: CHAIN`
      .hyc-common-markdown__ref-list
      .hyc-common-markdown__ref-list--merged
    `,
    shareButton: CHAIN`
      [aria-label="分享"]
      [aria-label*="share" i]
      [class*="Toolbar_shareIcon"]
      [class*="share-icon"]
      [title*="分享"]
    `,
    createShareLinkButton: CHAIN`
      div.agent-chat__share-bar__item:has-text("复制链接")
      div[class*="share-bar__item"]:has-text("复制链接")
      button:has-text("复制链接")
      [role="button"]:has-text("复制链接")
      button:has-text("复制")
    `,
    shareLinkInput: CHAIN`
      input[readonly][value*="yb.tencent.com/s/"]
      input[readonly][value*="/share/"]
      input[value*="/share/"]
      a[href*="yb.tencent.com/s/"]
      a[href*="/share/"]
    `,
  },
  submitWithEnter: true,
  answerAppearTimeoutMs: 20_000,
  completion: { kind: 'stable', idleMs: 8_000, timeoutMs: 180_000, minDurationAfterStartMs: 20_000 },
  maxTotalWaitMs: 200_000,
  shareUrlPatterns: ['yb\\.tencent\\.com\\/s/'],
  networkShareApi: {
    urlPattern: /yuanbao\.tencent\.com\/api\/conversations\/v2\/share/i,
    method: 'POST',
    buildUrl: (payload: unknown) => {
      const p = payload as { shareId?: string; data?: { shareId?: string } }
      const shareId = p?.shareId || p?.data?.shareId
      if (!shareId) return undefined
      return `https://yb.tencent.com/s/${shareId}`
    },
  },
  inputSteps: [
    { kind: 'fill', description: '输入消息' },
    { kind: 'click-submit', fallbackEnter: true, description: '点击发送' },
  ],
  inputRetryCount: 1,
}
