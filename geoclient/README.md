# GeoClient

GeoClient 是 GEO 系统的 Electron 桌面客户端。一套代码通过构建模式生成两个相互隔离的产物：

- `client`：企业用户端，负责登录、媒体平台授权、模型平台授权和任务查看。
- `operator`：运营执行端，负责领取发布租约、执行桌面自动化并上报结果。

渲染层使用 Next.js 静态导出，Electron 主进程负责凭据、浏览器、发布任务和操作系统能力。企业用户接口以 `../kratos-svr/openapi.yaml` 为契约；尚未迁移的运营端接口继续使用仓库内的 `openapi.json`。

## 环境要求

- Node.js 20 或更高版本
- pnpm 11.9.0
- macOS 或 Windows；安装包必须在目标系统和目标 CPU 架构上构建

安装依赖：

```bash
pnpm install
```

Puppeteer 会安装与当前系统匹配的 Chromium。正式打包时该浏览器会被复制到安装包，不依赖用户机器上的 Chrome。

## 本地开发

```bash
pnpm dev:client
pnpm dev:operator
```

client 固定使用 `http://localhost:3000`，operator 固定使用
`http://localhost:3001`；两种模式使用独立的 Next 开发缓存，可以同时运行。

调试主进程和浏览器：

```bash
pnpm dev:client:debug
pnpm dev:operator:debug
```

开发模式默认后端为 `http://geo-enterprise.d.gbicom.com`，允许配置 HTTP 或
HTTPS 接口，便于无证书测试环境联调。生产构建默认使用
`https://geo-enterprise.d.gbicom.com`，并拒绝所有 HTTP API 地址。可通过
`NEXT_PUBLIC_API_BASE_URL` 覆盖对应环境的默认地址。

开发模式的渲染器从 `http://localhost:3000` 请求用户 API；正式 Electron
客户端使用 `app://-` 来源。用户服务必须在 `server.http.cors_allowed_origins`
中显式配置这些来源。客户端不会给所有请求强制添加 `Content-Type`，避免 GET
请求产生无意义的 CORS 预检；JSON 请求仍由 Axios 自动设置正确的内容类型。

## 质量检查

```bash
pnpm check
```

该命令依次检查：

1. OpenAPI 生成文件是否与 `openapi.json` 一致。
2. Renderer 和 Electron 两套 TypeScript 配置。
3. ESLint。
4. Vitest 单元测试。

CI 还会分别构建 client/operator 渲染产物，防止两端代码串包。

Kratos 用户接口契约变更后执行：

```bash
pnpm api:generate
```

如果维护尚未迁移的运营端接口，可单独执行 `pnpm api:generate:legacy` 更新旧契约类型。

新增 API 路径必须通过 `lib/api/path.ts` 的 `apiPath()` 使用，路径模板会在编译期受 OpenAPI 约束。

## 构建安装包

```bash
pnpm build:client:mac
pnpm build:operator:mac
pnpm build:client:win
pnpm build:operator:win
```

构建流程会：

1. 编译 Electron 主进程与 preload。
2. 以明确的 client/operator 模式静态导出 Renderer。
3. 暂存当前平台、当前架构的 Chromium。
4. 由 electron-builder 生成安装包。

产物位于 `dist/client` 或 `dist/operator`。浏览器只为当前 CPU 架构暂存，因此不要在 arm64 机器上直接生成 x64 包，反之亦然。

代码签名、macOS 公证和更新发布源属于部署配置，详见 [发布说明](docs/RELEASE.md)。

## 目录结构

```text
app/                         Next.js 路由壳
components/pages/client/     企业用户端页面
components/pages/operator/   运营执行端页面
lib/api/                     OpenAPI 类型、路径和领域 API
lib/platform-manifest/       Renderer 可安全使用的平台展示元数据
lib/platforms/               主进程媒体平台驱动
lib/model-platforms/         主进程模型平台驱动
electron/main/ipc/           IPC 参数校验与路由
electron/main/services/      授权、会话、发布任务和凭据服务
electron/preload/            最小化 contextBridge 白名单
scripts/                     构建模式、浏览器暂存和诊断脚本
```

详细设计和扩展方式见 [架构文档](docs/ARCHITECTURE.md)，安全边界与已知部署约束见 [安全说明](docs/SECURITY.md)。

## 当前能力边界

- 微信公众号、知乎、头条号、微博、百家号和小红书均已接入文章模拟填充驱动。
- 运营端“发布管理”提供一篇本地模拟文章，可切换平台演示登录、Puppeteer
  键盘填充和安全草稿处理；实现说明见
  [多平台发布模拟](docs/MEDIA_PUBLISH_EXAMPLE.md)。微信公众号另有可独立运行的
  [草稿验证脚本](docs/WECHAT_PUBLISH_EXAMPLE.md)。
- 运营端发布日志页不再调用不存在的旧接口；需要后端补充全局日志 OpenAPI 后才能恢复该视图。
