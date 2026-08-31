export enum MediaDriverType {
  wechat = 1,
  zhihu = 2,
  toutiao = 3,
  weibo = 4,
  baijiahao = 5,
  xiaohongshu = 6,
  netease = 7,
  sohu = 8,
  qqnews = 9,
  jianshu = 10,
  csdn = 11,
}

export enum ModelDriverType {
  deepseek = 1,
  qianwen = 2,
  doubao = 3,
  yuanbao = 4,
  wenxin = 5,
  nami = 6,
  kimi = 7,
  zhipu = 8,
}

export const mediaDriverOptions = [
  { label: '微信公众号', value: MediaDriverType.wechat },
  { label: '知乎', value: MediaDriverType.zhihu },
  { label: '头条号', value: MediaDriverType.toutiao },
  { label: '微博', value: MediaDriverType.weibo },
  { label: '百家号', value: MediaDriverType.baijiahao },
  { label: '小红书', value: MediaDriverType.xiaohongshu },
  { label: '网易号', value: MediaDriverType.netease },
  { label: '搜狐号', value: MediaDriverType.sohu },
  { label: '企鹅号', value: MediaDriverType.qqnews },
  { label: '简书', value: MediaDriverType.jianshu },
  { label: 'CSDN', value: MediaDriverType.csdn },
];

export const modelDriverOptions = [
  { label: 'DeepSeek', value: ModelDriverType.deepseek },
  { label: '千问', value: ModelDriverType.qianwen },
  { label: '豆包', value: ModelDriverType.doubao },
  { label: '腾讯元宝', value: ModelDriverType.yuanbao },
  { label: '文心一言', value: ModelDriverType.wenxin },
  { label: '纳米 AI', value: ModelDriverType.nami },
  { label: 'Kimi', value: ModelDriverType.kimi },
  { label: '智谱清言', value: ModelDriverType.zhipu },
];
