# 多端一致性架构设计

## 目标

支持用户在手机、平板、Web 等多端查看一致的目标、任务和打卡状态。

## 技术选型

| 场景 | 方案 | 原因 |
|------|------|------|
| AI 计划生成流式输出 | SSE | 单向推送，实现简单 |
| 多端状态同步 | WebSocket | 双向实时，适合任务更新广播 |
| 离线恢复后的全量同步 | HTTPS REST | 一次性拉取最近 N 条事件 |

## 事件模型

所有变更抽象为 `SyncEvent`：

```json
{
  "eventId": "uuid",
  "eventType": "task.completed",
  "userId": "uuid",
  "targetType": "task",
  "targetId": "uuid",
  "payload": { "status": "done" },
  "clientTimestamp": "2026-08-11T14:00:00Z",
  "serverTimestamp": "2026-08-11T14:00:01Z",
  "deviceId": "phone-abc"
}
```

## 冲突解决

1. 每个事件携带 `clientTimestamp` 和单调递增的 `version`。
2. 服务端按 `serverTimestamp` 排序。
3. 同一资源的并发修改：
   - 若操作可合并（如不同字段），自动合并。
   - 若不可合并，生成 `conflict` 事件，客户端弹窗让用户选择。

## WebSocket 连接管理

- 连接建立时通过 handshake query `token=<JWT>` 自动鉴权，或发送 `auth` 消息携带 JWT。
- 服务端按 `userId` 维护房间（room）。
- 资源变更后广播 `sync_event` 到同用户所有设备。
- 客户端断线后重连，并拉取 `lastSyncAt` 之后的事件补齐。

## 已实现（Week 5）

- 后端使用 `@nestjs/websockets` + `socket.io`，namespace `/sync`。
- `SyncEventsService` 在 `task.created` / `task.completed` / `habit.created` / `habit.checkin` / `goal.created` 时持久化并广播。
- REST 接口 `GET /sync/events?after=<ISO8601>` 支持断线后补齐。
- Flutter `SyncEngine` 通过 `socket_io_client` 监听实时事件，并定期轮询 `/sync/events`。

## 待完善

- 事件 ID 游标替代时间戳过滤，避免时间精度/时钟偏移问题。
- 版本向量（vector clock）与冲突 UI。
- 设备唯一标识 `deviceId` 的采集与去重。
