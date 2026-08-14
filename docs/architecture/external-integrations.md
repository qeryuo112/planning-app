# 外部服务集成架构设计

## 目标

与日历、邮件、运动设备、推送服务等外部系统对接，降低用户手动录入成本。

## 集成清单

| 外部服务 | 用途 | 接入方式 | 优先级 |
|----------|------|----------|--------|
| 系统日历（iOS/Android） | 读取/写入日程事件 | 原生插件（如 `device_calendar`） | 高 |
| 邮件服务（SendGrid/阿里云邮件推送） | 发送周报、提醒 | SMTP / HTTP API | 中 |
| 推送服务（FCM + APNs） | 提醒通知 | `firebase_messaging` | 高 |
| 运动健康（Apple Health / Google Fit） | 读取运动数据 | HealthKit / Google Fit SDK | 低 |
| 第三方 LLM | AI 计划生成 | OpenAI / Claude / 国内模型 API | 高 |

## 接入层设计

### 1. Provider Adapter 模式

为每种外部服务定义统一接口：

```dart
abstract class CalendarAdapter {
  Future<List<CalendarEvent>> fetchEvents(DateTime start, DateTime end);
  Future<void> createEvent(CalendarEvent event);
}
```

具体实现：
- `DeviceCalendarAdapter`：移动端系统日历。
- `GoogleCalendarAdapter`：Google Calendar API。

### 2. 服务端 webhook 聚合

- 外部服务的回调统一打到 `/webhooks/:provider`。
- 服务端校验签名后，将事件转换为内部 `UserEvent` 写入数据库。
- 通过 WebSocket/SSE 推送给客户端。

### 3. 用户授权与脱敏

- 使用 OAuth 2.0 获取外部服务 token。
- Token 加密存储在服务端，不落地客户端。
- 向外部服务发送的数据进行最小化脱敏。

## MVP 阶段简化

- Week 4 完成 Provider Adapter 接口定义与文档。
- Week 5/6 优先实现 FCM 推送与系统日历读取。
- AI 模型接入已在 Week 3 完成适配层骨架。
