import type { ElementHandle, Page } from 'puppeteer'
import type { PublishArticleInput } from '../types'
import { articleContentToPlainText } from '../draft'
import {
  createTempDir,
  resolveMediaFile,
  safeRemoveDir,
  sleep,
} from '../publish-helpers'

const FIELD_TIMEOUT_MS = 15_000
const UPLOAD_TIMEOUT_MS = 30_000
const SEND_TIMEOUT_MS = 30_000
const MAX_WEIBO_TEXT_LENGTH = 1_800
export const WEIBO_SESSION_COOKIE_NAME = 'SUB'

/**
 * 微博发布流程的唯一选择器入口。
 * 页面 DOM 变更时只修改这里，不在流程中增加候选数组或模糊查找。
 */
export const WEIBO_SELECTORS = {
  editor: 'textarea[placeholder="有什么新鲜事想告诉大家"]',
  imageButton: '::-p-xpath(//*[@aria-label="图片"])',
  imageInput: 'input[type="file"][accept="image/*"]',
  submitButton: '::-p-xpath(//button[normalize-space(.)="发送"])',
  success: '::-p-text(发送成功)',
  publishedLink: '[node-type="feed_list"] article:first-of-type a[aria-label="微博详情"]',
} as const

export async function publishWeiboArticle(page: Page, article: PublishArticleInput): Promise<string> {
  console.log('[WeiboPublisher] start', {
    title: article.title?.slice(0, 30),
    contentLength: article.content?.length ?? 0,
    summaryLength: article.summary?.length ?? 0,
    cover: article.cover?.slice(0, 80),
  })

  const plainContent = articleContentToPlainText(article.content || '')
  const body = buildWeiboBody(
    article.title,
    article.summary,
    plainContent,
    MAX_WEIBO_TEXT_LENGTH,
  )

  await page.waitForSelector(WEIBO_SELECTORS.editor, {
    visible: true,
    timeout: FIELD_TIMEOUT_MS,
  })
  await fillEditor(page, body)

  const images = collectImages(article.content || '', article.cover).slice(0, 9)
  if (images.length > 0) {
    const tempDir = createTempDir('weibo-pub-')
    try {
      const localImages = await resolveImages(page, images, tempDir)
      if (localImages.length > 0) {
        await uploadImages(page, localImages)
      }
    } finally {
      safeRemoveDir(tempDir)
    }
  }

  const beforeUrl = page.url()
  await clickRequired(page, WEIBO_SELECTORS.submitButton, '微博发送按钮')
  await waitForSendResult(page, beforeUrl)

  const publishedUrl = await page
    .$eval(WEIBO_SELECTORS.publishedLink, (element) =>
      element instanceof HTMLAnchorElement ? element.href : '',
    )
    .catch(() => '')
  return publishedUrl || page.url()
}

export async function assertWeiboAuthenticated(page: Page): Promise<void> {
  const url = page.url()
  if (url.includes('/login') || url.includes('passport.weibo.com')) {
    throw new Error('未登录微博（当前在登录页）')
  }

  const cookies = await page.cookies('https://weibo.com')
  const sessionCookie = cookies.find(
    (cookie) => cookie.name === WEIBO_SESSION_COOKIE_NAME && cookie.value.trim().length > 0,
  )
  if (!sessionCookie) {
    throw new Error(`未登录微博（未检测到登录态 Cookie：${WEIBO_SESSION_COOKIE_NAME}）`)
  }
}

function buildWeiboBody(
  title?: string,
  summary?: string,
  content?: string,
  maxLength = MAX_WEIBO_TEXT_LENGTH,
): string {
  const parts: string[] = []
  if (title?.trim()) parts.push(title.trim())

  const summaryText = summary?.trim() || ''
  const contentText = content?.trim() || ''
  if (summaryText) parts.push(summaryText)
  if (contentText) {
    const used = parts.reduce((total, part) => total + part.length + 2, 0)
    const remaining = maxLength - used
    let text = contentText.replace(/\n{3,}/g, '\n\n')
    if (remaining > 3 && text.length > remaining) {
      text = `${text.slice(0, remaining - 3)}...`
    } else if (remaining <= 3) {
      text = '...'
    }
    parts.push(text)
  }
  return parts.join('\n\n')
}

async function fillEditor(page: Page, body: string) {
  await page.click(WEIBO_SELECTORS.editor)
  const selectAllModifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.keyboard.down(selectAllModifier)
  await page.keyboard.press('A')
  await page.keyboard.up(selectAllModifier)
  await page.keyboard.press('Backspace')
  await page.keyboard.type(body)
}

function collectImages(content: string, cover?: string): string[] {
  const images: string[] = []
  if (cover?.trim()) images.push(cover.trim())

  const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    if (!images.includes(match[1])) images.push(match[1])
  }
  return images
}

async function resolveImages(page: Page, urls: string[], tempDir: string): Promise<string[]> {
  const results: string[] = []
  for (const url of urls) {
    try {
      results.push(await resolveMediaFile(page, url, tempDir))
    } catch (error) {
      console.log('[WeiboPublisher] resolve image failed', url.slice(0, 80), error)
    }
  }
  return results
}

async function uploadImages(page: Page, filePaths: string[]) {
  await clickRequired(page, WEIBO_SELECTORS.imageButton, '微博图片入口')
  const input = (await page.waitForSelector(WEIBO_SELECTORS.imageInput, {
    timeout: UPLOAD_TIMEOUT_MS,
  })) as ElementHandle<HTMLInputElement> | null
  if (!input) {
    throw new Error(`未找到微博图片上传输入框：${WEIBO_SELECTORS.imageInput}`)
  }
  await input.uploadFile(...filePaths)
  await sleep(3_000)
}

async function clickRequired(page: Page, selector: string, label: string) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: FIELD_TIMEOUT_MS })
    await page.click(selector)
  } catch {
    throw new Error(`未找到${label}：${selector}`)
  }
}

async function waitForSendResult(page: Page, beforeUrl: string) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < SEND_TIMEOUT_MS) {
    if (page.url() !== beforeUrl) return
    if (await isVisible(page, WEIBO_SELECTORS.success)) return

    const editorText = await page
      .$eval(WEIBO_SELECTORS.editor, (element) => element.value)
      .catch(() => '')
    if (!editorText.trim()) return
    await sleep(500)
  }

  throw new Error(`微博发送结果等待超时 (${SEND_TIMEOUT_MS}ms): ${page.url()}`)
}

async function isVisible(page: Page, selector: string) {
  const element = await page.$(selector)
  if (!element) return false
  return element.isIntersectingViewport().catch(() => false)
}
