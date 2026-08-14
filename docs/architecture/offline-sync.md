# 离线同步架构设计

## 目标

在弱网/无网环境下，用户仍能查看今日任务、创建任务、完成打卡；恢复联网后自动同步到服务端。

## 核心策略

1. **本地优先读取**
   - 启动时优先从本地 SQLite/hive/shared_preferences 加载今日任务和最近目标列表。
   - 同时发起后台 API 请求刷新数据。

2. **操作队列（Operation Queue）**
   - 每个写操作生成 `operation_id`（UUID v4），包含：
     - `type`: create_task / complete_task / checkin_habit / update_goal 等
     - `payload`: 请求体
     - `client_timestamp`
     - `target_id`: 本地临时 ID
   - 离线时写入队列；联网后按 FIFO 批量提交。

3. **临时 ID 映射**
   - 离线创建的资源使用本地临时 ID（`local_xxx`）。
   - 服务端返回真实 ID后，更新本地数据库和依赖该 ID 的待提交操作。

4. **冲突处理**
   - 优先采用“事件合并 + 用户可见提示”。
   - 不直接覆盖，而是展示冲突项让用户选择。
   - 打卡记录设计为追加事件，天然避免覆盖。

## 数据分层

| 数据 | 本地缓存 | 离线可写 | 同步策略 |
|------|----------|----------|----------|
| 今日任务 | 是 | 完成/延期 | 操作队列（已实现 `create_task` / `complete_task`） |
| 目标列表 | 是 | 否（只读缓存） | 拉取覆盖 |
| 习惯列表 | 是 | 打卡 | 操作队列（已实现 `habit_checkin`） |
| 用户偏好 | 是 | 是 | 最后写入优先（未实现） |
| AI 草案 | 否 | 否 | 必须联网 |

## 已实现（Week 5）

- Flutter 端接入 `sqflite`，表：`goals` / `tasks` / `habits` / `operations` / `sync_meta`。
- 操作队列字段：`id/type/targetType/targetId/payload/status/retries/createdAt`。
- 已支持离线操作：`create_task`、`complete_task`、`habit_checkin`。
- 网络恢复后按 FIFO 提交操作队列，失败时递增 `retries`。
- 本地 DB 为源，服务端返回后 `upsert` 覆盖本地缓存。

## 待完善

- 临时 ID 到服务端真实 ID 的映射（当前任务 ID 由客户端 UUID 生成，服务端直接使用）。
- 重试上限与失败告警。
- 离线创建目标 / 习惯（当前仍要求联网）。
- 用户偏好的离线写入与冲突解决。
