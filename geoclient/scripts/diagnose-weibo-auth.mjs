/**
 * Diagnose Weibo authorization capture and replay with fresh Puppeteer profiles.
 *
 * Usage:
 *   pnpm diagnose:weibo-auth
 *   WEIBO_CAPTURE_FILE=tmp-auth-diagnose/weibo-capture-latest.json pnpm diagnose:weibo-auth
 *
 * Manual-login flow:
 *   1. Complete login in the opened Google Chrome for Testing window.
 *   2. Keep the logged-in page open.
 *   3. In another terminal run:
 *        touch /tmp/geohelper-weibo-auth-ready
 *
 * Credential values are written only to the gitignored tmp-auth-diagnose/
 * directory with mode 0600. Do not share the generated JSON files.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import puppeteerExtra from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDir, '..')
const outDir = path.join(root, 'tmp-auth-diagnose')
const readyFile = '/tmp/geohelper-weibo-auth-ready'
const replayWaitMs = Number(process.env.WEIBO_REPLAY_WAIT_MS || 5_000)
const fixedUserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'

const platform = {
  loginUrl: 'https://weibo.com/',
  targetUrl: 'https://weibo.com/',
  cookieSiteUrl: 'https://weibo.com',
  cookieDomains: ['weibo.com', 'sina.com.cn'],
  sessionCookieName: 'SUB',
}

const configuredLocalStorageKeys = new Set([
  'V7_PLAYER_VOLUME',
  'aria',
  'autoplaySigns',
  'right_search_tab',
])
const authCookieNames = new Set([
  'SUB',
  'SUBP',
  'WBPSESS',
  'SCF',
  'XSRF-TOKEN',
  'ALF',
])

let stealthPluginReady = false

function sanitizeLabel(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '')
}

function timestampLabel() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function writePrivateJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
}

function resolveChromeExecutable() {
  const candidates = [process.env.PUPPETEER_EXECUTABLE_PATH]
  try {
    candidates.push(puppeteer.executablePath())
  } catch {
    // The explicit missing-browser error below is more useful.
  }

  const executablePath = candidates.find(
    (candidate) => candidate && fs.existsSync(candidate),
  )
  if (!executablePath) {
    throw new Error(
      '未找到 Puppeteer 的 Google Chrome for Testing，请先安装项目声明的 Puppeteer 浏览器。',
    )
  }
  return executablePath
}

function getLauncher(stealth) {
  if (!stealth) return puppeteer
  if (!stealthPluginReady) {
    const plugin = StealthPlugin()
    plugin.enabledEvasions.delete('iframe.contentWindow')
    plugin.enabledEvasions.delete('navigator.permissions')
    plugin.enabledEvasions.delete('chrome.runtime')
    plugin.enabledEvasions.delete('user-agent-override')
    puppeteerExtra.use(plugin)
    stealthPluginReady = true
  }
  return puppeteerExtra
}

async function launchBrowser(label, stealth) {
  const executablePath = resolveChromeExecutable()
  const browser = await getLauncher(stealth).launch({
    headless: false,
    executablePath,
    defaultViewport: { width: 1366, height: 900 },
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      `--user-agent=${fixedUserAgent}`,
    ],
  })

  const spawnArgs = browser.process()?.spawnargs ?? []
  const profileArg = spawnArgs.find((arg) => arg.startsWith('--user-data-dir='))
  console.log(`[browser:${label}] stealth=${stealth}`)
  console.log(`[browser:${label}] executable=${executablePath}`)
  console.log(`[browser:${label}] ${profileArg || 'temporary profile managed by Puppeteer'}`)
  return browser
}

function waitForReadyFile(timeoutMs = 20 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(readyFile)) fs.unlinkSync(readyFile)
    const startedAt = Date.now()
    const timer = setInterval(() => {
      if (fs.existsSync(readyFile)) {
        clearInterval(timer)
        fs.unlinkSync(readyFile)
        resolve()
        return
      }
      if (Date.now() - startedAt > timeoutMs) {
        clearInterval(timer)
        reject(new Error('等待微博手动登录超时'))
      }
    }, 800)
  })
}

async function getAllCookies(page) {
  const client = await page.createCDPSession()
  const { cookies } = await client.send('Network.getAllCookies')
  return cookies
}

function cookieMatchesScope(cookie) {
  const domain = String(cookie.domain || '').replace(/^\./, '')
  if (!domain) return false
  return platform.cookieDomains.some(
    (rootDomain) =>
      domain === rootDomain ||
      domain.endsWith(`.${rootDomain}`) ||
      rootDomain.endsWith(`.${domain}`),
  )
}

function summarizeCookies(cookies) {
  return cookies.map((cookie) => ({
    name: cookie.name,
    domain: cookie.domain,
    path: cookie.path || '/',
    secure: Boolean(cookie.secure),
    httpOnly: Boolean(cookie.httpOnly),
    sameSite: cookie.sameSite,
    expires: cookie.expires,
    session: cookie.session === true || !cookie.expires || cookie.expires <= 0,
    valueLength: String(cookie.value || '').length,
  }))
}

function toStoredCookies(cookies) {
  return cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || '/',
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    expires: cookie.expires,
    session: cookie.session,
  }))
}

async function dumpStorage(page, storageName) {
  try {
    return await page.evaluate((name) => {
      const storage = name === 'sessionStorage' ? sessionStorage : localStorage
      const entries = {}
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index)
        if (!key) continue
        const value = storage.getItem(key)
        if (value !== null) entries[key] = value
      }
      return entries
    }, storageName)
  } catch {
    return {}
  }
}

async function inspectPage(page) {
  const [localStorageEntries, sessionStorageEntries, visibleText, cookies] =
    await Promise.all([
      dumpStorage(page, 'localStorage'),
      dumpStorage(page, 'sessionStorage'),
      page
        .evaluate(() =>
          Array.from(document.body?.innerText || '').slice(0, 8_000).join(''),
        )
        .catch(() => ''),
      page.cookies(platform.cookieSiteUrl).catch(() => []),
    ])

  const url = page.url()
  const cookieNames = [...new Set(cookies.map((cookie) => cookie.name))].sort()
  const loginRoute =
    /passport\.weibo\.com|\/login(?:[/?#]|$)|weibo\.com\/newlogin/i.test(url)
  const hasSessionCookie = cookies.some(
    (cookie) =>
      cookie.name === platform.sessionCookieName && cookie.value.trim().length > 0,
  )
  const loggedIn = !loginRoute && hasSessionCookie

  return {
    url,
    loggedIn,
    loginRoute,
    hasSessionCookie,
    cookieNames,
    localStorageKeys: Object.keys(localStorageEntries).sort(),
    sessionStorageKeys: Object.keys(sessionStorageEntries).sort(),
    textSample: Array.from(visibleText).slice(0, 500).join('').replace(/\s+/g, ' '),
  }
}

async function chooseCapturePage(browser) {
  const pages = (await browser.pages()).filter((page) =>
    /(?:weibo\.com|sina\.com\.cn)/i.test(page.url()),
  )
  if (!pages.length) throw new Error('未找到微博页面')

  const inspected = await Promise.all(
    pages.map(async (page) => ({ page, signals: await inspectPage(page) })),
  )
  inspected.sort((left, right) => {
    const score = (item) =>
      (item.signals.loggedIn ? 100 : 0) +
      (!item.signals.loginRoute ? 20 : 0) +
      (item.signals.hasSessionCookie ? 10 : 0)
    return score(right) - score(left)
  })
  return inspected[0]
}

async function applyCookies(page, cookies) {
  const ok = []
  const failed = []
  for (const cookie of cookies) {
    try {
      const param = {
        name: cookie.name,
        value: cookie.value,
        path: cookie.path || '/',
      }
      if (cookie.domain) param.domain = cookie.domain
      else param.url = platform.cookieSiteUrl
      if (cookie.secure !== undefined) param.secure = cookie.secure
      if (cookie.httpOnly !== undefined) param.httpOnly = cookie.httpOnly
      if (cookie.sameSite) param.sameSite = cookie.sameSite
      if (cookie.expires && cookie.expires > 0) param.expires = cookie.expires
      await page.setCookie(param)
      ok.push(`${cookie.name}@${cookie.domain || 'weibo.com'}`)
    } catch (error) {
      failed.push({
        name: cookie.name,
        domain: cookie.domain,
        error: String(error?.message || error),
      })
    }
  }
  return { ok, failed }
}

async function restoreStorage(page, localStorageEntries, sessionStorageEntries) {
  await page.evaluate(
    ({ localEntries, sessionEntries }) => {
      for (const [key, value] of Object.entries(localEntries || {})) {
        localStorage.setItem(key, value)
      }
      for (const [key, value] of Object.entries(sessionEntries || {})) {
        sessionStorage.setItem(key, value)
      }
    },
    { localEntries: localStorageEntries, sessionEntries: sessionStorageEntries },
  )
}

async function installStoragePreload(page, localStorageEntries, sessionStorageEntries) {
  const targetOrigin = new URL(platform.cookieSiteUrl).origin
  await page.evaluateOnNewDocument(
    ({ origin, localEntries, sessionEntries }) => {
      if (location.origin !== origin) return
      for (const [key, value] of Object.entries(localEntries || {})) {
        localStorage.setItem(key, value)
      }
      for (const [key, value] of Object.entries(sessionEntries || {})) {
        sessionStorage.setItem(key, value)
      }
    },
    {
      origin: targetOrigin,
      localEntries: localStorageEntries,
      sessionEntries: sessionStorageEntries,
    },
  )
}

async function gotoForReplay(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
  } catch (error) {
    if (!String(error?.message || error).includes('net::ERR_ABORTED')) {
      throw error
    }
    console.log(`[navigation] Weibo replaced navigation for ${url}; continuing`)
  }
}

async function replayOnce(testCase, runLabel) {
  const browser = await launchBrowser(testCase.label, testCase.stealth)
  try {
    const page = (await browser.pages())[0] || (await browser.newPage())
    await page.setUserAgent(fixedUserAgent)
    page.setDefaultTimeout(45_000)

    let applyResult
    if (testCase.order === 'preload') {
      applyResult = await applyCookies(page, testCase.cookies)
      await installStoragePreload(
        page,
        testCase.localStorage,
        testCase.sessionStorage,
      )
      await gotoForReplay(page, platform.targetUrl)
    } else {
      await gotoForReplay(page, platform.cookieSiteUrl)
      applyResult = await applyCookies(page, testCase.cookies)
      await restoreStorage(page, testCase.localStorage, testCase.sessionStorage)
      await gotoForReplay(page, platform.cookieSiteUrl)
      await gotoForReplay(page, platform.targetUrl)
    }

    await new Promise((resolve) => setTimeout(resolve, replayWaitMs))
    const signals = await inspectPage(page)
    const result = {
      label: testCase.label,
      order: testCase.order,
      stealth: testCase.stealth,
      inputCookieNames: testCase.cookies.map(
        (cookie) => `${cookie.name}@${cookie.domain || '-'}`,
      ),
      inputLocalStorageKeys: Object.keys(testCase.localStorage || {}).sort(),
      inputSessionStorageKeys: Object.keys(testCase.sessionStorage || {}).sort(),
      setCookieOk: applyResult.ok,
      setCookieFailed: applyResult.failed,
      signals,
    }

    const resultPath = path.join(
      outDir,
      `weibo-replay-${runLabel}-${sanitizeLabel(testCase.label)}.json`,
    )
    writePrivateJson(resultPath, result)
    await page.screenshot({
      path: path.join(
        outDir,
        `weibo-replay-${runLabel}-${sanitizeLabel(testCase.label)}.png`,
      ),
      fullPage: false,
    })

    console.log(
      `[replay:${testCase.label}] loggedIn=${signals.loggedIn} url=${signals.url}`,
    )
    console.log(
      `[replay:${testCase.label}] cookies=${signals.cookieNames.join(',') || '(none)'}`,
    )
    if (applyResult.failed.length) {
      console.log(`[replay:${testCase.label}] setCookie failures:`, applyResult.failed)
    }
    return result
  } finally {
    await browser.close().catch(() => {})
  }
}

function pickConfiguredLocalStorage(entries) {
  return Object.fromEntries(
    Object.entries(entries).filter(
      ([key]) => configuredLocalStorageKeys.has(key) || key.endsWith('_degraded'),
    ),
  )
}

async function captureManualLogin(runLabel) {
  console.log(`Manual-login signal: touch ${readyFile}`)
  const browser = await launchBrowser('manual-login', false)
  try {
    const page = (await browser.pages())[0] || (await browser.newPage())
    await page.setUserAgent(fixedUserAgent)
    await page.goto(platform.loginUrl, { waitUntil: 'domcontentloaded' })

    console.log('请在打开的 Chrome for Testing 中完成微博登录。')
    console.log(`确认进入登录后的微博页面后执行：touch ${readyFile}`)
    await waitForReadyFile()
    await new Promise((resolve) => setTimeout(resolve, 2_000))

    const selected = await chooseCapturePage(browser)
    const capturePage = selected.page
    const signals = await inspectPage(capturePage)
    if (!signals.loggedIn) {
      throw new Error(
        `当前 Chrome for Testing 尚未形成可验证的微博登录态：url=${signals.url} cookies=${signals.cookieNames.join(',') || '(none)'}`,
      )
    }

    const allCookies = await getAllCookies(capturePage)
    const scopedCookies = allCookies.filter(cookieMatchesScope)
    const localStorageEntries = await dumpStorage(capturePage, 'localStorage')
    const sessionStorageEntries = await dumpStorage(capturePage, 'sessionStorage')
    const capture = {
      capturedAt: new Date().toISOString(),
      executablePath: resolveChromeExecutable(),
      pageUrl: capturePage.url(),
      signals,
      allCookies: summarizeCookies(allCookies),
      scopedCookies: summarizeCookies(scopedCookies),
      allCookiesFull: toStoredCookies(allCookies),
      scopedCookiesFull: toStoredCookies(scopedCookies),
      localStorageFull: localStorageEntries,
      sessionStorageFull: sessionStorageEntries,
    }

    const capturePath = path.join(outDir, `weibo-capture-${runLabel}.json`)
    writePrivateJson(capturePath, capture)
    writePrivateJson(path.join(outDir, 'weibo-capture-latest.json'), capture)

    console.log('=== Capture summary (values hidden) ===')
    console.log(`page=${signals.url}`)
    console.log(
      `allCookies=${allCookies.length} scopedCookies=${scopedCookies.length}`,
    )
    console.log(
      `scoped cookie names=${scopedCookies.map((cookie) => `${cookie.name}@${cookie.domain}`).join(',')}`,
    )
    console.log(
      `localStorage keys=${Object.keys(localStorageEntries).sort().join(',')}`,
    )
    console.log(
      `sessionStorage keys=${Object.keys(sessionStorageEntries).sort().join(',')}`,
    )
    console.log(`capture saved=${capturePath}`)
    return capture
  } finally {
    await browser.close().catch(() => {})
  }
}

function loadCapture(filePath) {
  const resolvedPath = path.resolve(root, filePath)
  const capture = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
  if (
    !Array.isArray(capture?.scopedCookiesFull) ||
    typeof capture?.localStorageFull !== 'object' ||
    typeof capture?.sessionStorageFull !== 'object'
  ) {
    throw new Error(`无效的微博授权捕获文件：${resolvedPath}`)
  }
  console.log(`Replaying existing capture=${resolvedPath}`)
  return capture
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 })
  const runLabel = timestampLabel()
  console.log('=== Weibo authorization capture and replay diagnosis ===')

  const capture = process.env.WEIBO_CAPTURE_FILE
    ? loadCapture(process.env.WEIBO_CAPTURE_FILE)
    : await captureManualLogin(runLabel)
  const scopedCookies = capture.scopedCookiesFull
  const allLocalStorage = capture.localStorageFull
  const allSessionStorage = capture.sessionStorageFull
  const configuredLocalStorage = pickConfiguredLocalStorage(allLocalStorage)
  const coreCookies = scopedCookies.filter((cookie) =>
    authCookieNames.has(cookie.name),
  )
  const subCookies = scopedCookies.filter((cookie) => cookie.name === 'SUB')
  const weiboSubCookies = subCookies.filter(
    (cookie) => String(cookie.domain || '').replace(/^\./, '') === 'weibo.com',
  )
  const sinaSubCookies = subCookies.filter(
    (cookie) => String(cookie.domain || '').replace(/^\./, '') === 'sina.com.cn',
  )
  const subAndSubpCookies = scopedCookies.filter(
    (cookie) => cookie.name === 'SUB' || cookie.name === 'SUBP',
  )

  const baseCases = [
    {
      label: 'production-stealth-configured-storage',
      order: 'production',
      stealth: true,
      cookies: scopedCookies,
      localStorage: configuredLocalStorage,
      sessionStorage: {},
    },
    {
      label: 'production-stealth-cookies-only',
      order: 'production',
      stealth: true,
      cookies: scopedCookies,
      localStorage: {},
      sessionStorage: {},
    },
    {
      label: 'production-plain-all-storage',
      order: 'production',
      stealth: false,
      cookies: scopedCookies,
      localStorage: allLocalStorage,
      sessionStorage: allSessionStorage,
    },
    {
      label: 'preload-plain-cookies-only',
      order: 'preload',
      stealth: false,
      cookies: scopedCookies,
      localStorage: {},
      sessionStorage: {},
    },
    {
      label: 'preload-stealth-cookies-only',
      order: 'preload',
      stealth: true,
      cookies: scopedCookies,
      localStorage: {},
      sessionStorage: {},
    },
    {
      label: 'preload-stealth-configured-storage',
      order: 'preload',
      stealth: true,
      cookies: scopedCookies,
      localStorage: configuredLocalStorage,
      sessionStorage: {},
    },
    {
      label: 'preload-plain-core-cookies-only',
      order: 'preload',
      stealth: false,
      cookies: coreCookies,
      localStorage: {},
      sessionStorage: {},
    },
    {
      label: 'preload-stealth-sub-only',
      order: 'preload',
      stealth: true,
      cookies: subCookies,
      localStorage: {},
      sessionStorage: {},
    },
    {
      label: 'preload-stealth-weibo-sub-only',
      order: 'preload',
      stealth: true,
      cookies: weiboSubCookies,
      localStorage: {},
      sessionStorage: {},
    },
    {
      label: 'preload-stealth-sina-sub-only',
      order: 'preload',
      stealth: true,
      cookies: sinaSubCookies,
      localStorage: {},
      sessionStorage: {},
    },
    {
      label: 'preload-stealth-sub-subp-only',
      order: 'preload',
      stealth: true,
      cookies: subAndSubpCookies,
      localStorage: {},
      sessionStorage: {},
    },
  ]

  console.log('=== Running replay baselines ===')
  const baseResults = []
  for (const testCase of baseCases) {
    baseResults.push(await replayOnce(testCase, runLabel))
  }

  const preferredLabels = [
    'production-stealth-configured-storage',
    'production-stealth-cookies-only',
    'preload-stealth-cookies-only',
    'preload-plain-cookies-only',
  ]
  const successfulBase = preferredLabels
    .map((label) => baseResults.find((result) => result.label === label))
    .find((result) => result?.signals.loggedIn)

  const stabilityResults = []
  const removalResults = []
  let removalBaselineStable = false
  if (successfulBase) {
    const sourceCase = baseCases.find(
      (testCase) => testCase.label === successfulBase.label,
    )
    console.log(`=== Checking replay stability for ${sourceCase.label} ===`)
    for (let attempt = 1; attempt <= 2; attempt++) {
      stabilityResults.push(
        await replayOnce(
          {
            ...sourceCase,
            label: `${sourceCase.label}-stability-${attempt}`,
          },
          runLabel,
        ),
      )
    }
    removalBaselineStable = stabilityResults.every(
      (result) => result.signals.loggedIn,
    )

    if (removalBaselineStable) {
      const candidateCookieNames = [
        ...new Set(
          sourceCase.cookies
            .filter((cookie) => authCookieNames.has(cookie.name))
            .map((cookie) => cookie.name),
        ),
      ]
      console.log(`=== Removal matrix based on ${sourceCase.label} ===`)
      for (const removedName of candidateCookieNames) {
        removalResults.push(
          await replayOnce(
            {
              ...sourceCase,
              label: `without-cookie-name-${sanitizeLabel(removedName)}`,
              cookies: sourceCase.cookies.filter(
                (cookie) => cookie.name !== removedName,
              ),
            },
            runLabel,
          ),
        )
      }
    } else {
      console.log(
        'Replay baseline is not stable; skipping removal tests to avoid false conclusions.',
      )
    }
  }

  const diagnosis = {
    generatedAt: new Date().toISOString(),
    capture: {
      pageUrl: capture.pageUrl,
      scopedCookieNames: capture.scopedCookies.map(
        (cookie) => `${cookie.name}@${cookie.domain}`,
      ),
      localStorageKeys: Object.keys(capture.localStorageFull).sort(),
      sessionStorageKeys: Object.keys(capture.sessionStorageFull).sort(),
    },
    baseResults,
    stabilityResults,
    removalResults,
    successfulBase: successfulBase?.label || null,
    removalBaselineStable,
    requiredByRemovalTest: removalResults
      .filter((result) => !result.signals.loggedIn)
      .map((result) => result.label),
    notes: [
      'Current production behavior is represented by production-stealth-configured-storage.',
      'Removal tests run only after two repeated successful baseline replays.',
      'If only preload cases succeed, the production restore order is wrong.',
      'If only plain cases succeed, stealth changes the Weibo runtime incompatibly.',
    ],
  }

  const diagnosisPath = path.join(outDir, `weibo-diagnosis-${runLabel}.json`)
  writePrivateJson(diagnosisPath, diagnosis)
  writePrivateJson(path.join(outDir, 'weibo-diagnosis-latest.json'), diagnosis)

  console.log('=== Final diagnosis ===')
  console.log(`successfulBase=${diagnosis.successfulBase || '(none)'}`)
  console.log(`removalBaselineStable=${diagnosis.removalBaselineStable}`)
  console.log(
    `requiredByRemovalTest=${diagnosis.requiredByRemovalTest.join(',') || '(none established)'}`,
  )
  console.log(`diagnosis saved=${diagnosisPath}`)
}

main().catch((error) => {
  console.error('[diagnose-weibo-auth] failed:', error)
  process.exitCode = 1
})
