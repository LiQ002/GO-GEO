import type { PlatformPublisher } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'
import { publishSohuArticle } from './publish'

const manifest = requirePlatformManifest('sohu', 'media')

export const sohuPublisher: PlatformPublisher = {
  ...manifest,
  publishUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://mp.sohu.com',
  cookieDomain: '.sohu.com',
  preloadAuthState: true,
  publishArticle: publishSohuArticle,
  useStealth: false,
}
