import type { PlatformPublisher } from '../types'
import {
  assertWechatAuthenticated,
  buildWechatPublishUrl,
  normalizeWechatAuthUrl,
} from './auth'
import { publishWechatArticle } from './publish'
import { requirePlatformManifest } from '../../platform-manifest'

const WECHAT_PUBLISH_PATH =
  '/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=10'
const manifest = requirePlatformManifest('wechat', 'media')

export const wechatPublisher: PlatformPublisher = {
  ...manifest,
  publishUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://mp.weixin.qq.com',

  assertAuthenticated: assertWechatAuthenticated,
  normalizeAuthUrl: normalizeWechatAuthUrl,
  buildPublishUrl: (authUrl) => buildWechatPublishUrl(authUrl, WECHAT_PUBLISH_PATH),

  publishArticle: publishWechatArticle,

  async afterOpenPublish(page) {
    await page
      .waitForFunction(() => /cgi-bin\/home|token=/.test(window.location.href), {
        timeout: 30_000,
      })
      .catch(() => {})
  },
}
