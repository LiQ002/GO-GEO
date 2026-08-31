/**
 * geo-worker.ts - Standalone Node.js worker for GEO (查收录) jobs.
 *
 * Runs as a child process spawned by Electron (via child_process.fork with
 * ELECTRON_RUN_AS_NODE=1).  Receives GeoJobInput via IPC, launches Chrome
 * with stealth, executes the full GEO job (cookie injection → navigation →
 * input → wait → extract → return), and sends results back.
 *
 * This worker exists because Chrome launched from within Electron's main
 * process has environment fingerprints that trigger risk control on platforms
 * like yuanbao (元宝). Running Playwright from a pure Node.js process (this worker) avoids the fingerprint issue.
 *
 * IPC protocol (using Node.js child_process IPC):
 *   Electron → Worker:  { type:'geo-job', input:GeoJobInput, executablePath?:string, evidenceDir?:string }
 *   Worker → Electron:  { type:'log', level, scope, message, data? }
 *                       { type:'result', result:{ answerText, answerStatus, screenshotKey?, sessionRef?, citations } }
 *                       { type:'error', message, stack? }
 */

import { chromium, type Browser, type Page, type Frame, type BrowserContext, type ElementHandle, type Cookie } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

import { credentialService } from '../main/services/CredentialService'
import {
  getGeoDriver,
  type ModelPlatformGeoDriver,
  type SelectorChain,
  type InputStep,
} from '../../lib/model-platforms/geo-drivers/index'
import {
  getCookieSiteUrl,
  getTargetUrl,
  requirePlatform,
  resolvePlatformKind,
  type PlatformKind,
} from '../../lib/platforms/unified'
import {
  deserializeSessionCookies,
  deserializeSessionLocalStorage,
} from '../../lib/platforms/cookies'
import type { GeoJobInput, GeoCitation } from '../../lib/ipc-contract'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// NOTE: Do NOT hardcode a Chrome version here. The actual Playwright-bundled
// Chrome is newer (e.g. 148), and if we hardcode 131 while sec-ch-ua reports
// 148 → version mismatch = dead giveaway for automation.
// We instead query the real browser version and generate a matching UA via
// CDP Network.setUserAgentOverride (with userAgentMetadata) after launch.

const CHROME_ARGS = [
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-blink-features=AutomationControlled',
  // NOTE: no --user-agent here; set via CDP after launch to match sec-ch-ua
] as const

// 方案C：共用 PC 端授权 cookie + 移动端 UA/viewport 模拟移动端访问。
// 豆包 ttwid 绑定设备指纹，PC cookie + 移动端 UA 可能触发验证码，
// 由 P0 验证码检测+人工干预处理（waitForCaptchaResolved）。
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'


// ---------------------------------------------------------------------------
// Logger — sends structured messages back to Electron via IPC
// ---------------------------------------------------------------------------

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function sendLog(level: LogLevel, scope: string, message: string, data?: unknown) {
  // 只通过 IPC 发送给主进程，由主进程 logger 统一输出（终端 + main.log 文件）。
  // 不再直接 console.log：打包模式下 Electron GUI 程序没有 attached console，
  // console 输出会丢失；dev 模式下主进程 logger 也会输出到终端，不会丢日志。
  try {
    process.send?.({ type: 'log', level, scope, message, data })
  } catch { /* parent disconnected */ }
}

const log = {
  debug: (msg: string, data?: unknown) => sendLog('debug', 'GeoWorker', msg, data),
  info: (msg: string, data?: unknown) => sendLog('info', 'GeoWorker', msg, data),
  warn: (msg: string, data?: unknown) => sendLog('warn', 'GeoWorker', msg, data),
  error: (msg: string, data?: unknown) => sendLog('error', 'GeoWorker', msg, data),
}

// ---------------------------------------------------------------------------
// 通用 evaluate 超时包装：任何 page.evaluate / elHandle.evaluate 都用这个包一层，
// 防止页面 JS 死循环/卡死（元宝尤其容易）导致整个 worker 120s 被杀。
// 默认 5s 超时，返回 null；错误统一 warn 日志不抛。
// ---------------------------------------------------------------------------
function wrapEval<T>(
  fnPromise: Promise<T>,
  tag: string,
  timeoutMs = 5000,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const p = new Promise<null>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`${tag} TIMEOUT after ${timeoutMs}ms`)), timeoutMs)
  })
  return Promise.race([fnPromise, p])
    .then((res) => {
      if (timer) clearTimeout(timer)
      return res as T
    })
    .catch((e) => {
      if (timer) clearTimeout(timer)
      log.warn(`[wrapEval] ${tag} aborted`, { error: String(e) })
      return null
    })
}

// ---------------------------------------------------------------------------
// Browser launch (standalone — no Electron app dependency)
// ---------------------------------------------------------------------------

async function launchBrowser(opts: {
  stealth?: boolean
  executablePath?: string
}): Promise<Browser> {
  const stealth = opts.stealth ?? true
  log.info('Launching browser (worker, Playwright)', {
    stealth,
    source: opts.executablePath ? 'bundled' : 'system-chrome',
    platform: process.platform,
    arch: process.arch,
  })
  // 优先使用系统 Chrome（channel:'chrome'），而非 Playwright 内置 Chromium。
  // 原因：内置 Chromium 的 sec-ch-ua 品牌为 "Chromium" 而非 "Google Chrome"，
  // 元宝后端检测到品牌差异 → 400 Bad Request。
  // 若有 executablePath（打包内置 Chrome），优先使用；否则用 channel:'chrome'。
  if (opts.executablePath) {
    return chromium.launch({
      headless: false,
      args: [...CHROME_ARGS],
      executablePath: opts.executablePath,
    })
  }
  return chromium.launch({
    headless: false,
    channel: 'chrome',
    args: [...CHROME_ARGS],
  })
}

async function getOrCreateMainPage(
  browser: Browser,
  opts?: { userAgent?: string; viewport?: { width: number; height: number }; isMobile?: boolean; hasTouch?: boolean },
): Promise<Page> {
  // Playwright: 通过 context 创建页面并在创建时设置 UA / viewport / isMobile / hasTouch。
  // 复用已有 context（如果有），否则新建。
  let context: BrowserContext
  const existingContexts = browser.contexts()
  if (existingContexts.length > 0) {
    context = existingContexts[0]
  } else {
    context = await browser.newContext({
      ...(opts?.userAgent ? { userAgent: opts.userAgent } : {}),
      ...(opts?.viewport ? { viewport: opts.viewport } : {}),
      ...(opts?.isMobile !== undefined ? { isMobile: opts.isMobile } : {}),
      ...(opts?.hasTouch !== undefined ? { hasTouch: opts.hasTouch } : {}),
      permissions: ['clipboard-read', 'clipboard-write'],
    })
  }
  const existingPages = context.pages()
  const page: Page = existingPages.length > 0 ? existingPages[0] : await context.newPage()
  // 对于复用的已有 context（可能未带 permissions 参数创建），显式授予剪贴板权限，
  // 避免 kimi 等平台点击"复制链接"时弹出"www.kimi.com 想要查看剪贴板"权限提示导致拿不到链接。
  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  } catch (err) {
    log.warn('Failed to grant clipboard permissions', { error: String(err) })
  }

  // --- Step 1: 获取真实 Chrome 版本（仅用于日志，不覆盖 UA）---
  //    竞品（auth helper）完全不覆盖 UA — 系统 Chrome 自带正确的 UA 和 sec-ch-ua。
  //    UA 覆盖会导致 navigator.userAgent (Chrome/148.0.0.0) 与请求头 UA (Chrome/148.0.7778.217) 不一致，
  //    这个不一致本身就是风控信号，可能导致 400。
  let chromeMajor = '148'
  let chromeFull = '148.0.7778.217'
  try {
    const version = await browser.version()
    const cleanVersion = version.replace(/^.*?Chrome\//, '').replace(/^Headless/, '').split('.')
    chromeMajor = cleanVersion[0] || '148'
    chromeFull = cleanVersion.join('.')
    log.info('[Step1] Detected real Chrome version (NOT overriding UA)', { reportedVersion: version, chromeMajor, chromeFull })
  } catch (err) {
    log.warn('[Step1] Failed to detect Chrome version', { error: String(err) })
  }

  // --- Step 2: UA 覆盖已跳过 ---
  //    使用 channel:'chrome' 系统Chrome，UA 和 sec-ch-ua 已经是正确的 "Google Chrome" 品牌。
  //    之前的 Network.setUserAgentOverride 覆盖导致请求头 UA 与页面 navigator.userAgent 不一致 → 400。
  log.info('[Step2] UA override SKIPPED (system Chrome UA is correct)')

  // --- Step 3: 请求拦截已移除 ---
  //    使用 channel:'chrome' 启动系统 Chrome 后，不会发送 x-webdriver 等自动化头。
  //    page.route() 拦截会重建请求，破坏 tRPC 网关的请求完整性校验（400 根因）。
  //    竞品（auth helper）也不拦截请求，仅用 stealth init script 隐藏 webdriver 特征。
  log.info('[Step3] Request interception DISABLED (using system Chrome, no header stripping needed)')

  // --- Step 3.5: 响应端诊断 —— 监听 yuanbao /api/chat 的 4xx/5xx ---
  // 注意：分享 API 监听已移至 generateShareLink 中的 page.waitForResponse()，
  //       避免在复用 page 时重复注册 page.on('response') 导致多次回调。
  // 诊断监听用标记位做幂等，page 复用时不会重复注册。
  if (!(page as any).__chatApiResponseListenerInstalled) {
    ;(page as any).__chatApiResponseListenerInstalled = true
  try {
    page.on('response', async (res) => {
      const url = res.url()

      if (!/yuanbao\.tencent\.com\/api\/chat/i.test(url)) return
      const status = res.status()
      const headers = res.headers()
      const shortHeaders = Object.fromEntries(
        Object.entries(headers).filter(([k]) =>
          /^(trpc-|x-|content-type|cache-control|content-encoding|vary)$/i.test(k)
        ).map(([k, v]) => [k, (v || '').length > 80 ? (v || '').slice(0, 80) + '…' : v]),
      )
      let bodyPreview = ''
      if (status >= 400) {
        try {
          const buf = await res.body().catch(() => Buffer.alloc(0))
          bodyPreview = buf.slice(0, 600).toString('utf8').replace(/\0/g, '')
        } catch (_) { bodyPreview = '<streaming, buffer unavailable>' }
      }
      // 400 诊断：输出请求方法和关键请求头，帮助定位是 cookie 缺失还是请求体格式问题
      const req = res.request()
      let reqHeaders: Record<string, string> = {}
      try {
        const allReqHeaders = await req.allHeaders()
        reqHeaders = Object.fromEntries(
          Object.entries(allReqHeaders).filter(([k]) =>
            /^(cookie|authorization|x-|trpc-|content-type|origin|referer)$/i.test(k)
          ).map(([k, v]) => {
            if (k.toLowerCase() === 'cookie') {
              // 只记录 cookie 名称，避免日志过长和泄露
              const names = v.split(';').map((c) => c.trim().split('=')[0]).filter(Boolean)
              return [k, names.join(',')]
            }
            return [k, v.length > 80 ? v.slice(0, 80) + '…' : v]
          }),
        )
      } catch (_) { /* ignore */ }
      // 请求体诊断：确认 agentId/conversationId/prompt 等字段是否正确
      let reqBodyPreview = ''
      try {
        const postData = req.postData()
        if (postData) {
          reqBodyPreview = postData.length > 400 ? postData.slice(0, 400) + '…' : postData
        }
      } catch (_) { /* ignore */ }
      log.info('[Step3.5] Chat API response', {
        status,
        ok: res.ok(),
        method: req.method(),
        url: url.length > 120 ? url.slice(0, 120) + '…' : url,
        shortHeaders,
        requestHeaders: reqHeaders,
        requestBodyPreview: reqBodyPreview,
        bodyLen: bodyPreview.length,
        bodyPreview,
      })
    })
  } catch (e) {
    log.warn('[Step3.5] Chat API response listener install failed', { error: String(e) })
  }
  } // end if (!__chatApiResponseListenerInstalled)

  // --- Step 4: stealth patches 已跳过 ---
  //    使用 channel:'chrome' 系统Chrome + --disable-blink-features=AutomationControlled 已足够隐藏自动化。
  //    stealth init script 中的 navigator.userAgent 等属性覆盖会干扰 Quill/React 内部状态同步，
  //    导致 fill() 写入后被清空或 chat API 400。
  log.info('[Step4] Stealth patches SKIPPED (system Chrome + --disable-blink-features is sufficient)')
  return page
}

// ---------------------------------------------------------------------------
// Cookie / localStorage injection (copied from AuthService, no Electron deps)
// ---------------------------------------------------------------------------

type Platform = ReturnType<typeof requirePlatform>

function prepareAuthCookies(raw: string, platform: Platform, cookieSiteUrl: string): Cookie[] {
  if (platform.buildCookies) return platform.buildCookies(raw) as Cookie[]
  const cookies = deserializeSessionCookies(raw, cookieSiteUrl, platform.cookieDomain) as Cookie[]
  // Diagnostic: log cookie attributes to verify SameSite/Secure normalization
  log.info('Prepared auth cookies', {
    count: cookies.length,
    cookieSiteUrl,
    cookieDomain: platform.cookieDomain,
    summary: cookies.map((c) => ({
      name: c.name,
      domain: c.domain || '(url)',
      path: c.path || '/',
      sameSite: c.sameSite,
      secure: c.secure,
      hasExpires: c.expires !== undefined && c.expires > 0,
    })),
  })
  return cookies
}

async function applySessionCookies(page: Page, cookies: Cookie[]) {
  // Playwright: 没有 page.setCookie()，统一用 context.addCookies() 一次性注入。
  // 注意 Playwright 的 Cookie 类型与 Puppeteer 的 CookieParam 字段名兼容，
  // 但 sameSite 只接受 'Strict' | 'Lax' | 'None'，且 url/domain+path 二选一。
  try {
    await page.context().addCookies(cookies)
    log.info('Session cookies injected', { count: cookies.length })
  } catch (err) {
    // 兜底：逐条添加，跳过被拒的 cookie
    log.warn('Batch addCookies failed, falling back to per-cookie', { error: String(err) })
    for (const cookie of cookies) {
      try {
        await page.context().addCookies([cookie])
      } catch (err) {
        log.warn('Skip rejected cookie', { name: cookie.name, domain: cookie.domain, sameSite: cookie.sameSite, secure: cookie.secure, error: String(err) })
      }
    }
  }
}

async function restoreLocalStorage(page: Page, entries: Record<string, string>) {
  const keys = Object.keys(entries)
  if (keys.length === 0) return
  await page.evaluate((data) => {
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, value)
    }
  }, entries)
  log.info('Restored localStorage keys', { keys })
}

async function preloadLocalStorage(page: Page, siteUrl: string, entries: Record<string, string>) {
  const keys = Object.keys(entries)
  if (keys.length === 0) return
  const targetOrigin = new URL(siteUrl).origin
  // Playwright: 没有 page.evaluateOnNewDocument，用 page.addInitScript(fn, arg) 替代。
  // addInitScript 的函数会被序列化注入到每个新文档加载前执行，arg 作为唯一参数。
  await page.addInitScript(
    (payload: { origin: string; data: Record<string, string> }) => {
      if (location.origin !== payload.origin) return
      for (const [key, value] of Object.entries(payload.data)) {
        try { localStorage.setItem(key, value) } catch (_) { /* ignore quota / security errors */ }
      }
    },
    { origin: targetOrigin, data: entries },
  )
  log.info('Preloaded localStorage keys', { targetOrigin, keys })
}

// ---------------------------------------------------------------------------
// GEO job helpers (copied from GeoJobService, adapted for worker context)
// ---------------------------------------------------------------------------

type ExecutionContext = Page | Frame

function isDetachedFrameError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  // 包含 "Target page, context or browser has been closed"（页面/上下文被关闭，例如用户手动关闭页面）
  return /detached Frame|Frame.*detached|Target closed|Target page, context or browser has been closed|Session closed|Execution context was destroyed|Cannot find context/i.test(msg)
}

/**
 * 检测 ExecutionContext（Page 或 Frame）是否已关闭。
 * 只检测 Page.isClosed()——用户手动关闭页面/Tab 时立即返回 true，
 * 让上层任务循环能尽快执行下一个任务。
 *
 * 不检测 Frame.isDetached()：SPA 路由切换/重渲染时 iframe 会被短暂移除
 * 然后 reattach，isDetached() 会误判为"已关闭"导致 stable wait 提前退出、
 * 回答截断。Frame 的 detach 由 stable 循环的 3-strike 重试机制
 * （consecutiveDetachedErrors >= 3 才抛错）处理，给 reattach 留出时间。
 */
function isCtxClosed(ctx: ExecutionContext): boolean {
  // 只对 Page 检测 isClosed()，Frame 不检测（避免 SPA iframe 重建时误判）
  const ctxAny = ctx as unknown as { isClosed?: () => boolean }
  if (typeof ctxAny.isClosed === 'function') return ctxAny.isClosed()
  return false
}

let EVIDENCE_DIR = path.join(process.cwd(), 'geo-evidence')

function ensureEvidenceDir() {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  }
}

async function saveScreenshot(page: Page, prefix: string): Promise<string | undefined> {
  try {
    const filePath = path.join(EVIDENCE_DIR, `${prefix}-${Date.now()}.png`)
    await page.screenshot({ path: filePath, fullPage: true })
    log.info('GEO screenshot saved', { filePath })
    return filePath
  } catch (err) {
    log.warn('Failed to save GEO screenshot', { error: String(err) })
    return undefined
  }
}

function domainFromUrl(url: string): string {
  try { return new URL(url).hostname } catch { return '' }
}

// stripUrlFragment 剥离 URL 的 fragment（# 后面所有内容）。
// 主要是过滤 #:~:text= 等 Scroll-to-Text Fragment，这些 fragment 是浏览器
// "复制链接到高亮"自动生成的，包含大量 URL 编码中文，对引用来源识别没有价值。
// 剥离后 URL 既短又保留核心的 origin+pathname+search 部分。
function stripUrlFragment(url: string): string {
  const hashIndex = url.indexOf('#')
  if (hashIndex < 0) return url
  return url.slice(0, hashIndex)
}

async function findElement(page: Page, selectors: SelectorChain, timeoutMs = 5_000) {
  const promises = selectors.map(async (selector) => {
    // Playwright: waitForSelector 用 state:'visible' 代替 Puppeteer 的 visible:true。
    // 超时会抛异常（不会返回 null），用 try/catch 转换为 reject 让 Promise.any 忽略。
    const el = await page.waitForSelector(selector, { timeout: timeoutMs, state: 'visible' })
    if (!el) throw new Error(`selector matched but element is null: ${selector}`)
    return { el, selector }
  })
  try { return await Promise.any(promises) } catch { return undefined }
}

async function findElementInCtx(ctx: ExecutionContext, selectors: SelectorChain, timeoutMs = 5_000) {
  const promises = selectors.map(async (selector) => {
    const el = await ctx.waitForSelector(selector, { timeout: timeoutMs, state: 'visible' })
    if (!el) throw new Error(`selector matched but element is null: ${selector}`)
    return { el, selector }
  })
  try { return await Promise.any(promises) } catch { return undefined }
}

async function getAnswerContext(page: Page, driver: ModelPlatformGeoDriver): Promise<{
  ctx: ExecutionContext
  isIframe: boolean
}> {
  const iframeSelectors = driver.selectors.answerIframe
  if (iframeSelectors && iframeSelectors.length > 0) {
    for (const selector of iframeSelectors) {
      try {
        const el = await page.waitForSelector(selector, { timeout: 5_000, state: 'visible' })
        if (el) {
          const frame = await el.contentFrame()
          if (frame) {
            await frame.waitForSelector('body', { timeout: 5_000 }).catch(() => {})
            return { ctx: frame, isIframe: true }
          }
        }
      } catch { /* continue */ }
    }
  }
  return { ctx: page, isIframe: false }
}

// ---------------------------------------------------------------------------
// Input step execution
// ---------------------------------------------------------------------------

async function startNewConversation(page: Page, driver: ModelPlatformGeoDriver) {
  const strategy = driver.newConversationStrategy
  if (!strategy) return
  if (strategy.kind === 'url-param') {
    const url = new URL(page.url())
    url.searchParams.set(strategy.param, strategy.value)
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
    const inputReady = await findElement(page, driver.selectors.input, 5_000)
    if (!inputReady) {
      await page.waitForLoadState('networkidle', { timeout: 2_000 }).catch(() => {})
    }
    return
  }
  const found = await findElement(page, strategy.selector, 3_000)
  if (found) {
    await found.el.click().catch(() => {})
    await findElement(page, driver.selectors.input, 2_000)
  }
}

async function executeInputStep(page: Page, driver: ModelPlatformGeoDriver, step: InputStep, question: string) {
  const desc = step.description ?? step.kind
  try {
    switch (step.kind) {
      case 'dismiss-popup': {
        const popupTimeoutMs = step.timeoutMs ?? 6_000
        const popupStart = Date.now()
        let found: { el: ElementHandle<Element>; selector: string } | undefined
        while (Date.now() - popupStart < popupTimeoutMs) {
          found = await findElement(page, step.selector, 1_000)
          if (found) break
          await new Promise((r) => setTimeout(r, 300))
        }
        if (found) {
          await found.el.click().catch(() => {})
          log.info('Dismissed popup', { driver: driver.id, desc, selector: found.selector })
          await new Promise((r) => setTimeout(r, 800))
        } else {
          log.info('No popup to dismiss', { driver: driver.id, desc })
        }
        break
      }
      case 'wait-url': {
        const timeoutMs = step.timeoutMs ?? 10_000
        const pattern = step.urlPattern
        const regexStr = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
        const regex = new RegExp(regexStr)
        const start = Date.now()
        let matched = false
        while (Date.now() - start < timeoutMs) {
          if (regex.test(page.url())) { matched = true; break }
          await new Promise((r) => setTimeout(r, 500))
        }
        if (matched) {
          log.info('URL pattern matched', { driver: driver.id, desc, pattern, url: page.url() })
        } else {
          throw new Error(`URL pattern not matched: ${pattern} (current: ${page.url()})`)
        }
        break
      }
      case 'wait-selector': {
        const timeoutMs = step.timeoutMs ?? 10_000
        const waitExist = step.isExist !== 0
        const start = Date.now()
        let found = false
        while (Date.now() - start < timeoutMs) {
          const el = await findElement(page, step.selector, 1_000)
          if (waitExist && el) { found = true; break }
          if (!waitExist && !el) { found = true; break }
          await new Promise((r) => setTimeout(r, 500))
        }
        if (found) {
          log.info('wait-selector satisfied', { driver: driver.id, desc, waitExist })
        } else {
          throw new Error(`wait-selector timed out: ${desc}`)
        }
        break
      }
      case 'click-toggle': {
        const found = await findElement(page, step.selector, 2_000)
        if (!found) throw new Error(`Toggle element not found: ${desc}`)
        if (step.activeClass) {
          const isActive = await found.el.evaluate((el, cls) => el.classList.contains(cls), step.activeClass)
          if (isActive) { log.info('Toggle already active, skip', { driver: driver.id, desc }); break }
        }
        await found.el.click().catch(() => {})
        log.info('Clicked toggle', { driver: driver.id, desc, selector: found.selector })
        await new Promise((r) => setTimeout(r, 300))
        break
      }
      case 'click': {
        const found = await findElement(page, step.selector, 2_000)
        if (found) {
          await found.el.click().catch(() => {})
          log.info('Clicked element', { driver: driver.id, desc, selector: found.selector })
          await new Promise((r) => setTimeout(r, 300))
        } else {
          throw new Error(`Click element not found: ${desc}`)
        }
        break
      }
      case 'fill': {
        const selector = step.selector || driver.selectors.input
        // 使用 Playwright locator API。
        // 对 contenteditable (Quill)：先 click 聚焦，再用 type() 逐字输入（触发 Quill 的 keydown/input 事件链）。
        // fill() 对 contenteditable 用 execCommand('insertText')，不总是触发 Quill 内部 state 更新。
        log.info('[Fill] Using Playwright locator.type()', { driver: driver.id, desc, selector, questionLen: question.length })

        let fillSuccess = false
        for (const sel of selector) {
          try {
            const locator = page.locator(sel).first()
            // 先点击聚焦编辑器
            await locator.click({ timeout: 5_000 })
            await new Promise((r) => setTimeout(r, 200))
            // 清空已有内容（Ctrl+A → Delete）
            await page.keyboard.press('Control+a')
            await page.keyboard.press('Delete')
            await new Promise((r) => setTimeout(r, 100))
            // 逐字输入 — 每个字符触发 keydown/keypress/input/keyup，Quill 原生兼容
            await locator.type(question, { timeout: 15_000, delay: 30 })
            log.info('[Fill] locator.type() succeeded', { driver: driver.id, desc, selector: sel })
            fillSuccess = true
            break
          } catch (err) {
            log.warn('[Fill] locator.type() failed for selector', { driver: driver.id, sel, error: String(err).slice(0, 120) })
          }
        }
        if (!fillSuccess) {
          log.error('[Fill] All selectors failed', { driver: driver.id, selectorCount: selector.length })
          throw new Error(`Fill failed for all ${selector.length} selectors (${desc})`)
        }

        // 验证输入
        await new Promise((r) => setTimeout(r, 300))
        const checkResult = await wrapEval(
          page.evaluate(() => {
            const ced = document.querySelector<HTMLElement>('.ql-editor') ||
                        document.querySelector<HTMLElement>('[contenteditable="true"]') ||
                        document.querySelector<HTMLTextAreaElement>('textarea') ||
                        document.querySelector<HTMLInputElement>('input')
            if (!ced) return { len: -1, head: '' }
            const cur = ced.tagName === 'TEXTAREA' || ced.tagName === 'INPUT'
              ? (ced as HTMLInputElement).value ?? ''
              : ced.textContent ?? ced.innerText ?? ''
            return { len: cur.trim().length, head: cur.trim().slice(0, 24) }
          }),
          'fill-check',
        )
        log.info('[Fill] Post-fill check', {
          driver: driver.id, desc, len: checkResult?.len ?? -1, head: checkResult?.head ?? '',
        })
        break
      }

      case 'press-key': {
        // Playwright: keyboard.press 接受 string 类型的 key（如 'Enter'、'Escape'），无需 KeyInput 类型。
        await page.keyboard.press(step.key)
        log.info('Pressed key', { driver: driver.id, desc, key: step.key })
        break
      }
      case 'click-submit': {
        const selector = step.selector || driver.selectors.submit
        const found = await findElement(page, selector, 5_000)
        let clicked = false
        log.info('[Submit] click-submit phase ENTER', { driver: driver.id, selector, found: !!found })
        if (found) {
          // --- 等待 1：给 React/Vue 受控 state 同步留时间（x-bus-params-md5 是基于 state 算的，必须等它同步完）
          await new Promise((r) => setTimeout(r, 800 + Math.random() * 1000))

          // --- 等待 2：等待按钮从 disabled 变可用，同时监控输入框有没有"失焦被清空"
          const enableCheckMs = 250
          const maxEnableWaitMs = 6_000
          let disabled = true
          let finalDisabledCheck = false
          let reinjectCount = 0
          const loopT0 = Date.now()
          log.info('[Submit] enable-wait-loop ENTER', { driver: driver.id, maxMs: maxEnableWaitMs, tickMs: enableCheckMs })
          for (let waited = 0; waited < maxEnableWaitMs && disabled; waited += enableCheckMs) {
            const tickStart = Date.now()
            // --- L1658 disabled check evaluate（包 wrapEval 防止卡死）
            const chkRaw = await wrapEval(
              found.el.evaluate((el) => {
                const node = el as HTMLElement
                let dis = false
                if ('disabled' in node && (node as HTMLButtonElement).disabled) dis = true
                if (node.getAttribute('aria-disabled') === 'true') dis = true
                if (node.getAttribute('data-disabled') === 'true') dis = true
                if (typeof node.className === 'string' && /disabled/i.test(node.className)) dis = true
                const ced = document.querySelector<HTMLElement>('[contenteditable="true"]')
                const stillHasText = ced ? (ced.textContent || '').trim().length > 0 : true
                return { disabled: dis, stillHasText }
              }),
              `submit-chkDisabled-${driver.id}-${waited}ms`,
            )
            const chk = chkRaw ?? { disabled: true, stillHasText: true }
            disabled = chk.disabled
            finalDisabledCheck = disabled
            log.info('[Submit] enable-wait-loop tick', {
              driver: driver.id, waitedMs: waited, disabled: chk.disabled,
              stillHasText: chk.stillHasText, reinjectCount, tickCostMs: Date.now() - tickStart,
            })

            if (!chk.stillHasText && reinjectCount < 2) {
              reinjectCount++
              // LIGHT FALLBACK re-inject（主卡死点！必须 wrapEval + 内部 hooks 扫描全局扩展）
              const reinjectT0 = Date.now()
              log.warn('[Submit] Input cleared itself — running LIGHT FALLBACK re-inject START', {
                driver: driver.id, reinjectCount, waitedMs: waited,
              })
              try {
                const reinjectRes = await wrapEval(
                  page.evaluate((q) => {
                    const text = String(q || '')
                    if (!text) return { finalLen: 0, reason: 'no-question' }
                    const ced = document.querySelector<HTMLElement>('[contenteditable="true"]')
                    if (!ced) return { finalLen: 0, reason: 'no-ced' }
                    const root = ced
                    const evOpts = { bubbles: true, cancelable: true, composed: true }

                    // 1) Hooks 扫描升级：祖先链 + 全局根节点（和 Fill 阶段同步）
                    try {
                      const FP = /^(__reactFiber|__reactInternalInstance|__reactInternal|_reactInternals)/
                      const pick = (nd: unknown): string | null => {
                        if (!nd || typeof nd !== 'object') return null
                        try { const ns = Object.getOwnPropertyNames(nd as Record<string, unknown>); for (const k of ns) if (FP.test(k)) return k } catch (_) {}
                        return null
                      }
                      let writes = 0
                      const startQueue: HTMLElement[] = []
                      const seen = new WeakSet<object>()
                      const enqueue = (el: HTMLElement | null) => {
                        if (!el || seen.has(el)) return
                        seen.add(el); startQueue.push(el)
                      }
                      let n: HTMLElement | null = root
                      for (let d = 0; d < 30 && n; d++, n = n.parentElement) enqueue(n)
                      try {
                        ;[
                          document.body,
                          document.documentElement as unknown as HTMLElement,
                          document.getElementById('root'),
                          document.getElementById('__next'),
                          document.getElementById('app'),
                          document.getElementById('chat-app'),
                          document.getElementById('__layout'),
                          document.getElementById('layout'),
                          document.getElementById('app-container'),
                          document.getElementById('yb-root'),
                          document.querySelector<HTMLElement>('[data-reactroot]'),
                          document.querySelector<HTMLElement>('.yb-app'),
                          document.querySelector<HTMLElement>('.yb-main'),
                          document.querySelector<HTMLElement>('.yb-chat-main'),
                          document.querySelector<HTMLElement>('.chat-container'),
                          document.querySelector<HTMLElement>('.chat-main'),
                          document.querySelector<HTMLElement>('.main-container'),
                        ].forEach(g => enqueue(g))
                        // body 子节点 BFS 初筛（前60个）
                        try {
                          const FP3 = /^(__reactFiber|__reactInternalInstance|__reactInternal|_reactInternals)/
                          const children = Array.from(document.body?.children ?? [])
                          for (let ci = 0; ci < Math.min(children.length, 60); ci++) {
                            const c = children[ci] as HTMLElement
                            try {
                              const cn = Object.getOwnPropertyNames(c as unknown as Record<string, unknown>)
                              if (cn.some(k => FP3.test(k))) enqueue(c)
                            } catch (_) {}
                          }
                        } catch (_) {}
                      } catch (_) {}
                      startLoop: for (let qi = 0; qi < startQueue.length; qi++) {
                        const sn = startQueue[qi]
                        const rk = pick(sn)
                        if (!rk) continue
                        const fib = (sn as unknown as Record<string, unknown>)[rk] as any
                        if (!fib || typeof fib !== 'object') continue
                        let f: any = fib
                        for (let i = 0; i < 40 && f; i++, f = f.return) {
                          const ms: any = f.memoizedState
                          if (!ms || typeof ms !== 'object') continue
                          let h: any = ms
                          for (let hi = 0; hi < 50 && h; hi++, h = h.next) {
                            const qq = h.queue
                            if (qq && typeof qq === 'object' && typeof qq.dispatch === 'function' && typeof h.memoizedState === 'string') {
                              const s = h.memoizedState as string
                              if (s === '' || (s.length > 0 && s.length < 5000 && !/^\{.*\}$/.test(s.trim()))) {
                                try { qq.dispatch(text); writes++ } catch (_) { /* ignore */ }
                              }
                            }
                            if (!qq && h.memoizedState && typeof h.memoizedState === 'object' && 'current' in h.memoizedState) {
                              const cur = (h.memoizedState as { current: unknown }).current
                              if (typeof cur === 'string' && (cur === '' || cur.length < 5000)) {
                                try { (h.memoizedState as { current: unknown }).current = text; writes++ } catch (_) { /* ignore */ }
                              }
                            }
                          }
                          if (writes > 0) break startLoop
                        }
                        if (writes > 0) break
                      }
                    } catch (_) { /* ignore */ }

                    // 2) DOM 强制写入
                    root.classList.remove('ql-blank')
                    try {
                      const temp = document.createElement('div')
                      temp.innerHTML = `<p>${text.split('').map(c => `<span data-text="true">${c}</span>`).join('')}</p>`
                      root.innerHTML = ''
                      while (temp.firstChild) root.appendChild(temp.firstChild)
                    } catch (_) { root.textContent = text }

                    // 3) 完整事件链（focus → composition → input/change）
                    root.dispatchEvent(new FocusEvent('focusin', evOpts))
                    root.dispatchEvent(new FocusEvent('focus', evOpts))
                    root.dispatchEvent(new CompositionEvent('compositionstart', { ...evOpts, data: '' }))
                    for (let i = 1; i <= Math.min(text.length, 32); i++)
                      root.dispatchEvent(new CompositionEvent('compositionupdate', { ...evOpts, data: text.slice(0, i) }))
                    root.dispatchEvent(new CompositionEvent('compositionend', { ...evOpts, data: text }))
                    root.dispatchEvent(new InputEvent('beforeinput', { ...evOpts, inputType: 'insertCompositionText', data: text }))
                    root.dispatchEvent(new InputEvent('input', { ...evOpts, inputType: 'insertCompositionText', data: text, isComposing: false }))
                    root.dispatchEvent(new Event('change', evOpts))
                    root.dispatchEvent(new InputEvent('input', { ...evOpts, inputType: 'insertText', data: text }))

                    // 4) sticky getter（只劫持 root 节点原型，降低副作用）
                    try {
                      const wk: WeakMap<object, string> =
                        (window as any).__stickyWriteMap = (window as any).__stickyWriteMap || new WeakMap()
                      const stickyText = text
                      const stickyHtml = `<p>${stickyText.split('').map(c => `<span data-text="true">${c}</span>`).join('')}</p>`
                      const tGet = function (this: HTMLElement): string {
                        if (this === root) return stickyText
                        const v = wk.get(this); if (v !== undefined) return v
                        try { const s = document.createElement('span'); s.appendChild(this.cloneNode(true)); return s.innerText ?? '' } catch { return '' }
                      }
                      const hGet = function (this: HTMLElement): string {
                        if (this === root) return stickyHtml
                        const v = wk.get(this); if (v !== undefined) return v
                        try { return new XMLSerializer().serializeToString(this) } catch { return '' }
                      }
                      for (const proto of [Object.getPrototypeOf(root), HTMLElement.prototype]) {
                        for (const [prop, fn] of [['textContent', tGet], ['innerText', tGet], ['innerHTML', hGet]] as const) {
                          try {
                            const desc = Object.getOwnPropertyDescriptor(proto, prop)
                            if (desc && desc.configurable === false) continue
                            Object.defineProperty(proto, prop, {
                              configurable: true,
                              enumerable: desc?.enumerable ?? true,
                              get: fn as () => string,
                              set: function (this: HTMLElement, v: string) { wk.set(this, v) },
                            })
                          } catch (_) { /* ignore */ }
                        }
                      }
                    } catch (_) { /* ignore */ }

                    // 5) 同步下发送按钮 disabled（如果有内容就剥掉）
                    try {
                      const btns = document.querySelectorAll<HTMLElement>('button, [role="button"]')
                      btns.forEach(b => {
                        b.removeAttribute('disabled')
                        b.removeAttribute('aria-disabled')
                        b.removeAttribute('data-disabled')
                        if (typeof (b as any).disabled === 'boolean') (b as any).disabled = false
                        b.className = (b.className || '').replace(/disabled|is-disabled|isDisabled/gi, '')
                      })
                    } catch (_) { /* ignore */ }

                    return { finalLen: ((root.textContent ?? root.innerText ?? '') as string).trim().length }
                  }, question),
                  `submit-reinject-${driver.id}-#${reinjectCount}`,
                  6000,  // 补写本身复杂，给 6s 上限
                )
                log.warn('[Submit] Input cleared itself during wait — LIGHT FALLBACK RE-INJECTED on page END', {
                  driver: driver.id, finalLen: reinjectRes?.finalLen ?? -1, reason: reinjectRes?.reason ?? 'wrapEval-null', costMs: Date.now() - reinjectT0,
                })
              } catch (outerErr) {
                log.warn('[Submit] Input cleared itself during wait (re-inject setup failed) END', {
                  driver: driver.id, error: String(outerErr), costMs: Date.now() - reinjectT0,
                })
              }
            } else if (!chk.stillHasText && reinjectCount >= 2) {
              log.warn('[Submit] Input still empty but reinject limit reached (2/2), skipping to avoid timeout', {
                driver: driver.id, reinjectCount,
              })
            }
            if (disabled) await new Promise((r) => setTimeout(r, enableCheckMs))
          }
          log.info('[Submit] enable-wait-loop EXIT', {
            driver: driver.id, disabled, finalDisabledCheck, reinjectCount, totalCostMs: Date.now() - loopT0,
          })

          // --- 如果按钮还是 disabled，先确认输入框是不是真的有文字
          if (finalDisabledCheck) {
            const hasInputText = (await wrapEval(
              found.el.evaluate(() => {
                const ced = document.querySelector<HTMLElement>('[contenteditable="true"]')
                const ta = document.querySelector<HTMLTextAreaElement>('textarea')
                const inp = document.querySelector<HTMLInputElement>('input[type="text"], input:not([type])')
                const t1 = ced ? (ced.textContent || '').trim() : ''
                const t2 = ta ? (ta.value || '').trim() : ''
                const t3 = inp ? (inp.value || '').trim() : ''
                return { cedLen: t1.length, taLen: t2.length, inpLen: t3.length, anyText: (t1 || t2 || t3).length > 0 }
              }),
              `submit-hasText-${driver.id}`,
            )) ?? { cedLen: 0, taLen: 0, inpLen: 0, anyText: false }
            log.info('Submit button is disabled after waiting', {
              driver: driver.id, selector: found.selector,
              hasText: hasInputText.anyText, cedLen: hasInputText.cedLen, taLen: hasInputText.taLen, inpLen: hasInputText.inpLen,
            })
            if (hasInputText.anyText) {
              log.info('[Submit] Input has text but button disabled - forcing disabled removal + extra sync', { driver: driver.id })
              await wrapEval(
                found.el.evaluate(() => {
                  const ced = document.querySelector<HTMLElement>('[contenteditable="true"]')
                  if (ced) {
                    const evOpts = { bubbles: true, cancelable: true, composed: true }
                    ced.dispatchEvent(new CompositionEvent('compositionend', { ...evOpts, data: (ced.textContent || '').trim() }))
                    ced.dispatchEvent(new InputEvent('input', { ...evOpts, inputType: 'insertText', data: (ced.textContent || '').trim(), isComposing: false }))
                    ced.dispatchEvent(new Event('change', evOpts))
                    ced.dispatchEvent(new Event('blur', evOpts))
                  }
                  const btns = document.querySelectorAll<HTMLElement>('button, [role="button"]')
                  btns.forEach(b => {
                    b.removeAttribute('disabled')
                    b.removeAttribute('aria-disabled')
                    b.removeAttribute('data-disabled')
                    if (typeof (b as any).disabled === 'boolean') (b as any).disabled = false
                    b.className = (b.className || '').replace(/disabled|is-disabled|isDisabled/gi, '')
                  })
                }),
                `submit-forceEnable-${driver.id}`,
              )
              await new Promise((r) => setTimeout(r, 500 + Math.random() * 500))
              disabled = false
            }
          }

          if (!disabled || (finalDisabledCheck && !clicked)) {
            // --- 真实 CDP 鼠标点击按钮（保持不变）
            try {
              const box = await found.el.boundingBox()
              if (box && box.width > 0 && box.height > 0) {
                const cx = box.x + box.width / 2 + (Math.random() - 0.5) * Math.max(0, box.width * 0.3)
                const cy = box.y + box.height / 2 + (Math.random() - 0.5) * Math.max(0, box.height * 0.3)
                await page.mouse.move(cx, cy, { steps: 4 + Math.floor(Math.random() * 4) })
                await new Promise((r) => setTimeout(r, 40 + Math.random() * 50))
                await page.mouse.down({ button: 'left' })
                await new Promise((r) => setTimeout(r, 20 + Math.random() * 30))
                await page.mouse.up({ button: 'left' })
              } else {
                await found.el.click().catch(() => {})
              }
              clicked = true
              log.info('Clicked submit', { driver: driver.id, selector: found.selector, forced: finalDisabledCheck })
            } catch (e) {
              await found.el.click().catch(() => {})
              clicked = true
              log.info('Clicked submit (fallback click)', { driver: driver.id, selector: found.selector, forced: finalDisabledCheck, error: String(e) })
            }
          }
        }
        // --- Enter fallback：只在"真的有输入文字"时才允许
        if (!clicked && step.fallbackEnter) {
          const hasText = (await wrapEval(
            page.evaluate(() => {
              const ced = document.querySelector<HTMLElement>('[contenteditable="true"]')
              const ta = document.querySelector<HTMLTextAreaElement>('textarea')
              const inp = document.querySelector<HTMLInputElement>('input[type="text"], input:not([type])')
              const t1 = ced ? (ced.textContent || '').trim() : ''
              const t2 = ta ? (ta.value || '').trim() : ''
              const t3 = inp ? (inp.value || '').trim() : ''
              return (t1 || t2 || t3).length > 0
            }),
            `submit-enter-hasText-${driver.id}`,
          )) ?? false
          if (hasText) {
            await page.keyboard.press('Enter')
            log.info('Submitted with Enter fallback', { driver: driver.id })
            clicked = true
          } else {
            log.error('[Submit] Enter fallback blocked - NO text in any input (would cause 400 empty request)', { driver: driver.id })
          }
        }
        if (!clicked) {
          throw new Error(`Cannot submit question for ${driver.id} - submit button disabled AND no input text to force-submit`)
        }
        log.info('[Submit] click-submit phase EXIT', { driver: driver.id, clicked })
        break
      }
    }
  } catch (err) {
    const optional = (step as InputStep & { optional?: boolean }).optional ?? false
    if (optional) {
      log.warn('Step failed (optional, continuing)', { driver: driver.id, desc, error: String(err) })
    } else {
      throw err
    }
  }
}

async function executeInputSteps(page: Page, driver: ModelPlatformGeoDriver, question: string) {
  const steps = driver.inputSteps
  if (!steps || steps.length === 0) throw new Error(`No inputSteps configured for ${driver.id}`)

  const maxAttempts = (driver.inputRetryCount ?? 0) + 1
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        log.info('Retrying input steps', { driver: driver.id, attempt, maxAttempts })
        await new Promise((r) => setTimeout(r, 1_000))
      }
      for (const step of steps) {
        await executeInputStep(page, driver, step, question)
      }
      return
    } catch (err) {
      lastError = err
      log.warn('Input steps attempt failed', { driver: driver.id, attempt, maxAttempts, error: String(err) })
      if (attempt === maxAttempts) {
        try {
          const diag = await wrapEval(
            page.evaluate(() => {
            const info: { textareas: string[]; contentEditables: string[]; inputAreas: string[]; buttons: string[] } = {
              textareas: [], contentEditables: [], inputAreas: [], buttons: [],
            }
            document.querySelectorAll('textarea').forEach((el) => {
              info.textareas.push(`placeholder="${el.getAttribute('placeholder') || ''}" id="${el.id}" class="${el.className.substring(0, 80)}"`)
            })
            document.querySelectorAll('[contenteditable="true"]').forEach((el) => {
              info.contentEditables.push(`tag=${el.tagName.toLowerCase()} class="${el.className.substring(0, 80)}"`)
            })
            document.querySelectorAll('[class*="input"], [class*="chat-input"], [class*="message-input"], [class*="enter-icon"]').forEach((el, i) => {
              if (i < 10) info.inputAreas.push(`tag=${el.tagName.toLowerCase()} class="${el.className.substring(0, 80)}" placeholder="${el.getAttribute('placeholder') || ''}"`)
            })
            document.querySelectorAll('button, [role="button"]').forEach((el, i) => {
              if (i < 10) info.buttons.push(`tag=${el.tagName.toLowerCase()} class="${el.className.substring(0, 60)}" text="${(el.textContent || '').trim().substring(0, 20)}" aria-label="${el.getAttribute('aria-label') || ''}"`)
            })
            return info
          }),
            `input-diag-${driver.id}`,
          ) ?? null
          if (diag) {
            log.warn('Input diagnostic', { driver: driver.id, textareas: diag.textareas, contentEditables: diag.contentEditables, inputAreas: diag.inputAreas, buttons: diag.buttons })
          }
          const htmlPath = path.join(EVIDENCE_DIR, `geo-${driver.id}-input-failed-${Date.now()}.html`)
          const fullHtml = (await wrapEval(
            page.evaluate(() => document.body.outerHTML),
            `input-domSnapshot-${driver.id}`,
          )) ?? ''
          fs.writeFileSync(htmlPath, `<html><head><meta charset="utf-8"></head><body>${fullHtml}</body></html>`)
          log.warn('Input failed DOM snapshot saved', { driver: driver.id, path: htmlPath })
        } catch (diagErr) {
          log.debug('Failed to save diagnostic', { driver: driver.id, error: String(diagErr) })
        }
      }
      if (attempt < maxAttempts) {
        await page.waitForLoadState('networkidle', { timeout: 2_000 }).catch(() => {})
      }
    }
  }
  throw lastError
}

// ---------------------------------------------------------------------------
// Answer waiting & extraction
// ---------------------------------------------------------------------------

// 验证码检测：覆盖豆包/字节系/通用图形验证码、滑块、人机校验等场景。
// 检测到验证码时，waitForAnswerStable 会暂停等待人工干预，避免误判为"回答完成"。
const CAPTCHA_SELECTORS: string[] = [
  // 豆包/字节系（验证码弹窗、图片验证）
  '[class*="verify"]',
  '[class*="captcha"]',
  '[id*="captcha"]',
  '[class*="Captcha"]',
  '[class*="Verify"]',
  // 通用图形验证码、滑块
  '.captcha-container',
  '.captcha-img',
  'img[src*="captcha"]',
  'img[src*="verify"]',
  '[class*="slider"]',
  '[class*="sliderVerify"]',
  '[class*="nc_wrapper"]', // 阿里 NoCaptcha
  // 通用语义提示（旋转/点选/滑块文案）
  '[class*="captcha"] [class*="title"]',
  '[class*="captcha"] [class*="tip"]',
]

const CAPTCHA_TEXT_PATTERNS: RegExp[] = [
  /请完成验证/,
  /完成验证/,
  /安全验证/,
  /拖动滑块/,
  /点击验证/,
  /图形验证/,
  /人机验证/,
  /请按顺序点击/,
  /拖动.*完成拼图/,
]

async function detectCaptcha(ctx: ExecutionContext): Promise<{ detected: boolean; unreachable?: boolean; reason?: string }> {
  // 用 $$/isVisible 替代 waitForSelector，避免在每次轮询时阻塞等待。
  // 验证码容器通常是 display:block + position:fixed + 高 z-index 的可见元素。
  // Page 和 Frame 都有 $$ 和 evaluate 方法，但 TypeScript 类型签名不同，需用 as 断言。
  const ctxAny = ctx as unknown as { $$: (s: string) => Promise<Array<{ isVisible: () => Promise<boolean>; dispose: () => Promise<void> }>> }
  try {
    for (const selector of CAPTCHA_SELECTORS) {
      // $$ 在页面关闭时会抛 "Target page has been closed" 错误，
      // 用 isDetachedFrameError 检测后向上传播，标记为 unreachable，
      // 区分"无验证码"与"无法访问"，避免误报。
      const els = await ctxAny.$$(selector).catch((e: unknown) => {
        if (isDetachedFrameError(e)) throw e
        return [] as Array<{ isVisible: () => Promise<boolean>; dispose: () => Promise<void> }>
      })
      for (const el of els) {
        const visible = await el.isVisible().catch(() => false)
        if (visible) {
          await el.dispose().catch(() => {})
          return { detected: true, reason: `selector:${selector}` }
        }
        await el.dispose().catch(() => {})
      }
    }
  } catch (e) {
    // 页面关闭/Frame detach 类错误：标记为 unreachable，不再当作"无验证码"
    if (isDetachedFrameError(e)) {
      return { detected: false, unreachable: true, reason: 'ctx-closed' }
    }
    // 其他错误（选择器语法等）忽略，继续
  }
  try {
    const matched = await ctx.evaluate((patterns: string[]) => {
      const text = document.body?.innerText || ''
      const regexes = patterns.map((p) => new RegExp(p))
      return regexes.some((r) => r.test(text))
    }, CAPTCHA_TEXT_PATTERNS.map((r) => r.source))
    if (matched) {
      return { detected: true, reason: 'text-pattern' }
    }
  } catch (e) {
    // 页面关闭类错误：标记为 unreachable
    if (isDetachedFrameError(e)) {
      return { detected: false, unreachable: true, reason: 'ctx-closed' }
    }
    // 其他错误（evaluate 超时等）忽略，当作无验证码
  }
  return { detected: false }
}

// 验证码出现后的人工干预等待窗口：检测到验证码时，暂停回答等待逻辑，
// 轮询验证码是否消失。超时后放弃等待，让上层逻辑处理（通常会导致回答为空 → 任务失败）。
// 等待时长设为 30 秒：要么用户在 30 秒内完成滑动验证码，要么手动关闭页面后执行下一个任务。
const CAPTCHA_WAIT_TIMEOUT_MS = 30 * 1000 // 30 秒
const CAPTCHA_POLL_INTERVAL_MS = 3_000

async function waitForCaptchaResolved(ctx: ExecutionContext, driver: ModelPlatformGeoDriver): Promise<boolean> {
  const start = Date.now()
  log.warn('Captcha detected, pausing answer wait for human intervention', {
    driver: driver.id,
    timeoutMs: CAPTCHA_WAIT_TIMEOUT_MS,
  })
  while (Date.now() - start < CAPTCHA_WAIT_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, CAPTCHA_POLL_INTERVAL_MS))
    // 用户在等待验证码期间手动关闭页面时，isCtxClosed 返回 true，
    // 此时返回 false（而非误报"已解决"返回 true），避免后续操作在已关闭的页面上执行。
    if (isCtxClosed(ctx)) {
      log.warn('Page closed during captcha wait, aborting', { driver: driver.id, waitedMs: Date.now() - start })
      return false
    }
    const captchaState = await detectCaptcha(ctx)
    // 页面已关闭（unreachable）：返回 false，不再误报"已解决"
    if (captchaState.unreachable) {
      log.warn('Page unreachable during captcha wait, aborting', { driver: driver.id, waitedMs: Date.now() - start })
      return false
    }
    if (!captchaState.detected) {
      const waitedMs = Date.now() - start
      log.info('Captcha resolved, resuming answer wait', { driver: driver.id, waitedMs })
      // 验证码消失后额外等待 2 秒，让页面恢复正常状态
      await new Promise((r) => setTimeout(r, 2_000))
      return true
    }
  }
  log.error('Captcha wait timed out', { driver: driver.id, timeoutMs: CAPTCHA_WAIT_TIMEOUT_MS })
  return false
}

async function waitForAnswerContainer(ctx: ExecutionContext, driver: ModelPlatformGeoDriver) {
  const found = await findElementInCtx(ctx, driver.selectors.answerContainer, driver.answerAppearTimeoutMs)
  if (!found) {
    log.warn('Answer container selector did not match', { driver: driver.id })
    return undefined
  }
  log.info('Answer container found', { driver: driver.id, selector: found.selector })
  return found.el
}

async function waitForAnswerStable(ctx: ExecutionContext, driver: ModelPlatformGeoDriver, container?: ElementHandle<Element>) {
  const strategy = driver.completion

  if (strategy.kind === 'fixed') {
    await new Promise((r) => setTimeout(r, strategy.waitMs))
    return
  }

  if (strategy.kind === 'stop-button') {
    const start = Date.now()
    let stopButtonSeen = false
    let stopButtonAppearAt = 0
    let stableFallbackActive = false
    let stableLastLen = 0
    let stableLastChangeAt = start
    let stableStarted = false
    const stableFallbackMs = 15_000
    const stableIdleMs = 3_500
    const stableMinLength = 100
    const minStopButtonDurationMs = 5_000

    while (Date.now() - start < strategy.timeoutMs) {
      // 检测页面/iframe 是否已被用户手动关闭：关闭后立即退出，跳过剩余等待，让上层任务循环执行下一个任务。
      if (isCtxClosed(ctx)) {
        log.warn('Page/frame closed during stop-button wait, aborting answer wait', { driver: driver.id })
        return
      }
      // 验证码检测：弹窗/滑块出现时暂停等待人工干预，避免 text-growth 误判为完成
      const captchaCheck = await detectCaptcha(ctx)
      // 页面已关闭（unreachable）：直接退出，避免后续 ctx.evaluate 在已关闭页面上执行
      if (captchaCheck.unreachable) {
        log.warn('Page unreachable during stop-button wait, aborting', { driver: driver.id })
        return
      }
      if (captchaCheck.detected) {
        log.warn('Captcha detected during stop-button wait', { driver: driver.id, reason: captchaCheck.reason })
        const resolved = await waitForCaptchaResolved(ctx, driver)
        if (!resolved) {
          log.error('Captcha not resolved, aborting answer wait', { driver: driver.id })
          return
        }
        // 验证码消失后重置基线，避免验证码文案被计入 text-growth 判定
        stopButtonSeen = false
        stableLastLen = 0
        stableLastChangeAt = Date.now()
        continue
      }
      if (!stableFallbackActive) {
        const found = await findElementInCtx(ctx, strategy.selector, 2_000)
        if (found) {
          if (!stopButtonSeen) {
            stopButtonSeen = true
            stopButtonAppearAt = Date.now()
            log.info('Stop button appeared, answer started', { driver: driver.id })
          }
        } else if (stopButtonSeen) {
          const elapsedSinceAppear = Date.now() - stopButtonAppearAt
          if (elapsedSinceAppear >= minStopButtonDurationMs) {
            log.info('Stop button disappeared; answer likely complete', { driver: driver.id, durationMs: elapsedSinceAppear })
            return
          }
        }
        if (!stopButtonSeen && Date.now() - start >= stableFallbackMs) {
          stableFallbackActive = true
          log.warn('Stop button not found, switching to text-growth detection', { driver: driver.id })
        }
      }

      if (stableFallbackActive) {
        try {
          const len = await ctx.evaluate((selectors) => {
            const containerSelectors = selectors
            let node: Element | Document = document.body
            if (containerSelectors && containerSelectors.length > 0) {
              for (const s of containerSelectors) {
                const el = document.querySelector(s)
                if (el) { node = el; break }
              }
            }
            return (node.textContent || '').length
          }, driver.selectors.answerContainer).catch(() => 0)

          const now = Date.now()
          if (len > stableLastLen) {
            if (!stableStarted && len >= stableMinLength) {
              stableStarted = true
              log.info('Answer started generating (text-growth mode)', { driver: driver.id, length: len })
            }
            stableLastLen = len
            stableLastChangeAt = now
          }
          if (stableStarted && now - stableLastChangeAt >= stableIdleMs) {
            log.info('Answer stable (text-growth mode)', { driver: driver.id, length: stableLastLen, idleMs: stableIdleMs })
            return
          }
        } catch (err) {
          log.debug('Text-growth poll failed', { driver: driver.id, error: String(err) })
        }
      }
      await new Promise((r) => setTimeout(r, 1_000))
    }
    if (stopButtonSeen) log.warn('Stop-button wait timed out (button still present)', { driver: driver.id })
    else if (stableFallbackActive) log.warn('Text-growth detection timed out', { driver: driver.id, lastLen: stableLastLen })
    else log.warn('Stop-button never appeared within timeout', { driver: driver.id })
    return
  }

  // stable strategy
  const idleMs = strategy.idleMs
  const timeoutMs = strategy.timeoutMs
  // 回答开始后至少等待的时间，避免流式回答中途暂停（等搜索/推理）被误判为完成。
  // 例如元宝：内容渲染到中途会暂停数秒等待搜索结果，此时 idleMs 计时会触发误判。
  const minDurationAfterStartMs = strategy.minDurationAfterStartMs ?? 0
  const minLength = 100
  const pollInterval = 2_000
  const noGrowthAbortMs = 60_000
  const containerSelectors = container ? driver.selectors.answerContainer : []
  const usingBodyFallback = !container

  const startTime = Date.now()
  let baselineLen = 0
  let lastLen = 0
  let lastChangeAt = startTime
  let started = false
  let startedAt = 0
  let firstDetectAt = 0
  let consecutiveDetachedErrors = 0
  let baselineSet = false

  while (Date.now() - startTime < timeoutMs) {
    // 检测页面/iframe 是否已被用户手动关闭：关闭后立即退出，跳过剩余等待，让上层任务循环执行下一个任务。
    if (isCtxClosed(ctx)) {
      log.warn('Page/frame closed during stable wait, aborting answer wait', { driver: driver.id })
      return
    }
    try {
      // 验证码检测：弹窗/滑块出现时暂停等待人工干预，避免误判为回答完成
      const captchaCheck = await detectCaptcha(ctx)
      // 页面已关闭（unreachable）：直接退出，避免后续 ctx.evaluate 在已关闭页面上执行
      if (captchaCheck.unreachable) {
        log.warn('Page unreachable during stable wait, aborting', { driver: driver.id })
        return
      }
      if (captchaCheck.detected) {
        log.warn('Captcha detected during stable wait', { driver: driver.id, reason: captchaCheck.reason })
        const resolved = await waitForCaptchaResolved(ctx, driver)
        if (!resolved) {
          log.error('Captcha not resolved, aborting answer wait', { driver: driver.id })
          return
        }
        // 验证码消失后重置基线，避免验证码文案被计入 stable 判定
        lastLen = 0
        lastChangeAt = Date.now()
        started = false
        startedAt = 0
        baselineSet = false
        continue
      }
      const result = await ctx.evaluate((selectors) => {
        const getNode = () => {
          if (selectors && selectors.length > 0) {
            for (const s of selectors) {
              const el = document.querySelector(s)
              if (el) return el
            }
          }
          return document.body
        }
        const node = getNode()
        const text = (node.textContent || '')
        const errorEl = document.querySelector('[data-conv-status="error"]')
        const errorTexts = ['请求失败', '出错了', '请稍后再试', '服务异常', '网络异常']
        const hasErrorText = errorTexts.some(t => text.includes(t))
        return { len: text.length, hasError: !!errorEl || hasErrorText }
      }, containerSelectors)

      consecutiveDetachedErrors = 0
      const now = Date.now()

      if (result.hasError) {
        log.warn('Error response detected, aborting stable wait', { driver: driver.id, lastLen: result.len })
        return
      }

      const len = result.len
      if (usingBodyFallback && !baselineSet) {
        baselineLen = len
        baselineSet = true
        lastLen = 0
        log.info('Body fallback baseline set', { driver: driver.id, baselineLen })
      }

      const effectiveLen = usingBodyFallback ? Math.max(0, len - baselineLen) : len
      if (effectiveLen > lastLen) {
        if (firstDetectAt === 0 && effectiveLen > 0) firstDetectAt = now
        lastLen = effectiveLen
        lastChangeAt = now
        if (!started && effectiveLen >= minLength) {
          started = true
          startedAt = now
          log.info('Answer started generating', { driver: driver.id, length: effectiveLen })
        }
      }
      // 判定 stable 需同时满足两个条件：
      //   1) 距离上次内容变化已超过 idleMs（回答看似停止增长）
      //   2) 距离回答开始已超过 minDurationAfterStartMs（避免中途暂停被误判）
      // minDurationAfterStartMs > 0 时，即使 idleMs 已满足，也会继续轮询直到最小持续时间达标。
      // 这是关键保护：元宝等流式回答平台会在回答中途暂停数秒等待搜索结果，
      // 此时文本长度不变，但 AI 并未结束，引用列表尚未渲染。
      if (
        started &&
        now - lastChangeAt >= idleMs &&
        now - startedAt >= minDurationAfterStartMs
      ) {
        log.info('Answer stable', {
          driver: driver.id,
          length: lastLen,
          idleMs,
          elapsedSinceStart: now - startedAt,
          minDurationAfterStartMs,
        })
        return
      }
      if (firstDetectAt > 0 && !started && now - lastChangeAt >= noGrowthAbortMs) {
        log.warn('Answer not growing, aborting early', { driver: driver.id, lastLen, elapsed: now - firstDetectAt })
        return
      }
    } catch (err) {
      if (isDetachedFrameError(err)) {
        consecutiveDetachedErrors++
        if (consecutiveDetachedErrors >= 3) {
          log.warn('Page frame detached, aborting stable wait', { driver: driver.id, errors: consecutiveDetachedErrors })
          throw err
        }
        log.debug('Stable wait poll failed (detached, retrying)', { driver: driver.id, error: String(err), count: consecutiveDetachedErrors })
      } else {
        log.debug('Stable wait poll failed', { driver: driver.id, error: String(err) })
      }
    }
    await new Promise((r) => setTimeout(r, pollInterval))
  }
  log.warn('Stable wait timed out', { driver: driver.id, lastLen, timeoutMs })
}

async function extractAnswerText(ctx: ExecutionContext, driver: ModelPlatformGeoDriver): Promise<string> {
  const result = await ctx.evaluate((selectors) => {
    const debug = { matchedSelector: '', usedFallback: false, rawLen: 0, removedSup: 0, removedInlineA: 0, removedList: 0, tableCount: 0, headingCount: 0, olCount: 0, aCount: 0, numericACount: 0 }
    const removeNodes = (root: Element) => {
      const sups = root.querySelectorAll('sup a[href], sup')
      sups.forEach((sup) => {
        const t = (sup.textContent || '').trim()
        if (/^-?\d{1,3}$/.test(t)) { sup.remove(); debug.removedSup++ }
      })
      const inlineAnchors = root.querySelectorAll('a[href]')
      inlineAnchors.forEach((a) => {
        const t = (a.textContent || '').trim()
        if (/^-?\d{1,3}$/.test(t)) { a.remove(); debug.removedInlineA++ }
      })
      root.querySelectorAll('.ds-markdown__citation, .ds-citations, [data-citation-list]').forEach((n) => { n.remove(); debug.removedList++ })
      root.querySelectorAll('table').forEach((table) => {
        debug.tableCount++
        const headers = Array.from(table.querySelectorAll('thead th')).map((th) => (th.textContent || '').trim())
        const rows = Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
          Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim()),
        )
        let finalHeaders = headers
        let finalRows = rows
        if (headers.length === 0) {
          const allTrs = Array.from(table.querySelectorAll('tr'))
          if (allTrs.length > 1) {
            finalHeaders = Array.from(allTrs[0].querySelectorAll('th, td')).map((c) => (c.textContent || '').trim())
            finalRows = allTrs.slice(1).map((tr) =>
              Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim()),
            )
          }
        }
        if (finalHeaders.length === 0 || finalRows.length === 0) return
        const header = `| ${finalHeaders.join(' | ')} |`
        const separator = `| ${finalHeaders.map(() => '---').join(' | ')} |`
        const body = finalRows.map((r) => `| ${r.join(' | ')} |`).join('\n')
        const pre = document.createElement('pre')
        pre.textContent = `${header}\n${separator}\n${body}`
        table.replaceWith(pre)
      })
      root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
        debug.headingCount++
        const level = parseInt(h.tagName.slice(1), 10)
        const text = (h.textContent || '').trim()
        const pre = document.createElement('p')
        pre.textContent = `${'#'.repeat(level)} ${text}`
        h.replaceWith(pre)
      })
    }

    let el: Element | null = null
    for (const s of selectors) {
      const matches = document.querySelectorAll(s)
      const filtered = Array.from(matches).filter((node) =>
        !node.closest('[class*="justify-end"]')
        // 跳过 .hidden / display:none 容器内的空元素（纳米AI 有两个 markdown-container，
        // 最后一个在 .hidden 内且内容为空）
        && !node.closest('.hidden, [style*="display: none"], [style*="display:none"]')
      )
      // 文心一言移动端有多个问答对（chat-qa-container[data-qa-pair-id]），
      // 只保留最后一个问答对内的元素，排除历史回答
      const qaPairs = document.querySelectorAll('[data-qa-pair-id]')
      if (qaPairs.length > 1) {
        const lastQa = qaPairs[qaPairs.length - 1]
        const filteredToLastQa = filtered.filter((node) => lastQa.contains(node) || lastQa === node)
        if (filteredToLastQa.length > 0) {
          filtered.length = 0
          filtered.push(...filteredToLastQa)
        }
      }
      if (filtered.length > 0) {
        // 当匹配到多个元素时，合并所有非空元素的文本（文心一言等平台回答由多个
        // .cosd-markdown-content 段落组成，只取最长的会丢失内容）
        const nonEmpty = filtered.filter((node) => (node.textContent || '').trim().length > 0)
        if (nonEmpty.length > 0) {
          if (nonEmpty.length === 1) {
            el = nonEmpty[0]
          } else {
            const wrapper = document.createElement('div')
            for (const node of nonEmpty) {
              wrapper.appendChild(node.cloneNode(true))
            }
            el = wrapper
          }
        } else {
          el = filtered[filtered.length - 1]
        }
        debug.matchedSelector = s
        break
      }
    }
    if (!el) {
      const fallback = document.querySelector('article, [role="main"], .markdown-body, .message-content, .answer-content, .chat-message, main')
      el = fallback ?? document.body
      debug.usedFallback = true
    }
    debug.olCount = el.querySelectorAll('ol').length
    debug.aCount = el.querySelectorAll('a[href]').length
    el.querySelectorAll('a[href]').forEach((a) => {
      const t = (a.textContent || '').trim()
      if (/^-?\d{1,3}$/.test(t)) debug.numericACount++
    })
    const clone = el.cloneNode(true) as HTMLElement
    removeNodes(clone)
    const text = clone.textContent || el.textContent || ''
    debug.rawLen = text.length
    return { text, debug, outerHTMLSnippet: (el as HTMLElement).outerHTML.slice(0, 500) }
  }, driver.selectors.answerContainer)

  log.info('extractAnswerText debug', { driver: driver.id, ...result.debug })

  try {
    const htmlPath = path.join(EVIDENCE_DIR, `geo-${driver.id}-dom-${Date.now()}.html`)
    const fullHtml = await ctx.evaluate(() => document.body.outerHTML)
    fs.writeFileSync(htmlPath, `<html><head><meta charset="utf-8"></head><body>${fullHtml}</body></html>`)
    log.info('GEO DOM snapshot saved', { driver: driver.id, path: htmlPath, matched: result.debug.matchedSelector })
  } catch (e) {
    log.warn('Failed to save DOM snapshot', { driver: driver.id, error: String(e) })
  }

  const cleaned = result.text
    .replace(/\s+-\d{1,3}\s*\n/g, '\n')
    .replace(/\s+-\d{1,3}(?=\s)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return cleaned.slice(0, 32_000)
}

async function extractCitations(ctx: ExecutionContext, driver: ModelPlatformGeoDriver): Promise<GeoCitation[]> {
  const citations: GeoCitation[] = []
  try {
    const links = await ctx.evaluate((selectors) => {
      const wenxinItems = document.querySelectorAll('[data-long-press-ext-info]')
      if (wenxinItems.length > 0) {
        const out: { url: string; title: string; index: number }[] = []
        wenxinItems.forEach((li, index) => {
          const raw = li.getAttribute('data-long-press-ext-info') || ''
          try {
            const info = JSON.parse(raw)
            if (info && typeof info.link === 'string' && info.link.startsWith('http')) {
              out.push({ url: info.link, title: info.linkTitle || '', index })
            }
          } catch {}
        })
        if (out.length > 0) return { items: out, mode: 'wenxin-attr' as const, debug: { citationListMatched: true, matchedSelector: '[data-long-press-ext-info]' } }
      }

      const citationListSelectors = selectors.citationList || []
      for (const s of citationListSelectors) {
        const listEl = document.querySelector(s)
        if (listEl) {
          const items = listEl.querySelectorAll('li a[href^="http"], a[href^="http"]')
          const out: { url: string; title: string; index: number }[] = []
          items.forEach((a, index) => {
            const href = (a as HTMLAnchorElement).href
            if (!href.startsWith('http')) return
            const text = (a.textContent || '').trim()
            const title = a.getAttribute('aria-label') || a.getAttribute('title') || text || ''
            out.push({ url: href, title, index })
          })
          if (out.length > 0) return { items: out, mode: 'list' as const, debug: { citationListMatched: true, matchedSelector: s } }
        }
      }

      let scope: Element | null = null
      for (const s of selectors.answerContainer) {
        scope = document.querySelector(s)
        if (scope) break
      }
      if (!scope) scope = document.body

      const seen = new Map<string, { url: string; title: string; index: number }>()
      let idx = 0
      const anchors = scope.querySelectorAll('a[href]')
      anchors.forEach((a) => {
        const href = (a as HTMLAnchorElement).href
        if (!href.startsWith('http')) return
        if (seen.has(href)) return
        const text = (a.textContent || '').trim()
        const title = /^-?\d{1,3}$/.test(text)
          ? ''
          : (text || a.getAttribute('aria-label') || a.getAttribute('title') || '')
        seen.set(href, { url: href, title, index: idx++ })
      })
      return {
        items: Array.from(seen.values()),
        mode: 'inline-dedup' as const,
        debug: { citationListMatched: false, scopeFound: !!scope, totalAnchors: scope ? scope.querySelectorAll('a[href]').length : 0 },
      }
    }, driver.selectors)

    log.info('extractCitations debug', {
      driver: driver.id,
      mode: (links as { mode?: string }).mode,
      itemCount: links.items.length,
    })

    for (const link of links.items.slice(0, 20)) {
      // 剥离 #:~:text= 等 Scroll-to-Text Fragment。
      // Kimi 等平台引用 <a href> 会带 STTF fragment（"复制链接到高亮"自动生成），
      // 包含大量 URL 编码中文，长度可达 KB 级，远超后端 geo_citations.url varchar(2048)。
      // Fragment 对引用来源识别没有价值，剥离后既短又保留核心 URL。
      const cleanUrl = stripUrlFragment(link.url)
      const domain = domainFromUrl(cleanUrl)
      citations.push({
        url: cleanUrl,
        domain,
        title: link.title || domain,
        position: link.index + 1,
        isEnterpriseSource: false,
      })
    }
    log.info('Citations extracted', { driver: driver.id, count: citations.length, sample: citations.slice(0, 2) })
  } catch (err) {
    log.warn('Failed to extract citations', { driver: driver.id, error: String(err) })
  }
  return citations
}

// ---------------------------------------------------------------------------
// Share link generation (simplified — uses page clipboard instead of Electron)
// ---------------------------------------------------------------------------

function extractShareUrlFromText(text: string, driver?: ModelPlatformGeoDriver): string | undefined {
  if (!text) return undefined
  const trimmed = text.trim()

  // 验证是否为有效分享链接：
  // 1) 必须是 http(s) URL 或以 /share/ /chat/ /s/ /thread/ /ug_share/ 开头的相对路径
  // 2) 必须包含分享路径标识，排除纯域名和 /api/ 端点
  //    - kimi:  https://www.kimi.com/share/xxx
  //    - 元宝:  https://yb.tencent.com/s/xxx
  //    - 豆包桌面端:  https://www.doubao.com/chat/xxx
  //    - 豆包移动端:  https://www.doubao.com/thread/xxx
  //    - 文心:  https://mbd.baidu.com/ug_share/mbox/xxx/share?... 或 https://chat.baidu.com/csaitab/history/share?...
  //    - 纳米:  https://so.n.cn/search/xxx?fr=none
  //    - 相对:  /share/xxx 或 /chat/xxx 或 /thread/xxx
  // 排除：
  //    - https://yuanbao.tencent.com（纯域名，无路径）
  //    - https://yuanbao.tencent.com/api/conversations/v2/share（API端点）
  //    - JSON 片段中的URL（如 https://yuanbao.tencent.com`","referer":... ）
  const isValidShareUrl = (url: string): boolean => {
    if (!url) return false
    // 排除 API 端点
    if (url.includes('/api/')) return false
    // 排除纯 /chat/skills 等非会话链接（豆包侧边栏）
    if (/\/chat\/(skills|history|setting)/i.test(url)) return false
    // 如果 driver 配置了 shareUrlPatterns，优先用 driver 特化 pattern 校验，
    // 不再走通用白名单（driver 特化优先，平台改 URL 格式时只更新 driver 配置）
    if (driver?.shareUrlPatterns && driver.shareUrlPatterns.length > 0) {
      return driver.shareUrlPatterns.some((p) => new RegExp(p).test(url))
    }
    // 通用白名单（driver 未配置 shareUrlPatterns 时回退）
    // 注意：文心的 URL 是 /ug_share/mbox/xxx/share?... （/share 后跟 ?，不是 /share/）
    // 所以需要单独检查 /ug_share/ 和 /csaitab/history/share
    // 纳米移动端：so.n.cn/search/xxx?fr=none 是可分享的对话链接
    if (
      !url.includes('/share/') &&
      !url.includes('/s/') &&
      !url.includes('/chat/') &&
      !url.includes('/thread/') &&
      !url.includes('/ug_share/') &&
      !url.includes('/csaitab/history/share') &&
      !(url.includes('so.n.cn/search/'))
    ) return false
    return true
  }

  // 完整字符串就是URL的情况
  if (/^https?:\/\/\S+$/.test(trimmed) || /^\/(chat|share|s|thread|ug_share|csaitab\/history\/share)\//.test(trimmed)) {
    // 提取纯URL部分（遇到 JSON 字符如 " ' ` 等停止）
    const cleanUrl = trimmed.match(/^https?:\/\/[^\s`'")<>\\]+/)?.[0] || trimmed.match(/^\/(?:chat|share|s|thread|ug_share|csaitab\/history\/share)\/[^\s`'")<>\\]+/)?.[0]
    if (cleanUrl && isValidShareUrl(cleanUrl)) return cleanUrl
  }

  // 从字符串中提取URL（剪贴板可能包含JSON片段）
  const urlMatch = trimmed.match(/https?:\/\/[^\s`'")<>\\]+/) || trimmed.match(/\/(?:chat|share|s|thread|ug_share|csaitab\/history\/share)\/[^\s`'")<>\\]+/)
  if (urlMatch && isValidShareUrl(urlMatch[0])) return urlMatch[0]

  // 兜底：从路径匹配
  if (trimmed.includes('/chat/') || trimmed.includes('/share/') || trimmed.includes('/s/') || trimmed.includes('/thread/') || trimmed.includes('/ug_share/') || trimmed.includes('/csaitab/history/share')) {
    const pathMatch = trimmed.match(/\/(?:chat|share|s|thread|ug_share|csaitab\/history\/share)\/[^\s`'")<>\\]*/)
    if (pathMatch && isValidShareUrl(pathMatch[0])) return pathMatch[0]
  }
  return undefined
}

/**
 * 自动点击剪贴板权限提示框的"允许"按钮。
 *
 * kimi 等平台点击"复制链接"后，浏览器可能弹出权限提示：
 *   "www.kimi.com 想要查看复制到剪贴板的文字和图片 [允许] [屏蔽]"
 * 如果不点"允许"，navigator.clipboard.readText() 会失败或拿到空字符串。
 *
 * 此函数在点击复制链接后短暂轮询，查找并点击"允许"按钮。
 * 注意：context.grantPermissions 通常已阻止浏览器原生权限提示弹出，
 * 此处主要兜底处理平台自定义的权限 UI 模态框。
 */
async function autoAllowClipboardPermission(page: Page, driverId: string) {
  // permissions 授权后通常不会弹窗，只做 2 次快速检查兜底（共约 600ms）
  for (let attempt = 0; attempt < 2; attempt++) {
    if (page.isClosed()) return
    try {
      const clicked = await page.evaluate(() => {
        // 查找权限提示中的"允许"按钮
        const candidates = Array.from(document.querySelectorAll(
          'button, [role="button"], a, div[class*="cursor-pointer"], div[onclick]'
        )) as HTMLElement[]
        // 优先匹配包含"允许"文本的按钮
        const allowBtn = candidates.find((b) => {
          const text = (b.textContent || '').trim()
          return text === '允许' || (text.includes('允许') && text.length < 10)
        })
        if (allowBtn) {
          allowBtn.click()
          return true
        }
        // 兜底：匹配 "Allow" / "Accept" 英文按钮
        const allowEnBtn = candidates.find((b) => {
          const text = (b.textContent || '').trim().toLowerCase()
          return text === 'allow' || text === 'accept'
        })
        if (allowEnBtn) {
          allowEnBtn.click()
          return true
        }
        return false
      }).catch(() => false)
      if (clicked) {
        log.info('Clicked clipboard permission "允许" button', { driver: driverId, attempt })
        await new Promise((r) => setTimeout(r, 300))
        return
      }
    } catch { /* page may be detached */ }
    await new Promise((r) => setTimeout(r, 300))
  }
}

async function generateShareLink(page: Page, driver: ModelPlatformGeoDriver): Promise<string | undefined> {
  const { shareButton, createShareLinkButton } = driver.selectors
  if (!shareButton || !createShareLinkButton) return undefined

  const pageUrlBeforeShare = page.url()

  // 还原 copy listener / writeText hook，避免 page 复用时累积
  const restoreClipboardHooks = async () => {
    await page.evaluate(() => {
      if ((window as any).__geoCopyHandler) {
        document.removeEventListener('copy', (window as any).__geoCopyHandler)
        delete (window as any).__geoCopyHandler
      }
      if ((window as any).__geoOrigWriteText && navigator.clipboard) {
        navigator.clipboard.writeText = (window as any).__geoOrigWriteText
        delete (window as any).__geoOrigWriteText
      }
      if ((window as any).__geoOrigWrite && navigator.clipboard) {
        navigator.clipboard.write = (window as any).__geoOrigWrite
        delete (window as any).__geoOrigWrite
      }
    }).catch(() => {})
  }

  try {
    if (page.isClosed()) {
      log.warn('Page already closed before share link generation', { driver: driver.id })
      return undefined
    }
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {})
    await new Promise((r) => setTimeout(r, 500))

    // 清空系统剪贴板，防止上一次任务残留的链接被 readText() 误读为本平台链接。
    // 场景：DeepSeek 分享对话框未弹出时未写入新链接，readText() 会读到上次千问的链接。
    // 即使清空失败，下方 driver.shareUrlPatterns 也会拒绝非本平台链接，作为双保险。
    const cleared: { ok: boolean; afterLen?: number; error?: string } = await page.evaluate(async () => {
      try {
        await navigator.clipboard?.writeText('')
        // 验证清空是否生效
        const after = await navigator.clipboard?.readText() || ''
        return { ok: after === '', afterLen: after.length }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }).catch((e: unknown) => ({ ok: false, error: String(e) }))
    log.info('Clipboard cleared before share link capture', {
      driver: driver.id,
      cleared: cleared.ok,
      ...(cleared.error ? { error: cleared.error } : {}),
      ...(cleared.afterLen !== undefined ? { afterLen: cleared.afterLen } : {}),
    })

    // 在点击分享按钮之前就设置 copy/writeText hook
    // 文心等平台点击分享按钮可能直接复制链接（无中间"复制链接"按钮），
    // 需提前 hook 才能捕获。
    await page.evaluate(() => {
      (window as any).__capturedShareUrl = ''
      ;(window as any).__capturedClipboardWrite = ''
      // 保存原始引用，便于 finally 还原
      if (!(window as any).__geoOrigWriteText) {
        (window as any).__geoOrigWriteText = navigator.clipboard?.writeText?.bind(navigator.clipboard)
      }
      if (!(window as any).__geoOrigWrite) {
        (window as any).__geoOrigWrite = navigator.clipboard?.write?.bind(navigator.clipboard)
      }
      // 具名 handler，便于卸载
      ;(window as any).__geoCopyHandler = (e: ClipboardEvent) => {
        const text = e.clipboardData?.getData('text/plain') || ''
        if (text.includes('/chat/') || text.includes('/share/') || text.includes('/thread/') || text.startsWith('http')) {
          (window as any).__capturedShareUrl = text
        }
      }
      document.addEventListener('copy', (window as any).__geoCopyHandler)
      if (navigator.clipboard && navigator.clipboard.writeText && (window as any).__geoOrigWriteText) {
        navigator.clipboard.writeText = async (text: string) => {
          if (typeof text === 'string' && (text.includes('/chat/') || text.includes('/share/') || text.includes('/thread/') || text.startsWith('http'))) {
            ;(window as any).__capturedClipboardWrite = text
          }
          return (window as any).__geoOrigWriteText(text)
        }
      }
      if (navigator.clipboard && navigator.clipboard.write && (window as any).__geoOrigWrite) {
        navigator.clipboard.write = async (items: ClipboardItem[]) => {
          try {
            for (const item of items) {
              for (const type of item.types) {
                if (type === 'text/plain' || type === 'text/html') {
                  const blob = await item.getType(type)
                  const text = await blob.text()
                  if (text && (text.includes('/chat/') || text.includes('/share/') || text.includes('/thread/') || text.startsWith('http'))) {
                    ;(window as any).__capturedClipboardWrite = text
                    break
                  }
                }
              }
            }
          } catch (e) { /* ignore */ }
          return (window as any).__geoOrigWrite(items)
        }
      }
    }).catch(() => {})
    log.info('Share hooks installed (pre-click)', { driver: driver.id })

    // 网络接口监听配置（在分享按钮点击前注册，确保不漏掉响应）
    const netCfg = driver.networkShareApi
    let shareResponsePromise: Promise<string | undefined> | undefined
    if (netCfg) {
      shareResponsePromise = page.waitForResponse(
        (res) => netCfg.urlPattern.test(res.url())
          && (!netCfg.method || res.request().method().toUpperCase() === netCfg.method.toUpperCase())
          && res.ok(),
        { timeout: 30_000 },
      ).then(async (res) => {
        let body: any = await res.json().catch(() => null)
        if (!body) {
          const rawText = await res.text().catch(() => '')
          if (rawText) { try { body = JSON.parse(rawText) } catch { /* not JSON */ } }
        }
        if (!body) return undefined
        const shareUrl = netCfg.buildUrl(body)
        if (shareUrl) {
          log.info('Share URL captured via network API', { driver: driver.id, urlPreview: shareUrl.substring(0, 80) })
          return shareUrl
        }
        log.warn('Share API buildUrl returned undefined', { driver: driver.id, bodyKeys: Object.keys(body) })
        return undefined
      }).catch((e) => {
        if (!String(e).includes('Timeout')) {
          log.warn('Share API waitForResponse error', { driver: driver.id, error: String(e) })
        }
        return undefined
      })
      log.info('Network share API waitForResponse installed', { driver: driver.id })
    }

    // Hover answer container to reveal action bar
    try {
      const hoverResult = await page.evaluate((selectors) => {
        for (const s of selectors) {
          const matches = Array.from(document.querySelectorAll(s))
          const filtered = matches.filter((node) => !node.closest('[class*="justify-end"]'))
          if (filtered.length > 0) {
            const last = filtered[filtered.length - 1] as HTMLElement
            last.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
            last.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
            const parent = last.parentElement?.parentElement
            if (parent) {
              parent.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
              parent.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
            }
            return { found: true, tag: last.tagName, cls: last.className.substring(0, 80) }
          }
        }
        return { found: false }
      }, driver.selectors.answerContainer).catch(() => ({ found: false }))

      if (hoverResult.found) {
        await new Promise((r) => setTimeout(r, 800))
        log.info('Hovered answer container to reveal action bar', { driver: driver.id })
      }
    } catch (err) {
      log.debug('Failed to hover answer container', { driver: driver.id, error: String(err) })
    }

    // Click share button
    let shareClicked = false
    // Playwright waitForSelector 原生支持 :has() 伪类，不过滤；
    // 仅过滤 :has-text()（部分场景下 waitForSelector 匹配不稳定）
    const validSelectors = shareButton.filter((s) => !s.includes(':has-text('))

    // 文心一言移动端：页面上有多个问答对（data-qa-pair-id），每个都有分享按钮。
    // 需精确点击最新问答对内的分享按钮，否则会点击到历史回答的分享按钮。
    if (validSelectors.length > 0) {
      // 先尝试在最新问答对内查找分享按钮（文心一言移动端特化）
      shareClicked = await page.evaluate(() => {
        const qaPairs = document.querySelectorAll('[data-qa-pair-id]')
        if (qaPairs.length === 0) return false
        const lastQa = qaPairs[qaPairs.length - 1] as HTMLElement
        const shareBtn = lastQa.querySelector('[data-testid="wise-interact-share"]') as HTMLElement | null
        if (!shareBtn) return false
        shareBtn.click()
        return true
      }).catch(() => false)
      if (shareClicked) log.info('Clicked share button (latest qa-pair)', { driver: driver.id })

      // 通用查找（非文心一言或最新问答对内未找到）
      if (!shareClicked) {
      const shareBtn = await findElement(page, validSelectors, 5_000)
      if (shareBtn) {
        // 优先用 Playwright 的 handle.click()（模拟真实鼠标事件），部分框架（如文心 Vue）
        // 不响应 evaluate 中的 el.click()，但响应 Playwright 的真实点击。
        shareClicked = await shareBtn.el.click({ timeout: 3_000 }).then(() => true).catch(() => false)
        if (!shareClicked) {
          // handle.click() 失败时回退到 evaluate 中的 el.click()
          shareClicked = await shareBtn.el.evaluate((el) => {
            try {
              const btn = el as HTMLElement
              if (btn.getAttribute('data-trigger-type') === 'hover') {
                btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
                btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
              }
              btn.click()
              return true
            } catch { return false }
          }).catch(() => false)
        }
        if (shareClicked) log.info('Clicked share button', { driver: driver.id, selector: shareBtn.selector })
      }
      } // end if (!shareClicked)通用查找
    }

    if (!shareClicked) {
      shareClicked = await page.evaluate((answerContainerSelectors: string[]) => {
        const triggerShareBtn = (btn: HTMLElement): boolean => {
          const triggerType = btn.getAttribute('data-trigger-type')
          if (triggerType === 'hover') {
            btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
            btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
            btn.click()
            return true
          }
          btn.click()
          return true
        }
        const byTestId = document.querySelector('[data-testid*="share" i]') as HTMLElement
        if (byTestId) return triggerShareBtn(byTestId)
        const btns = Array.from(document.querySelectorAll('button, [role="button"], div[class*="icon-button"], div[class*="share"], div[class*="Toolbar_shareIcon"], div.js-action-share, span[data-testid], a[class*="share"], span[class*="share"], i[class*="share"], div[onclick], div.cursor-pointer')) as HTMLElement[]
        const byLabel = btns.find((b) => {
          const label = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase()
          return label.includes('share') || label.includes('分享')
        })
        if (byLabel) return triggerShareBtn(byLabel)
        const byText = btns.find((b) => {
          const text = (b.textContent || '').trim()
          return text === '分享' || (text.includes('分享') && text.length < 10)
        })
        if (byText) return triggerShareBtn(byText)
        const pathSelectors = [
          'svg path[d*="7.95889"]', 'svg path[d*="7.72451"]', 'svg path[d*="M386.218667"]', 'svg path[d*="59.264"]',
          'svg path[d*="M10.334"]', 'svg path[d*="11.052"]',
          // 豆包分享按钮 SVG path（分享箭头图标，data-trigger-type="hover"）
          'svg path[d*="M11.052 3.80762"]', 'svg path[d*="3.80762"]',
          'svg[name*="Share" i]', 'svg[name*="share" i]',
          'use[href*="share" i]', 'use[href="#icon-action_share"]',
        ]
        // 搜索根节点：优先在 answer container 内查找（限定范围，避免误匹配导航栏/其他回答的分享按钮）；
        // 找不到再回退到整个文档（兼容 answer container 选择器失配的情况）
        const searchRoots: ParentNode[] = []
        if (answerContainerSelectors && answerContainerSelectors.length > 0) {
          for (const s of answerContainerSelectors) {
            const root = document.querySelector(s)
            if (root) searchRoots.push(root)
          }
        }
        searchRoots.push(document) // 兜底：整个文档
        for (const sel of pathSelectors) {
          for (const root of searchRoots) {
            const els = Array.from(root.querySelectorAll(sel))
            for (const el of els) {
            // closest 需包含 i 元素（智谱桌面分享按钮是 <i class="share">）
            // deepseek 移动端分享按钮外层是 <div class="ds-icon">（无 role="button"）
            const btn = (el as SVGElement).closest('button, [role="button"], div[class*="icon-button"], div.cursor-pointer, div.share, div.js-action-share, span[data-testid], div[class*="Toolbar_shareIcon"], div[class*="hover\\:bg-tag"], i[class*="share"], i.share, div.ds-icon, div[class*="ds-icon"]') as HTMLElement | null
            if (btn) return triggerShareBtn(btn)
            // 兜底：直接取 SVG 的父级 <i> 元素（智谱清言桌面结构：<i class="share"><svg><path/></svg></i>）
            const parentI = (el as SVGElement).closest('i') as HTMLElement | null
            if (parentI && (parentI.className.includes('share') || parentI.className.includes('Share'))) {
              return triggerShareBtn(parentI)
            }
          }
          }
        }
        // 豆包专用：按 data-trigger-type 查找分享按钮（无 aria-label/title）
        // 实测豆包移动端为 data-trigger-type="click"，桌面端可能为 "hover"
        const byHoverTrigger = btns.find((b) => {
          const t = b.getAttribute('data-trigger-type')
          return t === 'hover' || t === 'click'
        })
        if (byHoverTrigger) return triggerShareBtn(byHoverTrigger)
        return false
      }, driver.selectors.answerContainer).catch(() => false)
      if (shareClicked) log.info('Clicked share button via fallback', { driver: driver.id })
    }

    if (!shareClicked) {
      log.warn('Share button not found', { driver: driver.id })
      return undefined
    }

    // 等待分享对话框出现，轮询检测（文心 <chat-share-popup> shadow DOM 异步渲染）
    let dialogAppeared = false
    for (let waitRound = 0; waitRound < 6 && !dialogAppeared; waitRound++) {
      await new Promise((r) => setTimeout(r, 800))
      dialogAppeared = await page.evaluate(() => {
        // 豆包移动端分享对话框特征：含"复制链接"按钮，或 class 含 share-copy-button
        const copyBtn = document.querySelector('[class*="share-copy-button"]')
        const shareDialog = document.querySelector('[class*="share-dialog"], [class*="share-modal"], [role="dialog"]')
        // 智谱"复制链接"是 <div class="generate-share-source">，不是 button，需扩展检测范围
        const hasCopyText = Array.from(document.querySelectorAll('button, [role="button"], div[class*="generate-share-source"], div[class*="share-bar__item"], a, div[class*="menu-item"]')).some(
          (b) => (b.textContent || '').includes('复制链接')
        )
        // 智谱分享弹窗容器：class 含 generate-share 或 share-content
        const zhipuShare = document.querySelector('[class*="generate-share"], [class*="share-content"]')
        // 文心一言：分享对话框是 <chat-share-popup> web component，检测 shadow DOM 内容
        const chatSharePopup = document.querySelector('chat-share-popup')
        const popupHasContent = chatSharePopup && (chatSharePopup.shadowRoot?.children?.length || 0) > 0
        // 文心一言：分享底部操作栏（含"复制链接"按钮的容器）
        const shareFooter = document.querySelector('[class*="share-footer"], [class*="_share-footer_"]')
        // 文心 toast 提示（点击分享按钮直接复制的情况）
        const hasToast = Array.from(document.querySelectorAll('[class*="toast"], [class*="Toast"]')).some(
          (t) => (t.textContent || '').includes('复制') || (t.textContent || '').includes('分享')
        )
        return Boolean(copyBtn || (shareDialog && hasCopyText) || hasCopyText || popupHasContent || hasToast || shareFooter || zhipuShare)
      }).catch(() => false)
      if (dialogAppeared) {
        log.info('Share dialog appeared', { driver: driver.id, waitRound })
        break
      }
    }

    if (!dialogAppeared) {
      log.warn('Share dialog did not appear after clicking share button', { driver: driver.id })
      // 保存 DOM 快照诊断
      try {
        const shareDomPath = path.join(EVIDENCE_DIR, `geo-${driver.id}-no-dialog-${Date.now()}.html`)
        const shareHtml = await page.evaluate(() => document.body.outerHTML).catch(() => '')
        if (shareHtml) {
          fs.writeFileSync(shareDomPath, `<html><head><meta charset="utf-8"></head><body>${shareHtml}</body></html>`)
          log.info('No-dialog DOM snapshot saved', { driver: driver.id, path: shareDomPath })
        }
      } catch (e) {
        log.warn('Failed to save no-dialog DOM snapshot', { driver: driver.id, error: String(e) })
      }
    }

    // Hook 已在点击分享按钮之前设置（pre-click hooks），此处无需重复设置。
    // 下方"复制链接"按钮点击逻辑仅对豆包等有中间步骤的平台生效。

    // 智谱移动端：点击顶部分享按钮直接复制链接到剪贴板（toast "已复制链接"），
    // 无中间"复制链接"按钮。如果 hook 已捕获链接，跳过按钮搜索。
    let createClicked = false
    const earlyCapture = await page.evaluate(() => {
      const fromWrite = (window as any).__capturedClipboardWrite || ''
      const fromCopy = (window as any).__capturedShareUrl || ''
      return fromWrite || fromCopy
    }).catch(() => '')
    if (earlyCapture && extractShareUrlFromText(earlyCapture, driver)) {
      createClicked = true
      log.info('Share URL already captured (direct copy), skipping copy-link button', { driver: driver.id, preview: earlyCapture.substring(0, 120) })
    }
    // preButtonClicked 标志位：已点击过前置按钮（如 deepseek "创建分享链接"）后，
    // 后续轮次只匹配真正的复制按钮，避免按钮变身延迟时重复点击 preButton 触发多次 API 请求。
    let preButtonClicked = false
    for (let attempt = 0; attempt < 6 && !createClicked; attempt++) {
      // 用 evaluate 查找元素并返回坐标，不在此处执行 click。
      // 改用 page.mouse.click() 执行真实鼠标点击（mousedown → mouseup → click），
      // 确保 React 合成事件和完整事件链被触发。
      const result = await page.evaluate((preClicked: boolean) => {
        // 辅助：收集主文档 + shadow DOM 内的所有可点击元素
        const allClickable = (): HTMLElement[] => {
          const main = Array.from(document.querySelectorAll(
            'button, [role="button"], a, div[class*="cursor-pointer"], div[onclick], div.simple-button, div[class*="btn-group-item"], div[class*="menu-item"], div[class*="generate-share-source"], div[class*="bg-button-bg-normal"], div[class*="share-bar__item"], span[class*="cos-tooltip"]'
          )) as HTMLElement[]
          // 穿透 shadow DOM（文心 <chat-share-popup> 的内容在 shadow DOM 中）
          const popup = document.querySelector('chat-share-popup')
          if (popup?.shadowRoot) {
            const shadowBtns = Array.from(popup.shadowRoot.querySelectorAll('button, [role="button"], a, [class*="btn"], [class*="copy"]')) as HTMLElement[]
            main.push(...shadowBtns)
          }
          return main
        }
        // 豆包移动端：class 含 share-copy-button 的按钮，或文本含"复制链接"
        const byCopyClass = document.querySelector('[class*="share-copy-button"]') as HTMLElement
        if (byCopyClass) {
          const rect = byCopyClass.getBoundingClientRect()
          return { text: (byCopyClass.textContent || '').trim().substring(0, 30) || 'copy-by-class', preButton: false, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        }
        const empty = { text: '', preButton: false, x: 0, y: 0 }
        const btns = allClickable()
        // deepseek 移动端两步流程：
        //   step1: 点击"创建分享链接" → 按钮变成"创建并复制"（前置按钮，点击后不退出循环）
        //   step2: 点击"创建并复制" → 复制链接到剪贴板（真正的复制按钮，点击后退出循环）
        // 因此先匹配"创建并复制"等真正的复制按钮，最后才匹配"创建分享链接"前置按钮。
        let preButton = false
        // 真正的复制按钮（点击后会写入剪贴板）
        let btn = btns.find((b) => (b.textContent || '').trim().includes('创建并复制'))
        if (!btn) btn = btns.find((b) => (b.textContent || '').trim().includes('复制链接'))
        if (!btn) btn = btns.find((b) => (b.textContent || '').trim() === '复制')
        if (!btn) btn = btns.find((b) => (b.textContent || '').trim().includes('生成链接'))
        if (!btn) btn = btns.find((b) => (b.textContent || '').trim().includes('创建链接'))
        // 前置按钮（点击后等待真正的复制按钮出现，不退出循环）
        // 关键防护：已点击过 preButton 后不再匹配，避免按钮变身延迟时重复触发 API
        if (!btn && !preClicked) {
          const pre = btns.find((b) => (b.textContent || '').includes('创建分享链接'))
          if (pre) {
            btn = pre
            preButton = true
          }
        }
        if (btn) {
          const rect = (btn as HTMLElement).getBoundingClientRect()
          return { text: (btn.textContent || '').trim().substring(0, 30), preButton, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        }
        return empty
      }, preButtonClicked).catch(() => ({ text: '', preButton: false, x: 0, y: 0 }))
      if (result?.text && result.x > 0 && result.y > 0) {
        if (result.preButton) {
          // 点击了前置按钮（如 deepseek "创建分享链接"），标记后等待真正的复制按钮出现
          await page.mouse.click(result.x, result.y)
          preButtonClicked = true
          log.info('Clicked pre-copy button (real mouse)', { driver: driver.id, text: result.text, attempt, x: Math.round(result.x), y: Math.round(result.y) })
          await new Promise((r) => setTimeout(r, 1_000))
          continue
        }
        // 真实鼠标点击：mousedown → mouseup → click 完整事件链
        await page.mouse.click(result.x, result.y)
        createClicked = true
        log.info('Clicked create share link button (real mouse)', { driver: driver.id, text: result.text, attempt, x: Math.round(result.x), y: Math.round(result.y) })
        break
      }
      await new Promise((r) => setTimeout(r, 1_000))
    }

    if (!createClicked) {
      // 文心等平台点击分享按钮直接复制链接（无"复制链接"中间按钮），
      // 此时 hook 可能已捕获内容，需继续走 hook 读取和剪贴板读取逻辑，不能直接返回。
      log.info('No create-share-link button found, share button may have copied directly', { driver: driver.id })
      // 诊断：保存分享对话框 DOM 快照
      try {
        const shareDomPath = path.join(EVIDENCE_DIR, `geo-${driver.id}-share-dialog-${Date.now()}.html`)
        const shareHtml = await page.evaluate(() => document.body.outerHTML).catch(() => '')
        if (shareHtml) {
          fs.writeFileSync(shareDomPath, `<html><head><meta charset="utf-8"></head><body>${shareHtml}</body></html>`)
          log.info('Share dialog DOM snapshot saved', { driver: driver.id, path: shareDomPath })
        }
      } catch (e) {
        log.warn('Failed to save share dialog DOM snapshot', { driver: driver.id, error: String(e) })
      }
    }

    // 点击"复制链接"后，kimi 等平台可能弹出剪贴板权限提示框
    // （"www.kimi.com 想要查看复制到剪贴板的文字和图片 [允许] [屏蔽]"）。
    // 虽然 context.grantPermissions 已授予剪贴板权限，但部分平台仍会弹自定义 UI，
    // 需自动点击"允许"按钮，否则 navigator.clipboard.readText() 拿不到链接。
    await autoAllowClipboardPermission(page, driver.id)

    // 等待网络接口捕获分享链接（主路径）。page.waitForResponse() 在分享按钮点击前已注册，
    // 点击"复制链接"后平台发起分享 API 请求，waitForResponse 匹配后自动解析响应体。
    // waitForResponse 内部超时 30s（覆盖整个点击流程），外层 race 等 6s 后降级到 DOM/剪贴板方案。
    if (netCfg && shareResponsePromise) {
      let raceTimer: NodeJS.Timeout | undefined
      const captured = await Promise.race([
        shareResponsePromise,
        new Promise<undefined>((r) => { raceTimer = setTimeout(() => r(undefined), 6_000) }),
      ])
      if (raceTimer) clearTimeout(raceTimer)
      if (captured) {
        // 相对 URL 转绝对 URL（部分平台 buildUrl 可能返回 /share/xxx 相对路径）
        let resolvedUrl = captured
        if (resolvedUrl.startsWith('/')) {
          try { resolvedUrl = new URL(resolvedUrl, page.url()).href } catch { /* keep original */ }
        }
        log.info('Share URL resolved from network API', {
          driver: driver.id,
          urlPreview: resolvedUrl.substring(0, 80),
          urlLen: resolvedUrl.length,
        })
        await page.evaluate(() => {
          delete (window as any).__capturedShareUrl
          delete (window as any).__capturedClipboardWrite
        }).catch(() => {})
        await page.keyboard.press('Escape').catch(() => {})
        await new Promise((r) => setTimeout(r, 300))
        return resolvedUrl
      } else {
        log.info('Network share API did not capture URL (timeout or payload mismatch), falling back to DOM/clipboard', { driver: driver.id })
      }
    }

    await new Promise((r) => setTimeout(r, 500))

    if (page.isClosed()) {
      log.warn('Page closed after clicking copy-link', { driver: driver.id })
      const capturedText = await page.evaluate(() => {
        const fromCopy = (window as any).__capturedShareUrl || ''
        const fromWrite = (window as any).__capturedClipboardWrite || ''
        return fromWrite || fromCopy
      }).catch(() => '')
      const extracted = extractShareUrlFromText(capturedText, driver)
      if (extracted) return extracted
      if (pageUrlBeforeShare.includes('/chat/') || pageUrlBeforeShare.includes('/share/')) return pageUrlBeforeShare
      return undefined
    }

    // 从分享弹窗 DOM 直接提取链接
    // kimi 等平台在点击"复制链接"后，弹窗内会出现一个只读 input 显示分享 URL。
    // 注意：DOM 中可能存在侧边栏的 /chat/ 历史链接，需优先返回 /share/ 真分享链接。
    let shareUrl = ''
    let fallbackChatUrl = '' // 兜底用 /chat/ 链接（非真分享链接）
    const shareLinkSelectors = driver.selectors.shareLinkInput
    if (shareLinkSelectors && shareLinkSelectors.length > 0) {
      for (let attempt = 0; attempt < 4 && !shareUrl; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 600))
        try {
          for (const sel of shareLinkSelectors) {
            const domText = await page.evaluate((selector) => {
              const el = document.querySelector(selector) as
                | (HTMLInputElement & { value?: string })
                | (HTMLAnchorElement & { href?: string })
                | (HTMLElement & { textContent?: string })
                | null
              if (!el) return ''
              // 只读 input → 取 value
              if (el.tagName === 'INPUT' && typeof (el as HTMLInputElement).value === 'string') {
                return (el as HTMLInputElement).value
              }
              // <a> → 取 href
              if (el.tagName === 'A' && (el as HTMLAnchorElement).href) {
                return (el as HTMLAnchorElement).href
              }
              // 其他 → 取 textContent
              const text = (el.textContent || '').trim()
              return text
            }, sel).catch(() => '')
            const domUrl = extractShareUrlFromText(domText, driver)
            if (!domUrl) continue
            // 优先级：/share/ 链接是真分享链接，立即返回；
            // /chat/ 链接可能是侧边栏历史，仅作兜底候选。
            if (domUrl.includes('/share/')) {
              shareUrl = domUrl
              log.info('Share URL extracted from DOM', { driver: driver.id, attempt, selector: sel, urlPreview: shareUrl.substring(0, 80), urlLen: shareUrl.length })
              break
            }
            if (!fallbackChatUrl && domUrl.includes('/chat/')) {
              fallbackChatUrl = domUrl
              log.info('Fallback chat URL extracted from DOM', { driver: driver.id, attempt, selector: sel, urlPreview: fallbackChatUrl.substring(0, 80), urlLen: fallbackChatUrl.length })
            }
          }
        } catch { /* page may be detached */ }
      }
    }

    // 兜底1：从 copy 事件拦截器 / writeText hook 读取
    // 豆包等平台"复制链接"调用 navigator.clipboard.writeText() 而非 execCommand('copy')，
    // copy 事件不会触发，需依赖 writeText hook 捕获的 __capturedClipboardWrite。
    for (let attempt = 0; attempt < 4 && !shareUrl; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1_000))
      const capturedText = await page.evaluate(() => {
        const fromCopy = (window as any).__capturedShareUrl || ''
        const fromWrite = (window as any).__capturedClipboardWrite || ''
        return fromWrite || fromCopy
      }).catch(() => '')
      if (capturedText) {
        log.info('Captured text from hook', { driver: driver.id, attempt, textPreview: capturedText.substring(0, 300), textLen: capturedText.length })
      }
      const capturedUrl = extractShareUrlFromText(capturedText, driver)
      if (capturedUrl) {
        shareUrl = capturedUrl
        log.info('Share URL captured from writeText/copy hook', { driver: driver.id, attempt, urlPreview: shareUrl.substring(0, 80), urlLen: shareUrl.length })
        break
      }
    }

    // 兜底2：navigator.clipboard API（已通过 context.grantPermissions 授权，通常可用）
    // 元宝等平台"复制链接"写入的是 text/html 格式（含 JSON），readText() 只读 text/plain 拿不到。
    // 改用 read() 读取所有 MIME 类型，从 text/html 中提取分享URL。
    if (!shareUrl) {
      for (let attempt = 0; attempt < 3 && !shareUrl; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 500))
        // 先尝试 readText()（简单、兼容性好）
        const clipText = await page.evaluate(() => navigator.clipboard?.readText() || '').catch(() => '')
        const clipUrl = extractShareUrlFromText(clipText, driver)
        if (clipUrl) {
          shareUrl = clipUrl
          log.info('Share URL read from clipboard readText()', { driver: driver.id, attempt, urlPreview: shareUrl.substring(0, 80), urlLen: shareUrl.length })
          break
        }
        // readText() 拿不到有效URL，尝试 read() 读取所有格式（text/html 等）
        // 元宝剪贴板写入的是 text/html，包含完整分享URL
        const clipAllFormats = await page.evaluate(async () => {
          try {
            const items = await navigator.clipboard?.read()
            if (!items || items.length === 0) return { formats: [], contents: [] }
            const formats: string[] = []
            const contents: { mime: string; text: string }[] = []
            for (const item of items) {
              for (const type of item.types) {
                formats.push(type)
                if (type === 'text/html' || type === 'text/plain') {
                  const blob = await item.getType(type)
                  const text = await blob.text()
                  contents.push({ mime: type, text })
                }
              }
            }
            return { formats, contents }
          } catch (e) {
            return { formats: [], contents: [], error: String(e) }
          }
        }).catch(() => ({ formats: [], contents: [] }))

        // 打印剪贴板所有格式及内容预览便于调试
        const clipPreview = (clipAllFormats.contents || []).map((c: { mime: string; text: string }) => ({
          mime: c.mime,
          textPreview: c.text.substring(0, 300),
          textLen: c.text.length,
        }))
        log.info('Clipboard formats detected', {
          driver: driver.id,
          attempt,
          formats: clipAllFormats.formats,
          contentCount: clipAllFormats.contents?.length || 0,
          contents: clipPreview,
        })

        // 从所有格式内容中提取分享URL
        for (const { mime, text } of clipAllFormats.contents || []) {
          const url = extractShareUrlFromText(text, driver)
          if (url) {
            shareUrl = url
            log.info('Share URL extracted from clipboard format', { driver: driver.id, attempt, mime, urlPreview: shareUrl.substring(0, 80), urlLen: shareUrl.length, rawTextPreview: text.substring(0, 200) })
            break
          }
        }
      }
    }

    await page.evaluate(() => {
      delete (window as any).__capturedShareUrl
      delete (window as any).__capturedClipboardWrite
    }).catch(() => {})
    await page.keyboard.press('Escape').catch(() => {})
    await new Promise((r) => setTimeout(r, 500))

    if (!shareUrl) {
      // 所有提取方式都失败时，使用 DOM 兜底的 /chat/ 链接（可能是会话URL而非真分享链接）
      if (fallbackChatUrl) {
        shareUrl = fallbackChatUrl
        log.info('Using fallback chat URL as share link', { driver: driver.id, url: shareUrl, note: 'not a real /share/ link' })
      } else {
        const pageUrl = page.url()
        if (pageUrl.includes('/chat/') || pageUrl.includes('/share/')) {
          shareUrl = pageUrl
          log.info('Using page URL as share link fallback', { driver: driver.id, url: shareUrl })
        }
      }
    }

    if (shareUrl && shareUrl.startsWith('/')) {
      try {
        const pageUrl = page.url()
        const origin = new URL(pageUrl).origin
        shareUrl = origin + shareUrl
      } catch {}
    }

    if (shareUrl) log.info('Share link generated', { driver: driver.id, url: shareUrl })
    else {
      // 失败时打印所有候选源的完整内容，便于排障定位是哪一步出了问题
      const diag = await page.evaluate(() => {
        return {
          capturedShareUrl: (window as any).__capturedShareUrl || '',
          capturedClipboardWrite: (window as any).__capturedClipboardWrite || '',
          pageUrl: window.location.href,
        }
      }).catch(() => ({ capturedShareUrl: '', capturedClipboardWrite: '', pageUrl: '' }))
      log.warn('Share link URL not found after retries', {
        driver: driver.id,
        fallbackChatUrl,
        capturedShareUrl: diag.capturedShareUrl,
        capturedClipboardWrite: diag.capturedClipboardWrite,
        pageUrl: diag.pageUrl,
      })
    }

    return shareUrl || undefined
  } catch (err) {
    log.warn('Failed to generate share link', { driver: driver.id, error: String(err) })
    await page.keyboard.press('Escape').catch(() => {})
    return undefined
  } finally {
    await restoreClipboardHooks()
  }
}

// ---------------------------------------------------------------------------
// Driver resolution (mobile config merge)
// ---------------------------------------------------------------------------

function resolveDriver(input: GeoJobInput): ModelPlatformGeoDriver | undefined {
  return getGeoDriver(input.platformName)
}

// ---------------------------------------------------------------------------
// Main GEO job execution
// ---------------------------------------------------------------------------

async function queryModelPlatform(
  input: GeoJobInput,
  executablePath?: string,
): Promise<{
  answerText: string
  answerStatus: string
  screenshotKey?: string
  sessionRef?: string
  citations: GeoCitation[]
}> {
  const driver = resolveDriver(input)
  const platformName = input.platformName

  // 提前解析 platform config（用于 normalizeAuthUrl 运行时规范化）
  // 注意：model 平台才有 normalizeAuthUrl 配置，media 平台没有
  let platform: Platform | undefined
  try {
    const kind = resolvePlatformKind(platformName) as PlatformKind
    platform = requirePlatform(platformName, kind)
  } catch { /* platform not found, will fail later */ }

  let page: Page | undefined
  let browser: Browser | undefined

  // 解析授权凭证（如果有），用于获取授权时保存的 authUrl（含 agentId/conversationId）
  let credentials: { cookie: string; authUrl: string } | undefined
  if (input.encryptedSecret) {
    try {
      credentials = credentialService.decrypt(input.encryptedSecret)
    } catch (err) {
      log.warn('Failed to decrypt encryptedSecret', { error: String(err) })
    }
  }

  // entryUrl 优先级：
  // 1. 授权时保存的 authUrl（如元宝 https://yuanbao.tencent.com/chat/naQivTmsDa/0PeQZS8qyf2）
  //    —— 若平台配置了 normalizeAuthUrl，则先规范化（如元宝去除对话ID回到 /chat），
  //       否则旧授权记录中的对话ID会导致在旧对话中继续提问。
  //    注意：元宝 /api/chat/{conversationId} 请求中的 conversationId 来自页面 JS 状态，
  //          不是从 entryUrl 路径解析，所以规范化 entryUrl 不影响 API 请求。
  // 2. driver.entryUrl(siteEntryUrl) —— 通用 fallback
  // 3. siteEntryUrl / 默认值
  const baseUrl = input.siteEntryUrl || `https://chat.${platformName}.com/`
  let rawAuthUrl = credentials?.authUrl
  // 运行时规范化 authUrl：对已保存的旧授权记录同样生效，无需用户重新授权
  if (rawAuthUrl && platform?.normalizeAuthUrl) {
    const normalized = platform.normalizeAuthUrl(rawAuthUrl)
    if (normalized !== rawAuthUrl) {
      log.info('Normalized authUrl at runtime', {
        driver: driver?.id,
        before: rawAuthUrl,
        after: normalized,
      })
    }
    rawAuthUrl = normalized
  }
  const entryUrl = (input.terminalType === 2 && driver?.mobileEntryUrl)
    ? driver.mobileEntryUrl
    : (rawAuthUrl && /^https?:\/\//.test(rawAuthUrl))
      ? rawAuthUrl
      : (driver?.entryUrl(baseUrl) || input.siteEntryUrl || `https://chat.${platformName}.com/`)

  log.info('Resolved entry URL', {
    entryUrl,
    hasAuthUrl: !!credentials?.authUrl,
    authUrl: credentials?.authUrl,
    driverEntry: driver ? `${platformName}` : 'none',
  })

  try {
    const isMobile = input.terminalType === 2

    if (credentials) {
      // --- Cookie injection (from AuthService.prepareAuthenticatedPage) ---
      // platform 已在函数顶部提前解析（用于 normalizeAuthUrl 运行时规范化）
      if (!platform) {
        throw new Error(`Platform config not found: ${platformName}`)
      }
      const cookieSiteUrl = getCookieSiteUrl(platform)
      const targetUrl = getTargetUrl(platform, credentials.authUrl)

      browser = await launchBrowser({ stealth: platform.useStealth ?? true, executablePath })
      try {
        page = await getOrCreateMainPage(browser, isMobile ? {
          userAgent: MOBILE_UA,
          viewport: { width: 375, height: 667 },
          isMobile: true,
          hasTouch: true,
        } : undefined)
        page.setDefaultTimeout(45_000)

        const cookies = prepareAuthCookies(credentials.cookie, platform, cookieSiteUrl)
        const localStorage = platform.localStoragePersistFilter
          ? deserializeSessionLocalStorage(credentials.cookie)
          : undefined

        if (platform.preloadAuthState) {
          log.info('Preloading auth state before first navigation', { platformId: platformName })
          await applySessionCookies(page, cookies)
          if (localStorage) await preloadLocalStorage(page, cookieSiteUrl, localStorage)
        } else {
          await page.goto(cookieSiteUrl, { waitUntil: 'domcontentloaded' })
          await applySessionCookies(page, cookies)
          if (localStorage) await restoreLocalStorage(page, localStorage)
          await page.goto(cookieSiteUrl, { waitUntil: 'domcontentloaded' })
        }

        // Diagnostic: verify cookies actually stored in browser after injection
        try {
          const storedCookies = await page.context().cookies(cookieSiteUrl)
          log.info('Cookies stored in browser after injection', {
            url: cookieSiteUrl,
            count: storedCookies.length,
            summary: storedCookies.map((c) => ({
              name: c.name,
              domain: c.domain,
              path: c.path,
              sameSite: c.sameSite,
              secure: c.secure,
              httpOnly: c.httpOnly,
            })),
          })
        } catch (err) {
          log.warn('Failed to verify stored cookies', { error: String(err) })
        }

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
      } catch (err) {
        await browser.close().catch(() => {})
        throw err
      }
    } else {
      browser = await launchBrowser({ stealth: true, executablePath })
      page = await getOrCreateMainPage(browser, isMobile ? {
        userAgent: MOBILE_UA,
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
      } : undefined)
      page.setDefaultTimeout(45_000)
    }

    log.info('Preparing model platform', {
      taskId: input.taskId,
      terminalType: input.terminalType,
      hasLoginSession: !!input.encryptedSecret,
      usingMobileConfig: isMobile,
    })

    try {
      await page.goto(entryUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    } catch (navErr) {
      log.warn('Navigation failed, trying to continue anyway', { driver: driver?.id, error: String(navErr) })
    }

    if (!page || !browser) throw new Error('Failed to prepare model platform page')

    if (driver) {
      // 等待骨架屏消失（特别是 yb-layout__content-skeleton），避免输入框未准备好就输入
      // 修复：之前只检查 display/visibility/width>0，漏掉了 opacity:0 / height:0 / transform 移出 /
      //       class 中包含 "hide"/"leaving"/"fade" 等多种隐藏方式。另外超时从 15s → 20s，避免误判。
      const skeletonTimeout = 20_000
      const skeletonStart = Date.now()
      let lastLogAt = 0
      while (Date.now() - skeletonStart < skeletonTimeout) {
        const skeletonVisible = await page.evaluate(() => {
          const HIDE_CLASS_RE = /skeleton--hide|skeleton--hidden|skeleton--leave|skeleton--fade|skeleton--done|hidden|invisible|leaving|fade-out|is-hidden|is-leaving/i
          const skels = document.querySelectorAll(
            '.yb-layout__content-skeleton, .yb-layout__input-skeleton, [class*="skeleton"]'
          )
          for (const el of Array.from(skels)) {
            const cls = (el as HTMLElement).className || ''
            // 快速路径：class 名包含任何隐藏关键词 → 认为已隐藏
            if (HIDE_CLASS_RE.test(cls)) continue
            const style = window.getComputedStyle(el)
            const rect = el.getBoundingClientRect()
            // 任何一个条件满足都说明"视觉上不可见"
            const visuallyHidden =
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              style.visibility === 'collapse' ||
              parseFloat(style.opacity) <= 0.05 || // opacity 几乎为 0
              rect.width <= 1 ||                    // 宽高为 0 或 1px
              rect.height <= 1 ||
              style.pointerEvents === 'none' && parseFloat(style.opacity) <= 0.3 || // 元宝的骨架屏
              rect.top + rect.height < 0 ||         // 移出视口顶部
              rect.left + rect.width < 0 ||         // 移出视口左侧
              (parseInt(style.zIndex, 10) < 0 && parseFloat(style.opacity) <= 0.5) // 在底层且半透明
            if (!visuallyHidden) return true
          }
          return false
        }).catch(() => false)
        if (!skeletonVisible) break
        // 每 5 秒打一次进度日志，便于诊断是否真的卡住
        if (Date.now() - lastLogAt > 5_000) {
          lastLogAt = Date.now()
          log.debug('Waiting for skeleton to hide...', { driver: driver.id, elapsedMs: Date.now() - skeletonStart })
        }
        await new Promise((r) => setTimeout(r, 500))
      }
      const waitedForSkeleton = Date.now() - skeletonStart
      if (waitedForSkeleton >= skeletonTimeout) {
        log.warn('Skeleton still visible after timeout, proceeding anyway', { driver: driver.id, waitedForSkeleton })
      } else if (waitedForSkeleton > 500) {
        log.info('Waited for skeleton to disappear', { driver: driver.id, waitedForSkeleton })
      }

      const ready = await findElement(page, driver.selectors.input, 20_000)
      if (!ready) {
        log.warn('Input not ready after 20s, waiting network idle', { driver: driver.id })
        await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
      }
    } else {
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
    }

    let answerText = ''
    let citations: GeoCitation[] = []

    if (driver) {
      let inputSucceeded = false
      try {
        await startNewConversation(page, driver)
        await executeInputSteps(page, driver, input.question)
        inputSucceeded = true
        const { ctx, isIframe } = await getAnswerContext(page, driver)
        if (isIframe) log.info('Answer context is iframe', { driver: driver.id })
        const container = await waitForAnswerContainer(ctx, driver)
        await waitForAnswerStable(ctx, driver, container ?? undefined)
        answerText = await extractAnswerText(ctx, driver)
        citations = await extractCitations(ctx, driver)
        log.info('Driver-specific extraction succeeded', { driver: driver.id, answerLength: answerText.length, citationCount: citations.length })
      } catch (err) {
        if (!inputSucceeded) {
          log.error('Input failed, skipping fallback extraction', { driver: driver.id, error: String(err) })
          throw err
        }
        log.warn('Driver-specific extraction failed, falling back', { driver: driver.id, error: String(err) })
        if (isDetachedFrameError(err) && page && !page.isClosed()) {
          log.info('Detached frame detected, waiting for page to settle', { driver: driver.id })
          await new Promise((r) => setTimeout(r, 2_000))
          await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10_000 }).catch(() => {})
        }
        const fallbackCtx: ExecutionContext = (await getAnswerContext(page, driver).catch(() => ({ ctx: page as ExecutionContext, isIframe: false }))).ctx
        answerText = await extractAnswerText(fallbackCtx, driver).catch((e: unknown) => {
          log.warn('Fallback extractAnswerText failed', { driver: driver.id, error: String(e) })
          return ''
        })
        citations = await extractCitations(fallbackCtx, driver).catch((e: unknown) => {
          log.warn('Fallback extractCitations failed', { driver: driver.id, error: String(e) })
          return []
        })
      }
    } else {
      answerText = await page.evaluate(() => {
        const selector = 'article, [role="main"], .markdown-body, .message-content, .answer-content, .chat-message, main'
        const el = document.querySelector(selector)
        return ((el as HTMLElement | null) ?? document.body).innerText || document.body.textContent || ''
      })
      citations = (await page.$$eval('a[href]', (anchors) =>
        anchors
          .map((a, index) => ({
            url: (a as HTMLAnchorElement).href,
            title: a.textContent?.trim() || '',
            index,
          }))
          .filter((item) => item.url.startsWith('http')),
      )).slice(0, 10).map((link, i) => ({
        url: link.url,
        domain: domainFromUrl(link.url),
        title: link.title,
        position: i + 1,
        isEnterpriseSource: false,
      }))
    }

    const screenshotKey = await saveScreenshot(page, `geo-${platformName}-${input.taskId}`)

    let sessionRef = page.url()
    // 平台特化：通过 driver.shouldSkipShareLink 判断是否跳过分享链接生成。
    // 典型场景：智谱移动端没有分享按钮，terminalType=2 时跳过，直接用页面 URL。
    const skipShareLink = driver?.shouldSkipShareLink?.(input.terminalType ?? 1) ?? false
    if (skipShareLink && driver) {
      log.info('Skipping share link generation (platform hook)', { driver: driver.id, terminalType: input.terminalType, sessionRef })
    } else if (driver?.selectors.shareButton && !page.isClosed()) {
      try {
        const shareLink = await generateShareLink(page, driver)
        if (shareLink) {
          sessionRef = shareLink
          // 完整 URL 已在 generateShareLink 内部 'Share link generated' 日志输出，此处仅确认获取成功
          log.info('Share link obtained', { driver: driver.id, urlLen: shareLink.length })
        }
      } catch (shareErr) {
        log.warn('Share link generation failed', { driver: driver.id, error: String(shareErr) })
      }
    }

    const answerStatus = answerText.length >= 50 ? 'valid' : answerText.length > 0 ? 'too_short' : 'empty'
    // P0-2：回答为空或过短时抛错，让任务标记为失败而非"完成"，便于上层重试。
    // 这通常发生在：验证码未通过、登录态失效、页面风控灰屏、选择器失配等异常场景。
    if (answerStatus !== 'valid') {
      const reason = answerStatus === 'empty' ? '回答内容为空' : `回答内容过短（${answerText.length} 字符）`
      log.error('Answer extraction failed, marking task as failed', {
        platformName,
        taskId: input.taskId,
        answerStatus,
        answerLength: answerText.length,
        reason,
      })
      throw new Error(`GEO 任务失败：${reason}（可能原因：验证码未通过/登录态失效/页面风控）`)
    }

    return {
      answerText: answerText.slice(0, 32_000),
      answerStatus,
      screenshotKey,
      sessionRef,
      citations,
    }
  } catch (err) {
    log.error('GEO query failed', { platformName, error: String(err) })
    if (page && !page.isClosed()) {
      await saveScreenshot(page, `geo-failed-${platformName}-${input.taskId}`).catch(() => {})
    }
    throw err
  } finally {
    // 调试模式：__GEO_KEEP_OPEN__ 由 IPC 入口设置；为 true 时保持浏览器打开手动 F12 检查
    const keepOpenForDebug = Boolean((globalThis as { __GEO_KEEP_OPEN__?: boolean }).__GEO_KEEP_OPEN__)
    if (keepOpenForDebug) {
      log.warn('DEBUG MODE: 保持浏览器打开不关闭，可手动 F12 检查，检查完毕请手动关闭窗口', {
        platformName,
      })
      if (browser) {
        browser.once('disconnected', () => process.exit(0))
      }
    } else if (browser) {
      await browser.close().catch((e) => {
        log.warn('browser.close failed', { platformName, error: String(e) })
      })
    }
  }
}

// ---------------------------------------------------------------------------
// IPC handler
// ---------------------------------------------------------------------------

let shouldKeepOpen = false

process.on('message', async (msg: {
  type: string
  input?: GeoJobInput
  executablePath?: string
  evidenceDir?: string
}) => {
  if (msg.type !== 'geo-job' || !msg.input) {
    log.warn('Unknown message type', { type: msg.type })
    return
  }

  if (msg.evidenceDir) {
    EVIDENCE_DIR = msg.evidenceDir
  }
  ensureEvidenceDir()

  log.info('GEO job received (worker)', {
    jobId: msg.input.jobId,
    platformName: msg.input.platformName,
    taskId: msg.input.taskId,
  })

  // 调试开关：调试纳米/文心移动端分享时设为 true 可保持浏览器打开手动 F12 检查；
  // 正式运行时设为 false，任务完成后自动关闭浏览器。
  shouldKeepOpen = false
  ;(globalThis as { __GEO_KEEP_OPEN__?: boolean }).__GEO_KEEP_OPEN__ = shouldKeepOpen

  try {
    const result = await queryModelPlatform(msg.input, msg.executablePath)
    process.send?.({ type: 'result', result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    log.error('GEO job failed (worker)', { message, stack })
    process.send?.({ type: 'error', message, stack })
  }

  // 调试模式下不退出进程，等用户手动关闭浏览器后由 disconnected 事件退出
  if (!shouldKeepOpen) {
    process.exit(0)
  } else {
    log.info('DEBUG MODE: worker 进程不退出，等待手动关闭浏览器后结束')
  }
})

process.on('disconnect', () => {
  log.warn('Parent disconnected, exiting')
  process.exit(1)
})

log.info('Geo worker started', { pid: process.pid })
