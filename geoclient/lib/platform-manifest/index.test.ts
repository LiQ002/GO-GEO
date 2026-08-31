import { describe, expect, it } from 'vitest'
import {
  getPlatformDriverId,
  getPlatformManifest,
  listPlatformManifests,
  requirePlatformManifest,
  resolvePlatformLoginConfiguration,
} from './index'

describe('platform manifests', () => {
  it('keeps platform identifiers unique within each kind', () => {
    const manifests = listPlatformManifests()
    const keys = manifests.map((manifest) => `${manifest.kind}:${manifest.id}`)

    expect(new Set(keys).size).toBe(keys.length)
    expect(listPlatformManifests('media')).toHaveLength(11)
    expect(listPlatformManifests('model')).toHaveLength(8)
  })

  it('does not expose mutable manifest state', () => {
    const manifest = requirePlatformManifest('wechat', 'media')
    manifest.label = 'changed'
    manifest.iconStyle.bg = 'changed'

    expect(getPlatformManifest('wechat', 'media')).toMatchObject({
      label: '微信公众号',
      iconStyle: { bg: '#07c16015' },
    })
  })

  it('opens the current WeChat article editor', () => {
    expect(getPlatformManifest('wechat', 'media')?.targetUrl).toContain(
      't=media/appmsg_edit_v2',
    )
    expect(getPlatformManifest('wechat', 'media')?.targetUrl).toContain('isNew=1')
  })

  it('rejects unsupported platform identifiers', () => {
    expect(() => requirePlatformManifest('missing', 'media')).toThrow(
      'Unsupported media platform: missing',
    )
  })

  it('maps numeric backend driver types independently for media and models', () => {
    expect(getPlatformDriverId(2, 'media')).toBe('zhihu')
    expect(getPlatformDriverId(2, 'model')).toBe('qianwen')
    expect(getPlatformDriverId(0, 'media')).toBeUndefined()
  })

  it('configures bundled model icons while keeping the text fallback', () => {
    expect(getPlatformManifest('qianwen', 'model')).toMatchObject({
      icon: '千',
      iconUrl: '/icons/qwen.png',
    })
    expect(getPlatformManifest('deepseek', 'model')).toMatchObject({ icon: 'D' })
    expect(getPlatformManifest('deepseek', 'model')?.iconUrl).toBeUndefined()
  })

  it('accepts a configured URL only on the built-in driver host', () => {
    expect(
      resolvePlatformLoginConfiguration(
        'zhihu',
        'media',
        'https://www.zhihu.com/signin?next=%2F',
      ),
    ).toMatchObject({ url: 'https://www.zhihu.com/signin?next=%2F' })
    expect(
      resolvePlatformLoginConfiguration('zhihu', 'media', 'https://example.com/signin'),
    ).toEqual({ error: '平台后台配置的登录地址与客户端驱动不匹配' })
  })
})
