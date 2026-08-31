import type { ElementHandle, Page } from 'puppeteer'
import type { PublishArticleInput } from '../types'
import { articleContentToPlainText } from '../draft'
import {
  createTempDir,
  resolveMediaFile,
  safeRemoveDir,
  sleep,
} from '../publish-helpers'

const FIELD_TIMEOUT_MS = 20_000
const UPLOAD_TIMEOUT_MS = 30_000
const PUBLISH_TIMEOUT_MS = 30_000
const EDITOR_SETTLE_TIMEOUT_MS = 10_000
const COVER_SETTLE_MS = 5_000
const MAX_TITLE_LENGTH = 100

/**
 * 知乎发布流程的唯一选择器入口。
 * 页面 DOM 变更时只修改这里，不在流程中增加候选数组或文案回退。
 */
export const ZHIHU_SELECTORS = {
  title: 'textarea[placeholder="请输入标题（最多 100 个字）"]',
  editor: 'div[data-contents="true"]',
  coverInput: 'input[type="file"].UploadPicture-input',
  saveStatus: '.WriteIndex-status',
  publishButton: '.PublishPanel-stepOneButton',
  publishConfirmButton: '.PublishPanel-stepTwoButton',
  success: '::-p-text(发布成功)',
} as const

export async function publishZhihuArticle(page: Page, article: PublishArticleInput): Promise<string> {
  console.log('[ZhihuPublisher] start', {
    title: article.title?.slice(0, 30),
    contentLength: article.content?.length ?? 0,
    cover: article.cover?.slice(0, 80),
  })

  await waitForRequiredElement(page, ZHIHU_SELECTORS.title, '知乎标题输入框')
  await waitForRequiredElement(page, ZHIHU_SELECTORS.editor, '知乎正文编辑器')
  await fillTitle(page, article.title)
  await fillContent(page, article.content);
  await sleep(1000);
  await fillCover(page, article.cover)
  // await waitForDraftSaved(page)
  await sleep(3000);
  return submitZhihuArticle(page)
}

async function fillTitle(page: Page, title: string) {
  const value = title.trim().slice(0, MAX_TITLE_LENGTH)
  if (!value) throw new Error('知乎标题不能为空')

  const assignedValue = await page.$eval(
    ZHIHU_SELECTORS.title,
    (element, nextValue) => {
      if (!(element instanceof HTMLTextAreaElement)) {
        throw new Error('配置的知乎标题元素不是 textarea')
      }

      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
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
    throw new Error('知乎标题填充失败：标题输入框未保留指定内容')
  }

  try {
    await page.waitForFunction(
      (selector, expectedValue) => {
        const element = document.querySelector(selector)
        return element instanceof HTMLTextAreaElement && element.value === expectedValue
      },
      { timeout: FIELD_TIMEOUT_MS },
      ZHIHU_SELECTORS.title,
      value,
    )
  } catch {
    throw new Error('知乎标题填充失败：页面状态没有接受标题变更')
  }
}

async function fillContent(page: Page, content: string) {
  if (!content.trim()) throw new Error('知乎正文不能为空')

  const plainText = articleContentToPlainText(content)
  await page.$eval(
    ZHIHU_SELECTORS.editor,
    (element, htmlValue, plainValue) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error('配置的知乎正文元素不是 HTMLElement')
      }

      element.focus()
      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)

      const parsedContent = new DOMParser().parseFromString(htmlValue, 'text/html')
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
      ZHIHU_SELECTORS.editor,
    )
  } catch {
    throw new Error('知乎正文填充失败：粘贴后指定编辑器仍为空')
  }

  await waitForNetworkSettled(page, EDITOR_SETTLE_TIMEOUT_MS)
  const contentState = await page.$eval(ZHIHU_SELECTORS.editor, (element) => ({
    text: element instanceof HTMLElement ? element.innerText.trim() : '',
    imageCount: element.querySelectorAll('img').length,
  }))
  if (!contentState.text && contentState.imageCount === 0) {
    throw new Error('知乎正文填充失败：指定编辑器未保留粘贴内容')
  }
}

async function fillCover(page: Page, cover?: string) {
  if (!cover) return

  const tempDir = createTempDir('zhihu-cover-')
  try {
    const filePath = await resolveMediaFile(page, cover, tempDir)
    const input = (await page.waitForSelector(ZHIHU_SELECTORS.coverInput, {
      timeout: UPLOAD_TIMEOUT_MS,
    })) as ElementHandle<HTMLInputElement> | null
    if (!input) {
      throw new Error(`未找到知乎封面上传输入框：${ZHIHU_SELECTORS.coverInput}`)
    }

    // Puppeteer 的 uploadFile 会像 DataTransfer 赋值一样更新 files，
    // 并触发页面监听的 input/change 事件。
    await input.uploadFile(filePath)
    try {
      await page.waitForFunction(
        (selector) => {
          const element = document.querySelector(selector)
          return element instanceof HTMLInputElement && (element.files?.length ?? 0) > 0
        },
        { timeout: UPLOAD_TIMEOUT_MS },
        ZHIHU_SELECTORS.coverInput,
      )
    } catch {
      throw new Error('知乎封面填充失败：文件没有进入上传输入框')
    }

    // 知乎会在 change 事件之后异步上传和裁剪封面，保留明确的上传收敛时间。
    await waitForNetworkSettled(page, COVER_SETTLE_MS)
    await sleep(COVER_SETTLE_MS)
  } finally {
    safeRemoveDir(tempDir)
  }
}

async function submitZhihuArticle(page: Page): Promise<string> {
  const beforeUrl = page.url()
  await page.$$eval('button', (buttons, targetText) => {
    const targetButton = buttons.find(btn => btn.textContent.trim() === targetText);
    if (targetButton) {
        targetButton.click();
      }
    }, '发布');
  const newUrl = await waitForPublishResult(page, beforeUrl)
  return newUrl
}

async function waitForRequiredElement(page: Page, selector: string, label: string) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: FIELD_TIMEOUT_MS })
  } catch {
    throw new Error(`未找到${label}：${selector}`)
  }
}


async function waitForNetworkSettled(page: Page, timeout: number) {
  await page.waitForNetworkIdle({ idleTime: 800, timeout }).catch(() => undefined)
}

async function waitForPublishResult(page: Page, beforeUrl: string): Promise<string> {
  const startedAt = Date.now()
  let lastKnownUrl = beforeUrl

  while (Date.now() - startedAt < PUBLISH_TIMEOUT_MS) {
    try {
      const currentUrl = page.url()
      lastKnownUrl = currentUrl
      if (currentUrl !== beforeUrl) return currentUrl
      if (await isVisible(page, ZHIHU_SELECTORS.success)) return currentUrl
    } catch (err) {
      // Execution context was destroyed - page is navigating
      // If we already have a different URL, the publish succeeded
      if (lastKnownUrl !== beforeUrl) return lastKnownUrl
    }
    await sleep(500)
  }
  // Timeout - if URL has changed, publish succeeded even if we couldn't verify
  if (lastKnownUrl !== beforeUrl) return lastKnownUrl
  throw new Error(`知乎发布结果等待超时 (${PUBLISH_TIMEOUT_MS}ms): ${lastKnownUrl}`)
}

async function isVisible(page: Page, selector: string) {
  const element = await page.$(selector)
  if (!element) return false
  return element.isIntersectingViewport().catch(() => false)
}
