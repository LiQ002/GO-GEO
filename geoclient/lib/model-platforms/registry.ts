import { deepseekModel } from './deepseek'
import { qianwenModel } from './qianwen'
import { doubaoModel } from './doubao'
import { yuanbaoModel } from './yuanbao'
import { wenxinModel } from './wenxin'
import { namiModel } from './nami'
import { kimiModel } from './kimi'
import { zhipuModel } from './zhipu'
import type { ModelPlatformConfig } from './types'

const models: ModelPlatformConfig[] = [
  deepseekModel,
  qianwenModel,
  doubaoModel,
  yuanbaoModel,
  wenxinModel,
  namiModel,
  kimiModel,
  zhipuModel,
]

const modelMap = new Map(models.map((m) => [m.id, m]))

export function getModelPlatform(id: string): ModelPlatformConfig | undefined {
  return modelMap.get(id)
}

export function listModelPlatforms(): ModelPlatformConfig[] {
  return [...models]
}

export function requireModelPlatform(id: string): ModelPlatformConfig {
  const model = getModelPlatform(id)
  if (!model) {
    throw new Error(`Unsupported model platform: ${id}`)
  }
  return model
}
