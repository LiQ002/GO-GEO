import type { PlatformPublisher } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'
import { publishJianshuArticle } from './publish'

const manifest = requirePlatformManifest('jianshu', 'media')

export const jianshuPublisher: PlatformPublisher = {
  ...manifest,
  publishUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://www.jianshu.com',
  cookieDomain: '.jianshu.com',
  useStealth: true,
  publishArticle: publishJianshuArticle,
}
