# GeoClient 安全说明

## 已实施的边界

- Renderer 启用 Electron sandbox、context isolation，禁用 Node integration。
- preload 采用显式白名单，IPC 主进程再做运行时参数校验。
- 主窗口阻止非 `app://-` 的正式环境导航、拒绝权限申请并设置 CSP。
- Puppeteer 使用 Chromium 原生沙箱，不再传入 `--no-sandbox`。
- 正式后端强制 HTTPS；HTTP 只允许 localhost 开发地址。
- 登录访问令牌由 Electron `safeStorage` 加密后保存在 userData，Zustand 不持久化令牌。
- 新的平台授权信息在主进程中使用共享 AES-256-GCM 加密为 `aes:v2:`；Renderer 和日志不输出 Cookie 内容。
- 用户端与运营端使用同一个内置兼容密钥，也可通过相同的 `COOKIE_AES_KEY` 覆盖；每次加密使用随机 IV 和认证标签。
- 应用日志按 5 MiB 轮转，写入 Electron `app.getPath('logs')/main.log`。

## 当前跨客户端授权方案

当前版本需要由运营端集中执行发布，因此平台授权使用共享 AES 密钥。企业用户端完成授权并把 `aes:v2:` 密文保存到后端后，任意使用相同密钥的运营端都可以领取对应企业、文章、渠道和平台账号的任务并解密使用。

约束如下：

1. 用户端和运营端若设置 `COOKIE_AES_KEY`，值必须完全一致；未设置时两端使用同一个内置兼容密钥。
2. 后端只接受 `aes:v2:`，并把密文作为不透明载荷保存；不会保存明文 Cookie。
3. 明文只在 Electron 主进程授权采集和发布任务内存中短时存在。
4. `safe:v1:`、旧 `v1:` 和明文授权不再兼容，历史平台账号必须重新授权。

共享密钥可从安装包中被提取，不能提供 KMS 级别的密钥隔离。后续安全版本应改为服务端 KMS 或公钥信封加密，并增加密钥轮换、设备吊销、短期解封和访问审计。

## 旧数据迁移

若数据库仍存在 `safe:v1:`、旧 `v1:` 或明文授权：

1. 在用户端打开对应平台授权。
2. 重新登录并保存，生成新的 `aes:v2:` 密文。
3. 确认运营端可领取任务并打开登录后的发布页面。

## 发布前安全检查

- 确认安装包已签名并完成目标平台验证。
- 确认 API 地址为 HTTPS，证书链有效。
- 确认 client 产物中不存在 operator 页面和默认密码。
- 确认运营端只获得租约范围内的企业、文章和账号信息。
- 确认日志、崩溃上报和截图不会包含 Cookie、Authorization 或 localStorage 令牌。
- 确认用户端和运营端使用相同的 `COOKIE_AES_KEY`，或均使用内置兼容密钥。
