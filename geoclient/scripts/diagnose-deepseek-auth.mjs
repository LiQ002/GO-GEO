/**
 * Diagnose DeepSeek auth capture + cookie replay.
 *
 * Usage:
 *   node scripts/diagnose-deepseek-auth.mjs
 *
 * Flow:
 *   1. Opens DeepSeek login browser
 *   2. After you finish login, run:
 *        touch /tmp/geohelper-auth-ready
 *   3. Captures cookies / localStorage / sessionStorage
 *   4. Shows what current cookiePersistFilter would keep vs drop
 *   5. Replays with ALL scoped cookies (+ optional localStorage) and reports result
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import puppeteerExtra from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const READY_FILE = '/tmp/geohelper-auth-ready'
const FIXED_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'

const platform = {
  id: 'deepseek',
  label: 'DeepSeek',
  loginUrl: 'https://chat.deepseek.com/',
  chatUrl: 'https://chat.deepseek.com/',
  cookieSiteUrl: 'https://chat.deepseek.com',
  cookieDomain: 'chat.deepseek.com',
  useStealth: true,
  // Current production filter (suspected too aggressive)
  cookiePersistFilter: {
    names: ['smidV2'],
    namePrefixes: ['.thumbcache_'],
  },
  loginHints: ['登录', '登陆', 'Log in', 'Sign in', '手机号', '验证码'],
  loggedInHints: ['新对话', '开启新对话', 'DeepSeek', '退出', 'Logout', '设置'],
}

function cookieMatchesScope(cookie, siteUrl, cookieDomain) {
  const host = new URL(siteUrl).hostname
  const roots = new Set([host])
  if (cookieDomain) roots.add(cookieDomain.replace(/^\./, ''))

  const domain = (cookie.domain || '').replace(/^\./, '')
  if (!domain) return false

  for (const rootHost of roots) {
    if (domain === rootHost || rootHost.endsWith(`.${domain}`) || domain.endsWith(`.${rootHost}`)) {
      return true
    }
  }
  return false
}

function isSessionCookie(cookie) {
  if (cookie.session === true) return true
  return cookie.expires === undefined || cookie.expires <= 0
}

function shouldPersistCookie(cookie, filter) {
  if (!filter) return true
  const name = cookie.name || ''
  const hasAllowlist = Boolean(filter.names?.length || filter.namePrefixes?.length)
  if (hasAllowlist) {
    const allowedByName = filter.names?.includes(name) ?? false
    const allowedByPrefix = filter.namePrefixes?.some((prefix) => name.startsWith(prefix)) ?? false
    if (!allowedByName && !allowedByPrefix) return false
  }
  if (filter.excludeSessionCookies && isSessionCookie(cookie)) return false
  return true
}

function summarizeCookies(cookies) {
  return cookies.map((c) => ({
    name: c.name,
    domain: c.domain,
    path: c.path,
    httpOnly: !!c.httpOnly,
    secure: !!c.secure,
    sameSite: c.sameSite,
    expires: c.expires,
    session: !c.expires || c.expires <= 0,
    valueLen: String(c.value || '').length,
    valuePreview: String(c.value || '').slice(0, 24),
  }))
}

function resolveChromePath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    path.join(
      process.env.HOME || '',
      '.cache/puppeteer/chrome/mac_arm-148.0.7778.97/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    ),
    path.join(
      process.env.HOME || '',
      '.cache/puppeteer/chrome/mac_arm-146.0.7680.153/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    ),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return undefined
}

async function launchBrowser(stealth) {
  const launcher = stealth
    ? (() => {
        const plugin = StealthPlugin()
        plugin.enabledEvasions.delete('iframe.contentWindow')
        plugin.enabledEvasions.delete('navigator.permissions')
        plugin.enabledEvasions.delete('chrome.runtime')
        plugin.enabledEvasions.delete('user-agent-override')
        puppeteerExtra.use(plugin)
        return puppeteerExtra
      })()
    : puppeteer

  const executablePath = resolveChromePath()
  return launcher.launch({
    headless: false,
    executablePath,
    defaultViewport: { width: 1366, height: 900 },
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      `--user-agent=${FIXED_UA}`,
    ],
  })
}

async function getAllCookies(page) {
  const client = await page.createCDPSession()
  const { cookies } = await client.send('Network.getAllCookies')
  return cookies
}

async function dumpStorage(page, type) {
  try {
    return await page.evaluate((storageType) => {
      const storage = storageType === 'session' ? sessionStorage : localStorage
      const out = {}
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (!key) continue
        const value = storage.getItem(key)
        out[key] =
          value && value.length > 240 ? `${value.slice(0, 240)}…(${value.length})` : value
      }
      return out
    }, type)
  } catch {
    return {}
  }
}

async function pageSignals(page, hints) {
  const text = await page.evaluate(() => document.body?.innerText?.slice(0, 5000) || '')
  const url = page.url()
  const matched = hints.filter((h) => text.includes(h))
  return { url, matched, textSample: text.slice(0, 400).replace(/\s+/g, ' ') }
}

function waitForReadyFile(timeoutMs = 15 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(READY_FILE)) fs.unlinkSync(READY_FILE)
    const started = Date.now()
    const timer = setInterval(() => {
      if (fs.existsSync(READY_FILE)) {
        clearInterval(timer)
        fs.unlinkSync(READY_FILE)
        resolve()
        return
      }
      if (Date.now() - started > timeoutMs) {
        clearInterval(timer)
        reject(new Error('Timed out waiting for auth ready signal'))
      }
    }, 800)
  })
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
      ok.push(cookie.name)
    } catch (err) {
      failed.push({ name: cookie.name, error: String(err?.message || err) })
    }
  }
  return { ok, failed }
}

async function restoreLocalStorage(page, entries) {
  const keys = Object.keys(entries || {})
  if (!keys.length) return
  await page.evaluate((data) => {
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, value)
    }
  }, entries)
}

async function main() {
  console.log('DeepSeek auth diagnose')
  console.log(`Ready signal: touch ${READY_FILE}`)
  console.log(`1) Opening login: ${platform.loginUrl}`)

  const loginBrowser = await launchBrowser(platform.useStealth)
  const loginPage = (await loginBrowser.pages())[0] || (await loginBrowser.newPage())
  await loginPage.setUserAgent(FIXED_UA)
  await loginPage.goto(platform.loginUrl, { waitUntil: 'domcontentloaded' })

  console.log('   Please finish DeepSeek login, then run: touch /tmp/geohelper-auth-ready')
  await waitForReadyFile()
  console.log('   Auth ready. Capturing...')

  // Give SPA a moment to settle tokens into storage
  await new Promise((r) => setTimeout(r, 1500))

  const allCookies = await getAllCookies(loginPage)
  const scoped = allCookies.filter((c) =>
    cookieMatchesScope(c, platform.cookieSiteUrl, platform.cookieDomain),
  )
  const keptByCurrentFilter = scoped.filter((c) =>
    shouldPersistCookie(c, platform.cookiePersistFilter),
  )
  const droppedByCurrentFilter = scoped.filter(
    (c) => !shouldPersistCookie(c, platform.cookiePersistFilter),
  )

  const localStorageDump = await dumpStorage(loginPage, 'local')
  const sessionStorageDump = await dumpStorage(loginPage, 'session')
  const beforeSignals = await pageSignals(loginPage, [
    ...platform.loginHints,
    ...platform.loggedInHints,
  ])

  const likelyAuthCookieNames = scoped
    .map((c) => c.name)
    .filter((n) => /token|auth|session|user|login|jwt|sid|uid|ds_|deepseek/i.test(n))

  const likelyLsKeys = Object.keys(localStorageDump).filter((k) =>
    /token|auth|user|session|login|jwt|access|refresh|ds_/i.test(k),
  )
  const likelySsKeys = Object.keys(sessionStorageDump).filter((k) =>
    /token|auth|user|session|login|jwt|access|refresh|ds_/i.test(k),
  )

  const outDir = path.join(root, 'tmp-auth-diagnose')
  fs.mkdirSync(outDir, { recursive: true })

  // Persist FULL cookie values for later offline replay tests (local only, gitignored)
  const fullCapture = {
    capturedAt: new Date().toISOString(),
    pageUrl: loginPage.url(),
    cookieSiteUrl: platform.cookieSiteUrl,
    cookieDomain: platform.cookieDomain,
    allCookieCount: allCookies.length,
    scopedCookieCount: scoped.length,
    keptByCurrentFilterCount: keptByCurrentFilter.length,
    droppedByCurrentFilterCount: droppedByCurrentFilter.length,
    allCookies: summarizeCookies(allCookies),
    scopedCookies: summarizeCookies(scoped),
    keptByCurrentFilter: summarizeCookies(keptByCurrentFilter),
    droppedByCurrentFilter: summarizeCookies(droppedByCurrentFilter),
    // full values for repair verification
    scopedCookiesFull: scoped.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
      expires: c.expires,
      session: c.session,
    })),
    localStorage: localStorageDump,
    sessionStorage: sessionStorageDump,
    localStorageFull: await loginPage.evaluate(() => {
      const out = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        out[key] = localStorage.getItem(key)
      }
      return out
    }).catch(() => ({})),
    sessionStorageFull: await loginPage.evaluate(() => {
      const out = {}
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (!key) continue
        out[key] = sessionStorage.getItem(key)
      }
      return out
    }).catch(() => ({})),
    signals: beforeSignals,
    likelyAuthCookieNames,
    likelyLsKeys,
    likelySsKeys,
  }

  const dumpPath = path.join(outDir, 'deepseek-capture.json')
  fs.writeFileSync(dumpPath, JSON.stringify(fullCapture, null, 2))

  console.log(`\n=== CAPTURE SUMMARY ===`)
  console.log(`page: ${beforeSignals.url}`)
  console.log(`all cookies: ${allCookies.length}, scoped: ${scoped.length}`)
  console.log(`current filter KEEP: ${keptByCurrentFilter.length}`)
  console.log(
    '  kept:',
    keptByCurrentFilter.map((c) => `${c.name}@${c.domain}`).join(', ') || '(none)',
  )
  console.log(`current filter DROP: ${droppedByCurrentFilter.length}`)
  console.log(
    '  dropped:',
    droppedByCurrentFilter.map((c) => `${c.name}@${c.domain}`).join(', ') || '(none)',
  )
  console.log('likely auth cookie names:', likelyAuthCookieNames.join(', ') || '(none)')
  console.log('localStorage keys:', Object.keys(localStorageDump).join(', ') || '(none)')
  console.log('likely LS keys:', likelyLsKeys.join(', ') || '(none)')
  console.log('sessionStorage keys:', Object.keys(sessionStorageDump).join(', ') || '(none)')
  console.log('likely SS keys:', likelySsKeys.join(', ') || '(none)')
  console.log(`saved: ${dumpPath}`)

  await loginBrowser.close()

  // Replay A: what production currently saves (filtered)
  console.log('\n2A) Replay with CURRENT filter only (production behavior)...')
  const replayA = await replayOnce({
    label: 'current-filter',
    cookies: keptByCurrentFilter,
    localStorage: null,
  })

  // Replay B: all scoped cookies, no localStorage
  console.log('\n2B) Replay with ALL scoped cookies (no localStorage)...')
  const replayB = await replayOnce({
    label: 'all-scoped-cookies',
    cookies: scoped,
    localStorage: null,
  })

  // Replay C: all scoped cookies + auth-like localStorage
  const lsToRestore = {}
  for (const key of likelyLsKeys) {
    if (fullCapture.localStorageFull[key] != null) {
      lsToRestore[key] = fullCapture.localStorageFull[key]
    }
  }
  // Also include common DeepSeek keys if present
  for (const key of Object.keys(fullCapture.localStorageFull || {})) {
    if (/userToken|token|auth|userInfo|ds_|^user$/i.test(key) && fullCapture.localStorageFull[key] != null) {
      lsToRestore[key] = fullCapture.localStorageFull[key]
    }
  }

  console.log('\n2C) Replay with ALL scoped cookies + likely localStorage...')
  console.log('   restoring LS keys:', Object.keys(lsToRestore).join(', ') || '(none)')
  const replayC = await replayOnce({
    label: 'cookies-plus-localStorage',
    cookies: scoped,
    localStorage: lsToRestore,
  })

  const diagnosis = {
    platform: 'deepseek',
    currentFilterKeepsOnly: keptByCurrentFilter.map((c) => c.name),
    currentFilterDrops: droppedByCurrentFilter.map((c) => c.name),
    likelyAuthCookieNames,
    likelyLsKeys,
    likelySsKeys,
    replay: {
      currentFilter: replayA,
      allScopedCookies: replayB,
      cookiesPlusLocalStorage: replayC,
    },
    suspectedIssues: [],
  }

  if (keptByCurrentFilter.length === 0) {
    diagnosis.suspectedIssues.push(
      'Current cookiePersistFilter keeps ZERO cookies — auth cannot be restored.',
    )
  }
  if (
    droppedByCurrentFilter.some((c) =>
      /token|auth|session|user|login|jwt|sid|uid|ds_/i.test(c.name),
    )
  ) {
    diagnosis.suspectedIssues.push(
      'Current cookiePersistFilter drops likely auth cookies. Remove/relax the allowlist.',
    )
  }
  if (likelyLsKeys.length > 0 && replayB.looksLoggedOut && !replayC.looksLoggedOut) {
    diagnosis.suspectedIssues.push(
      'Login depends on localStorage tokens; need localStoragePersistFilter like Kimi.',
    )
  }
  if (likelyLsKeys.length > 0 && replayC.looksLoggedOut) {
    diagnosis.suspectedIssues.push(
      'localStorage restore still failed — may need sessionStorage or different keys/order.',
    )
  }
  if (!replayA.looksLoggedOut) {
    diagnosis.suspectedIssues.push('Unexpected: current filter replay looks logged in.')
  }
  if (!replayB.looksLoggedOut || !replayC.looksLoggedOut) {
    diagnosis.suspectedIssues.push(
      'At least one full-cookie replay appears logged in — fix is to stop over-filtering cookies' +
        (Object.keys(lsToRestore).length ? ' and/or persist localStorage.' : '.'),
    )
  }

  const diagPath = path.join(outDir, 'deepseek-diagnosis.json')
  fs.writeFileSync(diagPath, JSON.stringify(diagnosis, null, 2))

  console.log('\n================ FINAL DIAGNOSIS ================')
  console.log(JSON.stringify(diagnosis, null, 2))
  console.log(`saved: ${diagPath}`)
}

async function replayOnce({ label, cookies, localStorage }) {
  const browser = await launchBrowser(platform.useStealth)
  const page = (await browser.pages())[0] || (await browser.newPage())
  await page.setUserAgent(FIXED_UA)
  page.setDefaultTimeout(45_000)

  await page.goto(platform.cookieSiteUrl, { waitUntil: 'domcontentloaded' })
  const applyResult = await applyCookies(page, cookies)
  if (localStorage && Object.keys(localStorage).length) {
    await restoreLocalStorage(page, localStorage)
  }
  await page.goto(platform.cookieSiteUrl, { waitUntil: 'domcontentloaded' })
  await page.goto(platform.chatUrl, { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 3000))

  const signals = await pageSignals(page, [...platform.loginHints, ...platform.loggedInHints])
  const looksLoggedOut =
    signals.matched.some((h) => platform.loginHints.includes(h)) &&
    !signals.matched.some((h) => platform.loggedInHints.includes(h))

  const result = {
    label,
    url: signals.url,
    looksLoggedOut,
    matchedHints: signals.matched,
    setCookieOk: applyResult.ok.length,
    setCookieFailed: applyResult.failed,
    textSample: signals.textSample,
  }

  console.log(
    `   [${label}] loggedOut=${looksLoggedOut} url=${signals.url} matched=${signals.matched.join('|') || '-'}`,
  )
  if (applyResult.failed.length) console.log('   setCookie failures:', applyResult.failed)

  const outDir = path.join(root, 'tmp-auth-diagnose')
  fs.writeFileSync(path.join(outDir, `deepseek-replay-${label}.json`), JSON.stringify(result, null, 2))

  console.log('   browser open 12s for visual check...')
  await new Promise((r) => setTimeout(r, 12_000))
  await browser.close()
  return result
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
