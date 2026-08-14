# 计划型 App MVP

一款以“目标—计划—执行—反馈”为核心闭环的 AI 个人成长管理工具。

## 项目结构

```text
planning-app/
├── apps/mobile          # Flutter 客户端
├── services/api       # NestJS 后端 API
├── packages/schema    # 共享 Zod Schema
├── docker-compose.yml # Postgres + Redis + API
└── Makefile           # 常用命令
```

## 环境要求

- Node.js >= 20
- npm >= 10
- Docker + Docker Compose（可选，用于本地数据库）
- Flutter 3.x（可选，用于运行移动客户端）

## 快速开始

### 1. 安装依赖

```bash
make install
```

### 2. 启动数据库

```bash
make db-up
```

### 3. 配置环境变量

```bash
cp services/api/.env.example services/api/.env
# 编辑 .env 填入 OPENAI_API_KEY（可选，MVP 骨架阶段可不填）
```

### 4. 运行后端

```bash
make dev
```

访问：
- API: http://localhost:3000/api/v1/health
- 文档: http://localhost:3000/docs

### 5. 运行客户端

```bash
cd apps/mobile
flutter pub get
flutter run
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `make install` | 安装依赖并构建 schema |
| `make db-up` | 启动 Postgres 与 Redis |
| `make db-down` | 停止 Postgres 与 Redis |
| `make dev` | 启动 API 开发服务 |
| `make lint` | 后端代码检查 |
| `make test` | 后端测试 |

## 核心模块

- **AI 计划编排** (`services/api/src/modules/ai`)
  - 模型适配层：统一封装多供应商模型。
  - 计划编排层：模板选择、提示词组装、Schema 校验。
  - 业务执行层：原子写入业务实体。
- **目标与任务** (`goals`, `projects`, `tasks`)
- **习惯与打卡** (`habits`, `checkins`)
- **复盘与推荐** (`reviews`)
- **行为分析** (`analytics`)

## Week 0 完成状态

- [x] Mono-repo 目录结构
- [x] NestJS 后端骨架与业务模块占位
- [x] Prisma schema 与首版迁移脚本位置
- [x] Docker Compose 配置（Postgres + Redis + API）
- [x] AI 模型适配层、计划编排层、业务执行层骨架
- [x] Flutter 客户端骨架（5 个核心页面占位）
- [x] 共享 Zod Schema 包
- [x] 结构化日志（Pino）配置
- [x] Makefile 与 README

## 下一步

进入 Week 1：用户注册/登录、目标 CRUD、里程碑与进度计算。
