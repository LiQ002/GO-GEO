export type PlatformKind = 'media' | 'model'

export type PlatformManifest = {
  id: string
  kind: PlatformKind
  label: string
  icon: string
  iconUrl?: string
  color: string
  iconStyle: { bg: string; text: string }
  loginUrl: string
  targetUrl: string
}

const driverIds: Record<PlatformKind, Record<number, string>> = {
  media: {
    1: 'wechat',
    2: 'zhihu',
    3: 'toutiao',
    4: 'weibo',
    5: 'baijiahao',
    6: 'xiaohongshu',
    7: 'netease',
    8: 'sohu',
    9: 'qqnews',
    10: 'jianshu',
    11: 'csdn',
  },
  model: {
    1: 'deepseek',
    2: 'qianwen',
    3: 'doubao',
    4: 'yuanbao',
    5: 'wenxin',
    6: 'nami',
    7: 'kimi',
    8: 'zhipu',
  },
}

const manifests = [
  { id: 'wechat', kind: 'media', label: '微信公众号', icon: '微', color: '#07c160', iconStyle: { bg: '#07c16015', text: '#07c160' }, loginUrl: 'https://mp.weixin.qq.com', targetUrl: 'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=10' },
  { id: 'zhihu', kind: 'media', label: '知乎', icon: '知', color: '#0084ff', iconStyle: { bg: '#0084ff15', text: '#0084ff' }, loginUrl: 'https://www.zhihu.com/signin', targetUrl: 'https://zhuanlan.zhihu.com/write' },
  { id: 'toutiao', kind: 'media', label: '头条号', icon: '条', color: '#fe2c55', iconStyle: { bg: '#fe2c5515', text: '#fe2c55' }, loginUrl: 'https://mp.toutiao.com', targetUrl: 'https://mp.toutiao.com/profile_v4/graphic/publish' },
  { id: 'weibo', kind: 'media', label: '微博', icon: '博', color: '#e6162d', iconStyle: { bg: '#e6162d15', text: '#e6162d' }, loginUrl: 'https://weibo.com', targetUrl: 'https://weibo.com/home' },
  { id: 'baijiahao', kind: 'media', label: '百家号', icon: '百', color: '#3b6af7', iconStyle: { bg: '#3b6af715', text: '#3b6af7' }, loginUrl: 'https://baijiahao.baidu.com', targetUrl: 'https://baijiahao.baidu.com/builder/rc/edit' },
  { id: 'xiaohongshu', kind: 'media', label: '小红书', icon: '红', color: '#ff2442', iconStyle: { bg: '#ff244215', text: '#ff2442' }, loginUrl: 'https://creator.xiaohongshu.com', targetUrl: 'https://creator.xiaohongshu.com/publish/publish' },
  { id: 'netease', kind: 'media', label: '网易号', icon: '网', color: '#d33a31', iconStyle: { bg: '#d33a3115', text: '#d33a31' }, loginUrl: 'https://mp.163.com/login.html', targetUrl: 'https://mp.163.com/subscribe_v4/index.html#/article-publish' },
  { id: 'sohu', kind: 'media', label: '搜狐号', icon: '搜', color: '#ff6a00', iconStyle: { bg: '#ff6a0015', text: '#ff6a00' }, loginUrl: 'https://mp.sohu.com/mpfe/v4/login', targetUrl: 'https://mp.sohu.com/mpfe/v4/entry/create' },
  { id: 'qqnews', kind: 'media', label: '企鹅号', icon: '鹅', color: '#0052d9', iconStyle: { bg: '#0052d915', text: '#0052d9' }, loginUrl: 'https://om.qq.com/main', targetUrl: 'https://om.qq.com/main/creation/article' },
  { id: 'jianshu', kind: 'media', label: '简书', icon: '简', color: '#ea6f5a', iconStyle: { bg: '#ea6f5a15', text: '#ea6f5a' }, loginUrl: 'https://www.jianshu.com/sign_in', targetUrl: 'https://www.jianshu.com/writer' },
  { id: 'csdn', kind: 'media', label: 'CSDN', icon: 'C', color: '#fc5531', iconStyle: { bg: '#fc553115', text: '#fc5531' }, loginUrl: 'https://passport.csdn.net/login', targetUrl: 'https://mp.csdn.net/mp_blog/creation/editor' },
  { id: 'deepseek', kind: 'model', label: 'DeepSeek', icon: 'D', iconUrl:'/icons/deepseek.ico', color: '#4d6bfe', iconStyle: { bg: '#4d6bfe15', text: '#4d6bfe' }, loginUrl: 'https://chat.deepseek.com/', targetUrl: 'https://chat.deepseek.com/' },
  { id: 'qianwen', kind: 'model', label: '千问', icon: '千', iconUrl: '/icons/qwen.png', color: '#0011ff', iconStyle: { bg: '#0011ff15', text: '#0011ff' }, loginUrl: 'https://www.qianwen.com/', targetUrl: 'https://www.qianwen.com/' },
  { id: 'doubao', kind: 'model', label: '豆包', icon: '豆', iconUrl: '/icons/doubao.png', color: '#00c4b8', iconStyle: { bg: '#00c4b815', text: '#00c4b8' }, loginUrl: 'https://www.doubao.com/', targetUrl: 'https://www.doubao.com/chat/' },
  { id: 'yuanbao', kind: 'model', label: '腾讯元宝', icon: '元', iconUrl: '/icons/yuanbao.png', color: '#07c160', iconStyle: { bg: '#07c16015', text: '#07c160' }, loginUrl: 'https://yuanbao.tencent.com/', targetUrl: 'https://yuanbao.tencent.com/chat' },
  { id: 'wenxin', kind: 'model', label: '文心一言', icon: '文', iconUrl: '/icons/wenxin.png', color: '#2932e1', iconStyle: { bg: '#2932e115', text: '#2932e1' }, loginUrl: 'https://chat.baidu.com/', targetUrl: 'https://chat.baidu.com/' },
  { id: 'nami', kind: 'model', label: '纳米 AI', icon: '纳', iconUrl: '/icons/nami.png', color: '#ff6a00', iconStyle: { bg: '#ff6a0015', text: '#ff6a00' }, loginUrl: 'https://www.n.cn/', targetUrl: 'https://www.n.cn/' },
  { id: 'kimi', kind: 'model', label: 'Kimi', icon: 'K', iconUrl: '/icons/kimi.png', color: '#000000', iconStyle: { bg: '#00000015', text: '#000000' }, loginUrl: 'https://www.kimi.com/', targetUrl: 'https://www.kimi.com/' },
  { id: 'zhipu', kind: 'model', label: '智谱清言', icon: '智', iconUrl: '/icons/zhipu.png', color: '#3859ff', iconStyle: { bg: '#3859ff15', text: '#3859ff' }, loginUrl: 'https://chatglm.cn/', targetUrl: 'https://chatglm.cn/' },
] as const satisfies readonly PlatformManifest[]

const manifestMap = new Map(manifests.map((manifest) => [`${manifest.kind}:${manifest.id}`, manifest]))

function cloneManifest(manifest: PlatformManifest): PlatformManifest {
  return { ...manifest, iconStyle: { ...manifest.iconStyle } }
}

export function listPlatformManifests(kind?: PlatformKind): PlatformManifest[] {
  return manifests.filter((manifest) => !kind || manifest.kind === kind).map(cloneManifest)
}

export function getPlatformManifest(id: string, kind: PlatformKind): PlatformManifest | undefined {
  const manifest = manifestMap.get(`${kind}:${id}`)
  return manifest ? cloneManifest(manifest) : undefined
}

export function getPlatformDriverId(driverType: number, kind: PlatformKind): string | undefined {
  return driverIds[kind][driverType]
}

export type PlatformLoginConfiguration = {
  url?: string
  error?: string
}

/**
 * Accept only the configured URL for the selected built-in driver and only on
 * the driver's trusted login host. The same check runs in the Electron main
 * process, so renderer data cannot turn this into an arbitrary URL opener.
 */
export function resolvePlatformLoginConfiguration(
  id: string,
  kind: PlatformKind,
  configuredUrl?: string,
): PlatformLoginConfiguration {
  const manifest = getPlatformManifest(id, kind)
  if (!manifest) {
    return { error: `当前客户端不支持该${kind === 'media' ? '媒体' : '模型'}驱动` }
  }
  if (!configuredUrl?.trim()) {
    return { error: '平台后台未配置登录地址' }
  }
  try {
    const configured = new URL(configuredUrl.trim())
    const trusted = new URL(manifest.loginUrl)
    if (configured.protocol !== 'https:' && configured.protocol !== 'http:') {
      return { error: '平台后台配置的登录地址协议无效' }
    }
    if (configured.hostname !== trusted.hostname) {
      return { error: '平台后台配置的登录地址与客户端驱动不匹配' }
    }
    if (configured.protocol !== 'https:' && configured.hostname !== 'localhost') {
      return { error: '平台后台配置的登录地址必须使用 HTTPS' }
    }
    return { url: configured.toString() }
  } catch {
    return { error: '平台后台配置的登录地址无效' }
  }
}

export function requirePlatformLoginUrl(
  id: string,
  kind: PlatformKind,
  configuredUrl?: string,
): string {
  const result = resolvePlatformLoginConfiguration(id, kind, configuredUrl)
  if (!result.url) throw new Error(result.error || '平台登录地址不可用')
  return result.url
}

export function requirePlatformManifest(id: string, kind: PlatformKind): PlatformManifest {
  const manifest = getPlatformManifest(id, kind)
  if (!manifest) throw new Error(`Unsupported ${kind} platform: ${id}`)
  return manifest
}

export function getPlatformColor(id: string): string {
  return manifests.find((manifest) => manifest.id === id)?.color ?? '#6366f1'
}

export function getPlatformIconStyle(id: string, kind: PlatformKind = 'media') {
  return getPlatformManifest(id, kind)?.iconStyle ?? { bg: '#6366f115', text: '#6366f1' }
}

export function getPlatformLoginUrl(id: string, kind: PlatformKind = 'media') {
  return getPlatformManifest(id, kind)?.loginUrl
}

export const getModelPlatformIconStyle = (id: string) => getPlatformIconStyle(id, 'model')
export const getModelPlatformLoginUrl = (id: string) => getPlatformLoginUrl(id, 'model')
