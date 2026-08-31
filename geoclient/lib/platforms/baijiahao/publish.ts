import type { ElementHandle, Frame, Page } from 'puppeteer'
import type { PublishArticleInput, PublishArticleResult } from '../types'
import {
  createTempDir,
  resolveMediaFile,
  safeRemoveDir,
  sleep,
} from '../publish-helpers'

const FIELD_TIMEOUT_MS = 30_000
const PAGE_READY_TIMEOUT_MS = 60_000
const UPLOAD_TIMEOUT_MS = 30_000
const PUBLISH_TIMEOUT_MS = 45_000
const BAIJIAHAO_PUBLISH_API_ORIGIN = 'https://baijiahao.baidu.com'
const BAIJIAHAO_PUBLISH_API_PATH = '/pcui/article/publish'
const BAIJIAHAO_ARTICLE_URL_PREFIX = 'https://baijiahao.baidu.com/s?id='

type BaijiahaoPublishResponse = {
  errno?: number
  errmsg?: string
  ret?: {
    article_id?: string
  }
}

/**
 * 百家号发布流程的唯一选择器入口。
 * 页面 DOM 变更时只修改这里，不在流程中增加候选数组、文案回退或位置推断。
 */
export const BAIJIAHAO_SELECTORS = {
  title: '#newsTextArea > div > div > div > div > div > div > div.client_pages_edit_components_titleInput > div > div.input-box > div',
  summary: 'textarea[placeholder="请输入摘要"]',
  editorFrame: 'iframe#ueditor_0',
  editor: 'body',
  onboardingDismissButton:
    '::-p-xpath(//button[normalize-space(.)="我知道了"])',
  blockingModalCloseButton: '[role="dialog"] button[aria-label="关闭"]',
  coverTrigger: '::-p-xpath(//div[normalize-space(.)="选择封面"])',
  coverInput: 'span.cheetah-upload > input[name="media"][type="file"]',
  coverConfirmButton: 'button.FeEditorApp-e8c90bfac9d4eab4-confirmBtn',
  draftButton: '::-p-xpath(//button[normalize-space(.)="保存草稿"])',
  draftSuccess: '::-p-text(保存成功)',
  publishButton: '::-p-xpath(//button[normalize-space(.)="发布"])',
  publishConfirmButton:
    '::-p-xpath(//*[@role="dialog"]//button[normalize-space(.)="确认发布"])',
} as const

export async function publishBaijiahaoArticle(
  page: Page,
  article: PublishArticleInput,
): Promise<PublishArticleResult> {
  console.log('[BaijiahaoPublisher] start', {
    title: article.title?.slice(0, 30),
    contentLength: article.content?.length ?? 0,
    summaryLength: article.summary?.length ?? 0,
    cover: article.cover?.slice(0, 80),
  })

  await waitForPublishPageReady(page)
  const editorFrame = await requirePublishFormReady(page)
  await fillInput(page, BAIJIAHAO_SELECTORS.title, article.title, '百家号标题')

  if (article.summary && (await isVisible(page, BAIJIAHAO_SELECTORS.summary))) {
    await fillInput(page, BAIJIAHAO_SELECTORS.summary, article.summary, '百家号摘要')
  }

  await fillEditor(editorFrame, article.content)
  await fillCover(page, article.cover)
  return submitArticle(page, editorFrame)
}

async function waitForPublishPageReady(page: Page) {
  try {
    await page.waitForFunction(
      () => document.readyState === 'complete',
      { timeout: PAGE_READY_TIMEOUT_MS },
    )
  } catch {
    throw new Error(`百家号发布页面加载超时 (${PAGE_READY_TIMEOUT_MS}ms)：${page.url()}`)
  }

  // React 主页面可能在 load 之后继续请求编辑器配置；要求一段持续的网络空闲期。
  await page
    .waitForNetworkIdle({ idleTime: 1_500, timeout: FIELD_TIMEOUT_MS })
    .catch(() => undefined)
}

async function requirePublishFormReady(page: Page): Promise<Frame> {
  const [, editorFrame] = await Promise.all([
    requireEditableTitle(page),
    requireEditorFrame(page),
  ])
  return editorFrame
}

async function requireEditableTitle(page: Page) {
  try {
    await page.waitForSelector(BAIJIAHAO_SELECTORS.title, {
      visible: true,
      timeout: FIELD_TIMEOUT_MS,
    })
  } catch {
    throw new Error(`未找到百家号标题控件：${BAIJIAHAO_SELECTORS.title}`)
  }
}

async function fillInput(page: Page, selector: string, value: string, label: string) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: FIELD_TIMEOUT_MS })
  } catch {
    throw new Error(`未找到${label}：${selector}`)
  }

  await page.click(selector)
  const selectAllModifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.keyboard.down(selectAllModifier)
  await page.keyboard.press('A')
  await page.keyboard.up(selectAllModifier)
  await page.keyboard.press('Backspace')
  await page.keyboard.type(value)
}

async function requireEditorFrame(page: Page): Promise<Frame> {
  const frameElement = await page.waitForSelector(BAIJIAHAO_SELECTORS.editorFrame, {
    visible: true,
    timeout: FIELD_TIMEOUT_MS,
  })
  const frame = await frameElement?.contentFrame()
  if (!frame) {
    throw new Error(`未找到百家号正文 iframe：${BAIJIAHAO_SELECTORS.editorFrame}`)
  }
  await frame.waitForSelector(BAIJIAHAO_SELECTORS.editor, {
    visible: true,
    timeout: FIELD_TIMEOUT_MS,
  })
  try {
    await frame.waitForFunction(
      (selector) => {
        const element = document.querySelector(selector)
        if (!(element instanceof HTMLElement)) return false

        const style = window.getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0 &&
          (element.isContentEditable || document.designMode.toLowerCase() === 'on')
        )
      },
      { timeout: FIELD_TIMEOUT_MS },
      BAIJIAHAO_SELECTORS.editor,
    )
  } catch {
    throw new Error(`百家号正文编辑器未就绪：${BAIJIAHAO_SELECTORS.editor}`)
  }
  return frame
}

async function fillEditor(frame: Frame, content: string) {
  await frame.$eval(
    BAIJIAHAO_SELECTORS.editor,
    (element, value) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error('百家号正文编辑器不可写')
      }

      const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(value)
      if (looksLikeHtml) {
        const template = document.createElement('template')
        template.innerHTML = value
        template.content
          .querySelectorAll('script, iframe, object, embed, form, input, button, link, meta')
          .forEach((node) => node.remove())
        template.content.querySelectorAll('*').forEach((node) => {
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
        element.replaceChildren(template.content.cloneNode(true))
      } else {
        element.replaceChildren(document.createTextNode(value))
      }

      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
      element.dispatchEvent(new Event('blur', { bubbles: true }))
    },
    content,
  )

  const state = await readEditorState(frame)
  if (!state.text && state.imageCount === 0 && content.trim()) {
    throw new Error('百家号正文填充失败：指定编辑器仍为空')
  }
}

async function fillCover(page: Page, cover?: string) {
  if (!cover) return
  const tempDir = createTempDir('baijiahao-cover-')
  try {
    const filePath = await resolveMediaFile(page, cover, tempDir)
    const btns =  await page.locator('text/选择封面');
    if(btns){
      await btns.click();
    }
    await uploadFile(page, BAIJIAHAO_SELECTORS.coverInput, filePath, '百家号封面')
    await sleep(2000);
    await clickRequired(
      page,
      BAIJIAHAO_SELECTORS.coverConfirmButton,
      '百家号封面确认按钮',
    )
    try {
      await page.waitForSelector(BAIJIAHAO_SELECTORS.coverConfirmButton, {
        hidden: true,
        timeout: UPLOAD_TIMEOUT_MS,
      })
      const COVER_WAIT_TIMEOUT = 30_000
      const startTime = Date.now()
      while (Date.now() - startTime < COVER_WAIT_TIMEOUT) {
        const img = await page.$("#bjhNewsCover > div > div > div.cheetah-col.cheetah-form-item-control > div > div > div > div > div.cheetah-spin-nested-loading> div > div > div > img");
        if (img){
          const src = await page.$eval('img', el => el.src);
          if(src && src.length > 0 && src !== ''){
            break;
          }
        }
        await sleep(2000);
      }
      if (Date.now() - startTime >= COVER_WAIT_TIMEOUT) {
        throw new Error('百家号封面图片加载超时（30s），图片未加载完成')
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('加载超时')) {
        throw err
      }
      throw new Error(
        `百家号封面确认后上传面板未关闭：${BAIJIAHAO_SELECTORS.coverConfirmButton}`,
      )
    }
  } finally {
    safeRemoveDir(tempDir)
  }
}

async function submitArticle(
  page: Page,
  editorFrame: Frame,
): Promise<PublishArticleResult> {
  const state = await readEditorState(editorFrame)
  if (!state.text && state.imageCount === 0) {
    throw new Error('百家号发布失败：正文为空')
  }

  const draftClicked = await clickOptional(page, BAIJIAHAO_SELECTORS.draftButton)
  if (draftClicked) {
    await page.waitForSelector(BAIJIAHAO_SELECTORS.draftSuccess, {
      visible: true,
      timeout: FIELD_TIMEOUT_MS,
    })
  }

  const publishResponsePromise = page
    .waitForResponse(
      (response) => {
        try {
          const responseUrl = new URL(response.url())
          return (
            responseUrl.origin === BAIJIAHAO_PUBLISH_API_ORIGIN &&
            responseUrl.pathname === BAIJIAHAO_PUBLISH_API_PATH &&
            responseUrl.searchParams.get('type') === 'news' &&
            responseUrl.searchParams.get('callback') === 'bjhpublish'
          )
        } catch {
          return false
        }
      },
      { timeout: PUBLISH_TIMEOUT_MS },
    )
    .catch(() => null)
  await clickRequired(page, BAIJIAHAO_SELECTORS.publishButton, '百家号发布按钮')
  await clickOptional(page, BAIJIAHAO_SELECTORS.publishConfirmButton)

  const response = await publishResponsePromise
  if (!response) {
    throw new Error(
      `百家号发布结果等待超时：未捕获 ${BAIJIAHAO_PUBLISH_API_ORIGIN}${BAIJIAHAO_PUBLISH_API_PATH} 响应`,
    )
  }
  if (!response.ok()) {
    throw new Error(`百家号发布失败：发布接口返回 HTTP ${response.status()}`)
  }

  let payload: BaijiahaoPublishResponse
  try {
    payload = (await response.json()) as BaijiahaoPublishResponse
  } catch {
    throw new Error('百家号发布失败：发布接口响应不是有效 JSON')
  }

  const platformArticleId = payload.ret?.article_id?.trim() ?? ''
  if (payload.errno !== 0 || !platformArticleId) {
    throw new Error(
      `百家号发布失败：${payload.errmsg?.trim() || `errno=${String(payload.errno)}`}`,
    )
  }
  if (!/^\d+$/.test(platformArticleId)) {
    throw new Error('百家号发布失败：发布接口返回的 article_id 格式无效')
  }

  return {
    platformArticleId,
    publishedUrl: `${BAIJIAHAO_ARTICLE_URL_PREFIX}${platformArticleId}`,
  }
}

async function readEditorState(frame: Frame) {
  return frame.$eval(BAIJIAHAO_SELECTORS.editor, (element) => ({
    text: element instanceof HTMLElement ? element.innerText.trim() : '',
    imageCount: element.querySelectorAll('img').length,
  }))
}

async function uploadFile(page: Page, selector: string, filePath: string, label: string) {
  const input = (await page.waitForSelector(selector, {
    timeout: UPLOAD_TIMEOUT_MS,
  })) as ElementHandle<HTMLInputElement> | null
  if (!input) {
    throw new Error(`未找到${label}上传输入框：${selector}`)
  }
  await input.uploadFile(filePath)
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

async function isVisible(page: Page, selector: string) {
  const element = await page.$(selector)
  if (!element) return false
  return element.isIntersectingViewport().catch(() => false)
}
