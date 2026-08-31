const DEFAULT_DEV_RENDERER_URL = 'http://localhost:3000'

export function resolveDevRendererUrl(rawUrl?: string): string {
  const parsed = new URL(rawUrl?.trim() || DEFAULT_DEV_RENDERER_URL)
  const isLoopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:'

  if (!isLoopback || !isHttp || parsed.username || parsed.password) {
    throw new Error('ELECTRON_RENDERER_URL must be a loopback HTTP(S) URL')
  }

  return parsed.origin
}
