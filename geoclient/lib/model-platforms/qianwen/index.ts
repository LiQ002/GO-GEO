import type { ModelPlatformConfig } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'

const manifest = requirePlatformManifest('qianwen', 'model')

export const qianwenModel: ModelPlatformConfig = {
  ...manifest,
  chatUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://www.qianwen.com',
  cookieDomain: '.qianwen.com',
}
