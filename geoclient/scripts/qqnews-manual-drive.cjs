/**
 * 企鹅号发文页手动调试脚本
 *
 * 用法：
 *   npx electron scripts/qqnews-manual-drive.cjs "<encryptedCookie>"
 * 或
 *   set QQNEWS_COOKIE_SECRET=<encryptedCookie> && npx electron scripts/qqnews-manual-drive.cjs
 *
 * <encryptedCookie> 从 geoclient 渲染进程 LocalStorage 的键 `platformCookie:qqnews` 获取。
 * 脚本会用本机 Electron safeStorage 解密，打开一个真实 Chromium 浏览器并进入企鹅号发文页，
 * 然后保持窗口打开，供你手动操作。
 */

const { app, BrowserWindow } = require('electron')
const puppeteer = require('puppeteer')

const { credentialService } = require('../main/electron/main/services/CredentialService.js')
const { deserializeSessionCookies } = require('../main/lib/platforms/cookies.js')

const encryptedSecret = process.argv[2] || process.env.QQNEWS_COOKIE_SECRET

const TARGET_URL = 'https://om.qq.com/main/creation/article'
const COOKIE_SITE_URL = 'https://om.qq.com/main'

if (!encryptedSecret) {
  console.error('[qqnews-manual-drive] 缺少加密 cookie')
  console.error('请在 geoclient 渲染进程 DevTools 控制台执行：')
  console.error('  localStorage.getItem("platformCookie:qqnews")')
  console.error('然后运行：')
  console.error('  npx electron scripts/qqnews-manual-drive.cjs "<返回值>"')
  process.exit(1)
}

app.setName('geoclient')

app.whenReady().then(async () => {
  try {
    const credentials = credentialService.decrypt(encryptedSecret)
    const cookies = deserializeSessionCookies(credentials.cookie, COOKIE_SITE_URL)
    console.log(`[qqnews-manual-drive] 解密成功，可用 cookie 条数：${cookies.length}`)

    const browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const [page] = await browser.pages()
    await page.setViewport({ width: 1280, height: 900 })

    // 先访问 cookie 站点，让 Puppeteer 能设置同域 cookie
    await page.goto(COOKIE_SITE_URL, { waitUntil: 'networkidle2', timeout: 30000 })
    await page.setCookie(...cookies)
    console.log(`[qqnews-manual-drive] cookie 已设置到 ${COOKIE_SITE_URL}`)

    // 再跳转到发文页
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 })
    console.log(`[qqnews-manual-drive] 已进入发文页：${page.url()}`)

    // 打开一个提示窗口保持 Electron 事件循环，避免主进程退出
    const win = new BrowserWindow({
      width: 420,
      height: 240,
      title: '企鹅号手动调试',
      alwaysOnTop: true,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    win.loadURL(
      `data:text/html,` +
        encodeURIComponent(
          `<html><head><style>body{font-family:sans-serif;padding:24px;text-align:center}h2{margin-top:0;color:#1677ff}</style></head>` +
            `<body><h2>浏览器已打开</h2><p>请在弹出的 Chromium 窗口中手动操作企鹅号发文页。</p><p>完成后关闭本窗口退出。</p></body></html>`,
        ),
    )

    win.on('closed', async () => {
      try {
        await browser.close()
      } catch {
        // ignore
      }
      app.quit()
    })
  } catch (err) {
    console.error('[qqnews-manual-drive] 启动失败：', err)
    app.quit()
  }
})
