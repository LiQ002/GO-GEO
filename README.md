# GO-GEO 🌐

**细软 GEO 智能监测与品牌优化平台** —— 面向企业的生成式搜索引擎优化（GEO）全链路解决方案，覆盖 AI 模型监测、内容发布、品牌看板、舆情分析、套餐计费等核心能力。

---

## 📋 项目概览

本平台帮助企业洞察品牌在主流 AI 大模型（DeepSeek、文心一言、通义千问、Kimi、豆包、智谱、元宝等）中的曝光表现，并通过自动化内容生产与多渠道发布提升品牌在 AI 生成内容中的收录率。

### 核心能力

| 模块 | 能力说明 |
|------|---------|
| 🔍 **GEO 监测** | 定时向 10+ AI 模型提问，采集品牌/关键词的提及与引用情况 |
| 📊 **品牌看板** | 词条量、收录趋势、情感倾向、联系方式曝光、累计达标明细 |
| 📰 **舆情分析** | 周报/月报自动生成，负面事件实时预警，LLM 智能提炼总结 |
| ✍️ **内容生产** | AI 辅助文章生成，多写作模型支持，知识库素材管理 |
| 📤 **多渠道发布** | 微信公众号、知乎、微博、头条、百家号、CSDN、网易、搜狐等 |
| 💳 **套餐计费** | 半年/年订阅制，配额管理，点数抵扣，订阅到期自动重置 |
| 👥 **权限管理** | 管理端 / 用户端双应用分离，RBAC 角色权限体系 |

---

## 🏗️ 技术架构

```
GO-GEO/
├── kratos-svr/          # 后端服务（Go + Kratos 微服务框架）
│   ├── app/user/        #   用户端服务（BFF + 业务逻辑）
│   ├── app/admin/       #   管理端服务
│   ├── cmd/migrate/     #   数据库迁移工具
│   ├── api/             #   Protobuf 接口定义
│   ├── internal/        #   共享模块（认证/加密/事件/CORS）
│   └── migrations/      #   SQL 迁移脚本
├── userconsole/         # 用户端前端（Next.js 16 + React 19）
├── admin/               # 管理端前端（Ant Design Pro + UmiJS）
└── geoclient/           # 桌面客户端（Electron + Next.js）
    ├── lib/platforms/   #   各内容平台发布适配器
    └── lib/model-platforms/ # 各 AI 模型监测驱动
```

### 技术栈

| 层级 | 技术选型 |
|------|---------|
| **后端框架** | Go 1.23 + [Kratos v3](https://github.com/go-kratos/kratos) |
| **数据库** | MySQL 8.0（GORM + SQL 迁移） |
| **缓存/队列** | Redis |
| **对象存储** | 阿里云 OSS |
| **依赖注入** | Google Wire |
| **接口定义** | Protobuf + gRPC + RESTful（HTTP 转换） |
| **API 文档** | OpenAPI 3.0（自动生成） |
| **用户端前端** | Next.js 16 + React 19 + TypeScript |
| **管理端前端** | Ant Design Pro + UmiJS |
| **桌面客户端** | Electron + Next.js |
| **CI/CD** | GitLab CI |

---

## 🚀 快速开始

### 环境要求

- **Go** ≥ 1.23
- **Node.js** ≥ 20（推荐 22）
- **MySQL** ≥ 8.0
- **Redis** ≥ 6.0

### 1. 克隆仓库

```bash
git clone https://github.com/LiQ002/GO-GEO.git
cd GO-GEO
```

### 2. 配置后端

后端配置文件位于 `kratos-svr/` 下（**含真实密码，已加入 .gitignore，不在仓库中**），请参照以下模板创建：

**`kratos-svr/configs/config.yaml`**（根配置，admin/user 共用）

```yaml
server:
  http:
    addr: 0.0.0.0:8000
    timeout: 1s
  grpc:
    addr: 0.0.0.0:9000
    timeout: 1s
data:
  database:
    driver: mysql
    source: geo:<YOUR_DB_PASSWORD>@tcp(<YOUR_DB_HOST>:3306)/geo?charset=utf8mb4&parseTime=True&loc=UTC
  redis:
    addr: 127.0.0.1:6379
    read_timeout: 0.2s
    write_timeout: 0.2s
```

**`kratos-svr/app/user/configs/config.yaml`** 完整模板见 [kratos-svr/app/user/configs/](kratos-svr/app/user/configs/)，需补充：
- `data.credential_encryption_key`：Base64 编码的加密密钥
- `auth.secret`：JWT 签名密钥
- `storage.aliyun_oss.access_key_id` / `access_key_secret`：阿里云 OSS 凭证

### 3. 执行数据库迁移

```bash
cd kratos-svr
go run ./cmd/migrate
```

> ⚠️ **生产环境禁止使用 GORM AutoMigrate**，所有表结构变更必须通过 `cmd/migrate` 执行。

### 4. 启动后端

```bash
cd kratos-svr
kratos run
# 或分别启动：
# go run ./app/user/cmd/user   # 用户端服务 :8002
# go run ./app/admin/cmd/admin # 管理端服务 :8000
```

### 5. 启动用户端前端

```bash
cd userconsole
npm install
npm run dev   # http://localhost:3000
```

### 6. 启动管理端前端

```bash
cd admin
npm install
npm run dev   # http://localhost:3001
```

---

## 📦 项目结构详解

### 后端（kratos-svr）

采用 Kratos 微服务框架，分为 `user` 和 `admin` 两个独立应用，各自拥有独立的端口、配置、wire 依赖注入。

```
kratos-svr/
├── api/                         # Protobuf 接口定义
│   ├── user/v1/                  #   用户端 API（brand_board, geo_monitor, opinion...）
│   └── admin/v1/                 #   管理端 API（enterprise, plan, dashboard...）
├── app/
│   ├── user/                     # 用户端服务
│   │   ├── cmd/user/             #   启动入口 + Wire 依赖注入
│   │   ├── internal/biz/         #   业务逻辑层
│   │   ├── internal/data/        #   数据访问层（GORM）
│   │   ├── internal/service/     #   服务层（gRPC/HTTP handler）
│   │   └── internal/server/      #   传输层（HTTP/gRPC/SSE）
│   └── admin/                    # 管理端服务（结构同上）
├── cmd/migrate/                  # 数据库迁移工具
├── internal/                     # 跨应用共享代码
│   ├── authn/                    #   认证模块
│   ├── cryptobox/                #   加密工具
│   ├── event/                    #   事件总线
│   ├── migrate/                  #   迁移引擎
│   └── security/                 #   密码哈希
├── migrations/                   # SQL 迁移脚本（版本号全局唯一）
└── openapi.yaml                  # OpenAPI 3.0 文档（自动生成）
```

### 用户端前端（userconsole）

基于 Next.js 16 App Router，提供服务端渲染 + 客户端交互混合模式。

```
userconsole/
├── src/app/
│   ├── (auth)/login/             # 登录页
│   ├── (console)/console/        # 控制台主界面
│   ├── (site)/                   # 官网页面（首页/功能/价格/下载）
│   └── api/                      # Next.js API Routes（代理后端）
├── src/components/               # React 组件
└── src/lib/                      # API 客户端 / Hooks / 工具
```

### 管理端前端（admin）

基于 Ant Design Pro 脚手架，提供企业/套餐/订单/运营等管理功能。

### 桌面客户端（geoclient）

Electron 应用，承载 AI 模型监测驱动与内容平台发布适配器，通过 IPC 与主进程通信。

---

## 🔑 关键业务规则

- **收录判定**：引用来源需与企业系统发布文章的标题或链接精确匹配，否则不算收录
- **情感倾向**：仅区分 positive / negative / neutral，同一回答内同时存在正负面时优先展示负面
- **联系方式曝光**：以 `geo_mentions` 表中 `entity_type='contact'` 记录为准（采集时归一化匹配，查询时直接读取结果）
- **套餐周期**：仅支持半年（180 天）和全年（365 天），月付已废弃
- **配额耗尽**：订阅期内配额用尽时自动抵扣点数余额，点数不足返回中文提示
- **订阅到期**：立即重置所有 `QuotaLimit.used_value` 和 `reserved_value` 为 0
- **舆情分析**：仅在「套餐启用舆情分析 + 本周期无已生成总结 + 存在负面提及」三个条件同时满足时才调用 LLM
- **异步任务**：所有 `go` 关键字启动的协程必须包含 `defer recover()`

---

## 🛠️ 开发指南

### 生成代码

项目使用代码生成器，**生成文件不可手动修改**：

```bash
cd kratos-svr
make api      # 从 proto 生成 *.pb.go / *.grpc.go
make config   # 生成配置 protobuf
make all      # 全量生成（api + config + wire + openapi）
```

生成文件包括：`*.pb.go`、`wire_gen.go`、`openapi.yaml`、`user-api.generated.ts`

### 数据库迁移

```bash
# 新建迁移：使用 schema_migrations 表中最大版本号 + 1
# 版本号全局唯一，不可复用
go run ./cmd/migrate
```

### 前端 API 客户端生成

```bash
cd userconsole
npm run openapi   # 从 kratos-svr/openapi.yaml 生成 user-api.generated.ts
```

### 添加新 API 路径

客户端所有 API 路径必须通过 `geoclient/lib/api/path.ts` 的 `apiPath()` 函数注册。

---

## 📄 文档

- [PRD.md](PRD.md) —— 产品需求文档
- [GEO_TECHNICAL_ARCHITECTURE.md](GEO_TECHNICAL_ARCHITECTURE.md) —— 技术架构设计
- [GEO_SYSTEM_PLAN.md](GEO_SYSTEM_PLAN.md) —— 系统规划
- [USER_GEO_OPERATION_FLOW.md](USER_GEO_OPERATION_FLOW.md) —— 用户操作流程
- [docs/](docs/) —— 模块设计文档（套餐计费、权限区分、数据报表等）

---

## 📝 License

本项目为私有项目，未授权不得使用。
