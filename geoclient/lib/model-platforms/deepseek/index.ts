import type { ModelPlatformConfig } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'

const manifest = requirePlatformManifest('deepseek', 'model')

export const deepseekModel: ModelPlatformConfig = {
  ...manifest,
  chatUrl: manifest.targetUrl,
  cookieSiteUrl: 'https://chat.deepseek.com',
  cookieDomain: 'chat.deepseek.com',
  cookiePersistFilter: {
    // Auth + WAF/session cookies. Previous allowlist only kept smidV2/thumbcache
    // and dropped ds_session_id, which broke reopen-after-auth.
    names: ['ds_session_id', 'HWWAFSESID', 'HWWAFSESTIME', 'smidV2'],
    namePrefixes: ['.thumbcache_'],
  },
  // DeepSeek stores the real login JWT in localStorage; cookie-only replay
  // always redirects to /sign_in. Verified by diagnose-deepseek-auth.mjs.
  localStoragePersistFilter: {
    keys: [
      'userToken',
      'settingsJwt',
      '__appKit_@deepseek/chat_lastSessionValue',
      'smidV2',
    ],
    keyPrefixes: ['.thumbcache_'],
  },
  useStealth: true,
}
