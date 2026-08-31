import type { PlatformPublisher } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'
import { publishZhihuArticle } from './publish'

const manifest = requirePlatformManifest('zhihu', 'media')

export const zhihuPublisher: PlatformPublisher = {
  ...manifest,
  publishUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://zhuanlan.zhihu.com',
  cookieDomain: '.zhihu.com',
  useStealth: true,
  publishArticle: publishZhihuArticle,
}
