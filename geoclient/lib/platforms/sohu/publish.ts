import type { ElementHandle, HTTPResponse, Page } from 'puppeteer'
import { articleContentToPlainText } from '../draft'
import {
  createTempDir,
  resolveMediaFile,
  safeRemoveDir,
  sleep,
} from '../publish-helpers'
import type { PublishArticleInput, PublishArticleResult } from '../types'

const SOHU_PREFLIGHT_URL = 'https://mp.sohu.com/mpfe/v4/contentManagement/news/addmoment'
const SOHU_ARTICLE_PATH = '/mpfe/v4/contentManagement/news/addarticle'
const SOHU_PUBLISH_API_ORIGIN = 'https://mp.sohu.com'
const SOHU_PUBLISH_API_PATH = '/mpbp/bp/news/v4/news/publish/v2'
const FIELD_TIMEOUT_MS = 45_000
const PAGE_SETTLE_TIMEOUT_MS = 10_000
const EDITOR_SETTLE_TIMEOUT_MS = 10_000
const UPLOAD_TIMEOUT_MS = 30_000
const PUBLISH_TIMEOUT_MS = 60_000

type SohuPublishResponse = {
  data?: number
  code?: number
  msg?: string
  success?: boolean
}

/**
 * 搜狐号填充流程的唯一选择器入口。
 * 页面 DOM 变化时只修改这里，不增加候选数组、文本扫描或位置回退。
 */
export const SOHU_SELECTORS = {
  unverifiedDialog: 'div[aria-label="您的账号未实名"]',
  title: '.publish-title>input',
  editor: '.ql-editor[contenteditable="true"]',
  negativeButton: 'div.btn-area > button.operate-btn.negative-button',
  articleButton: 'a[href="/mpfe/v4/contentManagement/news/addarticle?contentStatus=1"]',
  coverUpload: 'span.upload-tip',
  coverLocalUploadTab: '::-p-xpath(//h3[normalize-space(.)="本地上传"])',
  coverInput: 'input[type="file"]',
  localUploadImages: '.upload-area>.img-wrapper>img',
  coverPreview: 'div.pic-cover',
  coverConfirmButton:
    '#app > div.add_content-wrap > div > div > div:nth-child(2) > div:nth-child(3) > div.el-dialog__wrapper.select-dialog > div > div.el-dialog__body > div > div:nth-child(4) > div.bottom-buttons > p.button.positive-button',
  // 发布按钮：搜狐号改版后 class 可能变化，多候选容错。
  // 优先用 xpath 文本匹配"发布"按钮，不受 class 变化影响。
  publishButtonCandidates: [
    'li.publish-report-btn.active.positive-button',
    '::-p-xpath(//li[contains(@class, "publish") and normalize-space(.)="发布"])',
    '::-p-xpath(//button[contains(@class, "publish") and normalize-space(.)="发布"])',
    '::-p-xpath(//li[normalize-space(.)="发布"])',
    '::-p-xpath(//button[normalize-space(.)="发布"])',
    '::-p-xpath(//*[contains(@class, "publish-btn") and not(@disabled)])',
    '::-p-xpath(//*[contains(text(), "发布") and not(contains(text(), "草稿"))])',
  ],
  // 搜狐号发布成功后跳转的 URL 路径模式（非 addarticle 编辑页）
  publishedUrlPatterns: [
    /mp\.sohu\.com\/mpfe\/v4\/contentManagement\/news\/articleList/,
    /mp\.sohu\.com\/mpfe\/v4\/contentManagement\/news\/detail/,
  ],
} as const

export async function publishSohuArticle(
  page: Page,
  article: PublishArticleInput,
): Promise<PublishArticleResult> {
  console.log('[SohuPublisher] start fill', {
    title: article.title?.slice(0, 30),
    contentLength: article.content?.length ?? 0,
  })

  await openArticleEditor(page)
  await fillTitle(page, article.title)
  await fillContent(page, article.content)
  if (article.cover) {
    await fillCover(page, article.cover)
  }
  const radios = await page.$$(".el-radio__label")
  if (radios?.length > 0 ){
    radios[2].click();
  }
  return publishArticle(page)
}

async function openArticleEditor(page: Page) {
  await sleep(3_000)
  await page.goto(SOHU_PREFLIGHT_URL, {
    waitUntil: 'domcontentloaded',
    timeout: FIELD_TIMEOUT_MS,
  })
  await page
    .waitForNetworkIdle({ idleTime: 1_000, timeout: PAGE_SETTLE_TIMEOUT_MS })
    .catch(() => undefined)

  if (await isVisible(page, SOHU_SELECTORS.unverifiedDialog)) {
    await page.waitForSelector(SOHU_SELECTORS.negativeButton, {
      visible: true,
      timeout: FIELD_TIMEOUT_MS,
    })
    await page.click(SOHU_SELECTORS.negativeButton)
  }
  await page.click(SOHU_SELECTORS.articleButton)
  await sleep(4_000)

  try {
    await Promise.all([
      page.waitForSelector(SOHU_SELECTORS.title, {
        visible: true,
        timeout: FIELD_TIMEOUT_MS,
      }),
      page.waitForSelector(SOHU_SELECTORS.editor, {
        visible: true,
        timeout: FIELD_TIMEOUT_MS,
      }),
    ])
  } catch {
    if (await isVisible(page, SOHU_SELECTORS.unverifiedDialog)) {
      throw new Error('搜狐号账号未完成实名认证，无法填写文章')
    }
    throw new Error(`搜狐号文章编辑器未就绪：${page.url()}`)
  }

  let pathname = ''
  try {
    pathname = new URL(page.url()).pathname
  } catch {
    throw new Error(`搜狐号文章编辑页地址无效：${page.url()}`)
  }
  if (pathname !== SOHU_ARTICLE_PATH) {
    throw new Error(`搜狐号未进入文章编辑页：${page.url()}`)
  }
}

async function fillTitle(page: Page, title: string) {
  const value = title.trim()
  if (!value) throw new Error('搜狐号标题不能为空')

  const assignedValue = await page.$eval(
    SOHU_SELECTORS.title,
    (element, nextValue) => {
      if (!(element instanceof HTMLInputElement)) {
        throw new Error('配置的搜狐号标题元素不是 input')
      }

      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set
      if (nativeSetter) nativeSetter.call(element, nextValue)
      else element.value = nextValue

      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: nextValue,
        }),
      )
      element.dispatchEvent(new Event('change', { bubbles: true }))
      return element.value
    },
    value,
  )

  if (assignedValue !== value) {
    throw new Error('搜狐号标题填充失败：标题输入框未保留指定内容')
  }

  try {
    await page.waitForFunction(
      (selector, expectedValue) => {
        const element = document.querySelector(selector)
        return element instanceof HTMLInputElement && element.value === expectedValue
      },
      { timeout: FIELD_TIMEOUT_MS },
      SOHU_SELECTORS.title,
      value,
    )
  } catch {
    throw new Error('搜狐号标题填充失败：页面状态没有接受标题变更')
  }
}

async function fillContent(page: Page, content: string) {
  if (!content.trim()) throw new Error('搜狐号正文不能为空')

  const plainText = articleContentToPlainText(content)
  await page.$eval(
    SOHU_SELECTORS.editor,
    (element, htmlValue, plainValue) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error('配置的搜狐号正文元素不是 HTMLElement')
      }

      const parsedContent = new DOMParser().parseFromString(htmlValue, 'text/html')
      parsedContent.body
        .querySelectorAll('script, iframe, object, embed, form, input, button, link, meta')
        .forEach((node) => node.remove())
      parsedContent.body.querySelectorAll('*').forEach((node) => {
        for (const attribute of Array.from(node.attributes)) {
          const name = attribute.name.toLowerCase()
          const attributeValue = attribute.value.trim().toLowerCase()
          if (name.startsWith('on')) node.removeAttribute(attribute.name)
          if (
            (name === 'href' || name === 'src') &&
            attributeValue.startsWith('javascript:')
          ) {
            node.removeAttribute(attribute.name)
          }
        }
      })

      element.focus()
      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)

      const clipboardData = new DataTransfer()
      clipboardData.setData('text/html', parsedContent.body.innerHTML)
      clipboardData.setData('text/plain', plainValue)
      element.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData,
        }),
      )
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertFromPaste',
          data: plainValue,
        }),
      )
      element.dispatchEvent(new Event('change', { bubbles: true }))
    },
    content,
    plainText,
  )

  try {
    await page.waitForFunction(
      (selector) => {
        const editor = document.querySelector(selector)
        if (!(editor instanceof HTMLElement)) return false
        return editor.innerText.trim().length > 0 || editor.querySelector('img') !== null
      },
      { timeout: EDITOR_SETTLE_TIMEOUT_MS },
      SOHU_SELECTORS.editor,
    )
  } catch {
    throw new Error('搜狐号正文填充失败：粘贴后指定编辑器仍为空')
  }

  const state = await page.$eval(SOHU_SELECTORS.editor, (element) => ({
    text: element instanceof HTMLElement ? element.innerText.trim() : '',
    imageCount: element.querySelectorAll('img').length,
  }))
  if (!state.text && state.imageCount === 0) {
    throw new Error('搜狐号正文填充失败：指定编辑器未保留粘贴内容')
  }
}

async function fillCover(page: Page, cover: string) {
  const source = cover.trim()
  if (!source) throw new Error('搜狐号封面不能为空')

  const tempDir = createTempDir('sohu-cover-')
  try {
    const filePath = await resolveMediaFile(page, source, tempDir)

    await page.waitForSelector(SOHU_SELECTORS.coverUpload, {
      visible: true,
      timeout: FIELD_TIMEOUT_MS,
    })
    await page.click(SOHU_SELECTORS.coverUpload)

    await page.waitForSelector(SOHU_SELECTORS.coverLocalUploadTab, {
      visible: true,
      timeout: FIELD_TIMEOUT_MS,
    })
    await page.click(SOHU_SELECTORS.coverLocalUploadTab)

    const input = (await page.waitForSelector(SOHU_SELECTORS.coverInput, {
      timeout: FIELD_TIMEOUT_MS,
    })) as ElementHandle<HTMLInputElement> | null
    if (!input) {
      throw new Error(`未找到搜狐号封面上传输入框：${SOHU_SELECTORS.coverInput}`)
    }
    await input.uploadFile(filePath)

    try {
      await page.waitForFunction(
        (selector) => {
          const image = document.querySelector(selector)
          if (!(image instanceof HTMLImageElement)) return false

          const source = image.currentSrc || image.src
          if (!image.complete || image.naturalWidth <= 0 || !source) return false

          try {
            const imageUrl = new URL(source, window.location.href)
            return imageUrl.protocol === 'http:' || imageUrl.protocol === 'https:'
          } catch {
            return false
          }
        },
        { timeout: UPLOAD_TIMEOUT_MS },
        SOHU_SELECTORS.localUploadImages,
      )
    } catch {
      throw new Error('搜狐号封面上传未完成：本地预览尚未生成远程图片地址')
    }

    await page.waitForSelector(SOHU_SELECTORS.coverConfirmButton, {
      visible: true,
      timeout: UPLOAD_TIMEOUT_MS,
    })
    await page.click(SOHU_SELECTORS.coverConfirmButton)
    try {
      await page.waitForFunction(
        (selector) => {
          const element = document.querySelector(selector)
          if (!(element instanceof HTMLDivElement)) return false

          const backgroundImage =
            element.style.backgroundImage || window.getComputedStyle(element).backgroundImage
          if (!backgroundImage || backgroundImage === 'none') return false

          const urlMatch = backgroundImage.match(/^url\((.*)\)$/)
          return Boolean(urlMatch?.[1]?.replace(/^['"]|['"]$/g, '').trim())
        },
        { timeout: UPLOAD_TIMEOUT_MS },
        SOHU_SELECTORS.coverPreview,
      )
    } catch {
      throw new Error('搜狐号封面上传失败：.pic-cover 的 background-image 未生成')
    }
  } finally {
    safeRemoveDir(tempDir)
  }
}

async function publishArticle(page: Page): Promise<PublishArticleResult> {
  // 多候选选择器：搜狐号改版后 class 可能变化，按顺序尝试。
  const publishButton = await waitForPublishButton(page)
  if (!publishButton) {
    const html = await page.evaluate(() => document.body.innerHTML.slice(0, 2000))
    console.log('[SohuPublisher] 未找到发布按钮，页面 HTML 预览：', html)
    throw new Error(
      `搜狐号未找到发布按钮（候选选择器均未命中：${SOHU_SELECTORS.publishButtonCandidates.join(' | ')}）`,
    )
  }

  // 输出按钮 HTML 用于诊断（万一后续选择器又失效，能从日志看到实际 DOM）
  try {
    const buttonHtml = await page.evaluate((el) => {
      if (el instanceof Element) {
        const clone = el.cloneNode(true) as Element
        clone.removeAttribute('class')
        return `<${clone.tagName.toLowerCase()} class="${el.className}">${clone.textContent?.slice(0, 50) ?? ''}</${clone.tagName.toLowerCase()}>`
      }
      return ''
    }, publishButton.element)
    console.log('[SohuPublisher] publish button matched:', buttonHtml)
  } catch {
    // 忽略诊断日志错误
  }

  const beforeUrl = page.url()
  const publishResponsePromise = page
    .waitForResponse(
      (response) => {
        try {
          const responseUrl = new URL(response.url())
          const accountId = responseUrl.searchParams.get('accountId')?.trim() ?? ''
          return (
            responseUrl.origin === SOHU_PUBLISH_API_ORIGIN &&
            responseUrl.pathname === SOHU_PUBLISH_API_PATH &&
            /^\d+$/.test(accountId)
          )
        } catch {
          return false
        }
      },
      { timeout: PUBLISH_TIMEOUT_MS },
    )
    .catch(() => null)

  await page.click(publishButton.selector)

  // 双重判定：API 响应 OR 页面跳转到非编辑页（如 articleList/detail）
  // 任一命中即视为发布成功。
  const urlWatchController = new AbortController()
  let result:
    | { kind: 'api'; response: HTTPResponse }
    | { kind: 'url'; url: string }
    | null
  try {
    result = await Promise.race([
      publishResponsePromise.then((response) => {
        if (response) return { kind: 'api' as const, response }
        return null
      }),
      waitForPublishedUrl(
        page,
        PUBLISH_TIMEOUT_MS,
        urlWatchController.signal,
      ).then((url) => (url ? { kind: 'url' as const, url } : null)),
    ])
  } finally {
    urlWatchController.abort()
  }

  if (!result) {
    const afterUrl = page.url()
    throw new Error(
      `搜狐号发布结果等待超时：未捕获 ${SOHU_PUBLISH_API_ORIGIN}${SOHU_PUBLISH_API_PATH} 响应，也未跳转到已发布页（发布前=${beforeUrl}，当前=${afterUrl}）`,
    )
  }

  if (result.kind === 'url') {
    // URL 跳转路径：没拿到 platformArticleId，但发布已成功（页面已跳走）
    console.log('[SohuPublisher] published via URL redirect', {
      publishedUrl: result.url,
    })
    return { platformArticleId: '', publishedUrl: result.url }
  }

  // API 响应路径：校验响应体
  const response = result.response
  if (!response.ok()) {
    throw new Error(`搜狐号发布失败：发布接口返回 HTTP ${response.status()}`)
  }

  let payload: SohuPublishResponse
  try {
    payload = (await response.json()) as SohuPublishResponse
  } catch {
    throw new Error('搜狐号发布失败：发布接口响应不是有效 JSON')
  }

  const platformArticleId =
    Number.isSafeInteger(payload.data) && Number(payload.data) > 0
      ? String(payload.data)
      : ''
  if (payload.success !== true || payload.code !== 2_000_000 || !platformArticleId) {
    throw new Error(
      `搜狐号发布失败：${payload.msg?.trim() || `code=${String(payload.code)}`}`,
    )
  }
  console.log('[SohuPublisher] published via API', {
    platformArticleId,
  })
  // TODO: 文件连接url拼接，生成最终的发布url
  return { platformArticleId }
}

// waitForPublishButton 按顺序尝试多个候选选择器，返回第一个命中的发布按钮。
async function waitForPublishButton(
  page: Page,
): Promise<{ selector: string; element: ElementHandle } | null> {
  const deadline = Date.now() + FIELD_TIMEOUT_MS
  for (const selector of SOHU_SELECTORS.publishButtonCandidates) {
    if (Date.now() > deadline) break
    const remaining = Math.max(1_000, deadline - Date.now())
    try {
      const element = await page.waitForSelector(selector, {
        visible: true,
        timeout: Math.min(5_000, remaining),
      })
      if (element) return { selector, element }
    } catch {
      // 继续尝试下一个候选选择器
    }
  }
  return null
}

// waitForPublishedUrl 监听页面 URL 是否跳转到发布成功页（非 addarticle 编辑页）。
// 用于 API 响应捕获失败时的兜底成功判定。
async function waitForPublishedUrl(
  page: Page,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<string | null> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (signal.aborted) return null
    try {
      const currentUrl = page.url()
      if (
        SOHU_SELECTORS.publishedUrlPatterns.some((pattern) =>
          pattern.test(currentUrl),
        )
      ) {
        return currentUrl
      }
    } catch {
      // page 已关闭，返回 null
      return null
    }
    await sleep(500)
  }
  return null
}

async function isVisible(page: Page, selector: string) {
  const element = await page.$(selector)
  if (!element) return false
  return element.isIntersectingViewport().catch(() => false)
}
