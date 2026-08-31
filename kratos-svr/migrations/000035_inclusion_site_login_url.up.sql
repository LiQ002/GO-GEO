-- Add login_url to cfg_inclusion_sites so the geoclient authorization flow
-- can validate the configured login host against the built-in driver manifest.
-- Mirrors the login_url column already present on cfg_publish_channels.
ALTER TABLE cfg_inclusion_sites
  ADD COLUMN login_url VARCHAR(1024) NULL AFTER entry_url;

-- Populate login_url from driver_type using the canonical login hosts expected
-- by the geoclient platform manifest (see geoclient/lib/platform-manifest/index.ts).
UPDATE cfg_inclusion_sites
SET login_url = CASE driver_type
  WHEN 1 THEN 'https://chat.deepseek.com/'
  WHEN 2 THEN 'https://www.qianwen.com/'
  WHEN 3 THEN 'https://www.doubao.com/'
  WHEN 4 THEN 'https://yuanbao.tencent.com/'
  WHEN 5 THEN 'https://chat.baidu.com/'
  WHEN 6 THEN 'https://www.n.cn/'
  WHEN 7 THEN 'https://www.kimi.com/'
  WHEN 8 THEN 'https://chatglm.cn/'
  ELSE login_url
END
WHERE login_url IS NULL OR login_url = '';
