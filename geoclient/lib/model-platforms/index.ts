export type { ModelPlatformConfig } from './types'
export { getModelPlatform, listModelPlatforms, requireModelPlatform } from './registry'

export { deepseekModel } from './deepseek'
export { qianwenModel } from './qianwen'
export { doubaoModel } from './doubao'
export { yuanbaoModel } from './yuanbao'
export { wenxinModel } from './wenxin'
export { namiModel } from './nami'
export { kimiModel } from './kimi'
export { zhipuModel } from './zhipu'

export { getGeoDriver, listGeoDrivers, requireGeoDriver } from './geo-drivers/index'
export type { ModelPlatformGeoDriver, SelectorChain, GeoQuerySelectors, InputStep } from './geo-drivers/index'

import { listModelPlatforms } from './registry'

export function getModelPlatformColor(name: string) {
  return listModelPlatforms().find((p) => p.id === name)?.color ?? '#6366f1'
}

export function getModelPlatformIconStyle(name: string) {
  return (
    listModelPlatforms().find((p) => p.id === name)?.iconStyle ?? {
      bg: '#6366f115',
      text: '#6366f1',
    }
  )
}

export function getModelPlatformLoginUrl(name: string) {
  return listModelPlatforms().find((p) => p.id === name)?.loginUrl
}

export function getModelPlatformChatUrl(name: string) {
  return listModelPlatforms().find((p) => p.id === name)?.chatUrl
}
