import type { PlatformPublisher } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'
import { publishQqnewsArticle } from './publish'

const manifest = requirePlatformManifest('qqnews', 'media')

export const qqnewsPublisher: PlatformPublisher = {
  ...manifest,
  publishUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://om.qq.com/main',
  publishArticle: publishQqnewsArticle,
}
