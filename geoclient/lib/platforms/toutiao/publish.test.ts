import type { ElementHandle, HTTPResponse, Page } from 'puppeteer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublishArticleInput } from '../types'
import { publishToutiaoArticle, TOUTIAO_SELECTORS } from './publish'

const publishHelperMocks = vi.hoisted(() => ({
  clearEditor: vi.fn(async () => undefined),
  sleep: vi.fn(async () => undefined),
}))

vi.mock('../publish-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../publish-helpers')>()),
  ...publishHelperMocks,
}))

const SUCCESS_RESPONSE = {
  code: 0,
  data: {
    content: '<p data-track="1">当前文章仅为测试使用</p>',
    pgc_id: '7672227551636423194',
  },
  err_no: 0,
  message: '提交成功',
  reason: '提交成功',
}

function createToutiaoPage(publishPayload: Record<string, unknown> = SUCCESS_RESPONSE) {
  const titleElement = {
    click: vi.fn(async () => undefined),
  } as unknown as ElementHandle<Element>
  const noCoverElement = {
    click: vi.fn(async () => undefined),
  } as unknown as ElementHandle<Element>

  const evaluateElement = vi.fn(
    async (selector: string, _callback: unknown, ...values: unknown[]) => {
      if (selector === TOUTIAO_SELECTORS.editor && values.length > 0) return 1
      if (selector === TOUTIAO_SELECTORS.editor) {
        return { text: '头条号正文', imageCount: 1 }
      }
      return undefined
    },
  )
  const click = vi.fn(async () => undefined)
  const publishResponse = {
    json: vi.fn(async () => publishPayload),
    ok: vi.fn(() => true),
    request: vi.fn(() => ({ method: () => 'POST' })),
    status: vi.fn(() => 200),
    url: vi.fn(() => 'https://mp.toutiao.com/mp/agw/article/publish'),
  } as unknown as HTTPResponse
  const waitForResponse = vi.fn(
    async (predicate: (response: HTTPResponse) => boolean | Promise<boolean>) => {
      const unrelatedResponse = {
        request: () => ({ method: () => 'GET' }),
        url: () => 'https://mp.toutiao.com/mp/agw/article/publish',
      } as unknown as HTTPResponse
      expect(await predicate(unrelatedResponse)).toBe(false)
      expect(await predicate(publishResponse)).toBe(true)
      return publishResponse
    },
  )
  const page = {
    $: vi.fn(async (selector: string) => {
      if (selector === TOUTIAO_SELECTORS.title) return titleElement
      if (selector.startsWith('#root > div > div.left-column')) return noCoverElement
      return null
    }),
    $eval: evaluateElement,
    click,
    keyboard: {
      down: vi.fn(async () => undefined),
      press: vi.fn(async () => undefined),
      type: vi.fn(async () => undefined),
      up: vi.fn(async () => undefined),
    },
    url: vi.fn(() => 'https://mp.toutiao.com/profile_v4/graphic/publish'),
    waitForFunction: vi.fn(async () => undefined),
    waitForNetworkIdle: vi.fn(async () => {
      throw new Error('头条后台持续请求，页面不会进入 network idle')
    }),
    waitForResponse,
    waitForSelector: vi.fn(async () => ({})),
  } as unknown as Page

  return { click, evaluateElement, page, waitForResponse }
}

describe('Toutiao article publisher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pastes the complete HTML article into the explicit ProseMirror editor', async () => {
    const { click, evaluateElement, page, waitForResponse } = createToutiaoPage()
    const article: PublishArticleInput = {
      title: '头条号测试标题',
      content:
        '<h2>头条号正文</h2><p>正文段落</p><img src="https://example.com/article.png">',
    }

    await expect(publishToutiaoArticle(page, article)).resolves.toEqual({
      platformArticleId: '7672227551636423194',
      publishedUrl: 'https://www.toutiao.com/article/7672227551636423194/',
    })

    expect(publishHelperMocks.clearEditor).toHaveBeenCalledWith(
      page,
      TOUTIAO_SELECTORS.editor,
    )
    expect(evaluateElement).toHaveBeenCalledWith(
      TOUTIAO_SELECTORS.editor,
      expect.any(Function),
      article.content,
      '头条号正文\n正文段落',
    )
    expect(page.waitForFunction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: 30_000 }),
      TOUTIAO_SELECTORS.editor,
      1,
    )
    expect(page.waitForNetworkIdle).not.toHaveBeenCalled()
    expect(waitForResponse).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 45_000,
    })
    expect(click).toHaveBeenCalledWith(TOUTIAO_SELECTORS.publishButton)
    expect(click).toHaveBeenCalledWith(TOUTIAO_SELECTORS.publishConfirmButton, {
      delay: 50,
    })
  })

  it('rejects a publish API response that does not report success', async () => {
    const { page } = createToutiaoPage({
      code: 1,
      err_no: 1,
      message: '提交失败',
      reason: '文章未通过平台校验',
    })

    await expect(
      publishToutiaoArticle(page, {
        title: '头条号失败测试',
        content: '<p>正文</p>',
      }),
    ).rejects.toThrow('头条号发布失败：文章未通过平台校验')
  })

  it('removes the old segmented inline-image selectors', () => {
    expect(TOUTIAO_SELECTORS).not.toHaveProperty('imageButton')
    expect(TOUTIAO_SELECTORS).not.toHaveProperty('imageLocalUploadButton')
    expect(TOUTIAO_SELECTORS).not.toHaveProperty('imageInput')
    expect(TOUTIAO_SELECTORS).not.toHaveProperty('imageConfirmButton')
  })
})
