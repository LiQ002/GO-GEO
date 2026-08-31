/**
 * test-doubao-mobile.mjs — 测试豆包移动端查收录流程
 *
 * 用途：
 *   1. 验证移动端 UA / viewport / isMobile 是否正确注入
 *   2. 打印实际请求头（重点：sec-ch-ua 是否被发出）
 *   3. 捕获豆包移动端 DOM 结构（input/submit/answerContainer 选择器）
 *   4. 若传入 encryptedSecret，则执行完整查收录流程
 *
 * 用法：
 *   # 无登录态（仅捕获 DOM + 请求头）
 *   node scripts/test-doubao-mobile.mjs
 *
 *   # 带登录态（完整查收录流程）
 *   node scripts/test-doubao-mobile.mjs <encryptedSecret>
 */

import { fork } from 'node:child_process'
import { join } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'

const WORKER_SCRIPT = join(process.cwd(), 'main', 'electron', 'worker', 'geo-worker.js')
const encryptedSecret = process.argv[2] || ''

const testInput = {
  jobId: 'test-doubao-mobile-001',
  taskId: 998,
  enterpriseId: 1,
  question: '矿泉水品牌有哪些？',
  platformName: 'doubao',
  terminalType: 2,                                    // ← 移动端
  siteEntryUrl: 'https://www.doubao.com',
  ...(encryptedSecret ? { encryptedSecret } : {}),
}

console.log('[test] Forking worker:', WORKER_SCRIPT)
console.log('[test] Input:', JSON.stringify(testInput, null, 2))

const child = fork(WORKER_SCRIPT, [], {
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    // 调试模式：保持浏览器打开，便于手动 F12 检查
    __GEO_KEEP_OPEN__: '0',
  },
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
})

// 关键日志收集
const requestHeadersLog = []
const domCaptureLog = []

const timeout = setTimeout(() => {
  console.error('[test] Worker timed out after 240s')
  child.kill('SIGKILL')
  process.exit(1)
}, 240_000)

child.on('message', (msg) => {
  if (msg.type === 'log') {
    const line = `[${msg.level}] ${msg.message}`
    console.log(`[test] ${line}`)
    if (msg.data) console.log(`[test]   data:`, JSON.stringify(msg.data).slice(0, 500))

    // 收集请求头信息
    if (msg.message && msg.message.includes('Request headers')) {
      requestHeadersLog.push(msg.data)
    }
  }

  if (msg.type === 'result') {
    clearTimeout(timeout)
    console.log('\n[test] ✅ SUCCESS')
    console.log('[test] Answer length:', msg.result.answerText?.length)
    console.log('[test] Answer status:', msg.result.answerStatus)
    console.log('[test] Citations:', msg.result.citations?.length)
    console.log('[test] Session ref:', msg.result.sessionRef)
    console.log('[test] Answer preview:', msg.result.answerText?.slice(0, 300))
    process.exit(0)
  }

  if (msg.type === 'error') {
    clearTimeout(timeout)
    console.error('\n[test] ❌ ERROR:', msg.message)
    if (msg.stack) console.error(msg.stack)
    process.exit(1)
  }
})

child.on('error', (err) => {
  clearTimeout(timeout)
  console.error('[test] Process error:', err)
  process.exit(1)
})

child.on('exit', (code) => {
  clearTimeout(timeout)
  console.log('\n[test] Worker exited with code:', code)

  // 保存请求头日志（即使失败也保存）
  if (requestHeadersLog.length > 0) {
    const evidenceDir = join(process.cwd(), 'geo-evidence')
    mkdirSync(evidenceDir, { recursive: true })
    const logPath = join(evidenceDir, 'doubao-mobile-request-headers.json')
    writeFileSync(logPath, JSON.stringify(requestHeadersLog, null, 2))
    console.log(`[test] 请求头日志已保存: ${logPath}`)
  }
})

// Send the geo-job command
console.log('[test] Sending geo-job command...')
child.send({
  type: 'geo-job',
  input: testInput,
  evidenceDir: join(process.cwd(), 'geo-evidence'),
})
