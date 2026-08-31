import type { ModelPlatformGeoDriver } from './types'
import { CHAIN } from './shared'

export const wenxin: ModelPlatformGeoDriver = {
  id: 'wenxin',
  label: '文心一言',
  entryUrl: (baseUrl) => `${baseUrl.replace(/\/$/, '')}`,
  selectors: {
    input: CHAIN`
      textarea[placeholder*="输入"]
      #kw
      textarea
      [contenteditable="true"]
    `,
    submit: CHAIN`
      span.ci-submit-button
      .ci-submit-button
      img#ci-submit-button-ai
      #ci-submit-button-ai
      img.ci-submit-button-ai-active
      [class*="ci-submit-button"]
      button[class*="send"]
      button:has-text("发送")
      [data-testid="send-button"]
      button[type="submit"]
    `,
    answerContainer: CHAIN`
      .cosd-markdown-content
      .cosd-markdown
      .ai-markdown
      [class*="_answer-container_"]
      .conversation-flow-answer-container
      [class*="answer-container"]
      [class*="answer"]
      [role="main"] > div:last-child
    `,
    citation: CHAIN`
      [class*="_reference-item_"] a[href^="http"]
      [class*="reference-item"] a[href^="http"]
      a[href^="http"]
    `,
    citationList: CHAIN`
      [class*="_reference-list_"]
      [class*="reference-list"]
      ul:has([class*="_reference-item_"])
      ol:has([class*="_reference-item_"])
    `,
    // 文心分享按钮：
    // - 桌面端：span[data-testid="menu-btn-share"]（菜单项中）
    // - 移动端：div[data-testid="wise-interact-share"]（操作栏直接显示，class 含 _share_）
    shareButton: CHAIN`
      [data-testid="menu-btn-share"]
      span[data-testid="menu-btn-share"]
      [data-testid="wise-interact-share"]
      div[data-testid="wise-interact-share"]
      [class*="_share_"]:has(.cos-icon-share1)
    `,
    createShareLinkButton: CHAIN`
      button.cos-button:has-text("复制链接")
      button:has-text("复制链接")
      [class*="share"] button
    `,
    shareLinkInput: CHAIN`
      input[readonly][value*="baidu"]
      input[value*="/share/"]
      input[value*="/chat/"]
      a[href*="/share/"]
      a[href*="/chat/"]
    `,
  },
  submitWithEnter: true,
  answerAppearTimeoutMs: 20_000,
  completion: { kind: 'stable', idleMs: 3_500, timeoutMs: 180_000, minDurationAfterStartMs: 15_000 },
  maxTotalWaitMs: 200_000,
  // 文心一言：仅 PC 端走 shortURL API，移动端点击分享直接复制到剪贴板（不走 API）
  networkShareApi: {
    urlPattern: /chat\.baidu\.com\/aichat\/api\/shortURL/i,
    method: 'POST',
    buildUrl: (payload: unknown) => {
      const p = payload as { data?: { short_url?: string } }
      return p?.data?.short_url
    },
  },
  shareUrlPatterns: ['baidu\\.com\\/(?:r\\/|ug_share)'],
  inputSteps: [
    { kind: 'fill', description: '输入消息' },
    { kind: 'click-submit', fallbackEnter: true, description: '点击发送' },
  ],
  inputRetryCount: 1,
}
