import type { Page } from 'puppeteer'
import { describe, expect, it, vi } from 'vitest'
import type { PublishArticleInput } from '../types'
import { publishWechatArticle, WECHAT_SELECTORS } from './publish'

const article: PublishArticleInput = {
  title: '示例标题',
  author: '示例作者',
  summary: '示例摘要',
  content: '<p>示例正文</p>',
}

function createWechatEditorPage(draftButtonFound = true) {
  const editorEval = vi.fn().mockResolvedValue(undefined)
  const clickInput = vi.fn().mockResolvedValue(undefined)
  const keyDown = vi.fn().mockResolvedValue(undefined)
  const pressKey = vi.fn().mockResolvedValue(undefined)
  const keyUp = vi.fn().mockResolvedValue(undefined)
  const typeText = vi.fn().mockResolvedValue(undefined)
  const frame = {
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    $eval: editorEval,
  }
  const visibleInput = {
    isIntersectingViewport: vi.fn().mockResolvedValue(true),
  }
  const frameHandle = {
    contentFrame: vi.fn().mockResolvedValue(frame),
  }
  const draftButton = draftButtonFound
    ? { click: vi.fn().mockResolvedValue(undefined) }
    : null
  const findElement = vi.fn(async (selector: string) => {
    if (selector === WECHAT_SELECTORS.editorFrame) return frameHandle
    if (selector === WECHAT_SELECTORS.draftButton) return draftButton
    if (selector === WECHAT_SELECTORS.author || selector === WECHAT_SELECTORS.digest) {
      return visibleInput
    }
    return null
  })
  const page = {
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    click: clickInput,
    keyboard: {
      down: keyDown,
      press: pressKey,
      up: keyUp,
      type: typeText,
    },
    $: findElement,
  } as unknown as Page

  return { page, clickInput, keyDown, pressKey, keyUp, typeText, editorEval, draftButton }
}

describe('WeChat article publisher', () => {
  it('fills the article and saves it through the iframe editor', async () => {
    const {
      page,
      clickInput,
      keyDown,
      pressKey,
      keyUp,
      typeText,
      editorEval,
      draftButton,
    } = createWechatEditorPage()

    await publishWechatArticle(page, article)

    expect(clickInput).toHaveBeenNthCalledWith(1, WECHAT_SELECTORS.title)
    expect(clickInput).toHaveBeenNthCalledWith(2, WECHAT_SELECTORS.author)
    expect(clickInput).toHaveBeenNthCalledWith(3, WECHAT_SELECTORS.digest)
    expect(keyDown).toHaveBeenCalledTimes(3)
    expect(keyDown).toHaveBeenCalledWith(process.platform === 'darwin' ? 'Meta' : 'Control')
    expect(pressKey).toHaveBeenCalledTimes(6)
    expect(pressKey).toHaveBeenCalledWith('A')
    expect(pressKey).toHaveBeenCalledWith('Backspace')
    expect(keyUp).toHaveBeenCalledTimes(3)
    expect(keyUp).toHaveBeenCalledWith(process.platform === 'darwin' ? 'Meta' : 'Control')
    expect(typeText).toHaveBeenNthCalledWith(1, article.title)
    expect(typeText).toHaveBeenNthCalledWith(2, article.author)
    expect(typeText).toHaveBeenNthCalledWith(3, article.summary)
    expect(editorEval).toHaveBeenCalledWith(WECHAT_SELECTORS.editor, expect.any(Function), article.content)
    expect(draftButton?.click).toHaveBeenCalledOnce()
  })

  it('stops instead of clicking an unknown primary action', async () => {
    const { page } = createWechatEditorPage(false)
    await expect(publishWechatArticle(page, article)).rejects.toThrow('避免误触群发')
  })
})
