import {
  getMediaDemoPlatform,
  MEDIA_DEMO_ARTICLE,
  type MediaDemoPlatformId,
} from '@/lib/publish-demos/media'

function requirePlatformAuthApi() {
  const api = window.electronAPI?.platformAuth
  if (!api) throw new Error('多平台发布示例只能在 Electron 运营端中运行')
  return api
}

export async function openMediaDemoLogin(platformId: MediaDemoPlatformId, sessionId?: string) {
  const api = requirePlatformAuthApi()
  if (sessionId) await api.close(sessionId)
  return api.openLogin(platformId, 'media')
}

export async function publishMediaDemo(platformId: MediaDemoPlatformId, sessionId: string) {
  const api = requirePlatformAuthApi()
  const platform = getMediaDemoPlatform(platformId)
  const credentials = await api.getCookie(sessionId)
  if (!credentials.ok) {
    throw new Error(credentials.message || `尚未获取到${platform.label}登录信息`)
  }

  const result = await api.publishArticle(
    platformId,
    credentials.encryptedSecret,
    MEDIA_DEMO_ARTICLE,
    'media',
    sessionId,
  )
  if (!result.ok) throw new Error(result.message)
  return result
}

export async function closeMediaDemoSession(sessionId?: string) {
  if (!sessionId) return
  await requirePlatformAuthApi().close(sessionId)
}
