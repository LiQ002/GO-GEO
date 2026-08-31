import type { Page } from 'puppeteer'
import { describe, expect, it, vi } from 'vitest'
import { articleContentToPlainText, createSafeDraftPublisher } from './draft'

const visibleElement = {
  evaluate: vi.fn().mockResolvedValue(true),
  isIntersectingViewport: vi.fn().mockResolvedValue(true),
}

function createPage() {
  const click = vi.fn().mockResolvedValue(undefined)
  const type = vi.fn().mockResolvedValue(undefined)
  const evaluate = vi.fn().mockResolvedValue(true)
  const page = {
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(visibleElement),
    waitForNetworkIdle: vi.fn().mockResolvedValue(undefined),
    $: vi.fn().mockResolvedValue(visibleElement),
    click,
    keyboard: {
      down: vi.fn().mockResolvedValue(undefined),
      press: vi.fn().mockResolvedValue(undefined),
      up: vi.fn().mockResolvedValue(undefined),
      type,
    },
    evaluate,
  } as unknown as Page
  return { page, click, type, evaluate }
}

describe('safe media draft publisher', () => {
  it('types article fields and clicks only the configured draft action', async () => {
    const { page, click, type } = createPage()
    const publish = createSafeDraftPublisher({
      platformLabel: '示例平台',
      titleSelector: '#title',
      summarySelector: '#summary',
      contentSelector: '#editor',
      save: {
        mode: 'button',
        selector: '#save-draft',
        successSelector: '#save-success',
      },
    })

    await publish(page, {
      title: '示例标题',
      summary: '示例摘要',
      content: '<h2>第一节</h2><p>示例<strong>正文</strong></p>',
    })

    expect(click).toHaveBeenNthCalledWith(1, '#title')
    expect(click).toHaveBeenNthCalledWith(2, '#summary')
    expect(click).toHaveBeenNthCalledWith(3, '#editor')
    expect(type).toHaveBeenNthCalledWith(1, '示例标题')
    expect(type).toHaveBeenNthCalledWith(2, '示例摘要')
    expect(type).toHaveBeenNthCalledWith(3, '第一节\n示例正文')
    expect(click).toHaveBeenNthCalledWith(4, '#save-draft')
  })

  it('rejects missing selectors at configuration time', () => {
    expect(() =>
      createSafeDraftPublisher({
        platformLabel: '未配置平台',
        titleSelector: '',
        contentSelector: '#editor',
        save: {
          mode: 'button',
          selector: '#save-draft',
          successSelector: '#save-success',
        },
      }),
    ).toThrow('未配置标题选择器')
  })

  it('rejects selectors that explicitly target publish actions', () => {
    expect(() =>
      createSafeDraftPublisher({
        platformLabel: '危险平台',
        titleSelector: '#title',
        contentSelector: '#editor',
        save: {
          mode: 'button',
          selector: '::-p-text(发布文章)',
          successSelector: '#save-success',
        },
      }),
    ).toThrow('不安全动作')
  })

  it('converts common article HTML into readable plain text', () => {
    expect(articleContentToPlainText('<h2>标题</h2><ul><li>A</li><li>B</li></ul>')).toBe(
      '标题\n• A\n• B',
    )
  })
})
