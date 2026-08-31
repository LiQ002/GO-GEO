# 多平台文章发布助手 (Article Publisher)

## 产品概述

一款基于 Electron 的桌面应用，帮助内容运营团队将文章批量发布到多个内容平台。分为**运营端**（管理后台）和**客户端**（作者/用户端）两个独立应用。

---

## 支持平台

- 微信公众号
- 知乎
- 头条号（今日头条）
- 微博
- 百家号
- 小红书

> 平台列表可扩展，新增平台只需实现对应的发布流程适配器。

---

## 文章数据模型

每篇文章包含：标题、正文（Markdown/富文本）、封面图、摘要、标签列表、目标发布平台列表、发布状态。

---

## 功能模块

### 运营端（Operator App）

1. **服务配置** - 首次使用配置后端 API 地址（支持保存，下次自动读取）
2. **用户管理** - 查看所有注册用户，了解每位用户的文章数量及发布进度
3. **文章管理** - 跨用户查看所有待发布/已发布文章，支持按用户/平台/状态过滤
4. **发布控制** - 手动触发批量发布，选择用户和平台范围，实时查看发布进度
5. **发布日志** - 查看完整的发布历史记录，包含成功/失败详情和错误信息
6. **数据统计** - 仪表盘展示总用户数、总文章数、今日发布数、各平台成功率
7. **错误重试** - 对失败的发布任务支持一键重试
8. **批量操作** - 支持批量选择文章执行发布/重试操作

### 客户端（Client App）

1. **账号登录** - 用户名 + 密码登录，支持记住登录状态
2. **任务开关** - 一键开启/关闭自动发布任务
3. **文章列表** - 查看自己待发布和已发布的文章，了解每篇文章在各平台的发布状态
4. **平台授权管理** - 列出所有支持的平台，逐个打开平台网页完成登录授权，保存 Cookie 到后端
5. **发布状态追踪** - 实时查看当前发布任务进度（哪篇文章在哪个平台的发布状态）
6. **我的统计** - 个人发布数据概览（发布总数、成功率、各平台分布）
7. **个人设置** - 修改密码，配置通知偏好，选择默认发布平台

### Mock 数据服务（Go 后端）

1. **框架** - Go + Gin + GORM
2. **数据库** - SQLite（单文件，便于分发和测试）
3. **认证** - JWT Token（客户端登录使用）
4. **CORS** - 支持 Electron 渲染进程跨域访问
5. **种子数据** - 内置 Demo 用户、文章和平台授权数据，启动即可演示
6. **发布模拟** - 模拟真实发布流程（异步处理，随机成功/失败，支持进度查询）

---

## 技术栈

### 前端（两个 Electron 应用共用同一套代码）
- **框架**: Electron + React 18 + TypeScript
- **构建工具**: electron-vite + Vite
- **样式**: Tailwind CSS v4
- **状态管理**: Zustand
- **路由**: React Router v6
- **HTTP 客户端**: Axios
- **图标**: Lucide React
- **打包**: electron-builder（两套配置，分别打包运营端和客户端）

### 后端 Mock 服务
- **语言**: Go
- **HTTP 框架**: Gin
- **ORM**: GORM
- **数据库**: SQLite
- **认证**: JWT

---

## 发布状态流转

```
pending → publishing → success
                    ↘ failed → (retry) → publishing → ...
```

---

## API 接口规划

| 方法   | 路径                            | 说明                     | 权限       |
|--------|-------------------------------|--------------------------|------------|
| POST   | /api/auth/login               | 用户登录                 | 公开       |
| GET    | /api/users                    | 用户列表                 | Operator   |
| GET    | /api/users/:id                | 用户详情                 | Operator   |
| GET    | /api/articles                 | 文章列表（含过滤）       | 登录用户   |
| GET    | /api/articles/:id             | 文章详情                 | 登录用户   |
| GET    | /api/platforms                | 支持平台列表             | 公开       |
| GET    | /api/user-platforms           | 我的平台授权状态         | 客户端用户 |
| PUT    | /api/user-platforms/:platform | 更新平台 Cookie          | 客户端用户 |
| POST   | /api/publish                  | 触发发布任务             | 登录用户   |
| GET    | /api/publish/tasks            | 发布任务列表             | 登录用户   |
| POST   | /api/publish/retry/:taskId    | 重试失败任务             | 登录用户   |
| GET    | /api/logs                     | 发布日志                 | 登录用户   |
| GET    | /api/stats                    | 全局统计（运营端）       | Operator   |
| GET    | /api/stats/user               | 个人统计（客户端）       | 客户端用户 |
| GET    | /api/settings                 | 获取系统设置             | Operator   |
| PUT    | /api/settings                 | 更新系统设置             | Operator   |

---

## 构建命令

```bash
# 开发调试
npm run dev:operator    # 运营端开发模式
npm run dev:client      # 客户端开发模式

# 生产打包
npm run build:operator  # 打包运营端安装包
npm run build:client    # 打包客户端安装包

# 后端服务
npm run server:dev      # 启动 Go 开发服务器（端口 8080）
npm run server:build    # 编译 Go 服务器可执行文件
```
