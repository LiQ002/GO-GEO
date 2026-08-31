import type { Page } from 'puppeteer'
import fs from 'node:fs'
import path from 'node:path'
import { articleContentToPlainText } from '../draft'
import type { PublishArticleInput, PublishArticleResult } from '../types'
import {
  createTempDir,
  resolveMediaFile,
  safeRemoveDir,
  sleep,
} from '../publish-helpers'

const FIELD_TIMEOUT_MS = 30_000
const OPERATION_SETTLE_MS = 800
const PAGE_READY_TIMEOUT_MS = 60_000
const SAVE_TIMEOUT_MS = 30_000
const PUBLISH_TIMEOUT_MS = 45_000
const JIANSHU_ORIGIN = 'https://www.jianshu.com'
const JIANSHU_UPLOAD_TOKEN_URL = `${JIANSHU_ORIGIN}/upload_images/token.json`
const JIANSHU_IMAGE_UPLOAD_URL = 'https://upload.qiniup.com/'

type JianshuUploadConfig = {
  token?: string
  key?: string
}

type JianshuUploadResult = {
  url?: string
}

/**
 * 简书发布流程的唯一选择器入口。
 * 选择器来自 2026-08-10 实际发布页面，不增加候选数组、位置推断或 URL 跳转回退。
 */
export const JIANSHU_SELECTORS = {
  newArticle:
    '::-p-xpath(//div[./span[normalize-space(.)="新建文章"]])',
  title: 'input._24i7u',
  editor: 'div.kalamu-area[contenteditable="true"]',
  saved:
    '::-p-xpath(//p[normalize-space(.)="已保存"])',
  publishButton: 'a[data-action="publicize"]',
  publishBlocked:
    '::-p-xpath(//*[normalize-space(.)="您需要绑定手机和微信才能公开发布文章"])',
  publishSuccessLink:
    '::-p-xpath(//a[normalize-space(.)="发布成功，点击查看文章" and starts-with(@href,"https://www.jianshu.com/p/")])',
} as const

export async function publishJianshuArticle(
  page: Page,
  article: PublishArticleInput,
): Promise<PublishArticleResult> {
  console.log('[JianshuPublisher] start', {
    title: article.title?.slice(0, 30),
    contentLength: article.content?.length ?? 0,
  })

  await waitForPageReady(page)
  await createArticle(page)
  await fillTitle(page, article.title)
  const content = await uploadContentImages(page, article.content)
  await fillContent(page, content)
  await waitForSaved(page)
  return submitArticle(page)
}

async function uploadContentImages(page: Page, content: string): Promise<string> {
  const imageSources = await page.evaluate((htmlValue) => {
    const parsedContent = new DOMParser().parseFromString(htmlValue, 'text/html')
    return Array.from(parsedContent.body.querySelectorAll('img[src]'))
      .map((image) => image.getAttribute('src')?.trim() ?? '')
      .filter(Boolean)
  }, content)
  const uniqueSources = Array.from(new Set(imageSources))
  if (uniqueSources.length === 0) return content

  const tempDir = createTempDir('jianshu-content-image-')
  try {
    const replacements: Array<{ source: string; uploadedUrl: string }> = []
    for (const source of uniqueSources) {
      const filePath = await resolveMediaFile(page, source, tempDir)
      const filename = path.basename(filePath)
      const config = await getUploadConfig(page, filename)
      const uploadedUrl = await uploadImage(filePath, filename, config)
      replacements.push({ source, uploadedUrl })
    }

    return page.evaluate(
      (htmlValue, imageReplacements) => {
        const parsedContent = new DOMParser().parseFromString(htmlValue, 'text/html')
        const replacementMap = new Map(
          imageReplacements.map((item) => [item.source, item.uploadedUrl]),
        )
        parsedContent.body.querySelectorAll('img[src]').forEach((image) => {
          const source = image.getAttribute('src')?.trim() ?? ''
          const uploadedUrl = replacementMap.get(source)
          if (uploadedUrl) image.setAttribute('src', uploadedUrl)
        })
        return parsedContent.body.innerHTML
      },
      content,
      replacements,
    )
  } finally {
    safeRemoveDir(tempDir)
  }
}

async function getUploadConfig(
  page: Page,
  filename: string,
): Promise<{ token: string; key: string }> {
  let config: JianshuUploadConfig
  try {
    config = await page.evaluate(async (imageFilename, tokenUrl) => {
      const params = new URLSearchParams({ filename: imageFilename })
      const response = await fetch(`${tokenUrl}?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return (await response.json()) as JianshuUploadConfig
    }, filename, JIANSHU_UPLOAD_TOKEN_URL)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`简书正文图片上传凭据获取失败：${message}`)
  }

  const token = config.token?.trim() ?? ''
  const key = config.key?.trim() ?? ''
  if (!token || !key) {
    throw new Error('简书正文图片上传凭据无效：缺少 token 或 key')
  }
  return { token, key }
}

async function uploadImage(
  filePath: string,
  filename: string,
  config: { token: string; key: string },
): Promise<string> {
  const bytes = fs.readFileSync(filePath)
  if (bytes.length === 0) throw new Error(`简书正文图片为空：${filename}`)

  const formData = new FormData()
  formData.append('token', config.token)
  formData.append('key', config.key)
  formData.append(
    'file',
    new Blob([new Uint8Array(bytes)], { type: imageContentType(filename) }),
    filename,
  )
  formData.append('x:protocol', 'https')

  let response: Response
  try {
    response = await fetch(JIANSHU_IMAGE_UPLOAD_URL, {
      method: 'POST',
      body: formData,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`简书正文图片上传失败：${message}`)
  }
  if (!response.ok) {
    throw new Error(`简书正文图片上传失败：HTTP ${response.status}`)
  }

  let result: JianshuUploadResult
  try {
    result = (await response.json()) as JianshuUploadResult
  } catch {
    throw new Error('简书正文图片上传失败：上传接口响应不是有效 JSON')
  }
  const uploadedUrl = result.url?.trim() ?? ''
  let parsedUrl: URL
  try {
    parsedUrl = new URL(uploadedUrl)
  } catch {
    throw new Error('简书正文图片上传失败：上传接口未返回有效图片地址')
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error('简书正文图片上传失败：上传接口返回了不支持的图片地址')
  }
  return parsedUrl.toString()
}

function imageContentType(filename: string): string {
  switch (path.extname(filename).toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    default:
      return 'application/octet-stream'
  }
}

async function waitForPageReady(page: Page) {
  try {
    await page.waitForFunction(
      () => document.readyState === 'complete',
      { timeout: PAGE_READY_TIMEOUT_MS },
    )
  } catch {
    throw new Error(`简书发布页面加载超时 (${PAGE_READY_TIMEOUT_MS}ms)：${page.url()}`)
  }
}

async function createArticle(page: Page) {
  await clickRequired(page, JIANSHU_SELECTORS.newArticle, '简书新建文章入口')
  await waitForOperationSettled()
  await Promise.all([
    waitForRequiredElement(page, JIANSHU_SELECTORS.title, '简书标题输入框'),
    waitForRequiredElement(page, JIANSHU_SELECTORS.editor, '简书正文编辑器'),
  ])
}

async function fillTitle(page: Page, title: string) {
  const value = title.trim()
  if (!value) throw new Error('简书标题不能为空')

  const assignedValue = await page.$eval(
    JIANSHU_SELECTORS.title,
    (element, nextValue) => {
      if (!(element instanceof HTMLInputElement)) {
        throw new Error('配置的简书标题元素不是 input')
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
    throw new Error('简书标题填充失败：标题输入框未保留指定内容')
  }

  await waitForOperationSettled()
  try {
    await page.waitForFunction(
      (selector, expectedValue) => {
        const element = document.querySelector(selector)
        return element instanceof HTMLInputElement && element.value === expectedValue
      },
      { timeout: FIELD_TIMEOUT_MS },
      JIANSHU_SELECTORS.title,
      value,
    )
  } catch {
    throw new Error('简书标题填充失败：页面状态没有接受标题变更')
  }
}

async function fillContent(page: Page, content: string) {
  if (!content.trim()) throw new Error('简书正文不能为空')

  const plainText = articleContentToPlainText(content)
  const expectedImageCount = await page.$eval(
    JIANSHU_SELECTORS.editor,
    (element, htmlValue, plainValue) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error('配置的简书正文元素不是 HTMLElement')
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

  await waitForOperationSettled()
  try {
    await page.waitForFunction(
      (selector, minimumImageCount) => {
        const editor = document.querySelector(selector)
        if (!(editor instanceof HTMLElement)) return false

        const images = Array.from(editor.querySelectorAll('img'))
        return (
          (editor.innerText.trim().length > 0 || images.length > 0) &&
          images.length >= minimumImageCount &&
          images.every((image) => image.complete && image.naturalWidth > 0)
        )
      },
      { timeout: FIELD_TIMEOUT_MS },
      JIANSHU_SELECTORS.editor,
      expectedImageCount,
    )
  } catch {
    throw new Error('简书正文填充失败：粘贴后正文或图片未就绪')
  }
}

async function waitForSaved(page: Page) {
  try {
    await page.waitForSelector(JIANSHU_SELECTORS.saved, {
      visible: true,
      timeout: SAVE_TIMEOUT_MS,
    })
    await waitForOperationSettled()
  } catch {
    throw new Error(`简书文章自动保存等待超时 (${SAVE_TIMEOUT_MS}ms)`)
  }
}

async function waitForOperationSettled() {
  await sleep(OPERATION_SETTLE_MS)
}

async function submitArticle(page: Page): Promise<PublishArticleResult> {
  await clickRequired(page, JIANSHU_SELECTORS.publishButton, '简书发布文章按钮')

  const startedAt = Date.now()
  while (Date.now() - startedAt < PUBLISH_TIMEOUT_MS) {
    if (await page.$(JIANSHU_SELECTORS.publishBlocked)) {
      throw new Error('简书发布失败：账号需要同时绑定手机号和微信')
    }

    if (await page.$(JIANSHU_SELECTORS.publishSuccessLink)) {
      const href = await page.$eval(
        JIANSHU_SELECTORS.publishSuccessLink,
        (element) => (element instanceof HTMLAnchorElement ? element.href : ''),
      )
      return parsePublishedArticle(href)
    }
    await sleep(500)
  }

  throw new Error(`简书发布结果等待超时 (${PUBLISH_TIMEOUT_MS}ms)：${page.url()}`)
}

function parsePublishedArticle(href: string): PublishArticleResult {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    throw new Error('简书发布失败：发布成功链接无效')
  }

  const match = url.pathname.match(/^\/p\/([a-zA-Z0-9]+)$/)
  if (url.origin !== JIANSHU_ORIGIN || !match) {
    throw new Error('简书发布失败：发布成功链接不属于简书文章')
  }

  return {
    platformArticleId: match[1],
    publishedUrl: `${JIANSHU_ORIGIN}${url.pathname}`,
  }
}

async function waitForRequiredElement(page: Page, selector: string, label: string) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: FIELD_TIMEOUT_MS })
  } catch {
    throw new Error(`未找到${label}：${selector}`)
  }
}

async function clickRequired(page: Page, selector: string, label: string) {
  await waitForRequiredElement(page, selector, label)
  await page.click(selector)
}
