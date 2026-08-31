import type { Page } from 'puppeteer'
import { articleContentToPlainText } from '../draft'
import type { PublishArticleInput } from '../types'
import { sleep } from '../publish-helpers'

const FIELD_TIMEOUT_MS = 30_000
const EDITOR_SETTLE_TIMEOUT_MS = 10_000
const PUBLISH_TIMEOUT_MS = 45_000
const MIN_TITLE_LENGTH = 5
const MAX_TITLE_LENGTH = 64

/**
 * 网易号发布流程的唯一选择器入口。
 * 页面 DOM 变化时只修改这里，不增加候选数组、全页面文本扫描或位置回退。
 */
export const NETEASE_SELECTORS = {
  title: 'textarea.netease-textarea[placeholder="请输入标题 (5~64个字)"]',
  editor:
    'div.notranslate.public-DraftEditor-content[contenteditable="true"][role="textbox"]',
  autoCover:
    '::-p-xpath(//span[@class="ne-switch-base-label-text" and normalize-space(.)="自动"])',
  publishButton: '::-p-xpath(//button[normalize-space(.)="发布"])',
} as const

export async function publishNeteaseArticle(
  page: Page,
  article: PublishArticleInput,
): Promise<string> {
  console.log('[NeteasePublisher] start', {
    title: article.title?.slice(0, 30),
    contentLength: article.content?.length ?? 0,
  })

  await Promise.all([
    waitForRequiredElement(page, NETEASE_SELECTORS.title, '网易号标题输入框'),
    waitForRequiredElement(page, NETEASE_SELECTORS.editor, '网易号正文编辑器'),
  ])
  await fillTitle(page, article.title)
  await fillContent(page, article.content)
  await selectAutoCover(page)
  return submitArticle(page)
}

async function fillTitle(page: Page, title: string) {
  const value = title.trim().slice(0, MAX_TITLE_LENGTH)
  if (value.length < MIN_TITLE_LENGTH) {
    throw new Error(`网易号标题不能少于 ${MIN_TITLE_LENGTH} 个字`)
  }

  const assignedValue = await page.$eval(
    NETEASE_SELECTORS.title,
    (element, nextValue) => {
      if (!(element instanceof HTMLTextAreaElement)) {
        throw new Error('配置的网易号标题元素不是 textarea')
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
    throw new Error('网易号标题填充失败：标题输入框未保留指定内容')
  }

  try {
    await page.waitForFunction(
      (selector, expectedValue) => {
        const element = document.querySelector(selector)
        return element instanceof HTMLTextAreaElement && element.value === expectedValue
      },
      { timeout: FIELD_TIMEOUT_MS },
      NETEASE_SELECTORS.title,
      value,
    )
  } catch {
    throw new Error('网易号标题填充失败：页面状态没有接受标题变更')
  }
}

async function fillContent(page: Page, content: string) {
  if (!content.trim()) throw new Error('网易号正文不能为空')

  const plainText = articleContentToPlainText(content)
  await page.$eval(
    NETEASE_SELECTORS.editor,
    (element, htmlValue, plainValue) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error('配置的网易号正文元素不是 HTMLElement')
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
      for (const heading of Array.from(
        parsedContent.body.querySelectorAll('h1, h2, h3, h4, h6'),
      )) {
        const h5 = parsedContent.createElement('h5')
        h5.innerHTML = heading.innerHTML
        heading.replaceWith(h5)
      }

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
      NETEASE_SELECTORS.editor,
    )
  } catch {
    throw new Error('网易号正文填充失败：粘贴后指定编辑器仍为空')
  }

  await waitForNetworkSettled(page, EDITOR_SETTLE_TIMEOUT_MS)
  const state = await page.$eval(NETEASE_SELECTORS.editor, (element) => ({
    text: element instanceof HTMLElement ? element.innerText.trim() : '',
    imageCount: element.querySelectorAll('img').length,
  }))
  if (!state.text && state.imageCount === 0) {
    throw new Error('网易号正文填充失败：指定编辑器未保留粘贴内容')
  }
}

async function selectAutoCover(page: Page) {
  await clickRequired(page, NETEASE_SELECTORS.autoCover, '网易号自动封面选项')
  await waitForNetworkSettled(page, 5_000)
}

async function submitArticle(page: Page): Promise<string> {
  const beforeUrl = page.url()
  await clickRequired(page, NETEASE_SELECTORS.publishButton, '网易号发布按钮')

  const startedAt = Date.now()
  while (Date.now() - startedAt < PUBLISH_TIMEOUT_MS) {
    if (page.url() !== beforeUrl) return page.url()
    await sleep(500)
  }
  throw new Error(`网易号发布结果等待超时 (${PUBLISH_TIMEOUT_MS}ms)：${page.url()}`)
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

async function waitForNetworkSettled(page: Page, timeout: number) {
  await page.waitForNetworkIdle({ idleTime: 1_000, timeout }).catch(() => undefined)
}
