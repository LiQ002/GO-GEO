import type { ElementHandle, Page } from 'puppeteer'
import type { PublishArticleInput } from '../types'
import {
  clearEditor,
  createTempDir,
  imageCountInEditor,
  parseContentSegments,
  pasteHtmlIntoEditor,
  resolveMediaFile,
  safeRemoveDir,
  sleep,
} from '../publish-helpers'

const FIELD_TIMEOUT_MS = 20_000
const PAGE_LOAD_TIMEOUT_MS = 60_000
const UPLOAD_TIMEOUT_MS = 30_000
const PUBLISH_TIMEOUT_MS = 45_000
const DRY_RUN_TO_DRAFT = false

/**
 * 企鹅号弹窗容器选择器。
 *
 * 企鹅号 omui 组件库的弹窗不用 [role="dialog"]，而是用 class `.omui-dialog-wrapper.open`
 * 标识可见弹窗。所有依赖弹窗的选择器（上传 input、确认/提交按钮）都基于此容器。
 */
const DIALOG_OPEN = '.omui-dialog-wrapper.open'
const DIALOG_OPEN_XPATH =
  '//*[contains(@class,"omui-dialog-wrapper") and contains(@class,"open")]'

/**
 * 元素可见性检测函数源码字符串，用于注入到 page.evaluate 的浏览器上下文中执行。
 * （page.evaluate 内无法访问 Node 端的函数，必须序列化传入。）
 */
const IS_VISIBLE_FN_SRC = `function isVisible(el) {
  const rect = el.getBoundingClientRect()
  const style = window.getComputedStyle(el)
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  )
}`

/**
 * 企鹅号发文页元素选择器。
 * 所有选择器均来自用户通过 DevTools 抓取的真实 DOM，页面变更时只修改这里。
 */
export const QQNEWS_SELECTORS = {
  title: '.omui-inputautogrowing__inner[contenteditable="true"]',
  editor: '.ProseMirror.ExEditor-basic[contenteditable="true"]',

  // 封面
  coverSection: '#articlePublish-coverinfo',
  coverSingleModeInput: '#articlePublish-coverinfo input[type="radio"][value="1"]',
  coverAddButton: '#articlePublish-coverinfo button.omui-button--add',
  coverChangeButton:
    '::-p-xpath(//*[@id="articlePublish-coverinfo"]//*[normalize-space(.)="更换"])',
  coverUploadFileInput: `${DIALOG_OPEN} .omui-upload-image-trigger input[type="file"]`,
  coverConfirmButton: `::-p-xpath(${DIALOG_OPEN_XPATH}//button[normalize-space(.)="确认"])`,
  coverPreviewImage: '#articlePublish-coverinfo img',

  // 内容自主声明
  selfDeclarationAddButton:
    '::-p-xpath(//button[contains(@class,"omui-button--dashed")][normalize-space(.)="添加内容自主声明"])',
  selfDeclarationOption:
    '::-p-xpath(//label[contains(@class,"omui-radio")][.//span[normalize-space(.)="该文章由AI辅助创作"]]//input[@type="radio"])',
  selfDeclarationConfirmButton: `::-p-xpath(${DIALOG_OPEN_XPATH}//button[normalize-space(.)="确认"])`,

  // AI 生成素材声明
  aiDeclarationTrigger: '::-p-xpath(//a[normalize-space(.)="进行补充>"])',
  aiDeclarationThumb: '#ai_declaration_part_image section.omui-thumb',
  aiDeclarationSubmitButton: `::-p-xpath(${DIALOG_OPEN_XPATH}//button[normalize-space(.)="提交"])`,

  // 正文图片上传（工具栏）
  // 企鹅号编辑器工具栏的"插入图片"是自定义元素 <exeditor-toolbar-button>，
  // 用语义属性 data-toolbar-item-of="imagePlugin" 精准定位，不依赖 class/aria-label。
  inlineImageButton: 'exeditor-toolbar-button[data-toolbar-item-of="imagePlugin"]',
  inlineImageUploadFileInput: `${DIALOG_OPEN} .omui-upload-image-trigger input[type="file"]`,
  inlineImageConfirmButton: `::-p-xpath(${DIALOG_OPEN_XPATH}//button[normalize-space(.)="确认"])`,

  // 提交
  publishButton:
    '::-p-xpath((//button[.//span[normalize-space(.)="发布"]][not(@disabled)])[last()])',
  draftButton: '::-p-xpath((//button[normalize-space(.)="存草稿"])[last()])',

  // 结果
  successText: '::-p-text(发布成功)',
  draftSavedText: '::-p-text(保存成功)',
} as const

export async function publishQqnewsArticle(
  page: Page,
  article: PublishArticleInput,
): Promise<string> {
  console.log('[QqnewsPublisher] start', {
    title: article.title?.slice(0, 30),
    contentLength: article.content?.length ?? 0,
    cover: article.cover?.slice(0, 80),
  })

  await Promise.all([
    page.waitForSelector(QQNEWS_SELECTORS.title, {
      visible: true,
      timeout: PAGE_LOAD_TIMEOUT_MS,
    }),
    page.waitForSelector(QQNEWS_SELECTORS.editor, {
      visible: true,
      timeout: PAGE_LOAD_TIMEOUT_MS,
    }),
  ])

  await fillTitle(page, article.title)
  await sleep(1_000)

  await fillContent(page, article.content)
  await sleep(1_000)

  if (article.cover) {
    await fillCover(page, article.cover)
    await sleep(1_000)
  }

  await fillSelfDeclaration(page)
  await sleep(1_000)

  await ensureAiMaterialDeclaration(page)
  await sleep(1_000)

  return submitArticle(page)
}

// ==================== 标题 ====================

async function fillTitle(page: Page, title: string) {
  if (!title) return
  const titleEl = await page.waitForSelector(QQNEWS_SELECTORS.title, {
    visible: true,
    timeout: FIELD_TIMEOUT_MS,
  })
  if (!titleEl) throw new Error('未找到企鹅号标题输入框')

  await titleEl.click()
  await selectAll(page)
  await page.keyboard.press('Backspace')
  await page.keyboard.type(title, { delay: 20 })
  await sleep(500)
}

// ==================== 正文 ====================

async function fillContent(page: Page, content: string) {
  if (!content) return
  await clearEditor(page, QQNEWS_SELECTORS.editor)

  const segments = parseContentSegments(content)
  const tempDir = createTempDir('qqnews-pub-')
  try {
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      if (segment.type === 'text') {
        await pasteHtmlIntoEditor(page, QQNEWS_SELECTORS.editor, segment.value)
        await sleep(500)
        continue
      }

      const filePath = await resolveMediaFile(page, segment.src, tempDir)
      await uploadInlineImage(page, filePath)
      // 图片插入后，编辑器光标停留在图片所在的居中段落内。
      // 若直接粘贴下一段文字，文字会被放进该居中段落，导致整段文字居中。
      // 这里按 Enter 创建新段落，确保后续文字在独立的左对齐段落中。
      const next = segments[i + 1]
      if (next && next.type === 'text') {
        await page.keyboard.press('Enter')
        await sleep(300)
      }
    }
  } finally {
    safeRemoveDir(tempDir)
  }

  // 清理编辑器中图片段落里 text-align:center 对后续文字的影响：
  // 企鹅号编辑器插入图片时会给图片段落加 <p style="text-align: center">，
  // 如果图片后面紧跟文字（未按 Enter 分离），文字会继承居中样式。
  // 这里把居中段落里的文字节点移到新的左对齐段落中。
  await splitCenteredParagraphs(page)

  const contentState = await page.$eval(QQNEWS_SELECTORS.editor, (element) => ({
    text: element instanceof HTMLElement ? element.innerText.trim() : '',
    imageCount: element.querySelectorAll('img').length,
  }))
  if (!contentState.text && contentState.imageCount === 0) {
    throw new Error('企鹅号正文填充失败：编辑器仍为空')
  }
}

/**
 * 拆分编辑器中图片所在的居中段落（<p style="text-align: center">）。
 *
 * 企鹅号编辑器插入图片后会生成 <p style="text-align: center">图片+文字</p>，
 * 导致图片后的文字也居中。本函数把居中段落里图片之后的文字节点移到新的左对齐段落。
 */
async function splitCenteredParagraphs(page: Page) {
  await page.evaluate((editorSelector) => {
    const editor = document.querySelector(editorSelector)
    if (!(editor instanceof HTMLElement)) return

    // 找到所有居中段落
    const centeredParas = Array.from(
      editor.querySelectorAll('p[style*="text-align: center"], p[style*="text-align:center"]'),
    )

    for (const para of centeredParas) {
      // 找到图片容器（span.index_module_content__... 或包含 img 的 span）
      const imageSpan = para.querySelector('span[contenteditable="false"]')
      if (!imageSpan) continue

      // 收集图片 span 之后的所有文本节点和元素节点
      const afterImage: Node[] = []
      let foundImage = false
      for (const child of Array.from(para.childNodes)) {
        if (foundImage) {
          afterImage.push(child)
        }
        if (child === imageSpan || (child instanceof Element && child.contains(imageSpan))) {
          foundImage = true
        }
      }

      // 如果图片后面有文字内容，移到新段落
      const textContent = afterImage
        .map((n) => (n.textContent || '').trim())
        .join('')
        .trim()
      if (textContent) {
        const newPara = document.createElement('p')
        for (const node of afterImage) {
          newPara.appendChild(node.cloneNode(true))
        }
        para.after(newPara)
        // 从原居中段落移除这些节点
        for (const node of afterImage) {
          para.removeChild(node)
        }
      }
    }

    // 触发 input 事件让 ProseMirror 同步状态
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
  }, QQNEWS_SELECTORS.editor)
  await sleep(500)
}

async function uploadInlineImage(page: Page, filePath: string) {
  const before = await imageCountInEditor(page, QQNEWS_SELECTORS.editor)

  // 工具栏"插入图片"是自定义元素 <exeditor-toolbar-button data-toolbar-item-of="imagePlugin">，
  // 精准定位后直接点击，点击后等待上传弹窗 .omui-dialog-wrapper.open 弹出。
  await clickRequired(page, QQNEWS_SELECTORS.inlineImageButton, '企鹅号正文图片工具栏按钮')
  await page.waitForSelector(DIALOG_OPEN, { visible: true, timeout: FIELD_TIMEOUT_MS })

  await clickOptional(page, '::-p-text(本地上传)')
  await uploadFile(page, QQNEWS_SELECTORS.inlineImageUploadFileInput, filePath, '企鹅号正文图片')
  // 等待图片上传完成：确认按钮从 is--disabled 变为可点击。
  // 企鹅号上传弹窗在图片上传中会禁用确认按钮，上传完成后才启用。
  await waitForUploadComplete(page)
  await clickRequired(page, QQNEWS_SELECTORS.inlineImageConfirmButton, '企鹅号正文图片确认按钮')

  await waitForImageCount(page, before)
}

// ==================== 封面 ====================

async function fillCover(page: Page, coverUrl: string) {
  const tempDir = createTempDir('qqnews-cover-')
  try {
    const filePath = await resolveMediaFile(page, coverUrl, tempDir)

    await page.waitForSelector(QQNEWS_SELECTORS.coverSection, {
      visible: true,
      timeout: FIELD_TIMEOUT_MS,
    })
    await page.evaluate((sel) => {
      document.querySelector(sel)?.scrollIntoView({ block: 'center' })
    }, QQNEWS_SELECTORS.coverSection)
    await sleep(1_000)

    // 确保单图模式
    await page.evaluate((sel) => {
      const input = document.querySelector(sel) as HTMLInputElement | null
      if (input && !input.checked) input.click()
    }, QQNEWS_SELECTORS.coverSingleModeInput)
    await sleep(500)

    const hasExistingCover = await page.evaluate((sel) => {
      const section = document.querySelector(sel)
      return section ? section.querySelectorAll('img').length > 0 : false
    }, QQNEWS_SELECTORS.coverSection)

    if (hasExistingCover) {
      console.log('[QqnewsPublisher] 封面已存在，点击「更换」')
      await clickRequired(page, QQNEWS_SELECTORS.coverChangeButton, '企鹅号封面更换按钮')
    } else {
      await clickRequired(page, QQNEWS_SELECTORS.coverAddButton, '企鹅号封面上传按钮')
    }

    // 等待封面弹窗打开
    await page.waitForSelector(DIALOG_OPEN, { visible: true, timeout: FIELD_TIMEOUT_MS })
    await sleep(1_000)

    // 封面弹窗默认在"文内图片"tab，需切换到"本地上传"tab 才能上传文件
    await clickOptional(page, '::-p-text(本地上传)')
    await sleep(800)

    await uploadFile(page, QQNEWS_SELECTORS.coverUploadFileInput, filePath, '企鹅号封面')
    // 等待封面上传完成（确认按钮解除禁用）
    await waitForUploadComplete(page)
    await clickRequired(page, QQNEWS_SELECTORS.coverConfirmButton, '企鹅号封面确认按钮')

    await page.waitForSelector(QQNEWS_SELECTORS.coverPreviewImage, {
      visible: true,
      timeout: UPLOAD_TIMEOUT_MS,
    })
  } finally {
    safeRemoveDir(tempDir)
  }
}

// ==================== 内容自主声明 ====================

async function fillSelfDeclaration(page: Page) {
  const alreadyAdded = await page.evaluate((isVisibleSrc) => {
    const isVisible = new Function('return ' + isVisibleSrc)()
    return Array.from(document.querySelectorAll('button, div, span, p')).some(
      (el) =>
        isVisible(el) &&
        /(已添加|编辑|修改)内容自主声明|内容自主声明已|作者声明/.test(el.textContent?.trim() || ''),
    )
  }, IS_VISIBLE_FN_SRC)
  if (alreadyAdded) {
    console.log('[QqnewsPublisher] 内容自主声明已存在，跳过')
    return
  }

  const clicked = await clickOptional(page, QQNEWS_SELECTORS.selfDeclarationAddButton)
  if (!clicked) {
    console.log('[QqnewsPublisher] 未找到内容自主声明入口，跳过')
    return
  }

  console.log('[QqnewsPublisher] 已打开内容自主声明，选择「AI辅助创作」')
  await sleep(1_000)

  await clickRequired(page, QQNEWS_SELECTORS.selfDeclarationOption, '内容自主声明选项')
  await sleep(500)

  await clickRequired(
    page,
    QQNEWS_SELECTORS.selfDeclarationConfirmButton,
    '内容自主声明确认按钮',
  )
  await sleep(1_000)
}

// ==================== AI 生成素材声明 ====================

async function ensureAiMaterialDeclaration(page: Page) {
  const needsDeclaration = await page.evaluate((isVisibleSrc) => {
    const isVisible = new Function('return ' + isVisibleSrc)()
    return Array.from(document.querySelectorAll('a, button, span, div, p')).some(
      (el) =>
        isVisible(el) &&
        /未进行AI生成声明素材|AI生成素材声明|请进行补充|进行补充/.test(el.textContent?.trim() || ''),
    )
  }, IS_VISIBLE_FN_SRC)
  if (!needsDeclaration) {
    console.log('[QqnewsPublisher] 无需 AI 生成素材声明补充')
    return
  }

  console.log('[QqnewsPublisher] 检测到需要补充 AI 生成素材声明')
  await clickRequired(page, QQNEWS_SELECTORS.aiDeclarationTrigger, 'AI 生成素材声明补充入口')
  await sleep(2_000)

  const selectResult = await page.evaluate((thumbSelector, isVisibleSrc) => {
    const isVisible = new Function('return ' + isVisibleSrc)()
    const thumbs = Array.from(document.querySelectorAll(thumbSelector)).filter(
      isVisible,
    ) as HTMLElement[]
    if (thumbs.length === 0) return { ok: false }

    let clickedCount = 0
    for (const thumb of thumbs) {
      if (!thumb.classList.contains('is--selected')) {
        thumb.click()
        clickedCount++
      }
    }
    return { ok: true, total: thumbs.length, clicked: clickedCount }
  }, QQNEWS_SELECTORS.aiDeclarationThumb, IS_VISIBLE_FN_SRC)

  if (!selectResult.ok) throw new Error('AI 生成素材声明弹窗中未找到图片素材缩略图')
  console.log(
    `[QqnewsPublisher] AI 生成素材声明：共 ${selectResult.total} 张图片，新勾选 ${selectResult.clicked} 张`,
  )
  await sleep(800)

  await clickRequired(
    page,
    QQNEWS_SELECTORS.aiDeclarationSubmitButton,
    'AI 生成素材声明提交按钮',
  )
  console.log('[QqnewsPublisher] 已完成 AI 生成素材声明')
  await sleep(1_500)
}

// ==================== 提交 ====================

async function submitArticle(page: Page): Promise<string> {
  const beforeUrl = page.url()

  const submitSelector = DRY_RUN_TO_DRAFT
    ? QQNEWS_SELECTORS.draftButton
    : QQNEWS_SELECTORS.publishButton
  const label = DRY_RUN_TO_DRAFT ? '企鹅号存草稿按钮' : '企鹅号发布按钮'
  await clickRequired(page, submitSelector, label)

  await waitForPublishResult(page, beforeUrl, DRY_RUN_TO_DRAFT)
  return page.url()
}

// ==================== 通用工具函数 ====================

async function uploadFile(
  page: Page,
  selector: string,
  filePath: string,
  label: string,
): Promise<void> {
  const input = (await page.waitForSelector(selector, {
    timeout: UPLOAD_TIMEOUT_MS,
  })) as ElementHandle<HTMLInputElement> | null
  if (!input) throw new Error(`未找到${label}上传输入框：${selector}`)
  await input.uploadFile(filePath)
  await sleep(1_000)
}

async function clickRequired(page: Page, selector: string, label: string): Promise<void> {
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

async function waitForImageCount(page: Page, before: number) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < UPLOAD_TIMEOUT_MS) {
    if ((await imageCountInEditor(page, QQNEWS_SELECTORS.editor)) > before) return
    await sleep(300)
  }
  throw new Error(`企鹅号正文图片上传超时 (${UPLOAD_TIMEOUT_MS}ms)`)
}

/**
 * 等待企鹅号图片上传弹窗中的上传完成。
 *
 * 上传中时：
 *   - 图片项 class 为 `omui-upload-image-item__uploading`
 *   - 确认按钮 class 含 `is--disabled`
 *
 * 上传完成后：
 *   - 图片项 class 变为 `omui-upload-image-item`（不含 __uploading）
 *   - 确认按钮移除 `is--disabled`
 */
async function waitForUploadComplete(page: Page) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < UPLOAD_TIMEOUT_MS) {
    const done = await page.evaluate(() => {
      const dialog = document.querySelector('.omui-dialog-wrapper.open')
      if (!dialog) return false
      // 上传中项
      const uploading = dialog.querySelectorAll('.omui-upload-image-item__uploading').length
      // 确认按钮是否禁用
      const confirmBtn = Array.from(dialog.querySelectorAll('button')).find(
        (b) => (b.textContent || '').trim() === '确认',
      )
      const confirmDisabled = confirmBtn?.classList.contains('is--disabled') ?? false
      return uploading === 0 && !confirmDisabled
    })
    if (done) return
    await sleep(500)
  }
  throw new Error(`企鹅号图片上传等待完成超时 (${UPLOAD_TIMEOUT_MS}ms)`)
}

async function waitForPublishResult(
  page: Page,
  beforeUrl: string,
  isDraft: boolean,
): Promise<void> {
  const startedAt = Date.now()
  const successSelector = isDraft ? QQNEWS_SELECTORS.draftSavedText : QQNEWS_SELECTORS.successText

  while (Date.now() - startedAt < PUBLISH_TIMEOUT_MS) {
    if (page.url() !== beforeUrl) return
    if (await isVisible(page, successSelector)) return
    await sleep(500)
  }

  throw new Error(
    `企鹅号${isDraft ? '保存草稿' : '发布'}等待超时 (${PUBLISH_TIMEOUT_MS}ms): ${page.url()}`,
  )
}

async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: 500 })
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
