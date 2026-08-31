import type { ModelPlatformConfig } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'

const manifest = requirePlatformManifest('yuanbao', 'model')

/**
 * 规范化元宝授权URL：去除对话ID路径，统一回到 /chat 根路径。
 *
 * 原因：用户授权时可能停留在某个具体对话（如
 * https://yuanbao.tencent.com/chat/naQivTmsDa/0PeQZS8qyf2），
 * 该 URL 被保存为 authUrl。运行 GEO 任务时若直接使用该 URL，
 * 会在旧对话中继续提问，导致：
 *   1) 新问题追加到历史对话中，AI 上下文混乱
 *   2) 无法获得独立、干净的收录分析
 *
 * 规范化为 https://yuanbao.tencent.com/chat 后，元宝会创建新对话。
 */
function normalizeYuanbaoAuthUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // 只保留 origin + /chat 路径，丢弃对话ID等子路径和查询参数
    return `${parsed.origin}/chat`
  } catch {
    return 'https://yuanbao.tencent.com/chat'
  }
}

export const yuanbaoModel: ModelPlatformConfig = {
  ...manifest,
  chatUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://yuanbao.tencent.com',
  cookieDomain: '.tencent.com',
  normalizeAuthUrl: normalizeYuanbaoAuthUrl,
}
