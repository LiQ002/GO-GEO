/**
 * Diagnose Sohu auth capture and replay with fresh Puppeteer profiles.
 *
 * Usage:
 *   pnpm diagnose:sohu-auth
 *   SOHU_CAPTURE_FILE=tmp-auth-diagnose/sohu-capture-latest.json pnpm diagnose:sohu-auth
 *
 * Flow:
 *   1. The script opens Sohu in Google Chrome for Testing.
 *   2. Complete login manually, but do not log out or close the browser.
 *   3. In another terminal run:
 *        touch /tmp/geohelper-sohu-auth-ready
 *   4. The script captures all cookies/localStorage/sessionStorage and runs
 *      isolated replay cases, including one-by-one removal tests.
 *
 * Full credential values are written only to tmp-auth-diagnose/, which is
 * gitignored. Do not share the generated JSON files.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDir, '..')
const outDir = path.join(root, 'tmp-auth-diagnose')
const readyFile = '/tmp/geohelper-sohu-auth-ready'
const replayWaitMs = Number(process.env.SOHU_REPLAY_WAIT_MS || 5_000)
const fixedUserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'

const platform = {
  loginUrl: 'https://mp.sohu.com/mpfe/v4/login',
  targetUrl: 'https://mp.sohu.com/mpfe/v4/entry/create',
  cookieSiteUrl: 'https://mp.sohu.com',
  cookieDomain: '.sohu.com',
}

const authCookieNames = new Set(['ppinf', 'mpToken', 'pprdig', 'ppmdig', 'mp-cv'])
const sessionCookieNames = new Set(['ppinf', 'mpToken'])
const criticalLocalStorageKeys = ['ticket', 'currentAccount', 'vuex']
const criticalSessionStorageKeys = ['dv-id', 'vuex']

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
    // Puppeteer reports a clearer missing-browser error below.
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

async function launchBrowser(label) {
  const executablePath = resolveChromeExecutable()
  const browser = await puppeteer.launch({
    headless: false,
    executablePath,
    defaultViewport: { width: 1366, height: 900 },
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      `--user-agent=${fixedUserAgent}`,
    ],
  })

  const spawnArgs = browser.process()?.spawnargs ?? []
  const profileArg = spawnArgs.find((arg) => arg.startsWith('--user-data-dir='))
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
        reject(new Error('等待搜狐手动登录超时'))
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
  const host = new URL(platform.cookieSiteUrl).hostname
  const rootDomain = platform.cookieDomain.replace(/^\./, '')
  const domain = String(cookie.domain || '').replace(/^\./, '')
  if (!domain) return false
  return (
    domain === host ||
    domain === rootDomain ||
    host.endsWith(`.${domain}`) ||
    domain.endsWith(`.${rootDomain}`)
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
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
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

function parseVuexUserId(raw) {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    return parsed?.app?.userInfo?.id
  } catch {
    return undefined
  }
}

async function inspectPage(page) {
  const [localStorageEntries, sessionStorageEntries, visibleText, cookies] =
    await Promise.all([
      dumpStorage(page, 'localStorage'),
      dumpStorage(page, 'sessionStorage'),
      page.evaluate(() => document.body?.innerText?.slice(0, 8_000) || '').catch(() => ''),
      page.cookies(platform.cookieSiteUrl).catch(() => []),
    ])

  const url = page.url()
  const cookieNames = [...new Set(cookies.map((cookie) => cookie.name))].sort()
  const vuexUserId = parseVuexUserId(localStorageEntries.vuex)
  const currentAccountPresent = Boolean(localStorageEntries.currentAccount)
  const loginRoute = /\/login(?:[/?#]|$)/i.test(url)
  const hasSessionCookie = cookieNames.some((name) => sessionCookieNames.has(name))
  const hasAuthenticatedPageSignal =
    visibleText.includes('选择搜狐号') ||
    visibleText.includes('内容管理') ||
    visibleText.includes('发布') ||
    visibleText.includes('我的内容')
  const loggedIn =
    !loginRoute &&
    hasSessionCookie &&
    (Boolean(vuexUserId) || hasAuthenticatedPageSignal)

  return {
    url,
    loggedIn,
    loginRoute,
    hasSessionCookie,
    cookieNames,
    vuexUserId: vuexUserId === undefined ? null : String(vuexUserId),
    currentAccountPresent,
    localStorageKeys: Object.keys(localStorageEntries).sort(),
    sessionStorageKeys: Object.keys(sessionStorageEntries).sort(),
    textSample: visibleText.slice(0, 500).replace(/\s+/g, ' '),
  }
}

async function chooseCapturePage(browser) {
  const pages = (await browser.pages()).filter((page) =>
    page.url().includes('sohu.com'),
  )
  if (!pages.length) throw new Error('未找到搜狐页面')

  const inspected = await Promise.all(
    pages.map(async (page) => ({ page, signals: await inspectPage(page) })),
  )
  inspected.sort((left, right) => {
    const score = (item) =>
      (item.signals.loggedIn ? 100 : 0) +
      (!item.signals.loginRoute ? 20 : 0) +
      (item.signals.vuexUserId ? 10 : 0) +
      (item.signals.currentAccountPresent ? 5 : 0)
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
      ok.push(`${cookie.name}@${cookie.domain || new URL(platform.cookieSiteUrl).hostname}`)
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
  const origin = new URL(platform.cookieSiteUrl).origin
  await page.evaluateOnNewDocument(
    ({ targetOrigin, localEntries, sessionEntries }) => {
      if (location.origin !== targetOrigin) return
      for (const [key, value] of Object.entries(localEntries || {})) {
        localStorage.setItem(key, value)
      }
      for (const [key, value] of Object.entries(sessionEntries || {})) {
        sessionStorage.setItem(key, value)
      }
    },
    {
      targetOrigin: origin,
      localEntries: localStorageEntries,
      sessionEntries: sessionStorageEntries,
    },
  )
}

async function replayOnce(testCase, runLabel) {
  const browser = await launchBrowser(testCase.label)
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
      await page.goto(platform.targetUrl, { waitUntil: 'domcontentloaded' })
    } else {
      await page.goto(platform.cookieSiteUrl, { waitUntil: 'domcontentloaded' })
      applyResult = await applyCookies(page, testCase.cookies)
      await restoreStorage(page, testCase.localStorage, testCase.sessionStorage)
      await page.goto(platform.cookieSiteUrl, { waitUntil: 'domcontentloaded' })
      await page.goto(platform.targetUrl, { waitUntil: 'domcontentloaded' })
    }

    await new Promise((resolve) => setTimeout(resolve, replayWaitMs))
    const signals = await inspectPage(page)
    const result = {
      label: testCase.label,
      order: testCase.order,
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
      `sohu-replay-${runLabel}-${sanitizeLabel(testCase.label)}.json`,
    )
    writePrivateJson(resultPath, result)
    await page.screenshot({
      path: path.join(
        outDir,
        `sohu-replay-${runLabel}-${sanitizeLabel(testCase.label)}.png`,
      ),
      fullPage: false,
    })

    console.log(
      `[replay:${testCase.label}] loggedIn=${signals.loggedIn} url=${signals.url}`,
    )
    console.log(
      `[replay:${testCase.label}] cookies=${signals.cookieNames.join(',') || '(none)'} vuexUserId=${signals.vuexUserId || '(none)'}`,
    )
    if (applyResult.failed.length) {
      console.log(`[replay:${testCase.label}] setCookie failures:`, applyResult.failed)
    }
    return result
  } finally {
    await browser.close().catch(() => {})
  }
}

function pickEntries(entries, keys) {
  return Object.fromEntries(
    keys
      .filter((key) => entries[key] !== undefined)
      .map((key) => [key, entries[key]]),
  )
}

function withoutEntry(entries, removedKey) {
  return Object.fromEntries(
    Object.entries(entries).filter(([key]) => key !== removedKey),
  )
}

function cookieIdentity(cookie) {
  return `${cookie.name}@${cookie.domain || '-'}${cookie.path || '/'}`
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 })
  const runLabel = timestampLabel()

  console.log('=== Sohu authorization capture and replay diagnosis ===')
  console.log(`Manual-login signal: touch ${readyFile}`)
  console.log('Opening a fresh Google Chrome for Testing profile...')

  let capture
  const replayCaptureFile = process.env.SOHU_CAPTURE_FILE
    ? path.resolve(root, process.env.SOHU_CAPTURE_FILE)
    : undefined

  if (replayCaptureFile) {
    capture = JSON.parse(fs.readFileSync(replayCaptureFile, 'utf8'))
    if (
      !Array.isArray(capture?.scopedCookiesFull) ||
      typeof capture?.localStorageFull !== 'object' ||
      typeof capture?.sessionStorageFull !== 'object'
    ) {
      throw new Error(`无效的搜狐授权捕获文件：${replayCaptureFile}`)
    }
    console.log(`Replaying existing capture=${replayCaptureFile}`)
  } else {
    const loginBrowser = await launchBrowser('manual-login')
    try {
      const loginPage =
        (await loginBrowser.pages())[0] || (await loginBrowser.newPage())
      await loginPage.setUserAgent(fixedUserAgent)
      await loginPage.goto(platform.loginUrl, { waitUntil: 'domcontentloaded' })

      console.log('请在打开的 Chrome for Testing 中完成搜狐登录。')
      console.log(`确认进入登录后的搜狐页面后执行：touch ${readyFile}`)
      await waitForReadyFile()
      await new Promise((resolve) => setTimeout(resolve, 2_000))

      const selected = await chooseCapturePage(loginBrowser)
      const capturePage = selected.page
      const allCookies = await getAllCookies(capturePage)
      const scopedCookies = allCookies.filter(cookieMatchesScope)
      const localStorageEntries = await dumpStorage(capturePage, 'localStorage')
      const sessionStorageEntries = await dumpStorage(capturePage, 'sessionStorage')
      const signals = await inspectPage(capturePage)

      if (!signals.loggedIn) {
        throw new Error(
          `当前 Chrome for Testing 尚未形成可验证的搜狐登录态：url=${signals.url} cookies=${signals.cookieNames.join(',') || '(none)'} vuexUserId=${signals.vuexUserId || '(none)'}`,
        )
      }

      capture = {
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

      const capturePath = path.join(outDir, `sohu-capture-${runLabel}.json`)
      const latestCapturePath = path.join(outDir, 'sohu-capture-latest.json')
      writePrivateJson(capturePath, capture)
      writePrivateJson(latestCapturePath, capture)

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
    } finally {
      await loginBrowser.close().catch(() => {})
    }
  }

  const allCookies = capture.allCookiesFull
  const scopedCookies = capture.scopedCookiesFull
  const allLocalStorage = capture.localStorageFull
  const allSessionStorage = capture.sessionStorageFull
  const criticalLocalStorage = pickEntries(
    allLocalStorage,
    criticalLocalStorageKeys,
  )
  const likelySessionKeys = Object.keys(allSessionStorage).filter(
    (key) => key === 'vuex' || /ticket|auth|user|session|login|token|dv|sp|finger/i.test(key),
  )
  const likelySessionStorage = pickEntries(allSessionStorage, likelySessionKeys)
  const configuredSessionStorage = pickEntries(
    allSessionStorage,
    criticalSessionStorageKeys,
  )
  const coreCookies = scopedCookies.filter(
    (cookie) => authCookieNames.has(cookie.name) || /^pp.*dig$/i.test(cookie.name),
  )

  const baseCases = [
    {
      label: 'production-scoped-cookies-only',
      order: 'production',
      cookies: scopedCookies,
      localStorage: {},
      sessionStorage: {},
    },
    {
      label: 'production-scoped-cookies-all-localStorage',
      order: 'production',
      cookies: scopedCookies,
      localStorage: allLocalStorage,
      sessionStorage: {},
    },
    {
      label: 'production-scoped-cookies-all-storage',
      order: 'production',
      cookies: scopedCookies,
      localStorage: allLocalStorage,
      sessionStorage: allSessionStorage,
    },
    {
      label: 'production-sohu-configured-storage',
      order: 'production',
      cookies: scopedCookies,
      localStorage: criticalLocalStorage,
      sessionStorage: configuredSessionStorage,
    },
    {
      label: 'preload-scoped-cookies-only',
      order: 'preload',
      cookies: scopedCookies,
      localStorage: {},
      sessionStorage: {},
    },
    {
      label: 'preload-scoped-cookies-all-localStorage',
      order: 'preload',
      cookies: scopedCookies,
      localStorage: allLocalStorage,
      sessionStorage: {},
    },
    {
      label: 'preload-sohu-configured-storage',
      order: 'preload',
      cookies: scopedCookies,
      localStorage: criticalLocalStorage,
      sessionStorage: configuredSessionStorage,
    },
    {
      label: 'preload-core-cookies-only',
      order: 'preload',
      cookies: coreCookies,
      localStorage: {},
      sessionStorage: {},
    },
    {
      label: 'production-all-browser-cookies-all-storage',
      order: 'production',
      cookies: allCookies,
      localStorage: allLocalStorage,
      sessionStorage: allSessionStorage,
    },
    {
      label: 'preload-scoped-cookies-all-storage',
      order: 'preload',
      cookies: scopedCookies,
      localStorage: allLocalStorage,
      sessionStorage: allSessionStorage,
    },
    {
      label: 'production-core-cookies-critical-storage',
      order: 'production',
      cookies: coreCookies,
      localStorage: criticalLocalStorage,
      sessionStorage: likelySessionStorage,
    },
  ]

  console.log('=== Running replay baselines ===')
  const baseResults = []
  for (const testCase of baseCases) {
    baseResults.push(await replayOnce(testCase, runLabel))
  }

  const successfulBase =
    baseResults.find(
      (result) =>
        result.signals.loggedIn &&
        result.label === 'preload-sohu-configured-storage',
    ) ||
    baseResults.find(
      (result) =>
        result.signals.loggedIn &&
        result.label === 'production-scoped-cookies-all-storage',
    ) || baseResults.find((result) => result.signals.loggedIn)

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
    removalBaselineStable = stabilityResults.every((result) => result.signals.loggedIn)

    if (removalBaselineStable) {
      const candidateCookies = sourceCase.cookies.filter(
        (cookie) => authCookieNames.has(cookie.name) || /^pp.*dig$/i.test(cookie.name),
      )

      console.log(`=== Removal matrix based on ${sourceCase.label} ===`)
      for (const removedCookie of candidateCookies) {
        const removedIdentity = cookieIdentity(removedCookie)
        removalResults.push(
          await replayOnce(
            {
              ...sourceCase,
              label: `without-cookie-${sanitizeLabel(removedIdentity)}`,
              cookies: sourceCase.cookies.filter(
                (cookie) => cookieIdentity(cookie) !== removedIdentity,
              ),
            },
            runLabel,
          ),
        )
      }

      for (const key of criticalLocalStorageKeys.filter(
        (candidate) => sourceCase.localStorage[candidate] !== undefined,
      )) {
        removalResults.push(
          await replayOnce(
            {
              ...sourceCase,
              label: `without-localStorage-${key}`,
              localStorage: withoutEntry(sourceCase.localStorage, key),
            },
            runLabel,
          ),
        )
      }

      for (const key of likelySessionKeys) {
        removalResults.push(
          await replayOnce(
            {
              ...sourceCase,
              label: `without-sessionStorage-${key}`,
              sessionStorage: withoutEntry(sourceCase.sessionStorage, key),
            },
            runLabel,
          ),
        )
      }
    } else {
      console.log(
        'Replay baseline is not stable; skipping removal tests to avoid false required-key conclusions.',
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
      'Removal tests run only after two repeated successful baseline replays.',
      'A removal result is required only relative to a stable successful baseline in this run.',
      'If only the preload case succeeds, the production restore order is wrong.',
      'If only all-browser-cookies succeeds, cookie domain scope is incomplete.',
      'If no baseline succeeds, inspect browser-bound state or server-side session binding.',
    ],
  }

  const diagnosisPath = path.join(outDir, `sohu-diagnosis-${runLabel}.json`)
  const latestDiagnosisPath = path.join(outDir, 'sohu-diagnosis-latest.json')
  writePrivateJson(diagnosisPath, diagnosis)
  writePrivateJson(latestDiagnosisPath, diagnosis)

  console.log('=== Final diagnosis ===')
  console.log(`successfulBase=${diagnosis.successfulBase || '(none)'}`)
  console.log(
    `requiredByRemovalTest=${diagnosis.requiredByRemovalTest.join(',') || '(none established)'}`,
  )
  console.log(`diagnosis saved=${diagnosisPath}`)
}

main().catch((error) => {
  console.error('[diagnose-sohu-auth] failed:', error)
  process.exitCode = 1
})
