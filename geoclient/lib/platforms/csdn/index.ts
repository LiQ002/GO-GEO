import type { PlatformPublisher } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'
import { publishCsdnArticle } from './publish'

const manifest = requirePlatformManifest('csdn', 'media')

export const csdnPublisher: PlatformPublisher = {
  ...manifest,
  publishUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://mp.csdn.net',
  cookieDomain: '.csdn.net',
  publishArticle: publishCsdnArticle,
}
