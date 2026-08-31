import { describe, expect, it } from 'vitest'
import { makeArticle, makePublishTask, mapArticleStatus, mapTaskStatus, stripHtml } from './mappers'

describe('API response mappers', () => {
  it('normalizes backend lifecycle states', () => {
    expect(mapArticleStatus('published')).toBe('published')
    expect(mapArticleStatus('rejected')).toBe('failed')
    expect(mapTaskStatus('leased')).toBe('publishing')
    expect(mapTaskStatus('cancelled')).toBe('failed')
  })

  it('maps article content to a plain summary', () => {
    expect(stripHtml('<p>Hello <strong>Geo</strong></p>')).toBe('Hello Geo')
    expect(
      makeArticle({ id: 1, enterpriseId: 2, title: 'Title', content: '<p>Summary</p>', status: 'draft' }),
    ).toMatchObject({ id: 1, userId: 2, summary: 'Summary', status: 'pending' })
  })

  it('maps publish targets and completion state', () => {
    expect(
      makePublishTask({
        id: 3,
        enterpriseId: 4,
        name: 'Batch',
        articleIds: [11, 12],
        platforms: ['wechat', 'zhihu'],
        status: 'completed',
        completedCount: 2,
      }),
    ).toMatchObject({
      articleId: 11,
      articleIds: [11, 12],
      platformLabel: 'wechat、zhihu',
      status: 'success',
      completedCount: 2,
    })
  })
})
