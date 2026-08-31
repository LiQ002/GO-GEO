import type { PlatformPublisher } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'
import { publishNeteaseArticle } from './publish'

const manifest = requirePlatformManifest('netease', 'media')

export const neteasePublisher: PlatformPublisher = {
  ...manifest,
  publishUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://mp.163.com',
  cookieDomain: '.163.com',
  publishArticle: publishNeteaseArticle,
}
