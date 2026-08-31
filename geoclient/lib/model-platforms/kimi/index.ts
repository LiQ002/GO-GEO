import type { ModelPlatformConfig } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'

const manifest = requirePlatformManifest('kimi', 'model')

export const kimiModel: ModelPlatformConfig = {
  ...manifest,
  chatUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://www.kimi.com',
  cookieDomain: '.kimi.com',
  cookiePersistFilter: {
    // Keep auth + anti-bot cookies; drop analytics noise when possible.
    names: ['kimi-auth', '__snaker__id', 'gdxidpyhxdE', 'theme', 'doodle_asset'],
    namePrefixes: ['Hm_', 'HMAC'],
  },
  // Kimi stores JWT auth in localStorage; cookie-only replay cannot restore login.
  localStoragePersistFilter: {
    keys: [
      'access_token',
      'refresh_token',
      'anonymous_access_token',
      'anonymous_refresh_token',
      'msh_user_id',
      'msh_user_subscription_data',
      'volcano-token-info',
    ],
  },
  useStealth: true,
}
