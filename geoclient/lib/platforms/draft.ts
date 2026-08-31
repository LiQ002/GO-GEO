import type { Page } from 'puppeteer'
import type { PublishArticleInput } from './types'

const FIELD_TIMEOUT_MS = 20_000
const SAVE_TIMEOUT_MS = 60_000
const UNSAFE_ACTION_PATTERN = /发布|群发|发送|提交|下一步/

export type PrepareAction = {
  selector: string
  required?: boolean
}

export type DraftSaveStrategy =
  | {
      mode: 'button'
      selector: string
      successSelector: string
    }
  | {
      mode: 'autosave'
      successSelector: string
    }
  | {
      mode: 'fill-only'
    }

export type SafeDraftPublisherConfig = {
  platformLabel: string
  titleSelector: string
  contentSelector: string
  authorSelector?: string
  summarySelector?: string
  prepareActions?: readonly PrepareAction[]
  save: DraftSaveStrategy
}

export function articleContentToPlainText(content: string): string {
  return content
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<li(?:\s[^>]*)?>/gi, '• ')
    .replace(/<\/(?:p|div|section|article|h[1-6]|li|ol|ul)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function assertConfigured(config: SafeDraftPublisherConfig) {
  if (!config.titleSelector.trim()) {
    throw new Error(`${config.platformLabel} 未配置标题选择器`)
  }
  if (!config.contentSelector.trim()) {
    throw new Error(`${config.platformLabel} 未配置正文选择器`)
  }
  if (config.save.mode === 'button' && !config.save.selector.trim()) {
    throw new Error(`${config.platformLabel} 未配置草稿按钮选择器`)
  }
  if (config.save.mode !== 'fill-only' && !config.save.successSelector.trim()) {
    throw new Error(`${config.platformLabel} 未配置草稿保存成功选择器`)
  }

  const actionSelectors = (config.prepareActions ?? []).map((action) => action.selector)
  if (config.save.mode === 'button') actionSelectors.push(config.save.selector)
  const unsafeSelector = actionSelectors.find((selector) => UNSAFE_ACTION_PATTERN.test(selector))
  if (unsafeSelector) {
    throw new Error(`${config.platformLabel} 自动化选择器指向不安全动作：${unsafeSelector}`)
  }
}

async function findVisibleSelector(
  page: Page,
  selector: string,
  fieldLabel: string,
  required = true,
): Promise<string | null> {
  if (!selector.trim()) {
    if (required) throw new Error(`未配置${fieldLabel}选择器`)
    return null
  }

  if (required) {
    try {
      await page.waitForSelector(selector, { visible: true, timeout: FIELD_TIMEOUT_MS })
      return selector
    } catch {
      throw new Error(`未找到${fieldLabel}：${selector}`)
    }
  }

  const element = await page.$(selector)
  if (!element) return null
  const visible = await element.isIntersectingViewport().catch(() => false)
  return visible ? selector : null
}

async function typeIntoField(
  page: Page,
  selector: string,
  value: string,
  fieldLabel: string,
  required = true,
) {
  const visibleSelector = await findVisibleSelector(page, selector, fieldLabel, required)
  if (!visibleSelector) return false

  await page.click(visibleSelector)
  const selectAllModifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.keyboard.down(selectAllModifier)
  await page.keyboard.press('A')
  await page.keyboard.up(selectAllModifier)
  await page.keyboard.press('Backspace')
  await page.keyboard.type(value)

  const injected = await page.evaluate(
    (configuredSelector, text) => {
      const element = document.querySelector(configuredSelector)
      if (!(element instanceof HTMLElement) || !element.isContentEditable) return false
      const current = (element.innerText || element.textContent || '').trim()
      if (current.length > 0) return false
      element.innerText = text
      element.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
      )
      element.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    },
    visibleSelector,
    value,
  )

  if (injected) {
    console.log(`[draft] ${fieldLabel} 键盘输入未生效，已向指定元素注入文本`)
  }
  return true
}

async function clickConfiguredAction(page: Page, action: PrepareAction) {
  const selector = await findVisibleSelector(
    page,
    action.selector,
    '操作按钮',
    action.required === true,
  )
  if (!selector) return false
  await page.click(selector)
  return true
}

async function runPrepareActions(page: Page, config: SafeDraftPublisherConfig) {
  for (const action of config.prepareActions ?? []) {
    const clicked = await clickConfiguredAction(page, action)
    if (!clicked && action.required) {
      throw new Error(`${config.platformLabel} 未找到入口：${action.selector}`)
    }
    if (clicked) {
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 5_000 }).catch(() => {})
    }
  }
}

async function waitForSaved(page: Page, selector: string, context = '保存') {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: SAVE_TIMEOUT_MS })
  } catch {
    throw new Error(
      `${context} 等待成功选择器超时 (${SAVE_TIMEOUT_MS}ms): ${selector} @ ${page.url()}`,
    )
  }
}

export function createSafeDraftPublisher(config: SafeDraftPublisherConfig) {
  assertConfigured(config)

  return async (page: Page, article: PublishArticleInput): Promise<void> => {
    await runPrepareActions(page, config)
    await typeIntoField(page, config.titleSelector, article.title, `${config.platformLabel}标题`)

    if (article.author && config.authorSelector) {
      await typeIntoField(
        page,
        config.authorSelector,
        article.author,
        `${config.platformLabel}作者`,
        false,
      )
    }
    if (article.summary && config.summarySelector) {
      await typeIntoField(
        page,
        config.summarySelector,
        article.summary,
        `${config.platformLabel}摘要`,
        false,
      )
    }

    await typeIntoField(
      page,
      config.contentSelector,
      articleContentToPlainText(article.content),
      `${config.platformLabel}正文编辑器`,
    )

    if (config.save.mode === 'fill-only') return
    if (config.save.mode === 'autosave') {
      await waitForSaved(page, config.save.successSelector)
      return
    }

    await clickConfiguredAction(page, { selector: config.save.selector, required: true })
    await waitForSaved(page, config.save.successSelector)
  }
}
