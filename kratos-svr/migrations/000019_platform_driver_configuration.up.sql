ALTER TABLE cfg_publish_channels
  ADD COLUMN driver_type TINYINT UNSIGNED NULL AFTER code,
  ADD COLUMN login_url VARCHAR(1024) NULL AFTER driver_type;

UPDATE cfg_publish_channels
SET driver_type = CASE
  WHEN code = 'wechat' OR name IN ('微信公众号', '微信公众平台') THEN 1
  WHEN code IN ('zhihu', 'c01') OR name = '知乎' THEN 2
  WHEN code IN ('toutiao', 'c02') OR name IN ('头条', '头条号', '今日头条') THEN 3
  WHEN code = 'weibo' OR name = '微博' THEN 4
  WHEN code = 'baijiahao' OR name = '百家号' THEN 5
  WHEN code = 'xiaohongshu' OR name = '小红书' THEN 6
  ELSE driver_type
END
WHERE category = 1;

UPDATE cfg_publish_channels
SET login_url = CASE driver_type
  WHEN 1 THEN 'https://mp.weixin.qq.com'
  WHEN 2 THEN 'https://www.zhihu.com/signin'
  WHEN 3 THEN 'https://mp.toutiao.com'
  WHEN 4 THEN 'https://weibo.com'
  WHEN 5 THEN 'https://baijiahao.baidu.com'
  WHEN 6 THEN 'https://creator.xiaohongshu.com'
  ELSE login_url
END
WHERE category = 1 AND (login_url IS NULL OR login_url = '');

ALTER TABLE cfg_inclusion_sites
  ADD COLUMN driver_type TINYINT UNSIGNED NULL AFTER code;

UPDATE cfg_inclusion_sites
SET driver_type = CASE
  WHEN code IN ('deepseek', 'm01') OR LOWER(name) = 'deepseek' OR entry_url LIKE '%deepseek.com%' THEN 1
  WHEN code = 'qianwen' OR name IN ('千问', '通义千问') OR entry_url LIKE '%qianwen.com%' THEN 2
  WHEN code IN ('doubao', 'm02') OR name = '豆包' OR entry_url LIKE '%doubao.com%' THEN 3
  WHEN code = 'yuanbao' OR name = '腾讯元宝' OR entry_url LIKE '%yuanbao.tencent.com%' THEN 4
  WHEN code = 'wenxin' OR name IN ('文心一言', '文心') OR entry_url LIKE '%chat.baidu.com%' THEN 5
  WHEN code IN ('nami', 'm04') OR name IN ('纳米', '纳米 AI') OR entry_url LIKE '%n.cn%' THEN 6
  WHEN code IN ('kimi', 'm03') OR LOWER(name) = 'kimi' OR entry_url LIKE '%kimi.com%' THEN 7
  WHEN code = 'zhipu' OR name IN ('智谱清言', '智谱') OR entry_url LIKE '%chatglm.cn%' THEN 8
  ELSE driver_type
END;
