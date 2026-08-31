import type { ElementHandle, Page } from 'puppeteer'
import type { PublishArticleInput, PublishArticleResult } from '../types'
import { articleContentToPlainText } from '../draft'
import {
  clearEditor,
  createTempDir,
  resolveMediaFile,
  safeRemoveDir,
  sleep,
} from '../publish-helpers'

const FIELD_TIMEOUT_MS = 20_000
const UPLOAD_TIMEOUT_MS = 30_000
const PUBLISH_TIMEOUT_MS = 45_000
const TOUTIAO_PUBLISH_API_ORIGIN = 'https://mp.toutiao.com'
const TOUTIAO_PUBLISH_API_PATH = '/mp/agw/article/publish'
const TOUTIAO_ARTICLE_URL_PREFIX = 'https://www.toutiao.com/article/'

type ToutiaoPublishResponse = {
  code?: number
  err_no?: number
  message?: string
  reason?: string
  data?: {
    pgc_id?: string
  }
}

/**
 * 头条号发布流程的唯一选择器入口。
 * 页面 DOM 变更时只修改这里，不在流程中增加候选数组或文案回退。
 */
export const TOUTIAO_SELECTORS = {
  title: 'textarea[placeholder="请输入文章标题（2～30个字）"]',
  titleConflictContinue:
    '::-p-xpath(//button[normalize-space(.)="继续发布"])',
  editor: '.ProseMirror[contenteditable="true"]',
  coverTrigger: '::-p-xpath(//*[normalize-space(.)="添加封面"])',
  coverSingleMode: '::-p-xpath(//*[@role="tab" and normalize-space(.)="单图"])',
  coverLocalUploadButton:
    '::-p-xpath(//*[@role="dialog"]//*[normalize-space(.)="本地上传"])',
  coverInput: '[role="dialog"] input[type="file"]',
  coverConfirmButton:
    '::-p-xpath(//*[@role="dialog"]//button[normalize-space(.)="确定"])',
  coverPreview: '.article-cover img',
  defaultCoverButton: '::-p-xpath(//*[normalize-space(.)="默认封面"])',
  publishButton: '::-p-xpath(//button[normalize-space(.)="预览并发布"])',
  publishConfirmButton:'.publish-btn-last',
} as const

export async function publishToutiaoArticle(
  page: Page,
  article: PublishArticleInput,
): Promise<PublishArticleResult> {
  console.log('[ToutiaoPublisher] start', {
    title: article.title?.slice(0, 30),
    contentLength: article.content?.length ?? 0,
    cover: article.cover?.slice(0, 80),
  })

  await page.waitForSelector(TOUTIAO_SELECTORS.title, {
    visible: true,
    timeout: FIELD_TIMEOUT_MS,
  })
  await Promise.all([
    page.waitForSelector(TOUTIAO_SELECTORS.title, { visible: true }),
    page.waitForSelector(TOUTIAO_SELECTORS.editor, { visible: true }),
  ])
  await fillTitle(page, article.title)
  await sleep(2000);
  await fillContent(page, article.content)
  await sleep(2000);
  //  无封面
  // const radioNoCover = await page.$("#root > div > div.left-column > div > div.form-wrap > div.form-container > div:nth-child(1) > div > div.edit-input > div > div > label:nth-child(3) > span > span");
  // await page.click("#root > div > div.left-column > div > div.form-wrap > div.form-container > div:nth-child(1) > div > div.edit-input > div > div.byte-radio-group.byte-radio-size-default.byte-radio-mode-outline.pgc-radio.article-cover-radio-group > label:nth-child(3) > span > div");
  // await radioNoCover?.click()
  // await sleep(2000);
  // await fillCover(page, article.cover)
  return submitArticle(page)
}

async function fillTitle(page: Page, title: string) {
  if (!title) return
  await Promise.all([
    page.waitForSelector(TOUTIAO_SELECTORS.title, { visible: true }),
    page.waitForSelector(TOUTIAO_SELECTORS.editor, { visible: true }),
  ])

  const titleElement = await page.$(TOUTIAO_SELECTORS.title)
  if (!titleElement) throw new Error('标题输入框不存在')
  await titleElement.click()

  await page.keyboard.down(process.platform === 'darwin' ? 'Meta' : 'Control')
  await page.keyboard.press('A')
  await page.keyboard.up(process.platform === 'darwin' ? 'Meta' : 'Control')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(title, { delay: 30 })
  // await clickOptional(page, TOUTIAO_SELECTORS.titleConflictContinue)
}

async function fillContent(page: Page, content: string) {
  if (!content) return
  await page.waitForSelector(TOUTIAO_SELECTORS.editor, {
    visible: true,
    timeout: FIELD_TIMEOUT_MS,
  })
  await clearEditor(page, TOUTIAO_SELECTORS.editor)

  const plainText = articleContentToPlainText(content)
  const expectedImageCount = await page.$eval(
    TOUTIAO_SELECTORS.editor,
    (element, htmlValue, plainValue) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error('配置的头条号正文元素不是 HTMLElement')
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

      const imageCount = parsedContent.body.querySelectorAll('img[src]').length
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
      return imageCount
    },
    content,
    plainText,
  )

  try {
    await page.waitForFunction(
      (selector, minimumImageCount) => {
        const editor = document.querySelector(selector)
        if (!(editor instanceof HTMLElement)) return false

        const images = Array.from(editor.querySelectorAll('img'))
        const hasContent = editor.innerText.trim().length > 0 || images.length > 0
        const imagesReady = images.every(
          (image) => image.complete && image.naturalWidth > 0,
        )
        return hasContent && images.length >= minimumImageCount && imagesReady
      },
      { timeout: UPLOAD_TIMEOUT_MS },
      TOUTIAO_SELECTORS.editor,
      expectedImageCount,
    )
  } catch {
    throw new Error('头条号正文填充失败：整篇粘贴后正文或图片未就绪')
  }

  // 头条后台存在轮询和埋点请求，整页 network idle 不能代表正文图片状态。
  // 上面的编辑器内图片数量、complete 和 naturalWidth 才是本步骤的完成条件。

  const contentState = await page.$eval(TOUTIAO_SELECTORS.editor, (element) => ({
    text: element instanceof HTMLElement ? element.innerText.trim() : '',
    imageCount: element.querySelectorAll('img').length,
  }))
  if (!contentState.text && contentState.imageCount === 0 && articleContentToPlainText(content)) {
    throw new Error('头条号正文填充失败：指定编辑器仍为空')
  }
}

async function fillCover(page: Page, cover?: string) {
  if (!cover) {
    await clickOptional(page, TOUTIAO_SELECTORS.coverTrigger)
    await clickOptional(page, TOUTIAO_SELECTORS.defaultCoverButton)
    return
  }

  const tempDir = createTempDir('toutiao-cover-')
  try {
    const filePath = await resolveMediaFile(page, cover, tempDir)
    await clickRequired(page, TOUTIAO_SELECTORS.coverTrigger, '头条号封面入口')
    await clickRequired(page, TOUTIAO_SELECTORS.coverSingleMode, '头条号单图封面选项')
    await clickOptional(page, TOUTIAO_SELECTORS.coverLocalUploadButton)
    await uploadFile(page, TOUTIAO_SELECTORS.coverInput, filePath, '头条号封面')
    await clickOptional(page, TOUTIAO_SELECTORS.coverConfirmButton)
    await page.waitForSelector(TOUTIAO_SELECTORS.coverPreview, {
      visible: true,
      timeout: UPLOAD_TIMEOUT_MS,
    })
  } finally {
    safeRemoveDir(tempDir)
  }
}

async function submitArticle(page: Page): Promise<PublishArticleResult> {
  await clickRequired(page, TOUTIAO_SELECTORS.publishButton, '头条号发布按钮')
  await sleep(2000);
  // await clickOptional(page, TOUTIAO_SELECTORS.publishConfirmButton)
  const publishResponsePromise = page
    .waitForResponse(
      (response) => {
        if (response.request().method() !== 'POST') return false
        try {
          const responseUrl = new URL(response.url())
          return (
            responseUrl.origin === TOUTIAO_PUBLISH_API_ORIGIN &&
            responseUrl.pathname === TOUTIAO_PUBLISH_API_PATH
          )
        } catch {
          return false
        }
      },
      { timeout: PUBLISH_TIMEOUT_MS },
    )
    .catch(() => null)
  await page.click(TOUTIAO_SELECTORS.publishConfirmButton,{delay:50});

  const response = await publishResponsePromise
  if (!response) {
    throw new Error(
      `头条号发布结果等待超时：未捕获 ${TOUTIAO_PUBLISH_API_ORIGIN}${TOUTIAO_PUBLISH_API_PATH} 响应`,
    )
  }

  if (!response.ok()) {
    throw new Error(`头条号发布失败：发布接口返回 HTTP ${response.status()}`)
  }

  let payload: ToutiaoPublishResponse
  try {
    payload = (await response.json()) as ToutiaoPublishResponse
  } catch {
    throw new Error('头条号发布失败：发布接口响应不是有效 JSON')
  }

  const platformArticleId = payload.data?.pgc_id?.trim() ?? ''
  if (payload.code !== 0 || payload.err_no !== 0 || !platformArticleId) {
    const reason = payload.reason?.trim() || payload.message?.trim()
    throw new Error(
      `头条号发布失败：${reason || `code=${String(payload.code)}, err_no=${String(payload.err_no)}`}`,
    )
  }
  if (!/^\d+$/.test(platformArticleId)) {
    throw new Error('头条号发布失败：发布接口返回的 pgc_id 格式无效')
  }

  return {
    platformArticleId,
    publishedUrl: `${TOUTIAO_ARTICLE_URL_PREFIX}${platformArticleId}/`,
  }
}

async function uploadFile(page: Page, selector: string, filePath: string, label: string) {
  const input = (await page.waitForSelector(selector, {
    timeout: UPLOAD_TIMEOUT_MS,
  })) as ElementHandle<HTMLInputElement> | null
  if (!input) {
    throw new Error(`未找到${label}上传输入框：${selector}`)
  }
  await input.uploadFile(filePath)
  await sleep(1_000)
}

async function clickRequired(page: Page, selector: string, label: string) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: FIELD_TIMEOUT_MS })
    await page.click(selector)
  } catch {
    throw new Error(`未找到${label}：${selector}`)
  }
}

async function clickOptional(page: Page, selector: string) {
  const element = await page.$(selector)
  if (!element) return false
  const visible = await element.isIntersectingViewport().catch(() => false)
  if (!visible) return false
  await element.click()
  await sleep(300)
  return true
}
