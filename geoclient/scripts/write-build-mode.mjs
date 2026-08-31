import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mode = process.env.NEXT_PUBLIC_APP_MODE

if (mode !== 'client' && mode !== 'operator') {
  throw new Error('NEXT_PUBLIC_APP_MODE must be either "client" or "operator"')
}

const publicDir = resolve('public')
mkdirSync(publicDir, { recursive: true })
writeFileSync(
  resolve(publicDir, 'build-mode.json'),
  `${JSON.stringify({ mode, generatedAt: new Date().toISOString() }, null, 2)}\n`,
)

console.log(`[build-mode] prepared ${mode} renderer`)
