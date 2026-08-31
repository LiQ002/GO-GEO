import type { ModelPlatformConfig } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'

const manifest = requirePlatformManifest('doubao', 'model')

export const doubaoModel: ModelPlatformConfig = {
  ...manifest,
  chatUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://www.doubao.com',
  cookieDomain: '.doubao.com',
  // 豆包 API 会检测 navigator.webdriver，未启用 stealth 时消息发送会被拒绝（红色感叹号）
  useStealth: true,
}
