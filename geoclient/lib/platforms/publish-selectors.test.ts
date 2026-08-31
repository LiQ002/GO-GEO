import { describe, expect, it } from 'vitest'
import { BAIJIAHAO_SELECTORS } from './baijiahao/publish'
import { NETEASE_SELECTORS } from './netease/publish'
import { TOUTIAO_SELECTORS } from './toutiao/publish'
import { WECHAT_SELECTORS } from './wechat/publish'
import { WEIBO_SELECTORS } from './weibo/publish'
import { XIAOHONGSHU_SELECTORS } from './xiaohongshu'
import { ZHIHU_SELECTORS } from './zhihu/publish'

const PLATFORM_SELECTORS = {
  baijiahao: BAIJIAHAO_SELECTORS,
  netease: NETEASE_SELECTORS,
  toutiao: TOUTIAO_SELECTORS,
  wechat: WECHAT_SELECTORS,
  weibo: WEIBO_SELECTORS,
  xiaohongshu: XIAOHONGSHU_SELECTORS,
  zhihu: ZHIHU_SELECTORS,
} as const

describe('platform publish selectors', () => {
  it.each(Object.entries(PLATFORM_SELECTORS))(
    '%s configures exactly one explicit selector per step',
    (_platform, selectors) => {
      for (const selector of Object.values(selectors)) {
        expect(typeof selector).toBe('string')
        expect(selector.trim()).not.toBe('')
        expect(selector).not.toContain(',')
        expect(selector).not.toContain('*=')
      }
    },
  )
})
