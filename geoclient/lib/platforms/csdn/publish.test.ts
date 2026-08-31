import { describe, expect, it } from 'vitest'
import { parseCsdnPublishSuccessUrl } from './publish'

describe('CSDN publish result URL', () => {
  it('extracts the article ID and returns the canonical success URL', () => {
    expect(
      parseCsdnPublishSuccessUrl(
        'https://mp.csdn.net/mp_blog/creation/success/123456789?from=publish',
      ),
    ).toEqual({
      platformArticleId: '123456789',
      publishedUrl: 'https://mp.csdn.net/mp_blog/creation/success/123456789',
    })
  })

  it('accepts a trailing slash on the success URL', () => {
    expect(
      parseCsdnPublishSuccessUrl(
        'https://mp.csdn.net/mp_blog/creation/success/987654321/',
      ),
    ).toEqual({
      platformArticleId: '987654321',
      publishedUrl: 'https://mp.csdn.net/mp_blog/creation/success/987654321',
    })
  })

  it.each([
    'https://mp.csdn.net/mp_blog/creation/editor/123456789',
    'https://mp.csdn.net/mp_blog/creation/success/not-an-id',
    'https://example.com/mp_blog/creation/success/123456789',
    'not-a-url',
  ])('rejects a non-success URL: %s', (url) => {
    expect(parseCsdnPublishSuccessUrl(url)).toBeNull()
  })
})
