/**
 * Diagnose Kimi / Zhipu auth capture + cookie replay.
 *
 * Usage:
 *   node scripts/diagnose-model-auth.mjs
 *
 * Flow:
 *   1. Opens login browser for each platform
 *   2. Wait until you finish login, then create an empty file:
 *        touch /tmp/geohelper-auth-ready
 *   3. Script captures cookies/localStorage, closes browser, replays auth
 *   4. Prints diagnosis and keeps replay browser open for inspection
 */

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import puppeteerExtra from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// Compile-time JS from electron build may not exist; import TS helpers via dynamic path after build.
// Prefer source helpers by loading compiled main output if present, else inline minimal copies.
const READY_FILE = '/tmp/geohelper-auth-ready'
const FIXED_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'

const platforms = [
  {
    id: 'kimi',
    label: 'Kimi',
    loginUrl: 'https://www.kimi.com/',
    chatUrl: 'https://www.kimi.com/',
    cookieSiteUrl: 'https://www.kimi.com/',
    cookieDomain: 'www.kimi.com',
    useStealth: true,
    loginHints: ['登录', '登陆', 'Log in', 'Sign in'],
    loggedInHints: ['新对话', 'New chat', '历史', '设置', '退出', 'Logout'],
  },
  {
    id: 'zhipu',
    label: '智谱清言',
    loginUrl: 'https://chatglm.cn/',
    chatUrl: 'https://chatglm.cn/',
    cookieSiteUrl: 'https://chatglm.cn',
    cookieDomain: '.chatglm.cn',
    useStealth: true,
    loginHints: ['登录', '登陆', 'Log in', 'Sign in'],
    loggedInHints: ['新对话', '新建对话', '历史', '设置', '退出', 'Logout'],
  },
]

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

function serializeSessionCookies(cookies, siteUrl, cookieDomain) {
  const stored = cookies
    .filter((c) => c.name && typeof c.value === 'string')
    .filter((c) => cookieMatchesScope(c, siteUrl, cookieDomain))
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
      expires: c.expires,
    }))
  return stored
}

function deserializeSessionCookies(stored, siteUrl, cookieDomain) {
  const now = Date.now() / 1000
  return stored
    .filter((c) => !c.expires || c.expires > now)
    .map((c) => {
      const param = {
        name: c.name,
        value: c.value,
        path: c.path || '/',
      }
      if (c.domain) param.domain = c.domain
      else if (cookieDomain) param.domain = cookieDomain
      else param.url = siteUrl
      if (c.secure !== undefined) param.secure = c.secure
      if (c.httpOnly !== undefined) param.httpOnly = c.httpOnly
      if (c.sameSite) param.sameSite = c.sameSite
      if (c.expires) param.expires = c.expires
      return param
    })
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

  const browser = await launcher.launch({
    headless: false,
    defaultViewport: { width: 1366, height: 900 },
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      `--user-agent=${FIXED_UA}`,
    ],
  })
  return browser
}

async function getAllCookies(page) {
  const client = await page.createCDPSession()
  const { cookies } = await client.send('Network.getAllCookies')
  return cookies
}

async function dumpLocalStorage(page) {
  try {
    return await page.evaluate(() => {
      const out = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        const value = localStorage.getItem(key)
        out[key] = value && value.length > 200 ? `${value.slice(0, 200)}…(${value.length})` : value
      }
      return out
    })
  } catch {
    return {}
  }
}

async function pageSignals(page, hints) {
  const text = await page.evaluate(() => document.body?.innerText?.slice(0, 4000) || '')
  const url = page.url()
  const matched = hints.filter((h) => text.includes(h))
  return { url, matched, textSample: text.slice(0, 300).replace(/\s+/g, ' ') }
}

function waitForReadyFile(timeoutMs = 15 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(READY_FILE)) {
      fs.unlinkSync(READY_FILE)
    }
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
      await page.setCookie(cookie)
      ok.push(cookie.name)
    } catch (err) {
      failed.push({ name: cookie.name, error: String(err?.message || err) })
    }
  }
  return { ok, failed }
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
  }))
}

async function diagnosePlatform(platform) {
  console.log('\n============================================================')
  console.log(`▶ ${platform.label} (${platform.id})`)
  console.log('============================================================')
  console.log(`1) Opening login: ${platform.loginUrl}`)
  console.log(`   After you finish login, run:  touch ${READY_FILE}`)

  const loginBrowser = await launchBrowser(platform.useStealth)
  const loginPage = (await loginBrowser.pages())[0] || (await loginBrowser.newPage())
  await loginPage.setUserAgent(FIXED_UA)
  await loginPage.goto(platform.loginUrl, { waitUntil: 'domcontentloaded' })

  await waitForReadyFile()
  console.log('   Auth ready signal received. Capturing session...')

  const allCookies = await getAllCookies(loginPage)
  const scoped = serializeSessionCookies(allCookies, platform.cookieSiteUrl, platform.cookieDomain)
  const localStorageDump = await dumpLocalStorage(loginPage)
  const beforeSignals = await pageSignals(loginPage, [
    ...platform.loginHints,
    ...platform.loggedInHints,
  ])

  const outDir = path.join(root, 'tmp-auth-diagnose')
  fs.mkdirSync(outDir, { recursive: true })
  const dumpPath = path.join(outDir, `${platform.id}-capture.json`)
  fs.writeFileSync(
    dumpPath,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        pageUrl: loginPage.url(),
        cookieSiteUrl: platform.cookieSiteUrl,
        cookieDomain: platform.cookieDomain,
        allCookieCount: allCookies.length,
        scopedCookieCount: scoped.length,
        allCookies: summarizeCookies(allCookies),
        scopedCookies: summarizeCookies(scoped),
        droppedCookies: summarizeCookies(
          allCookies.filter(
            (c) => !scoped.some((s) => s.name === c.name && s.domain === c.domain),
          ),
        ),
        localStorage: localStorageDump,
        signals: beforeSignals,
      },
      null,
      2,
    ),
  )

  console.log(`   Saved capture: ${dumpPath}`)
  console.log(`   All cookies: ${allCookies.length}, scoped kept: ${scoped.length}`)
  console.log(
    '   Kept names:',
    scoped.map((c) => `${c.name}@${c.domain}`).join(', ') || '(none)',
  )
  console.log('   localStorage keys:', Object.keys(localStorageDump).join(', ') || '(none)')
  console.log('   page url:', beforeSignals.url)

  await loginBrowser.close()

  console.log('2) Replaying cookies into a fresh browser...')
  const replayBrowser = await launchBrowser(platform.useStealth)
  const replayPage = (await replayBrowser.pages())[0] || (await replayBrowser.newPage())
  await replayPage.setUserAgent(FIXED_UA)
  replayPage.setDefaultTimeout(45_000)

  const cookieSiteUrl = platform.cookieSiteUrl
  await replayPage.goto(cookieSiteUrl, { waitUntil: 'domcontentloaded' })

  const toSet = deserializeSessionCookies(scoped, cookieSiteUrl, platform.cookieDomain)
  const applyResult = await applyCookies(replayPage, toSet)
  console.log(`   setCookie ok=${applyResult.ok.length} failed=${applyResult.failed.length}`)
  if (applyResult.failed.length) {
    console.log('   setCookie failures:', applyResult.failed)
  }

  await replayPage.goto(cookieSiteUrl, { waitUntil: 'domcontentloaded' })
  await replayPage.goto(platform.chatUrl, { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 2500))

  const afterCookies = await getAllCookies(replayPage)
  const afterScoped = serializeSessionCookies(
    afterCookies,
    platform.cookieSiteUrl,
    platform.cookieDomain,
  )
  const afterLocal = await dumpLocalStorage(replayPage)
  const afterSignals = await pageSignals(replayPage, [
    ...platform.loginHints,
    ...platform.loggedInHints,
  ])

  const missingAuthNames = scoped
    .map((c) => c.name)
    .filter((name) => !afterScoped.some((c) => c.name === name))

  const likelyTokenKeys = Object.keys(localStorageDump).filter((k) =>
    /token|auth|user|session|login|jwt|access/i.test(k),
  )

  const looksLoggedOut =
    afterSignals.matched.some((h) => platform.loginHints.includes(h)) &&
    !afterSignals.matched.some((h) => platform.loggedInHints.includes(h))

  const diagnosis = {
    platform: platform.id,
    replayUrl: afterSignals.url,
    looksLoggedOut,
    setCookieFailures: applyResult.failed,
    missingAuthCookieNamesAfterReplay: missingAuthNames,
    localStorageTokenLikeKeys: likelyTokenKeys,
    localStoragePresentOnCapture: likelyTokenKeys.length > 0,
    localStoragePresentAfterReplay: likelyTokenKeys.filter((k) => k in afterLocal),
    suspectedIssues: [],
  }

  if (applyResult.failed.length) {
    diagnosis.suspectedIssues.push('Some cookies rejected by Chromium during setCookie (domain/path/secure mismatch).')
  }
  if (scoped.length === 0) {
    diagnosis.suspectedIssues.push('No cookies matched cookieSiteUrl/cookieDomain filter — domain config likely wrong.')
  }
  if (likelyTokenKeys.length > 0) {
    diagnosis.suspectedIssues.push(
      'Auth appears to rely on localStorage tokens; cookie-only replay will not restore login.',
    )
  }
  if (platform.cookieDomain && !platform.cookieDomain.startsWith('.') && platform.cookieDomain.includes('.')) {
    // host-only style domain may be too narrow for subdomain cookies
    const hostOnly = !platform.cookieDomain.startsWith('.')
    if (hostOnly && scoped.some((c) => (c.domain || '').startsWith('.'))) {
      diagnosis.suspectedIssues.push(
        `cookieDomain="${platform.cookieDomain}" is host-only style while captured cookies use parent domain; prefer ".${platform.cookieDomain.replace(/^www\./, '')}".`,
      )
    }
  }
  if (looksLoggedOut) {
    diagnosis.suspectedIssues.push('Replay page still shows login UI — session restore failed.')
  } else {
    diagnosis.suspectedIssues.push('Replay may have succeeded (no clear login UI). Please visually confirm.')
  }

  const replayDump = path.join(outDir, `${platform.id}-replay.json`)
  fs.writeFileSync(
    replayDump,
    JSON.stringify(
      {
        diagnosis,
        afterSignals,
        afterScoped: summarizeCookies(afterScoped),
        afterLocalStorage: afterLocal,
      },
      null,
      2,
    ),
  )

  console.log('3) Replay diagnosis:')
  console.log(JSON.stringify(diagnosis, null, 2))
  console.log(`   Replay dump: ${replayDump}`)
  console.log('   Replay browser left open for 20s for visual check...')
  await new Promise((r) => setTimeout(r, 20_000))
  await replayBrowser.close()

  return diagnosis
}

async function main() {
  console.log('GeoHelper model-platform auth diagnose')
  console.log(`Ready signal file: ${READY_FILE}`)
  console.log('Platforms: kimi, zhipu (sequential)')

  const results = []
  for (const platform of platforms) {
    results.push(await diagnosePlatform(platform))
  }

  console.log('\n================ FINAL SUMMARY ================')
  for (const r of results) {
    console.log(`\n[${r.platform}] loggedOut=${r.looksLoggedOut}`)
    for (const issue of r.suspectedIssues) console.log(`  - ${issue}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
