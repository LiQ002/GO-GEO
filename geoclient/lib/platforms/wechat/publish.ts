import type { Page } from 'puppeteer'
import type { PublishArticleInput } from '../types'

export const WECHAT_SELECTORS = {
  title: '#js_title_main > div > div > div > div',
  author: '#author',
  digest: '#digest',
  editorFrame: 'iframe#ueditor_0',
  editor: 'body',
  coverInput: 'input[type="file"][accept="image/*"]',
  draftButton: '::-p-xpath(//button[normalize-space(.)="保存为草稿"])',
  saveSuccess: '::-p-text(保存成功)',
} as const

type EditorRoot = {
  waitForSelector: (
    selector: string,
    options: { visible: boolean; timeout: number },
  ) => Promise<unknown>
  $eval: (
    selector: string,
    pageFunction: (element: Element, value: string) => void,
    value: string,
  ) => Promise<unknown>
}

/**
 * 微信公众号图文自动填充示例。
 *
 * 该驱动只使用 WECHAT_SELECTORS 中为每个步骤指定的唯一选择器。
 */
export async function publishWechatArticle(page: Page, article: PublishArticleInput) {
  await page.waitForFunction(() => /appmsg_edit|appmsg/.test(window.location.href), {
    timeout: 30_000,
  })

  await page.waitForSelector(WECHAT_SELECTORS.title, { visible: true, timeout: 15_000 })
  await fillInput(page, WECHAT_SELECTORS.title, article.title)

  if (article.author && (await isSelectorVisible(page, WECHAT_SELECTORS.author))) {
    await fillInput(page, WECHAT_SELECTORS.author, article.author)
  }

  if (article.summary && (await isSelectorVisible(page, WECHAT_SELECTORS.digest))) {
    await fillInput(page, WECHAT_SELECTORS.digest, article.summary)
  }

  await fillWechatEditorContent(page, article.content)

  if (article.cover) {
    await uploadWechatCover(page, article.cover)
  }

  const draftButton = await page.$(WECHAT_SELECTORS.draftButton)
  if (!draftButton) {
    throw new Error('未找到安全的“保存草稿”按钮；为避免误触群发，已停止自动操作')
  }
  await draftButton.click()

  await page.waitForSelector(WECHAT_SELECTORS.saveSuccess, { visible: true, timeout: 20_000 })
}

async function fillInput(page: Page, selector: string, value: string) {
  await page.waitForSelector(selector, { visible: true, timeout: 15_000 })
  await page.click(selector)
  const selectAllModifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.keyboard.down(selectAllModifier)
  await page.keyboard.press('A')
  await page.keyboard.up(selectAllModifier)
  await page.keyboard.press('Backspace')
  await page.keyboard.type(value)
}

async function isSelectorVisible(page: Page, selector: string) {
  const element = await page.$(selector)
  if (!element) return false
  return element.isIntersectingViewport().catch(() => false)
}

async function findWechatEditor(page: Page): Promise<{ root: EditorRoot; selector: string }> {
  const frameHandle = await page.$(WECHAT_SELECTORS.editorFrame)
  const frame = await frameHandle?.contentFrame()
  if (!frame) {
    throw new Error('未找到微信公众号正文编辑器')
  }

  return { root: frame as unknown as EditorRoot, selector: WECHAT_SELECTORS.editor }
}

async function fillWechatEditorContent(page: Page, content: string) {
  const { root, selector } = await findWechatEditor(page)
  await root.waitForSelector(selector, { visible: true, timeout: 15_000 })

  await root.$eval(
    selector,
    (element, value) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error('正文编辑器不可写')
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
            if ((name === 'href' || name === 'src') && attributeValue.startsWith('javascript:')) {
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
}

async function uploadWechatCover(page: Page, coverPath: string) {
  const input = await page.$(WECHAT_SELECTORS.coverInput)
  if (!input) {
    throw new Error('未找到微信公众号封面上传入口')
  }
  await input.uploadFile(coverPath)
  await new Promise((resolve) => setTimeout(resolve, 1500))
}
