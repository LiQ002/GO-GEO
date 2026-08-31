import type { PlatformPublisher } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'
import { createSafeDraftPublisher } from '../draft'

const manifest = requirePlatformManifest('xiaohongshu', 'media')

export const XIAOHONGSHU_SELECTORS = {
  longArticleEntry: '::-p-xpath(//*[normalize-space(.)="写长文"])',
  title: 'textarea[placeholder="请输入标题"]',
  editor: '.ProseMirror[contenteditable="true"]',
  draftButton: '::-p-xpath(//button[normalize-space(.)="存草稿"])',
  saveSuccess: '::-p-text(保存成功)',
} as const

export const xiaohongshuPublisher: PlatformPublisher = {
  ...manifest,
  publishUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://creator.xiaohongshu.com',
  publishArticle: createSafeDraftPublisher({
    platformLabel: manifest.label,
    prepareActions: [{ selector: XIAOHONGSHU_SELECTORS.longArticleEntry, required: false }],
    titleSelector: XIAOHONGSHU_SELECTORS.title,
    contentSelector: XIAOHONGSHU_SELECTORS.editor,
    save: {
      mode: 'button',
      selector: XIAOHONGSHU_SELECTORS.draftButton,
      successSelector: XIAOHONGSHU_SELECTORS.saveSuccess,
    },
  }),
}
