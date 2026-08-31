/**
 * GEO 驱动汇总入口。
 *
 * 每个平台有独立的配置文件（如 zhipu.ts），包含选择器、完成策略、输入步骤、
 * 以及平台特化钩子（如 shouldSkipShareLink 用于桌面端/移动端区分）。
 *
 * 新增平台步骤：
 * 1. 在本目录创建 {platform}.ts，导出 ModelPlatformGeoDriver 配置
 * 2. 在下方 drivers 数组中添加
 */

export type { SelectorChain, CompletionStrategy, GeoQuerySelectors, InputStep, ModelPlatformGeoDriver } from './types'
export { CHAIN } from './shared'

import { deepseek } from './deepseek'
import { kimi } from './kimi'
import { doubao } from './doubao'
import { yuanbao } from './yuanbao'
import { wenxin } from './wenxin'
import { qianwen } from './qianwen'
import { nami } from './nami'
import { zhipu } from './zhipu'

import type { ModelPlatformGeoDriver } from './types'

const drivers: ModelPlatformGeoDriver[] = [
  deepseek,
  kimi,
  doubao,
  yuanbao,
  wenxin,
  qianwen,
  nami,
  zhipu,
]

const driverMap = new Map(drivers.map((d) => [d.id, d]))

export function listGeoDrivers(): ModelPlatformGeoDriver[] {
  return [...drivers]
}

export function getGeoDriver(id: string): ModelPlatformGeoDriver | undefined {
  return driverMap.get(id)
}

export function requireGeoDriver(id: string): ModelPlatformGeoDriver {
  const driver = getGeoDriver(id)
  if (!driver) throw new Error(`Unsupported GEO model platform: ${id}`)
  return driver
}
