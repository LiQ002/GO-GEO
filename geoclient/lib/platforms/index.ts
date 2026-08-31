export type {
  PlatformPublisher,
  PublishArticleInput,
  PublishArticleResult,
} from './types'
export type { Platform, PlatformKind, MediaPlatform, ModelPlatform } from './unified'
export {
  getPlatform,
  requirePlatform,
  listPlatforms,
  resolvePlatformKind,
  getCookieSiteUrl,
  getTargetUrl,
  isMediaPlatform,
} from './unified'
export {
  parseCookieHeader,
  preparePuppeteerCookies,
  cookiesFromHeader,
  buildPuppeteerCookies,
  buildPuppeteerCookiesWithUrl,
  cookiesToHeader,
  serializeSessionCookies,
  deserializeSessionCookies,
  deserializeSessionLocalStorage,
  isSerializedSessionCookies,
} from './cookies'
export type {
  CookiePersistFilter,
  LocalStoragePersistFilter,
  StoredSessionPayload,
} from './cookies'
export { getPlatformPublisher, listPlatformPublishers, requirePlatformPublisher } from './registry'

export { wechatPublisher } from './wechat'
export { zhihuPublisher } from './zhihu'
export { toutiaoPublisher } from './toutiao'
export { weiboPublisher } from './weibo'
export { baijiahaoPublisher } from './baijiahao'
export { xiaohongshuPublisher } from './xiaohongshu'

import { listPlatformPublishers } from './registry'

export function getPlatformColor(name: string) {
  return listPlatformPublishers().find((p) => p.id === name)?.color ?? '#6366f1'
}

export function getPlatformIconStyle(name: string) {
  return (
    listPlatformPublishers().find((p) => p.id === name)?.iconStyle ?? {
      bg: '#6366f115',
      text: '#6366f1',
    }
  )
}

export function getPlatformLoginUrl(name: string) {
  return listPlatformPublishers().find((p) => p.id === name)?.loginUrl
}

export function getPlatformPublishUrl(name: string) {
  return listPlatformPublishers().find((p) => p.id === name)?.publishUrl
}
