/**
 * test-geo-worker.mjs — Quick standalone test for the GEO worker.
 *
 * Forks the compiled geo-worker.js and sends a test geo-job command.
 * Usage: node scripts/test-geo-worker.mjs
 */

import { fork } from 'node:child_process'
import { join } from 'node:path'

const WORKER_SCRIPT = join(process.cwd(), 'main', 'electron', 'worker', 'geo-worker.js')

const testInput = {
  jobId: 'test-worker-001',
  taskId: 999,
  enterpriseId: 1,
  question: '矿泉水品牌有哪些？',
  platformName: 'yuanbao',
  terminalType: 1,
  siteEntryUrl: 'https://yuanbao.tencent.com',
  // No encryptedSecret — tests the no-login path (just launches browser and navigates)
}

console.log('[test] Forking worker:', WORKER_SCRIPT)

const child = fork(WORKER_SCRIPT, [], {
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
})

const timeout = setTimeout(() => {
  console.error('[test] Worker timed out after 120s')
  child.kill('SIGKILL')
  process.exit(1)
}, 120_000)

child.on('message', (msg) => {
  console.log('[test] Worker message:', JSON.stringify(msg, null, 2).slice(0, 500))

  if (msg.type === 'result') {
    clearTimeout(timeout)
    console.log('[test] ✅ SUCCESS')
    console.log('[test] Answer length:', msg.result.answerText?.length)
    console.log('[test] Answer status:', msg.result.answerStatus)
    console.log('[test] Citations:', msg.result.citations?.length)
    console.log('[test] Session ref:', msg.result.sessionRef)
    console.log('[test] Answer preview:', msg.result.answerText?.slice(0, 200))
    process.exit(0)
  }

  if (msg.type === 'error') {
    clearTimeout(timeout)
    console.error('[test] ❌ ERROR:', msg.message)
    if (msg.stack) console.error(msg.stack)
    process.exit(1)
  }

  if (msg.type === 'log') {
    console.log(`[test] [${msg.level}] ${msg.message}`)
  }
})

child.on('error', (err) => {
  clearTimeout(timeout)
  console.error('[test] Process error:', err)
  process.exit(1)
})

child.on('exit', (code) => {
  clearTimeout(timeout)
  console.log('[test] Worker exited with code:', code)
})

// Send the geo-job command
console.log('[test] Sending geo-job command...')
child.send({
  type: 'geo-job',
  input: testInput,
  evidenceDir: join(process.cwd(), 'geo-evidence'),
})
