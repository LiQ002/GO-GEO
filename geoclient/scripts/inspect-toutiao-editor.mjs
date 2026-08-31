#!/usr/bin/env node
/**
 * 连接本地已开启远程调试的 Electron/Puppeteer 浏览器，
 * 抓取头条文章编辑器正文区的真实 DOM 信息。
 *
 * 用法：
 * 1. 先以调试模式启动 operator：
 *    pnpm run dev:operator:debug
 * 2. 在弹出的浏览器里打开头条文章编辑器页面：
 *    https://mp.toutiao.com/profile_v4/graphic/publish
 * 3. 另开一个终端执行：
 *    node scripts/inspect-toutiao-editor.mjs
 */

import http from 'http'
import puppeteer from 'puppeteer'

const CDP_PORT = 9222

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(new Error(`解析 JSON 失败: ${e.message}\n${data.slice(0, 200)}`))
          }
        })
      })
      .on('error', reject)
  })
}

async function main() {
  let targets
  try {
    targets = await fetchJson(`http://localhost:${CDP_PORT}/json/list`)
  } catch (err) {
    console.error(`无法连接到 localhost:${CDP_PORT}，请确认已用调试模式启动 operator：`)
    console.error('  pnpm run dev:operator:debug')
    console.error('原始错误：', err.message)
    process.exit(1)
  }

  const pageTarget = targets.find(
    (t) =>
      t.type === 'page' &&
      t.url &&
      t.url.includes('mp.toutiao.com/profile_v4/graphic/publish'),
  )

  if (!pageTarget) {
    console.error('没找到头条文章编辑器页面，请确认浏览器已打开：')
    console.error('  https://mp.toutiao.com/profile_v4/graphic/publish')
    console.error('当前页面列表：')
    targets
      .filter((t) => t.type === 'page')
      .forEach((t) => console.error(`  - ${t.title}: ${t.url}`))
    process.exit(1)
  }

  console.log(`连接到页面: ${pageTarget.title}`)
  const browser = await puppeteer.connect({
    browserWSEndpoint: pageTarget.webSocketDebuggerUrl,
    defaultViewport: null,
  })

  const pages = await browser.pages()
  const page = pages.find((p) => p.url().includes('mp.toutiao.com/profile_v4/graphic/publish'))
  if (!page) {
    console.error('连接成功但未找到对应 page 对象')
    process.exit(1)
  }

  const editors = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll(
        '[contenteditable="true"], textarea[placeholder*="正文"], [placeholder*="正文"], [data-placeholder*="正文"]',
      ),
    )
    return candidates.map((el, idx) => {
      const rect = el.getBoundingClientRect()
      const attrs = {}
      for (const attr of el.attributes) {
        attrs[attr.name] = attr.value
      }
      return {
        index: idx,
        tag: el.tagName,
        id: el.id || null,
        className: el.className || null,
        attributes: attrs,
        placeholder: el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || null,
        textPreview: (el.textContent || '').slice(0, 80),
        size: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
        outerHTML: el.outerHTML.slice(0, 800),
      }
    })
  })

  console.log('\n找到', editors.length, '个候选编辑器元素：\n')
  for (const ed of editors) {
    console.log('--- 候选 #', ed.index, '---')
    console.log('标签:', ed.tag)
    console.log('id:', ed.id)
    console.log('class:', ed.className)
    console.log('placeholder:', ed.placeholder)
    console.log('textPreview:', ed.textPreview)
    console.log('size:', JSON.stringify(ed.size))
    console.log('attributes:', JSON.stringify(ed.attributes, null, 2))
    console.log('outerHTML:', ed.outerHTML)
    console.log()
  }

  await browser.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
