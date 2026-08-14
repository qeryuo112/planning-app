# 数据库 Schema 变更记录

## 2026-08-11 Week 1 用户认证与进度计算所需字段

### 变更内容

在 `prisma/schema.prisma` 中新增两个字段：

1. **User 模型新增 `refreshToken`**
   - 类型：`String?`
   - 原因：支持 JWT refresh token 轮换，实现安全的登录态刷新。

2. **Task 模型新增 `weight`**
   - 类型：`Float`，默认值 `1`
   - 原因：里程碑与目标进度按任务权重计算，避免仅按任务数量统计导致进度失真。

### 迁移方式

当前 Week 1 尚未创建生产数据库，采用开发迁移：

```bash
npm run prisma:migrate:dev -w services/api
```

生产环境部署时执行：

```bash
npm run prisma:migrate:deploy -w services/api
```

### 影响范围

- `@prisma/client` 类型需重新生成：`npm run prisma:generate -w services/api`。
- 进度重算服务会读取 `Task.weight` 计算里程碑完成度。
- 认证服务会读写 `User.refreshToken`。

## 2026-08-11 Week 2 项目/任务/习惯 CRUD

### 变更内容

本次 Week 2 未修改 `prisma/schema.prisma`，所有新功能均基于 Week 0/1 已定义的 `Project`、`Task`、`Habit`、`Checkin` 模型实现。

### 说明

- 项目、任务、习惯的 CRUD 直接复用已有模型字段。
- 任务完成与习惯打卡写入 `Checkin` 表，未新增字段。
- 由于无 schema 变更，无需新建 Prisma 迁移；生产环境直接使用 Week 1 的迁移 `20260811131033_init`。

### 验证

- `npm run build -w services/api` 通过。
- `npm run test -w services/api` 通过。

## 2026-08-11 Week 3 Review 模型新增 goalId 关联 / PlanVersion 的 goalId 改为可选

### 变更内容

1. **Review 模型**
   - 新增 `goalId String?`
   - 新增 `goal Goal? @relation(fields: [goalId], references: [id], onDelete: SetNull)`

2. **Goal 模型**
   - 新增 `reviews Review[]`

3. **PlanVersion 模型**
   - `goalId` 从 `String` 改为 `String?`
   - `goal` 关系从 required 改为 `Goal?`，`onDelete` 从 `Cascade` 改为 `SetNull`

### 原因

- 复盘记录需要关联到具体目标，便于按目标维度查询复盘历史。
- 计划草案（`PlanVersion`）在创建时可能还没有对应的目标（草案确认后才创建目标），因此 `goalId` 需要可选。

### 迁移方式

开发环境：

```bash
npm run prisma:migrate:dev -w services/api
```

生产环境：

```bash
npm run prisma:migrate:deploy -w services/api
```

生产环境已应用迁移：
- `20260811135523_add_review_goal_id`
- `20260811135920_make_plan_version_goal_optional`

### 影响范围

- `@prisma/client` 类型需重新生成：`npm run prisma:generate -w services/api`。
- `ReviewsService` 创建复盘时写入 `goalId`。
- `GET /reviews?goalId=` 可按目标过滤复盘列表。
- `AiService.createDraft` 在 `goalId` 为空时写入 `null`。

## 2026-08-12 Week 5 新增 SyncEvent 同步事件表

### 变更内容

1. **新增 `SyncEvent` 模型**
   - 字段：
     - `id String @id @default(uuid())`
     - `userId String`
     - `eventType String`（如 `task.created`、`task.completed`、`habit.checkin`、`goal.created`）
     - `targetType String`（`task` / `habit` / `goal`）
     - `targetId String`
     - `payload Json`
     - `deviceId String?`
     - `serverTimestamp DateTime @default(now())`
   - 索引：`@@index([userId, serverTimestamp])`
   - 关系：`user User @relation(fields: [userId], references: [id], onDelete: Cascade)`

2. **User 模型补全反向关联**
   - 新增 `syncEvents SyncEvent[]`

### 原因

- 记录每一次资源变更事件，支持多端通过 REST 增量拉取和 WebSocket 实时广播。
- 以事件为中心的数据模型便于后续实现版本向量、冲突解决与审计。

### 迁移方式

开发环境：

```bash
cd services/api
npx prisma migrate dev --name add_sync_event
```

生产环境：

```bash
cd /opt/planning-app/services/api
npx prisma generate
npx prisma migrate deploy
```

生产环境已应用迁移：
- `20260812072438_add_sync_event`

### 影响范围

- `@prisma/client` 类型需重新生成：`npx prisma generate`。
- 新增 `SyncEventsService`、`SyncEventsGateway`（`/sync`）、`SyncEventsController`（`GET /sync/events`）。
- `TasksService` / `HabitsService` / `GoalsService` 在创建/完成/打卡后写入 `SyncEvent` 并广播。


## 2026-08-14 Week 27 个人版增强：FCM、AI 会话、客户端埋点

### 变更内容

1. **User 模型新增 `fcmToken`**
   - 类型：`String?`
   - 原因：存储 Flutter 上传的 FCM Token，用于远程推送。

2. **新增 `AIMessage` 模型**
   - 字段：
     - `id String @id @default(uuid())`
     - `sessionId String`
     - `role String`（`system` / `user` / `assistant`）
     - `content String`
     - `metadata Json?`
     - `createdAt DateTime @default(now())`
   - 索引：`@@index([sessionId, createdAt])`
   - 关系：`session AISession @relation(fields: [sessionId], references: [id], onDelete: Cascade)`

3. **AIOperation 模型新增 `sessionId`**
   - 类型：`String?`
   - 原因：将 AI 操作与多轮会话关联，便于后续成本分析按会话聚合。
   - 关系：`session AISession? @relation(fields: [sessionId], references: [id], onDelete: SetNull)`

4. **AISession 模型反向关联**
   - 新增 `messages AIMessage[]`

### 原因

- 支持 AI 多轮对话：用户可在生成计划后继续追问/调整，AI 能读取历史上下文。
- 支持 FCM 远程推送：服务端 reminders 触发时可通过 Firebase 推送离线通知。
- 支持客户端行为埋点：记录关键前端事件，用于后续画像、推荐与数据报表。

### 迁移方式

开发环境（需本地有 PostgreSQL）：

```bash
cd services/api
npx prisma migrate dev --name add_fcm_and_ai_session
```

生产环境（服务器已部署）：

```bash
cd /opt/planning-app/services/api
npx prisma generate
npx prisma migrate deploy
```

> ⚠️ 注意：本次 Week 27 结束时本地无可用 PostgreSQL，因此未生成新的迁移文件。部署前务必先在有数据库环境生成并应用迁移。

### 影响范围

- `@prisma/client` 类型需重新生成：`npx prisma generate`。
- `AiService.createDraft` / `replan` / `review` 会读写 `AISession` / `AIMessage`。
- `FcmService` 上传的 Token 由 `UsersService.updateFcmToken` 写入 `User.fcmToken`。
- `AnalyticsController` 新增 `POST /analytics/events` 与 `POST /analytics/events/batch` 供客户端上报事件。
