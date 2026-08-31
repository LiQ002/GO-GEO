import { wechatPublisher } from './wechat'
import { zhihuPublisher } from './zhihu'
import { toutiaoPublisher } from './toutiao'
import { weiboPublisher } from './weibo'
import { baijiahaoPublisher } from './baijiahao'
import { xiaohongshuPublisher } from './xiaohongshu'
import { neteasePublisher } from './netease'
import { sohuPublisher } from './sohu'
import { qqnewsPublisher } from './qqnews'
import { jianshuPublisher } from './jianshu'
import { csdnPublisher } from './csdn'
import type { PlatformPublisher } from './types'

const publishers: PlatformPublisher[] = [
  wechatPublisher,
  zhihuPublisher,
  toutiaoPublisher,
  weiboPublisher,
  baijiahaoPublisher,
  xiaohongshuPublisher,
  neteasePublisher,
  sohuPublisher,
  qqnewsPublisher,
  jianshuPublisher,
  csdnPublisher,
]

const publisherMap = new Map(publishers.map((p) => [p.id, p]))

export function getPlatformPublisher(platformId: string): PlatformPublisher | undefined {
  return publisherMap.get(platformId)
}

export function listPlatformPublishers(): PlatformPublisher[] {
  return [...publishers]
}

export function requirePlatformPublisher(platformId: string): PlatformPublisher {
  const publisher = getPlatformPublisher(platformId)
  if (!publisher) {
    throw new Error(`Unsupported platform: ${platformId}`)
  }
  return publisher
}
