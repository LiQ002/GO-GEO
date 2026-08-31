import type { ModelPlatformConfig } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'

const manifest = requirePlatformManifest('zhipu', 'model')

/**
 * 规范化智谱授权URL：去除 alltoolsdetail 等工具页路径，统一回到根域名。
 * 原因：alltoolsdetail 是访客可访问的工具详情页，以访客模式加载会导致
 * AI 回答被主动终止（"本次回答已被终止"）。根域名 https://chatglm.cn/ 会
 * 根据 cookies/localStorage 自动跳转到已登录的聊天主页。
 */
function normalizeZhipuAuthUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // 只保留 origin，丢弃路径和查询参数
    return `${parsed.origin}/`
  } catch {
    return 'https://chatglm.cn/'
  }
}

export const zhipuModel: ModelPlatformConfig = {
  ...manifest,
  chatUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://chatglm.cn',
  cookieDomain: '.chatglm.cn',
  normalizeAuthUrl: normalizeZhipuAuthUrl,
  cookiePersistFilter: {
    names: [
      'chatglm_token',
      'chatglm_token_expires',
      'chatglm_refresh_token',
      'chatglm_user_id',
      'cdn_sec_tc',
      'acw_tc',
      'ssxmod_itna',
      'ssxmod_itna2',
    ],
  },
  // Keep vuex snapshot as a safety net for client-side auth hydration.
  localStoragePersistFilter: {
    keys: ['vuex'],
  },
  useStealth: true,
  // 智谱需要在首次导航前注入 cookies + localStorage，
  // 否则页面以访客模式加载，AI 回答会被主动终止（"本次回答已被终止"）。
  preloadAuthState: true,
}
