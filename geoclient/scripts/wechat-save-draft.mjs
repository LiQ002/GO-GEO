/**
 * Standalone WeChat Official Account draft smoke test.
 *
 * Usage:
 *   pnpm demo:wechat-draft
 *
 * The script launches an isolated visible Chromium profile, waits for a manual
 * QR-code login, fills fixed demo content, and only clicks an explicitly named
 * draft-save button. It never clicks publish or mass-send actions.
 */

import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const diagnosticsDir = path.join(root, 'tmp-auth-diagnose')
const profileDir = process.env.WECHAT_PROFILE_DIR
  ? path.resolve(process.env.WECHAT_PROFILE_DIR)
  : path.join(diagnosticsDir, 'wechat-draft-profile')
const publisherPath = path.join(root, 'main/lib/platforms/wechat/publish.js')
const loginTimeoutMs = Number(process.env.WECHAT_LOGIN_TIMEOUT_MS || 5 * 60_000)
const keepOpen = process.env.WECHAT_KEEP_OPEN !== '0'

const article = {
  title: '【自动化测试】GEO 助手公众号草稿验证',
  author: 'GEO 助手测试',
  summary: '仅用于验证微信公众号标题、作者、摘要、正文填写和保存草稿流程。',
  content: `
    <section>
      <h2>微信公众号自动化草稿验证</h2>
      <p>这是一篇由 Puppeteer 自动填写的模拟文章，仅用于开发环境流程验证。</p>
      <h3>本次验证内容</h3>
      <ol>
        <li>等待运营人员扫码登录公众号后台。</li>
        <li>打开微信公众号新版图文编辑器。</li>
        <li>填写标题、作者、摘要和正文。</li>
        <li>只保存为草稿，不执行发布或群发。</li>
      </ol>
      <p><strong>测试说明：</strong>本文不是正式业务内容，可在验证结束后从草稿箱删除。</p>
    </section>
  `.trim(),
}

function redactWechatUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)
    if (url.searchParams.has('token')) url.searchParams.set('token', '[REDACTED]')
    return url.toString()
  } catch {
    return rawUrl
  }
}

function buildEditorUrl(authUrl) {
  const token = new URL(authUrl).searchParams.get('token')
  if (!token) throw new Error('登录地址中没有公众号 token')

  const editorUrl = new URL(
    '/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=10',
    'https://mp.weixin.qq.com',
  )
  editorUrl.searchParams.set('token', token)
  editorUrl.searchParams.set('lang', 'zh_CN')
  editorUrl.searchParams.set('timestamp', String(Date.now()))
  return editorUrl.toString()
}

async function loadPublisher() {
  if (!existsSync(publisherPath)) {
    throw new Error('缺少编译后的微信公众号驱动，请使用 pnpm demo:wechat-draft 运行')
  }
  const publisherModule = await import(pathToFileURL(publisherPath).href)
  const publishWechatArticle =
    publisherModule.publishWechatArticle || publisherModule.default?.publishWechatArticle
  if (typeof publishWechatArticle !== 'function') {
    throw new Error('无法加载微信公众号发布驱动')
  }
  return publishWechatArticle
}

async function waitForWechatLogin(page) {
  console.log(`请在浏览器中扫码登录微信公众号，最长等待 ${loginTimeoutMs / 1000} 秒。`)
  await page.waitForFunction(
    () => {
      try {
        const url = new URL(window.location.href)
        return (
          url.hostname === 'mp.weixin.qq.com' &&
          url.pathname.startsWith('/cgi-bin/') &&
          Boolean(url.searchParams.get('token'))
        )
      } catch {
        return false
      }
    },
    { timeout: loginTimeoutMs },
  )
}

async function waitForBrowserClose(browser) {
  if (!browser.connected) return
  console.log('浏览器将保持打开以便检查草稿；关闭浏览器或按 Ctrl+C 结束脚本。')
  await new Promise((resolve) => browser.once('disconnected', resolve))
}

async function main() {
  mkdirSync(profileDir, { recursive: true })
  mkdirSync(diagnosticsDir, { recursive: true })

  const publishWechatArticle = await loadPublisher()
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: profileDir,
    defaultViewport: { width: 1366, height: 900 },
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=Translate',
    ],
  })

  const closeBrowser = async () => {
    if (browser.connected) await browser.close().catch(() => {})
  }
  process.once('SIGINT', () => void closeBrowser())
  process.once('SIGTERM', () => void closeBrowser())

  const pages = await browser.pages()
  const page = pages[0] || (await browser.newPage())
  page.setDefaultTimeout(45_000)

  try {
    await page.goto('https://mp.weixin.qq.com', { waitUntil: 'domcontentloaded' })
    await waitForWechatLogin(page)

    const editorUrl = buildEditorUrl(page.url())
    console.log(`登录成功，打开编辑器：${redactWechatUrl(editorUrl)}`)
    await page.goto(editorUrl, { waitUntil: 'domcontentloaded' })

    await publishWechatArticle(page, article)
    console.log('草稿保存成功：', article.title)
  } catch (error) {
    const screenshotPath = path.join(
      diagnosticsDir,
      `wechat-draft-failed-${Date.now()}.png`,
    )
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})
    console.error('草稿验证失败：', error instanceof Error ? error.message : String(error))
    console.error('当前页面：', redactWechatUrl(page.url()))
    console.error('诊断截图：', screenshotPath)
    process.exitCode = 1
  }

  if (keepOpen) await waitForBrowserClose(browser)
  else await closeBrowser()
}

await main()
