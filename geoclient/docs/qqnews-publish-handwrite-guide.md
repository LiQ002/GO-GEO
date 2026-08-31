# 企鹅号发文逻辑手写指南

> 本文档面向"从零开始手写企鹅号发文逻辑"的开发者，按从 0 到 1 的顺序讲解每一步该怎么想、怎么写、为什么这么写。
>
> 配套文件：
> - 实现代码：[geoclient/lib/platforms/qqnews/publish.ts](../lib/platforms/qqnews/publish.ts)
> - 代码逐行详解：[qqnews-publish-logic.md](./qqnews-publish-logic.md)
> - 公共工具函数：[geoclient/lib/platforms/publish-helpers.ts](../lib/platforms/publish-helpers.ts)

---

## 第 0 步：建立心智模型

企鹅号发文页的本质是一个网页表单，你要做的是用 Puppeteer 模拟人工操作：**找到元素 → 操作元素 → 等待反馈 → 进入下一步**。

核心套路：

```
定位选择器 → 点击/输入/上传 → 等待状态变化 → 验证操作生效
```

每一步都要遵守"**精准定位 + 等待反馈 + 验证结果**"三件套，缺一不可。

---

## 第 1 步：准备工作 —— 打开 DevTools 抓真实 DOM

**这是最重要的一步，决定你后面所有选择器的质量。**

1. 登录企鹅号后台 https://om.qq.com，进入文章发布页
2. F12 打开 DevTools，用元素选择器点击页面上的每个目标元素（标题框、正文框、封面按钮、上传弹窗、确认按钮、发布按钮…）
3. 记录每个元素的**真实 HTML 结构**，重点看：
   - 是否有 `id`（最稳）
   - 是否有语义化属性（如 `data-toolbar-item-of="imagePlugin"`，比 class 稳）
   - class 是否是组件库前缀（如 `omui-xxx`，相对稳定）
   - 是否是自定义元素（如 `<exeditor-toolbar-button>`）

### 选择器抓取原则

- ✅ 优先用 `id`、语义属性、自定义元素标签名
- ✅ class 只用组件库前缀（`omui-`），不用业务 class（如 `index_module_xxx__yyy`）
- ❌ 不要盲猜 `.btn[aria-label="插入图片"]` 这种，企鹅号根本不用这套
- ❌ 不要用 `nth-child(n)` 这种位置定位，页面一改就崩

---

## 第 2 步：搭代码骨架

按现有架构，一个平台发文文件的结构是固定的：

```typescript
// 1. 导入
import type { ElementHandle, Page } from 'puppeteer'
import type { PublishArticleInput } from '../types'
import { clearEditor, createTempDir, ... } from '../publish-helpers'

// 2. 常量定义区
const FIELD_TIMEOUT_MS = 20_000
const PAGE_LOAD_TIMEOUT_MS = 60_000
// ...

// 3. 平台特有约定（如 omui 弹窗容器）
const DIALOG_OPEN = '.omui-dialog-wrapper.open'

// 4. 选择器常量对象
export const QQNEWS_SELECTORS = { ... } as const

// 5. 主流程入口函数
export async function publishQqnewsArticle(page, article) { ... }

// 6. 各模块函数（按主流程顺序）
async function fillTitle(page, title) { ... }
async function fillContent(page, content) { ... }
async function fillCover(page, coverUrl) { ... }
async function fillSelfDeclaration(page) { ... }
async function ensureAiMaterialDeclaration(page) { ... }
async function submitArticle(page) { ... }

// 7. 通用工具函数（本平台内部复用）
async function clickRequired(page, selector, label) { ... }
async function clickOptional(page, selector) { ... }
async function uploadFile(page, selector, filePath, label) { ... }
async function waitForUploadComplete(page) { ... }
```

### 为什么这样拆？

- **选择器集中** → 页面改版只改一个地方
- **模块化函数** → 单个步骤可独立调试
- **主流程函数只编排顺序** → 读主流程就知道做了什么
- **工具函数下沉** → 复用且统一错误处理

---

## 第 3 步：编写选择器常量对象

把第 1 步抓到的真实 DOM 翻译成选择器：

```typescript
export const QQNEWS_SELECTORS = {
  // 标题：抓到的是 <div class="omui-inputautogrowing__inner" contenteditable="true">
  title: '.omui-inputautogrowing__inner[contenteditable="true"]',

  // 正文：抓到的是 <div class="ProseMirror ExEditor-basic" contenteditable="true">
  editor: '.ProseMirror.ExEditor-basic[contenteditable="true"]',

  // 封面区：有 id，最稳
  coverSection: '#articlePublish-coverinfo',

  // 正文图片按钮：抓到的是 <exeditor-toolbar-button data-toolbar-item-of="imagePlugin">
  // 用语义属性，不用 class/aria-label
  inlineImageButton: 'exeditor-toolbar-button[data-toolbar-item-of="imagePlugin"]',

  // ...
} as const
```

### 选择器类型选择顺序

1. **CSS 选择器**（`#id`、`.class`、`tag[attr=value]`）—— 简单稳定时首选
2. **XPath**（`::-p-xpath(...)`）—— 需要按文本内容定位时用，如"确认"按钮
3. **文本匹配**（`::-p-text(...)`）—— 只用于 tab 切换等临时场景，不稳

### 企鹅号 omui 弹窗的特殊约定

- 弹窗容器是 `.omui-dialog-wrapper.open`（**不是** `[role="dialog"]`）
- 弹窗内的确认按钮用 XPath 按文本"确认"定位
- 文件上传 input 永远是 `.omui-upload-image-trigger input[type="file"]`

---

## 第 4 步：写主流程函数

主流程只负责编排，不写具体操作细节：

```typescript
export async function publishQqnewsArticle(page, article) {
  // 1. 等待页面加载完成（标题框和正文框都出现）
  await Promise.all([
    page.waitForSelector(QQNEWS_SELECTORS.title, { visible: true, timeout: PAGE_LOAD_TIMEOUT_MS }),
    page.waitForSelector(QQNEWS_SELECTORS.editor, { visible: true, timeout: PAGE_LOAD_TIMEOUT_MS }),
  ])

  // 2. 按顺序填充各字段
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

  // 3. 提交
  return submitArticle(page)
}
```

### 为什么每步之间 `sleep(1_000)`？

企鹅号页面状态切换需要时间（弹窗动画、ProseMirror 同步、网络请求），不睡会概率性失败。

---

## 第 5 步：逐个写模块函数

### 5.1 标题填充 —— 最简单，先写它练手

```typescript
async function fillTitle(page, title) {
  if (!title) return
  const titleEl = await page.waitForSelector(QQNEWS_SELECTORS.title, {
    visible: true,
    timeout: FIELD_TIMEOUT_MS,
  })
  if (!titleEl) throw new Error('未找到企鹅号标题输入框')

  await titleEl.click()
  await selectAll(page)                       // 全选清空原有内容
  await page.keyboard.press('Backspace')
  await page.keyboard.type(title, { delay: 20 })  // delay 模拟人工输入
  await sleep(500)
}
```

**为什么用 `keyboard.type` 而不是粘贴？** 标题框是 `contenteditable`，直接粘贴有时不触发 input 事件，type 最稳。

### 5.2 正文填充 —— 最复杂，分段处理

企鹅号编辑器是 ProseMirror，不能直接 `innerHTML`，必须模拟粘贴。

```typescript
async function fillContent(page, content) {
  if (!content) return
  await clearEditor(page, QQNEWS_SELECTORS.editor)  // 复用公共工具清空

  // 把 HTML 内容拆成"文本段"和"图片段"，交替处理
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
      // 图片段：下载到临时目录，再走工具栏上传
      const filePath = await resolveMediaFile(page, segment.src, tempDir)
      await uploadInlineImage(page, filePath)

      // 关键：图片插入后按 Enter，否则下段文字会进居中段落
      const next = segments[i + 1]
      if (next && next.type === 'text') {
        await page.keyboard.press('Enter')
        await sleep(300)
      }
    }
  } finally {
    safeRemoveDir(tempDir)  // 无论成功失败都清理
  }

  // 验证：编辑器不能为空
  const contentState = await page.$eval(QQNEWS_SELECTORS.editor, (el) => ({
    text: el.innerText.trim(),
    imageCount: el.querySelectorAll('img').length,
  }))
  if (!contentState.text && contentState.imageCount === 0) {
    throw new Error('企鹅号正文填充失败：编辑器仍为空')
  }
}
```

**为什么用 `parseContentSegments`？** 因为正文是富文本 HTML，图片是远程 URL，必须拆开处理：文本走粘贴，图片走工具栏上传。

### 5.3 正文图片上传 —— 平台特异化最重的地方

```typescript
async function uploadInlineImage(page, filePath) {
  const before = await imageCountInEditor(page, QQNEWS_SELECTORS.editor)  // 记录上传前图片数

  // 1. 点工具栏"插入图片"按钮
  await clickRequired(page, QQNEWS_SELECTORS.inlineImageButton, '正文图片按钮')
  // 2. 等待弹窗打开（omui 弹窗约定）
  await page.waitForSelector(DIALOG_OPEN, { visible: true, timeout: FIELD_TIMEOUT_MS })
  // 3. 切到"本地上传" tab（默认是"文内图片"）
  await clickOptional(page, '::-p-text(本地上传)')
  // 4. 上传文件
  await uploadFile(page, QQNEWS_SELECTORS.inlineImageUploadFileInput, filePath, '正文图片')
  // 5. 等待上传完成（企鹅号特有：确认按钮从禁用变可用）
  await waitForUploadComplete(page)
  // 6. 点确认
  await clickRequired(page, QQNEWS_SELECTORS.inlineImageConfirmButton, '正文图片确认按钮')
  // 7. 等待图片真的插入编辑器（图片数 +1）
  await waitForImageCount(page, before)
}
```

**这里每一个"等待"都是踩坑后加的**：

- `waitForSelector(DIALOG_OPEN)` —— 不等弹窗就点上传会失败
- `clickOptional(本地上传)` —— 默认 tab 不对，上传 input 不存在
- `waitForUploadComplete` —— 不等确认按钮可用就点，点不动
- `waitForImageCount` —— 不等图片真插入，下一段粘贴会覆盖

### 5.4 封面上传 —— 与正文图片同套路，但多一步"单图模式"

```typescript
async function fillCover(page, coverUrl) {
  const tempDir = createTempDir('qqnews-cover-')
  try {
    const filePath = await resolveMediaFile(page, coverUrl, tempDir)

    // 滚动到封面区（可能在视口外）
    await page.evaluate((sel) => {
      document.querySelector(sel)?.scrollIntoView({ block: 'center' })
    }, QQNEWS_SELECTORS.coverSection)
    await sleep(1_000)

    // 确保单图模式（企鹅号有单图/三图模式）
    await page.evaluate((sel) => {
      const input = document.querySelector(sel)
      if (input && !input.checked) input.click()
    }, QQNEWS_SELECTORS.coverSingleModeInput)

    // 判断是"添加"还是"更换"（已有封面时按钮文案不同）
    const hasExistingCover = await page.evaluate((sel) => {
      return document.querySelector(sel)?.querySelectorAll('img').length > 0
    }, QQNEWS_SELECTORS.coverSection)

    if (hasExistingCover) {
      await clickRequired(page, QQNEWS_SELECTORS.coverChangeButton, '封面更换按钮')
    } else {
      await clickRequired(page, QQNEWS_SELECTORS.coverAddButton, '封面上传按钮')
    }

    // 后面与正文图片完全一致：等弹窗 → 切 tab → 上传 → 等完成 → 确认
    await page.waitForSelector(DIALOG_OPEN, { visible: true, timeout: FIELD_TIMEOUT_MS })
    await clickOptional(page, '::-p-text(本地上传)')
    await uploadFile(page, QQNEWS_SELECTORS.coverUploadFileInput, filePath, '封面')
    await waitForUploadComplete(page)
    await clickRequired(page, QQNEWS_SELECTORS.coverConfirmButton, '封面确认按钮')

    // 验证：封面预览图出现
    await page.waitForSelector(QQNEWS_SELECTORS.coverPreviewImage, {
      visible: true,
      timeout: UPLOAD_TIMEOUT_MS,
    })
  } finally {
    safeRemoveDir(tempDir)
  }
}
```

### 5.5 声明类步骤 —— 用"检测+跳过"模式

企鹅号有两类声明（内容自主声明、AI 生成素材声明），都是可选的，**必须先检测是否需要，再决定是否操作**：

```typescript
async function fillSelfDeclaration(page) {
  // 1. 检测是否已添加（避免重复操作）
  const alreadyAdded = await page.evaluate((isVisibleSrc) => {
    const isVisible = new Function('return ' + isVisibleSrc)()
    return Array.from(document.querySelectorAll('button, div, span, p')).some(
      (el) => isVisible(el) && /(已添加|编辑|修改)内容自主声明/.test(el.textContent || ''),
    )
  }, IS_VISIBLE_FN_SRC)
  if (alreadyAdded) return  // 幂等性：已添加就跳过

  // 2. 尝试点击入口（可能不存在，用 clickOptional）
  const clicked = await clickOptional(page, QQNEWS_SELECTORS.selfDeclarationAddButton)
  if (!clicked) return  // 入口都没有就跳过

  // 3. 选中选项 → 确认
  await clickRequired(page, QQNEWS_SELECTORS.selfDeclarationOption, '声明选项')
  await clickRequired(page, QQNEWS_SELECTORS.selfDeclarationConfirmButton, '声明确认按钮')
}
```

**为什么用 `IS_VISIBLE_FN_SRC` 字符串注入？** `page.evaluate` 在浏览器上下文执行，访问不到 Node 端的函数，必须把函数源码序列化成字符串传进去，再用 `new Function` 重建。

### 5.6 提交 —— 加安全开关

```typescript
const DRY_RUN_TO_DRAFT = true  // 开发期走草稿，不真发布

async function submitArticle(page) {
  const beforeUrl = page.url()
  const submitSelector = DRY_RUN_TO_DRAFT
    ? QQNEWS_SELECTORS.draftButton
    : QQNEWS_SELECTORS.publishButton
  await clickRequired(page, submitSelector, '提交按钮')
  await waitForPublishResult(page, beforeUrl, DRY_RUN_TO_DRAFT)
  return page.url()
}
```

**为什么默认走草稿？** 开发期反复测试，真发布会污染账号。开发完成再改成 `false`。

---

## 第 6 步：写通用工具函数

这些是本平台内部复用的小工具，放文件末尾：

```typescript
// 必须点到的按钮（点不到就报错）
async function clickRequired(page, selector, label) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: FIELD_TIMEOUT_MS })
    await page.click(selector)
    await sleep(300)
  } catch {
    throw new Error(`未找到${label}：${selector}`)
  }
}

// 可选按钮（点不到不报错，返回 false）
async function clickOptional(page, selector) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: 2_000 })
    await page.click(selector)
    await sleep(300)
    return true
  } catch {
    return false
  }
}

// 企鹅号特有的上传完成检测（核心！）
async function waitForUploadComplete(page) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < UPLOAD_TIMEOUT_MS) {
    const done = await page.evaluate(() => {
      const dialog = document.querySelector('.omui-dialog-wrapper.open')
      if (!dialog) return false
      const uploading = dialog.querySelectorAll('.omui-upload-image-item__uploading').length
      const confirmBtn = Array.from(dialog.querySelectorAll('button'))
        .find((b) => b.textContent.trim() === '确认')
      return uploading === 0 && !confirmBtn?.classList.contains('is--disabled')
    })
    if (done) return
    await sleep(500)
  }
  throw new Error('图片上传等待完成超时')
}
```

---

## 第 7 步：调试方法

1. **去掉 headless**：启动 Puppeteer 时 `headless: false`，肉眼看着操作
2. **加慢放**：`slowMo: 100`，每步之间放慢
3. **DOM 快照**：失败时用 `page.evaluate(() => document.body.outerHTML)` 存 HTML，对比真实结构
4. **单步运行**：把主流程里的某一步注释掉，只测前几步
5. **`DRY_RUN_TO_DRAFT = true`**：开发期永远走草稿，不真发布

---

## 总结：手写的核心方法论

1. **先抓 DOM，再写选择器** —— 永远不要盲猜，用 DevTools 看真实结构
2. **选择器集中管理** —— 一个 `XXX_SELECTORS` 对象管所有
3. **主流程只编排，细节下沉到模块函数** —— 读主流程就知道做了什么
4. **每步操作后必须等待 + 验证** —— 不等待就概率性失败
5. **平台特异化逻辑单独成函数** —— 如 `waitForUploadComplete`、`splitCenteredParagraphs`
6. **安全开关优先** —— 开发期走草稿，不真发布
7. **幂等性设计** —— 声明类步骤先检测再操作，避免重复
8. **错误信息要可定位** —— `throw new Error('未找到XX按钮：selector')`，方便排查

按这套方法，你可以从零写出任何一个平台的发文逻辑，不只是企鹅号。
