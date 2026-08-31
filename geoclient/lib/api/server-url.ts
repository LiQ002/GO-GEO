const DEVELOPMENT_SERVER_URL = 'http://geo-api-admin.d.gbicom.com/'
const PRODUCTION_SERVER_URL = 'https://geo-enterprise.d.gbicom.com'

export function isDevelopmentBuild(): boolean {
  return process.env.NODE_ENV === 'development'
}

export function getDefaultServerURL(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    (isDevelopmentBuild() ? DEVELOPMENT_SERVER_URL : PRODUCTION_SERVER_URL)
  )
}

export function normalizeServerURL(
  url: string,
  allowHttp: boolean = isDevelopmentBuild(),
): string {
  const normalized = url.trim().replace(/\/+$/, '') || getDefaultServerURL()
  const parsed = new URL(normalized)

  const isHttps = parsed.protocol === 'https:'
  const isAllowedHttp = allowHttp && parsed.protocol === 'http:'
  if (!isHttps && !isAllowedHttp) {
    throw new Error('正式环境必须使用 HTTPS；HTTP 仅在 pnpm dev:* 开发模式可用')
  }

  return parsed.toString().replace(/\/$/, '')
}
