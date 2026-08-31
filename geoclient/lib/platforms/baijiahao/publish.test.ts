import type { ElementHandle, Frame, HTTPResponse, Page } from 'puppeteer'
import { describe, expect, it, vi } from 'vitest'
import type { PublishArticleInput } from '../types'
import { BAIJIAHAO_SELECTORS, publishBaijiahaoArticle } from './publish'

const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

const SUCCESS_RESPONSE = {
  errno: 0,
  errmsg: 'success',
  data: null,
  ret: {
    article_id: '1873113603779834582',
  },
}

function createBaijiahaoPage(publishPayload: Record<string, unknown> = SUCCESS_RESPONSE) {
  let releasePageReady: () => void = () => undefined
  const pageReady = new Promise<void>((resolve) => {
    releasePageReady = resolve
  })

  const editorEval = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockResolvedValue({ text: '示例正文', imageCount: 0 })
  const editorFrame = {
    $eval: editorEval,
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue({}),
  } as unknown as Frame
  const frameElement = {
    contentFrame: vi.fn().mockResolvedValue(editorFrame),
  } as unknown as ElementHandle<HTMLIFrameElement>
  const uploadFile = vi.fn().mockResolvedValue(undefined)
  const coverInput = { uploadFile } as unknown as ElementHandle<HTMLInputElement>
  const coverTriggerClick = vi.fn().mockResolvedValue(undefined)

  const click = vi.fn().mockResolvedValue(undefined)
  const publishResponse = {
    json: vi.fn(async () => publishPayload),
    ok: vi.fn(() => true),
    status: vi.fn(() => 200),
    url: vi.fn(
      () =>
        'https://baijiahao.baidu.com/pcui/article/publish?type=news&callback=bjhpublish',
    ),
  } as unknown as HTTPResponse
  const waitForResponse = vi.fn(
    async (predicate: (response: HTTPResponse) => boolean | Promise<boolean>) => {
      const unrelatedResponse = {
        url: () =>
          'https://baijiahao.baidu.com/pcui/article/publish?type=news&callback=other',
      } as unknown as HTTPResponse
      expect(await predicate(unrelatedResponse)).toBe(false)
      expect(await predicate(publishResponse)).toBe(true)
      return publishResponse
    },
  )
  const page = {
    $: vi.fn().mockResolvedValue(null),
    $eval: vi.fn().mockResolvedValue(''),
    click,
    keyboard: {
      down: vi.fn().mockResolvedValue(undefined),
      press: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
      up: vi.fn().mockResolvedValue(undefined),
    },
    locator: vi.fn(() => ({ click: coverTriggerClick })),
    url: vi.fn(() => 'https://baijiahao.baidu.com/builder/rc/edit'),
    waitForFunction: vi.fn().mockImplementation(() => pageReady),
    waitForNetworkIdle: vi.fn().mockResolvedValue(undefined),
    waitForResponse,
    waitForSelector: vi.fn(async (selector: string) => {
      if (selector === BAIJIAHAO_SELECTORS.editorFrame) return frameElement
      if (selector === BAIJIAHAO_SELECTORS.coverInput) return coverInput
      return {} as ElementHandle<Element>
    }),
  } as unknown as Page

  return {
    click,
    coverTriggerClick,
    editorFrame,
    page,
    releasePageReady,
    uploadFile,
    waitForResponse,
  }
}

describe('Baijiahao article publisher', () => {
  it('waits for the page and editor controls before filling fields', async () => {
    const { click, editorFrame, page, releasePageReady } = createBaijiahaoPage()
    const article: PublishArticleInput = {
      title: '示例标题',
      content: '<p>示例正文</p>',
    }

    const publishPromise = publishBaijiahaoArticle(page, article)
    await vi.waitFor(() => {
      expect(page.waitForFunction).toHaveBeenCalledOnce()
    })
    expect(editorFrame.waitForFunction).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()

    releasePageReady()
    await expect(publishPromise).resolves.toEqual({
      platformArticleId: '1873113603779834582',
      publishedUrl: 'https://baijiahao.baidu.com/s?id=1873113603779834582',
    })
    expect(editorFrame.waitForFunction).toHaveBeenCalledOnce()
    expect(page.waitForNetworkIdle).toHaveBeenCalledWith({
      idleTime: 1_500,
      timeout: 30_000,
    })
    expect(click).toHaveBeenNthCalledWith(1, BAIJIAHAO_SELECTORS.title)
    expect(click).toHaveBeenNthCalledWith(2, BAIJIAHAO_SELECTORS.publishButton)
  })

  it('uploads a cover through the configured file input before confirming it', async () => {
    const { click, coverTriggerClick, page, releasePageReady, uploadFile } =
      createBaijiahaoPage()
    const article: PublishArticleInput = {
      title: '示例标题',
      content: '<p>示例正文</p>',
      cover: ONE_PIXEL_PNG,
    }

    const publishPromise = publishBaijiahaoArticle(page, article)
    releasePageReady()
    await expect(publishPromise).resolves.toEqual({
      platformArticleId: '1873113603779834582',
      publishedUrl: 'https://baijiahao.baidu.com/s?id=1873113603779834582',
    })

    expect(uploadFile).toHaveBeenCalledOnce()
    expect(coverTriggerClick).toHaveBeenCalledOnce()
    expect(click).toHaveBeenNthCalledWith(1, BAIJIAHAO_SELECTORS.title)
    expect(click).toHaveBeenNthCalledWith(2, BAIJIAHAO_SELECTORS.coverConfirmButton)
    expect(click).toHaveBeenNthCalledWith(3, BAIJIAHAO_SELECTORS.publishButton)
    expect(page.waitForSelector).toHaveBeenCalledWith(
      BAIJIAHAO_SELECTORS.coverConfirmButton,
      { hidden: true, timeout: 30_000 },
    )
  })

  it('uses the publish API response instead of the browser URL', async () => {
    const { page, releasePageReady, waitForResponse } = createBaijiahaoPage()
    const publishPromise = publishBaijiahaoArticle(page, {
      title: '接口响应测试',
      content: '<p>正文</p>',
    })
    releasePageReady()

    await expect(publishPromise).resolves.toEqual({
      platformArticleId: '1873113603779834582',
      publishedUrl: 'https://baijiahao.baidu.com/s?id=1873113603779834582',
    })
    expect(waitForResponse).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 45_000,
    })
    expect(page.url()).toBe('https://baijiahao.baidu.com/builder/rc/edit')
  })

  it('rejects a failed publish API response', async () => {
    const { page, releasePageReady } = createBaijiahaoPage({
      errno: 1001,
      errmsg: '发布失败',
      data: null,
    })
    const publishPromise = publishBaijiahaoArticle(page, {
      title: '接口失败测试',
      content: '<p>正文</p>',
    })
    releasePageReady()

    await expect(publishPromise).rejects.toThrow('百家号发布失败：发布失败')
  })

  it('uses only the selectors from the supplied cover DOM', () => {
    expect(BAIJIAHAO_SELECTORS.coverTrigger).toBe(
      '::-p-xpath(//div[normalize-space(.)="选择封面"])',
    )
    expect(BAIJIAHAO_SELECTORS.coverInput).toBe(
      'span.cheetah-upload > input[name="media"][type="file"]',
    )
    expect(BAIJIAHAO_SELECTORS.coverConfirmButton).toBe(
      'button.FeEditorApp-e8c90bfac9d4eab4-confirmBtn',
    )
    expect(BAIJIAHAO_SELECTORS).not.toHaveProperty('coverLocalUploadButton')
    expect(BAIJIAHAO_SELECTORS).not.toHaveProperty('coverPreview')
  })
})
