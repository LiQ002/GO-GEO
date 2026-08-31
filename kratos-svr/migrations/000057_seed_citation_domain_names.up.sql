-- 信源域名→中文名称映射（管理员可在后台系统设置页面维护，无需改代码）
-- namespace=citation, key_name=domain_names
-- value_json 为 {"domain": "中文名"} 格式
INSERT INTO cfg_system_settings (namespace, key_name, value_json, description, is_sensitive, version, created_at, updated_at)
VALUES (
  'citation',
  'domain_names',
  JSON_OBJECT(
    -- 百度系
    'baike.baidu.com', '百度百科',
    'baijiahao.baidu.com', '百家号',
    'wenku.baidu.com', '百度文库',
    'zhidao.baidu.com', '百度知道',
    'tieba.baidu.com', '百度贴吧',
    'www.baidu.com', '百度',
    'baidu.com', '百度',
    -- 知乎
    'zhihu.com', '知乎',
    'www.zhihu.com', '知乎',
    -- 微信
    'mp.weixin.qq.com', '微信公众号',
    'weixin.qq.com', '微信',
    -- 搜狐
    'sohu.com', '搜狐',
    'www.sohu.com', '搜狐',
    -- 新浪
    'sina.com.cn', '新浪',
    'sina.cn', '新浪',
    'weibo.com', '微博',
    'www.weibo.com', '微博',
    -- 网易
    '163.com', '网易',
    'www.163.com', '网易',
    -- 今日头条/抖音
    'toutiao.com', '今日头条',
    'douyin.com', '抖音',
    -- 自媒体平台
    'csdn.net', 'CSDN',
    'jianshu.com', '简书',
    '36kr.com', '36氪',
    'douban.com', '豆瓣',
    'bilibili.com', '哔哩哔哩',
    'xiaohongshu.com', '小红书',
    -- AI 平台
    'www.doubao.com', '豆包',
    'doubao.com', '豆包',
    'www.n.cn', '纳米AI',
    'n.cn', '纳米AI',
    -- 品牌网
    'www.chinapp.com', '中国品牌网',
    'chinapp.com', '中国品牌网',
    'jm.chinapp.com', '品牌加盟网',
    -- 维基
    'wikipedia.org', '维基百科',
    -- 站长之家
    'chinaz.com', '站长之家',
    -- 苹果
    'maps.apple.com', '苹果地图',
    'apple.com', '苹果'
  ),
  '信源域名→中文名称映射，用于品牌看板信源分析图表显示。管理员可在系统设置页面维护。',
  FALSE,
  1,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = NOW();
