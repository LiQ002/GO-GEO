/**
 * test-doubao-mobile-with-auth.cjs — 豆包移动端完整查收录测试（含登录态）
 *
 * 用法： npx electron scripts/test-doubao-mobile-with-auth.cjs
 *
 * 流程：
 *   1. 启动 Electron 主进程
 *   2. authService.openLogin('doubao') 打开豆包登录页
 *      —— 如果上次授权的 cookie 还在，会自动登录到 /chat/?from_login=1
 *   3. 轮询 page.url()，检测到 from_login 或已进入 /chat 即自动 captureCredentials
 *   4. 拿到 encryptedSecret 后，fork geo-worker.js 执行移动端任务（terminalType=2）
 *   5. 输出查收录结果（answerText / citations / sessionRef）
 *
 * 用户操作：
 *   - 如果浏览器要求重新登录，请手动登录豆包
 *   - 脚本会自动检测登录成功并继续
 */

const { app, ipcMain } = require('electron')
const { fork } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

// 必须在 app ready 前设置
process.env.NEXT_PUBLIC_APP_MODE = 'operator'
process.env.ELECTRON_RENDERER_URL = 'http://localhost:3001'
app.commandLine.appendSwitch('disable-gpu')

const PLATFORM_ID = 'doubao'
const PLATFORM_KIND = 'model'
const QUESTION = '矿泉水品牌有哪些？'

app.whenReady().then(async () => {
  console.log('\n=== 豆包移动端完整查收录测试 ===\n')

  // 动态导入编译后的模块
  const { authService } = require('../main/electron/main/services/AuthService')
  const WORKER_SCRIPT = path.join(process.cwd(), 'main', 'electron', 'worker', 'geo-worker.js')

  console.log('[1/5] 打开豆包登录页（已授权会自动复用 cookie）...')
  let sessionId
  try {
    const result = await authService.openLogin(PLATFORM_ID, undefined, PLATFORM_KIND)
    sessionId = result.sessionId
    console.log('   sessionId:', sessionId)
  } catch (err) {
    console.error('❌ openLogin 失败:', err)
    app.quit()
    return
  }

  // 获取 session 的 page 对象，用于轮询登录状态
  const { sessionManager } = require('../main/electron/main/services/SessionManager')
  const session = sessionManager.resolve(sessionId)
  if (!session) {
    console.error('❌ session 未找到')
    app.quit()
    return
  }
  const page = session.page

  console.log('[2/5] 等待用户登录完成（自动检测 + 手动触发）...')
  console.log('   如果浏览器要求登录，请手动完成登录')
  console.log('   当前 URL:', page.url())
  console.log('   >>> 如果已登录，请在终端按 Enter 触发凭证抓取 <<<')

  // 监听 stdin 的 Enter 按键，作为手动触发凭证抓取
  let manuallyTriggered = false
  process.stdin.resume()
  process.stdin.on('data', (data) => {
    if (data.toString().includes('\n') || data.toString().includes('\r')) {
      manuallyTriggered = true
      console.log('   收到 Enter 键，手动触发凭证抓取')
    }
  })

  // 轮询检测登录成功
  const LOGIN_TIMEOUT = 300_000  // 5 分钟
  const POLL_INTERVAL = 1_500
  const start = Date.now()
  let loginDetected = false
  let lastUrl = ''

  while (Date.now() - start < LOGIN_TIMEOUT) {
    if (manuallyTriggered) {
      loginDetected = true
      console.log('   ✅ 手动触发，开始抓取凭证')
      break
    }
    try {
      if (page.isClosed()) {
        console.error('❌ 页面被关闭')
        app.quit()
        return
      }
      const url = page.url()

      // URL 变化时打印
      if (url !== lastUrl) {
        console.log('   URL 变化:', url)
        lastUrl = url
      }

      const hasLoginParam = url.includes('from_login=1') || url.includes('from_login')
      const isChatPage = /doubao\.com\/chat\/?(\?|$)/.test(url)
      const isLoginPage = /login|logout/.test(url)

      // 检测页面 DOM 是否有用户头像或输入框（已登录标志）
      let hasLoginIndicator = false
      try {
        hasLoginIndicator = await page.evaluate(() => {
          // 豆包登录成功后的标志元素
          const selectors = [
            '.semi-avatar-no-focus-visible',
            '[class*="avatar"]',
            '[class*="user-info"]',
            '[class*="account"]',
            'textarea[placeholder*="发消息"]',
            'textarea[placeholder*="给豆包发消息"]',
            '#flow-end-msg-send',
            '[class*="send-button"]',
          ]
          return selectors.some((sel) => {
            const el = document.querySelector(sel)
            if (!el) return false
            const rect = el.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0
          })
        }).catch(() => false)
      } catch {}

      // 检测页面文本是否包含登录提示（说明未登录）
      let hasLoginPrompt = false
      try {
        hasLoginPrompt = await page.evaluate(() => {
          const text = document.body.textContent || ''
          return text.includes('登录') && text.includes('豆包') && text.length < 500
        }).catch(() => false)
      } catch {}

      if ((hasLoginParam || (isChatPage && hasLoginIndicator)) && !isLoginPage && !hasLoginPrompt) {
        loginDetected = true
        console.log('   ✅ 自动检测到登录成功，URL:', url)
        break
      }

      process.stdout.write('.')
    } catch (e) {
      process.stdout.write('x')
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL))
  }
  console.log('')

  process.stdin.pause()

  if (!loginDetected) {
    console.error('❌ 等待登录超时（3 分钟），请重新运行脚本')
    await authService.close(sessionId).catch(() => {})
    app.quit()
    return
  }

  // 等待 2 秒让页面稳定
  await new Promise((r) => setTimeout(r, 2_000))

  console.log('[3/5] 抓取 cookie 凭证...')
  let encryptedSecret
  try {
    const captureResult = await authService.captureCredentials(sessionId)
    if (!captureResult.ok) {
      console.error('❌ captureCredentials 失败:', captureResult.message)
      await authService.close(sessionId).catch(() => {})
      app.quit()
      return
    }
    encryptedSecret = captureResult.encryptedSecret
    console.log('   ✅ 凭证抓取成功，长度:', encryptedSecret.length)
  } catch (err) {
    console.error('❌ captureCredentials 异常:', err)
    await authService.close(sessionId).catch(() => {})
    app.quit()
    return
  }

  // 关闭授权会话
  console.log('   关闭授权会话...')
  await authService.close(sessionId).catch(() => {})

  // 准备移动端任务 input
  const taskInput = {
    jobId: 'test-doubao-mobile-with-auth-001',
    taskId: 999,
    enterpriseId: 1,
    question: QUESTION,
    platformName: PLATFORM_ID,
    terminalType: 2,                // ← 移动端
    siteEntryUrl: 'https://www.doubao.com',
    encryptedSecret: encryptedSecret,
  }

  console.log('\n[4/5] Fork geo-worker.js 执行移动端任务...')
  console.log('   Input:', JSON.stringify({ ...taskInput, encryptedSecret: '(hidden)' }, null, 2))

  // Fork worker 进程
  const child = fork(WORKER_SCRIPT, [], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  })

  const workerTimeout = setTimeout(() => {
    console.error('\n[5/5] ❌ Worker 超时（240s），强制终止')
    child.kill('SIGKILL')
    app.quit()
  }, 240_000)

  // 监听 worker 消息
  child.on('message', (msg) => {
    if (msg.type === 'log') {
      console.log(`[worker] [${msg.level}] ${msg.message}`)
      if (msg.data) console.log(`[worker]   data:`, JSON.stringify(msg.data).slice(0, 500))
    }

    if (msg.type === 'result') {
      clearTimeout(workerTimeout)
      console.log('\n[5/5] ✅ 查收录任务成功')
      console.log('   Answer length:', msg.result.answerText?.length)
      console.log('   Answer status:', msg.result.answerStatus)
      console.log('   Citations:', msg.result.citations?.length)
      console.log('   Session ref:', msg.result.sessionRef)
      console.log('   Answer preview:', msg.result.answerText?.slice(0, 300))

      // 保存完整结果到证据目录
      const evidenceDir = path.join(process.cwd(), 'geo-evidence')
      if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true })
      const resultPath = path.join(evidenceDir, 'doubao-mobile-result.json')
      fs.writeFileSync(resultPath, JSON.stringify(msg.result, null, 2))
      console.log('   完整结果已保存:', resultPath)

      child.kill()
      app.quit()
    }

    if (msg.type === 'error') {
      clearTimeout(workerTimeout)
      console.error('\n[5/5] ❌ 查收录任务失败:', msg.message)
      if (msg.stack) console.error(msg.stack)
      child.kill()
      app.quit()
    }
  })

  child.on('error', (err) => {
    clearTimeout(workerTimeout)
    console.error('\n[5/5] ❌ Worker 进程错误:', err)
    app.quit()
  })

  child.on('exit', (code) => {
    clearTimeout(workerTimeout)
    console.log('\n[5/5] Worker 退出，code:', code)
    app.quit()
  })

  // 发送任务
  console.log('   发送 geo-job 命令...')
  child.send({
    type: 'geo-job',
    input: taskInput,
    evidenceDir: path.join(process.cwd(), 'geo-evidence'),
  })
})
