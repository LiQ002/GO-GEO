/**
 * Offline verify DeepSeek session payload after config fix.
 * Requires: tmp-auth-diagnose/deepseek-capture.json + pnpm run build:electron
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cookiesPath = path.join(root, 'main/lib/platforms/cookies.js')
const cfgPath = path.join(root, 'main/lib/model-platforms/deepseek/index.js')

if (!fs.existsSync(cookiesPath) || !fs.existsSync(cfgPath)) {
  console.error('Run `pnpm run build:electron` first')
  process.exit(1)
}

const {
  serializeSessionCookies,
  deserializeSessionCookies,
  deserializeSessionLocalStorage,
} = require(cookiesPath)
const { deepseekModel } = require(cfgPath)

const capturePath = path.join(root, 'tmp-auth-diagnose/deepseek-capture.json')
if (!fs.existsSync(capturePath)) {
  console.error('Missing deepseek-capture.json — run diagnose-deepseek-auth.mjs first')
  process.exit(1)
}

const capture = JSON.parse(fs.readFileSync(capturePath, 'utf8'))
const cookies = capture.scopedCookiesFull
const localStorage = capture.localStorageFull

const raw = serializeSessionCookies(
  cookies,
  deepseekModel.cookieSiteUrl,
  deepseekModel.cookieDomain,
  deepseekModel.cookiePersistFilter,
  localStorage,
  deepseekModel.localStoragePersistFilter,
)

const restoredCookies = deserializeSessionCookies(
  raw,
  deepseekModel.cookieSiteUrl,
  deepseekModel.cookieDomain,
)
const restoredLs = deserializeSessionLocalStorage(raw) || {}

const expectedCookies = ['ds_session_id', 'HWWAFSESID', 'HWWAFSESTIME', 'smidV2']
const expectedLs = ['userToken', 'settingsJwt']

const result = {
  cookieNames: restoredCookies.map((c) => c.name),
  localStorageKeys: Object.keys(restoredLs),
  missingCookies: expectedCookies.filter((n) => !restoredCookies.some((c) => c.name === n)),
  missingLs: expectedLs.filter((k) => !(k in restoredLs)),
  hasUserToken: Boolean(restoredLs.userToken),
  userTokenPreview: String(restoredLs.userToken || '').slice(0, 40),
  payloadBytes: raw.length,
}

console.log(JSON.stringify(result, null, 2))

if (result.missingCookies.length || result.missingLs.length || !result.hasUserToken) {
  console.error('FAILED: DeepSeek session payload incomplete')
  process.exit(1)
}

console.log('OK: DeepSeek session now persists ds_session_id + userToken')
