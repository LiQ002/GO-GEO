import type { ElementHandle, Page } from 'puppeteer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublishArticleInput } from '../types'
import { JIANSHU_SELECTORS, publishJianshuArticle } from './publish'

const PUBLISHED_URL = 'https://www.jianshu.com/p/2c1238e4a8c5?v=1786345296317'
const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
const UPLOADED_IMAGE_URL =
  'https://upload-images.jianshu.io/upload_images/12345-test.png'

function createJianshuPage(
  options: {
    blocked?: boolean
    deferPageReady?: boolean
    imageSources?: string[]
    processedContent?: string
  } = {},
) {
  let releasePageReady: () => void = () => undefined
  const pageReady = options.deferPageReady
    ? new Promise<void>((resolve) => {
        releasePageReady = resolve
      })
    : Promise.resolve()
  const click = vi.fn().mockResolvedValue(undefined)
  const waitForSelector = vi.fn().mockResolvedValue({} as ElementHandle<Element>)
  const waitForFunction = vi.fn(
    async (_callback: unknown, waitOptions: { timeout?: number }, ...args: unknown[]) => {
      if (waitOptions.timeout === 60_000 && args.length === 0) await pageReady
    },
  )
  let evaluateCall = 0
  const evaluate = vi.fn(async () => {
    evaluateCall += 1
    if (evaluateCall === 1) return options.imageSources ?? []
    if (options.imageSources?.length && evaluateCall === 2) {
      return { token: 'upload-token', key: 'upload-key' }
    }
    return options.processedContent ?? ARTICLE.content
  })
  const $eval = vi.fn(
    async (selector: string, _callback: unknown, ...args: unknown[]) => {
      if (selector === JIANSHU_SELECTORS.title) return args[0]
      if (selector === JIANSHU_SELECTORS.editor) return 0
      if (selector === JIANSHU_SELECTORS.publishSuccessLink) return PUBLISHED_URL
      return undefined
    },
  )
  const $ = vi.fn(async (selector: string) => {
    if (selector === JIANSHU_SELECTORS.publishBlocked) {
      return options.blocked ? ({} as ElementHandle<Element>) : null
    }
    if (selector === JIANSHU_SELECTORS.publishSuccessLink) {
      return options.blocked ? null : ({} as ElementHandle<Element>)
    }
    return null
  })
  const page = {
    $,
    $eval,
    click,
    evaluate,
    url: vi.fn(() => 'https://www.jianshu.com/writer#/notebooks/57203451'),
    waitForFunction,
    waitForSelector,
  } as unknown as Page

  return {
    $,
    $eval,
    click,
    evaluate,
    page,
    releasePageReady,
    waitForFunction,
    waitForSelector,
  }
}

const ARTICLE: PublishArticleInput = {
  title: '简书发布流程测试',
  content: '<p>第一段正文</p><p>第二段正文</p>',
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Jianshu article publisher', () => {
  it('creates, fills and publishes an article using the observed controls', async () => {
    const { click, page, releasePageReady, waitForFunction, waitForSelector } =
      createJianshuPage({ deferPageReady: true })

    const publishPromise = publishJianshuArticle(page, ARTICLE)
    const resultExpectation = expect(publishPromise).resolves.toEqual({
      platformArticleId: '2c1238e4a8c5',
      publishedUrl: 'https://www.jianshu.com/p/2c1238e4a8c5',
    })
    await Promise.resolve()
    expect(click).not.toHaveBeenCalled()
    releasePageReady()
    await vi.runAllTimersAsync()

    await resultExpectation

    expect(waitForFunction).toHaveBeenNthCalledWith(1, expect.any(Function), {
      timeout: 60_000,
    })
    expect(click).toHaveBeenNthCalledWith(1, JIANSHU_SELECTORS.newArticle)
    expect(click).toHaveBeenNthCalledWith(2, JIANSHU_SELECTORS.publishButton)
    expect(waitForSelector).toHaveBeenCalledWith(JIANSHU_SELECTORS.saved, {
      visible: true,
      timeout: 30_000,
    })
    expect(waitForFunction).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 30_000 },
      JIANSHU_SELECTORS.editor,
      0,
    )
  })

  it('reports the actual account binding blocker', async () => {
    const { page } = createJianshuPage({ blocked: true })
    const publishPromise = publishJianshuArticle(page, ARTICLE)
    const resultExpectation = expect(publishPromise).rejects.toThrow(
      '简书发布失败：账号需要同时绑定手机号和微信',
    )
    await vi.runAllTimersAsync()

    await resultExpectation
  })

  it('uploads content images and pastes the returned Jianshu image URL', async () => {
    const processedContent = `<p>正文</p><p><img src="${UPLOADED_IMAGE_URL}"></p>`
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ url: UPLOADED_IMAGE_URL }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { $eval, evaluate, page } = createJianshuPage({
      imageSources: [ONE_PIXEL_PNG],
      processedContent,
    })

    const publishPromise = publishJianshuArticle(page, {
      title: '简书正文图片上传测试',
      content: `<p>正文</p><p><img src="${ONE_PIXEL_PNG}"></p>`,
    })
    const resultExpectation = expect(publishPromise).resolves.toEqual({
      platformArticleId: '2c1238e4a8c5',
      publishedUrl: 'https://www.jianshu.com/p/2c1238e4a8c5',
    })
    await vi.runAllTimersAsync()
    await resultExpectation

    expect(evaluate).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://upload.qiniup.com/',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    )
    expect($eval).toHaveBeenCalledWith(
      JIANSHU_SELECTORS.editor,
      expect.any(Function),
      processedContent,
      '正文',
    )
  })

  it('stops publishing when a content image upload fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    )
    const { click, page } = createJianshuPage({
      imageSources: [ONE_PIXEL_PNG],
    })

    const publishPromise = publishJianshuArticle(page, {
      title: '简书正文图片上传失败测试',
      content: `<p><img src="${ONE_PIXEL_PNG}"></p>`,
    })
    const resultExpectation = expect(publishPromise).rejects.toThrow(
      '简书正文图片上传失败：HTTP 500',
    )
    await vi.runAllTimersAsync()
    await resultExpectation
    expect(click).not.toHaveBeenCalledWith(JIANSHU_SELECTORS.publishButton)
  })

  it('keeps one explicit selector for every observed publishing step', () => {
    expect(JIANSHU_SELECTORS).toEqual({
      newArticle:
        '::-p-xpath(//div[./span[normalize-space(.)="新建文章"]])',
      title: 'input._24i7u',
      editor: 'div.kalamu-area[contenteditable="true"]',
      saved: '::-p-xpath(//p[normalize-space(.)="已保存"])',
      publishButton: 'a[data-action="publicize"]',
      publishBlocked:
        '::-p-xpath(//*[normalize-space(.)="您需要绑定手机和微信才能公开发布文章"])',
      publishSuccessLink:
        '::-p-xpath(//a[normalize-space(.)="发布成功，点击查看文章" and starts-with(@href,"https://www.jianshu.com/p/")])',
    })
  })
})
