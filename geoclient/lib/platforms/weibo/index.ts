import type { PlatformPublisher } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'
import { assertWeiboAuthenticated, publishWeiboArticle } from './publish'

const manifest = requirePlatformManifest('weibo', 'media')

export const weiboPublisher: PlatformPublisher = {
  ...manifest,
  publishUrl: 'https://weibo.com/home',
  cookieSiteUrl: 'https://weibo.com',
  cookieDomain: '.weibo.com',
  cookiePersistFilter: {
    names: ['SUB'],
  },
  preloadAuthState: true,
  assertAuthenticated: assertWeiboAuthenticated,
  publishArticle: publishWeiboArticle,
  useStealth: true,
}
