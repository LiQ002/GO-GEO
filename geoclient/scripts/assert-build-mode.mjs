import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const expected = process.env.NEXT_PUBLIC_APP_MODE

if (expected !== 'client' && expected !== 'operator') {
  throw new Error('NEXT_PUBLIC_APP_MODE must be set while asserting a renderer build')
}

const markerPath = resolve('out', 'build-mode.json')
const marker = JSON.parse(readFileSync(markerPath, 'utf8'))

if (marker.mode !== expected) {
  throw new Error(`Renderer mode mismatch: expected ${expected}, found ${String(marker.mode)}`)
}

console.log(`[build-mode] verified ${expected} renderer at ${markerPath}`)
