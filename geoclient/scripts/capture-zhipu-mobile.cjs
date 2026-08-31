/**
 * 在 Electron 主进程环境中运行，通过 authService 恢复智谱登录态并捕获移动端 DOM
 * 运行方式: npx electron scripts/capture-zhipu-mobile.js
 */
const { app } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

// 设置 Next.js 开发模式
process.env.NEXT_PUBLIC_APP_MODE = 'operator'
process.env.ELECTRON_RENDERER_URL = 'http://localhost:3001'

// 必须在 app ready 前设置
app.commandLine.appendSwitch('disable-gpu')

app.whenReady().then(async () => {
  try {
    console.log('=== 智谱移动端 DOM 捕获脚本 ===')

    // 动态导入编译后的模块
    const { authService } = require('../main/electron/main/services/AuthService')
    const { launchBrowser, getOrCreateMainPage } = require('../main/electron/main/browser')

    // 智谱平台配置
    const platformId = 'zhipu'
    const cookieSiteUrl = 'https://chatglm.cn'
    const targetUrl = 'https://chatglm.cn/'
    const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'

    console.log('1. 启动浏览器（stealth 模式）...')
    const browser = await launchBrowser({ stealth: true })
    const page = await getOrCreateMainPage(browser)
    page.setDefaultTimeout(45_000)

    // 设置移动端 UA 和 viewport
    await page.setUserAgent(mobileUA)
    await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true })
    console.log('2. 已设置移动端 UA 和 viewport')

    // 导航到智谱站点恢复登录态
    console.log('3. 导航到 cookieSiteUrl 恢复登录态...')
    await page.goto(cookieSiteUrl, { waitUntil: 'domcontentloaded' })

    // 尝试获取智谱的加密凭证（从 Electron 的 secure storage）
    // 由于无法直接获取加密凭证，改为直接导航到目标页面
    // 如果已授权过，cookie 应该已经通过 launchBrowser 中的持久化恢复
    console.log('4. 导航到目标 URL:', targetUrl)
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    } catch (err) {
      console.log('   导航超时，继续检查:', err.message)
    }

    // 等待页面渲染
    console.log('5. 等待页面渲染（8秒）...')
    await new Promise((r) => setTimeout(r, 8_000))

    const currentUrl = page.url()
    const title = await page.title()
    console.log('6. 当前 URL:', currentUrl)
    console.log('   页面标题:', title)

    // 检查是否在登录页
    if (currentUrl.includes('login') || currentUrl.includes('applyAndLogin')) {
      console.log('   ⚠️  页面被重定向到登录页，说明没有登录态')
      console.log('   请先在 Electron 应用中对智谱进行移动端授权')
    }

    // 提取关键 DOM 信息
    console.log('\n=== DOM 诊断信息 ===')
    const result = await page.evaluate(() => {
      const info = {
        bodyTextLength: (document.body.textContent || '').length,
        bodyTextSnippet: (document.body.textContent || '').substring(0, 300),
        textareas: [],
        contentEditables: [],
        inputAreas: [],
        enterIcons: [],
        submitButtons: [],
        allButtons: [],
      }

      document.querySelectorAll('textarea').forEach((el) => {
        info.textareas.push({
          placeholder: el.getAttribute('placeholder') || '',
          id: el.id || '',
          classes: el.className || '',
          outerHTML: el.outerHTML.substring(0, 300),
        })
      })

      document.querySelectorAll('[contenteditable="true"]').forEach((el) => {
        info.contentEditables.push({
          tag: el.tagName.toLowerCase(),
          classes: el.className || '',
          outerHTML: el.outerHTML.substring(0, 300),
        })
      })

      document.querySelectorAll('[class*="input"], [class*="chat-input"], [class*="message-input"]').forEach((el, i) => {
        if (i < 10) {
          info.inputAreas.push({
            tag: el.tagName.toLowerCase(),
            classes: (el.className || '').substring(0, 100),
            placeholder: el.getAttribute('placeholder') || '',
          })
        }
      })

      document.querySelectorAll('[class*="enter-icon"], [class*="submit"], [class*="send"]').forEach((el) => {
        info.enterIcons.push({
          tag: el.tagName.toLowerCase(),
          classes: (el.className || '').substring(0, 100),
          outerHTML: el.outerHTML.substring(0, 200),
        })
      })

      document.querySelectorAll('button, [role="button"]').forEach((el, i) => {
        if (i < 15) {
          info.allButtons.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || '').trim().substring(0, 30),
            classes: (el.className || '').substring(0, 80),
            ariaLabel: el.getAttribute('aria-label') || '',
            type: el.getAttribute('type') || '',
          })
        }
      })

      return info
    })

    console.log('body 文本长度:', result.bodyTextLength)
    console.log('body 文本片段:', result.bodyTextSnippet.substring(0, 200))

    console.log('\n--- textarea 元素 (' + result.textareas.length + ') ---')
    result.textareas.forEach((el, i) => {
      console.log(`  [${i}] placeholder="${el.placeholder}" id="${el.id}"`)
      console.log(`      classes: ${el.classes.substring(0, 100)}`)
      console.log(`      outerHTML: ${el.outerHTML.substring(0, 200)}`)
    })

    console.log('\n--- contenteditable 元素 (' + result.contentEditables.length + ') ---')
    result.contentEditables.forEach((el, i) => {
      console.log(`  [${i}] tag=${el.tag} classes="${el.classes.substring(0, 100)}"`)
      console.log(`      outerHTML: ${el.outerHTML.substring(0, 200)}`)
    })

    console.log('\n--- input 相关元素 (' + result.inputAreas.length + ') ---')
    result.inputAreas.forEach((el, i) => {
      console.log(`  [${i}] tag=${el.tag} placeholder="${el.placeholder}" classes="${el.classes}"`)
    })

    console.log('\n--- enter-icon/submit/send 元素 (' + result.enterIcons.length + ') ---')
    result.enterIcons.forEach((el, i) => {
      console.log(`  [${i}] tag=${el.tag} classes="${el.classes}"`)
      console.log(`      outerHTML: ${el.outerHTML.substring(0, 150)}`)
    })

    console.log('\n--- 按钮元素 (' + result.allButtons.length + ') ---')
    result.allButtons.forEach((el, i) => {
      console.log(`  [${i}] text="${el.text}" aria-label="${el.ariaLabel}" type="${el.type}"`)
      console.log(`      classes: ${el.classes.substring(0, 80)}`)
    })

    // 保存完整 DOM 快照
    const evidenceDir = path.join(process.cwd(), 'geo-evidence')
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true })
    }
    const htmlPath = path.join(evidenceDir, 'zhipu-mobile-capture.html')
    const fullHtml = await page.evaluate(() => document.body.outerHTML)
    fs.writeFileSync(htmlPath, `<html><head><meta charset="utf-8"></head><body>${fullHtml}</body></html>`)
    console.log(`\n=== DOM 快照已保存: ${htmlPath} ===`)

    // 保存截图
    const screenshotPath = path.join(evidenceDir, 'zhipu-mobile-capture.png')
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`=== 截图已保存: ${screenshotPath} ===`)

    await browser.close()
    console.log('\n=== 完成 ===')
  } catch (err) {
    console.error('脚本执行失败:', err)
  } finally {
    app.quit()
  }
})
