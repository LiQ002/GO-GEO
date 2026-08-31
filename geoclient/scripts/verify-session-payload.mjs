/**
 * Offline verify: rebuild session payload from diagnose captures and
 * confirm localStorage tokens are included for Kimi / Zhipu.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Use compiled JS if available; otherwise transpile-free inline via tsx-less dynamic import of source through electron build.
const cookiesPath = path.join(root, 'main/lib/platforms/cookies.js')
if (!fs.existsSync(cookiesPath)) {
  console.error('Run `pnpm run build:electron` first')
  process.exit(1)
}

const {
  serializeSessionCookies,
  deserializeSessionCookies,
  deserializeSessionLocalStorage,
} = require(cookiesPath)

const kimiCfg = require(path.join(root, 'main/lib/model-platforms/kimi/index.js')).kimiModel
const zhipuCfg = require(path.join(root, 'main/lib/model-platforms/zhipu/index.js')).zhipuModel

function loadCapture(id) {
  return JSON.parse(fs.readFileSync(path.join(root, 'tmp-auth-diagnose', `${id}-capture.json`), 'utf8'))
}

function rebuildCookiesFromSummary(capture) {
  // capture only has summaries; load raw from scopedCookies summary is incomplete (no values).
  // Instead reconstruct from the diagnose script's full dump if present in allCookies? values truncated.
  // We stored only summaries. Re-read from a sidecar if needed.
  return null
}

// The diagnose capture truncated values. Re-run a minimal reconstruction test using
// synthetic values shaped like the real capture metadata.
function testWithSynthetic(platform, captureMeta) {
  const cookies = captureMeta.scopedCookies.map((c) => ({
    name: c.name,
    value: `synthetic-${c.name}`,
    domain: c.domain,
    path: c.path || '/',
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    expires: c.expires,
    session: c.session,
  }))

  // Restore full localStorage keys from capture (values were truncated in dump for long ones,
  // but keys and short values remain; for long JWT we only need to assert key selection).
  const localStorage = {}
  for (const [k, v] of Object.entries(captureMeta.localStorage || {})) {
    localStorage[k] = String(v).includes('…') ? `synthetic-long-${k}` : String(v)
  }

  const raw = serializeSessionCookies(
    cookies,
    platform.cookieSiteUrl,
    platform.cookieDomain,
    platform.cookiePersistFilter,
    localStorage,
    platform.localStoragePersistFilter,
  )

  const restoredCookies = deserializeSessionCookies(raw, platform.cookieSiteUrl, platform.cookieDomain)
  const restoredLs = deserializeSessionLocalStorage(raw) || {}

  return {
    platform: platform.id,
    payloadPreview: raw.slice(0, 120) + '...',
    cookieCount: restoredCookies.length,
    cookieNames: restoredCookies.map((c) => c.name),
    localStorageKeys: Object.keys(restoredLs),
    expectedLsKeys: platform.localStoragePersistFilter?.keys || [],
    missingLsKeys: (platform.localStoragePersistFilter?.keys || []).filter((k) => !(k in restoredLs)),
  }
}

const kimi = loadCapture('kimi')
const zhipu = loadCapture('zhipu')

const results = [testWithSynthetic(kimiCfg, kimi), testWithSynthetic(zhipuCfg, zhipu)]
console.log(JSON.stringify(results, null, 2))

const failed = results.filter((r) => r.missingLsKeys.length > 0)
if (failed.length) {
  console.error('FAILED: missing localStorage keys after serialize')
  process.exit(1)
}
console.log('OK: localStorage auth keys are persisted in session payload')
