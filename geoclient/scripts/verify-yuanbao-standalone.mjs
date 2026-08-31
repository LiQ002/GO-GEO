/**
 * 方案 3 验证脚本：独立 Chrome 测试元宝发送
 *
 * 目的：验证元宝"请求失败"是否由 Electron 渲染环境指纹被识别导致。
 * 方法：使用独立 Chrome（非 Electron 内置浏览器）+ stealth 插件，
 *       手动登录后自动发送一条测试消息，监控网络请求结果。
 *
 * Usage:
 *   node scripts/verify-yuanbao-standalone.mjs
 *
 * 流程：
 *   1. 启动独立 Chrome（puppeteer + stealth，不依赖 Electron）
 *   2. 打开元宝聊天页面
 *   3. 用户手动登录（脚本等待输入框出现）
 *   4. 自动输入测试问题并点击发送
 *   5. 监控网络请求，检测是否返回 400 / "请求失败"
 *   6. 输出诊断结果，浏览器保持打开供 F12 检查
 */

import puppeteer from 'puppeteer'
import puppeteerExtra from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

const CHAT_URL = 'https://yuanbao.tencent.com/chat'
const FIXED_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'

const TEST_QUESTION = '矿泉水品牌有哪些？'

// 元宝输入框和发送按钮选择器（与 geo-drivers.ts 一致）
const INPUT_SELECTORS = [
  'textarea[placeholder*="问她"]',
  'textarea[placeholder*="输入"]',
  'textarea',
  '[contenteditable="true"]',
]
const SUBMIT_SELECTORS = [
  '#yuanbao-send-btn',
  'a[aria-label="发送"]',
  'a[class*="send-btn"]',
  'button[class*="send"]',
  '[data-testid="send-button"]',
  'button[type="submit"]',
]

async function findElement(page, selectors, timeout = 5000) {
  for (const sel of selectors) {
    try {
      await page.waitForSelector(sel, { timeout, visible: true })
      return await page.$(sel)
    } catch {
      // try next
    }
  }
  return null
}

async function waitForLogin(page, maxWaitMs = 5 * 60 * 1000) {
  console.log('[等待登录] 请在打开的浏览器中登录元宝...')
  console.log('[等待登录] 脚本会自动检测登录状态，无需额外操作。')

  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    // 检查是否有输入框（登录后才会出现聊天输入框）
    for (const sel of INPUT_SELECTORS) {
      const el = await page.$(sel).catch(() => null)
      if (el) {
        // 再检查一下是否有登录按钮（排除未登录但有输入框的情况）
        const loginBtn = await page.$('[class*="login"], [class*="Login"]').catch(() => null)
        if (!loginBtn) {
          console.log('[登录成功] 检测到聊天输入框，已登录。')
          return true
        }
      }
    }

    // 也检查 URL 是否还在登录页
    const url = page.url()
    if (url.includes('login') || url.includes('passport')) {
      // 还在登录流程中
    }

    await new Promise((r) => setTimeout(r, 2000))
  }

  console.error('[超时] 等待登录超时（5分钟），请重试。')
  return false
}

async function setupNetworkMonitoring(page) {
  const requests = []
  const failedRequests = []

  page.on('response', async (response) => {
    const url = response.url()
    const status = response.status()

    // 只关注元宝的 API 请求（排除静态资源、埋点、统计）
    if (url.includes('/api/') && url.includes('yuanbao')) {
      const reqInfo = {
        url: url.slice(0, 200),
        status,
        method: response.request().method(),
      }

      // 尝试获取响应体（可能失败）
      try {
        const body = await response.text()
        if (body) {
          reqInfo.bodyPreview = body.slice(0, 500)
          if (body.includes('请求失败') || body.includes('网络异常')) {
            reqInfo.hasError = true
          }
        }
      } catch {
        // 响应体可能无法读取（SSE 流等）
      }

      requests.push(reqInfo)
      if (status >= 400 || reqInfo.hasError) {
        failedRequests.push(reqInfo)
        console.log(`  [API] ❌ ${status} ${reqInfo.method} ${url.slice(0, 120)}`)
        if (reqInfo.bodyPreview) {
          console.log(`         响应: ${reqInfo.bodyPreview.slice(0, 200)}`)
        }
      } else {
        console.log(`  [API] ✅ ${status} ${reqInfo.method} ${url.slice(0, 120)}`)
      }
    }
  })

  return { requests, failedRequests }
}

async function checkPageForErrors(page) {
  try {
    const text = await page.evaluate(() => document.body?.innerText?.slice(0, 4000) || '')
    const errorTexts = ['请求失败', '网络异常', '请重试', '出错了']
    const found = errorTexts.filter((t) => text.includes(t))
    if (found.length > 0) {
      console.log(`  [页面] ⚠️ 检测到错误文本: ${found.join(', ')}`)
      // 截取错误上下文
      for (const err of found) {
        const idx = text.indexOf(err)
        if (idx >= 0) {
          const context = text.slice(Math.max(0, idx - 30), idx + 50)
          console.log(`         上下文: ...${context}...`)
        }
      }
      return found
    }
    return []
  } catch {
    return []
  }
}

async function getAnswerText(page) {
  const answerSelectors = [
    '#chat-content',
    '.agent-dialogue__content--common__content',
    '.hyc-common-markdown',
    '[class*="chat-message"]',
  ]
  for (const sel of answerSelectors) {
    const el = await page.$(sel).catch(() => null)
    if (el) {
      const text = await el.evaluate((e) => e.innerText?.slice(0, 500) || '').catch(() => '')
      if (text.trim().length > 0) {
        return text.trim()
      }
    }
  }
  return ''
}

async function main() {
  console.log('=== 方案 3: 独立 Chrome 验证元宝发送 ===')
  console.log()

  // 配置 stealth 插件（与 browser.ts 一致）
  const plugin = StealthPlugin()
  plugin.enabledEvasions.delete('iframe.contentWindow')
  plugin.enabledEvasions.delete('navigator.permissions')
  plugin.enabledEvasions.delete('chrome.runtime')
  plugin.enabledEvasions.delete('user-agent-override')
  puppeteerExtra.use(plugin)

  console.log('[启动] 使用独立 Chrome + stealth 插件（非 Electron）')
  const browser = await puppeteerExtra.launch({
    headless: false,
    defaultViewport: { width: 1366, height: 900 },
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      `--user-agent=${FIXED_UA}`,
    ],
  })

  try {
    const page = (await browser.pages())[0] || (await browser.newPage())
    await page.setUserAgent(FIXED_UA)
    page.setDefaultTimeout(45_000)

    // 设置网络监控
    console.log('[监控] 设置网络请求监控...')
    const { requests, failedRequests } = await setupNetworkMonitoring(page)

    // 导航到元宝
    console.log(`[导航] 打开 ${CHAT_URL}`)
    await page.goto(CHAT_URL, { waitUntil: 'domcontentloaded' })

    // 等待登录
    const loggedIn = await waitForLogin(page)
    if (!loggedIn) {
      console.error('[失败] 未检测到登录状态，退出。')
      await browser.close()
      process.exit(1)
    }

    // 等待页面完全加载
    await new Promise((r) => setTimeout(r, 3000))

    // 查找输入框
    console.log('[输入] 查找聊天输入框...')
    const inputEl = await findElement(page, INPUT_SELECTORS, 10_000)
    if (!inputEl) {
      console.error('[失败] 未找到输入框，请检查页面状态。')
      console.log('[提示] 浏览器保持打开，可手动 F12 检查。')
      // 不关闭浏览器，让用户检查
      return
    }

    // 记录发送前的回答区内容（用于后续对比，避免误匹配欢迎页）
    const textBeforeSend = await getAnswerText(page)
    console.log(`[基线] 发送前回答区内容: ${textBeforeSend.slice(0, 80) || '(空)'}`)

    // 聚焦并输入
    console.log(`[输入] 输入测试问题: "${TEST_QUESTION}"`)
    await inputEl.click()
    await new Promise((r) => setTimeout(r, 500))

    // 逐字符输入（与 GeoJobService fill 步骤一致，触发 onKeyDown/input 事件）
    await page.keyboard.type(TEST_QUESTION, { delay: 30 })
    await new Promise((r) => setTimeout(r, 500))

    // 查找发送按钮
    console.log('[发送] 查找发送按钮...')
    const submitEl = await findElement(page, SUBMIT_SELECTORS, 5_000)

    if (submitEl) {
      console.log('[发送] 点击发送按钮')
      await submitEl.click()
    } else {
      console.log('[发送] 未找到发送按钮，尝试回车提交')
      await page.keyboard.press('Enter')
    }

    // 等待响应（最多 60 秒）
    console.log()
    console.log('[等待] 监控网络请求和页面状态（最多 60 秒）...')
    console.log()

    let answered = false
    let pageErrors = []
    const waitStart = Date.now()

    while (Date.now() - waitStart < 60_000) {
      await new Promise((r) => setTimeout(r, 3000))

      // 检查页面错误
      pageErrors = await checkPageForErrors(page)
      if (pageErrors.length > 0) {
        console.log()
        console.log('⚠️ 页面检测到错误，可能是风控拦截。')
        break
      }

      // 检查是否出现新回答（与发送前对比）
      const currentText = await getAnswerText(page)
      if (currentText && currentText !== textBeforeSend && currentText.length > textBeforeSend.length + 10) {
        console.log(`  [回答] ✅ 检测到新回答内容 (${currentText.length} 字符)`)
        console.log(`         预览: ${currentText.slice(0, 200)}...`)
        answered = true
        console.log()
        console.log('✅ 检测到回答内容，消息发送成功！')
        break
      }
    }

    // 最终报告
    console.log()
    console.log('=== 诊断结果 ===')
    console.log()
    console.log(`环境: 独立 Chrome + stealth（非 Electron）`)
    console.log(`网络请求总数: ${requests.length}`)
    console.log(`失败请求数: ${failedRequests.length}`)
    console.log(`页面错误: ${pageErrors.length > 0 ? pageErrors.join(', ') : '无'}`)
    console.log(`回答出现: ${answered ? '是 ✅' : '否 ❌'}`)
    console.log()

    if (answered) {
      console.log('🎯 结论: 独立 Chrome 发送成功！')
      console.log('   这证实了 Electron 渲染环境本身被元宝前端风控识别，')
      console.log('   不是 Cookie/账号/输入逻辑问题。')
      console.log('   建议后续采用方案 1（剥离自动化到独立 Chrome 进程）。')
    } else if (pageErrors.length > 0) {
      console.log('🎯 结论: 独立 Chrome 也出现了错误。')
      console.log('   问题可能不是 Electron 环境指纹，而是：')
      console.log('   - 账号被风控标记')
      console.log('   - Cookie/登录态问题')
      console.log('   - 元宝服务端问题')
      console.log('   请检查上方网络请求详情。')
    } else {
      console.log('🎯 结论: 未检测到明确成功或失败。')
      console.log('   请手动检查浏览器中的页面状态和网络请求。')
    }

    console.log()
    console.log('[提示] 浏览器保持打开，可 F12 检查网络请求。')
    console.log('[提示] 按 Ctrl+C 退出脚本。')

    // 保持运行，让用户检查
    await new Promise(() => {})
  } catch (err) {
    console.error('[错误]', err)
    await browser.close().catch(() => {})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
