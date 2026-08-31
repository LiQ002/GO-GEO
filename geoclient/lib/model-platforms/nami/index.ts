import type { ModelPlatformConfig } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'

const manifest = requirePlatformManifest('nami', 'model')

export const namiModel: ModelPlatformConfig = {
  ...manifest,
  chatUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://www.n.cn',
  cookieDomain: '.n.cn',
}
