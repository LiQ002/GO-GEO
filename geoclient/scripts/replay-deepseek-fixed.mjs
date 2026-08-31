/**
 * Live replay DeepSeek with the FIXED session payload (cookies + localStorage).
 * Uses capture from diagnose-deepseek-auth.mjs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import puppeteerExtra from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FIXED_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'

const {
  serializeSessionCookies,
  deserializeSessionCookies,
  deserializeSessionLocalStorage,
} = require(path.join(root, 'main/lib/platforms/cookies.js'))
const { deepseekModel } = require(path.join(root, 'main/lib/model-platforms/deepseek/index.js'))

const capture = JSON.parse(
  fs.readFileSync(path.join(root, 'tmp-auth-diagnose/deepseek-capture.json'), 'utf8'),
)

const raw = serializeSessionCookies(
  capture.scopedCookiesFull,
  deepseekModel.cookieSiteUrl,
  deepseekModel.cookieDomain,
  deepseekModel.cookiePersistFilter,
  capture.localStorageFull,
  deepseekModel.localStoragePersistFilter,
)

const cookies = deserializeSessionCookies(
  raw,
  deepseekModel.cookieSiteUrl,
  deepseekModel.cookieDomain,
)
const localStorage = deserializeSessionLocalStorage(raw) || {}

function resolveChromePath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    path.join(
      process.env.HOME || '',
      '.cache/puppeteer/chrome/mac_arm-148.0.7778.97/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    ),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean)
  for (const c of candidates) if (fs.existsSync(c)) return c
  return undefined
}

const plugin = StealthPlugin()
plugin.enabledEvasions.delete('iframe.contentWindow')
plugin.enabledEvasions.delete('navigator.permissions')
plugin.enabledEvasions.delete('chrome.runtime')
plugin.enabledEvasions.delete('user-agent-override')
puppeteerExtra.use(plugin)

const browser = await puppeteerExtra.launch({
  headless: false,
  executablePath: resolveChromePath(),
  defaultViewport: { width: 1366, height: 900 },
  args: ['--no-first-run', '--no-default-browser-check', '--no-sandbox', `--user-agent=${FIXED_UA}`],
})

const page = (await browser.pages())[0] || (await browser.newPage())
await page.setUserAgent(FIXED_UA)
page.setDefaultTimeout(45_000)

await page.goto(deepseekModel.cookieSiteUrl, { waitUntil: 'domcontentloaded' })
for (const cookie of cookies) {
  try {
    await page.setCookie(cookie)
  } catch (err) {
    console.warn('skip cookie', cookie.name, err.message)
  }
}
await page.evaluate((data) => {
  for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v)
}, localStorage)

await page.goto(deepseekModel.cookieSiteUrl, { waitUntil: 'domcontentloaded' })
await page.goto(deepseekModel.chatUrl, { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 3000))

const url = page.url()
const text = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '')
const looksLoggedIn = /新对话|开启新对话/.test(text) && !/发送验证码/.test(text)
const looksLoggedOut = /发送验证码|手机号/.test(text) || url.includes('sign_in')

console.log(JSON.stringify({ url, looksLoggedIn, looksLoggedOut, textSample: text.replace(/\s+/g, ' ').slice(0, 200) }, null, 2))
console.log(looksLoggedIn && !looksLoggedOut ? 'OK: fixed payload replay stays logged in' : 'FAIL: still logged out')

console.log('Browser open 15s for visual check...')
await new Promise((r) => setTimeout(r, 15_000))
await browser.close()
process.exit(looksLoggedIn && !looksLoggedOut ? 0 : 1)
