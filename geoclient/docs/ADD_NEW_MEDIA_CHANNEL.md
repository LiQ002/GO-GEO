# 新增自媒体渠道操作手册

> 以新增一个自媒体平台（例如搜狐号）为例，说明从后台配置到客户端驱动的完整流程。

## 0. 前置确认

- 确认该平台仍支持网页端发文，且有稳定的登录页/发文页。
- 确认 GEO 客户端尚未支持该平台（`geoclient/lib/platform-manifest/index.ts` 的 `driverIds.media` 里不存在对应编号）。

## 1. 后端：数据库配置

`cfg_publish_channels` 表的 `driver_type` 字段用于把后台渠道映射到客户端驱动。

### 1.1 选一个不冲突的 driver_type 编号

当前已占用编号见迁移文件：

```sql
-- kratos-svr/migrations/000019_platform_driver_configuration.up.sql
WHEN code = 'wechat' OR name IN ('微信公众号', '微信公众平台') THEN 1
WHEN code IN ('zhihu', 'c01') OR name = '知乎' THEN 2
WHEN code IN ('toutiao', 'c02') OR name IN ('头条', '头条号', '今日头条') THEN 3
WHEN code = 'weibo' OR name = '微博' THEN 4
WHEN code = 'baijiahao' OR name = '百家号' THEN 5
WHEN code = 'xiaohongshu' OR name = '小红书' THEN 6
```

新平台取下一个可用编号，例如 **7**。

### 1.2 新增/修改迁移脚本

如果是本地开发测试，可以直接在数据库里 INSERT 一条记录：

```sql
INSERT INTO cfg_publish_channels
  (code, name, category, driver_type, login_url, status, authorization_type, execution_mode, sort_order)
VALUES
  ('sohu', '搜狐号', 1, 7, 'https://mp.sohu.com', 1, 1, 1, 0);
```

如果是正式迭代，写一个迁移文件，例如：

```sql
-- kratos-svr/migrations/0000xx_add_sohu_channel.up.sql
INSERT INTO cfg_publish_channels
  (code, name, category, driver_type, login_url, status, authorization_type, execution_mode, sort_order)
VALUES
  ('sohu', '搜狐号', 1, 7, 'https://mp.sohu.com', 1, 1, 1, 0)
ON DUPLICATE KEY UPDATE
  driver_type = VALUES(driver_type),
  login_url = VALUES(login_url);
```

## 2. 运营管理后台：增加表单选项

文件：`admin/src/utils/platform-drivers.ts`

### 2.1 扩展枚举

```ts
export enum MediaDriverType {
  wechat = 1,
  zhihu = 2,
  toutiao = 3,
  weibo = 4,
  baijiahao = 5,
  xiaohongshu = 6,
  sohu = 7, // 新增
}
```

### 2.2 扩展下拉选项

```ts
export const mediaDriverOptions = [
  { label: '微信公众号', value: MediaDriverType.wechat },
  { label: '知乎', value: MediaDriverType.zhihu },
  { label: '头条号', value: MediaDriverType.toutiao },
  { label: '微博', value: MediaDriverType.weibo },
  { label: '百家号', value: MediaDriverType.baijiahao },
  { label: '小红书', value: MediaDriverType.xiaohongshu },
  { label: '搜狐号', value: MediaDriverType.sohu }, // 新增
];
```

保存后刷新 admin 页面，新建/编辑自媒体渠道时即可选择“搜狐号”。

## 3. 客户端：注册平台 manifest

文件：`geoclient/lib/platform-manifest/index.ts`

### 3.1 加 driver_type 映射

```ts
const driverIds: Record<PlatformKind, Record<number, string>> = {
  media: {
    1: 'wechat',
    2: 'zhihu',
    3: 'toutiao',
    4: 'weibo',
    5: 'baijiahao',
    6: 'xiaohongshu',
    7: 'sohu', // 新增
  },
  // ...
}
```

### 3.2 加平台 manifest

```ts
const manifests = [
  // ... 已有平台
  {
    id: 'sohu',
    kind: 'media',
    label: '搜狐号',
    icon: '搜',
    color: '#e60012',
    iconStyle: { bg: '#e6001215', text: '#e60012' },
    loginUrl: 'https://mp.sohu.com',
    targetUrl: 'https://mp.sohu.com/profile?xpt=...#/article/write',
  },
  // ...
]
```

`targetUrl` 写成该平台发文页的真实入口即可，客户端驱动里通常还会用 `publishUrl` 覆盖它。

## 4. 客户端：实现平台驱动

### 4.1 创建目录和文件

```
geoclient/lib/platforms/sohu/
  ├── index.ts      # 驱动注册
  └── publish.ts    # 发文逻辑
```

### 4.2 index.ts 示例

```ts
import type { PlatformPublisher } from '../types'
import { requirePlatformManifest } from '../../platform-manifest'
import { publishSohuArticle } from './publish'

const manifest = requirePlatformManifest('sohu', 'media')

export const sohuPublisher: PlatformPublisher = {
  ...manifest,
  publishUrl: 'https://mp.sohu.com/profile?xpt=...#/article/write',
  cookieSiteUrl: 'https://mp.sohu.com',
  cookieDomain: '.sohu.com',
  assertAuthenticated: assertSohuAuthenticated,
  publishArticle: publishSohuArticle,
}

async function assertSohuAuthenticated(page: Page): Promise<void> {
  const loggedIn = await page.evaluate(() => {
    // 根据搜狐号登录态标识调整
    return document.querySelector('.user-info') !== null
  })
  if (!loggedIn) throw new Error('未登录搜狐号')
}
```

### 4.3 publish.ts 核心逻辑

参考已有 `weibo/publish.ts` 或 `toutiao/publish.ts`，实现 `publishSohuArticle(page, article)`：

1. 等待页面稳定。
2. 找到标题输入框，填入 `article.title`。
3. 找到正文编辑器，填入正文纯文本/HTML。
4. 如果有封面/正文图片，下载后上传到平台。
5. 点击保存/发布按钮。
6. 等待成功提示或 URL 变化，返回结果 URL。

### 4.4 注册到平台注册表

如果项目使用自动扫描/统一注册，需要确认驱动是否被加载。检查 `geoclient/lib/platforms/registry.ts`：

```ts
import { sohuPublisher } from './sohu'

registerPlatformPublisher(sohuPublisher)
```

现有代码可能已经批量导入，按需添加即可。

## 5. 编译与验证

### 5.1 编译客户端

```bash
cd D:\geo\geoclient
pnpm run build:electron
```

### 5.2 启动服务

```bash
# 后端
cd D:\geo\kratos-svr\app\admin\cmd\admin && go run .
cd D:\geo\kratos-svr\app\user\cmd\user && go run .

# 前端
cd D:\geo\admin && pnpm run dev     # 运营管理平台
cd D:\geo\userconsole && pnpm run dev # 企业端
```

### 5.3 端到端验证

1. 运营管理平台 → 自媒体渠道 → 新建 → 选择“搜狐号” → 填写授权登录地址 → 启用。
2. 企业端 → 平台账号管理 → 找到搜狐号 → 授权登录。
3. 企业端 → 选择文章 → 创建搜狐号发布任务。
4. 运营端 → 发布管理 → 执行发布。
5. 观察 Puppeteer 窗口：
   - 是否正确打开发文页
   - 标题、正文、图片是否填入
   - 是否成功提交
   - 是否返回 publishedUrl

### 5.4 失败排查

- 若找不到编辑器/按钮：查看 `publish-evidence/publish-failed-sohu-*.png`。
- 若提示未登录：检查 `assertAuthenticated` 是否准确识别登录态。
- 若图片上传失败：检查图片 URL 是否可访问，或改用 `page.evaluate(fetch)` 下载。

## 6. 提交代码

修改至少涉及以下文件：

```
kratos-svr/migrations/0000xx_add_sohu_channel.up.sql
admin/src/utils/platform-drivers.ts
geoclient/lib/platform-manifest/index.ts
geoclient/lib/platforms/sohu/index.ts
geoclient/lib/platforms/sohu/publish.ts
geoclient/lib/platforms/registry.ts （如需要）
```

编译通过、端到端验证成功后提交。
