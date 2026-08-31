import { describe, expect, it } from 'vitest'
import {
  buildWechatPublishUrl,
  isWechatAuthenticatedUrl,
  normalizeWechatAuthUrl,
} from './auth'

describe('WeChat authentication URL', () => {
  const authenticatedUrl =
    'https://mp.weixin.qq.com/cgi-bin/home?t=home/index&token=123456&lang=zh_CN'

  it('accepts only a WeChat backend URL carrying a token', () => {
    expect(isWechatAuthenticatedUrl(authenticatedUrl)).toBe(true)
    expect(isWechatAuthenticatedUrl('https://mp.weixin.qq.com/')).toBe(false)
    expect(isWechatAuthenticatedUrl('https://mp.weixin.qq.com/cgi-bin/bizlogin')).toBe(false)
    expect(
      isWechatAuthenticatedUrl('https://mp.weixin.qq.com/cgi-bin/bizlogin?token=123456'),
    ).toBe(false)
    expect(isWechatAuthenticatedUrl('https://example.com/cgi-bin/home?token=123456')).toBe(false)
  })

  it('normalizes the captured URL and carries its token into the editor', () => {
    expect(normalizeWechatAuthUrl(authenticatedUrl)).toBe(authenticatedUrl)
    const publishUrl = buildWechatPublishUrl(
      authenticatedUrl,
      '/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=10',
    )
    expect(publishUrl).toContain('token=123456')
    expect(publishUrl).toContain('action=edit')
    expect(publishUrl).toContain('t=media%2Fappmsg_edit_v2')
    expect(publishUrl).toContain('isNew=1')
  })
})
