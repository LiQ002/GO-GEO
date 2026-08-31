import type { Frame, Page } from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type PageLike = Page | Frame

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

export function safeRemoveDir(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // ignore cleanup failures
  }
}

function extensionFromContentType(contentType: string): string | undefined {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
  }
  return map[contentType.split(';')[0].trim().toLowerCase()]
}

function extensionFromUrl(url: string): string | undefined {
  try {
    return path.extname(new URL(url).pathname).toLowerCase() || undefined
  } catch {
    return undefined
  }
}

function detectExtFromBuffer(buffer: Buffer): string | undefined {
  if (buffer.length < 4) return undefined
  const header = buffer.subarray(0, 4).toString('hex').toLowerCase()
  if (header.startsWith('ffd8ff')) return '.jpg'
  if (header.startsWith('89504e47')) return '.png'
  if (header.startsWith('47494638')) return '.gif'
  if (header.startsWith('52494646') || header.startsWith('57454250')) return '.webp'
  return undefined
}

function writeImageBuffer(
  buffer: Buffer,
  url: string,
  contentType: string,
  tempDir: string,
): string {
  const extension =
    extensionFromContentType(contentType) ||
    extensionFromUrl(url) ||
    detectExtFromBuffer(buffer) ||
    '.jpg'
  const filename = `wb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`
  const filePath = path.join(tempDir, filename)
  fs.writeFileSync(filePath, buffer)
  return filePath
}

function writeDataUrl(dataUrl: string, tempDir: string): string {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw new Error('无效的 data URL')
  const [, mime, base64] = match
  const extension = extensionFromContentType(mime) || '.bin'
  const filename = `wb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`
  const filePath = path.join(tempDir, filename)
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
  return filePath
}

async function downloadImageViaPage(
  page: PageLike,
  url: string,
  tempDir: string,
): Promise<string> {
  const result = await page.evaluate(async (imageUrl: string) => {
    const response = await fetch(imageUrl, { credentials: 'include' })
    if (!response.ok) throw new Error(`fetch failed ${response.status}`)
    const blob = await response.blob()
    return {
      contentType: response.headers.get('content-type') || '',
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
    }
  }, url)
  return writeImageBuffer(Buffer.from(result.bytes), url, result.contentType, tempDir)
}

async function downloadImageViaFetch(url: string, tempDir: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`下载图片失败 ${response.status}: ${url}`)

  const contentType = response.headers.get('content-type') || ''
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length === 0) throw new Error(`下载图片为空: ${url}`)
  if (contentType && !contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`下载内容不是图片 (${contentType}): ${url}`)
  }
  return writeImageBuffer(buffer, url, contentType, tempDir)
}

export async function resolveMediaFile(
  page: PageLike,
  src: string,
  tempDir: string,
): Promise<string> {
  if (!src) throw new Error('图片地址为空')
  if (src.startsWith('data:')) return writeDataUrl(src, tempDir)

  const localPath = path.resolve(src)
  if (fs.existsSync(localPath)) return localPath

  if (src.startsWith('http://') || src.startsWith('https://')) {
    try {
      return await downloadImageViaFetch(src, tempDir)
    } catch (error) {
      console.log('[publish-helper] node fetch download failed, fallback to page fetch', error)
      return downloadImageViaPage(page, src, tempDir)
    }
  }
  throw new Error(`不支持的图片地址: ${src.slice(0, 100)}`)
}

export function parseContentSegments(
  htmlOrMarkdown: string,
): Array<{ type: 'text'; value: string } | { type: 'image'; src: string }> {
  const segments: ReturnType<typeof parseContentSegments> = []
  const imagePattern =
    /(?:<img[^>]+src=["']([^"']+)["'][^>]*>)|(?:!\[([^\]]*)\]\(([^)]+)\))/gi
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = imagePattern.exec(htmlOrMarkdown)) !== null) {
    const text = htmlOrMarkdown.slice(lastIndex, match.index)
    if (text.trim()) segments.push({ type: 'text', value: cleanTextSegment(text) })
    segments.push({ type: 'image', src: match[1] || match[3] })
    lastIndex = match.index + match[0].length
  }

  const trailing = htmlOrMarkdown.slice(lastIndex)
  if (trailing.trim()) segments.push({ type: 'text', value: cleanTextSegment(trailing) })
  return segments
}

/**
 * 清理文本片段首尾的孤立闭合/开启标签。
 *
 * parseContentSegments 在图片处切断 HTML 时，可能在片段开头留下孤立的 </p>、</div>、</h2> 等
 * 闭合标签，或在片段结尾留下未闭合的 <p>。这些孤立标签粘贴到 ProseMirror 编辑器后会被过滤
 * 或导致格式错乱（例如后面的 h2 标签被一并丢弃）。本函数裁剪首尾不完整的标签。
 */
function cleanTextSegment(html: string): string {
  return html
    // 移除开头的孤立闭合标签（</p>、</div>、</h2> 等）
    .replace(/^\s*<\/(?:p|div|h[1-6]|blockquote|li|ul|ol|section|article)>/gi, '')
    // 移除结尾的孤立开始标签（<p>、<div> 等，没有对应闭合）
    .replace(/<(?:p|div|h[1-6]|blockquote|li|ul|ol|section|article)(\s[^>]*)?>\s*$/gi, '')
    .trim()
}

export async function clearEditor(page: PageLike, selector: string) {
  const cleared = await page.evaluate((configuredSelector) => {
    const editor = document.querySelector(configuredSelector)
    if (!(editor instanceof HTMLElement)) return false
    editor.focus()
    editor.replaceChildren()
    editor.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'deleteContent' }),
    )
    return true
  }, selector)
  if (!cleared) throw new Error(`清空编辑器失败：${selector}`)
  await sleep(100)
}

export async function imageCountInEditor(page: PageLike, selector: string): Promise<number> {
  return page.evaluate((configuredSelector) => {
    const editor = document.querySelector(configuredSelector)
    return editor?.querySelectorAll('img').length ?? 0
  }, selector)
}

export async function pasteHtmlIntoEditor(page: PageLike, selector: string, html: string) {
  // 清除 HTML 中的对齐样式和内联 style/align 属性，避免编辑器保留居中等样式导致段落格式错乱。
  // 保留结构标签（p、br、strong 等），只去掉影响对齐的属性。
  const sanitized = html
    .replace(/\sstyle="[^"]*"/gi, '')
    .replace(/\sstyle='[^']*'/gi, '')
    .replace(/\salign="[^"]*"/gi, '')
    .replace(/\salign='[^']*'/gi, '')

  const plain = sanitized
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim()

  await page.evaluate(
    (configuredSelector, htmlValue, plainValue) => {
      const editor = document.querySelector(configuredSelector)
      if (!(editor instanceof HTMLElement)) {
        throw new Error(`编辑器丢失：${configuredSelector}`)
      }
      editor.focus()
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)

      const data = new DataTransfer()
      data.setData('text/html', htmlValue)
      data.setData('text/plain', plainValue)
      editor.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: data,
        }),
      )
    },
    selector,
    sanitized,
    plain,
  )
  await sleep(1_500)
}
