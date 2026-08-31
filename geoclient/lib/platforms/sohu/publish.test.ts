import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HTTPResponse, Page } from 'puppeteer'
import { publishSohuArticle, SOHU_SELECTORS } from './publish'

const SUCCESS_RESPONSE = {
  data: 1_061_087_778,
  code: 2_000_000,
  msg: '',
  success: true,
}

const publishHelperMocks = vi.hoisted(() => ({
  createTempDir: vi.fn(() => '/tmp/sohu-cover-test'),
  resolveMediaFile: vi.fn(async () => '/tmp/sohu-cover-test/cover.jpg'),
  safeRemoveDir: vi.fn(),
  sleep: vi.fn(async () => undefined),
}))

vi.mock('../publish-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../publish-helpers')>()),
  ...publishHelperMocks,
}))

function createPage(
  options: {
    publishPayload?: Record<string, unknown>
    unverified?: boolean
  } = {},
) {
  let currentUrl = 'https://mp.sohu.com/mpfe/v4/entry/create'
  const uploadFile = vi.fn(async () => undefined)
  const click = vi.fn(async (selector: string) => {
    if (selector === SOHU_SELECTORS.articleButton) {
      currentUrl =
        'https://mp.sohu.com/mpfe/v4/contentManagement/news/addarticle?contentStatus=1'
    }
  })
  let editorEvaluationCount = 0
  const publishResponse = {
    json: vi.fn(async () => options.publishPayload ?? SUCCESS_RESPONSE),
    ok: vi.fn(() => true),
    status: vi.fn(() => 200),
    url: vi.fn(
      () =>
        'https://mp.sohu.com/mpbp/bp/news/v4/news/publish/v2?accountId=123456789',
    ),
  } as unknown as HTTPResponse
  const waitForResponse = vi.fn(
    async (predicate: (response: HTTPResponse) => boolean | Promise<boolean>) => {
      const unrelatedResponse = {
        url: () =>
          'https://mp.sohu.com/mpbp/bp/news/v4/news/publish/v2?accountId=',
      } as unknown as HTTPResponse
      expect(await predicate(unrelatedResponse)).toBe(false)
      expect(await predicate(publishResponse)).toBe(true)
      return publishResponse
    },
  )
  const page = {
    url: vi.fn(() => currentUrl),
    goto: vi.fn(async (url: string) => {
      currentUrl = options.unverified
        ? url
        : 'https://mp.sohu.com/mpfe/v4/contentManagement/news/addarticle?contentStatus=1'
    }),
    waitForNetworkIdle: vi.fn(async () => undefined),
    waitForResponse,
    waitForSelector: vi.fn(async (selector: string) =>
      selector === SOHU_SELECTORS.coverInput ? { uploadFile } : {},
    ),
    waitForFunction: vi.fn(async () => undefined),
    $: vi.fn(async (selector: string) => {
      if (selector !== SOHU_SELECTORS.unverifiedDialog || !options.unverified) return null
      return { isIntersectingViewport: vi.fn(async () => true) }
    }),
    $eval: vi.fn(async (selector: string, _callback: unknown, ...args: unknown[]) => {
      if (selector === SOHU_SELECTORS.title) return args[0]
      editorEvaluationCount += 1
      return editorEvaluationCount === 1 ? undefined : { text: '搜狐号正文', imageCount: 0 }
    }),
    $$: vi.fn(async () => []),
    click,
  }
  return { page: page as unknown as Page, click, uploadFile, waitForResponse }
}

describe('Sohu article filler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('follows the real-name redirect and fills only the explicit title and editor', async () => {
    const { page, click } = createPage()

    await expect(
      publishSohuArticle(page, {
        title: '搜狐号测试标题',
        content: '<p>搜狐号正文</p>',
      }),
    ).resolves.toEqual({ platformArticleId: '1061087778' })

    expect(page.goto).toHaveBeenCalledWith(
      'https://mp.sohu.com/mpfe/v4/contentManagement/news/addmoment',
      expect.objectContaining({ waitUntil: 'domcontentloaded' }),
    )
    expect(page.waitForSelector).toHaveBeenCalledWith(
      SOHU_SELECTORS.title,
      expect.objectContaining({ visible: true }),
    )
    expect(page.waitForSelector).toHaveBeenCalledWith(
      SOHU_SELECTORS.editor,
      expect.objectContaining({ visible: true }),
    )
    expect(page.$eval).toHaveBeenCalledWith(
      SOHU_SELECTORS.title,
      expect.any(Function),
      '搜狐号测试标题',
    )
    expect(page.$eval).toHaveBeenCalledWith(
      SOHU_SELECTORS.editor,
      expect.any(Function),
      '<p>搜狐号正文</p>',
      '搜狐号正文',
    )
    expect(click).toHaveBeenCalledWith(SOHU_SELECTORS.publishButtonCandidates[0])
  })

  it('enters the article editor through the explicit real-name dialog actions', async () => {
    const { page, click } = createPage({ unverified: true })

    await expect(
      publishSohuArticle(page, { title: '搜狐号测试标题', content: '<p>正文</p>' }),
    ).resolves.toEqual({ platformArticleId: '1061087778' })
    expect(click).toHaveBeenNthCalledWith(1, SOHU_SELECTORS.negativeButton)
    expect(click).toHaveBeenNthCalledWith(2, SOHU_SELECTORS.articleButton)
  })

  it('uploads and confirms the cover with the explicit Sohu dialog flow', async () => {
    const { page, click, uploadFile } = createPage()

    await publishSohuArticle(page, {
      title: '搜狐号测试标题',
      content: '<p>搜狐号正文</p>',
      cover: 'https://cdn.example.com/cover.jpg',
    })

    expect(publishHelperMocks.createTempDir).toHaveBeenCalledWith('sohu-cover-')
    expect(publishHelperMocks.resolveMediaFile).toHaveBeenCalledWith(
      page,
      'https://cdn.example.com/cover.jpg',
      '/tmp/sohu-cover-test',
    )
    expect(click).toHaveBeenNthCalledWith(1, SOHU_SELECTORS.articleButton)
    expect(click).toHaveBeenNthCalledWith(2, SOHU_SELECTORS.coverUpload)
    expect(click).toHaveBeenNthCalledWith(3, SOHU_SELECTORS.coverLocalUploadTab)
    expect(uploadFile).toHaveBeenCalledWith('/tmp/sohu-cover-test/cover.jpg')
    expect(page.waitForFunction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: 30_000 }),
      SOHU_SELECTORS.localUploadImages,
    )
    expect(page.waitForSelector).toHaveBeenCalledWith(
      SOHU_SELECTORS.coverConfirmButton,
      expect.objectContaining({ visible: true, timeout: 30_000 }),
    )
    expect(click).toHaveBeenNthCalledWith(4, SOHU_SELECTORS.coverConfirmButton)
    expect(page.waitForFunction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: 30_000 }),
      SOHU_SELECTORS.coverPreview,
    )
    expect(publishHelperMocks.safeRemoveDir).toHaveBeenCalledWith('/tmp/sohu-cover-test')
    expect(click).toHaveBeenNthCalledWith(5, SOHU_SELECTORS.publishButtonCandidates[0])
  })

  it('uses the publish API response while the browser remains on the editor page', async () => {
    const { page, waitForResponse } = createPage()

    await expect(
      publishSohuArticle(page, {
        title: '搜狐号接口响应测试',
        content: '<p>正文</p>',
      }),
    ).resolves.toEqual({ platformArticleId: '1061087778' })

    expect(waitForResponse).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 60_000,
    })
    expect(page.url()).toBe(
      'https://mp.sohu.com/mpfe/v4/contentManagement/news/addarticle?contentStatus=1',
    )
  })

  it('rejects a failed publish API response', async () => {
    const { page } = createPage({
      publishPayload: {
        data: null,
        code: 5000000,
        msg: '发布失败',
        success: false,
      },
    })

    await expect(
      publishSohuArticle(page, {
        title: '搜狐号接口失败测试',
        content: '<p>正文</p>',
      }),
    ).rejects.toThrow('搜狐号发布失败：发布失败')
  })
})
