# GeoClient 发布说明

## 发布前检查

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build:renderer:client
pnpm build:renderer:operator
```

确认 `package.json` 版本号、默认服务地址和 `openapi.json` 都属于本次发布基线。

## 生成安装包

在目标操作系统和目标 CPU 架构上执行：

```bash
pnpm build:client:mac
pnpm build:operator:mac
```

或：

```bash
pnpm build:client:win
pnpm build:operator:win
```

构建脚本会把 Puppeteer 当前架构的 Chromium 放进安装包。跨架构构建必须在对应架构的构建机执行，或者先建立能下载并校验对应 Chromium 的专用发布流水线。

## 签名与公证

electron-builder 配置已启用 macOS hardened runtime，并会使用构建环境中可用的签名身份。证书、Apple 公证凭据和 Windows 代码签名凭据必须由发布环境注入，不能提交到仓库。

没有签名身份时可以生成本地验证目录包，但不能作为正式用户安装包发布。

## 验收

每种产物至少验证：

1. 安装、首次启动、退出和二次启动。
2. client/operator 登录及路由隔离。
3. 服务地址校验与 `/health` 连接测试。
4. 平台登录、授权保存、本机回放。
5. 运营端租约领取、心跳、结果上报和异常释放。
6. 安装包内浏览器启动，用户机器无需预装 Chrome。
7. `main.log` 创建、错误记录和轮转。
8. macOS Gatekeeper 或 Windows 签名验证。

## 更新发布

仓库尚未配置 auto-update provider，因为当前没有确定的制品托管 URL、发布通道和签名策略。选择发布基础设施后再接入更新模块，并保证：

- 更新元数据和安装包均通过 HTTPS。
- 更新包必须验证签名。
- client/operator 使用独立通道。
- 支持灰度、回滚和最低强制版本。
