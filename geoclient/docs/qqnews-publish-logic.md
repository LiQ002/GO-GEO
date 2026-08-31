# 企鹅号自动化发文逻辑详解

> 源文件：[geoclient/lib/platforms/qqnews/publish.ts](file:///d:/geo/geoclient/lib/platforms/qqnews/publish.ts)
> 适用场景：通过 Puppeteer 驱动浏览器，自动在企鹅号（om.qq.com）发文页完成标题、正文、封面、声明、提交的完整流程。
> 当前模式：`DRY_RUN_TO_DRAFT = true`，只存草稿不真正发布。

---

## 一、整体架构

### 1.1 模块分层

```
publishQqnewsArticle (入口)
├── fillTitle          填标题
├── fillContent        填正文（含图片）
│   ├── parseContentSegments   拆分文本/图片片段（来自 publish-helpers）
│   ├── pasteHtmlIntoEditor    粘贴 HTML 到 ProseMirror（来自 publish-helpers）
│   ├── uploadInlineImage      上传单张正文图片
│   └── splitCenteredParagraphs  修正图片段落居中样式
├── fillCover          填封面
├── fillSelfDeclaration      内容自主声明
├── ensureAiMaterialDeclaration  AI 生成素材声明
└── submitArticle      提交（草稿/发布）
```

### 1.2 设计原则

1. **单一选择器原则**：每个 DOM 元素用**一个**经过验证的选择器定位，失败就抛错，不做候选数组/XPath 兜底。
2. **选择器集中管理**：所有选择器集中在 `QQNEWS_SELECTORS` 常量对象，DOM 变更只改这里。
3. **平台特性隔离**：企鹅号独有的逻辑（声明流程、omui 弹窗、图片居中）全部在本文件内，公共逻辑（HTML 粘贴、图片下载、临时目录）抽到 `publish-helpers.ts`。
4. **操作-验证模式**：每次点击后用 `waitForSelector` 验证预期效果（弹窗弹出、图片出现等），不依赖固定 sleep。

---

## 二、常量定义（第 14-44 行）

```typescript
const FIELD_TIMEOUT_MS = 20_000       // 单个字段等待超时：20 秒
const PAGE_LOAD_TIMEOUT_MS = 60_000   // 页面加载等待：60 秒（标题+编辑器都出现）
const UPLOAD_TIMEOUT_MS = 30_000      // 图片上传等待：30 秒
const PUBLISH_TIMEOUT_MS = 45_000     // 发布/存草稿结果等待：45 秒
const DRY_RUN_TO_DRAFT = true         // 草稿模式开关
```

**为什么这样定**：
- `FIELD_TIMEOUT_MS` 20 秒：兼顾网络慢和元素未渲染两种情况，太短（5s）会误报，太长（60s）影响调试。
- `PAGE_LOAD_TIMEOUT_MS` 60 秒：首次打开发文页要加载 ProseMirror 编辑器+工具栏，较慢。
- `UPLOAD_TIMEOUT_MS` 30 秒：图片上传涉及网络传输+服务端处理，大图可能较慢。
- `DRY_RUN_TO_DRAFT`：开发期默认草稿模式，避免误发真实文章；正式发布改为 `false`。

### 2.1 弹窗选择器（第 26-28 行）

```typescript
const DIALOG_OPEN = '.omui-dialog-wrapper.open'
const DIALOG_OPEN_XPATH =
  '//*[contains(@class,"omui-dialog-wrapper") and contains(@class,"open")]'
```

**为什么不用 `[role="dialog"]`**：
企鹅号 omui 组件库的弹窗容器是 `<div class="omui-dialog-wrapper open">`，**不设置 `role="dialog"` 属性**。原本用 `[role="dialog"]` 检测弹窗导致所有依赖弹窗的操作（上传 input、确认按钮）都找不到元素。这两个常量是所有弹窗内操作的基础。

### 2.2 可见性检测函数（第 34-44 行）

```typescript
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
```

**为什么要序列化函数字符串**：
`page.evaluate` 在浏览器上下文执行，**无法访问 Node 端的函数和变量**。直接在 evaluate 里调用 `isVisible` 会报 `isVisible is not defined`。所以把函数源码序列化成字符串，通过参数传入，在浏览器端用 `new Function('return ' + src)()` 重建。用于内容自主声明和 AI 声明的元素检测（这些元素动态加载，需检查可见性）。

---

## 三、选择器常量（第 50-91 行）

### 3.1 标题与编辑器

```typescript
title: '.omui-inputautogrowing__inner[contenteditable="true"]'
editor: '.ProseMirror.ExEditor-basic[contenteditable="true"]'
```

**DOM 来源**：DOM 快照验证。
- 标题：`<span class="omui-inputautogrowing__inner" contenteditable="true" data-placeholder="请输入标题（5-64个字）">`
- 编辑器：`<div class="ProseMirror ExEditor-basic" contenteditable="true">`

**为什么用 `contenteditable="true"`**：企鹅号标题不是 `<input>`/`<textarea>`，而是 `contenteditable` 的 `span`，模拟键盘输入必须聚焦该元素。

### 3.2 封面区

```typescript
coverSection: '#articlePublish-coverinfo'
coverSingleModeInput: '#articlePublish-coverinfo input[type="radio"][value="1"]'
coverAddButton: '#articlePublish-coverinfo button.omui-button--add'
coverChangeButton: '::-p-xpath(//*[@id="articlePublish-coverinfo"]//*[normalize-space(.)="更换"])'
coverUploadFileInput: `${DIALOG_OPEN} .omui-upload-image-trigger input[type="file"]`
coverConfirmButton: `::-p-xpath(${DIALOG_OPEN_XPATH}//button[normalize-space(.)="确认"])`
coverPreviewImage: '#articlePublish-coverinfo img'
```

**为什么混用 CSS 和 XPath**：
- ID、type、class 用 CSS（`#articlePublish-coverinfo`、`input[type="radio"][value="1"]`）。
- 文案区分用 XPath（"更换"、"确认"按钮）——因为页面有多个 `button.omui-button--background-grey`（存草稿/预览），class 无法区分，必须用文案定位。
- "更换"按钮只在已存在封面时出现，"添加"按钮只在无封面时出现——通过 `coverChangeButton` 和 `coverAddButton` 分别定位。

### 3.3 内容自主声明

```typescript
selfDeclarationAddButton:
  '::-p-xpath(//button[contains(@class,"omui-button--dashed")][normalize-space(.)="添加内容自主声明"])'
selfDeclarationOption:
  '::-p-xpath(//label[contains(@class,"omui-radio")][.//span[normalize-space(.)="该文章由AI辅助创作"]]//input[@type="radio"])'
selfDeclarationConfirmButton: `::-p-xpath(${DIALOG_OPEN_XPATH}//button[normalize-space(.)="确认"])`
```

**为什么 `selfDeclarationAddButton` 要文案过滤**：
DOM 快照显示页面有**两个** `button.omui-button--dashed`：一个是"活动投稿"，一个是"添加内容自主声明"。只用 class 会点错，必须加 `normalize-space(.)="添加内容自主声明"` 文案过滤。

### 3.4 AI 生成素材声明

```typescript
aiDeclarationTrigger: '::-p-xpath(//a[normalize-space(.)="进行补充>"])'
aiDeclarationThumb: '#ai_declaration_part_image section.omui-thumb'
aiDeclarationSubmitButton: `::-p-xpath(${DIALOG_OPEN_XPATH}//button[normalize-space(.)="提交"])`
```

**说明**：
- `aiDeclarationTrigger`：文章含 AI 生成图片时，企鹅号会显示"进行补充>"链接，点击打开声明弹窗。
- `aiDeclarationThumb`：声明弹窗里的图片缩略图，每个 `section.omui-thumb` 代表一张图，点击勾选。
- 这个区域是**动态加载**的，只有点击 trigger 后才渲染，初始页面抓不到。

### 3.5 正文图片上传

```typescript
inlineImageButton: 'exeditor-toolbar-button[data-toolbar-item-of="imagePlugin"]'
inlineImageUploadFileInput: `${DIALOG_OPEN} .omui-upload-image-trigger input[type="file"]`
inlineImageConfirmButton: `::-p-xpath(${DIALOG_OPEN_XPATH}//button[normalize-space(.)="确认"])`
```

**重点——`inlineImageButton` 的演进**：
- **原选择器**：`.btn.in-static[aria-label="插入图片"]` —— 完全错误，这个 class 和属性都不存在。
- **盲猜方案**（已删除）：4 个候选选择器 + shadow DOM 递归 + XPath 文案兜底 + aria-label 深度查找，114 行代码。
- **精准方案**（当前）：DOM 快照揭示工具栏按钮是自定义元素 `<exeditor-toolbar-button data-toolbar-item-of="imagePlugin" label="插入图片">`，用语义属性 `data-toolbar-item-of` 精准定位，1 个选择器搞定。

**为什么 `data-toolbar-item-of` 稳定**：
这是企鹅号编辑器框架（exeditor）的语义属性，标识"这个按钮对应哪个插件"，比 class（CSS module 哈希）和 aria-label（可能国际化）都稳定。

### 3.6 提交按钮

```typescript
publishButton: '::-p-xpath((//button[.//span[normalize-space(.)="发布"]][not(@disabled)])[last()])'
draftButton: '::-p-xpath((//button[normalize-space(.)="存草稿"])[last()])'
```

**为什么用 `[last()]`**：
DOM 快照显示页面有多个"发布"相关按钮（顶部工具栏+底部工具栏），用 `[last()]` 取最后一个（通常是底部主提交区的按钮）。

**为什么 publishButton 用 `.//span` 而 draftButton 直接用 `.`**：
DOM 快照显示：
- 发布按钮：`<button><span class="tool_publish_buttons_text-cls3VQdb">发布</span></button>` —— 文案在子 `span` 里。
- 存草稿按钮：`<button>存草稿</button>` —— 文案直接在按钮内。

---

## 四、入口函数 publishQqnewsArticle（第 93-132 行）

```typescript
export async function publishQqnewsArticle(page: Page, article: PublishArticleInput): Promise<string> {
  console.log('[QqnewsPublisher] start', { ... })

  await Promise.all([
    page.waitForSelector(QQNEWS_SELECTORS.title, { visible: true, timeout: PAGE_LOAD_TIMEOUT_MS }),
    page.waitForSelector(QQNEWS_SELECTORS.editor, { visible: true, timeout: PAGE_LOAD_TIMEOUT_MS }),
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
```

**流程顺序为什么这样排**：
1. **先等标题+编辑器都出现**：用 `Promise.all` 并行等待，确保页面加载完成。标题和编辑器是发文页的核心元素，两者都可见才能开始操作。
2. **标题 → 正文 → 封面 → 声明 → 提交**：这是用户手动操作的顺序，也是企鹅号前端校验的顺序（例如某些声明需要正文有图片才会出现）。
3. **每步之间 `sleep(1_000)`**：给企鹅号前端状态同步留时间。ProseMirror 编辑器、omui 组件库的状态更新是异步的，连续操作容易触发竞态条件。

---

## 五、标题填充 fillTitle（第 136-149 行）

```typescript
async function fillTitle(page: Page, title: string) {
  if (!title) return
  const titleEl = await page.waitForSelector(QQNEWS_SELECTORS.title, { visible: true, timeout: FIELD_TIMEOUT_MS })
  if (!titleEl) throw new Error('未找到企鹅号标题输入框')

  await titleEl.click()
  await selectAll(page)
  await page.keyboard.press('Backspace')
  await page.keyboard.type(title, { delay: 20 })
  await sleep(500)
}
```

**为什么用键盘输入而不是 `page.evaluate` 设置 innerText**：
企鹅号标题是 `contenteditable` 元素，前端框架（Vue/React）监听 `input` 事件同步状态。直接修改 DOM 不会触发框架的状态更新，导致提交时标题为空。用 `keyboard.type` 模拟真实键盘输入，会触发完整的 `keydown`→`input`→`keyup` 事件链。

**为什么先 selectAll + Backspace**：
防止标题输入框有残留内容（例如上次未清空的草稿），先全选删除再输入。

**`delay: 20`**：每个字符间隔 20ms，模拟人类输入速度，避免某些防自动化检测。

---

## 六、正文填充 fillContent（第 153-196 行）

### 6.1 主流程

```typescript
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
      // 图片插入后按 Enter 创建新段落
      const next = segments[i + 1]
      if (next && next.type === 'text') {
        await page.keyboard.press('Enter')
        await sleep(300)
      }
    }
  } finally {
    safeRemoveDir(tempDir)
  }

  await splitCenteredParagraphs(page)
  // 验证编辑器非空
  const contentState = await page.$eval(...)
  if (!contentState.text && contentState.imageCount === 0) {
    throw new Error('企鹅号正文填充失败：编辑器仍为空')
  }
}
```

### 6.2 为什么用 parseContentSegments 拆分

文章内容是 HTML 字符串，混合了文本和 `<img>` 标签。`parseContentSegments` 把它拆成 `[{type:'text', value:'<p>...</p>'}, {type:'image', src:'...'}, ...]` 数组。这样可以：
- 文本片段：用 `pasteHtmlIntoEditor` 粘贴 HTML（保留 `<p>`、`<strong>`、`<h2>` 等结构）
- 图片片段：用 `uploadInlineImage` 通过工具栏上传（粘贴 HTML 里的 `<img>` 会被 ProseMirror 过滤掉，因为 src 是外部 URL）

### 6.3 为什么图片后要按 Enter

**问题**：企鹅号编辑器插入图片时自动生成 `<p style="text-align: center">图片</p>`，光标停在居中段落内。下一段文字粘贴时直接接在图片后，被放进居中段落，导致文字也居中。

**解决**：图片插入后，如果下一段是文字，按 Enter 创建新段落，让光标脱离居中段落。

### 6.4 splitCenteredParagraphs（第 204-253 行）

```typescript
async function splitCenteredParagraphs(page: Page) {
  await page.evaluate((editorSelector) => {
    const editor = document.querySelector(editorSelector)
    if (!(editor instanceof HTMLElement)) return

    const centeredParas = Array.from(
      editor.querySelectorAll('p[style*="text-align: center"], p[style*="text-align:center"]'),
    )

    for (const para of centeredParas) {
      const imageSpan = para.querySelector('span[contenteditable="false"]')
      if (!imageSpan) continue

      const afterImage: Node[] = []
      let foundImage = false
      for (const child of Array.from(para.childNodes)) {
        if (foundImage) afterImage.push(child)
        if (child === imageSpan || (child instanceof Element && child.contains(imageSpan))) {
          foundImage = true
        }
      }

      const textContent = afterImage.map((n) => (n.textContent || '').trim()).join('').trim()
      if (textContent) {
        const newPara = document.createElement('p')
        for (const node of afterImage) newPara.appendChild(node.cloneNode(true))
        para.after(newPara)
        for (const node of afterImage) para.removeChild(node)
      }
    }

    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
  }, QQNEWS_SELECTORS.editor)
  await sleep(500)
}
```

**这是兜底逻辑**：即使按 Enter 也可能有遗漏（例如图片后紧跟的图注文字）。这个函数扫描所有 `p[style*="text-align: center"]`，把图片 span 之后的文字节点移到新的左对齐 `<p>` 里。

**为什么最后要 dispatch input 事件**：直接修改 DOM 不会触发 ProseMirror 的状态同步，必须派发 `input` 事件让 ProseMirror 重新解析文档。

---

## 七、正文图片上传 uploadInlineImage（第 255-271 行）

```typescript
async function uploadInlineImage(page: Page, filePath: string) {
  const before = await imageCountInEditor(page, QQNEWS_SELECTORS.editor)

  await clickRequired(page, QQNEWS_SELECTORS.inlineImageButton, '企鹅号正文图片工具栏按钮')
  await page.waitForSelector(DIALOG_OPEN, { visible: true, timeout: FIELD_TIMEOUT_MS })

  await clickOptional(page, '::-p-text(本地上传)')
  await uploadFile(page, QQNEWS_SELECTORS.inlineImageUploadFileInput, filePath, '企鹅号正文图片')
  await waitForUploadComplete(page)
  await clickRequired(page, QQNEWS_SELECTORS.inlineImageConfirmButton, '企鹅号正文图片确认按钮')

  await waitForImageCount(page, before)
}
```

### 7.1 流程详解

1. **记录当前图片数**：`before` 用于后续验证上传成功（图片数应该 +1）。
2. **点击"插入图片"按钮**：用精准选择器 `exeditor-toolbar-button[data-toolbar-item-of="imagePlugin"]`。
3. **等待弹窗弹出**：`waitForSelector(DIALOG_OPEN)` 验证上传弹窗已打开。
4. **切换"本地上传"tab**：弹窗默认可能在其他 tab（如"我的素材"），`clickOptional` 尝试点击"本地上传"，不存在则跳过。
5. **上传文件**：`uploadFile` 用 `input.uploadFile(filePath)` 设置文件路径（Puppeteer 的原生上传方式，绕过文件选择对话框）。
6. **等待上传完成**：`waitForUploadComplete` 等待服务端处理完成（见 7.2）。
7. **点击确认**：确认按钮插入图片到编辑器。
8. **验证图片数增加**：`waitForImageCount` 轮询编辑器内 `<img>` 数量，确认图片已插入。

### 7.2 waitForUploadComplete（第 490-509 行）

```typescript
async function waitForUploadComplete(page: Page) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < UPLOAD_TIMEOUT_MS) {
    const done = await page.evaluate(() => {
      const dialog = document.querySelector('.omui-dialog-wrapper.open')
      if (!dialog) return false
      const uploading = dialog.querySelectorAll('.omui-upload-image-item__uploading').length
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
```

**为什么需要这个函数**：
企鹅号上传弹窗在图片上传到服务器期间会：
- 给图片项加 `omui-upload-image-item__uploading` class
- 禁用确认按钮（`is--disabled`）

如果上传中就点确认，点击无效（按钮禁用），图片不会插入编辑器。必须等待两个条件都满足：上传中项为 0 且确认按钮可点击。

---

## 八、封面填充 fillCover（第 275-328 行）

```typescript
async function fillCover(page: Page, coverUrl: string) {
  const tempDir = createTempDir('qqnews-cover-')
  try {
    const filePath = await resolveMediaFile(page, coverUrl, tempDir)

    await page.waitForSelector(QQNEWS_SELECTORS.coverSection, { visible: true, timeout: FIELD_TIMEOUT_MS })
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

    await page.waitForSelector(DIALOG_OPEN, { visible: true, timeout: FIELD_TIMEOUT_MS })
    await sleep(1_000)

    // 切换"本地上传"tab
    await clickOptional(page, '::-p-text(本地上传)')
    await sleep(800)

    await uploadFile(page, QQNEWS_SELECTORS.coverUploadFileInput, filePath, '企鹅号封面')
    await waitForUploadComplete(page)
    await clickRequired(page, QQNEWS_SELECTORS.coverConfirmButton, '企鹅号封面确认按钮')

    await page.waitForSelector(QQNEWS_SELECTORS.coverPreviewImage, { visible: true, timeout: UPLOAD_TIMEOUT_MS })
  } finally {
    safeRemoveDir(tempDir)
  }
}
```

### 8.1 关键逻辑

1. **下载封面到本地临时目录**：`resolveMediaFile` 把远程 URL 图片下载到本地文件（Puppeteer 的 `uploadFile` 需要本地文件路径）。
2. **滚动到封面区**：`scrollIntoView` 确保封面区在视口内，避免点击被遮挡。
3. **确保单图模式**：企鹅号封面有"单图"和"三图"两种模式，单图模式只需一张封面。用 `input.checked` 检查当前状态，未选中则点击。
4. **区分"添加"和"更换"**：
   - 无封面：点击 `coverAddButton`（"+"按钮）
   - 有封面：点击 `coverChangeButton`（"更换"文字按钮）
5. **切换"本地上传"tab**：**封面弹窗与正文图片弹窗结构不同**——正文图片弹窗默认在"本地上传"tab，封面弹窗默认在"文内图片"tab（展示已插入正文的图片）。必须切换到"本地上传"才能上传文件。
6. **等待封面预览图出现**：确认后封面区会显示预览图，用 `coverPreviewImage` 验证上传成功。

### 8.2 为什么要 `finally { safeRemoveDir(tempDir) }`

下载的封面图片是临时文件，上传完成后应立即删除，避免磁盘占用累积。`finally` 确保即使流程出错也能清理。

---

## 九、内容自主声明 fillSelfDeclaration（第 332-364 行）

```typescript
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
  await clickRequired(page, QQNEWS_SELECTORS.selfDeclarationConfirmButton, '内容自主声明确认按钮')
  await sleep(1_000)
}
```

### 9.1 为什么要先检测"已添加"

企鹅号的内容自主声明一旦添加就会显示为"编辑内容自主声明"等状态，再次添加会报错。所以先用正则 `/已添加|编辑|修改|作者声明/` 检测是否已存在声明，避免重复操作。

### 9.2 为什么要用 `clickOptional` 而不是 `clickRequired`

某些文章类型（如视频投稿）可能没有"内容自主声明"入口。用 `clickOptional`（找不到返回 false 不抛错）而非 `clickRequired`（找不到抛错），让流程能优雅跳过。

### 9.3 流程

1. 检测是否已添加 → 已添加则跳过
2. 点击"添加内容自主声明"按钮 → 打开声明弹窗
3. 选择"该文章由AI辅助创作"单选项
4. 点击"确认"按钮 → 保存声明

---

## 十、AI 生成素材声明 ensureAiMaterialDeclaration（第 368-416 行）

```typescript
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
    const thumbs = Array.from(document.querySelectorAll(thumbSelector)).filter(isVisible) as HTMLElement[]
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
  console.log(`[QqnewsPublisher] AI 生成素材声明：共 ${selectResult.total} 张图片，新勾选 ${selectResult.clicked} 张`)
  await sleep(800)

  await clickRequired(page, QQNEWS_SELECTORS.aiDeclarationSubmitButton, 'AI 生成素材声明提交按钮')
  console.log('[QqnewsPublisher] 已完成 AI 生成素材声明')
  await sleep(1_500)
}
```

### 10.1 为什么需要这个流程

企鹅号要求文章里的 AI 生成图片必须声明。如果文章含 AI 生成图片但未声明，发布时会被拦截。这个函数自动完成声明。

### 10.2 何时触发

只有当页面出现"进行补充>"链接时才需要声明。用正则 `/未进行AI生成声明|AI生成素材声明|请进行补充|进行补充/` 检测。

### 10.3 勾选逻辑

- 点击"进行补充>"链接 → 打开声明弹窗
- 弹窗里每个 `section.omui-thumb` 代表一张图片
- 遍历所有 thumb，未选中的（`!is--selected`）点击勾选
- 点击"提交"按钮

### 10.4 为什么要 `sleep(2_000)` 等待

点击"进行补充>"后，声明弹窗是动态加载的（从服务端拉取图片列表），需要 2 秒加载完成。立即查找 thumb 会找不到。

---

## 十一、提交 submitArticle（第 420-431 行）

```typescript
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
```

**为什么记录 `beforeUrl`**：提交成功后页面可能跳转（发布成功跳转到文章列表），通过对比 URL 变化判断提交完成。

**`DRY_RUN_TO_DRAFT` 的作用**：
- `true`：点击"存草稿"按钮，等待"保存成功"文案
- `false`：点击"发布"按钮，等待"发布成功"文案或 URL 跳转

---

## 十二、通用工具函数（第 435-544 行）

### 12.1 uploadFile

```typescript
async function uploadFile(page: Page, selector: string, filePath: string, label: string): Promise<void> {
  const input = (await page.waitForSelector(selector, { timeout: UPLOAD_TIMEOUT_MS })) as ElementHandle<HTMLInputElement> | null
  if (!input) throw new Error(`未找到${label}上传输入框：${selector}`)
  await input.uploadFile(filePath)
  await sleep(1_000)
}
```

**为什么用 `input.uploadFile` 而不是点击触发文件选择对话框**：
Puppeteer 无法操作原生文件选择对话框（OS 级别的弹窗）。`uploadFile` 直接设置 `<input type="file">` 的文件路径，绕过对话框，是 Puppeteer 上传文件的标准方式。

### 12.2 clickRequired vs clickOptional

```typescript
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
```

**区别**：
- `clickRequired`：必须找到，找不到抛错（20s 超时）。用于核心流程元素（标题、编辑器、提交按钮）。
- `clickOptional`：尝试找，找不到返回 false（2s 超时）。用于可选元素（"本地上传"tab、内容自主声明入口）。

### 12.3 waitForImageCount

```typescript
async function waitForImageCount(page: Page, before: number) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < UPLOAD_TIMEOUT_MS) {
    if ((await imageCountInEditor(page, QQNEWS_SELECTORS.editor)) > before) return
    await sleep(300)
  }
  throw new Error(`企鹅号正文图片上传超时 (${UPLOAD_TIMEOUT_MS}ms)`)
}
```

**轮询验证**：点击确认按钮后，图片不会立即出现在编辑器（ProseMirror 需要时间渲染节点）。每 300ms 检查一次编辑器内 `<img>` 数量，比 `before` 多说明插入成功。

### 12.4 waitForPublishResult

```typescript
async function waitForPublishResult(page: Page, beforeUrl: string, isDraft: boolean): Promise<void> {
  const startedAt = Date.now()
  const successSelector = isDraft ? QQNEWS_SELECTORS.draftSavedText : QQNEWS_SELECTORS.successText

  while (Date.now() - startedAt < PUBLISH_TIMEOUT_MS) {
    if (page.url() !== beforeUrl) return
    if (await isVisible(page, successSelector)) return
    await sleep(500)
  }

  throw new Error(`企鹅号${isDraft ? '保存草稿' : '发布'}等待超时 (${PUBLISH_TIMEOUT_MS}ms): ${page.url()}`)
}
```

**两种成功信号**：
1. URL 变化（页面跳转）
2. 成功文案出现（"保存成功"或"发布成功"）

任一满足即视为成功。双信号兜底是因为企鹅号不同场景的成功反馈方式不同。

### 12.5 selectAll

```typescript
async function selectAll(page: Page) {
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.keyboard.down(modifier)
  await page.keyboard.press('A')
  await page.keyboard.up(modifier)
}
```

**跨平台兼容**：macOS 用 `Cmd+A`，Windows/Linux 用 `Ctrl+A`。

---

## 十三、关键设计决策总结

### 13.1 为什么选择器都用 DOM 快照验证

开发初期用过盲猜方案（多候选选择器 + shadow DOM 递归 + XPath 兜底），结果：
- 114 行代码维护成本高
- 命中错误的元素（aria-label 相同但功能不同的图标）
- 失败时无法定位问题（不知道哪个候选该命中）

改为 DOM 快照验证后：
- 每个选择器对应真实 DOM 元素
- 失败立即抛错，定位明确
- 代码量减少 70%

### 13.2 为什么保留 `DRY_RUN_TO_DRAFT`

- 开发期：草稿模式避免误发真实文章，可反复测试
- 生产期：改为 `false` 即可正式发布
- 不需要两套代码，一个开关切换

### 13.3 为什么用 ProseMirror 的 paste 事件而不是 execCommand

企鹅号编辑器是 ProseMirror（富文本框架），不支持 `document.execCommand('insertHTML')`。通过 `ClipboardEvent('paste')` 模拟粘贴，是 ProseMirror 支持的标准输入方式，能保留 HTML 结构（`<p>`、`<strong>`、`<h2>` 等）。

### 13.4 为什么需要 splitCenteredParagraphs

企鹅号编辑器插入图片时自动给图片段落加 `text-align: center`。这是编辑器的"贴心"功能，但导致图片后的文字也居中。即使按 Enter 分离段落，也可能有遗漏（图注文字）。`splitCenteredParagraphs` 作为兜底，扫描所有居中段落，把图片后的文字移到左对齐段落。

---

## 十四、故障排查指南

### 14.1 选择器失效

**现象**：`未找到XXX：selector` 错误

**排查**：
1. 用 `pnpm dev:operator:debug` 启动调试浏览器（带 CDP 端口）
2. 在浏览器 DevTools 里检查选择器是否还能命中元素
3. 如果 DOM 改版，更新 `QQNEWS_SELECTORS` 对应字段

### 14.2 图片上传超时

**现象**：`企鹅号正文图片上传超时 (30000ms)`

**排查**：
1. 检查网络是否正常
2. 检查图片大小是否超过限制（企鹅号单张 20M，gif 5M）
3. 检查 `waitForUploadComplete` 的判断条件是否仍有效（`__uploading` class、`is--disabled` class）

### 14.3 正文居中

**现象**：发布后正文段落居中

**排查**：
1. 检查 `splitCenteredParagraphs` 是否执行
2. 检查企鹅号是否改了居中段落的 style 格式（`text-align: center` vs `text-align:center`）
3. 检查图片 span 的 `contenteditable="false"` 属性是否仍存在

---

## 十五、附录：完整流程时序图

```
用户触发发布
    ↓
publishQqnewsArticle
    ↓
[1] 等待标题+编辑器出现（Promise.all）
    ↓
[2] fillTitle
    ├─ 点击标题输入框
    ├─ Ctrl+A 全选
    ├─ Backspace 清空
    └─ keyboard.type 输入标题
    ↓
[3] fillContent
    ├─ clearEditor 清空编辑器
    ├─ parseContentSegments 拆分内容
    └─ 遍历片段：
        ├─ 文本：pasteHtmlIntoEditor
        └─ 图片：
            ├─ resolveMediaFile 下载图片
            ├─ uploadInlineImage
            │   ├─ 点击"插入图片"按钮
            │   ├─ 等待弹窗弹出
            │   ├─ 切换"本地上传"tab
            │   ├─ uploadFile 设置文件
            │   ├─ waitForUploadComplete 等待上传
            │   ├─ 点击"确认"
            │   └─ waitForImageCount 验证插入
            └─ 按 Enter 分离段落
    ├─ splitCenteredParagraphs 修正居中
    └─ 验证编辑器非空
    ↓
[4] fillCover
    ├─ 下载封面到临时目录
    ├─ 滚动到封面区
    ├─ 确保单图模式
    ├─ 点击"添加"或"更换"
    ├─ 等待弹窗弹出
    ├─ 切换"本地上传"tab
    ├─ uploadFile 上传
    ├─ waitForUploadComplete
    ├─ 点击"确认"
    └─ 等待封面预览图出现
    ↓
[5] fillSelfDeclaration
    ├─ 检测是否已添加
    ├─ 点击"添加内容自主声明"
    ├─ 选择"AI辅助创作"
    └─ 点击"确认"
    ↓
[6] ensureAiMaterialDeclaration
    ├─ 检测是否需要补充
    ├─ 点击"进行补充>"
    ├─ 勾选所有图片
    └─ 点击"提交"
    ↓
[7] submitArticle
    ├─ 选择存草稿/发布按钮
    ├─ 点击按钮
    └─ waitForPublishResult 等待结果
    ↓
返回 publishedUrl
```

---

## 十六、相关文件

- [publish.ts](file:///d:/geo/geoclient/lib/platforms/qqnews/publish.ts) — 企鹅号发文逻辑（本文件）
- [publish-helpers.ts](file:///d:/geo/geoclient/lib/platforms/publish-helpers.ts) — 公共工具（HTML 粘贴、图片下载、内容拆分等）
- [types.ts](file:///d:/geo/geoclient/lib/platforms/types.ts) — `PublishArticleInput` 接口定义
- [index.ts](file:///d:/geo/geoclient/lib/platforms/qqnews/index.ts) — 企鹅号平台注册（登录 URL、发文 URL 等）
