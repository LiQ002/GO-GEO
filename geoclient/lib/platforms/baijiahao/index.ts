import type { PlatformPublisher } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'
import { publishBaijiahaoArticle } from './publish'

const manifest = requirePlatformManifest('baijiahao', 'media')

export const baijiahaoPublisher: PlatformPublisher = {
  ...manifest,
  publishUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://baijiahao.baidu.com',
  publishArticle: publishBaijiahaoArticle,
}
