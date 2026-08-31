import type { PlatformPublisher } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'
import { publishToutiaoArticle } from './publish'

const manifest = requirePlatformManifest('toutiao', 'media')

export const toutiaoPublisher: PlatformPublisher = {
  ...manifest,
  publishUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://mp.toutiao.com',
  publishArticle: publishToutiaoArticle,
}
