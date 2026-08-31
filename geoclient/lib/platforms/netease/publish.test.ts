import type { Page } from 'puppeteer'
import { describe, expect, it, vi } from 'vitest'
import type { PublishArticleInput } from '../types'
import { NETEASE_SELECTORS, publishNeteaseArticle } from './publish'

function createNeteasePage() {
  let currentUrl = 'https://mp.163.com/subscribe_v4/index.html#/article-publish'
  const evaluateElement = vi.fn(
    async (selector: string, _callback: unknown, ...values: unknown[]) => {
      if (selector === NETEASE_SELECTORS.title) return values[0]
      if (selector === NETEASE_SELECTORS.editor && values.length === 0) {
        return { text: '示例正文', imageCount: 0 }
      }
      return undefined
    },
  )
  const click = vi.fn(async (selector: string) => {
    if (selector === NETEASE_SELECTORS.publishButton) {
      currentUrl = 'https://mp.163.com/subscribe_v4/index.html#/article-manage'
    }
  })
  const page = {
    $eval: evaluateElement,
    click,
    url: vi.fn(() => currentUrl),
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    waitForNetworkIdle: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue({}),
  } as unknown as Page

  return { click, evaluateElement, page }
}

describe('NetEase article publisher', () => {
  it('fills title and HTML content before selecting automatic cover and publishing', async () => {
    const { click, evaluateElement, page } = createNeteasePage()
    const article: PublishArticleInput = {
      title: `  ${'网'.repeat(65)}  `,
      content: '<h1>一级标题</h1><p>示例正文</p>',
    }

    await expect(publishNeteaseArticle(page, article)).resolves.toBe(
      'https://mp.163.com/subscribe_v4/index.html#/article-manage',
    )

    expect(evaluateElement).toHaveBeenCalledWith(
      NETEASE_SELECTORS.title,
      expect.any(Function),
      '网'.repeat(64),
    )
    expect(evaluateElement).toHaveBeenCalledWith(
      NETEASE_SELECTORS.editor,
      expect.any(Function),
      article.content,
      '一级标题\n示例正文',
    )
    expect(click).toHaveBeenNthCalledWith(1, NETEASE_SELECTORS.autoCover)
    expect(click).toHaveBeenNthCalledWith(2, NETEASE_SELECTORS.publishButton)
  })

  it('rejects a title shorter than the platform minimum', async () => {
    const { page } = createNeteasePage()

    await expect(
      publishNeteaseArticle(page, { title: '四个字', content: '<p>正文</p>' }),
    ).rejects.toThrow('网易号标题不能少于 5 个字')
  })

  it('uses one explicit selector for every operation', () => {
    expect(NETEASE_SELECTORS).toEqual({
      title: 'textarea.netease-textarea[placeholder="请输入标题 (5~64个字)"]',
      editor:
        'div.notranslate.public-DraftEditor-content[contenteditable="true"][role="textbox"]',
      autoCover:
        '::-p-xpath(//span[@class="ne-switch-base-label-text" and normalize-space(.)="自动"])',
      publishButton: '::-p-xpath(//button[normalize-space(.)="发布"])',
    })
  })
})
