import { requirePlatformManifest } from '@/lib/platform-manifest'
import type { PublishArticleInput } from '@/lib/platforms/types'

export const MEDIA_DEMO_PLATFORM_IDS = [
  'wechat',
  'zhihu',
  'toutiao',
  'weibo',
  'baijiahao',
  'xiaohongshu',
] as const

export type MediaDemoPlatformId = (typeof MEDIA_DEMO_PLATFORM_IDS)[number]
export type MediaDemoCompletion = 'draft' | 'autosave' | 'filled'

const completionByPlatform = {
  wechat: 'draft',
  zhihu: 'autosave',
  toutiao: 'draft',
  weibo: 'filled',
  baijiahao: 'draft',
  xiaohongshu: 'draft',
} as const satisfies Record<MediaDemoPlatformId, MediaDemoCompletion>

export const MEDIA_DEMO_PLATFORMS = MEDIA_DEMO_PLATFORM_IDS.map((id) => ({
  ...requirePlatformManifest(id, 'media'),
  completion: completionByPlatform[id],
}))

export function getMediaDemoPlatform(id: MediaDemoPlatformId) {
  return MEDIA_DEMO_PLATFORMS.find((platform) => platform.id === id)!
}

/** Fixed local article used by the operator-side multi-platform publishing example. */
export const MEDIA_DEMO_ARTICLE: Readonly<PublishArticleInput> = {
  title: '示例文章：企业如何用 GEO 助手提升内容发布效率',
  author: 'GEO 助手示例',
  summary: '这是一篇仅用于验证多平台文章自动填充和安全保存草稿流程的本地模拟文章。',
  tags: ['GEO', '自动发布', '多平台'],
  content: `
    <section>
      <h2>从一次内容创作开始</h2>
      <p>这是一篇由运营端生成的模拟文章，用于验证 Puppeteer 能否打开内容平台后台并填写标题、摘要和正文。</p>
      <h3>自动化流程</h3>
      <ol>
        <li>运营人员在平台窗口中完成登录。</li>
        <li>客户端在本机捕获并加密保存登录会话。</li>
        <li>Puppeteer 打开文章编辑器并使用键盘输入模拟内容。</li>
        <li>示例只执行安全的草稿保存或停留在编辑页，不触发正式发布。</li>
      </ol>
      <p><strong>说明：</strong>本文为功能演示数据，不代表真实业务内容。</p>
    </section>
  `.trim(),
}
