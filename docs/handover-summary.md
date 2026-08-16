# Plan 项目交接文档

> ⚠️ 重要文档：compact 时必须保留本文件内容，作为项目状态、环境、进度的唯一真实来源。
>
> 生成时间：2026-08-12
> 作者：Kimi Code CLI
> 用途：记录当前项目状态、已完成工作、未开发部分、技术路线及环境信息，便于下一任开发者/运维人员接手。

---

## 1. 项目定位与目标

一款以“目标—计划—执行—反馈—调整”为核心闭环的 **AI 个人成长管理工具**。MVP 成功标准：

- 3 分钟内创建目标并得到首周可执行计划。
- 每日首页快速呈现“今天最重要的 3 件事”。
- 完成任务后即时看到目标进度、连续打卡和阶段反馈。
- 用户可随时调整计划，AI 不覆盖用户已有数据。

---

## 2. 技术路线

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 客户端 | Flutter 3.x + Dart | 跨平台（iOS/Android/Web） |
| 状态管理 | `flutter_riverpod` | 已接入 |
| 本地持久化 | `sqflite` | 已接入，`flutter analyze` 通过 |
| 后端 | NestJS 10 + TypeScript | Mono-repo 工作区 |
| 数据库 | PostgreSQL 15 | Prisma 5 ORM，所有迁移已应用（含 `SyncEvent` 与计划阶段字段） |
| 缓存/队列 | Redis 7 | 当前用于会话与限流骨架 |
| 实时通信 | WebSocket / Socket.IO | 已接入 `/sync` |
| 日志 | Pino / `nestjs-pino` | 结构化日志，已配置 |
| 部署 | Docker Compose + systemd | 服务器使用 `planning-api.service` 托管 API |
| 包管理 | npm workspaces | `planning-app/` 为根工作区 |

---

## 3. 开发进度总览

所有 Week 0—15 内容已在 `docs/development-log.md` 详细记录。本文档重点补充 **Week 15 当前状态** 与 **整体缺口**。

### 3.1 已完成功能

#### 后端 API（NestJS）

- [x] 用户注册/登录/Refresh Token（JWT + bcrypt）
- [x] 用户偏好设置（时区、可用时间、精力曲线、通知设置）
- [x] 目标 CRUD + 里程碑 + 进度重算
- [x] 项目 CRUD
- [x] 任务 CRUD + 按日期查询 + 完成 + 延期
- [x] 习惯 CRUD + 打卡
- [x] 提醒 CRUD + 到期查询
- [x] 复盘 CRUD
- [x] AI 计划草案生成、查询、确认落库（含降级占位）
- [x] **分阶段计划**：自定义计划时长 `planDuration`、阶段长度 `stageLength`、只落库当前阶段、`POST /ai/plan-drafts/:id/advance` 进入下一阶段
- [x] **Week 14 新增**：6 个预置领域模板（考研英语/减脂入门/晨间习惯/阅读计划/日语入门/5公里跑步）与模板推荐接口
- [x] **Week 14 新增**：模板匹配 + AI 微调，费用上限触发时优先降级为模板草案
- [x] **Week 14 新增**：多模型路由（`AI_CHEAP_MODEL` / `AI_STRONG_MODEL`），简单计划用 cheap 模型、复盘/重新规划用 strong 模型
- [x] **Week 14 新增**：`GET /ai/templates`、`GET /ai/templates/recommend`、`GET /ai/usage`
- [x] **Week 15 新增**：社交模块（`GoalShare`/`Challenge`/`ChallengeParticipant` 模型），目标分享/接受/拒绝、小组挑战、排行榜
- [x] **Week 15 新增**：社交接口 `POST /social/goals/:id/share`、`GET /social/shares/*`、`POST /social/challenges`、`POST /social/challenges/:id/join`、`GET /social/challenges/:id/leaderboard`
- [x] **Week 16 新增**：ICS 导入/导出与外部日历订阅（`POST /calendar/import-ics`、`GET /calendar/export-ics`、`POST /calendar/sync-external`）
- [x] **Week 16 新增**：运动数据导入（`POST /external/fitness-import`、`ExternalActivity` 模型、可关联 habit 自动生成打卡）
- [x] **Week 17 新增**：数据报表（`GET /reports/execution`、`GET /reports/energy`、`GET /reports/best-time`）
- [x] **Week 17 新增**：`ReportsScreen` 执行/能量/时段 Tab 与 `reports_provider.dart`
- [x] **Week 18 新增**：高级 AI 洞察（`GET /ai/profile-summary`、`GET /ai/personalized-recommendations`、`AiInsightsService`）
- [x] **Week 18 新增**：`AiInsightsScreen` 与 `ai_insights_provider.dart`
- [x] **Week 10 新增**：`GET /api/v1/today` 今日数据聚合（Top 3 任务、习惯打卡、目标进度、过期任务）
- [x] **Week 10 新增**：`GET /api/v1/goals/:id/stats` 目标进度与连续天数统计
- [x] **Week 11 新增**：真实 DeepSeek 模型调用（`POST /ai/plan-drafts`）
- [x] **Week 11 新增**：AI 日费用上限 `AI_DAILY_COST_LIMIT_USD` 与自动降级
- [x] **Week 11 新增**：计划负载检测与超载警告
- [x] **Week 11 新增**：真实 AI 复盘 `POST /ai/review` 与重新规划 `POST /ai/replan`
- [x] **Week 12 新增**：用户偏好默认值与部分更新（`GET /users/me`、`PATCH /users/me/preferences`）
- [x] **Week 12 新增**：收件箱 `InboxItem` 模型与 `POST/GET/PATCH /inbox`、`POST /inbox/:id/convert`、`POST /inbox/:id/dismiss`
- [x] **Week 12 新增**：日历事件 `CalendarEvent` Service/Controller：`POST/GET/PATCH/DELETE /calendar`
- [x] **Week 13 新增**：提醒定时扫描 `RemindersScheduler`，每分钟扫描到期提醒并广播 `reminder.triggered`
- [x] **Week 13 新增**：`POST /reminders/:id/dismiss`、`POST /reminders/:id/snooze` 接口
- [x] 健康检查 `/health`、Swagger `/docs`
- [x] **Week 5 新增**：`SyncEvent` 同步事件表 + WebSocket 网关 `/sync` + REST `/sync/events`
- [x] **Week 5 新增**：任务/习惯/目标变更后自动广播 `SyncEvent`
- [x] **Week 20 新增**：用户偏好嵌套 DTO 校验与默认值补全（`AvailableTimeDto` / `EnergyCurveDto` / `NotificationSettingDto`）
- [x] **Week 20 新增**：AI 模板匹配关键词扩展（同义词覆盖考研英语/减脂/晨间/阅读/日语/跑步）
- [x] **Week 21 新增**：数据库索引优化（Task/Checkin/CalendarEvent/AIOperation）
- [x] **Week 21 新增**：`AIDailyCostSummary` 模型与 AIOperation 30 天自动清理定时任务
- [x] **Week 21 新增**：报表 Redis 缓存（TTL 1 小时）与写操作主动失效
- [x] **Week 24 新增**：SSE 流式计划生成（`POST /ai/plan-drafts/stream` + `GET /ai/plan-drafts/:id/stream`）
- [x] **Week 24 新增**：用户画像快照 `UserProfileSnapshot` 与每周日 03:00 自动刷新 cron
- [x] **Week 24 新增**：模板推荐结合用户历史目标领域与完成率加权
- [x] **Week 25 新增**：`CalendarSubscription` 模型与迁移，支持 ICS / Google / Outlook 日历订阅
- [x] **Week 25 新增**：Google OAuth 日历授权与事件导入（Outlook scaffold）
- [x] **Week 25 新增**：外部日历订阅每 6 小时自动轮询 cron
- [x] **Week 25 新增**：`GET /calendar/subscriptions`、`POST /calendar/subscriptions`、手动同步、OAuth 回调路由
- [x] **Week 25 新增**：Flutter Health Connect 运动数据同步（`health` 包）
- [x] **Week 25 新增**：Flutter 日历订阅管理 UI（ICS/Google）
- [x] 后端单元测试：21 个测试套件，99 个测试全部通过（本地）
- [x] 后端 `npm run build` 与 `npm run lint` 通过（本地）

#### Flutter 客户端

- [x] 登录页、今日页、目标页、任务页、习惯页、AI 计划草案页、复盘页、更多页（设置/收件箱/日历）占位/基础实现
- [x] API 客户端（JWT、统一错误处理）
- [x] Riverpod 状态管理
- [x] **Week 5 新增**：`LocalDatabase`（SQLite 本地表）
- [x] **Week 5 新增**：`SyncEngine`（操作队列 + 拉取事件 + WebSocket 监听）
- [x] **Week 5 新增**：`task_provider` / `habit_provider` / `goal_provider` 接入本地 DB + 同步
- [x] **分阶段计划 UI**：AI 计划页支持选择总时长/阶段长度、展示阶段概览、进入下一阶段按钮
- [x] **Week 10 新增**：今日页展示 Top 3 任务、习惯打卡、目标进度与过期任务
- [x] **Week 10 新增**：习惯页显示连续打卡天数（最长/当前）
- [x] **Week 10 新增**：目标页展示进度条、连续天数、里程碑时间线
- [x] **Week 11 新增**：AI 计划页 loading/fallback/超载提示
- [x] **Week 11 新增**：复盘页接入 `/ai/review`，展示 AI 总结/洞察/下一步
- [x] **Week 12 新增**：底部导航“更多”入口页（设置/收件箱/日历）
- [x] **Week 12 新增**：设置页（时区修改）
- [x] **Week 12 新增**：收件箱页（录入、整理到目标/项目/任务、忽略）
- [x] **Week 12 新增**：日历页（月视图、事件增删查）
- [x] **Week 13 新增**：本地通知服务 `NotificationService` 与 Android 平台配置
- [x] **Week 13 新增**：提醒模型 `ReminderModel`、Provider、今日页提醒列表、设置页通知开关
- [x] **Week 13 新增**：Flutter API 与 WebSocket URL 升级为 HTTPS/WSS
- [x] **Week 14 新增**：AI 计划页模板推荐/选择 chips、AI 用量卡片
- [x] **Week 15 新增**：`SocialScreen`（共享目标/挑战/排行榜）、`social_provider.dart`、目标列表分享按钮、`MoreScreen` 社交入口
- [x] **Week 20 新增**：设置页升级（可用时间/精力曲线/通知偏好）
- [x] **Week 20 新增**：登录/注册 UI 完善（切换/校验/密码可见/错误提示）
- [x] **Week 20 新增**：AI 计划页模板选择时自动回填 `planDuration` / `stageLength`
- [x] **Week 20 新增**：任务页筛选排序（状态/能量/日期/排序）
- [x] **Week 20 新增**：习惯页筛选排序（频率/能量/排序）
- [x] **Week 20 新增**：今日页「明日预览」入口
- [x] **Week 21 新增**：iOS 平台目录、通知权限配置、本地通知点击跳转今日页
- [x] **Week 21 新增**：Android 精确闹钟权限引导卡片
- [x] **Week 21 新增**：报表页 `fl_chart` 柱状图
- [x] `flutter analyze` 通过
- [x] **Week 24 新增**：AI 计划草案页流式生成与阶段进度展示
- [x] **Week 24 新增**：AI 洞察页显示画像最后刷新时间并支持手动刷新
- [x] **Week 25 新增**：运动数据导入页（单条/JSON/Health Connect）
- [x] **Week 25 新增**：日历页 ICS 导入/导出、外部日历订阅管理弹窗
- [x] **Week 26 新增**：Git 仓库初始化（`planning-app` 首笔 commit `630547f`）
- [x] **Week 26 新增**：本地通知点击跳转今日页（含冷启动）
- [x] **Week 26 新增**：Android 精确闹钟权限 `USE_EXACT_ALARM` 声明与 `PlatformException` 错误提示
- [x] **Week 26 新增**：Health Connect 同步失败 UI 回退（警告卡片 + 改用 JSON 导入）
- [x] **Week 26 新增**：日历订阅弹窗下拉刷新
- [x] **Week 27 新增**：FCM 真实推送后端（`fcm.service.ts`、`POST /users/me/fcm-token`）
- [x] **Week 27 新增**：服务端监控指标 `/metrics`（Prometheus 格式）
- [x] **Week 27 新增**：`UserEvent` 行为埋点落库与客户端 `POST /analytics/events` 批量接口
- [x] **Week 27 新增**：`AISession`/`AIMessage` 多轮对话上下文，`createDraft`/`replan`/`review` 支持 `sessionId`/`followUp`
- [x] **Week 27 新增**：Flutter `FcmService` 初始化、Token 上传/刷新/后台消息监听（未配置 Firebase 时优雅降级）
- [x] **Week 27 新增**：Flutter AI 计划页「继续对话」入口与消息气泡列表
- [x] **Week 27-D 新增**：Inbox 本地优先 + 乐观更新 + 失败回退
- [x] **Week 27-D 新增**：Calendar 本地优先 + 乐观更新 + 失败回退
- [x] **Week 27-D 新增**：日历订阅自动刷新 UI（30 秒轮询 + 生命周期恢复刷新）
- [x] **Week 27-D 新增**：SyncEngine 操作结果广播流与指数退避重试

### 3.2 已生成数据模型

按 `prisma/schema.prisma` 当前定义：

| 模型 | 状态 | 说明 |
|------|------|------|
| User | 已应用 | 含 refreshToken、偏好设置 |
| Goal | 已应用 | 长中短期目标，自关联层级 |
| Milestone | 已应用 | 目标阶段与权重 |
| Project | 已应用 | 可关联目标 |
| Task | 已应用 | 含 weight、repeatRule、energyLevel |
| Habit | 已应用 | 可关联多个目标 |
| GoalHabitLink | 已应用 | 多对多关联表 |
| CalendarEvent | 已应用 | 含 `source` 字段，支持 ICS 导入/导出 |
| ExternalActivity | 已应用 | 运动设备导入原始记录 |
| Checkin | 已应用 | 任务/习惯打卡 |
| Reminder | 已应用 | 提醒 |
| PlanVersion | 已应用 | AI 草案版本 |
| AISession / AIOperation | 已应用 | AI 调用审计；AIOperation 含 `sessionId` 关联会话 |
| AIMessage | 已应用 | Week 27 新增，保存多轮对话历史 |
| Review | 已应用 | 复盘 |
| UserEvent | 已应用 | 行为埋点 |
| **SyncEvent** | 已应用 | 多端同步事件表，迁移已部署 |
| **UserProfileSnapshot** | 已应用 | Week 24 新增，用于缓存用户画像摘要与刷新时间 |
| User.fcmToken | 已应用 | Week 27 新增，保存 Flutter FCM Token |

---

## 4. Week 5 具体完成度与未闭合项

### 4.1 已完成（本地代码）

1. **Schema 变更**：`prisma/schema.prisma` 末尾新增 `SyncEvent` 模型，含 `id/userId/eventType/targetType/targetId/payload/deviceId/serverTimestamp`，并补全 `User.syncEvents` 反向关联。
2. **后端模块**：`services/api/src/modules/sync/`
   - `sync.module.ts`
   - `sync-events.service.ts`（持久化 + 广播）
   - `sync-events.gateway.ts`（`/sync` namespace，支持 handshake query token 自动鉴权）
   - `sync-events.controller.ts`（`GET /sync/events`）
   - `query-sync-events.dto.ts`
   - `sync-events.gateway.spec.ts`（测试通过）
3. **业务广播**：`TasksService`、`HabitsService`、`GoalsService` 在创建/完成/打卡后调用 `SyncEventsService.createEvent`。
4. **测试更新**：`tasks.service.spec.ts`、`habits.service.spec.ts`、`goals.service.spec.ts` 补上了 `SyncEventsService` mock。
5. **Flutter 本地同步**：
   - `lib/services/local_database.dart`：SQLite 建表（goals/tasks/habits/operations/sync_meta）
   - `lib/services/sync_engine.dart`：操作队列、拉取 `/sync/events`、WebSocket 监听
   - `lib/providers/task_provider.dart`：本地优先读取 + 离线创建/完成 + 同步事件监听
   - `lib/providers/habit_provider.dart`：本地缓存 + 离线打卡 + 同步事件监听
   - `lib/providers/goal_provider.dart`：本地缓存 + 在线创建 + 同步事件监听
   - `lib/providers/auth_provider.dart`：增加 `localDbProvider`、`syncEngineProvider`，登录后初始化同步引擎
6. **依赖**：`pubspec.yaml` 新增 `sqflite`、`path`、`socket_io_client`、`uuid`；`package.json` 新增 `@nestjs/websockets`、`@nestjs/platform-socket.io`、`socket.io`。

### 4.2 已完成 / 已验证（2026-08-12 后续更新）

1. **Prisma 迁移已应用**：`SyncEvent` 表与 `PlanVersion` 阶段字段（`planDuration`/`stageLength`/`currentStage`/`totalStages`）均已通过 `npx prisma migrate deploy` 应用到服务器数据库。
2. **Week 5 后端已部署到服务器**：代码已同步到 `/opt/planning-app`，`npm install` / `npx prisma generate` / `npx prisma migrate deploy` / `npm run build` 已完成，API 已迁移到 systemd 服务并运行。
3. **Flutter 本地环境已就绪**：Flutter 3.44.9 解压到 `C:/Users/Administrator/flutter`，`flutter pub get` 与 `flutter analyze` 已通过。
4. **自定义分阶段计划端到端验证通过**：
   - `POST /api/v1/ai/plan-drafts` 支持 `planDuration`/`stageLength`。
   - 确认后只落库当前阶段 tasks/milestones。
   - `POST /api/v1/ai/plan-drafts/:id/advance` 生成下一阶段并复用同一 `goalId`。

### 4.3 仍未完成 / 待后续 Week 开发

1. **AISession 多轮对话未开发**：模型存在，无实际多轮上下文管理。
2. **UserEvent 行为埋点未落库**：`analytics.service.ts` 仅接口骨架，未持久化。
3. **设置/偏好页仅完成时区与通知总开关**：可用时间、精力曲线、通知偏好的详细配置待后续迭代。
4. **收件箱与日历未接入离线同步**：当前依赖在线 API，未写入本地 SQLite 与操作队列。
5. **本地通知当前仅配置 Android**：iOS 平台目录未生成；通知点击跳转未完整实现；精确闹钟权限未做引导。
6. **预置领域模板未开发**：无模板匹配与 AI 微调。
7. **HTTPS / Nginx / 备份部分完成**：HTTPS 与 Nginx 反向代理已配置；备份仅本地 7 天，未做异地容灾/监控/Nginx 日志轮转。
8. **版本控制缺失**：本地与服务器均无 `.git` 仓库。
9. **文档滞后**：`docs/architecture/` 未更新为已实现状态。

### 4.4 后续开发计划

详细计划见 **《计划型 App 后续开发路线图》**：
`planning-app/docs/development-roadmap.md`

主要方向：
- **Week 11**：真实 AI 接入与智能复盘。
- **Week 12**：设置、收件箱与日历。
- **Week 13**：提醒推送与生产加固（HTTPS、备份）。
- **Week 14**：预置模板与 AI 高级能力（多模型路由、费用上限）。
- **Week 15**：社交与共享（目标分享、小组挑战、排行榜）。
- **Week 16**：外部集成（ICS 日历导入/导出/订阅、运动数据导入）。
- **Week 17**：数据报表（执行报表、能量曲线、最佳时段）。
- **Week 18**：高级 AI（用户画像摘要、个性化计划建议）。


---

## 5. 环境信息

### 5.1 本地开发环境（Windows）

- **工作目录**：`C:/Users/Administrator/Desktop/666/`
- **项目目录**：`C:/Users/Administrator/Desktop/666/planning-app/`
- **版本控制**：`planning-app/` 下已初始化 Git 仓库（`main` 分支），首笔 commit `630547f`。`tools/flutter` 已排除在 index 外。
- **Node.js**：v24.16.0 / npm 11.13.0（根据开发日志，需确认）
- **Docker**：本地不支持虚拟化，无法运行 Docker Desktop / Docker 引擎。
- **Flutter**：已安装，路径 `C:/Users/Administrator/flutter`，命令 `C:/Users/Administrator/flutter/bin/flutter`，`flutter analyze` 通过。
- **本地验证结果**（最近一次 Week 27）：
  - `npm run build -w services/api`：通过
  - `npm run test -w services/api`：21 个测试套件，99 个测试全部通过
  - `npm run lint`：通过
  - `npx prisma generate`：通过
  - `npx prisma migrate dev`：**无法执行**（无本地数据库，迁移在服务器执行）
  - `flutter analyze`：No issues found

### 5.2 服务器环境（xutaostudy.xyz）

- **登录**：`root@xutaostudy.xyz`，密钥 `C:/Users/Administrator/Downloads/ab12.pem`
- **项目路径**：`/opt/planning-app`
- **版本控制**：同样 **没有 `.git`**，代码通过 tar 上传。
- **Docker**：已安装，当前运行两个容器：
  - `planning-app-postgres`：PostgreSQL 15，端口 `127.0.0.1:5432`
  - `planning-app-redis`：Redis 7，端口 `127.0.0.1:6379`

### 5.3 服务器实时状态（每次操作后必须更新）

> 本章节记录服务器最近一次确认状态，compact 后恢复上下文时以本记录为准，并再用命令复核。

- **记录时间**：2026-08-16 18:25 CST（Week 29 FCM 配置完成后）
- **systemd 服务**：`planning-api.service`
  - 状态：`active (running)`（基于 Week 29 本地构建 `dist/` 上传部署）
  - 自启：`enabled`
  - **重要变更**：服务文件使用 `EnvironmentFile=/opt/planning-app/.env`；已配置 DeepSeek 真实模型 key、日费用上限 `AI_DAILY_COST_LIMIT_USD=1.0`，以及 `AI_CHEAP_MODEL=deepseek-v4-flash`、`AI_STRONG_MODEL=deepseek-reasoner`。
  - **Week 29 FCM 配置变更**：
    - 将 Firebase Admin SDK 服务账号 JSON 文件上传到 `/opt/planning-app/firebase-service-account.json`（权限 600）。
    - `/opt/planning-app/.env` 中 `GOOGLE_APPLICATION_CREDENTIALS_JSON=/opt/planning-app/firebase-service-account.json`（使用文件路径，避免 systemd 环境文件转义问题）。
    - 日志确认：`FcmService` 输出 `FCM 初始化完成`，`NotificationsModule dependencies initialized`。
    - 当前尚无用户上传 FCM token，待真机登录后验证端到端推送。
- **Nginx 服务**：`nginx.service`
  - 状态：`active (running)`
  - 自启：`enabled`
  - 反向代理 `/api/v1/` 与 `/sync` 到 `127.0.0.1:3001`。
- **监听端口**：
  - `0.0.0.0:80`、`0.0.0.0:443`（Nginx）
  - `*:3001`（planning-api）
- **健康检查**：
  - `GET https://xutaostudy.xyz/api/v1/health` → `{"status":"ok","service":"planning-app-api","version":"0.0.1"}` ✅
  - `GET https://xutaostudy.xyz/api/v1/metrics` → Prometheus 指标正常 ✅
- **数据库容器**：
  - `planning-app-postgres`：up，健康
  - `planning-app-redis`：up，健康
- **已应用迁移**（`npx prisma migrate status` 确认 up to date）：
  - `20260811131033_init`
  - `20260811135523_add_review_goal_id`
  - `20260811135920_make_plan_version_goal_optional`
  - `20260812181431_add_plan_duration_stages`
  - `20260812215500_add_inbox_item`
  - `20260813190000_add_performance_indexes_and_ai_summary`
  - `20260813200000_add_user_profile_snapshot`
  - `20260814083000_add_external_integration`
  - `20260816000000_add_calendar_subscription`
  - `20260814180100_add_fcm_and_ai_message`（Week 27 新增）
- **数据库表/字段确认**：
  - `users.fcmToken` 字段已存在 ✅
  - `ai_messages` 表已创建 ✅
- **Node modules**：Week 27 部署后已重新 `npm install`；新增 `firebase-admin` 等依赖。
- **代码版本**：基于 2026-08-14 Week 27 本地代码 tar + scp 到 `/opt/planning-app`，本地构建 `dist` 上传到 `/opt/planning-app/services/api/dist` 后重启服务。
- **备份**：`/opt/planning-app-backup-week21` 保留 Week 21 代码备份。
- **AI 运行状态**：
  - 模型：`deepseek-v4-flash`，baseURL `https://api.deepseek.com/v1`。
  - 已验证真实 AI 生成计划、复盘、重新规划均成功。
- **部署方式**：因服务器单核 ECS 直接 `nest build` 会压死 SSH，本次采用**本地构建后上传 `dist/`** 的方式部署。
- **Week 13 业务验证**：
  - `GET https://xutaostudy.xyz/api/v1/health` 正常。
  - `POST /api/v1/reminders` 创建提醒成功。
  - `POST /api/v1/reminders/:id/snooze` / `POST /api/v1/reminders/:id/dismiss` 正常。
  - 创建 `triggerAt` 为过去的提醒，约 1 分钟后状态变为 `sent`。
- **Week 14 业务验证**（部署后立即验证）：
  - `GET /api/v1/ai/templates` 返回 6 个预置模板（id/name/category/keywords）。
  - `GET /api/v1/ai/templates/recommend?input=%E8%80%83%E7%A0%94%E8%8B%B1%E8%AF%AD` 返回 `postgraduate-english` 模板。
  - `GET /api/v1/ai/usage` 新用户返回 `dailyCost=0, callCount=0`。
  - `POST /api/v1/ai/plan-drafts` 带 `templateId=postgraduate-english` 成功生成贴合考研英语的 7 天计划，并记录 AIOperation（费用约 \$0.00076，callCount 变为 1）。
- **Week 15 业务验证**（部署后立即验证）：
  - 用户 A 创建目标并分享给用户 B，用户 B 在 `/social/shares/received` 中收到 `pending` 邀请。
  - 用户 B 调用 `/social/shares/:id/respond` 接受邀请，状态变为 `accepted`。
  - 用户 A 创建 `habit_streak` 挑战，用户 B 加入，排行榜返回 2 条参与者记录。
- **Week 16 业务验证**（部署后立即验证）：
  - `POST /api/v1/calendar` 创建日历事件成功。
  - `GET /api/v1/calendar/export-ics` 返回包含该事件的 ICS 文本。
  - `POST /api/v1/calendar/import-ics` 导入测试 ICS 文本，返回 `{ "imported": 1 }`。
  - 日历列表查询同时包含原事件与导入事件。
  - `POST /api/v1/habits` 创建「跑步」习惯，随后 `POST /api/v1/external/fitness-import` 传入该 `habitId` 成功保存运动记录并生成 1 条习惯打卡。
- **Week 17 业务验证**（部署后立即验证）：
  - `GET /api/v1/reports/execution?period=weekly&date=2026-08-17` 返回周期标签、任务/习惯/目标汇总。
  - `GET /api/v1/reports/energy` 返回精力曲线（当前为空对象）与默认建议。
  - `GET /api/v1/reports/best-time` 返回 24 小时分布数组与最佳时段。
- **Week 18 业务验证**（部署后立即验证）：
  - `GET /api/v1/ai/profile-summary` 返回真实 AI 生成的用户画像摘要（`fallback: false`）。
  - `GET /api/v1/ai/personalized-recommendations` 返回下一步目标/习惯/排程建议。
  - 新用户无历史数据时，画像摘要给出引导性反馈。
- **Week 19 业务验证**（部署后立即验证）：
  - `POST /api/v1/inbox` 创建收件箱条目成功。
  - `GET /api/v1/sync/events` 返回 `inbox.created` 事件。
  - `POST /api/v1/calendar` 创建日历事件成功。
  - `GET /api/v1/sync/events?eventType=calendar.created` 正确过滤返回 `calendar.created` 事件。
- **Week 20 业务验证**（部署后立即验证）：
  - `PATCH /api/v1/users/me/preferences` 支持嵌套结构体：`availableTime.monday`、`energyCurve.0`、`notificationSetting.doNotDisturbStart` / `doNotDisturbEnd` / `weekendOff` / `reminderMinutesBefore`。
  - `GET /api/v1/users/me` 正确返回保存后的偏好。
  - `GET /api/v1/ai/templates/recommend?input=考研英语单词` 返回 `postgraduate-english` 模板（同义词匹配生效）。
- **Week 21 业务验证**（部署后立即验证）：
  - Prisma 迁移 `20260813190000_add_performance_indexes_and_ai_summary` 已应用，`ai_daily_cost_summaries` 表已创建。
  - `GET /api/v1/reports/execution` 首次调用写入 Redis，二次调用命中缓存；创建任务后缓存被清除。
  - 数据库备份脚本 `/opt/backups/backup-planning-db.sh` 手动执行成功。
  - Nginx 日志轮转配置 `/etc/logrotate.d/nginx-planning` 已添加并通过 `logrotate -d` 验证。
- **数据库备份**：
  - 脚本：`/opt/backups/backup-planning-db.sh`
  - 远程上传占位脚本：`/opt/backups/backup-planning-db-to-oss.sh`
  - 备份目录：`/opt/backups/planning-app/`
  - 已手动执行一次生成 `planning_app_20260813_193054.dump`（84KB）。
  - cron：`0 3 * * * /opt/backups/backup-planning-db.sh >> /var/log/planning-backup.log 2>&1`
  - 本地保留 7 天；远程备份默认关闭，可通过 `REMOTE_BACKUP_ENABLED=true` 启用。
- **Nginx 日志轮转**：
  - 配置：`/etc/logrotate.d/nginx-planning`
  - 策略：daily，保留 14 天，压缩。
- **已知问题**：
  - `/opt/planning-app/services/api/.env` 已删除，统一使用 `/opt/planning-app/.env`；执行 Prisma CLI 前需 `source /opt/planning-app/.env`。
  - DeepSeek 单次调用耗时约 40-150 秒，移动端 loading 提示已到位。
  - **Week 15 遗留**：社交排行榜显示邮箱而非昵称/头像；共享目标未完整实现编辑权限；挑战与目标/习惯未强关联，按全局行为计分；无实时推送。
  - **Week 16 遗留**：未实现 Google/Outlook OAuth 完整功能，仅支持公开 ICS URL / ICS 文本粘贴；运动数据未接入真实设备 SDK；外部日历同步后端 cron 已存在，UI 同步状态提示待增强（Week 32）。
  - **Week 18 遗留**：profile-summary 依赖 strong 模型，成本较高；分析维度有限；未实现周期性自动刷新画像。**（Week 24 已解决：增加快照表与自动刷新 cron，默认读快照减少重复调用）**
  - **Week 27/29 FCM 状态**：后端 `FcmService` 已初始化完成，`users.fcmToken` 字段已就绪，待真机登录上传 token 后验证真实推送。
  - **Week 24 遗留**：SSE 客户端暂无自动重连与心跳；逐 token 流式输出待后续需要时再实现；模板推荐仍基于关键词硬匹配，可后续引入 embedding 语义匹配。
- **Week 19 部署状态**：
  - 2026-08-13 18:35 部署完成。
  - 踩坑：旧 `.env` 被删除后需从 `planning-app-backup/.env` 复制；`nest build` 仅生成 `.d.ts` 时需删除 `dist/` 与 `tsconfig.tsbuildinfo` 重编；`bcrypt` 需 `npm rebuild --build-from-source`。
- **Week 20 部署状态**：
  - 2026-08-13 19:02 部署完成。
  - 踩坑：本次同样遇到 `nest build` 仅生成 `.d.ts` 的问题，已按 Week 19 经验删除 `dist/` 与 `tsconfig.tsbuildinfo` 后重新构建成功。
  - 部署前已在服务器保留备份：`/opt/planning-app-backup-week20`。
### 5.4 网络与工具踩坑记录

1. **GitHub 在 shell 中无法访问**：用户电脑使用 VPN，但命令行 `git clone https://github.com/flutter/flutter.git` 连接超时。最终改用 **腾讯镜像预编译 zip** 下载 Flutter 3.44.9 到 `C:/Users/Administrator/flutter`。
2. **rsync 上传失败**：Git Bash 下 `rsync -e ssh ...` 报 `dup() in/out/err failed`，改用 `scp` 成功。
3. **screen 会话丢失**：尝试通过 `screen -S` 控制远端会话时找不到 socket；最终改用 **systemd** 服务管理 `planning-api`。
4. **本地无数据库**：Windows 不支持 Docker 虚拟化，导致 `prisma migrate dev` 无法在本地执行，必须在服务器上跑 `npx prisma migrate deploy`。
5. **服务器 `nest build` 只生成 `.d.ts`**：删除 `dist/` 与 `tsconfig.tsbuildinfo` 后重新构建可解决。
6. **服务器单核 ECS 直接 `nest build` 会压死 SSH 导致无响应**：Week 27 起改为 **本地构建 `dist/` 后上传服务器** 部署。
7. **服务器 `/opt/planning-app/services/api/.env` 旧模板文件导致 Prisma 认证失败**：删除或重命名该文件，统一使用 `/opt/planning-app/.env`；执行 Prisma CLI 前确保工作目录能读取正确 `.env`。
8. **服务器重启后 `dist/` 目录缺失导致服务启动失败**：Week 27 部署过程中因源码包不含 `dist/` 且服务器 build 被中断，导致服务无法启动；需确保上传本地构建产物后再启动服务。

### 5.5 服务器快速检查命令

```bash
ssh -i /c/Users/Administrator/Downloads/ab12.pem root@xutaostudy.xyz
systemctl status planning-api
ss -tlnp | grep 3001
docker ps
cd /opt/planning-app/services/api && npx prisma migrate status
curl -s http://127.0.0.1:3001/api/v1/health
```

---

## 6. 下一步建议

后续开发已整理为路线图文档，详见：

**`planning-app/docs/development-roadmap.md`**

Week 18 已完成，当前阶段明确为**个人使用版本**，暂不进入商业化与社交共享功能。推荐方向：

1. **Week 19：个人多端离线同步补全**
   - 把 Inbox、Calendar、ExternalActivity 纳入个人多端离线同步体系。
   - 补齐 `SyncEvent` 广播与 Flutter 本地缓存/操作队列。
   - Social 模块（目标分享、挑战、排行榜）保留代码但不扩展离线同步，作为未来商业版备份。
2. **Week 20：个人版设置与体验打磨**
   - 设置页：可用时间、精力曲线、通知偏好完整配置。
   - 登录/注册 UI 完善、AI 模板默认值回填、列表筛选排序、明日预览。
3. **Week 21：个人版生产加固与性能优化**
   - `AIOperation` 自动清理、数据库索引优化、报表 Redis 缓存、Nginx 日志轮转、本地/可选异地备份脚本。
   - iOS 平台配置、本地通知点击跳转、Android 精确闹钟权限引导。

商业化（订阅/团队版/数据导出）、社交深度（昵称/头像、共享目标权限、排行榜实时推送）、CI/CD 等完整计划已保留在 **未来更新计划（Week 22+）** 中，作为后续商业版本的开发备份，当前不执行。

主要遗留风险已纳入上述三周计划：
- Week 15 社交遗留（排行榜显示邮箱、共享目标权限、挑战关联、实时推送）→ 个人版不处理，保留到 Week 22+ 商业版。
- Week 16 外部集成遗留（Google/Outlook OAuth、真实设备 SDK、外部日历定时轮询）→ Week 25+ 外部集成深化。
- Week 17 报表遗留（报表时区、环比、图表库、缓存）→ Week 20/21。
- Week 18 AI 遗留（画像成本、分析维度、自动刷新）→ Week 21/24+。


---

## 7. 关键文件清单

### 后端核心

- `planning-app/services/api/src/app.module.ts`：根模块，已导入 `SyncModule`、`SocialModule`、`ExternalModule`。
- `planning-app/services/api/src/modules/sync/`：同步模块全部文件。
- `planning-app/services/api/src/modules/social/`：社交模块全部文件。
- `planning-app/services/api/src/modules/external/`：外部数据导入模块（运动数据）。
- `planning-app/services/api/src/modules/calendar/`：日历模块，新增 ICS 导入/导出/外部订阅。
- `planning-app/services/api/src/modules/reports/`：数据报表模块。
- `planning-app/services/api/src/modules/ai/ai-insights.service.ts`：高级 AI 洞察服务。
- `planning-app/services/api/src/modules/tasks/tasks.service.ts`：任务服务，已广播事件。
- `planning-app/services/api/src/modules/habits/habits.service.ts`：习惯服务，已广播事件。
- `planning-app/services/api/src/modules/goals/goals.service.ts`：目标服务，已广播事件。
- `planning-app/services/api/src/modules/users/dto/update-preferences.dto.ts`：Week 20 用户偏好嵌套 DTO。
- `planning-app/services/api/src/modules/users/users.service.ts`：Week 20 偏好默认值与补全。
- `planning-app/services/api/src/modules/ai/templates/ai-templates.ts`：Week 20 预置模板与同义词；Week 24 增加历史权重推荐。
- `planning-app/services/api/src/modules/ai/ai-cleanup.service.ts`：Week 21 AIOperation 清理。
- `planning-app/services/api/src/modules/ai/model-adapter.service.ts`：Week 24 `streamProgress()`。
- `planning-app/services/api/src/modules/ai/plan-orchestrator.service.ts`：Week 24 `generateDraftStream()`。
- `planning-app/services/api/src/modules/ai/ai.service.ts`：Week 24 `createStreamDraft()` / 真正 `streamDraft()` / 历史权重推荐。
- `planning-app/services/api/src/modules/ai/ai-insights.service.ts`：Week 24 画像快照与自动刷新 cron。
- `planning-app/services/api/src/modules/ai/ai.controller.ts`：Week 24 新增 `/ai/plan-drafts/stream` 与 `useSnapshot` 参数。
- `planning-app/services/api/src/modules/reports/reports.service.ts`：Week 21 报表 Redis 缓存。
- `planning-app/services/api/src/common/events/report-cache.events.ts`：Week 21 缓存失效事件总线。
- `planning-app/services/api/prisma/schema.prisma`：数据模型，新增 `SyncEvent`、`ExternalActivity`、`CalendarEvent.source`、`AIDailyCostSummary`。
- `planning-app/ops/backup-planning-db.sh` / `backup-planning-db-to-oss.sh`：Week 21 备份脚本副本。

### 客户端核心

- `planning-app/apps/mobile/lib/services/local_database.dart`：SQLite 本地数据库。
- `planning-app/apps/mobile/lib/services/sync_engine.dart`：同步引擎。
- `planning-app/apps/mobile/lib/providers/task_provider.dart`：任务状态 + 离线同步。
- `planning-app/apps/mobile/lib/providers/habit_provider.dart`：习惯状态 + 离线同步。
- `planning-app/apps/mobile/lib/providers/goal_provider.dart`：目标状态 + 缓存。
- `planning-app/apps/mobile/lib/providers/auth_provider.dart`：登录 + 同步引擎初始化。
- `planning-app/apps/mobile/lib/providers/calendar_provider.dart`：日历状态 + 外部 ICS 导入/导出/订阅。
- `planning-app/apps/mobile/lib/providers/external_provider.dart`：运动数据导入接口封装。
- `planning-app/apps/mobile/lib/screens/calendar_screen.dart`：日历页 + 外部集成菜单。
- `planning-app/apps/mobile/lib/screens/fitness_import_screen.dart`：运动数据导入页。
- `planning-app/apps/mobile/lib/screens/reports_screen.dart`：数据报表页。
- `planning-app/apps/mobile/lib/providers/reports_provider.dart`：报表接口封装。
- `planning-app/apps/mobile/lib/screens/ai_insights_screen.dart`：AI 洞察页；Week 24 显示刷新时间与手动刷新。
- `planning-app/apps/mobile/lib/providers/ai_insights_provider.dart`：AI 洞察接口封装；Week 24 新增 `refreshProfileSummary()`。
- `planning-app/apps/mobile/lib/services/sse_client.dart`：Week 24 新建 SSE 客户端。
- `planning-app/apps/mobile/lib/providers/ai_provider.dart`：Week 24 新增 `createDraftStream()` 与事件类型。
- `planning-app/apps/mobile/lib/screens/ai_plan_draft_screen.dart`：Week 24 改用流式生成并展示进度。
- `planning-app/apps/mobile/lib/screens/settings_screen.dart`：Week 20 设置页（可用时间/精力曲线/通知偏好）。
- `planning-app/apps/mobile/lib/providers/settings_provider.dart`：Week 20 偏好状态封装。
- `planning-app/apps/mobile/lib/screens/login_screen.dart`：Week 20 登录/注册 UI。
- `planning-app/apps/mobile/lib/providers/auth_provider.dart`：Week 20 注册方法。
- `planning-app/apps/mobile/lib/screens/ai_plan_draft_screen.dart`：Week 20 模板默认值回填。
- `planning-app/apps/mobile/lib/screens/task_screen.dart`：Week 20 任务筛选排序。
- `planning-app/apps/mobile/lib/screens/habit_screen.dart`：Week 20 习惯筛选排序。
- `planning-app/apps/mobile/lib/screens/today_screen.dart`：Week 20 今日页明日预览。
- `planning-app/apps/mobile/ios/Runner/Info.plist`：Week 21 iOS 通知权限配置。
- `planning-app/apps/mobile/ios/Runner/AppDelegate.swift`：Week 21 iOS 通知注册。
- `planning-app/apps/mobile/lib/services/notification_service.dart`：Week 21 通知点击回调与精确闹钟权限。
- `planning-app/apps/mobile/lib/main.dart`：Week 21 通知点击跳转。
- `planning-app/apps/mobile/lib/screens/settings_screen.dart`：Week 21 Android 精确闹钟权限引导。
- `planning-app/apps/mobile/lib/screens/reports_screen.dart`：Week 21 `fl_chart` 报表柱状图。
- `planning-app/apps/mobile/pubspec.yaml`：新增依赖。

### 文档

- `项目阶段总结.md`（根目录）：汇总开发阶段状态、已实现功能、未实现功能、不完善地方与技术债务。
- `实现计划.md`：原始 MVP 实现计划。
- `decisions/2026-08-11-*.md`：各 Week 用户决策记录。
- `decisions/2026-08-14-Week16外部集成决策.md`：Week 16 外部集成方案决策。
- `planning-app/docs/development-log.md`：开发日志。
- `planning-app/docs/项目开发总结报告.md`：项目全周期开发总结、已实现功能、未实现功能、环境状态与后续建议（**重要，compact 须保留**）。
- `planning-app/docs/development-roadmap.md`：后续 Week 开发路线图（**重要，compact 须保留**）。
- `planning-app/docs/api.md`：API 文档。
- `planning-app/docs/architecture/offline-sync.md`：离线同步架构。
- `planning-app/docs/architecture/multi-device-sync.md`：多端同步架构。
- `kimiRULES.txt`：开发规则。
- `planning-app/docs/testing-phase.md`：测试阶段构建产物、测试方法、观察指标与 Week 27 构建修复记录。
- `planning-app/docs/testing-plan.md`：Week 27 个人使用版详细测试计划（用例、执行清单、缺陷模板、通过标准）。

---

## 8. 备注

- 本交接文档基于当前工作目录 `C:/Users/Administrator/Desktop/666/` 和服务器 `/opt/planning-app` 的探查结果生成。
- 所有代码修改已尽量遵循 `kimiRULES.txt`：优先本地工具、添加调试日志、重大变更留决策文件。
- 后续开发计划已写入 `planning-app/docs/development-roadmap.md`，当前基线为 **Week 24 结束**，高级 AI 深化（SSE 流式生成、画像自动刷新、模板推荐调优）已完成，外部集成深化推迟到 **Week 25+**。
- 当前主要风险点：
  - Inbox/Calendar 已接入离线同步，Social 保留在线只读。
  - 设置页 UI 与默认值回填已补全（Week 20）。
  - AIOperation 清理、报表缓存、Nginx 日志轮转、备份脚本已在 Week 21 落地；远程备份为占位实现，需用户自行启用。
  - iOS 平台目录与通知配置已生成，真机推送证书需 Apple Developer 账号。
  - 无版本控制，代码通过 tar/scp 同步，存在覆盖风险。

---

## 9. 2026-08-12 后续更新记录

### 本地 Flutter 环境

- 从清华镜像 git clone 排队太慢，改用 **腾讯镜像预编译 zip** 下载 Flutter 3.44.9。
- 解压到 `C:/Users/Administrator/flutter`。
- 使用腾讯镜像环境变量成功执行 `flutter pub get`：
  - `PUB_HOSTED_URL=https://mirrors.cloud.tencent.com/dart-pub`
  - `FLUTTER_STORAGE_BASE_URL=https://mirrors.cloud.tencent.com/flutter`
- `flutter analyze`：No issues found（修复了 `auth_provider.dart` 导入路径与 `habit_provider.dart` 未使用 import）。

### 服务器 Week 5 部署完成

- 上传代码到 `/opt/planning-app`。
- 运行 `npm install` 安装新依赖（`@nestjs/websockets`、`socket.io` 等）。
- 运行 `npx prisma generate` 与 `npx prisma migrate dev --name add_sync_event`，应用迁移 `20260812072438_add_sync_event`。
- 修复服务器 `npm run build` 仅生成 `.d.ts` 的问题：删除 `dist/` 与 `tsconfig.tsbuildinfo` 后重新构建成功。
- 使用 `nohup npm run start:prod` 启动 API，监听 `0.0.0.0:3001`。

### 验证结果

- `GET /api/v1/health`：返回 `{"status":"ok"}`。
- `GET /api/v1/sync/events`：返回同步事件列表。
- WebSocket 连接 `ws://xutaostudy.xyz:3001/sync` 并携带 JWT，收到 `auth_ok`。
- 创建任务后，WebSocket 客户端收到 `task.created` 事件；REST `/sync/events` 同步返回该事件。
- 创建目标/习惯后，分别生成 `goal.created` / `habit.created` 事件。

### 踩坑补充

- 服务器 `nest build` 在已有 `dist/` 和 `tsconfig.tsbuildinfo` 时只生成声明文件，需删除后重新构建。
- `screen` 会话在服务器上无法稳定保留，改用 `nohup` 启动；建议后续改用 `systemd` 或 `pm2`。

---

## 10. 2026-08-12 运行方式改进

- 已将服务器 API 从 `nohup` 迁移到 **systemd 服务**。
- 服务文件：`/etc/systemd/system/planning-api.service`
- 工作目录：`/opt/planning-app`
- 启动命令：`/usr/bin/npm run -w services/api start:prod`
- 已设置 `Restart=always` 与开机自启 `systemctl enable`。
- 常用运维命令：
  ```bash
  systemctl status planning-api
  systemctl restart planning-api
  journalctl -u planning-api -f
  ```
- 验证：服务状态 `active (running)`，端口 3001 监听正常，`/health` 返回 ok。

---

## 11. 2026-08-13 后续开发计划调整

### 决策背景

Week 18 完成后，原计划进入 **Week 19 商业化**（订阅/团队版/数据导出）。经用户明确当前 App **仅作个人使用**，但需要**多端同步**，且后续**可能继续开发商业版本**，因此调整当前阶段为「个人版」，保留完整商业/社交计划作为备份，当下集中完成个人核心体验的优化与稳定运行。

### 新计划：Week 19-21 个人版优化路线

1. **Week 19：个人多端离线同步补全**
   - 后端：扩展 `SyncEvent` 广播范围到 Inbox、Calendar、ExternalActivity（个人数据）；支持 `eventType` 过滤。
   - Social 模块（目标分享、挑战、排行榜）保留现有代码但不扩展离线同步，作为未来商业版备份。
   - Flutter：扩展 `LocalDatabase` 表与 `SyncEngine` 操作类型；改造 `inbox_provider` / `calendar_provider` 为本地优先；`social_provider` 保持在线只读。
2. **Week 20：个人版设置与体验打磨**
   - 后端：补全 `PATCH /users/me/preferences` 默认值与校验；模板关键词调优。
   - Flutter：设置页（可用时间、精力曲线、通知偏好）、登录/注册 UI 完善、AI 模板默认值回填、列表筛选排序、明日预览。
3. **Week 21：个人版生产加固与性能优化**
   - 后端：`AIOperation` 自动清理、数据库索引优化、报表 Redis 缓存、Nginx 日志轮转、本地/可选异地备份脚本。
   - Flutter：iOS 平台目录与通知配置、本地通知点击跳转、Android 精确闹钟权限引导、`fl_chart` 替换报表柱状图。

### 未来更新计划（Week 22+，完整计划保留作为商业版备份）

- **Week 24**：高级 AI 深化（SSE 流式计划、用户画像自动刷新、模板推荐调优）。**已完成（本地代码），待部署。**
- **Week 25**：外部集成深化（Google/Outlook OAuth 私有日历、Health Connect、外部日历定时轮询）。
- **Week 26**：稳定性与规模化（灰度发布、监控告警、性能压测、代码仓库与 CI/CD）。
- **Week 27+**：商业化（订阅/会员、团队版入口、数据导出 JSON/CSV/ICS）与社交深度（昵称/头像、共享目标编辑权限、挑战关联目标/习惯、实时排行榜推送），作为商业版备份。

### 相关文档

- 详细任务与验证标准见 `planning-app/docs/development-roadmap.md` 第 12-15 章。
- 方案决策记录见 `decisions/2026-08-13-Week19-21优化方向决策.md` 与 `decisions/2026-08-13-个人使用场景Week19-21调整决策.md`。


---

## 12. 2026-08-13 Week 20 部署记录

### 部署内容

- 后端：用户偏好嵌套 DTO 校验与默认值补全；AI 模板关键词同义词扩展。
- Flutter：设置页升级、登录/注册 UI 完善、AI 模板默认值回填、任务/习惯列表筛选排序、今日页明日预览。

### 本地验证

- `npm run test`：18 suites / 83 tests 全部通过。
- `npm run lint`：通过。
- `npm run build`：通过。
- `flutter analyze`：No issues found。

### 服务器部署步骤

1. 本地打包：`tar --exclude=node_modules --exclude=.git --exclude=dist --exclude=build -czf planning-app-week20.tar.gz planning-app`
2. 上传到服务器：`scp planning-app-week20.tar.gz root@xutaostudy.xyz:/tmp/`
3. 服务器备份当前代码：`cp -a /opt/planning-app /opt/planning-app-backup-week20`
4. 解压覆盖：`tar -xzf /tmp/planning-app-week20.tar.gz`，保留 `/opt/planning-app/.env`
5. 安装依赖：`npm install`
6. 生成 Prisma Client：`npx prisma generate`
7. 构建：删除 `dist/` 与 `tsconfig.tsbuildinfo` 后 `npm run build`（解决只生成 `.d.ts` 的问题）
8. 重启服务：`systemctl restart planning-api`
9. 健康检查：`curl -s http://127.0.0.1:3001/api/v1/health` → ok

### 服务器部署后验证

- `PATCH /api/v1/users/me/preferences` 支持嵌套结构体：`availableTime.monday`、`energyCurve.0`、`notificationSetting.doNotDisturbStart` / `doNotDisturbEnd` / `weekendOff` / `reminderMinutesBefore`。
- `GET /api/v1/users/me` 正确返回保存后的偏好。
- `GET /api/v1/ai/templates/recommend?input=考研英语单词` 返回 `postgraduate-english` 模板，同义词匹配生效。

### 踩坑记录

- `nest build` 在已有 `dist/` 和 `tsconfig.tsbuildinfo` 时只生成 `.d.ts`，需删除后重新构建。
- `tar` 上传前需排除 `node_modules` / `.git` / `dist` / `build`，否则包体过大且可能覆盖服务器已编译产物。
- 备份目录 `/opt/planning-app-backup-week20` 保留，便于回滚。


---

## 13. 2026-08-13 Week 21 部署记录

### 部署内容

- 后端：数据库索引优化、AIOperation 自动清理、AIDailyCostSummary 模型、报表 Redis 缓存与失效、缓存失效事件总线。
- 服务器：Nginx 日志轮转配置、数据库备份脚本增强、远程 OSS/S3 上传占位脚本。
- Flutter：iOS 平台目录与通知配置、本地通知点击跳转、Android 精确闹钟权限引导、报表页 `fl_chart` 柱状图。

### 本地验证

- `npm run test`：19 suites / 85 tests 全部通过。
- `npm run lint`：通过。
- `npm run build`：通过。
- `flutter analyze`：No issues found。

### 服务器部署步骤

1. 本地打包（排除 `node_modules` / `.git` / `dist` / `build` / `tools/flutter`）：
   `tar --exclude=node_modules --exclude=.git --exclude=dist --exclude=build --exclude=tools/flutter -czf planning-app-week21.tar.gz planning-app`
2. 上传到服务器：`scp planning-app-week21.tar.gz root@xutaostudy.xyz:/tmp/`
3. 服务器备份当前代码：`cp -a /opt/planning-app /opt/planning-app-backup-week21`
4. 解压覆盖，保留 `/opt/planning-app/.env`
5. 安装依赖：`npm install`
6. 生成 Prisma Client：`npx prisma generate`
7. 应用迁移（需先 `source /opt/planning-app/.env`）：`npx prisma migrate deploy`
8. 构建：删除 `dist/` 与 `tsconfig.tsbuildinfo` 后 `npm run build`
9. 重启服务：`systemctl restart planning-api`
10. 健康检查：`curl -s http://127.0.0.1:3001/api/v1/health` → ok

### 服务器部署后验证

- `GET /api/v1/health` 正常。
- Prisma 迁移 `20260813190000_add_performance_indexes_and_ai_summary` 已应用，`ai_daily_cost_summaries` 表已创建。
- 报表接口首次调用写入 Redis，二次调用命中缓存；创建任务后缓存被清除。
- 数据库备份脚本 `/opt/backups/backup-planning-db.sh` 手动执行成功，生成 `planning_app_20260813_193054.dump`（84KB）。
- Nginx 日志轮转配置 `/etc/logrotate.d/nginx-planning` 通过 `logrotate -d` 验证。

### 踩坑记录

- `npx prisma migrate deploy` 不会自动加载 `/opt/planning-app/.env`，需先 `source` 该文件或显式导出 `DATABASE_URL`。
- `tar` 必须排除 `tools/flutter`（约 1.4GB），否则上传和解压极慢。
- `nest build` 在已有 `dist/` 和 `tsconfig.tsbuildinfo` 时只生成 `.d.ts`，需删除后重新构建。

---

## 14. 2026-08-13 Week 24 部署记录

### 部署内容

- 后端：SSE 流式计划生成、用户画像快照表与自动刷新 cron、模板推荐历史权重。
- Flutter：AI 计划草案页流式生成与阶段进度、AI 洞察页刷新时间与手动刷新。

### 本地验证

- `npm run test`：19 suites / 92 tests 全部通过。
- `npm run lint`：通过。
- `npm run build`：通过。
- `flutter analyze`：No issues found。

### 服务器部署步骤

1. 本地打包（排除 `node_modules` / `.git` / `dist` / `build` / `tools/flutter`）：
   `tar --exclude=node_modules --exclude=.git --exclude=dist --exclude=build --exclude=tools/flutter -czf planning-app-week24.tar.gz planning-app`
2. 上传到服务器：`scp planning-app-week24.tar.gz root@xutaostudy.xyz:/tmp/`
3. 服务器备份当前代码：`cp -a /opt/planning-app /opt/planning-app-backup-week24`
4. 解压覆盖，保留 `/opt/planning-app/.env`
5. 安装依赖：`npm install`
6. 生成 Prisma Client：`npx prisma generate`
7. 应用迁移（需先 `set -a && source /opt/planning-app/.env && set +a`）：`npx prisma migrate deploy`
8. 构建：删除 `dist/` 与 `tsconfig.tsbuildinfo` 后 `npm run build`
9. 重启服务：`systemctl restart planning-api`
10. 健康检查：`curl -s http://127.0.0.1:3001/api/v1/health` → ok
11. Nginx 检查：`/etc/nginx/sites-enabled/xutaostudy.xyz` 已包含 `proxy_buffering off; proxy_cache off; proxy_read_timeout 300s;`

### 服务器部署后验证

- 部署时间：2026-08-13 20:45 CST。
- `GET https://xutaostudy.xyz/api/v1/health` → `{"status":"ok","service":"planning-app-api","version":"0.0.1"}`。
- `POST /api/v1/ai/plan-drafts/stream` 返回 `{ draftId, status: "pending" }`。
- `GET /api/v1/ai/plan-drafts/:draftId/stream`（SSE）依次收到 `progress`（analyzing_input / selecting_template / generating_plan / validating_plan）→ `draft`（完整 90 天四级计划）→ `done`。
- Nginx 反向代理下 SSE 事件实时到达，无缓冲延迟。
- `GET /api/v1/ai/profile-summary?useSnapshot=true` 返回包含 `refreshedAt` 的画像摘要。
- `GET /api/v1/ai/templates/recommend?input=我想减肥` 返回 `fat-loss` 模板。
- Prisma 迁移 `20260813200000_add_user_profile_snapshot` 已应用。

### 踩坑记录

- `npx prisma migrate deploy` 不会自动加载 `.env`，需 `set -a && source /opt/planning-app/.env && set +a`。
- `nest build` 在已有 `dist/` 和 `tsconfig.tsbuildinfo` 时只生成 `.d.ts`，需删除后重新构建。
- SSE 在 Nginx 默认配置下会被缓冲，需显式关闭 `proxy_buffering` 与 `proxy_cache`。
- `streamDraft` 使用 `Observable` + async generator，测试时需通过 `subscribe` 收集事件，不可用 `await observable.toPromise()`。
- 新增 `UserProfileSnapshot` 表后，旧代码中的 `snapshot.summary as UserProfileSummary` 需先转 `unknown` 再 cast，否则 TypeScript 报错。

---

## 15. 2026-08-13 Week 25 外部集成深化

### 本次完成内容

- **后端**
  - Prisma schema 新增 `CalendarSubscription` 模型，反向关联 `User`。
  - 新增并应用迁移 `20260816000000_add_calendar_subscription`。
  - 新增依赖 `googleapis`、`@azure/msal-node`。
  - 新增 `CalendarOAuthService`：Google OAuth URL 生成/回调、token AES 加密、主日历事件导入。
  - 新增 `CalendarSyncService`：ICS/Google/Outlook 来源分发同步，每 6 小时 cron 串行轮询。
  - `CalendarController` 新增订阅 CRUD、手动同步、Google/Outlook OAuth 路由与回调页。
  - `CalendarService` 新增订阅管理，`importIcs` 增加可选 `source` 参数。
  - 新增测试：`calendar-oauth.service.spec.ts`、`calendar-sync.service.spec.ts`。
- **Flutter**
  - 新增依赖 `health: ^12.2.1`、`url_launcher: ^6.3.2`。
  - `ExternalApi` 新增 `syncHealthConnect()`，读取 workouts 并调用 `/external/fitness-import`。
  - `FitnessImportScreen` 新增「从 Health Connect 同步」按钮。
  - `CalendarNotifier` 新增订阅管理、Google OAuth 外部浏览器打开。
  - `CalendarScreen` 新增「管理外部日历订阅」弹窗。
- **配置**
  - `services/api/.env.example` 新增 Google/Outlook OAuth 与 `OAUTH_ENCRYPTION_KEY` 配置项。

### 本地验证

- `npm run test`：21 suites / 99 tests 全部通过。
- `npm run lint`：通过。
- `npm run build`：通过。
- `flutter analyze`：No issues found。

### 新增/修改关键文件

- 后端：
  - `planning-app/services/api/prisma/schema.prisma`
  - `planning-app/services/api/prisma/migrations/20260816000000_add_calendar_subscription/migration.sql`
  - `planning-app/services/api/src/modules/calendar/calendar-oauth.service.ts`
  - `planning-app/services/api/src/modules/calendar/calendar-sync.service.ts`
  - `planning-app/services/api/src/modules/calendar/calendar.service.ts`
  - `planning-app/services/api/src/modules/calendar/calendar.controller.ts`
  - `planning-app/services/api/src/modules/calendar/calendar.module.ts`
  - `planning-app/services/api/src/modules/calendar/dto/create-calendar-subscription.dto.ts`
  - `planning-app/services/api/src/modules/calendar/calendar-oauth.service.spec.ts`
  - `planning-app/services/api/src/modules/calendar/calendar-sync.service.spec.ts`
  - `planning-app/services/api/package.json`
  - `planning-app/services/api/.env.example`
- Flutter：
  - `planning-app/apps/mobile/pubspec.yaml`
  - `planning-app/apps/mobile/lib/providers/external_provider.dart`
  - `planning-app/apps/mobile/lib/screens/fitness_import_screen.dart`
  - `planning-app/apps/mobile/lib/providers/calendar_provider.dart`
  - `planning-app/apps/mobile/lib/screens/calendar_screen.dart`
- 文档：
  - `decisions/2026-08-13-Week25外部集成深化决策.md`
  - `项目交接文档.md`
  - `planning-app/docs/development-log.md`

### 服务器部署状态（2026-08-13 22:35 CST）

- 已上传 `planning-app-week25.tar.gz` 到 `/tmp/`。
- 发现此前 tar 解压路径问题：`tar -xzf` 默认会创建 `/opt/planning-app/planning-app/` 嵌套目录；已改用 `--strip-components=1` 正确解压。
- `npm install` 成功安装新增依赖（`googleapis`、`@azure/msal-node`）。
- `npx prisma migrate deploy` 成功应用迁移 `20260816000000_add_calendar_subscription`。
- 由于服务器 `nest build` 会压死单核 ECS 导致 SSH 无响应，改为**本地构建后上传 `dist/`**：
  - 本地删除 `dist/` 与 `tsconfig.tsbuildinfo` 后 `npm run build`。
  - 打包 `planning-app/services/api/dist` 为 `api-dist-week25.tar.gz` 上传到 `/tmp/`。
  - 服务器停止 `planning-api`，清空 `dist/`，解压上传的构建产物，重启服务。
- `/opt/planning-app/.env` 已追加 Google/Outlook OAuth 与 `OAUTH_ENCRYPTION_KEY` 配置项（当前为空，由 `JWT_SECRET` 回退）。
- `systemctl restart planning-api` 后服务状态 `active (running)`。

### 服务器部署步骤（待执行）

1. 本地打包（排除 `node_modules` / `.git` / `dist` / `build` / `tools/flutter`）：
   `tar --exclude=node_modules --exclude=.git --exclude=dist --exclude=build --exclude=tools/flutter -czf planning-app-week25.tar.gz planning-app`
2. 上传到服务器：`scp planning-app-week25.tar.gz root@xutaostudy.xyz:/tmp/`
3. 服务器备份当前代码：`cp -a /opt/planning-app /opt/planning-app-backup-week25`
4. 解压覆盖，保留 `/opt/planning-app/.env`
5. 安装依赖：`npm install`
6. 生成 Prisma Client：`npx prisma generate`
7. 应用迁移（需先 `set -a && source /opt/planning-app/.env && set +a`）：`npx prisma migrate deploy`
8. 构建：删除 `dist/` 与 `tsconfig.tsbuildinfo` 后 `npm run build`
9. 在 `.env` 中配置 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`GOOGLE_REDIRECT_URI`（可选）
10. 重启服务：`systemctl restart planning-api`
11. 健康检查：`curl -s http://127.0.0.1:3001/api/v1/health` → ok

### 部署后验证

- `GET https://xutaostudy.xyz/api/v1/health` → `{"status":"ok","service":"planning-app-api","version":"0.0.1"}` ✅
- `GET https://xutaostudy.xyz/api/v1/calendar/subscriptions` → `401 Unauthorized`（路由已注册，需 JWT）✅
- 数据库 `calendar_subscriptions` 表已创建 ✅
- `systemctl status planning-api` → `active (running)` ✅
- 日志确认新增路由已映射：`/api/calendar/subscriptions`、`/api/calendar/oauth/google` 等 ✅
- 配置 Google OAuth 后，浏览器访问授权链接跳转 Google 授权页；回调后 DB 出现 subscription 并自动导入事件
- Flutter 端「从 Health Connect 同步」按钮在 Android 真机/模拟器上读取运动记录（需安装 Health Connect）

### 踩坑记录

- `npx prisma migrate deploy` 不会自动加载 `.env`，需 `set -a && source /opt/planning-app/.env && set +a`。
- `nest build` 在已有 `dist/` 和 `tsconfig.tsbuildinfo` 时可能只生成 `.d.ts`，需删除后重新构建。
- Google OAuth 首次授权必须设置 `prompt: 'consent'` 才能拿到 `refresh_token`。
- Health Connect 在国内部分 Android 设备需手动安装 Google Health Connect 应用。
- Flutter `health` 包的 `uuid` 字段为非空，无需 null-aware 表达式。

### 环境信息补充

- **本地 Flutter**：`C:/Users/Administrator/flutter`（需在 shell 中使用绝对路径调用，未加入 PATH）。
- **本地无数据库**，`prisma migrate dev` 必须在服务器执行。
- **服务器数据库**：PostgreSQL 15 运行中，当前已应用迁移至 `20260816000000_add_calendar_subscription`。
- **服务器构建方式**：当前 ECS 单核 `nest build` 会压死 SSH，改为本地构建后上传 `dist/`。


---

## 16. 2026-08-14 Week 27 部署记录

### 部署内容

- 后端：FCM 真实推送（`fcm.service.ts`、`POST /users/me/fcm-token`）、Prometheus 指标 `/metrics`、用户行为埋点 `UserEvent` 落库、`AISession`/`AIMessage` 多轮对话上下文。
- Flutter：FCM 服务初始化与 Token 上传、AI 计划页「继续对话」、Inbox/Calendar 本地优先离线同步、日历订阅自动刷新、SyncEngine 失败重试。

### 本地验证

- `npm run test`：21 suites / 99 tests 全部通过。
- `npm run lint`：通过。
- `npm run build`：通过。
- `flutter analyze`：No issues found。

### 服务器部署步骤

1. 本地打包（排除 `node_modules` / `.git` / `dist` / `build` / `tools/flutter`）：
   `tar --exclude=node_modules --exclude=.git --exclude=dist --exclude=build --exclude=tools/flutter -czf planning-app-week27.tar.gz planning-app`
2. 上传到服务器：`scp planning-app-week27.tar.gz root@xutaostudy.xyz:/tmp/`
3. 服务器备份当前代码：`cp -r /opt/planning-app /opt/planning-app-backup-week21`
4. 解压覆盖，保留 `/opt/planning-app/.env`：
   ```bash
   cp /opt/planning-app/.env /opt/planning-app/.env.week21-backup
   cd /opt/planning-app && tar -xzf /tmp/planning-app-week27.tar.gz --overwrite
   cp /opt/planning-app/.env.week21-backup /opt/planning-app/.env
   ```
5. 安装依赖：`cd /opt/planning-app/services/api && npm install`
6. 处理旧 `.env` 冲突：重命名 `/opt/planning-app/services/api/.env` 为 `.env.template.bak`，避免 Prisma CLI 读取错误的数据库密码。
7. 生成并应用迁移：
   ```bash
   cd /opt/planning-app
   export DATABASE_URL=$(grep DATABASE_URL .env | cut -d= -f2-)
   MIGRATION_DIR=services/api/prisma/migrations/20260814180100_add_fcm_and_ai_message
   mkdir -p "$MIGRATION_DIR"
   npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel services/api/prisma/schema.prisma --script > "$MIGRATION_DIR/migration.sql"
   npx prisma migrate deploy --schema services/api/prisma/schema.prisma
   npx prisma generate --schema services/api/prisma/schema.prisma
   ```
8. 构建：由于服务器单核 ECS 直接 `nest build` 会压死 SSH，改为**本地构建后上传 `dist/`**：
   ```bash
   # 本地
   cd planning-app/services/api
   rm -rf dist tsconfig.tsbuildinfo
   npm run build
   tar -czf /tmp/api-dist-week27.tar.gz dist
   scp /tmp/api-dist-week27.tar.gz root@xutaostudy.xyz:/tmp/
   ```
9. 服务器替换 `dist/` 并重启服务：
   ```bash
   cd /opt/planning-app/services/api
   rm -rf dist
   tar -xzf /tmp/api-dist-week27.tar.gz
   systemctl restart planning-api.service
   ```
10. 健康检查：`curl -s http://127.0.0.1:3001/api/v1/health` → ok

### 服务器部署后验证

- 部署时间：2026-08-14 18:22 CST。
- `GET https://xutaostudy.xyz/api/v1/health` → `{"status":"ok","service":"planning-app-api","version":"0.0.1"}` ✅
- `GET https://xutaostudy.xyz/api/v1/metrics` → Prometheus 指标正常 ✅
- `POST https://xutaostudy.xyz/api/v1/users/me/fcm-token` → `401 Unauthorized`（路由已注册）✅
- `POST https://xutaostudy.xyz/api/v1/analytics/events` → `401 Unauthorized`（路由已注册）✅
- `POST https://xutaostudy.xyz/api/v1/ai/plan-drafts/stream` → `401 Unauthorized`（路由已注册）✅
- `npx prisma migrate status` → `Database schema is up to date!` ✅
- `users.fcmToken` 字段已创建 ✅
- `ai_messages` 表已创建 ✅

### 踩坑记录

- 服务器 `/opt/planning-app/services/api/.env` 是旧模板文件，会导致 `npx prisma migrate dev` 读取错误的数据库密码；删除/重命名后统一使用 `/opt/planning-app/.env`。
- `npx prisma migrate deploy` 不会自动加载 `.env`，需先导出 `DATABASE_URL` 或在项目根目录执行。
- 服务器单核 ECS 直接 `nest build` 会压死 SSH 导致无响应，本次采用本地构建 `dist/` 后上传的方式。
- 服务器重启后发现 `dist/` 目录缺失，导致 `planning-api.service` 反复启动失败；需确保上传本地构建产物后再启动服务。
- `prisma migrate dev` 在非交互环境下不支持，使用 `prisma migrate diff` + `prisma migrate deploy` 组合完成迁移。


---



## 测试阶段文档已独立

测试阶段相关内容（安装包构建、测试方法、观察指标、Week 27 构建修复记录）已迁移至：

- [`docs/testing-phase.md`](./testing-phase.md)

本交接文档保留项目整体交接、环境、进度与部署记录。
