import type { ElementHandle, Frame, Page } from 'puppeteer'
import type { PublishArticleInput, PublishArticleResult } from '../types'
import {
  clearEditor,
  pasteHtmlIntoEditor,
  sleep,
} from '../publish-helpers'

const FIELD_TIMEOUT_MS = 20_000
const PUBLISH_TIMEOUT_MS = 45_000
const MAX_TAGS = 5
const CSDN_PUBLISH_SUCCESS_ORIGIN = 'https://mp.csdn.net'
const CSDN_PUBLISH_SUCCESS_PATH_PREFIX = '/mp_blog/creation/success/'

/**
 * CSDN 发布流程的唯一选择器入口。
 * 页面 DOM 变更时只修改这里，不在流程中增加候选数组或文案回退。
 *
 * CSDN 编辑器基于 CKEditor 4 经典模式（iframe 模式），编辑区是 iframe 内的 <body>，
 * 不是主页面的元素。所有正文操作必须切换到 iframe 的 frame 上执行。
 * 粘贴 HTML 时图片会自动上传到 CSDN CDN（i-blog.csdnimg.cn），无需走工具栏逐张上传。
 */
export const CSDN_SELECTORS = {
  title: 'textarea#txtTitle',
  // CKEditor 4 经典模式的 iframe，标准 class 是 cke_wysiwyg_frame
  editorFrame: 'iframe.cke_wysiwyg_frame',
  // 编辑器 body 在 iframe 内，用 cke_editable class 精准定位
  editor: 'body.htmledit_views.cke_editable[contenteditable="true"]',

  // 标签
  tagAddButton: '.tag-box',
  // 标签搜索框：CSDN 已把 Element UI 改成自研 el_mcm- 前缀组件，
  // 搜索框可能从 input 改成 textarea（如标题框），多候选容错覆盖各种变体。
  tagSearchInputCandidates: [
    'input.el_mcm-input__inner[placeholder*="搜索"]',
    'textarea.el_mcm-textarea__inner[placeholder*="搜索"]',
    'input[placeholder*="搜索"][type="text"]',
    'textarea[placeholder*="搜索"]',
    '.tag-search input[type="text"]',
    '.tag-search textarea',
    '.tag__search input[type="text"]',
    '.tag__search textarea',
    '.article-tag input[type="text"]',
    '.article-tag textarea',
  ],
  tagItem: 'span.el_mcm-tag',
  tagItemContent: 'span.el_mcm-tag__content',
  tagItemSelected: 'span.el_mcm-tag.is-selected',

  // 发布
  publishButton: '::-p-xpath(//button[normalize-space(.)="发布博客"])',
} as const

export async function publishCsdnArticle(
  page: Page,
  article: PublishArticleInput,
): Promise<PublishArticleResult> {
  console.log('[CsdnPublisher] start', {
    title: article.title?.slice(0, 30),
    contentLength: article.content?.length ?? 0,
    cover: article.cover?.slice(0, 80),
    tags: article.tags,
  })

  await waitForRequiredElement(page, CSDN_SELECTORS.title, 'CSDN标题输入框')
  const editorFrame = await requireEditorFrame(page)

  await fillTitle(page, article.title)
  await sleep(500)

  await fillContent(editorFrame, article.content)
  await sleep(1_000)

  if (article.tags && article.tags.length > 0) {
    await fillTags(page, article.tags.slice(0, MAX_TAGS))
    await sleep(500)
  } else {
    article.tags = ['品牌宣传']
    await fillTags(page, article.tags.slice(0, MAX_TAGS))
    await sleep(500)
  }

  return submitArticle(page)
}

/**
 * 获取 CSDN CKEditor 4 的 iframe frame。
 * 先用标准 class cke_wysiwyg_frame 定位 iframe，找不到则遍历所有 iframe 查找含 cke_editable body 的那个。
 */
async function requireEditorFrame(page: Page): Promise<Frame> {
  // 先用标准 CKEditor 4 iframe class 定位
  let frame: Frame | undefined
  try {
    const frameElement = await page.waitForSelector(CSDN_SELECTORS.editorFrame, {
      visible: true,
      timeout: FIELD_TIMEOUT_MS,
    })
    frame = await frameElement?.contentFrame()
  } catch {
    frame = undefined
  }

  // 标准 class 找不到时，遍历所有 iframe 查找含 cke_editable body 的那个
  if (!frame) {
    console.log('[CsdnPublisher] 标准 iframe class 未命中，遍历所有 iframe 查找编辑器')
    const frames = page.frames()
    for (const f of frames) {
      try {
        const hasEditor = await f.$(CSDN_SELECTORS.editor)
        if (hasEditor) {
          frame = f
          break
        }
      } catch {
        continue
      }
    }
  }

  if (!frame) {
    throw new Error(
      `未找到CSDN正文编辑器 iframe：${CSDN_SELECTORS.editorFrame}（也未在任意 iframe 内找到 ${CSDN_SELECTORS.editor}）`,
    )
  }

  // 等待 iframe 内的 body 可编辑
  try {
    await frame.waitForSelector(CSDN_SELECTORS.editor, {
      visible: true,
      timeout: FIELD_TIMEOUT_MS,
    })
  } catch {
    throw new Error(`CSDN正文编辑器未就绪：${CSDN_SELECTORS.editor}`)
  }
  return frame
}

// ==================== 标题 ====================

async function fillTitle(page: Page, title: string) {
  if (!title) throw new Error('CSDN标题不能为空')
  const value = title.trim().slice(0, 100)
  if (value.length < 5) throw new Error('CSDN标题不能少于5个字')

  // CSDN 标题是 Vue 受控的 textarea，需用 nativeSetter 触发原生事件才能让框架接收变更
  const assignedValue = await page.$eval(
    CSDN_SELECTORS.title,
    (element, nextValue) => {
      if (!(element instanceof HTMLTextAreaElement)) {
        throw new Error('配置的CSDN标题元素不是textarea')
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
    throw new Error('CSDN标题填充失败：标题输入框未保留指定内容')
  }
}

// ==================== 正文 ====================

async function fillContent(frame: Frame, content: string) {
  if (!content.trim()) throw new Error('CSDN正文不能为空')

  await clearEditor(frame, CSDN_SELECTORS.editor)
  await pasteHtmlIntoEditor(frame, CSDN_SELECTORS.editor, content)

  const contentState = await frame.$eval(CSDN_SELECTORS.editor, (element) => ({
    text: element instanceof HTMLElement ? element.innerText.trim() : '',
    imageCount: element.querySelectorAll('img').length,
  }))
  if (!contentState.text && contentState.imageCount === 0) {
    throw new Error('CSDN正文填充失败：编辑器仍为空')
  }
}

// ==================== 标签 ====================

async function fillTags(page: Page, tags: string[]) {
  try {
    // 点击"添加文章标签"按钮打开标签面板
    const clicked = await clickOptional(page, CSDN_SELECTORS.tagAddButton)
    if (!clicked) {
      console.log('[CsdnPublisher] 未找到标签入口，跳过')
      return
    }
    await sleep(800)

    for (const tag of tags) {
      await selectTag(page, tag)
      await sleep(300)
    }

    // 关闭标签面板（按 Esc）
    await page.keyboard.press('Escape')
    await sleep(500)
  } catch (err) {
    // CSDN 页面 DOM 变化导致标签填充失败时降级跳过，不阻塞发布。
    // 标签缺失不影响文章发布本身，发布按钮仍可点击。
    console.log(
      '[CsdnPublisher] 标签填充失败，降级跳过：',
      err instanceof Error ? err.message : String(err),
    )
    // 强制关闭可能打开的标签面板，避免遮挡发布按钮
    await page.keyboard.press('Escape').catch(() => {})
    await sleep(500)
  }
}

async function selectTag(page: Page, tagName: string) {
  // 搜索标签：多候选选择器，任一命中即可
  const searchInput = await waitForFirstSelector(
    page,
    CSDN_SELECTORS.tagSearchInputCandidates,
    5_000, // 缩短超时，快速失败后让上层降级
  )
  if (!searchInput) {
    throw new Error(
      `未找到CSDN标签搜索框（候选：${CSDN_SELECTORS.tagSearchInputCandidates.join(' | ')}）`,
    )
  }

  await searchInput.click()
  await selectAll(page)
  await page.keyboard.press('Backspace')
  await page.keyboard.type(tagName, { delay: 30 })
  await sleep(800)

  // 点击匹配且未选中的标签项（已选的跳过，避免取消选中）
  const clicked = await page.evaluate((name) => {
    const tags = Array.from(document.querySelectorAll('span.el_mcm-tag'))
    const target = tags.find((tag) => {
      const content = tag.querySelector('span.el_mcm-tag__content')
      return (
        content &&
        content.textContent?.trim() === name &&
        !tag.classList.contains('is-selected')
      )
    })
    if (target instanceof HTMLElement) {
      target.click()
      return true
    }
    return false
  }, tagName)

  if (!clicked) {
    await page.keyboard.press('Enter')
    console.log(`[CsdnPublisher] 标签已选或未找到：${tagName}`)
  }
}

// waitForFirstSelector 按顺序尝试多个选择器，返回第一个命中的元素。
// 所有选择器都未命中时返回 null（不抛错，由调用方决定如何处理）。
async function waitForFirstSelector(
  page: Page,
  selectors: readonly string[],
  timeoutMs: number,
): Promise<ElementHandle | null> {
  // 并发等待所有候选选择器，任一命中即返回
  const deadline = Date.now() + timeoutMs
  for (const selector of selectors) {
    if (Date.now() > deadline) break
    try {
      const element = await page.waitForSelector(selector, {
        visible: true,
        timeout: Math.min(timeoutMs, Math.max(1_000, deadline - Date.now())),
      })
      if (element) return element
    } catch {
      // 继续尝试下一个候选选择器
    }
  }
  return null
}

// ==================== 提交 ====================

export function parseCsdnPublishSuccessUrl(urlValue: string): PublishArticleResult | null {
  try {
    const url = new URL(urlValue)
    if (url.origin !== CSDN_PUBLISH_SUCCESS_ORIGIN) return null

    const match = url.pathname.match(/^\/mp_blog\/creation\/success\/([1-9]\d*)\/?$/)
    if (!match) return null

    const platformArticleId = match[1]
    return {
      platformArticleId,
      publishedUrl: `${CSDN_PUBLISH_SUCCESS_ORIGIN}${CSDN_PUBLISH_SUCCESS_PATH_PREFIX}${platformArticleId}`,
    }
  } catch {
    return null
  }
}

async function submitArticle(page: Page): Promise<PublishArticleResult> {
  const beforeUrl = page.url()
  await clickRequired(page, CSDN_SELECTORS.publishButton, 'CSDN发布按钮')

  const startedAt = Date.now()
  while (Date.now() - startedAt < PUBLISH_TIMEOUT_MS) {
    const result = parseCsdnPublishSuccessUrl(page.url())
    if (result) {
      console.log('[CsdnPublisher] published', result)
      return result
    }
    await sleep(500)
  }
  throw new Error(
    `CSDN发布结果等待超时 (${PUBLISH_TIMEOUT_MS}ms)：未进入成功页；发布前=${beforeUrl}，当前=${page.url()}`,
  )
}

// ==================== 工具函数 ====================

async function waitForRequiredElement(page: Page, selector: string, label: string) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: FIELD_TIMEOUT_MS })
  } catch {
    throw new Error(`未找到${label}：${selector}`)
  }
}

async function clickRequired(page: Page, selector: string, label: string) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: FIELD_TIMEOUT_MS })
    await page.click(selector)
    await sleep(300)
  } catch {
    throw new Error(`未找到${label}：${selector}`)
  }
}

async function clickOptional(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: 2_000 })
    await page.click(selector)
    await sleep(300)
    return true
  } catch {
    return false
  }
}

async function selectAll(page: Page) {
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.keyboard.down(modifier)
  await page.keyboard.press('A')
  await page.keyboard.up(modifier)
}
