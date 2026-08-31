import type { ModelPlatformConfig } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'

const manifest = requirePlatformManifest('wenxin', 'model')

export const wenxinModel: ModelPlatformConfig = {
  ...manifest,
  chatUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://chat.baidu.com',
  cookieDomain: '.baidu.com',
}
