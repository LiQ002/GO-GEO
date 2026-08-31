import type { Page } from 'puppeteer'

export function isWechatAuthenticatedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'mp.weixin.qq.com' &&
      parsed.pathname.startsWith('/cgi-bin/') &&
      !/\/(?:bizlogin|loginpage)(?:\/|$)/.test(parsed.pathname) &&
      Boolean(parsed.searchParams.get('token'))
    )
  } catch {
    return false
  }
}

export async function assertWechatAuthenticated(page: Page): Promise<void> {
  if (!isWechatAuthenticatedUrl(page.url())) {
    throw new Error('尚未完成公众号扫码登录，请在登录窗口进入公众号后台后重试')
  }
}

/** Normalize any logged-in mp.weixin.qq.com URL to the home URL with the same token. */
export function normalizeWechatAuthUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const token = parsed.searchParams.get('token')
    if (!token || parsed.hostname !== 'mp.weixin.qq.com') {
      return url
    }
    return `https://mp.weixin.qq.com/cgi-bin/home?t=home/index&token=${token}&lang=zh_CN`
  } catch {
    return url
  }
}

export function extractWechatToken(authUrl: string): string | null {
  try {
    return new URL(authUrl).searchParams.get('token')
  } catch {
    return null
  }
}

/** Build a publish URL that reuses the token from the saved auth session URL. */
export function buildWechatPublishUrl(authUrl: string, publishPath: string): string {
  const token = extractWechatToken(authUrl)
  if (!token) {
    throw new Error('WeChat auth URL is missing token')
  }
  const url = new URL(publishPath, 'https://mp.weixin.qq.com')
  url.searchParams.set('token', token)
  url.searchParams.set('lang', 'zh_CN')
  return url.toString()
}
