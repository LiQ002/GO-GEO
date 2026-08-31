import type { ModelPlatformGeoDriver } from './types'
import { CHAIN } from './shared'

export const doubao: ModelPlatformGeoDriver = {
  id: 'doubao',
  label: '豆包',
  entryUrl: (baseUrl) => `${baseUrl.replace(/\/$/, '')}/chat/`,
  selectors: {
    input: CHAIN`
      textarea[placeholder*="给豆包发消息"]
      textarea[placeholder*="输入消息"]
      textarea
      [contenteditable="true"]
    `,
    submit: CHAIN`
      button#flow-end-msg-send
      button[id*="send-msg"]
      button[class*="send"]
      [data-testid="send-button"]
      button[type="submit"]
    `,
    answerContainer: CHAIN`
      .scrollable-Se7zNt .md-box-root[data-streaming="false"]:last-child
      .scroller.v_list_scroller-BxcoIX .md-box-root[data-streaming="false"]:last-child
      [class*="scrollable"] .md-box-root[data-streaming="false"]:last-child
      [class*="scroller"] .md-box-root[data-streaming="false"]:last-child
      .md-box-root[data-streaming="false"]:last-child
      [class*="chat-message-content"]
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
      [class*="share-icon"]
      [class*="share-btn"]
    `,
    createShareLinkButton: CHAIN`
      button:has-text("复制链接")
      button:has-text("复制")
      [class*="share"] button
    `,
    shareLinkInput: CHAIN`
      input[readonly][value*="doubao"]
      input[value*="/share/"]
      input[value*="/thread/"]
      input[value*="doubao.com/thread"]
      a[href*="/share/"]
      a[href*="/thread/"]
    `,
  },
  submitWithEnter: true,
  answerAppearTimeoutMs: 20_000,
  completion: {
    kind: 'stop-button',
    selector: CHAIN`
      div.break-btn-fISNgC
      div[class*="break-btn"]
      div[class*="stop-btn"]
      button[class*="stop"]
    `,
    timeoutMs: 180_000,
  },
  maxTotalWaitMs: 200_000,
  networkShareApi: {
    urlPattern: /doubao\.com\/im\/message\/share\/save/i,
    method: 'POST',
    buildUrl: (payload: unknown) => {
      const p = payload as { data?: { share_url?: string; share_id?: string } }
      const d = p?.data
      if (!d) return undefined
      if (d.share_url) return d.share_url
      if (d.share_id) return `https://www.doubao.com/thread/${d.share_id}`
      return undefined
    },
  },
  shareUrlPatterns: ['doubao\\.com\\/thread\\/'],
  inputSteps: [
    { kind: 'fill', description: '输入消息' },
    { kind: 'click-submit', fallbackEnter: true, description: '点击发送' },
  ],
  inputRetryCount: 1,
}
