/**
 * Usage:
 *   BASE_URL="https://example.com" TARGET_URL="https://example.com/protected" node puppeteer-test.js
 *
 * Provide cookies (one of):
 *   0) COOKIE_HEADER='a=b; c=d; ...' (raw Cookie request header)
 *   1) COOKIE_JSON='[{"name":"sid","value":"...","domain":".example.com","path":"/","httpOnly":true,"secure":true}]'
 *   2) COOKIES_PATH="./cookies.json"
 *
 * Notes:
 * - Cookies should be Chrome DevTools / Puppeteer cookie objects array.
 * - If your cookie objects don't include domain/path, export them with those fields or add `url` field.
 */

const fs = require('node:fs');
const path = require('node:path');

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

function parseCookieHeader(cookieHeader) {
  const raw = String(cookieHeader || '').trim();
  if (!raw) return [];

  const header = raw.replace(/^cookie:\s*/i, '');

  return header
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf('=');
      if (idx <= 0) return null;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (!name) return null;
      return { name, value };
    })
    .filter(Boolean);
}

function cookiesWithSiteUrl(cookies, siteUrl) {
  return cookies.map((c) => (c.url || c.domain ? c : { ...c, url: siteUrl }));
}

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function readCookies() {
  if (process.env.COOKIE_HEADER) {
    return parseCookieHeader(process.env.COOKIE_HEADER);
  }
  if (process.env.COOKIE_JSON) {
    return JSON.parse(process.env.COOKIE_JSON);
  }
  const cookiesPath = process.env.COOKIES_PATH || path.join(process.cwd(), 'cookies.json');
  if (!fs.existsSync(cookiesPath)) {
    throw new Error(
      `No cookies provided. Set COOKIE_JSON or create COOKIES_PATH (default: ${cookiesPath}).`,
    );
  }
  return JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
}

function isProbablyLoginUrl(url) {
  const u = (url || '').toLowerCase();
  return (
    u.includes('login') ||
    u.includes('signin') ||
    u.includes('sign-in') ||
    u.includes('auth') ||
    u.includes('oauth')
  );
}

async function run({
  baseUrl,
  targetUrl,
  headless,
  cookies,
} = {}) {
  const BASE_URL = baseUrl || mustEnv('BASE_URL');
  const TARGET_URL = targetUrl || mustEnv('TARGET_URL');
  const HEADLESS = typeof headless === 'boolean'
    ? headless
    : (process.env.HEADLESS ?? 'true').toLowerCase() !== 'false';

  const cookiesInput = cookies || readCookies();
  if (!Array.isArray(cookiesInput) || cookiesInput.length === 0) {
    throw new Error('Cookies must be a non-empty array.');
  }

  const browser = await puppeteer.launch({
    headless: HEADLESS,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(45_000);

    // 1) Hit base domain first so cookies without `url` can be scoped correctly.
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // 2) Inject cookies, then reload base to apply them.
    const cookiesToSet = cookiesWithSiteUrl(cookiesInput, BASE_URL);
    await page.setCookie(...cookiesToSet);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // 3) Navigate to the target protected page.
    const resp = await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });

    const finalUrl = page.url();
    const status = resp ? resp.status() : null;

    await page.screenshot({ path: path.join(process.cwd(), 'puppeteer-after.png'), fullPage: true });

    const looksLikeLogin = isProbablyLoginUrl(finalUrl);
    const ok = !looksLikeLogin;

    console.log(
      JSON.stringify(
        {
          ok,
          baseUrl: BASE_URL,
          targetUrl: TARGET_URL,
          finalUrl,
          httpStatus: status,
          headless: HEADLESS,
          cookieCount: cookiesToSet.length,
          screenshot: 'puppeteer-after.png',
        },
        null,
        2,
      ),
    );

    if (!ok) {
      process.exitCode = 2;
    }
  } finally {
    await browser.close();
  }
}

module.exports = { run, parseCookieHeader };

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
