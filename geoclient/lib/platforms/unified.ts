import { getModelPlatform } from '../model-platforms/registry'
import { listModelPlatforms } from '../model-platforms/registry'
import type { ModelPlatformConfig } from '../model-platforms/types'
import { getPlatformPublisher, listPlatformPublishers } from './registry'
import type { PlatformPublisher } from './types'

export type PlatformKind = 'media' | 'model'

export type MediaPlatform = PlatformPublisher & { kind: 'media' }
export type ModelPlatform = ModelPlatformConfig & { kind: 'model' }
export type Platform = MediaPlatform | ModelPlatform

export function resolvePlatformKind(platformId: string, kind?: PlatformKind): PlatformKind {
  if (kind === 'media' || kind === 'model') return kind
  if (getPlatformPublisher(platformId)) return 'media'
  if (getModelPlatform(platformId)) return 'model'
  throw new Error(`Unsupported platform: ${platformId}`)
}

export function getPlatform(platformId: string, kind?: PlatformKind): Platform | undefined {
  const resolved = kind ?? resolvePlatformKind(platformId)
  if (resolved === 'media') {
    const publisher = getPlatformPublisher(platformId)
    return publisher ? { ...publisher, kind: 'media' } : undefined
  }
  const model = getModelPlatform(platformId)
  return model ? { ...model, kind: 'model' } : undefined
}

export function requirePlatform(platformId: string, kind?: PlatformKind): Platform {
  const platform = getPlatform(platformId, kind)
  if (!platform) {
    throw new Error(`Unsupported platform: ${platformId}`)
  }
  return platform
}

export function listPlatforms(): Platform[] {
  const media = listPlatformPublishers().map((p) => ({ ...p, kind: 'media' as const }))
  const models = listModelPlatforms().map((m) => ({ ...m, kind: 'model' as const }))
  return [...media, ...models]
}

export function getCookieSiteUrl(platform: Platform): string {
  if (platform.cookieSiteUrl) return platform.cookieSiteUrl
  return platform.kind === 'media' ? platform.publishUrl : platform.chatUrl
}

export function getTargetUrl(platform: Platform, authUrl?: string): string {
  if (platform.kind === 'media' && platform.buildPublishUrl && authUrl) {
    return platform.buildPublishUrl(authUrl)
  }
  return platform.kind === 'media' ? platform.publishUrl : platform.chatUrl
}

export function isMediaPlatform(platform: Platform): platform is MediaPlatform {
  return platform.kind === 'media'
}
