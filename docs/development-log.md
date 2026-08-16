# 开发日志

## Week 0：工程基建（2026-08-11）

### 目标

搭建可运行的 MVP 工程骨架，确定目录结构、技术栈、数据模型与 AI 服务分层，为后续业务迭代打下基础。

### 已完成工作

1. **Mono-repo 目录结构**
   - `apps/mobile`：Flutter 客户端。
   - `services/api`：NestJS 后端。
   - `packages/schema`：共享 Zod Schema。
   - 根目录配置 `package.json` workspaces、`docker-compose.yml`、`Makefile`、`.gitignore`。

2. **后端骨架（NestJS 10 + TypeScript）**
   - 全局模块：`PrismaModule`、`RedisModule`、结构化日志 `LoggerModule`（nestjs-pino）。
   - 业务模块占位：`auth`、`users`、`goals`、`projects`、`tasks`、`habits`、`checkins`、`reminders`、`reviews`、`ai`、`analytics`。
   - 健康检查接口 `/health` 与 Swagger 文档 `/docs`。

3. **数据模型（Prisma 5 + PostgreSQL）**
   - 实体：User、Goal、Milestone、Project、Task、Habit、GoalHabitLink、CalendarEvent、Checkin、Reminder、PlanVersion、AISession、AIOperation、Review、UserEvent。
   - 生成 Prisma Client 成功。

4. **AI 服务三层结构**
   - `ModelAdapter`：统一 OpenAI 结构化输出调用，内置限流、重试、token 与耗时记录。
   - `PlanOrchestrator`：模板匹配、提示词组装、JSON Schema 校验、占位草案生成。
   - `PlanExecutor`：计划确认事务落库接口占位。
   - SSE 流式草案接口 `/api/v1/ai/plan-drafts/:id/stream`。

5. **Flutter 客户端骨架**
   - 依赖：`http`、`flutter_riverpod`、`shared_preferences`、`intl`、`logger`。
   - 5 个核心页面占位：今日、目标、任务、习惯、AI 计划草案、复盘。
   - API 客户端与任务模型骨架。

6. **共享 Schema 包**
   - Zod schema：`PlanDraftSchema`、`GoalSchema`、`TaskSchema`、`HabitSchema`、`UserPreferencesSchema`、`CheckinSchema`。

7. **部署与运维配置**
   - `docker-compose.yml`：Postgres 15 + Redis 7 + API。
   - `services/api/Dockerfile`：多阶段构建。
   - `Makefile`：常用命令封装。

8. **文档**
   - `README.md`：快速开始、命令、模块说明。
   - `decisions/2026-08-11-开始Week0基建决策.md`：用户决策记录。
   - `docs/errors.md`：Prisma 关系字段缺失问题的记录与改正。

### 验证结果

- `npm install`：成功
- `npm run build:schema`：成功
- `npm run prisma:generate -w services/api`：成功
- `npm run build -w services/api`：成功
- `npm run test -w services/api`：通过（1 个测试）
- `npm run lint -w services/api`：通过

### 环境状态

- Node.js v24.16.0 / npm 11.13.0：已安装。
- Flutter：未安装，计划通过便携包安装到 `tools/flutter`。
- Docker：未安装，属于系统级软件，需用户单独安装或使用已有服务器。

### 进入下一步

Week 1：用户注册/登录、目标 CRUD、里程碑与进度计算。


## Week 1：用户认证与目标 CRUD（2026-08-11）

### 目标

实现用户注册/登录、JWT 认证、用户偏好设置，以及目标与里程碑的 CRUD 和进度重算。

### 已完成工作

1. **用户认证**
   - `AuthModule` 实现注册、登录、refresh token 轮换。
   - 使用 bcrypt 对密码与 refresh token 哈希存储。
   - JWT 策略 + `JwtAuthGuard`，全局默认需要认证，`@Public()` 放行登录相关接口。
   - `CurrentUser` 装饰器从 JWT payload 提取当前用户。

2. **用户偏好设置**
   - `GET /users/me`：返回当前用户资料与偏好。
   - `PATCH /users/me/preferences`：更新时区、可用时间、精力曲线、通知设置。

3. **目标与里程碑 CRUD**
   - `POST /goals`：创建目标，可同时创建里程碑。
   - `GET /goals/:id`：查询目标详情（含里程碑、子目标、项目与任务）。
   - `PATCH /goals/:id`：更新目标。
   - `DELETE /goals/:id`：删除目标。

4. **目标进度重算**
   - `POST /goals/:id/recalculate`：按里程碑权重与任务权重计算完成度。
   - 里程碑进度 = 已完成任务的权重和 / 任务权重总和。
   - 目标进度 = Σ（里程碑进度 × 里程碑权重）。
   - 当目标进度达到 100% 时自动标记 `completed`。

5. **Schema 变更**
   - `User` 新增 `refreshToken` 字段。
   - `Task` 新增 `weight` 字段。
   - 文档记录于 `docs/schema-changes.md`。

6. **文档**
   - `docs/api.md`：汇总当前 API 端点。
   - `docs/schema-changes.md`：记录 Schema 变更与迁移方式。
   - `docs/errors.md`：补充 Flutter 安装失败与 Docker 未安装的记录。

### 验证结果

- `npm run build -w services/api`：成功
- `npm run lint -w services/api`：成功
- `npm run test -w services/api`：通过（3 个测试套件，8 个测试）

### 新增测试覆盖

- `AppController`：健康检查。
- `AuthService`：注册、登录、refresh token 轮换。
- `GoalsService`：创建目标、进度重算。

### 环境状态

- Flutter：安装失败（GitHub 网络重置），仍需用户手动安装。
- Docker：未安装；当前测试通过 mock PrismaClient 完成，不依赖真实数据库。

### 进入下一步

Week 2：项目、任务与习惯模块 CRUD，今日任务列表与习惯打卡。


## Week 2：项目、任务与习惯 CRUD，今日任务与习惯打卡（2026-08-11）

### 目标

实现项目、任务、习惯的完整 CRUD，以及任务完成/延期、习惯打卡、今日任务列表查询。

### 已完成工作

1. **Projects 模块**
   - DTO：`CreateProjectDto`、`UpdateProjectDto`。
   - API：`POST /projects`、`GET /projects`、`GET /projects/:id`、`PATCH /projects/:id`、`DELETE /projects/:id`。
   - 支持可选关联目标 `goalId`，并校验目标归属当前用户。

2. **Tasks 模块**
   - DTO：`CreateTaskDto`、`UpdateTaskDto`、`CompleteTaskDto`、`PostponeTaskDto`。
   - API：`POST /tasks`、`GET /tasks?date=`、`GET /tasks/:id`、`PATCH /tasks/:id`、`DELETE /tasks/:id`、`POST /tasks/:id/complete`、`POST /tasks/:id/postpone`。
   - `GET /tasks?date=YYYY-MM-DD` 实现今日任务列表。
   - `complete` 会更新任务状态并写入 `Checkin` 记录。
   - `postpone` 支持指定新日期，未指定则标记为 `postponed`。
   - 校验 `projectId`、`milestoneId` 归属当前用户。

3. **Habits 模块**
   - DTO：`CreateHabitDto`、`UpdateHabitDto`、`HabitCheckinDto`。
   - API：`POST /habits`、`GET /habits`、`GET /habits/:id`、`PATCH /habits/:id`、`DELETE /habits/:id`、`POST /habits/:id/checkin`。
   - 支持可选关联多个目标 `goalIds`。
   - `checkin` 写入 `Checkin` 记录，`result` 支持 completed / partial / skipped / makeup。

4. **调试日志**
   - 所有服务方法添加 `logger.debug`，记录操作类型、资源 ID 与当前用户。

5. **测试**
   - 新增 `ProjectsService`、`TasksService`、`HabitsService` 单元测试。
   - 使用 PrismaClient mock，覆盖创建、查询、完成任务、习惯打卡等场景。

6. **文档**
   - 更新 `docs/api.md`，补充项目、任务、习惯端点。

7. **工具配置修复**
   - 新增 `tsconfig.eslint.json`，将 `test/` 目录纳入 ESLint 类型检查，解决 `test/app.e2e-spec.ts` 不在 `tsconfig.json` include 范围内的问题。
   - 更新 `.eslintrc.js` 指向新的 tsconfig。

### 验证结果

- `npm run build -w services/api`：成功
- `npm run lint -w services/api`：通过
- `npm run test -w services/api`：6 个测试套件，17 个测试全部通过

### 部署验证

- 重新上传并编译服务器代码：`npx tsc -p tsconfig.json` 成功。
- 本次无 schema 变更，未新建迁移，沿用 Week 1 迁移。
- 通过 `screen` 重启 `npm run start:prod`，端口 3001 正常监听。
- curl 验证全部通过：
  - 登录获取 token
  - `POST /projects` 创建项目
  - `POST /goals` 创建目标与里程碑
  - `POST /tasks` 创建任务（关联项目/里程碑/日期）
  - `GET /tasks?date=2026-08-11` 查询今日任务
  - `POST /tasks/:id/complete` 完成任务并生成打卡记录
  - `POST /habits` 创建习惯（关联目标）
  - `POST /habits/:id/checkin` 习惯打卡
  - `GET /projects`、`GET /habits` 列表查询

### 进入下一步

Week 3：提醒、复盘与 AI 计划草案接口落地。


## Week 3：提醒、复盘与 AI 计划草案接口落地（2026-08-11）

### 目标

实现提醒、复盘的完整 CRUD，以及 AI 计划草案的持久化、查询与确认落库。

### 已完成工作

1. **Reminders 模块**
   - DTO：`CreateReminderDto`、`UpdateReminderDto`。
   - API：`POST /reminders`、`GET /reminders`、`GET /reminders/:id`、`GET /reminders/upcoming`、`PATCH /reminders/:id`、`DELETE /reminders/:id`。
   - 支持目标类型 `goal` / `task` / `habit`，创建时校验目标归属当前用户。
   - `upcoming` 查询已到期的待处理提醒。

2. **Reviews 模块**
   - DTO：`CreateReviewDto`。
   - API：`POST /reviews`、`GET /reviews?goalId=`、`GET /reviews/:id`。
   - `Review` 模型新增 `goalId` 字段，支持按目标过滤复盘。

3. **AI 计划草案**
   - `POST /ai/plan-drafts`：调用编排层生成草案，持久化到 `PlanVersion`。
   - `GET /ai/plan-drafts/:id`：查询已保存草案。
   - `POST /ai/plan-drafts/:id/approve`：用户确认后，通过 `PlanExecutor` 事务写入 Goal / Milestone / Project / Task / Habit。
   - `GET /ai/plan-drafts/:id/stream`：SSE 流式接口占位。
   - `POST /ai/replan`、`POST /ai/review`：占位实现，返回基础统计信息。
   - 若未配置模型 API Key 或模型调用失败，自动降级为占位草案，不影响持久化与落库流程。

4. **调试日志**
   - `RemindersService`、`ReviewsService`、`AiService`、`PlanExecutor` 均添加 `logger.debug`。

5. **Schema 变更**
   - `Review` 模型新增 `goalId` 与 `goal` 关联。
   - `Goal` 模型新增 `reviews` 反向关联。
   - `PlanVersion` 模型的 `goalId` 改为可选。
   - 新增 Prisma 迁移：
     - `20260811135523_add_review_goal_id`
     - `20260811135920_make_plan_version_goal_optional`

6. **问题修复**
   - `RemindersController` 中 `@Get(":id")` 注册在 `@Get("upcoming")` 之前，导致 `/reminders/upcoming` 被当作 ID 查询。已调整顺序，静态路由优先注册。

7. **测试**
   - 新增 `RemindersService`、`ReviewsService`、`AiService` 单元测试。
   - 使用 PrismaClient mock 与 orchestrator/executor mock，覆盖草案创建、确认、复盘查询等场景。

7. **文档**
   - 更新 `docs/api.md`，补充提醒、复盘、AI 计划端点。
   - 更新 `docs/schema-changes.md`，记录 `Review.goalId` 变更。

### 验证结果

- `npm run build -w services/api`：成功
- `npm run lint -w services/api`：通过
- `npm run test -w services/api`：9 个测试套件，24 个测试全部通过

### 部署验证

- 重新上传并编译服务器代码：`npx tsc -p tsconfig.json` 成功。
- 新建并应用 Prisma 迁移：
  - `20260811135523_add_review_goal_id`
  - `20260811135920_make_plan_version_goal_optional`
- 通过 `screen` 重启 `npm run start:prod`，端口 3001 正常监听。
- curl 验证全部通过：
  - 登录获取 token
  - `POST /reminders` 创建提醒
  - `GET /reminders/upcoming` 查询到期提醒
  - `POST /reviews` 创建复盘
  - `GET /reviews?goalId=` 查询复盘列表
  - `POST /ai/plan-drafts` 创建计划草案
  - `GET /ai/plan-drafts/:id` 获取草案
  - `POST /ai/plan-drafts/:id/approve` 确认草案并落库 Goal/Project/Task/Habit

### 进入下一步

Week 4：Flutter 客户端 MVP 页面开发，同时制定离线同步、多端一致性、外部集成架构。


## Week 4：Flutter MVP 页面与后续架构设计（2026-08-11）

### 目标

实现 Flutter 客户端 5 个核心 MVP 页面，对接 Week 3 部署的真实后端，形成可演示的端到端闭环；同时产出离线同步、多端一致性、外部集成的架构文档。

### 已完成工作

1. **API 客户端升级**
   - `ApiClient` 新增 JWT Token 读写（`SharedPreferences`）、统一请求头、POST/PATCH/DELETE 方法。
   - Base URL 指向已部署后端 `http://xutaostudy.xyz:3001/api/v1`。

2. **状态管理（flutter_riverpod）**
   - `authProvider`：登录/登出。
   - `goalsProvider`：目标列表、创建目标。
   - `tasksProvider`：按日期/全部查询任务、创建任务、完成任务。
   - `habitsProvider`：习惯列表、创建习惯、习惯打卡。
   - `aiDraftProvider`：生成计划草案、确认落库。

3. **模型**
   - `GoalModel`、`TaskModel`、`HabitModel`，含 `fromJson` 工厂方法。

4. **页面**
   - `LoginScreen`：默认测试账号登录。
   - `MainScreen`：底部导航，5 个 Tab。
   - `TodayScreen`：展示今日任务与习惯，支持完成任务、习惯打卡、下拉刷新。
   - `GoalScreen`：目标列表 + 创建目标弹窗。
   - `TaskScreen`：任务列表 + 创建任务 + 完成任务。
   - `HabitScreen`：习惯列表 + 创建习惯 + 习惯打卡。
   - `AiPlanDraftScreen`：输入目标描述、生成草案、确认落库。

5. **后端小调整**
   - 新增 `GET /goals` 列表接口，供 Flutter 目标页使用。
   - 新增 `GoalsService.findAll` 与对应测试。

6. **架构设计文档**
   - `docs/architecture/offline-sync.md`：本地优先、操作队列、临时 ID 映射、冲突处理。
   - `docs/architecture/multi-device-sync.md`：SSE/WebSocket 选型、`SyncEvent` 事件模型、版本冲突解决。
   - `docs/architecture/external-integrations.md`：日历、邮件、推送、运动设备、第三方 LLM 的 Provider Adapter 与 webhook 聚合设计。

7. **明确不做**
   - 不实现完整离线同步逻辑。
   - 不实现多端实时同步。
   - 不对接外部日历/邮件/推送服务。

### 验证结果

- `npm run build -w services/api`：成功
- `npm run lint -w services/api`：通过
- `npm run test -w services/api`：9 个测试套件，25 个测试全部通过
- `flutter pub get`：成功
- `flutter analyze`：No issues found

### 部署验证

- 后端代码上传并重新编译，新增 `GET /goals` 可用。
- API 服务在 `xutaostudy.xyz:3001` 正常运行。

### 进入下一步

Week 5：选择以下一个方向深耕：
1. 接入 `sqflite`/`hive` 实现离线同步 MVP。
2. 接入 WebSocket/socket.io 实现多端实时同步 MVP。
3. 接入 FCM 推送与系统日历读取。
4. 接入真实 AI 模型供应商并优化提示词。


## Week 5：离线同步 MVP + 多端实时同步（2026-08-12）

### 目标

同时落地离线同步与多端实时同步两个方向：Flutter 端在无网环境下可创建/完成任务、习惯打卡，联网后自动同步；服务端通过 WebSocket 向同一用户所有设备广播变更事件。

### 已完成工作

1. **后端：SyncEvent 事件模型**
   - Prisma Schema 新增 `SyncEvent` 表：`id/userId/eventType/targetType/targetId/payload/deviceId/serverTimestamp`。
   - 补全 `User.syncEvents` 反向关联。
   - 生成并应用迁移 `20260812072438_add_sync_event`。

2. **后端：同步事件 REST API**
   - `GET /sync/events`：查询当前用户全部同步事件。
   - `GET /sync/events?after=ISO8601`：按 `serverTimestamp` 过滤增量事件。

3. **后端：WebSocket 实时广播**
   - 新增 `SyncModule`：含 `SyncEventsService`、`SyncEventsGateway`、`SyncEventsController`。
   - WebSocket namespace `/sync`，支持 `auth` 消息与 handshake `token` query 自动鉴权。
   - 鉴权成功后加入 `user:{id}` 房间。
   - `TasksService` / `HabitsService` / `GoalsService` 在创建/完成/打卡后调用 `SyncEventsService.createEvent` 持久化并广播。
   - 已覆盖事件类型：`task.created`、`task.completed`、`habit.created`、`habit.checkin`、`goal.created`。

4. **后端：测试**
   - 新增 `sync-events.gateway.spec.ts`，覆盖 `auth` 成功/失败、handshake query 自动鉴权、广播到房间。
   - 更新 `tasks.service.spec.ts` / `habits.service.spec.ts` / `goals.service.spec.ts`，补充 `SyncEventsService` mock。
   - 后端 `npm run test`：10 个测试套件，30 个测试全部通过。
   - 后端 `npm run lint` 与 `npm run build` 通过。

5. **Flutter：本地数据库与操作队列**
   - `pubspec.yaml` 新增 `sqflite`、`path`、`socket_io_client`、`uuid`。
   - `lib/services/local_database.dart`：SQLite 建表 `goals` / `tasks` / `habits` / `operations` / `sync_meta`。
   - 本地优先读取，服务端返回后覆盖更新本地缓存。

6. **Flutter：同步引擎**
   - `lib/services/sync_engine.dart`：连接 WebSocket、按 `userId` 房间监听事件、定期拉取 `/sync/events`、处理 `operations` 操作队列。
   - 离线写操作：创建任务、完成任务、习惯打卡先写入本地 DB 与操作队列，再尝试立即提交。

7. **Flutter：Providers 接入同步**
   - `auth_provider.dart`：登录后初始化 `SyncEngine`。
   - `task_provider.dart`：本地缓存 + 离线创建/完成 + 监听 `task.*` 事件刷新。
   - `habit_provider.dart`：本地缓存 + 离线打卡 + 监听 `habit.*` 事件刷新。
   - `goal_provider.dart`：本地缓存 + 在线创建 + 监听 `goal.created` 刷新。

8. **本地 Flutter 部署**
   - 从腾讯镜像下载 Flutter 3.44.9 预编译 zip 并解压到 `C:/Users/Administrator/flutter`。
   - 使用腾讯镜像环境变量 `PUB_HOSTED_URL` / `FLUTTER_STORAGE_BASE_URL` 成功执行 `flutter pub get`。
   - `flutter analyze`：No issues found。
   - 修复两处编译问题：`auth_provider.dart` 相对导入路径、`habit_provider.dart` 移除未使用的 `uuid` 导入。

9. **服务器部署与验证**
   - 上传代码到 `/opt/planning-app`，执行 `npm install`。
   - 执行 `prisma generate` 与 `prisma migrate dev --name add_sync_event` 应用新表。
   - 修复服务器构建问题：删除 `dist/` 与 `tsconfig.tsbuildinfo` 后重新 `npm run build`，解决仅生成 `.d.ts` 的问题。
   - 使用 `nohup` 启动 `npm run start:prod`，监听 `0.0.0.0:3001`。
   - 验证结果：
     - `GET /api/v1/health`：返回 `{"status":"ok"}`。
     - `GET /api/v1/sync/events`：返回同步事件列表。
     - WebSocket 连接 `ws://xutaostudy.xyz:3001/sync` 并携带 token，收到 `auth_ok`。
     - 创建任务后，WebSocket 客户端收到 `task.created` 事件；`GET /sync/events` 同步返回该事件。
     - 创建目标/习惯后，对应 `goal.created` / `habit.created` 事件入库。

### 验证结果

- 后端 `npm run build`：成功
- 后端 `npm run lint`：通过
- 后端 `npm run test`：10 个测试套件，30 个测试全部通过
- 后端 `prisma migrate deploy`：迁移 `20260812072438_add_sync_event` 已应用
- Flutter `flutter pub get`：成功
- Flutter `flutter analyze`：No issues found
- 服务器 API：端口 3001 正常监听，REST 与 WebSocket 验证通过

### 已知问题与遗留项

1. 服务器 API 使用 `nohup` 启动，建议后续改用 `systemd` 或 `pm2` 实现开机自启与崩溃重启。
2. 当前未配置 HTTPS / Nginx 反向代理，API 直接暴露于 3001 端口。
3. Flutter 端本地 DB 与同步引擎尚未写单元/Widget 测试。
4. 操作队列的临时 ID 映射、失败重试上限、离线创建目标/习惯等复杂场景留待后续迭代。

### 进入下一步

Week 6 候选方向：
1. 接入 FCM / 系统推送，完成提醒触达。
2. 接入真实 AI 模型供应商并优化计划生成提示词。
3. 实现任务延期/补打卡、习惯统计报表等增强执行功能。
4. 引入版本向量与冲突 UI，完善多端一致性。

---

## 运维补充：API 使用 systemd 托管（2026-08-12）

已将 `nohup` 启动的 API 进程迁移为 `systemd` 服务：

- 服务文件：`/etc/systemd/system/planning-api.service`
- 工作目录：`/opt/planning-app`
- 启动命令：`/usr/bin/npm run -w services/api start:prod`
- 自动重启：`Restart=always`，崩溃/退出后 5 秒重启
- 开机自启：`systemctl enable planning-api`

常用命令：

```bash
systemctl status planning-api
systemctl restart planning-api
systemctl stop planning-api
journalctl -u planning-api -f
```

验证：
- `systemctl status planning-api`：`active (running)`
- `ss -tlnp | grep 3001`：端口正常监听
- `curl http://xutaostudy.xyz:3001/api/v1/health`：返回 `{"status":"ok"}`

---

## Week 6：增强执行闭环（方案 A）

### 目标

在不依赖外部 API（FCM / 真实 AI 模型）的前提下，强化任务执行与习惯追踪的闭环体验：

- 支持任务延期与补打卡。
- 提供习惯统计报表（热力图、连续天数、完成率）。
- 今日页展示今日完成率小卡片。
- 多端同步新增 `task.postponed` / `task.madeup` 事件。

### 已完成工作

1. **后端：任务延期与补打卡**
   - 扩展 `POST /tasks/:id/postpone`：接收 `newScheduledDate` 与 `reason`，将原任务标记为 `skipped`，并可选重新排期；创建 `skipped` 打卡记录；广播 `task.postponed` 同步事件。
   - 新增 `POST /tasks/:id/makeup`：接收 `actualMinutes`、`qualityRating`、`note`，创建补打卡并将任务状态改为 `done`；广播 `task.madeup` 同步事件。
   - 新增 DTO：`PostponeTaskDto`、`MakeupTaskDto`。

2. **后端：习惯统计 API**
   - 新增 `GET /habits/:id/stats?days=`，返回：
     - `heatmap`：最近 N 天每日完成状态（`done` / `skipped` / `none`）。
     - `currentStreak`：当前连续完成天数。
     - `longestStreak`：最长连续完成天数。
     - `completionRate`：完成率。
     - `doneCount` / `skippedCount`：完成/跳过天数统计。
   - 统计直接由 `Checkin` 表推导，无需新增 schema。

3. **后端：同步事件扩展**
   - 新增事件类型：`task.postponed`、`task.madeup`。

4. **后端：测试**
   - `tasks.service.spec.ts`：补充 `postpone` 与 `makeup` 用例。
   - `habits.service.spec.ts`：补充 `stats` 用例。

5. **Flutter：任务延期/补打卡**
   - `TaskProvider` 新增 `postponeTask` 与 `makeupTask` 方法。
   - `SyncEngine` 新增 `postpone_task` / `makeup_task` 操作分支，分别 POST 到后端对应接口。
   - `TodayScreen` 与 `TaskScreen` 任务卡片新增操作按钮：未完成显示「延期」和「完成」；已 `skipped` 显示「补打卡」；已完成显示绿色对勾。
   - 延期时弹出对话框，可填写新日期与原因。

6. **Flutter：习惯统计页**
   - 新增 `HabitDetailScreen`：展示习惯详情、统计概览（完成率/当前连续/最长连续/完成天数）、7 天/30 天切换、打卡热力图。
   - `HabitScreen` 列表项支持点击进入详情页。

7. **Flutter：今日完成率小卡片**
   - `TodayScreen` 顶部新增 `Card`，展示今日已完成任务数 / 总数及百分比进度条。

8. **文档**
   - 更新 `docs/api.md`：补充 `/tasks/:id/makeup`、`/habits/:id/stats` 与同步事件类型。
   - 本章节记录 Week 6 实现范围与验证结果。

### 验证结果

- 后端 `npm run build`：成功
- 后端 `npm run lint`：通过
- 后端 `npm run test`：10 个测试套件，32 个测试全部通过
- Flutter `flutter analyze`：No issues found

### 关键文件

- 后端：
  - `services/api/src/modules/tasks/tasks.service.ts`
  - `services/api/src/modules/tasks/tasks.controller.ts`
  - `services/api/src/modules/tasks/dto/postpone-task.dto.ts`
  - `services/api/src/modules/tasks/dto/makeup-task.dto.ts`
  - `services/api/src/modules/habits/habits.service.ts`
  - `services/api/src/modules/habits/habits.controller.ts`
- Flutter：
  - `apps/mobile/lib/providers/task_provider.dart`
  - `apps/mobile/lib/services/sync_engine.dart`
  - `apps/mobile/lib/screens/today_screen.dart`
  - `apps/mobile/lib/screens/task_screen.dart`
  - `apps/mobile/lib/screens/habit_screen.dart`
  - `apps/mobile/lib/screens/habit_detail_screen.dart`
  - `apps/mobile/lib/services/local_database.dart`

### 已知问题与遗留项

1. Flutter 端尚未写单元/Widget 测试。
2. 操作队列的离线重试上限、冲突 UI 等复杂场景留待后续迭代。
3. 未配置 HTTPS / Nginx 反向代理，API 仍直接暴露于 3001 端口。
4. 任务延期/补打卡的本地 UI 回写在离线场景下依赖 `fetchTasks()` 拉取服务端状态合并，极端网络抖动时可能短暂不一致。

### 进入下一步

Week 7 候选方向：
1. 接入 FCM / 系统推送，完成提醒触达。
2. 接入真实 AI 模型供应商并优化计划生成提示词。
3. 引入版本向量与冲突 UI，完善多端一致性。
4. 补充 Flutter 端单元测试与离线冲突处理。

---

## Week 7：AI 计划闭环（占位模型 + 完整 UI 落库链路）

### 目标

跑通 MVP 核心闭环「创建目标 → AI 生成 7 天计划草案 → 用户确认 → 写入目标/里程碑/任务/习惯 → 今日页可见」。本次暂不接入真实模型，使用可感知用户输入的占位草案，补齐 UI 展示、反馈、落库、同步事件与审计记录。

### 已完成工作

1. **后端：增强占位草案生成**
   - `PlanOrchestrator.generateDraft` 不再返回固定「英语四级」草案。
   - 根据用户输入关键词匹配主题：英语/四级/雅思、减肥/健身/运动、考研/考试/复习、早起/习惯，分别生成对应 7 天任务和习惯。
   - 兜底返回通用目标方案。

2. **后端：用户偏好上下文**
   - `AiService.createDraft` 读取 `User.timezone`、`availableTime`、`energyCurve` 并写入 `PlanVersion.userFeedback.context`。

3. **后端：AIOperation 审计**
   - `AiService.createDraft` 写入一条 `AIOperation` 记录，model=`placeholder`，latency 为占位生成耗时，source=`placeholder`。

4. **后端：approve 支持反馈**
   - `ApprovePlanDto` 新增 `feedback` 字段。
   - 确认落库时把反馈合并写入 `PlanVersion.userFeedback`。

5. **后端：复用已有目标**
   - `PlanExecutor.executeDraft` 新增 `existingGoalId` 参数。
   - 若传入已有目标 ID，则复用该目标，只创建里程碑/任务/习惯。

6. **后端：同步事件广播**
   - `PlanExecutor.executeDraft` 事务提交后广播 `goal.created`、`task.created`（批量）、`habit.created`（批量），支持多端即时刷新今日页。

7. **后端：依赖调整**
   - `AiModule` 导入 `SyncModule` 以使用 `SyncEventsService`。

8. **Flutter：AI 草案展示升级**
   - `AiPlanDraftScreen` 展示目标卡片、里程碑列表、按日期分组的 7 天任务、习惯、预计每周负载、假设、警告。
   - 增加反馈标签：「太难」「时间不合适」「帮我再简单点」。
   - 确认后显示 SnackBar 提示切换到今日页查看任务。

9. **Flutter：目标页 AI 规划入口**
   - `GoalScreen` 列表项增加 AI 规划按钮，点击进入 `AiPlanDraftScreen(goalId: ...)`，为已有目标生成计划。
   - `AiDraftProvider` 支持 `goalId` 参数和 `feedback` 参数。

10. **测试与文档**
    - 更新 `ai.service.spec.ts` 以匹配新的 `prisma.user` / `prisma.aIOperation` / `SyncEventsService` 依赖。
    - 后端 `npm run build/lint/test` 全过（10 suites / 32 tests）。
    - Flutter `flutter analyze` No issues found。

### 关键文件

- 后端：
  - `services/api/src/modules/ai/plan-orchestrator.service.ts`
  - `services/api/src/modules/ai/ai.service.ts`
  - `services/api/src/modules/ai/plan-executor.service.ts`
  - `services/api/src/modules/ai/dto/approve-plan.dto.ts`
  - `services/api/src/modules/ai/ai.module.ts`
  - `services/api/src/modules/ai/ai.service.spec.ts`
- Flutter：
  - `apps/mobile/lib/screens/ai_plan_draft_screen.dart`
  - `apps/mobile/lib/screens/goal_screen.dart`
  - `apps/mobile/lib/providers/ai_provider.dart`

### 验证结果

- 后端 `npm run build`：成功
- 后端 `npm run lint`：通过
- 后端 `npm run test`：10 suites / 32 tests 全部通过
- Flutter `flutter analyze`：No issues found
- 服务器部署后 curl 验证：`POST /ai/plan-drafts` 返回主题化占位草案；`POST /ai/plan-drafts/:id/approve` 后数据库出现 goal + milestones + tasks + habits；同步事件表出现 `goal.created`、`task.created`、`habit.created`。

### 已知问题与遗留项

1. 当前使用占位模型，未接入真实 LLM。后续只需在 `PlanOrchestrator.generateDraft` 中替换为真实模型调用即可。
2. 用户偏好（可用时间、精力曲线）当前只读未写入，用户尚未有 UI 配置入口。
3. AI 规划确认后未自动跳转今日页，需用户手动切换。后续可通过全局 tab provider 优化。
4. 未配置 HTTPS / Nginx 反向代理，API 仍直接暴露于 3001 端口。
5. Flutter 端缺少单元/Widget 测试。

### 进入下一步

Week 8 候选方向：
1. 接入真实 AI 模型供应商（需要用户提供 API Key）。
2. 用户偏好配置页（时区、可用时间、精力曲线）。
3. 提醒与推送系统（FCM / 本地通知）。
4. 目标进度实时计算（基于里程碑权重）。

---

## Week 8：接入真实 AI 模型（DeepSeek / OpenAI 兼容接口）

### 目标

把 AI 计划草案从占位生成升级到真实 LLM 调用，支持 OpenAI 官方、DeepSeek、Claude 代理等任意 OpenAI 兼容接口；保留降级机制；记录真实 token 消耗、延迟与成本估算。

### 已完成工作

1. **ModelAdapter 增强**
   - 新增 `ModelConfig` 与 `getConfig()`，读取 `AI_PROVIDER` / `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`。
   - 当 `OPENAI_API_KEY` 为空或占位时，不崩溃，记录 warn 并返回「未配置」错误。
   - 配置超时 60s、最大重试 2 次。

2. **PlanOrchestrator 接入真实模型**
   - `generateDraft` 优先调用 `ModelAdapter.generateStructured`。
   - 优化中文提示词：明确要求 7 天任务、3 个里程碑、1-2 个习惯、假设/警告、预计负载、最低标准。
   - 使用更严格的 JSON Schema（限定数组长度、必填字段、枚举值）。
   - 增加 `validateDraft` 校验：goal、milestones、tasks（≥7）、habits 完整性。
   - 模型失败或校验不通过时降级到 `buildThemedPlaceholderDraft`。
   - 返回结构扩展为 `{ draft, fallback, error?, usage? }`，便于上层记录 token 消耗。

3. **AiService 真实审计**
   - `createDraft` 把用户偏好作为 `constraints.userPreferences` 注入提示词。
   - 根据 `generateDraft` 返回的 `usage` 写入真实 `inputTokens` / `outputTokens`。
   - 新增 `estimateCost` 方法，按模型单价估算美元成本（OpenAI / DeepSeek 官方价）。
   - `AIOperation.result.source` 区分 `ai` 和 `fallback`。
   - `promptVersion` 从 `placeholder-v1` 改为 `ai-v1`。

4. **环境变量配置**
   - 更新 `services/api/.env.example`，补充 DeepSeek 示例和配置说明。
   - 服务器 `services/api/.env` 写入 DeepSeek 配置：`AI_PROVIDER=deepseek`、`OPENAI_BASE_URL=https://api.deepseek.com/v1`、`OPENAI_MODEL=deepseek-v4-flash`、Key 已配置。

5. **文档更新**
   - `docs/api.md` 补充 AI 计划接口的 fallback 说明和环境变量配置。

6. **测试更新**
   - 更新 `ai.service.spec.ts`：`mockModelAdapter.getConfig`、`mockOrchestrator.generateDraft` 返回新结构。
   - 后端 `npm run build/lint/test` 全过：10 suites / 33 tests 全部通过。

### 验证结果

- 后端 `npm run build`：成功
- 后端 `npm run lint`：通过
- 后端 `npm run test`：10 suites / 33 tests 全部通过
- 服务器部署后 curl 测试：
  - `POST /ai/plan-drafts` 输入「我想通过英语四级，每天学习40分钟」→ 返回 `fallback: false`，草案内容为真实模型生成的 7 天四级备考计划（背单词、听力、阅读、写作、翻译、真题、复盘）。
  - 数据库 `AIOperation` 记录：`model=deepseek-v4-flash`，`inputTokens=907`，`outputTokens=3235`，`latencyMs=24903`，`cost≈0.00074 USD`。
  - `POST /ai/plan-drafts/:id/approve` → 成功落库：1 goal、7 tasks、2 habits。
  - 同步事件表出现 `goal.created` + 7 条 `task.created` + 2 条 `habit.created`。
- 本地临时 Key 文件 `model.txt` 已删除。

### 关键文件

- 后端：
  - `services/api/src/modules/ai/model-adapter.service.ts`
  - `services/api/src/modules/ai/plan-orchestrator.service.ts`
  - `services/api/src/modules/ai/ai.service.ts`
  - `services/api/src/modules/ai/ai.service.spec.ts`
  - `services/api/.env.example`
- 文档：
  - `docs/api.md`
  - `docs/development-log.md`

### 已知问题与遗留项

1. 当前提示词已包含用户偏好，但 `User.availableTime` / `User.energyCurve` 默认仍为空，用户尚无 UI 配置入口。模型只能看到「未配置」。
2. 真实模型调用耗时约 25s（deepseek-v4-flash），移动端体验需优化。后续可考虑：
   - 接入流式 SSE 响应，边生成边展示。
   - 使用更快模型（如 DeepSeek-V3 或 gpt-4o-mini）。
3. 未配置 HTTPS / Nginx 反向代理，API 仍直接暴露于 3001 端口。
4. Flutter 端缺少单元/Widget 测试。
5. AI 调用成本估算单价为硬编码，后续可从配置或模型供应商 API 获取实时价格。

### 进入下一步

Week 9 候选方向：
1. 用户偏好配置页（时区、可用时间、精力曲线）——让 AI 计划真正个性化。
2. 接入 SSE 流式草案生成，减少用户等待时间。
3. 提醒与推送系统（FCM / 本地通知）。
4. 目标进度实时计算（基于里程碑权重）。


## Week 9：自定义计划时长与分阶段推进（2026-08-12）

### 目标

让 AI 计划支持用户自定义总时长与阶段长度，避免只能生成 7 天计划；同时实现分阶段展开，先落库当前阶段，完成后再进入下一阶段，降低一次性生成全量计划的不稳定性。

### 已完成工作

1. **数据模型扩展**
   - `prisma/schema.prisma`：`PlanVersion` 表新增 `planDuration`（总天数）、`stageLength`（每阶段天数）、`currentStage`（当前阶段编号）、`totalStages`（总阶段数）四个字段。
   - 手动创建迁移文件：`prisma/migrations/20260812181431_add_plan_duration_stages/migration.sql`。
   - 已应用迁移到服务器数据库。

2. **后端 DTO 与接口**
   - `CreatePlanDraftDto` 增加 `planDuration`（7-365 天）、`stageLength`（7-30 天）、`currentStage`（≥1）。
   - `PlanOrchestrator` 完全重写：
     - 引入 `PlanStage` 与 `PlanDraftPayload` 结构。
     - `generateDraft` 按 `currentStage` 只生成当前阶段详细 tasks，其余阶段只生成里程碑。
     - 新增 `advanceStage` 方法，基于已有 payload 生成下一阶段 tasks。
     - 占位降级逻辑适配分阶段结构。
   - `PlanExecutor` 改造：只落库 `isDetailed=true` 阶段的 milestones 与 tasks，保持对旧格式兼容。
   - `AiService`：
     - 创建 `PlanVersion` 时写入阶段元数据。
     - 新增 `advanceDraft` 方法，创建 versionNo + 1 的新 PlanVersion。
     - 确认草案时回写 `goalId`，保证后续 `advance` 复用同一目标。
   - `AiController` 新增 `POST /api/v1/ai/plan-drafts/:id/advance`。

3. **后端测试**
   - 更新 `ai.service.spec.ts`：
     - 验证 `PlanVersion` 创建时包含阶段元数据。
     - 新增 `advanceDraft` 测试：创建下一阶段、复用 goalId、到达最后阶段返回 `no_advance`。
     - 新增 `approveDraft` 测试：确认后回写 `goalId`。
   - 后端 `npm run build/lint/test` 全过：10 suites / 35 tests。

4. **Flutter 客户端**
   - `AiDraftNotifier`：`createDraft` 增加 `planDuration`/`stageLength` 参数；新增 `advanceStage` 方法。
   - `AiPlanDraftScreen`：
     - 增加总时长与阶段长度下拉选择器。
     - 按阶段展示计划：当前阶段展开详细 tasks，其他阶段仅显示里程碑。
     - 确认计划后，若未到最后阶段，显示“进入下一阶段”按钮。
   - `flutter analyze` 通过（使用 `C:/Users/Administrator/flutter/bin/flutter`）。

5. **服务器部署**
   - 同步最新代码到 `/opt/planning-app`。
   - 运行 `npx prisma generate` 与 `npx prisma migrate deploy`。
   - 删除旧 `dist/` 与 `tsconfig.tsbuildinfo` 后重新 `npm run build`。
   - 使用 systemd 服务 `planning-api.service` 启动并启用自启。

### 验证结果

- 后端 `npm run build`：成功
- 后端 `npm run lint`：通过
- 后端 `npm run test`：10 suites / 35 tests 全部通过
- Flutter `flutter analyze`：No issues found
- 服务器端到端验证：
  - `POST /api/v1/ai/plan-drafts` 输入 `planDuration=30, stageLength=7` → 返回 `totalStages=5`，第 1 阶段含 7 个 tasks。
  - `POST /api/v1/ai/plan-drafts/:id/approve` → 数据库新增 7 tasks、1 milestone。
  - `POST /api/v1/ai/plan-drafts/:id/advance` → 生成新 PlanVersion（`currentStage=2`），复用同一 `goalId`。
  - 再次确认后数据库累计 14 tasks、2 milestones。

### 关键文件

- 后端：
  - `services/api/prisma/schema.prisma`
  - `services/api/prisma/migrations/20260812181431_add_plan_duration_stages/migration.sql`
  - `services/api/src/modules/ai/dto/create-plan-draft.dto.ts`
  - `services/api/src/modules/ai/plan-orchestrator.service.ts`
  - `services/api/src/modules/ai/plan-executor.service.ts`
  - `services/api/src/modules/ai/ai.service.ts`
  - `services/api/src/modules/ai/ai.controller.ts`
  - `services/api/src/modules/ai/ai.service.spec.ts`
- Flutter：
  - `apps/mobile/lib/providers/ai_provider.dart`
  - `apps/mobile/lib/screens/ai_plan_draft_screen.dart`
- 文档：
  - `planning-app/docs/development-roadmap.md`（新增后续 Week 6-10 计划）
  - `planning-app/docs/handover-summary.md`
  - `kimiRULES.txt`

### 已知问题与遗留项

1. 当前 AI 仍为占位降级（服务器 `.env` 配置了 DeepSeek，但真实调用可能未启用或失败时降级）。
2. 今日页尚未实现“最重要的 3 件事”算法与连续打卡展示。
3. `CalendarEvent`、AISession、UserEvent 等模型仍未开发业务逻辑。
4. 无版本控制（Git），代码仍靠 tar/scp 同步。
5. 无 HTTPS / Nginx / 数据库备份。

### 进入下一步

按 `planning-app/docs/development-roadmap.md` 执行：
- **Week 10**：执行与反馈闭环（今日 Top 3、连续打卡、目标进度）。


## Week 10：执行与反馈闭环（2026-08-12）

### 目标

让“今日页”成为用户每天打开的核心页面，展示今天最重要的 3 件事、习惯打卡、目标进度与连续天数。

### 已完成工作

1. **后端：今日数据聚合接口**
   - 新增 `TodayService` / `TodayController` / `TodayModule`。
   - `GET /api/v1/today` 返回：
     - 今日任务总数、已完成数、过期任务数。
     - Top 3 任务（按过期、精力、权重评分排序）。
     - 今日习惯列表及连续打卡天数。
     - 目标进度与里程碑进度。

2. **后端：目标统计接口**
   - `GoalsService.stats(userId, id)`：按里程碑权重计算目标进度。
   - `GET /api/v1/goals/:id/stats`：返回 `progress`、`currentStreak`、`milestones`。
   - 连续天数基于目标下所有任务/习惯的 `completed`/`partial` 打卡日期聚合。

3. **Flutter：今日页改造**
   - 新建 `today_provider.dart` 调用 `/today`。
   - `TodayScreen` 展示：
     - 顶部今日概览卡片（完成率进度条、过期提示）。
     - “今天最重要的 3 件事”列表（支持完成勾选）。
     - 习惯打卡列表（火焰图标 + 连续天数 + 打卡按钮）。
     - 目标进度卡片（进度条 + 里程碑展开）。

4. **Flutter：习惯页增强**
   - `HabitScreen` 列表项显示“连续 N 天 · 最长 M 天”。
   - 新增 `HabitDetailScreen` 展示热力图与统计。

5. **Flutter：目标页增强**
   - `GoalScreen` 列表项显示每个目标的进度条、连续天数、里程碑数量。
   - 点击目标弹出详情对话框，展示总体进度、连续天数、里程碑时间线（完成/未完成图标 + 百分比）。
   - `goal_provider.dart` 新增 `stats(id)` 方法调用 `/goals/:id/stats`。

6. **服务器部署与修复**
   - 将最新代码打包上传到 `/opt/planning-app`，执行 `npm install`、`npx prisma generate`、`npm run build`。
   - 修复因 `services/api/.env` 存在错误数据库密码导致的服务启动后数据库认证失败：删除 `services/api/.env`，并在 `planning-api.service` 中显式加载 `/opt/planning-app/.env`。
   - 使用 `systemctl restart planning-api` 重启服务，端口 3001 正常监听。

### 验证结果

- 后端 `npm run build`：成功
- 后端 `npm run test`：11 suites / 38 tests 全部通过
- 后端 `npm run lint`：通过
- Flutter `flutter analyze`：No issues found
- 服务器端到端验证（通过 `verify_week10.sh`）：
  - 注册/登录成功，JWT 正常。
  - 创建目标 + 里程碑、创建任务、创建习惯、习惯打卡、完成任务均成功。
  - `GET /api/v1/today` 正确返回 Top 任务、习惯打卡状态、目标进度 66.67%、连续 1 天。
  - `GET /api/v1/goals/:id/stats` 返回与 `/today` 一致的目标进度和里程碑进度。

### 关键文件

- 后端：
  - `services/api/src/modules/today/today.service.ts`
  - `services/api/src/modules/today/today.controller.ts`
  - `services/api/src/modules/today/today.module.ts`
  - `services/api/src/modules/goals/goals.service.ts`
  - `services/api/src/modules/goals/goals.controller.ts`
- Flutter：
  - `apps/mobile/lib/providers/today_provider.dart`
  - `apps/mobile/lib/providers/goal_provider.dart`
  - `apps/mobile/lib/screens/today_screen.dart`
  - `apps/mobile/lib/screens/habit_screen.dart`
  - `apps/mobile/lib/screens/goal_screen.dart`
- 运维：
  - `/etc/systemd/system/planning-api.service`

### 已知问题与遗留项

1. `services/api/.env` 已被删除，后续代码同步时应注意不要重新引入错误的 `.env` 文件；服务器统一从 `/opt/planning-app/.env` 加载环境变量。
2. 今日页 Top 3 排序尚未结合用户精力曲线（`User.energyCurve`）与可用时间，默认按过期、权重、精力等级硬编码匹配。
3. 目标进度和连续天数计算目前包含所有历史打卡；跨时区与补打卡边界场景未做严格处理。
4. `CalendarEvent`、AISession 多轮、UserEvent 埋点等业务仍未开发。
5. 无 HTTPS / Nginx / 数据库备份 / 版本控制。

### 进入下一步

按 `planning-app/docs/development-roadmap.md` 执行：
- **Week 11**：真实 AI 接入与智能复盘。


## Week 11：真实 AI 接入与智能复盘（2026-08-12）

### 目标

让 AI 计划草案真正调用真实大模型，并补齐智能复盘与重新规划能力；同时增加费用保护与负载检测，降低意外高消费风险。

### 已完成工作

1. **后端：AI 费用日限额与调用保护**
   - `AiService` 新增 `getDailyCostLimit`、`getDailyCostSoFar`、`checkDailyCostLimit`。
   - 默认 `AI_DAILY_COST_LIMIT_USD=1.0`，可在 `.env` 配置。
   - `createDraft`、`advanceDraft`、`review`、`replan` 调用真实模型前，先检查当日累计费用；若超限直接返回占位结果，并在 `AIOperation` 中记录原因。
   - `AIOperation.result` 新增 `dailyCostAtCall`，记录当时累计费用。

2. **后端：计划负载检测与超载警告**
   - `AiService.createDraft` 读取 `User.availableTime`，计算每周可用分钟数。
   - 对比 `estimatedWeeklyLoad.totalMinutes`，超载时返回 `overload: true` 与 `availableWeeklyMinutes`，并在 `warnings` 中追加提示。
   - 未设置可用时间时，默认按每天 1 小时（420 分钟/周）兜底。

3. **后端：真实 AI 复盘接口**
   - `PlanOrchestrator` 新增 `generateReview`、`buildPlaceholderReview`、`buildReviewPrompt`。
   - `AiService.review` 重写：聚合目标下的任务完成/跳过/延期数据与习惯打卡数，调用模型生成 `summary`、`insights`、`nextActions`。
   - 结果写入 `Review` 表，并记录 `AIOperation`。

4. **后端：真实 AI 重新规划接口**
   - `PlanOrchestrator` 新增 `generateReplan`、`buildReplanPrompt`。
   - `AiService.replan` 重写：查询目标最新 `PlanVersion`，统计已完成/延期/跳过任务，生成下一阶段 PlanVersion。
   - 返回结构与 `createDraft` 一致，可在 Flutter 端确认后落库。

5. **Flutter：AI 计划页增强**
   - `AiPlanDraftScreen` 生成按钮展示“AI 生成中，约需 10-30 秒…”文案与 loading 指示器。
   - `fallback == true` 时显示黄色提示条，包含具体降级原因（未配置模型/费用上限/模型失败）。
   - `overload == true` 时显示红色警告卡片，提示当前预计负载超过可用时间。

6. **Flutter：复盘页接入 `/ai/review`**
   - 新建 `review_provider.dart`，调用 `POST /api/v1/ai/review`。
   - 重写 `ReviewScreen`：目标下拉选择、日/周周期切换、“生成 AI 复盘”按钮。
   - 展示 AI 生成的总结、洞察列表、下一步行动列表，以及 fallback 提示。

7. **服务器配置与部署**
   - 更新 `/opt/planning-app/.env`：配置 DeepSeek（`AI_PROVIDER=deepseek`、`OPENAI_MODEL=deepseek-v4-flash`）与真实 API Key，新增 `AI_DAILY_COST_LIMIT_USD=1.0`。
   - 将最新代码部署到 `/opt/planning-app`，完成 `npm install` / `npx prisma generate` / `npm run build` / `systemctl restart planning-api`。

### 验证结果

- 后端 `npm run build`：成功
- 后端 `npm run lint`：通过
- 后端 `npm run test`：11 suites / 39 tests 全部通过
- Flutter `flutter analyze`：No issues found
- 服务器端到端验证：
  - `POST /api/v1/ai/plan-drafts`（30 天英语口语）返回真实 DeepSeek 生成的 5 阶段计划，含 7 天任务、里程碑、习惯、假设/警告、预计负载。
  - `POST /api/v1/ai/plan-drafts/:id/approve` 成功落库。
  - `POST /api/v1/ai/replan` 基于已确认计划生成第 2 阶段新 PlanVersion，返回真实 AI 生成的 7 个任务。
  - `POST /api/v1/ai/review` 返回 AI 生成的周复盘总结、洞察与下一步建议，并写入 `Review` 表。
  - 数据库 `AIOperation` 记录显示真实模型调用：`deepseek-v4-flash`，`inputTokens` 约 357-1124，`outputTokens` 约 234-22674，单次 cost 约 $0.00008-$0.0046，累计远低于 1 USD 日限额。

### 关键文件

- 后端：
  - `services/api/src/modules/ai/ai.service.ts`
  - `services/api/src/modules/ai/plan-orchestrator.service.ts`
  - `services/api/src/modules/ai/model-adapter.service.ts`
  - `services/api/src/modules/ai/ai.service.spec.ts`
  - `services/api/.env.example`
- Flutter：
  - `apps/mobile/lib/screens/ai_plan_draft_screen.dart`
  - `apps/mobile/lib/providers/review_provider.dart`
  - `apps/mobile/lib/screens/review_screen.dart`
- 运维：
  - `/opt/planning-app/.env`
  - `/etc/systemd/system/planning-api.service`

### 已知问题与遗留项

1. `replan` 要求目标至少存在一个 `PlanVersion`；若用户从未通过 AI 生成并确认过计划，则返回 404。后续可考虑对无计划版本的目标返回通用重新规划草案。
2. `availableTime` 解析仅支持 `{ dayOfWeek, startTime, endTime }` 数组；其他格式会回退到默认 420 分钟/周。
3. `deepseek-v4-flash` 单次调用耗时约 40-150 秒，移动端需展示明确 loading；后续可考虑流式 SSE 或切换到更快模型。
4. 真实 AI 输出稳定性依赖提示词与 Schema；极端情况下仍可能降级为占位。
5. 无 HTTPS / Nginx / 数据库备份 / 版本控制。

### 进入下一步

按 `planning-app/docs/development-roadmap.md` 执行：
- **Week 12**：设置、收件箱与日历。


## Week 12：设置、收件箱与日历（2026-08-12）

### 目标

补齐用户配置入口、快速记录整理入口与日历视图，提升 App 日常可用性。

### 已完成工作

1. **后端：用户偏好默认值与部分更新**
   - `UsersService.getMe` 返回完整偏好默认值（timezone、availableTime、energyCurve、notificationSetting）。
   - `UsersService.updatePreferences` 改为部分更新：未提供的字段不覆盖；JSON 字段（energyCurve、notificationSetting）与现有值合并而非整体替换。

2. **后端：收件箱模块**
   - Prisma Schema 新增 `InboxItem` 模型：`id/userId/title/description/status/convertedToType/convertedToId`，并补全 `User.inboxItems` 反向关联。
   - 手动创建并应用迁移 `20260812215500_add_inbox_item`。
   - 新建 `InboxModule`、`InboxService`、`InboxController`：
     - `POST /inbox`：创建收件箱条目。
     - `GET /inbox`：列出当前用户 `pending` 条目。
     - `PATCH /inbox/:id`：更新标题/描述。
     - `POST /inbox/:id/convert`：整理为目标/项目/任务。
     - `POST /inbox/:id/dismiss`：忽略条目。
   - 整理到任务时支持 `scheduledDate`、`projectId`、`milestoneId`。
   - 新增 `inbox.service.spec.ts` 单元测试。

3. **后端：日历模块**
   - 实现 `CalendarModule`、`CalendarService`、`CalendarController`：
     - `POST /calendar`：创建日历事件，支持关联 `taskId`。
     - `GET /calendar?start=...&end=...`：查询日期范围内事件。
     - `PATCH /calendar/:id`：更新事件。
     - `DELETE /calendar/:id`：删除事件。
   - 校验 `taskId` 归属当前用户；校验开始时间不晚于结束时间。
   - 新增 `calendar.service.spec.ts` 单元测试。

4. **后端：模块注册**
   - `AppModule` 导入 `InboxModule` 与 `CalendarModule`。

5. **Flutter：更多入口页**
   - `MainScreen` 底部导航新增“更多” Tab（`MoreScreen`）。
   - `MoreScreen` 以宫格入口展示：收件箱、日历、设置。

6. **Flutter：设置页**
   - 新建 `SettingsScreen` 与 `settings_provider.dart`。
   - 展示当前时区并支持修改，调用 `GET /users/me` 与 `PATCH /users/me/preferences`。
   - 可用时间、精力曲线、通知偏好的详细配置待后续迭代。

7. **Flutter：收件箱页**
   - 新建 `InboxScreen` 与 `inbox_provider.dart`。
   - 支持新建条目、整理为目标/项目/任务、忽略。
   - 新建 `InboxItemModel`。

8. **Flutter：日历页**
   - 新建 `CalendarScreen` 与 `calendar_provider.dart`。
   - `pubspec.yaml` 新增依赖 `table_calendar: ^3.0.9`。
   - 月视图展示，点击日期展示当天事件，支持新建/删除事件。
   - 新建 `CalendarEventModel`。

9. **测试与验证**
   - 后端 `npm run build`：成功。
   - 后端 `npm run lint`：通过。
   - 后端 `npm run test`：13 个测试套件，52 个测试全部通过。
   - Flutter `flutter pub get`：成功。
   - Flutter `flutter analyze`：No issues found。

### 部署验证

- 打包上传 `services/api/dist` 与 `services/api/prisma` 到 `/opt/planning-app`。
- 服务器执行 `npx prisma migrate deploy`，应用迁移 `20260812215500_add_inbox_item`。
- 服务器执行 `npx prisma generate` 刷新 Prisma Client（修复首次重启后 `inboxItem` 未定义的问题）。
- `systemctl restart planning-api` 重启服务，端口 3001 正常监听。
- curl 验证：
  - `GET /users/me` 返回完整偏好默认值。
  - `POST /inbox` 创建条目、`GET /inbox` 列表、`POST /inbox/:id/convert` 整理到任务均成功。
  - `POST /calendar` 创建事件、`GET /calendar?start=&end=` 查询均成功。
  - `PATCH /users/me/preferences` 部分更新时区与通知偏好成功。

### 关键文件

- 后端：
  - `services/api/prisma/schema.prisma`
  - `services/api/prisma/migrations/20260812215500_add_inbox_item/migration.sql`
  - `services/api/src/modules/inbox/`
  - `services/api/src/modules/calendar/`
  - `services/api/src/modules/users/users.service.ts`
  - `services/api/src/app.module.ts`
- Flutter：
  - `apps/mobile/pubspec.yaml`
  - `apps/mobile/lib/screens/main_screen.dart`
  - `apps/mobile/lib/screens/more_screen.dart`
  - `apps/mobile/lib/screens/settings_screen.dart`
  - `apps/mobile/lib/screens/inbox_screen.dart`
  - `apps/mobile/lib/screens/calendar_screen.dart`
  - `apps/mobile/lib/providers/settings_provider.dart`
  - `apps/mobile/lib/providers/inbox_provider.dart`
  - `apps/mobile/lib/providers/calendar_provider.dart`
  - `apps/mobile/lib/models/inbox_item_model.dart`
  - `apps/mobile/lib/models/calendar_event_model.dart`

### 已知问题与遗留项

1. 设置页目前只支持时区修改，可用时间、精力曲线、通知偏好的可视化配置留待 Week 13 或后续迭代。
2. 收件箱与日历当前依赖在线 API，尚未接入本地 SQLite 缓存与离线同步队列。
3. 日历月视图未做性能优化，大量事件时建议后续增加分页或懒加载。
4. 未配置 HTTPS / Nginx / 数据库备份 / 版本控制。

### 进入下一步

按 `development-roadmap.md` 执行 **Week 13：提醒推送与生产加固**。


## Week 13：提醒推送与生产加固（2026-08-13）

### 目标

1. 后端定时扫描 `Reminder` 表，到期后标记为 `sent` 并通过 WebSocket 广播 `reminder.triggered` 事件。
2. Flutter 使用本地通知（`flutter_local_notifications`）实现提醒触达；今日页展示当天提醒列表；设置页增加通知开关。
3. 服务器配置 Nginx 反向代理 + HTTPS，API 从 `http://xutaostudy.xyz:3001` 迁移到 `https://xutaostudy.xyz/api/v1`。
4. 配置 PostgreSQL 每日自动备份脚本。

### 已完成工作

1. **后端：定时扫描提醒**
   - 新增依赖 `@nestjs/schedule`。
   - 新建 `RemindersScheduler`：每分钟执行 `processDueReminders()`，扫描 `status=pending` 且 `triggerAt <= now()` 的提醒。
   - 到期提醒更新为 `status=sent`，并通过 `SyncEventsService.broadcastToUser` 广播 `reminder.triggered` 事件（不持久化到 `SyncEvent` 表，避免高频写入）。
   - 扩展 `SyncEventsService` 新增 `BroadcastEventPayload` 与 `broadcastToUser` 方法。

2. **后端：提醒 dismiss/snooze**
   - 新增 `POST /reminders/:id/dismiss`：将提醒标记为 `dismissed`。
   - 新增 `POST /reminders/:id/snooze`：支持推迟 15/30/60 分钟，更新 `triggerAt` 并将 `status` 回置为 `pending`，`snoozeCount` 递增。
   - 新增 DTO：`SnoozeReminderDto`。
   - 更新 `RemindersModule`：注入 `SyncModule`。
   - 更新 `AppModule`：全局注册 `ScheduleModule.forRoot()`。

3. **后端：测试**
   - 更新 `reminders.service.spec.ts`：新增 `processDueReminders`、`dismiss`、`snooze` 用例。
   - 新建 `reminders.scheduler.spec.ts`：验证 cron 触发与异常不抛错。
   - 后端 `npm run build/lint/test` 全过：14 suites / 58 tests。

4. **Flutter：本地通知服务**
   - `pubspec.yaml` 新增 `flutter_local_notifications: ^17.2.4`、`timezone: ^0.9.4`。
   - 通过 `flutter create . --platforms=android` 补全 Android 平台目录（原项目缺失）。
   - 更新 `AndroidManifest.xml`：添加 `RECEIVE_BOOT_COMPLETED`、`POST_NOTIFICATIONS`、`SCHEDULE_EXACT_ALARM` 权限。
   - 新建 `NotificationService`：初始化、请求权限、按 `ReminderModel` 调度 `zonedSchedule`、取消通知、即时展示。
   - 更新 `main.dart`：`WidgetsFlutterBinding.ensureInitialized()` 后初始化通知服务，并添加全局 `navigatorKey`。

5. **Flutter：提醒模型与 Provider**
   - 新建 `ReminderModel`。
   - 新建 `RemindersNotifier`：拉取提醒、创建提醒、忽略、推迟；开关总控时取消/重排全部通知；监听 `reminder.triggered` 同步事件并即时弹通知。
   - 新增 `remindersEnabledProvider` 状态开关。

6. **Flutter：今日页与设置页**
   - `TodayScreen` 增加“今日提醒”列表，展示当天提醒，支持忽略、推迟（15/30/60 分钟）。
   - `SettingsScreen` 增加本地通知总开关。

7. **Flutter：URL 升级 HTTPS**
   - `ApiClient.baseUrl` 改为 `https://xutaostudy.xyz/api/v1`。
   - `SyncEngine` WebSocket base URL 改为 `wss://xutaostudy.xyz/sync`。

8. **服务器：Nginx + HTTPS**
   - 服务器已存在 `xutaostudy.xyz` 配置，但 nginx 因 `cdn.sta1n.cn` 上游解析失败而无法启动。
   - 修复：将 `proxy_pass https://cdn.sta1n.cn/;` 改为 `set $sta1n_cdn ...; proxy_pass $sta1n_cdn;` 以延迟 DNS 解析。
   - 将 `sites-enabled/` 下的备份文件移到 `sites-available-backups/`，消除重复 `server_name` 警告。
   - 新增 `/api/v1/` 与 `/sync` 反向代理到 `127.0.0.1:3001`。
   - Nginx 成功启动并监听 80/443；HTTPS 证书为 DigiCert 签发的有效证书。

9. **服务器：数据库备份**
   - 创建 `/opt/backups/backup-planning-db.sh`：用 `docker exec planning-app-postgres pg_dump -U postgres -d planning_app -Fc` 生成 dump，保留 7 天。
   - 添加 root cron：`0 3 * * *` 每日凌晨执行。
   - 已手动执行一次，生成 64KB 备份文件。

10. **部署踩坑**
    - 后端 `npm run build` 在存在 `tsconfig.tsbuildinfo` 时未生成 `dist/`；删除后重新构建成功。
    - 服务器 `npm install` 未安装 `@nestjs/schedule`；原因是未上传 `services/api/package.json`；上传后从 monorepo 根目录执行 `npm install` 成功安装。
    - 部署命令已清理临时 tar 包。

### 验证结果

- 后端 `npm run build`：成功（需先删除 `tsconfig.tsbuildinfo`）
- 后端 `npm run lint`：通过
- 后端 `npm run test`：14 suites / 58 tests 全部通过
- Flutter `flutter analyze`：No issues found
- 服务器端到端验证：
  - `https://xutaostudy.xyz/api/v1/health` 返回 `{"status":"ok"}`
  - `POST /reminders` 创建提醒成功
  - `POST /reminders/:id/snooze` / `POST /reminders/:id/dismiss` 正常
  - 创建 `triggerAt` 为过去的提醒，等待约 1 分钟后状态变为 `sent`
  - Nginx 监听 80/443，`planning-api` 监听 3001，服务均 active
  - 备份文件 `/opt/backups/planning-app/planning_app_20260813_074926.dump` 已生成

### 关键文件

- 后端：
  - `services/api/package.json`
  - `services/api/src/app.module.ts`
  - `services/api/src/modules/reminders/reminders.scheduler.ts`
  - `services/api/src/modules/reminders/reminders.module.ts`
  - `services/api/src/modules/reminders/reminders.service.ts`
  - `services/api/src/modules/reminders/reminders.controller.ts`
  - `services/api/src/modules/reminders/dto/snooze-reminder.dto.ts`
  - `services/api/src/modules/reminders/reminders.service.spec.ts`
  - `services/api/src/modules/reminders/reminders.scheduler.spec.ts`
  - `services/api/src/modules/sync/sync-events.service.ts`
- Flutter：
  - `apps/mobile/pubspec.yaml`
  - `apps/mobile/android/app/src/main/AndroidManifest.xml`
  - `apps/mobile/lib/main.dart`
  - `apps/mobile/lib/services/api_client.dart`
  - `apps/mobile/lib/services/sync_engine.dart`
  - `apps/mobile/lib/services/notification_service.dart`
  - `apps/mobile/lib/models/reminder_model.dart`
  - `apps/mobile/lib/providers/reminder_provider.dart`
  - `apps/mobile/lib/screens/today_screen.dart`
  - `apps/mobile/lib/screens/settings_screen.dart`
- 服务器：
  - `/etc/nginx/sites-enabled/xutaostudy.xyz`
  - `/opt/backups/backup-planning-db.sh`
  - root crontab

### 已知问题与遗留项

1. 本地通知当前仅实现 Android 平台配置；iOS 未生成平台目录，后续如需 iOS 需运行 `flutter create . --platforms=ios` 并配置权限。
2. 通知点击跳转今日页尚未完整实现，仅打印日志。
3. 精确闹钟权限（`SCHEDULE_EXACT_ALARM`）在部分 Android 版本需用户手动授予；未做 UI 引导。
4. 今日页提醒列表只展示“当天”提醒，不展示跨天提醒。
5. 备份脚本未做远程异地备份，仅保留本地 7 天。
6. 未配置 Nginx 日志轮转、 fail2ban 或 API 请求监控。

### 进入下一步

按 `development-roadmap.md` 执行 **Week 14：预置模板与 AI 高级能力**。


## Week 14：预置模板与 AI 高级能力（2026-08-13）

### 目标

降低冷启动成本，提升 AI 输出稳定性，并建立模型路由与费用控制机制。

### 已完成工作

1. **后端：预置领域模板**
   - 新增 `services/api/src/modules/ai/templates/ai-templates.ts`。
   - 内置 6 个模板：考研英语、减脂入门、晨间习惯、阅读计划、日语入门、5 公里跑步。
   - 每个模板包含：分类、关键词、默认计划时长/阶段长度、基础提示词、默认里程碑、默认任务、默认习惯、假设与警告。

2. **后端：模板匹配与 AI 微调**
   - `findTemplateById`：按 ID 选择模板。
   - `recommendTemplate`：基于用户输入关键词匹配推荐模板。
   - 创建计划时，若传入 `templateId` 或输入匹配到模板，自动将模板上下文注入系统提示词，让模型输出更贴合场景。
   - 费用上限触发时，优先使用模板生成降级草案（`buildTemplateFallbackDraft`），而非通用占位。

3. **后端：多模型路由**
   - `ModelAdapter.generateStructured` 支持传入 `modelName` 参数。
   - 简单计划/阶段推进使用 cheap 模型（环境变量 `AI_CHEAP_MODEL`）。
   - 复盘/重新规划使用 strong 模型（环境变量 `AI_STRONG_MODEL`）。
   - 未配置环境变量时自动回退到默认 `OPENAI_MODEL`。

4. **后端：AI 用量接口**
   - 新增 `GET /ai/templates`：列出全部模板（不含内部提示词）。
   - 新增 `GET /ai/templates/recommend?input=...`：推荐模板。
   - 新增 `GET /ai/usage`：返回当日费用、上限、调用次数。
   - 费用上限达到后，后续调用自动降级为模板或占位草案/复盘。

5. **Flutter：模板选择入口**
   - `AiPlanDraftScreen` 顶部展示 AI 用量卡片（进度条 + 费用/次数）。
   - 输入框下方新增“帮我推荐模板”按钮，点击后从后端获取推荐模板。
   - 展示所有模板 chips，支持手动选择/取消。
   - 推荐模板以 banner 形式展示，可一键选用。

6. **Flutter：AI 用量展示**
   - `ai_provider.dart` 新增 `fetchTemplates`、`fetchUsage`、`recommendTemplate` 方法。
   - 生成计划后自动刷新用量数据。

### 验证结果

- 后端 `npm run build`：成功（已删除 `tsconfig.tsbuildinfo`）
- 后端 `npm run lint`：通过
- 后端 `npm run test`：14 suites / 64 tests 全部通过
- Flutter `flutter analyze`：No issues found
- 本地验证：
  - 选择“考研英语”模板生成计划，模板上下文注入提示词。
  - 输入“我想减脂”点击推荐，返回 `fat-loss` 模板。
  - 当日费用达到上限后，后续 `/ai/plan-drafts` 返回 `source: "template"` 的降级草案。

### 关键文件

- 后端：
  - `services/api/src/modules/ai/templates/ai-templates.ts`
  - `services/api/src/modules/ai/model-adapter.service.ts`
  - `services/api/src/modules/ai/plan-orchestrator.service.ts`
  - `services/api/src/modules/ai/ai.service.ts`
  - `services/api/src/modules/ai/ai.controller.ts`
  - `services/api/src/modules/ai/dto/create-plan-draft.dto.ts`
  - `services/api/src/modules/ai/ai.service.spec.ts`
- Flutter：
  - `apps/mobile/lib/providers/ai_provider.dart`
  - `apps/mobile/lib/screens/ai_plan_draft_screen.dart`

### 已知问题与遗留项

1. 模板默认值（时长/阶段长度）尚未在 UI 中自动回填，用户需手动选择。
2. 模板匹配仅基于关键词命中，准确率需后续真实数据调优。
3. 多模型路由假设同一 provider/同一 API key；若未来 cheap/strong 模型分属不同供应商，需拆分为多个 `ModelAdapter` 实例。
4. 未对 AIOperation 做自动清理，长期运行可能累积大量记录。

### 进入下一步

按 `development-roadmap.md` 执行 **Week 15+**，可选方向：社交与共享、外部日历集成、数据报表、高级 AI 个性化。


## Week 15：社交与共享（2026-08-13）

### 目标

实现目标共享、小组挑战与排行榜，让用户的成长过程可协作、可竞赛。

### 已完成工作

1. **后端：数据模型扩展**
   - 新增 `GoalShare`：目标共享邀请，支持 `pending` / `accepted` / `declined` 状态、`view` / `edit` 权限。
   - 新增 `Challenge`：挑战定义，支持 `habit_streak` / `task_count` / `goal_progress` 类型。
   - 新增 `ChallengeParticipant`：记录用户加入挑战与累计得分，按 `(challengeId, userId)` 唯一。
   - 更新 `User` 与 `Goal` 关系字段。

2. **后端：社交模块**
   - 新建 `services/api/src/modules/social/`：Controller、Service、DTOs、测试。
   - `POST /social/goals/:id/share`：按邮箱分享目标给其它用户。
   - `GET /social/shares/received`：我收到的共享邀请（可按状态过滤）。
   - `GET /social/shares/owned`：我发出的共享。
   - `POST /social/shares/:id/respond`：接受/拒绝共享邀请。
   - `POST /social/challenges`：创建挑战，创建者自动加入。
   - `GET /social/challenges`：列出挑战（可按状态过滤）。
   - `POST /social/challenges/:id/join`：加入挑战。
   - `GET /social/challenges/:id/leaderboard`：排行榜，根据挑战类型计算得分并排序。
   - 排行榜计分规则：
     - `habit_streak`：统计挑战周期内完成/部分/补打卡的习惯 checkin 次数。
     - `task_count`：统计周期内状态为 done 的任务数。
     - `goal_progress`：统计周期内任务完成百分比。

3. **后端：模块注册与迁移**
   - 在 `app.module.ts` 导入 `SocialModule`。
   - 生成 Prisma Client 与迁移（在服务器执行）。

4. **后端：测试**
   - 新增 `social.service.spec.ts`：覆盖分享、响应、创建挑战、加入挑战、排行榜计分。

5. **Flutter：社交页面**
   - 新增 `SocialScreen`：底部 Tab 切换「共享目标」「挑战」「排行榜占位」。
   - 共享目标 Tab：展示收到的/我发出的共享，支持接受/拒绝。
   - 挑战 Tab：列出活跃挑战，支持创建挑战、加入挑战、查看排行榜。
   - 排行榜弹窗：展示名次、用户邮箱、得分及个人排名。

6. **Flutter：目标分享入口**
   - `GoalScreen` 目标列表新增分享图标按钮，弹出邮箱输入框，调用 `POST /social/goals/:id/share`。

7. **Flutter：导航入口**
   - `MoreScreen` 增加「社交」入口。

8. **新增 Provider**
   - `social_provider.dart`：封装所有社交接口。

### 验证结果

- 后端 `npm run build`：成功
- 后端 `npm run lint`：通过
- 后端 `npm run test`：15 suites / 70 tests 全部通过
- Flutter `flutter analyze`：No issues found
- 服务器端到端验证（部署后）：
  - 创建目标并分享给对方邮箱，接收方 `GET /social/shares/received` 可见 pending 邀请。
  - 接收方接受邀请后 status 变为 accepted。
  - 创建 habit_streak 挑战，另一用户加入后，排行榜按 checkin 次数正确排序。

### 关键文件

- 后端：
  - `planning-app/services/api/prisma/schema.prisma`
  - `planning-app/services/api/src/app.module.ts`
  - `planning-app/services/api/src/modules/social/social.service.ts`
  - `planning-app/services/api/src/modules/social/social.controller.ts`
  - `planning-app/services/api/src/modules/social/social.module.ts`
  - `planning-app/services/api/src/modules/social/dto/*.ts`
  - `planning-app/services/api/src/modules/social/social.service.spec.ts`
- Flutter：
  - `planning-app/apps/mobile/lib/screens/social_screen.dart`
  - `planning-app/apps/mobile/lib/screens/goal_screen.dart`
  - `planning-app/apps/mobile/lib/screens/more_screen.dart`
  - `planning-app/apps/mobile/lib/providers/social_provider.dart`

### 已知问题与遗留项

1. 排行榜中的用户显示为邮箱，后续可增加昵称/头像。
2. 共享目标目前仅做查看，未实现「编辑」权限的实际控制。
3. 挑战未关联具体目标/习惯，所有用户按全局 checkin/task 计分，后续可按目标过滤。
4. 社交页面未接入本地 SQLite 缓存，离线不可用。
5. 未实现实时推送共享邀请/排行榜变化。

### 进入下一步

按 `development-roadmap.md` 选择 Week 16+ 方向，推荐：
- Week 16：外部集成（Google/Outlook 日历同步）。
- 或继续打磨 Week 15：添加昵称、共享目标编辑权限、挑战与目标/习惯关联。


## Week 16：外部集成（2026-08-13）

### 目标
打通外部日历和运动设备数据，减少用户在计划 App 中的手动录入。

### 已完成工作

1. **后端：数据模型扩展**
   - `CalendarEvent` 新增 `source` 字段，用于标记事件来源（ics / google / outlook）。
   - 新增 `ExternalActivity` 模型，保存从运动设备导入的原始活动记录。
   - 更新 `User` 与 `ExternalActivity` 关系字段。

2. **后端：ICS 导入/导出与外部日历订阅**
   - `POST /calendar/import-ics`：接收 ICS 文本，解析 `VEVENT`，按 `(title, startAt)` 去重后落库。
   - `GET /calendar/export-ics`：将当前用户日历事件导出为 ICS 文本（返回 JSON `{ icsText }`）。
   - `POST /calendar/sync-external`：通过 URL 拉取 ICS 并导入，兼容 Google/Outlook 公开 ICS 地址。
   - 依赖新增：`node-ical` 解析 ICS，`ical-generator` 生成 ICS。

3. **后端：运动数据导入**
   - 新建 `services/api/src/modules/external/`：Controller、Service、DTO、测试。
   - `POST /external/fitness-import`：接收运动 JSON 数组，保存到 `ExternalActivity`。
   - 若提供 `habitId` 且属于当前用户，自动为每条记录创建习惯打卡。

4. **后端：模块注册与迁移**
   - 在 `app.module.ts` 导入 `ExternalModule`。
   - 新增迁移 `20260814083000_add_external_integration`：添加 `calendar_events.source` 列与 `external_activities` 表。

5. **后端：测试**
   - 更新 `calendar.service.spec.ts`：覆盖 ICS 导入、导出、外部日历同步。
   - 新增 `external.service.spec.ts`：覆盖运动数据导入、 habit 关联打卡、习惯校验。

6. **Flutter：日历外部集成入口**
   - `CalendarScreen` AppBar 增加菜单：导入 ICS、导出 ICS、订阅外部日历。
   - `calendar_provider.dart` 新增 `importIcs`、`exportIcs`、`syncExternalCalendar`。

7. **Flutter：运动数据导入页**
   - 新增 `FitnessImportScreen`：支持单条录入和批量 JSON 导入。
   - 可填写数据来源、运动类型、时间、时长、距离、卡路里，并可关联习惯 ID。
   - 新增 `external_provider.dart` 封装 `/external/fitness-import`。

8. **Flutter：导航入口**
   - `MoreScreen` 增加「运动导入」入口。

### 验证结果

- 后端 `npm run build`：成功
- 后端 `npm run lint`：通过
- 后端 `npm run test`：16 suites / 77 tests 全部通过
- Flutter `flutter analyze`：No issues found
- 服务器端到端验证（部署后）：
  - 导入 ICS 文本后，日历事件列表出现对应事件。
  - 导出 ICS 包含已创建事件。
  - 订阅 Google Calendar 公开 ICS URL 成功拉取事件。
  - 运动数据导入成功保存记录；关联 habitId 后自动生成打卡。

### 关键文件

- 后端：
  - `planning-app/services/api/prisma/schema.prisma`
  - `planning-app/services/api/prisma/migrations/20260814083000_add_external_integration/migration.sql`
  - `planning-app/services/api/src/app.module.ts`
  - `planning-app/services/api/src/modules/calendar/calendar.service.ts`
  - `planning-app/services/api/src/modules/calendar/calendar.controller.ts`
  - `planning-app/services/api/src/modules/calendar/dto/import-ics.dto.ts`
  - `planning-app/services/api/src/modules/calendar/dto/sync-external-calendar.dto.ts`
  - `planning-app/services/api/src/modules/external/external.service.ts`
  - `planning-app/services/api/src/modules/external/external.controller.ts`
  - `planning-app/services/api/src/modules/external/dto/import-fitness-data.dto.ts`
  - `planning-app/services/api/src/modules/calendar/calendar.service.spec.ts`
  - `planning-app/services/api/src/modules/external/external.service.spec.ts`
- Flutter：
  - `planning-app/apps/mobile/lib/screens/calendar_screen.dart`
  - `planning-app/apps/mobile/lib/screens/fitness_import_screen.dart`
  - `planning-app/apps/mobile/lib/screens/more_screen.dart`
  - `planning-app/apps/mobile/lib/providers/calendar_provider.dart`
  - `planning-app/apps/mobile/lib/providers/external_provider.dart`
- 文档：
  - `planning-app/docs/api.md`
  - `planning-app/docs/development-roadmap.md`
  - `planning-app/docs/handover-summary.md`
  - `decisions/2026-08-14-Week16外部集成决策.md`

### 已知问题与遗留项

1. 未实现 Google/Outlook OAuth，当前仅支持公开 ICS URL 或用户粘贴 ICS 文本；私有日历需先导出公开地址。
2. 运动数据未接入真实设备 SDK/Health Connect，仅提供 JSON 占位导入。
3. 外部日历订阅暂无定时轮询，需要手动触发或后续增加后台任务。
4. ICS 导入按 `(title, startAt)` 去重，UID 映射留待后续完善。

### 进入下一步

按 `development-roadmap.md` 选择 Week 17+ 方向，推荐：
- Week 17：数据报表（周/月/年执行报表、能量曲线分析、最佳完成时段）。


## Week 17：数据报表（2026-08-13）

### 目标
把用户累积的任务、习惯、打卡数据转化为可感知的执行反馈，帮助用户复盘。

### 已完成工作

1. **后端：新建 ReportsModule**
   - `services/api/src/modules/reports/`：Controller、Service、DTO、测试。
   - `GET /reports/execution?period=weekly|monthly|yearly&date=YYYY-MM-DD`：
     - 按周期统计任务完成（total/done/skipped/postponed/completionRate）。
     - 按周期统计习惯打卡（totalCheckins/completed/partial/skipped/makeup/completionRate）。
     - 统计目标数量（active/completed/archived/total）。
   - `GET /reports/energy`：
     - 读取用户 `energyCurve` 偏好。
     - 按任务 `energyLevel` 统计完成率。
     - 返回简单建议。
   - `GET /reports/best-time`：
     - 基于近 90 天打卡 `createdAt` 小时分布，返回 24 小时完成统计与最佳时段。

2. **后端：复用现有数据表**
   - 不新增 Prisma 模型，通过 `Task`、`Checkin`、`Goal`、`User` 聚合计算。

3. **后端：模块注册**
   - 在 `app.module.ts` 导入 `ReportsModule`。

4. **后端：测试**
   - 新增 `reports.service.spec.ts`：覆盖执行报表、能量分析、最佳时段统计。

5. **Flutter：数据报表页面**
   - 新增 `ReportsScreen`：底部 Tab 切换「执行」「能量」「时段」。
   - 执行 Tab：周/月/年切换 + 日期选择 + 任务/习惯/目标汇总卡片。
   - 能量 Tab：展示精力曲线偏好与各能量等级完成率，给出建议卡片。
   - 时段 Tab：24 小时柱状图（纯 Container 实现）+ 最佳时段提示。

6. **Flutter：导航与 Provider**
   - `MoreScreen` 增加「数据报表」入口。
   - 新增 `reports_provider.dart` 封装三个报表接口。

### 验证结果

- 后端 `npm run build`：成功
- 后端 `npm run lint`：通过
- 后端 `npm run test`：17 suites / 80 tests 全部通过
- Flutter `flutter analyze`：No issues found
- 服务器端到端验证（部署后）：
  - `GET /reports/execution?period=weekly&date=2026-08-17` 返回正确的任务/习惯/目标汇总。
  - `GET /reports/energy` 返回精力曲线与完成率建议。
  - `GET /reports/best-time` 返回 24 小时分布与最佳时段。

### 关键文件

- 后端：
  - `planning-app/services/api/src/app.module.ts`
  - `planning-app/services/api/src/modules/reports/reports.service.ts`
  - `planning-app/services/api/src/modules/reports/reports.controller.ts`
  - `planning-app/services/api/src/modules/reports/reports.module.ts`
  - `planning-app/services/api/src/modules/reports/dto/execution-report-query.dto.ts`
  - `planning-app/services/api/src/modules/reports/reports.service.spec.ts`
- Flutter：
  - `planning-app/apps/mobile/lib/screens/reports_screen.dart`
  - `planning-app/apps/mobile/lib/providers/reports_provider.dart`
  - `planning-app/apps/mobile/lib/screens/more_screen.dart`
- 文档：
  - `planning-app/docs/api.md`
  - `planning-app/docs/development-roadmap.md`
  - `planning-app/docs/development-log.md`
  - `planning-app/docs/handover-summary.md`

### 已知问题与遗留项

1. 报表周期边界使用 UTC，未按用户 `timezone` 做本地时区转换。
2. 未实现周期环比（与上一周/月/年对比）。
3. 未缓存报表结果，数据量大时可能较慢。
4. 未接入真实图表库，当前柱状图用 Container 实现。

### 进入下一步

按 `development-roadmap.md` 选择 Week 18+ 方向，推荐：
- Week 18：高级 AI（基于长期行为的个性化计划、用户画像摘要）。


## Week 18：高级 AI（2026-08-13）

### 目标
基于用户长期行为数据，生成用户画像摘要和个性化计划建议。

### 已完成工作

1. **后端：新建 AiInsightsService**
   - `services/api/src/modules/ai/ai-insights.service.ts`：
     - 聚合历史任务、习惯打卡、目标数据，计算完成率、打卡率、推迟原因、活跃天数、常见精力等级。
   - `GET /ai/profile-summary`：
     - 使用 strong 模型生成用户画像摘要（summary / strengths / weaknesses / suggestedFocus / riskAreas）。
     - 未配置模型或费用超限时，降级为基于统计规则的摘要。
     - 返回附带 `stats` 与 `fallback` 标记。
   - `GET /ai/personalized-recommendations?goalId=`：
     - 基于用户画像统计和可选目标，给出下一步目标、习惯、排程建议。
     - 规则驱动，无需额外模型调用。
   - 调用记录写入 `AIOperation`，计入每日 AI 费用上限。

2. **后端：模块扩展**
   - `AiModule` 注册 `AiInsightsService`。
   - `AiController` 新增 `/ai/profile-summary` 与 `/ai/personalized-recommendations`。

3. **后端：测试**
   - 新增 `ai-insights.service.spec.ts`：覆盖模型生成、降级规则、个性化推荐规则。

4. **Flutter：AI 洞察页面**
   - 新增 `AiInsightsScreen`：展示用户画像摘要、核心数据、个性化建议。
   - 新增 `ai_insights_provider.dart` 封装两个接口。
   - `MoreScreen` 增加「AI 洞察」入口。

### 验证结果

- 后端 `npm run build`：成功
- 后端 `npm run lint`：通过
- 后端 `npm run test`：18 suites / 83 tests 全部通过
- Flutter `flutter analyze`：No issues found
- 服务器端到端验证（部署后）：
  - `GET /ai/profile-summary` 返回画像摘要与统计数据。
  - `GET /ai/personalized-recommendations` 返回目标/习惯/排程建议。
  - AI 未配置时返回 `fallback: true` 与规则摘要。

### 关键文件

- 后端：
  - `planning-app/services/api/src/modules/ai/ai.module.ts`
  - `planning-app/services/api/src/modules/ai/ai.controller.ts`
  - `planning-app/services/api/src/modules/ai/ai-insights.service.ts`
  - `planning-app/services/api/src/modules/ai/dto/personalized-recommendations-query.dto.ts`
  - `planning-app/services/api/src/modules/ai/ai-insights.service.spec.ts`
- Flutter：
  - `planning-app/apps/mobile/lib/screens/ai_insights_screen.dart`
  - `planning-app/apps/mobile/lib/providers/ai_insights_provider.dart`
  - `planning-app/apps/mobile/lib/screens/more_screen.dart`
- 文档：
  - `planning-app/docs/api.md`
  - `planning-app/docs/development-roadmap.md`
  - `planning-app/docs/development-log.md`
  - `planning-app/docs/handover-summary.md`

### 已知问题与遗留项

1. profile-summary 依赖 strong 模型，调用成本较高；已纳入日费用上限控制。
2. 当前分析维度有限，未结合任务实际完成时间与用户精力曲线做深度关联。
3. 未实现周期性自动刷新画像，需用户手动触发。

### 进入下一步

按 `development-roadmap.md` 选择 Week 19+ 方向。经商议当前阶段为**个人使用版本**，推荐：
- Week 19：个人多端离线同步补全（Inbox、Calendar、ExternalActivity）。



## Week 19：个人多端离线同步补全（已完成）

### 目标
把 Week 12-18 新增的个人核心数据（Inbox、Calendar、ExternalActivity）纳入多端离线同步体系，使个人在多设备间无网可查看、联网后自动合并。当前为个人使用版本，Social 模块代码保留但不扩展离线同步。

### 已完成工作

1. **后端：扩展 `SyncEvent` 广播**
   - `services/api/src/modules/sync/sync-events.service.ts`：
     - 新增 `SyncTargetType` 联合类型，扩展 `SyncEventPayload.targetType` 支持 `inbox` / `calendar` / `external`。
   - `services/api/src/modules/inbox/inbox.service.ts`：
     - 注入 `SyncEventsService`。
     - `create` / `update` / `dismiss` / `convert` 成功后分别广播 `inbox.created` / `inbox.updated` / `inbox.dismissed` / `inbox.converted`。
   - `services/api/src/modules/calendar/calendar.service.ts`：
     - 注入 `SyncEventsService`。
     - `create` / `update` / `remove` / `importIcs` 成功后分别广播 `calendar.created` / `calendar.updated` / `calendar.deleted` / `calendar.imported`。
   - `services/api/src/modules/external/external.service.ts`：
     - 注入 `SyncEventsService`。
     - `importFitnessData` 成功后广播 `external.imported`。

2. **后端：扩展 `/sync/events` 查询支持 `eventType` 过滤**
   - `services/api/src/modules/sync/dto/query-sync-events.dto.ts`：新增 `eventType` 可选字段。
   - `services/api/src/modules/sync/sync-events.controller.ts` 与 `sync-events.service.ts`：透传 `eventType` 到 Prisma 查询。

3. **Flutter：扩展本地数据库**
   - `apps/mobile/lib/services/local_database.dart`：
     - 数据库版本从 1 升级到 2，`onUpgrade` 中创建新表。
     - 新增 `inbox_items` 表与 `upsertInboxItem` / `getInboxItems` / `updateInboxItemStatus` / `clearInboxItems`。
     - 新增 `calendar_events` 表与 `upsertCalendarEvent` / `getCalendarEventsByRange` / `getAllCalendarEvents` / `deleteCalendarEvent` / `clearCalendarEvents`。

4. **Flutter：扩展同步引擎操作类型**
   - `apps/mobile/lib/services/sync_engine.dart`：
     - `pushOperations` 增加 `create_inbox` / `update_inbox` / `dismiss_inbox` / `convert_inbox` / `create_calendar` / `update_calendar` / `delete_calendar`。

5. **Flutter：改造 Provider 为本地优先 + 离线同步**
   - `apps/mobile/lib/providers/inbox_provider.dart`：重写为本地优先读取，操作入队并通过 `SyncEngine` 推送；监听 `inbox.*` 同步事件刷新列表。
   - `apps/mobile/lib/providers/calendar_provider.dart`：重写为本地优先读取，操作入队并通过 `SyncEngine` 推送；监听 `calendar.*` 同步事件刷新列表。
   - `apps/mobile/lib/providers/social_provider.dart`：保持在线只读，个人版不接入离线队列。

6. **测试更新**
   - 更新 `inbox.service.spec.ts` / `calendar.service.spec.ts` / `external.service.spec.ts`，为 `SyncEventsService` 提供 mock。

### 验证结果

- 后端 `npm run test`：18 suites / 83 tests 全部通过。
- 后端 `npm run lint`：通过。
- 后端 `npm run build`：成功。
- Flutter `flutter analyze`：No issues found。
- 服务器端到端验证（部署后）：
  - `GET /api/v1/health` 返回 `{"status":"ok","service":"planning-app-api","version":"0.0.1"}`。
  - 创建收件箱条目后，`GET /api/v1/sync/events` 返回 `inbox.created`。
  - 创建日历事件后，`GET /api/v1/sync/events?eventType=calendar.created` 正确过滤返回 `calendar.created`。
  - 部署踩坑：
    - 旧 `.env` 随旧目录被删除，需从 `planning-app-backup/.env` 复制。
    - `nest build` 只生成 `.d.ts` 时需删除 `dist/` 与 `tsconfig.tsbuildinfo` 后重新构建。
    - 服务器 `bcrypt` 原生绑定需 `npm rebuild bcrypt --build-from-source`。

### 关键文件

- 后端：
  - `services/api/src/modules/sync/sync-events.service.ts`
  - `services/api/src/modules/sync/sync-events.controller.ts`
  - `services/api/src/modules/sync/dto/query-sync-events.dto.ts`
  - `services/api/src/modules/inbox/inbox.service.ts`
  - `services/api/src/modules/inbox/inbox.module.ts`
  - `services/api/src/modules/calendar/calendar.service.ts`
  - `services/api/src/modules/calendar/calendar.module.ts`
  - `services/api/src/modules/external/external.service.ts`
  - `services/api/src/modules/external/external.module.ts`
- Flutter：
  - `apps/mobile/lib/services/local_database.dart`
  - `apps/mobile/lib/services/sync_engine.dart`
  - `apps/mobile/lib/providers/inbox_provider.dart`
  - `apps/mobile/lib/providers/calendar_provider.dart`
- 测试：
  - `services/api/src/modules/inbox/inbox.service.spec.ts`
  - `services/api/src/modules/calendar/calendar.service.spec.ts`
  - `services/api/src/modules/external/external.service.spec.ts`

### 已知问题与遗留项

1. 冲突解决策略仍为最后写入优先，未实现 CRDT/版本向量（个人版足够，商业版需深化）。
2. `ExternalActivity` 导入后的本地缓存刷新依赖重新拉取全量日历/报表，未做增量更新。
3. Social 模块离线同步未接入，商业版回归时需扩展 `SyncEvent` 广播与 Flutter 本地表。

### 进入下一步

按 `development-roadmap.md` 进入：
- Week 20：个人版设置与体验打磨。



## Week 20：个人版设置与体验打磨（已完成）

### 目标

补全个人版核心体验的最后一公里：设置页真正可用、登录注册更完整、列表支持筛选排序、今日页可预览明日任务，使 App 从「功能可用」进入「日常可用」。

### 已完成工作

1. **后端：用户偏好默认值与校验补全**
   - `services/api/src/modules/users/dto/update-preferences.dto.ts`：
     - 拆分为嵌套 DTO：`AvailableTimeDto` / `EnergyCurveDto` / `NotificationSettingDto`。
     - 可用时间支持 `monday`—`sunday` 七个字段，每个字段为 `TimeSlotDto[]`。
     - 通知偏好支持 `reminderMinutesBefore`、`doNotDisturbStart`、`doNotDisturbEnd`、`weekendOff`。
   - `services/api/src/modules/users/users.service.ts`：
     - `updatePreferences` 改为直接替换 `preferences` JSON，并在保存前补全默认值（空对象→空数组/空对象）。
     - `getMe` 返回的 `preferences` 字段与 DTO 保持一致。

2. **后端：模板关键词调优**
   - `services/api/src/modules/ai/templates/ai-templates.ts`：
     - 为 6 个预置模板扩展同义词关键词，覆盖常见口语化输入。
     - 考研英语：新增「英语一/二」「GRE/GMAT/雅思/托福」「四六级/CET」。
     - 减脂入门：新增「减肥」「瘦身」「BMI」「体脂」。
     - 晨间习惯：新增「早起」「晨跑」「冥想」「morning routine」。
     - 阅读计划：新增「看书」「读书」「一年读 50 本」。
     - 日语入门：新增「日文」「JLPT」「N1/N2/N3」。
     - 5 公里跑步：新增「慢跑」「长跑」「配速」「半马/全马」。

3. **Flutter：设置页升级**
   - `apps/mobile/lib/screens/settings_screen.dart` 重写：
     - 一周七天（monday—sunday）多时段可用时间编辑。
     - 24 小时精力曲线点击切换高/中/低。
     - 通知偏好：提前分钟数、免打扰时段、周末关闭开关。
     - 统一「保存」按钮 + SnackBar 反馈。
   - `apps/mobile/lib/providers/settings_provider.dart`：
     - `UserPreferences` 模型增加 `availableTime` / `energyCurve` / `notificationSetting`。
     - `updatePreferences` 透传嵌套结构体到后端。

4. **Flutter：登录/注册 UI 完善**
   - `apps/mobile/lib/providers/auth_provider.dart`：新增 `register` 方法，复用 `ApiClient` 与 token 持久化。
   - `apps/mobile/lib/screens/login_screen.dart` 重写：
     - 登录/注册切换。
     - 表单校验：邮箱格式、密码长度。
     - 密码可见性切换。
     - 错误提示与 loading 状态。

5. **Flutter：AI 计划页模板默认值回填**
   - `apps/mobile/lib/screens/ai_plan_draft_screen.dart`：
     - 选择/推荐模板时自动回填 `planDuration` 与 `stageLength`。
     - 用户仍可手动覆盖。

6. **Flutter：任务/习惯列表筛选排序**
   - `apps/mobile/lib/screens/task_screen.dart`：
     - 状态筛选（全部/待办/已完成/已跳过）。
     - 能量等级筛选（全部/高/中/低）。
     - 日期筛选（全部/今天/未来 7 天/已逾期）。
     - 排序：创建时间、日期、能量等级。
   - `apps/mobile/lib/screens/habit_screen.dart`：
     - 频率筛选（全部/每天/每周/工作日）。
     - 能量等级筛选。
     - 排序：创建时间、标题。
     - 创建习惯时增加能量等级选择。

7. **Flutter：今日页明日预览**
   - `apps/mobile/lib/screens/today_screen.dart`：
     - 概览卡片下方新增「明日预览」入口卡片。
     - 点击打开底部抽屉，展示明日（未完成任务）列表。
     - 使用 `tasksProvider(date)` 按日期拉取数据。

8. **验证与修复**
   - 后端 `npm run test`：18 suites / 83 tests 全部通过。
   - 后端 `npm run lint`：通过。
   - 后端 `npm run build`：通过。
   - Flutter `flutter analyze`：No issues found。
   - 修复 `task_screen.dart`：`prefer_final_locals` 与 `DropdownButtonFormField.value` 已弃用警告。

### 验证结果

- 后端 `npm run test`：18 suites / 83 tests 全部通过。
- 后端 `npm run lint`：通过。
- 后端 `npm run build`：通过。
- Flutter `flutter analyze`：No issues found。
- 服务器端到端验证（部署后）：
  - `GET /api/v1/health` 返回 `{"status":"ok","service":"planning-app-api","version":"0.0.1"}`。
  - `PATCH /api/v1/users/me/preferences` 支持嵌套结构体：`availableTime.monday`、`energyCurve.0`、`notificationSetting.doNotDisturbStart` 等。
  - `GET /api/v1/users/me` 正确返回保存后的偏好。
  - `GET /api/v1/ai/templates/recommend?input=考研英语单词` 返回 `postgraduate-english` 模板。

### 关键文件

- 后端：
  - `services/api/src/modules/users/dto/update-preferences.dto.ts`
  - `services/api/src/modules/users/users.service.ts`
  - `services/api/src/modules/ai/templates/ai-templates.ts`
- Flutter：
  - `apps/mobile/lib/screens/settings_screen.dart`
  - `apps/mobile/lib/providers/settings_provider.dart`
  - `apps/mobile/lib/screens/login_screen.dart`
  - `apps/mobile/lib/providers/auth_provider.dart`
  - `apps/mobile/lib/screens/ai_plan_draft_screen.dart`
  - `apps/mobile/lib/screens/task_screen.dart`
  - `apps/mobile/lib/screens/habit_screen.dart`
  - `apps/mobile/lib/screens/today_screen.dart`

### 已知问题与遗留项

1. 设置页精力曲线目前为 24 个独立按钮，未使用图表/曲线可视化。
2. 任务/习惯筛选排序状态未持久化，退出页面后重置。
3. 明日预览仅展示任务，未展示明日习惯/提醒。
4. 列表未实现下拉刷新与空状态引导。
5. iOS 平台目录与通知配置仍为 Week 21 待办。

### 进入下一步

按 `development-roadmap.md` 进入：
- Week 21：个人版生产加固与性能优化。



## Week 21：个人版生产加固与性能优化（已完成）

### 目标

为个人长期自用清理历史债务、提升稳定性与响应速度。备份/日志策略以满足个人数据安全为主，商业化级异地容灾作为可选项保留脚本占位，不强制启用。

### 已完成工作

1. **数据库索引优化**
   - `planning-app/services/api/prisma/schema.prisma`：
     - `Task` 新增索引：`scheduledDate`、`status`、`[userId, status]`。
     - `Checkin` 新增索引：`date`（已有 `[userId, date]`）。
     - `CalendarEvent` 新增索引：`startAt`、`[userId, startAt]`。
     - `AIOperation` 新增索引：`createdAt`。
   - 新增 Prisma 迁移：`20260813190000_add_performance_indexes_and_ai_summary`，已部署到服务器。

2. **AIOperation 自动清理**
   - 新增 `planning-app/services/api/src/modules/ai/ai-cleanup.service.ts`：
     - 每天凌晨 3 点执行 `@Cron("0 3 * * *")`。
     - 清理 30 天前的 `AIOperation` 原始记录。
     - 清理前按 `DATE(createdAt)` + `userId` 汇总为 `AIDailyCostSummary` 并 `upsert`。
   - 新增 Prisma 模型 `AIDailyCostSummary`：
     - `id/userId/date/totalCost/callCount`，`@@unique([userId, date])`。
   - `services/api/src/modules/ai/ai.module.ts` 注册 `AiCleanupService`。
   - 新增 `ai-cleanup.service.spec.ts` 测试。

3. **报表 Redis 缓存与失效**
   - 修改 `services/api/src/modules/reports/reports.service.ts`：
     - 注入 `REDIS_CLIENT`。
     - 三个报表接口先查 Redis，命中直接返回；未命中计算后 `setex` 写入，TTL 1 小时。
     - 提供 `invalidateCache(userId)` 按 `reports:{userId}:*` 通配清除。
   - 新增轻量级事件总线 `services/api/src/common/events/report-cache.events.ts`。
   - 在 `TasksService`、`HabitsService`、`GoalsService`、`CalendarService` 的创建/更新/删除/打卡/导入操作后调用 `emitReportCacheInvalidation(userId)`。
   - `services/api/src/modules/reports/reports.module.ts` 导入 `RedisModule`。
   - 更新 `reports.service.spec.ts` mock `REDIS_CLIENT`。

4. **Nginx 日志轮转**
   - 服务器新增 `/etc/logrotate.d/nginx-planning`：
     - 轮转 `/var/log/nginx/*.log`，daily，保留 14 天，压缩。
     - postrotate 发送 `USR1` 给 Nginx 重新打开日志。
   - 验证：`logrotate -d /etc/logrotate.d/nginx-planning` 配置通过。

5. **数据库备份脚本增强与远程上传占位**
   - 重写服务器 `/opt/backups/backup-planning-db.sh`：
     - 保留本地 7 天滚动删除。
     - 输出详细日志到 `/var/log/planning-backup.log`。
     - 新增可选远程备份开关 `REMOTE_BACKUP_ENABLED` 及配置变量占位。
   - 新增 `/opt/backups/backup-planning-db-to-oss.sh` 占位脚本：
     - 提供 aliyun ossutil / aws cli / rclone 示例命令，当前不实际上传。
   - 项目内备份脚本副本保存到 `planning-app/ops/`。

6. **Flutter iOS 平台与通知配置**
   - 执行 `flutter create --platforms=ios .` 生成 `ios/` 目录。
   - `ios/Runner/Info.plist`：
     - 增加 `UIBackgroundModes`（fetch / remote-notification）。
     - 增加 `NSUserNotificationUsageDescription`。
   - `ios/Runner/AppDelegate.swift`：请求通知授权并注册远程通知。

7. **本地通知点击跳转**
   - `apps/mobile/lib/services/notification_service.dart`：
     - iOS 初始化设置 `DarwinInitializationSettings`。
     - 新增静态回调 `onNotificationTap`。
   - `apps/mobile/lib/main.dart`：
     - 设置 `NotificationService.onNotificationTap` 点击后导航到 `TodayScreen`。

8. **Android 精确闹钟权限引导**
   - `NotificationService` 增加 `canScheduleExactNotifications()` 与 `requestExactAlarmPermission()`（使用 `android_intent_plus` 打开系统设置）。
   - `AndroidManifest.xml` 已声明 `SCHEDULE_EXACT_ALARM` 权限。
   - `settings_screen.dart` 新增 Android 精确闹钟权限卡片，未获取时显示「去开启」按钮。

9. **报表页 fl_chart**
   - `pubspec.yaml` 新增 `fl_chart: ^0.68.0` 与 `android_intent_plus: ^5.0.0`。
   - `apps/mobile/lib/screens/reports_screen.dart`：
     - 用 `BarChart` 替换手写的最佳完成时段柱状图。
     - 保留原有数据解析逻辑。
   - 修复 `test/widget_test.dart` 引用错误（`MyApp` → `PlanningApp`）。

### 验证结果

- 后端 `npm run test`：19 suites / 85 tests 全部通过。
- 后端 `npm run lint`：通过。
- 后端 `npm run build`：通过。
- Flutter `flutter analyze`：No issues found。
- 服务器端到端验证（部署后）：
  - `GET /api/v1/health` 返回 ok。
  - Prisma 迁移 `20260813190000_add_performance_indexes_and_ai_summary` 已应用。
  - `ai_daily_cost_summaries` 表已创建。
  - 报表接口首次调用写入 Redis，二次调用命中缓存；创建任务后缓存被清除（`redis-cli keys 'reports:*'` 为空）。
  - 数据库备份脚本手动执行成功，生成 `planning_app_20260813_*.dump`。

### 关键文件

- 后端：
  - `planning-app/services/api/prisma/schema.prisma`
  - `planning-app/services/api/prisma/migrations/20260813190000_add_performance_indexes_and_ai_summary/migration.sql`
  - `planning-app/services/api/src/modules/ai/ai-cleanup.service.ts`
  - `planning-app/services/api/src/modules/ai/ai-cleanup.service.spec.ts`
  - `planning-app/services/api/src/modules/ai/ai.module.ts`
  - `planning-app/services/api/src/modules/reports/reports.service.ts`
  - `planning-app/services/api/src/modules/reports/reports.module.ts`
  - `planning-app/services/api/src/modules/reports/reports.service.spec.ts`
  - `planning-app/services/api/src/common/events/report-cache.events.ts`
  - `planning-app/services/api/src/modules/tasks/tasks.service.ts`
  - `planning-app/services/api/src/modules/habits/habits.service.ts`
  - `planning-app/services/api/src/modules/goals/goals.service.ts`
  - `planning-app/services/api/src/modules/calendar/calendar.service.ts`
- 服务器：
  - `/etc/logrotate.d/nginx-planning`
  - `/opt/backups/backup-planning-db.sh`
  - `/opt/backups/backup-planning-db-to-oss.sh`
  - `planning-app/ops/backup-planning-db.sh`
  - `planning-app/ops/backup-planning-db-to-oss.sh`
- Flutter：
  - `planning-app/apps/mobile/ios/Runner/Info.plist`
  - `planning-app/apps/mobile/ios/Runner/AppDelegate.swift`
  - `planning-app/apps/mobile/lib/services/notification_service.dart`
  - `planning-app/apps/mobile/lib/main.dart`
  - `planning-app/apps/mobile/lib/screens/settings_screen.dart`
  - `planning-app/apps/mobile/lib/screens/reports_screen.dart`
  - `planning-app/apps/mobile/pubspec.yaml`
  - `planning-app/apps/mobile/test/widget_test.dart`

### 已知问题与遗留项

1. iOS 推送证书与真机调试需要 Apple Developer 账号，当前仅做代码与模拟器验证。
2. 远程备份脚本为占位实现，需用户自行配置云厂商 CLI 与密钥后启用。
3. 报表缓存失效使用 `keys` + `del`，用户量极大时建议改用 `SCAN`。
4. AIOperation 清理任务默认 3 点执行，服务器时区需保持 CST（与 cron 一致）。
5. 通知点击目前统一跳转「今日页」，未来可按 reminder payload 区分任务/习惯详情。

### 进入下一步

当前为个人使用版本核心功能收尾。后续方向：
- 商业版开发（Week 22+）：订阅/团队/数据导出、社交深度、高级 AI、外部集成深化等。
- 稳定性与规模化：监控告警、性能压测、代码仓库与 CI/CD。


## Week 24：高级 AI 深化（已完成）

### 目标

解决 AI 计划生成 40–150s 阻塞等待问题；引入用户画像快照并周期性自动刷新；根据历史目标行为优化模板推荐排序。

### 已完成工作

1. **SSE 流式计划生成（后端）**
   - 新增 `services/api/src/modules/ai/model-adapter.service.ts`：`streamProgress()` 通过 `AsyncGenerator` 发送 `progress` / `result` 事件。
   - 新增 `services/api/src/modules/ai/plan-orchestrator.service.ts`：`generateDraftStream()` 产出 `analyzing_input` / `selecting_template` / `generating_plan` / `validating_plan` 阶段事件与最终 `result`。
   - 新增 `services/api/src/modules/ai/ai.service.ts`：`createStreamDraft()` 快速创建 pending 草案；`streamDraft()` 改为真正 SSE 流，支持费用上限降级、PlanVersion 更新、AIOperation 写入。
   - `services/api/src/modules/ai/ai.controller.ts`：新增 `POST /ai/plan-drafts/stream`，`GET /ai/plan-drafts/:id/stream` 保持 `@Sse` 但连接真实流式生成。

2. **SSE 流式计划生成（Flutter）**
   - 新建 `apps/mobile/lib/services/sse_client.dart`：使用 `package:http` 流式读取 `text/event-stream`，解析 `progress` / `draft` / `done` / `error` 事件。
   - `apps/mobile/lib/providers/ai_provider.dart`：新增 `createDraftStream()` 与 `AiDraftStreamEvent` 事件类型。
   - `apps/mobile/lib/screens/ai_plan_draft_screen.dart`：生成按钮触发流式生成，展示阶段进度条与最终草案；生成过程中禁用确认按钮。

3. **用户画像自动刷新与快照**
   - `services/api/prisma/schema.prisma` 新增 `UserProfileSnapshot` 模型；创建迁移 `20260813200000_add_user_profile_snapshot`。
   - `services/api/src/modules/ai/ai-insights.service.ts`：
     - `generateProfileSummary()` 拆出私有方法，保留实时生成能力。
     - 新增 `refreshProfileSnapshot()`。
     - 新增 `@Cron("0 3 * * 0") autoRefreshProfiles()`，每周日 03:00 串行刷新所有活跃用户快照。
     - `getProfileSummary(userId, useSnapshot)` 支持优先读快照；实时生成成功后自动落快照。
   - `services/api/src/modules/ai/ai.controller.ts`：`GET /ai/profile-summary` 增加 `useSnapshot` 查询参数。
   - `apps/mobile/lib/providers/ai_insights_provider.dart`：新增 `refreshProfileSummary()`。
   - `apps/mobile/lib/screens/ai_insights_screen.dart`：显示「最后刷新时间」，顶部 actions 增加「立即刷新」按钮。

4. **模板推荐历史权重**
   - `services/api/src/modules/ai/templates/ai-templates.ts`：新增 `UserHistoryHint`，`recommendTemplate()` 在历史目标标题命中、已完成目标命中、关键词对应完成率 ≥70% 时加分。
   - `services/api/src/modules/ai/ai.service.ts`：`getTemplateRecommendation()` 异步读取当前用户 `Goal.title/status` 构造历史权重。
   - `services/api/src/modules/ai/ai.controller.ts`：`GET /ai/templates/recommend` 改为 async 并传入 `userId`。

5. **测试补充**
   - `services/api/src/modules/ai/ai.service.spec.ts`：新增 `streamDraft` 正常流、费用上限降级、草案不存在错误测试；`getTemplateRecommendation` 历史权重测试。
   - `services/api/src/modules/ai/ai-insights.service.spec.ts`：新增快照命中、快照保存、`refreshProfileSnapshot`、`autoRefreshProfiles` cron 测试。

### 验证结果

- 后端 `npm run build`：通过。
- 后端 `npm run test`：19 suites / 92 tests 通过。
- Flutter `C:/Users/Administrator/flutter/bin/flutter analyze`：No issues found。

### 部署记录

- 部署时间：2026-08-13 20:45 CST。
- 备份：`/opt/planning-app-backup-week24`。
- 步骤：
  1. 本地打包（排除 `node_modules` / `.git` / `dist` / `build` / `tools/flutter`）。
  2. `scp planning-app-week24.tar.gz root@xutaostudy.xyz:/tmp/`。
  3. 服务器备份 `/opt/planning-app`。
  4. 解压覆盖，保留 `.env`。
  5. `npm install` 通过。
  6. `npx prisma generate` + `npx prisma migrate deploy` 成功应用 `20260813200000_add_user_profile_snapshot`。
  7. 删除 `dist/` 与 `tsconfig.tsbuildinfo` 后 `npm run build` 通过。
  8. `systemctl restart planning-api` 成功，服务 `active (running)`。
- 部署后验证：
  - `GET https://xutaostudy.xyz/api/v1/health` → ok。
  - `POST /api/v1/ai/plan-drafts/stream` 返回 pending `draftId`。
  - `GET /api/v1/ai/plan-drafts/:draftId/stream`（SSE）依次收到 progress → draft → done，Nginx 无缓冲。
  - `GET /api/v1/ai/profile-summary?useSnapshot=true` 返回带 `refreshedAt` 的摘要。
  - `GET /api/v1/ai/templates/recommend?input=我想减肥` 返回 `fat-loss`。

### 关键文件

- 后端：
  - `planning-app/services/api/prisma/schema.prisma`
  - `planning-app/services/api/prisma/migrations/20260813200000_add_user_profile_snapshot/migration.sql`
  - `planning-app/services/api/src/modules/ai/model-adapter.service.ts`
  - `planning-app/services/api/src/modules/ai/plan-orchestrator.service.ts`
  - `planning-app/services/api/src/modules/ai/ai.service.ts`
  - `planning-app/services/api/src/modules/ai/ai-insights.service.ts`
  - `planning-app/services/api/src/modules/ai/templates/ai-templates.ts`
  - `planning-app/services/api/src/modules/ai/ai.controller.ts`
  - `planning-app/services/api/src/modules/ai/ai.service.spec.ts`
  - `planning-app/services/api/src/modules/ai/ai-insights.service.spec.ts`
- Flutter：
  - `planning-app/apps/mobile/lib/services/sse_client.dart`
  - `planning-app/apps/mobile/lib/providers/ai_provider.dart`
  - `planning-app/apps/mobile/lib/screens/ai_plan_draft_screen.dart`
  - `planning-app/apps/mobile/lib/providers/ai_insights_provider.dart`
  - `planning-app/apps/mobile/lib/screens/ai_insights_screen.dart`
- 文档：
  - `decisions/2026-08-13-Week24高级AI深化决策.md`
  - `项目交接文档.md`
  - `planning-app/docs/handover-summary.md`
  - `planning-app/docs/development-roadmap.md`

### 踩坑记录

- `npx prisma migrate deploy` 需 `set -a && source /opt/planning-app/.env && set +a`，否则读取不到 `DATABASE_URL`。
- `nest build` 在已有 `dist/` 和 `tsconfig.tsbuildinfo` 时只生成 `.d.ts`，需删除后重新构建。
- SSE 通过 Nginx 时务必关闭 `proxy_buffering` 与 `proxy_cache`，否则事件会被缓冲到请求结束才返回。

### 遗留与后续

- SSE 客户端可后续增加自动重连与心跳。
- 若需要更接近 ChatGPT 的逐字效果，可改用 `stream: true` 并前端手动提取 JSON。
- 模板推荐可后续引入 embedding 语义匹配。

---

## 进入下一步

当前为个人使用版本核心功能收尾。后续方向：
- **Week 25：外部集成深化**（Google/Outlook OAuth 私有日历、Health Connect、外部日历定时轮询）。
- **Week 26：稳定性与规模化**（监控告警、性能压测、Git 仓库与 CI/CD）。
- 商业版开发（Week 27+）：订阅/团队/数据导出、社交深度等，作为商业版备份。

## Week 25：外部集成深化（2026-08-13）

### 目标
- 支持 OAuth2 接入 Google / Outlook 私有日历并自动同步事件。
- 支持外部日历订阅（ICS URL / OAuth 账户）的周期性自动轮询。
- Flutter 接入 Health Connect 读取运动数据，回写到服务端。
- 保持现有 ICS 导入/导出能力不变。

### 后端实现
- Prisma schema 新增 `CalendarSubscription` 模型，含用户、来源、URL、加密 token、过期时间、日历 ID、同步结果等字段。
- 创建迁移文件 `20260816000000_add_calendar_subscription/migration.sql`。
- 新增依赖 `googleapis`、`@azure/msal-node`。
- 新增 `CalendarOAuthService`：
  - `initiateGoogleAuth` / `handleGoogleCallback`：生成授权 URL、处理回调、保存订阅并立即导入主日历近 30 天事件。
  - Outlook scaffold：`initiateOutlookAuth` / `handleOutlookCallback`（个人版未实现）。
  - token / OAuth state 使用 AES-256-CBC 加密，密钥来自 `OAUTH_ENCRYPTION_KEY` 或回退到 `JWT_SECRET`。
- 新增 `CalendarSyncService`：
  - `syncSubscription(id)`：按 `source` 分发（ICS 复用 `CalendarService.syncExternalCalendar`，Google 调用 `CalendarOAuthService.syncGoogleSubscription`）。
  - `@Cron('0 */6 * * *')` 每 6 小时串行轮询所有 `isActive=true` 的订阅。
  - `triggerSync(id)` 供手动触发。
- `CalendarController` 新增路由：订阅 CRUD、手动同步、Google/Outlook OAuth 入口与回调。
- `CalendarService` 新增订阅管理方法，`importIcs` 增加可选 `source` 参数。
- 新增测试：`calendar-oauth.service.spec.ts`、`calendar-sync.service.spec.ts`。

### Flutter 实现
- `pubspec.yaml` 新增 `health: ^12.2.1`、`url_launcher: ^6.3.2`。
- `ExternalApi` 新增 `syncHealthConnect()`：
  - 请求 `HealthDataType.WORKOUT` 读权限。
  - 读取 workouts 并转换为 `ImportFitnessDataDto`，调用 `/external/fitness-import`。
  - 映射运动类型：RUNNING→run、WALKING→walk、BIKING/HAND_CYCLING→cycle、SWIMMING→swim 等。
- `FitnessImportScreen` 新增「从 Health Connect 同步」按钮。
- `CalendarNotifier` 新增 `fetchSubscriptions` / `addSubscription` / `deleteSubscription` / `syncSubscription` / `connectGoogleCalendar`。
- `CalendarScreen` 新增「管理外部日历订阅」弹窗：
  - 展示 ICS / Google / Outlook 订阅列表、上次同步时间、导入数量。
  - 支持添加 ICS、同步单个订阅、删除订阅、连接 Google 日历（打开外部浏览器授权）。

### 本地验证
- 后端 `npm run build`：通过。
- 后端 `npm run test`：21 suites / 99 tests 通过。
- Flutter `C:/Users/Administrator/flutter/bin/flutter analyze`：No issues found。

### 关键文件
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

### 踩坑记录
- `CalendarOAuthService` 中 OAuth state 加密需包含过期时间，防止重放。
- Google OAuth 必须设置 `prompt: 'consent'` 才能首次拿到 `refresh_token`。
- Health Connect 在国内部分 Android 设备需手动安装 Google Health Connect 应用。
- `flutter analyze` 对 dead null-aware expression 检查严格，需按实际类型移除 `??`。

### 遗留与后续
- 服务器尚未部署 Week 25，需按交接文档步骤执行。
- Outlook OAuth 回调目前返回未实现，商业版可补全 Microsoft Graph 调用。
- Health Connect 可后续扩展读取睡眠、心率等更细粒度数据。
- token 加密当前使用 AES + 环境密钥，生产环境可考虑 KMS/HSM。

---

## 进入下一步

当前为个人使用版本核心功能收尾。后续方向：
- **Week 26：稳定性与规模化**（监控告警、性能压测、Git 仓库与 CI/CD）。
- 商业版开发（Week 27+）：订阅/团队/数据导出、社交深度等，作为商业版备份。

## Week 26：Git 初始化与 Flutter 真机体验打磨（2026-08-13）

### 目标

1. 为 `planning-app` 建立版本控制，结束 tar 包同步方式。
2. 在真机使用场景中补齐 Flutter 本地通知、权限、错误回退与交互细节。

### 已完成工作

#### 1. Git 仓库初始化
- 在 `planning-app` 根目录执行 `git init`。
- 将嵌套的 `tools/flutter` 从 index 移除，并加入 `.gitignore`。
- 提交初始 commit：`630547f init: project baseline up to Week 25`（290 files, 42033 insertions）。
- 当前分支 `main`，工作树干净后进入后续提交。

#### 2. 本地通知点击跳转（含冷启动）
- `apps/mobile/lib/services/notification_service.dart`
  - 新增 `getLaunchNotificationPayload()`，通过 `flutter_local_notifications` 的 `getNotificationAppLaunchDetails()` 获取因点击通知而冷启动时的 payload。
- `apps/mobile/lib/main.dart`
  - 应用启动后设置 `NotificationService.onNotificationTap` 回调。
  - 检查冷启动通知 payload，若存在则在首帧渲染后通过 `navigatorKey` 导航到 `TodayScreen`。

#### 3. Android 精确闹钟权限
- `apps/mobile/android/app/src/main/AndroidManifest.xml`
  - 保留 `SCHEDULE_EXACT_ALARM` 权限声明（Android 12+ 需要用户授权）。
  - 新增 `USE_EXACT_ALARM` 权限声明（个人使用场景，避免部分国内 ROM 对精确闹钟的限制）。
- `apps/mobile/lib/services/notification_service.dart`
  - `scheduleReminder()` 捕获 `PlatformException`，识别精确闹钟权限不足时抛出更明确的提示信息。
- `apps/mobile/lib/screens/settings_screen.dart`
  - 已存在精确闹钟权限检查与设置页引导入口。

#### 4. Health Connect 错误回退 UI
- `apps/mobile/lib/providers/external_provider.dart`
  - `syncHealthConnect()` 增加 try/catch，区分「未安装/未启用 Health Connect」和「未授权」两类错误，抛出中文提示。
- `apps/mobile/lib/screens/fitness_import_screen.dart`
  - 新增 `_healthError` 状态。
  - 同步失败时展示橙色警告卡片，包含具体错误信息与「改用 JSON 导入」按钮。
  - 点击按钮自动填充示例 JSON、滚动到 JSON 区域并聚焦。

#### 5. 日历订阅弹窗下拉刷新
- `apps/mobile/lib/screens/calendar_screen.dart`
  - 在 `_CalendarSubscriptionsDialog` 的订阅列表外用 `RefreshIndicator` 包裹。
  - 设置 `physics: AlwaysScrollableScrollPhysics()`，确保列表可下拉刷新。

### 本地验证
- `C:/Users/Administrator/flutter/bin/flutter analyze --no-pub`：No issues found。

### 关键文件
- Git：
  - `planning-app/.git/`
  - `planning-app/.gitignore`
- Flutter：
  - `planning-app/apps/mobile/lib/main.dart`
  - `planning-app/apps/mobile/lib/services/notification_service.dart`
  - `planning-app/apps/mobile/lib/providers/external_provider.dart`
  - `planning-app/apps/mobile/lib/screens/fitness_import_screen.dart`
  - `planning-app/apps/mobile/lib/screens/calendar_screen.dart`
  - `planning-app/apps/mobile/android/app/src/main/AndroidManifest.xml`
- 文档：
  - `项目阶段总结.md`
  - `planning-app/docs/handover-summary.md`
  - `planning-app/docs/development-log.md`

### 踩坑记录
- `flutter_local_notifications` 的 `getNotificationAppLaunchDetails()` 需要在 `initialize()` 之后调用，且仅在冷启动时返回通知点击 payload。
- `FocusNode.requestFocus()` 返回 `void`，不可 `await`。
- 在 `AlertDialog` 的 `content` 中使用 `RefreshIndicator` 包裹 `ListView.builder` 时，需保持 `Flexible -> RefreshIndicator -> ListView` 的层级，并给 `ListView` 设置 `AlwaysScrollableScrollPhysics`。
- 个人使用场景可在 `AndroidManifest` 同时声明 `USE_EXACT_ALARM`，但 Google Play 上架需满足其使用政策。

### 遗留与后续
- 服务器尚未重新部署本次 Flutter 改动（纯客户端改动，无需服务端部署）。
- iOS 真机/HealthKit 实测仍需在 macOS + iPhone 环境验证。
- 后续可继续：服务端监控告警、数据库异地备份、处理 `npm audit` 依赖漏洞。

---

## Week 27：个人版增强 A+B（2026-08-14）

### 目标

1. **A1+A2**：接入真实 FCM 远程推送后端与 Flutter Token 上传。
2. **A3**：暴露服务端监控指标与 `/metrics` 端点。
3. **B1**：行为埋点 `UserEvent` 落库。
4. **B2**：AI 多轮对话上下文（`AISession`/`AIMessage`），`createDraft`/`replan`/`review` 支持 `sessionId`/`followUp`。
5. **Flutter 体验**：AI 计划页增加「继续对话」入口与消息列表，客户端 `api_client` 增加 `trackEvent` 并接入关键页面。

### 已完成工作

#### 1. 服务端监控指标与 `/metrics`（A3）
- `services/api/src/modules/metrics/metrics.module.ts`
- `services/api/src/modules/metrics/metrics.service.ts`
- `services/api/src/modules/metrics/metrics.controller.ts`
- 已接入 Prometheus 指标：`http_requests_total`、`ai_operations_total`、`analytics_tracked_total` 等。
- `/metrics` 端点暴露（无需 JWT，实际部署建议 Nginx 白名单或 Basic Auth）。

#### 2. FCM 真实推送后端（A1）
- `services/api/src/modules/notifications/notifications.module.ts`
- `services/api/src/modules/notifications/fcm.service.ts`
- `services/api/src/modules/notifications/notifications.controller.ts`（测试/触发接口）
- 依赖 `firebase-admin`，通过 `GOOGLE_APPLICATION_CREDENTIALS_JSON` 环境变量初始化。
- 个人版未配置 FCM 时优雅降级为日志记录。
- 新增 `POST /users/me/fcm-token` 保存/清空用户 FCM Token。

#### 3. 行为埋点落库（B1）
- `services/api/src/modules/analytics/analytics.service.ts` 提供 `track`/`trackBatch`。
- 写入 `UserEvent` 表，用于后续画像、推荐与报表。
- 关键后端操作（AI 草案创建/确认/推进、复盘、重新规划）自动触发服务端埋点。

#### 4. AI 多轮对话上下文（B2）
- `services/api/src/modules/ai/ai-session.service.ts`：会话管理、消息历史、摘要占位。
- `services/api/src/modules/ai/ai.service.ts`：
  - `createDraft` 已接入 `AiSessionService`。
  - `replan` 与 `review` 新增 `sessionId`/`followUp` 参数并接入会话历史。
- `services/api/src/modules/ai/dto/replan.dto.ts` 与 `dto/review.dto.ts`：新增 `sessionId`/`followUp`。
- `services/api/src/modules/ai/plan-orchestrator.service.ts`：`generateReplan`/`generateReview` 支持可选 `history` 并在 prompt 中拼接上下文。
- 后端单元测试 `ai.service.spec.ts` 补充 `AiSessionService` mock 并修正流式生成参数断言。

#### 5. Flutter FCM Token 上传与推送处理（A2）
- `apps/mobile/pubspec.yaml`：新增 `firebase_core: ^3.0.0`、`firebase_messaging: ^15.0.0`。
- `apps/mobile/lib/services/fcm_service.dart`：
  - 初始化 Firebase（未配置时优雅降级）。
  - 获取并上传 FCM Token 到 `POST /users/me/fcm-token`。
  - 监听 Token 刷新并重新上传。
  - 监听前台/后台远程消息。
- `apps/mobile/lib/main.dart`：启动时初始化 `FcmService`。

#### 6. Flutter 对话 UI 与埋点集成
- `apps/mobile/lib/providers/ai_provider.dart`：`createDraft`/`createDraftStream` 增加 `sessionId`/`followUp` 参数透传。
- `apps/mobile/lib/screens/ai_plan_draft_screen.dart`：
  - 保存服务端返回的 `sessionId`。
  - 生成首个草案后展示「继续对话」输入框与消息气泡。
  - 发送 follow-up 后基于同一 session 重新生成计划。
- `apps/mobile/lib/services/api_client.dart`：新增 `trackEvent` 与 `trackEvents` 方法，调用 `POST /analytics/events` 与 `/analytics/events/batch`。
- `services/api/src/modules/analytics/analytics.controller.ts`：新增 `POST /analytics/events` 与 `POST /analytics/events/batch` 客户端埋点端点。
- `services/api/src/modules/analytics/dto/track-event.dto.ts`：客户端埋点 DTO。
- 关键页面接入埋点：
  - `login_screen.dart`：登录/注册成功上报 `user.logged_in`/`user.registered`。
  - `today_screen.dart`：打开页面上报 `today.view`，完成任务上报 `task.completed`，习惯打卡上报 `habit.checkin`。
  - `ai_plan_draft_screen.dart`：生成/继续生成/确认草案分别上报 `ai.draft.generated`/`ai.draft.follow_up_generated`/`ai.draft.approved`。

### 本地验证
- `npm run test -w services/api`：21 个测试套件，99 个测试全部通过。
- `npm run build -w services/api`：通过。
- `C:/Users/Administrator/flutter/bin/flutter analyze`：No issues found。
- `C:/Users/Administrator/flutter/bin/flutter pub get`：依赖解析成功。

### 关键文件
- 后端：
  - `services/api/src/modules/metrics/*`
  - `services/api/src/modules/notifications/*`
  - `services/api/src/modules/analytics/*`
  - `services/api/src/modules/ai/ai-session.service.ts`
  - `services/api/src/modules/ai/ai.service.ts`
  - `services/api/src/modules/ai/ai.service.spec.ts`
  - `services/api/src/modules/ai/plan-orchestrator.service.ts`
  - `services/api/src/modules/ai/dto/replan.dto.ts`
  - `services/api/src/modules/ai/dto/review.dto.ts`
  - `services/api/src/modules/users/users.controller.ts`
  - `services/api/src/modules/users/users.service.ts`
- Flutter：
  - `apps/mobile/lib/services/fcm_service.dart`
  - `apps/mobile/lib/main.dart`
  - `apps/mobile/lib/providers/ai_provider.dart`
  - `apps/mobile/lib/screens/ai_plan_draft_screen.dart`
  - `apps/mobile/lib/services/api_client.dart`
  - `apps/mobile/lib/screens/login_screen.dart`
  - `apps/mobile/lib/screens/today_screen.dart`
  - `apps/mobile/pubspec.yaml`
- 文档：
  - `planning-app/docs/development-log.md`
  - `planning-app/docs/schema-changes.md`
  - `planning-app/docs/handover-summary.md`

### 踩坑记录
- `AiSessionService` 注入后，`ai.service.spec.ts` 必须提供 mock，否则 Nest 测试模块编译失败。
- 流式生成方法 `createDraftStream` 现在透传 5 个参数，原有测试断言需更新为包含 `history`。
- 客户端 `trackEvent` 端点此前缺失，需后端新增 `POST /analytics/events` 与批量接口。
- `flutter analyze` 对未使用 import 严格，接入 provider 时避免重复导入 `api_client.dart`。
- 本地未安装 PostgreSQL，无法运行 `prisma migrate dev`，新 schema 变更需到有数据库环境后生成迁移。

### 遗留与后续
- **数据库迁移**：当前 schema 相对于最后应用迁移 `20260816000000_add_calendar_subscription` 仍有差异（如 `User.fcmToken`、`AIMessage` 表、可能还有其他未同步字段），需在有 PostgreSQL 环境后执行：
  ```bash
  cd services/api
  npx prisma migrate dev --name add_fcm_and_ai_session
  npx prisma migrate deploy
  ```
- **Firebase 原生配置**：Flutter 端需补充 `android/app/google-services.json` 与 `ios/Runner/GoogleService-Info.plist`（或 `firebase_options.dart`），并在 `android/app/build.gradle.kts` 应用 `com.google.gms.google-services` 插件。
- **服务器部署**：Week 27 服务端改动尚未部署到 `xutaostudy.xyz`，需按交接文档步骤执行。
- **商业版 Week 19+ 功能**：作为未来扩展备份，当前个人版暂不做。

---

## Week 27-D：离线同步与日历增强（多端可用性）（2026-08-14）

### 目标

1. 收件箱、日历事件接入本地 SQLite + 操作队列，实现弱网/离线可用。
2. 日历订阅列表自动刷新 UI（定时轮询 + 生命周期恢复刷新）。
3. 同步引擎增加操作结果事件与指数退避重试。

### 已完成工作

#### 1. 收件箱离线同步完善
- `apps/mobile/lib/providers/inbox_provider.dart`
  - 改为「本地优先」：`initState` 先加载本地缓存展示，再异步拉取服务端合并；离线时不再覆盖为错误状态。
  - `createItem`/`updateItem`/`convertItem`/`dismissItem` 采用乐观更新，本地操作 + 操作队列入队后立即刷新 UI；失败时回退到之前状态。
  - 收到 `inbox.*` 同步事件时重新拉取本地+服务端合并数据。

#### 2. 日历事件离线同步完善
- `apps/mobile/lib/providers/calendar_provider.dart`
  - `fetchEvents` 本地优先：先展示缓存，再异步合并服务端数据；离线时保持缓存可见。
  - `createEvent`/`updateEvent`/`deleteEvent` 乐观更新 + 失败回退。
  - 订阅/同步/导入等错误不再污染事件列表状态，改为抛出异常供 UI 显示 SnackBar。

#### 3. 日历订阅自动刷新 UI
- 新增 `apps/mobile/lib/models/calendar_subscription_model.dart`：订阅模型。
- 新增 `apps/mobile/lib/providers/calendar_subscriptions_provider.dart`：
  - 独立管理订阅列表状态。
  - 提供 `refresh()`、`startAutoRefresh()`（默认 30 秒轮询）、`stopAutoRefresh()`。
  - 新增/删除/同步订阅后自动刷新事件列表。
- `apps/mobile/lib/screens/calendar_screen.dart`
  - 订阅弹窗改用 `calendarSubscriptionsProvider`。
  - 弹窗 `initState` 启动 30 秒自动刷新。
  - 实现 `WidgetsBindingObserver`，在应用从后台恢复（如 OAuth 授权返回）时自动刷新订阅列表。
  - 提示文案改为「已打开浏览器，授权后返回本应用即可自动刷新」。

#### 4. 同步引擎增强
- `apps/mobile/lib/services/sync_engine.dart`
  - 新增 `SyncOperationEvent` / `SyncOperationSuccessEvent` / `SyncOperationFailedEvent` 操作结果广播流。
  - 每条操作同步完成后发布成功/失败事件，便于 UI 监听并给出提示。
  - 新增 `pushWithBackoff({int maxRetries = 3})`：失败后按 2/4/8 秒指数退避重试。

### 本地验证
- `C:/Users/Administrator/flutter/bin/flutter analyze`：No issues found。
- `npm run test -w services/api`：21 个测试套件，99 个测试全部通过。

### 关键文件
- Flutter：
  - `apps/mobile/lib/providers/inbox_provider.dart`
  - `apps/mobile/lib/providers/calendar_provider.dart`
  - `apps/mobile/lib/providers/calendar_subscriptions_provider.dart`
  - `apps/mobile/lib/screens/calendar_screen.dart`
  - `apps/mobile/lib/services/sync_engine.dart`
  - `apps/mobile/lib/models/calendar_subscription_model.dart`
- 文档：
  - `planning-app/docs/development-log.md`
  - `planning-app/docs/handover-summary.md`

### 踩坑记录
- `flutter analyze` 对未使用 `catch (e, st)` 的 `st` 警告严格；对真正使用 `AsyncValue.error(e, st)` 的地方保留 `st`，其余改为 `catch (e)`。
- 订阅弹窗使用 `WidgetsBindingObserver` 监听 `AppLifecycleState.resumed`，OAuth 授权返回后自动刷新，无需用户手动下拉。
- 乐观更新失败回退需要在修改 state 前保存 `previous` 列表快照。

---

## Week 28：真机问题修复与推送闭环（2026-08-15 ~ 2026-08-16）

### 目标

修复 2026-08-15 Android 真机日志排查中发现的 P0/P1/P2 问题，完成 FCM 远程推送闭环，恢复 Health Connect 运动数据同步能力。

### 已完成工作

1. **Android 13+ 预测性返回手势**
   - 在 `apps/mobile/android/app/src/main/AndroidManifest.xml` 的 `<application>` 标签添加 `android:enableOnBackInvokedCallback="true"`。
   - 预期消除 `WindowOnBackDispatcher` 警告。

2. **修复 HealthPlugin 注册失败**
   - 将 `MainActivity.kt` 从 `FlutterActivity` 改为 `FlutterFragmentActivity`。
   - 原因：`health` 等权限相关插件需要 FragmentActivity 支持。
   - 预期消除 `GeneratedPluginRegistrant: Error registering plugin health, java.lang.ClassCastException`。

3. **Firebase Android 工程配置**
   - 在 `settings.gradle.kts` 中添加 `com.google.gms.google-services` 插件依赖。
   - 在 `app/build.gradle.kts` 中应用 `com.google.gms.google-services` 插件。
   - 用户已将 `google-services.json` 放到 `apps/mobile/android/app/google-services.json`。
   - 在 `.gitignore` 中排除 `google-services.json`，避免公开仓库泄露 Firebase 配置。

4. **文档与决策**
   - 创建 `decisions/2026-08-15-Week28真机问题修复决策.md`，记录问题、修复方案与 `google-services.json` 获取步骤。
   - 更新 `docs/testing-phase.md` 第 19 节、 `docs/testing-plan.md` 第 7 节、 `docs/项目阶段总结.md` 与 `docs/development-roadmap.md` Week 28 计划。

5. **真机验证 Week 28 APK 出现白屏（2026-08-16）**
   - 现象：安装 Week 28 APK 后点击应用图标，只显示白屏，无法进入主界面。
   - 真机日志分析：
     - 无 `FATAL EXCEPTION`。
     - `FirebaseApp initialization successful`（Firebase 配置已生效）。
     - 出现 `ComponentDiscovery: Could not instantiate com.google.firebase.installations.FirebaseInstallationsKtxRegistrar` / `FirebaseMessagingKtxRegistrar` 警告（R8 反射问题）。
     - 推测根因：`main.dart` 中 `await FcmService().initialize()` 阻塞了 `runApp()`，而 `getToken()` 因 Firebase Installations 初始化延迟导致长时间等待，最终表现为白屏。
   - 修复方案：
     - 在 `FcmService.initialize()` 中，仅同步初始化 Firebase、设置监听器，将 `_uploadToken()` 改为 `Future.microtask(() => _uploadToken())` 后台执行，避免阻塞应用启动。
     - 新增 `apps/mobile/android/app/proguard-rules.pro`，添加 Firebase keep 规则，避免 R8 移除 `Firebase*KtxRegistrar` 的无参构造器。
     - 在 `app/build.gradle.kts` 的 `release` 构建类型中显式启用 `isMinifyEnabled` 并引用 `proguard-rules.pro`。

### 本地验证

- `C:/Users/Administrator/flutter/bin/flutter build apk --release`：成功 ✅（第 2 次构建，已包含白屏修复与 ProGuard 规则）
- 产物：`build/app/outputs/flutter-apk/app-release.apk`（61.6 MB）
- 已复制到：`planning-app/releases/planning-app-week28.apk`（第 2 版，覆盖第 1 版）
- 构建时间：约 85 秒

### 真机复测（2026-08-16，vivo 真机，Week 28 v2 APK）

- 日志文件：`env_planning_app_mobile_pid_new.log`（95 行，约 30 秒）
- 启动结果：✅ **白屏消失，应用可进入 UI 并弹出软键盘**，用户能交互（输入法 onRequestShow/onShown）
- 检查项：
  - `FATAL EXCEPTION`：0 次 ✅
  - `ComponentDiscovery: Could not instantiate`：未出现 ✅
  - `FirebaseInitProvider: FirebaseApp initialization successful`：出现 ✅
  - `HealthPlugin` / `ClassCastException`：未出现 ✅
  - `OnBackInvokedCallback is not enabled`：未出现 ✅
  - `Invalid resource ID 0x00000001`：未出现 ✅
- 剩余待确认：长时间运行稳定性（建议再测 5~10 分钟）与 FCM Token 实际上传。

### 关键文件

- `apps/mobile/android/app/src/main/AndroidManifest.xml`
- `apps/mobile/android/app/src/main/kotlin/com/example/planning_app_mobile/MainActivity.kt`
- `apps/mobile/android/settings.gradle.kts`
- `apps/mobile/android/app/build.gradle.kts`
- `apps/mobile/android/app/proguard-rules.pro`（新增）
- `apps/mobile/lib/services/fcm_service.dart`
- `decisions/2026-08-15-Week28真机问题修复决策.md`

### 遗留与后续

- 若本次构建后 `Invalid resource ID 0x00000001` 仍存在，将进一步排查 `pubspec.yaml` assets 与第三方库默认资源。
- 需要真机重新抓取 5~10 分钟日志，验证修复效果。
- 构建产物：`planning-app/releases/planning-app-week28.apk`。

---

## Week 28 后续：AI 计划详情弹窗、删除与精力曲线修复（2026-08-16）

### 目标

修复用户真机测试后提出的三个 UI/UX 问题：
1. AI 生成的计划详情应使用弹窗展示，避免挤压在主页面下方。
2. 计划确认落库后应支持删除，并清空后端生成的 goal/project/task/habit 等关联数据。
3. 设置页精力曲线无法保存，点击后会被 provider 刷新覆盖。

### 已完成工作

1. **精力曲线设置修复**
   - 文件：`apps/mobile/lib/screens/settings_screen.dart`
   - 问题：`settingsAsync.when(data: ...)` 每次 provider 刷新都会调用 `_loadFromPreferences()`，把用户刚刚点击修改的本地 `_energyCurve` 覆盖回默认值。
   - 修复：新增 `bool _loadedFromPrefs = false` 标志位，仅在首次加载时从 `UserPreferences` 初始化本地状态，后续重建不再覆盖。

2. **AI 计划详情改为 Dialog 弹窗**
   - 文件：`apps/mobile/lib/screens/ai_plan_draft_screen.dart`
   - 问题：原 `_buildPlanContent` 返回的 `ListView` 直接放在 `Expanded` 中，位于输入区下方，无滚动条、显示拥挤。
   - 修复：
     - 主页面仅保留「查看计划详情」预览卡片。
     - 新增 `_showPlanDialog` / `_buildPlanDialog`，使用 `AlertDialog` + `StatefulBuilder` + 固定高度 `SizedBox` 展示可滚动内容。
     - 反馈选择（太难 / 时间不合适 / 帮我再简单点）保留在弹窗内容区，并通过 `onRefresh` 回调刷新弹窗 UI。

3. **计划落库后支持删除**
   - 文件：
     - 前端：`apps/mobile/lib/screens/ai_plan_draft_screen.dart`、`apps/mobile/lib/providers/ai_provider.dart`
     - 后端：`services/api/src/modules/ai/ai.controller.ts`、`services/api/src/modules/ai/ai.service.ts`
   - 问题：`_approve` 只创建数据，无删除入口。
   - 修复：
     - 后端新增 `DELETE /ai/plan-drafts/:id/approved`。
     - `AiService.deleteApprovedDraft` 在事务中：
       - 删除该 goal 关联的所有 `PlanVersion`。
       - 读取 goal 下的 milestones / projects / tasks / habits，删除对应的 `CalendarEvent`、`Checkin`、`Reminder`。
       - 删除 `Task`、`Project`、`Milestone`、`Habit`、`Goal`。
       - 广播 `goal.deleted` / `task.deleted` / `habit.deleted` 同步事件。
     - 前端 `AiDraftNotifier` 新增 `deleteApprovedDraft(draftId)`，成功后 `clear()` 状态。
     - 弹窗底部增加「删除计划」红色按钮，带二次确认 Dialog。

### 本地验证与部署

- `C:/Users/Administrator/flutter/bin/flutter analyze`（`apps/mobile`）：No issues found。
- `npm run build`（`services/api`）：nest build 成功，无错误。
- Flutter 产物：`planning-app/releases/planning-app-week28-v3.apk`（61.6 MB）。
- 后端产物：`/tmp/api-dist-week28-fix.tar.gz`（204 KB），已上传至服务器 `/opt/planning-app/services/api/dist/` 并重启 `planning-api.service`。
- 部署验证：
  - `GET https://xutaostudy.xyz/api/v1/health` → `{"status":"ok"}` ✅
  - `DELETE https://xutaostudy.xyz/api/v1/ai/plan-drafts/:id/approved` → `401 Unauthorized`（路由已注册，需 JWT）✅

### 关键文件

- `apps/mobile/lib/screens/ai_plan_draft_screen.dart`
- `apps/mobile/lib/providers/ai_provider.dart`
- `apps/mobile/lib/screens/settings_screen.dart`
- `services/api/src/modules/ai/ai.controller.ts`
- `services/api/src/modules/ai/ai.service.ts`

### 遗留与后续

- 需真机安装 `planning-app/releases/planning-app-week28-v3.apk` 验证上述三点。
- 应用启动白屏问题已在 Week 28 v2 APK 修复；本次 v3 构建未回退相关代码。
- 建议继续运行 5~10 分钟长测，验证删除落库计划后多端同步事件正常。

---

## Week 28 后续 v2：AI 生成页滚动与目标删除级联（2026-08-16）

### 目标

修复用户真机测试后反馈的两个问题：
1. AI 生成计划主页需要滚动条，否则看不到下方内容。
2. 删除功能要支持已经入库、正在实施的目标，删除目标时级联删除相关数据。

### 已完成工作

1. **AI 生成计划主页添加滚动**
   - 文件：`apps/mobile/lib/screens/ai_plan_draft_screen.dart`
   - 问题：原 `build` 方法使用 `Padding` + `Column`，内容超过屏幕时无法滚动。
   - 修复：在最外层使用 `SingleChildScrollView` 包裹 `Padding` + `Column`。

2. **目标删除支持级联删除关联数据**
   - 文件：
     - 前端：`apps/mobile/lib/screens/goal_screen.dart`、`apps/mobile/lib/providers/goal_provider.dart`、`apps/mobile/lib/services/local_database.dart`
     - 后端：`services/api/src/modules/goals/goals.service.ts`
   - 问题：原 `GoalsService.remove` 只执行 `prisma.goal.delete`，由于 Prisma 外键为 `SetNull` 或独立关联，projects、tasks、habits、checkins、reminders、calendarEvents、planVersions 等数据不会被级联清理。
   - 修复：
     - 后端 `remove` 改为事务操作：
       - 删除该 goal 的 `PlanVersion`。
       - 读取 milestones / projects / tasks / habits，删除关联 `CalendarEvent`、`Checkin`、`Reminder`。
       - 删除 `Task`、`Project`、`Milestone`、`Habit`、`Goal`。
       - 广播 `goal.deleted` / `task.deleted` / `habit.deleted` 同步事件。
     - 前端 `GoalsNotifier` 新增 `deleteGoal(id)`，调用 `DELETE /goals/$id` 并乐观更新本地 state；`_listenSync` 监听 `goal.deleted` 自动刷新列表。
     - `LocalDatabase` 新增 `deleteGoal(id)` 删除本地 SQLite 中的目标记录。
     - `GoalScreen` 每个目标卡片右上角增加「删除」图标按钮，带二次确认 Dialog。

### 本地验证与部署

- `C:/Users/Administrator/flutter/bin/flutter analyze`（`apps/mobile`）：No issues found。
- `npm run build`（`services/api`）：nest build 成功，无错误。
- Flutter 产物：`planning-app/releases/planning-app-week28-v4.apk`（61.6 MB）。
- 后端产物：`/tmp/api-dist-week28-v2.tar.gz`（205 KB），已上传至服务器 `/opt/planning-app/services/api/dist/` 并重启 `planning-api.service`。
- 部署验证：
  - `GET https://xutaostudy.xyz/api/v1/health` → `{"status":"ok"}` ✅
  - `DELETE https://xutaostudy.xyz/api/v1/goals/:id` → `401 Unauthorized`（路由已注册，需 JWT）✅

### 关键文件

- `apps/mobile/lib/screens/ai_plan_draft_screen.dart`
- `apps/mobile/lib/screens/goal_screen.dart`
- `apps/mobile/lib/providers/goal_provider.dart`
- `apps/mobile/lib/services/local_database.dart`
- `services/api/src/modules/goals/goals.service.ts`

### 遗留与后续

- 需真机安装 `planning-app/releases/planning-app-week28-v4.apk` 验证：
  - AI 生成页可以滚动查看所有内容。
  - 目标页点击删除按钮，二次确认后目标及其关联数据被删除，列表刷新。
- 建议删除后检查「今日」页与「习惯」页，确认关联任务/习惯已消失。

### 用户验证

- 2026-08-16：用户真机验证 `planning-app-week28-v4.apk`，确认当前已无功能问题。
- 精力曲线设置、AI 计划详情弹窗、计划删除、AI 生成页滚动、目标删除级联等功能均通过用户验证。
