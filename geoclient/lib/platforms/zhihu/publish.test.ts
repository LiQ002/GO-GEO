import type { ElementHandle, Page } from 'puppeteer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PublishArticleInput } from '../types'
import { publishZhihuArticle, ZHIHU_SELECTORS } from './publish'

const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

function createZhihuPage() {
  let currentUrl = 'https://zhuanlan.zhihu.com/write'
  const uploadFile = vi.fn().mockResolvedValue(undefined)
  const coverInput = { uploadFile } as unknown as ElementHandle<HTMLInputElement>
  const publishConfirmButton = {
    click: vi.fn().mockResolvedValue(undefined),
  } as unknown as ElementHandle<Element>

  const waitForSelector = vi.fn(async (selector: string) => {
    if (selector === ZHIHU_SELECTORS.coverInput) return coverInput
    if (selector === ZHIHU_SELECTORS.publishConfirmButton) return publishConfirmButton
    return {} as ElementHandle<Element>
  })
  const evaluateElement = vi.fn(
    async (selector: string, _callback: unknown, ...values: unknown[]) => {
      if (selector === ZHIHU_SELECTORS.title) return values[0]
      if (selector === ZHIHU_SELECTORS.editor && values.length === 0) {
        return { text: '示例正文', imageCount: 1 }
      }
      return undefined
    },
  )
  const click = vi.fn(async (selector: string) => {
    if (selector === ZHIHU_SELECTORS.publishButton) {
      currentUrl = 'https://zhuanlan.zhihu.com/p/123456'
    }
  })
  const page = {
    $: vi.fn().mockResolvedValue(null),
    $eval: evaluateElement,
    click,
    url: vi.fn(() => currentUrl),
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    waitForNetworkIdle: vi.fn().mockResolvedValue(undefined),
    waitForSelector,
  } as unknown as Page

  return {
    page,
    click,
    evaluateElement,
    publishConfirmButton,
    uploadFile,
    waitForSelector,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Zhihu article publisher', () => {
  it('fills the explicit Zhihu fields and publishes through the two configured actions', async () => {
    vi.useFakeTimers()
    const { page, click, evaluateElement, publishConfirmButton, uploadFile } = createZhihuPage()
    const article: PublishArticleInput = {
      title: `  ${'知'.repeat(101)}  `,
      content: '<h2>示例正文</h2><p>正文段落</p><img src="https://example.com/a.png">',
      cover: ONE_PIXEL_PNG,
    }

    const publishPromise = publishZhihuArticle(page, article)
    await vi.runAllTimersAsync()
    await expect(publishPromise).resolves.toBe('https://zhuanlan.zhihu.com/p/123456')

    expect(evaluateElement).toHaveBeenCalledWith(
      ZHIHU_SELECTORS.title,
      expect.any(Function),
      '知'.repeat(100),
    )
    expect(evaluateElement).toHaveBeenCalledWith(
      ZHIHU_SELECTORS.editor,
      expect.any(Function),
      article.content,
      '示例正文\n正文段落',
    )
    expect(uploadFile).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledWith(ZHIHU_SELECTORS.publishButton)
    expect(publishConfirmButton.click).toHaveBeenCalledOnce()
  })

  it('does not keep the old guessed inline-image upload steps', () => {
    expect(Object.keys(ZHIHU_SELECTORS)).toEqual([
      'title',
      'editor',
      'coverInput',
      'saveStatus',
      'publishButton',
      'publishConfirmButton',
      'success',
    ])
  })
})
