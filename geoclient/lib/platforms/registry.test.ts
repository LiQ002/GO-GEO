import { describe, expect, it } from 'vitest'
import { listPlatformPublishers } from './registry'

describe('media platform publishers', () => {
  it('provides an article simulation driver for every media platform', () => {
    const publishers = listPlatformPublishers()

    expect(publishers.map((publisher) => publisher.id)).toEqual([
      'wechat',
      'zhihu',
      'toutiao',
      'weibo',
      'baijiahao',
      'xiaohongshu',
      'netease',
      'sohu',
      'qqnews',
      'jianshu',
      'csdn',
    ])
    for (const publisher of publishers) {
      expect(publisher.publishArticle, publisher.label).toBeTypeOf('function')
    }
  })
})
