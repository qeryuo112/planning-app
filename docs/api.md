# API 文档

基地址：`/api/v1`

## 认证

所有接口默认需要 Bearer Token，以下接口标记 `@Public()` 无需登录。

| 方法 | 路径 | 说明 | 公开 |
|------|------|------|------|
| POST | `/auth/register` | 用户注册 | 是 |
| POST | `/auth/login` | 用户登录 | 是 |
| POST | `/auth/refresh` | 刷新 access token | 是 |

## 用户

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users/me` | 获取当前用户资料与偏好，缺失字段返回默认值 |
| PATCH | `/users/me/preferences` | 部分更新时区、可用时间、精力曲线、通知设置（未提供字段不覆盖；JSON 字段与现有值合并） |
| GET | `/users/me/ai-config` | 获取当前用户 AI 配置（provider、model、baseUrl、apiKey），未设置时返回空字段 |
| PATCH | `/users/me/ai-config` | 更新用户 AI 配置；留空字段表示清除或保持服务端默认 |
| POST | `/users/me/fcm-token` | 上传/清空 FCM Token；token 为空时清除 |

### AI 配置请求体示例

```json
{
  "aiProvider": "deepseek",
  "aiModel": "deepseek-chat",
  "aiBaseUrl": "https://api.deepseek.com/v1",
  "aiApiKey": "sk-xxxxxxxx"
}
```

- 四个字段全部留空或不提供时，AI 调用回退到服务端 `.env` 中的 `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`。
- 只要提供 `aiApiKey`，就会使用该 key 创建 OpenAI 兼容客户端。
- `aiProvider` 仅用于日志标签，不影响实际路由。

## 目标

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/goals` | 创建目标，可一并创建里程碑 |
| GET | `/goals` | 获取当前用户目标列表 |
| GET | `/goals/:id` | 获取目标详情、里程碑与子目标 |
| PATCH | `/goals/:id` | 更新目标信息 |
| DELETE | `/goals/:id` | 删除目标 |
| POST | `/goals/:id/recalculate` | 重算目标与里程碑进度 |
| GET | `/goals/:id/stats` | 目标统计：进度、连续天数、里程碑进度 |

## 今日

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/today` | 今日聚合：Top 3 任务、习惯、目标进度、过期任务 |

## 项目

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/projects` | 创建项目，可选关联目标 |
| GET | `/projects` | 获取当前用户项目列表 |
| GET | `/projects/:id` | 获取项目详情 |
| PATCH | `/projects/:id` | 更新项目 |
| DELETE | `/projects/:id` | 删除项目 |

## 任务

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/tasks` | 创建任务，可关联项目/里程碑 |
| GET | `/tasks?date=YYYY-MM-DD` | 按日期查询任务（今日任务） |
| GET | `/tasks/:id` | 获取任务详情 |
| PATCH | `/tasks/:id` | 更新任务 |
| DELETE | `/tasks/:id` | 删除任务 |
| POST | `/tasks/:id/complete` | 完成任务并写入打卡记录 |
| POST | `/tasks/:id/postpone` | 延期任务，可指定新日期与原因 |
| POST | `/tasks/:id/makeup` | 补打卡，恢复为已完成 |

## 习惯

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/habits` | 创建习惯，可选关联目标 |
| GET | `/habits` | 获取当前用户习惯列表 |
| GET | `/habits/:id` | 获取习惯详情 |
| PATCH | `/habits/:id` | 更新习惯 |
| DELETE | `/habits/:id` | 删除习惯 |
| POST | `/habits/:id/checkin` | 习惯打卡 |
| GET | `/habits/:id/stats?days=30` | 习惯统计：热力图、连续天数、完成率 |

## 提醒

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/reminders` | 创建提醒，目标类型 goal / task / habit |
| GET | `/reminders` | 获取当前用户提醒列表 |
| GET | `/reminders/:id` | 获取提醒详情 |
| GET | `/reminders/upcoming` | 获取已到期的待处理提醒 |
| POST | `/reminders/:id/dismiss` | 忽略提醒（标记为已处理） |
| POST | `/reminders/:id/snooze` | 推迟提醒，body  `{ "minutes": 15 }`（15/30/60） |

## 复盘

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/reviews` | 创建日/周复盘 |
| GET | `/reviews?goalId=` | 查询复盘列表，可按目标过滤 |
| GET | `/reviews/:id` | 获取复盘详情 |

## AI 计划

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/ai/plan-drafts` | 创建计划草案，可指定 `templateId` 使用预置模板；优先调用真实 LLM，失败/超限降级为模板或占位草案 |
| POST | `/ai/plan-drafts/from-file` | 上传计划文件内容（JSON body 传 `content`），AI 解析后生成草案 |
| POST | `/ai/plan-drafts/from-upload` | **推荐 / 移动端唯一入口**：以 `multipart/form-data` 上传任意文件，本地不做内容解析；服务端上传到 OSS 后按文件类型转为 AI content blocks，由 AI 直接解析 |
| GET | `/ai/plan-drafts/:id` | 获取已保存的草案 |
| GET | `/ai/plan-drafts/:id/stream` | 流式草案推送（占位） |
| POST | `/ai/plan-drafts/:id/approve` | 确认草案，事务落库，可选 feedback |
| POST | `/ai/plan-drafts/:id/advance` | 进入下一阶段，生成新的 PlanVersion（使用 cheap 模型） |
| POST | `/ai/replan` | 基于目标最新 PlanVersion 与执行进度，重新生成下一阶段计划（使用 strong 模型） |
| POST | `/ai/review` | 生成目标日/周复盘摘要（使用 strong 模型） |

### 计划文件导入方式

#### 方式 1：multipart 上传（推荐，移动端使用）

`POST /ai/plan-drafts/from-upload`

```bash
curl -X POST https://xutaostudy.xyz/api/v1/ai/plan-drafts/from-upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@master-plan.txt" \
  -F "scope=master" \
  -F "planDuration=180" \
  -F "stageLength=30"
```

字段说明：
- `file`：文件内容（支持 txt / md / json / 图片 / 视频 / PDF / PPTX 等）。
- `scope`：`master` | `weekly`。
- `parentGoalId`：`weekly` 模式下必须关联已有目标。
- `requirements`：可选，补充要求。
- `planDuration` / `stageLength`：可选，默认 `30` / `7`。

处理流程：
1. 服务端接收 multipart 文件后，上传到阿里云 OSS 获取公网 URL。
2. 根据文件扩展名下载并转换为 OpenAI 兼容的 content blocks：
   - txt / md / json 等文本 → `text`
   - png / jpg / gif / webp → `image_url`
   - mp4 / mov / avi / mkv / webm → `video_url`
   - pdf → PyMuPDF 逐页转 PNG → `image_url`
   - pptx → python-pptx 提取每页文本 → `text`
3. 将 content blocks 与解析要求一起发给 AI，让 AI 直接读取文件内容并输出计划草案。
4. OSS 中的文件保留，便于后续追溯或重新解析。

#### 方式 2：JSON body 传 content

`POST /ai/plan-drafts/from-file`

```json
{
  "content": "2026 考研计划...",
  "fileName": "master-plan.md",
  "scope": "master",
  "requirements": "优先数学，每天 2 小时英语",
  "planDuration": 180,
  "stageLength": 30
}
```

- `scope=master`：生成总目标、子目标、里程碑、习惯。
- `scope=weekly`：必须提供 `parentGoalId`，AI 会根据文件内容生成具体日期（相对当周或文件内显式日期）的任务。
| GET | `/ai/templates` | 列出预置领域模板 |
| GET | `/ai/templates/recommend?input=...` | 根据用户输入推荐最匹配的模板 |
| GET | `/ai/usage` | 获取当前用户当日 AI 用量（费用、上限、调用次数） |
| GET | `/ai/profile-summary` | 基于长期行为生成用户画像摘要（降级时返回规则摘要） |
| GET | `/ai/personalized-recommendations?goalId=` | 基于用户画像给出下一步目标/习惯/排程建议 |

### AI 响应字段说明

- `fallback: true`：真实模型未启用、调用失败、输出校验失败或日费用上限已触发，已降级为占位结果。
- `error?: string`：fallback 时的具体原因。
- `overload: true`（仅 `/ai/plan-drafts`）：`estimatedWeeklyLoad.totalMinutes` 超过用户每周可用时间。
- `availableWeeklyMinutes`：根据 `User.availableTime` 计算出的每周可用分钟数，未设置时默认 420。

### AI 模型配置

环境变量：

- `AI_PROVIDER`：日志标签，可选 `openai` / `deepseek` / `custom`。
- `OPENAI_API_KEY`：API Key。
- `OPENAI_BASE_URL`：OpenAI 兼容接口地址，默认 `https://api.openai.com/v1`；DeepSeek 填 `https://api.deepseek.com/v1`。
- `OPENAI_MODEL`：模型名，如 `gpt-4o-mini`、`deepseek-chat`、`deepseek-v4-flash`。
- `AI_CHEAP_MODEL`：简单计划/阶段推进使用的 cheap 模型，如 `deepseek-v4-flash`；未配置时回退到 `OPENAI_MODEL`。
- `AI_STRONG_MODEL`：复杂复盘/重新规划使用的 strong 模型，如 `deepseek-reasoner`；未配置时回退到 `OPENAI_MODEL`。
- `AI_DAILY_COST_LIMIT_USD`：每日 AI 调用费用上限（美元），超过后自动降级为模板/占位，默认 `1.0`。

当 Key 为空、调用失败、输出校验失败或日费用上限触发时，接口返回 `fallback: true` 并使用占位结果或模板降级草案，保证服务可用。

## 社交

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/social/goals/:id/share` | 将目标分享给指定邮箱用户，权限可选 `view`/`edit`，默认 `view` |
| GET | `/social/shares/received?status=pending` | 获取我收到的目标共享邀请（可选按状态过滤） |
| GET | `/social/shares/owned` | 获取我发出的目标共享 |
| POST | `/social/shares/:id/respond` | 接受/拒绝共享邀请，body `{ "status": "accepted" \| "declined" }` |
| POST | `/social/challenges` | 创建小组挑战，创建者自动加入 |
| GET | `/social/challenges?status=active` | 获取挑战列表（可选按状态过滤） |
| POST | `/social/challenges/:id/join` | 加入指定挑战 |
| GET | `/social/challenges/:id/leaderboard` | 获取挑战排行榜 |

### 挑战类型与计分规则

- `habit_streak`：统计挑战周期内完成/部分/补打卡的习惯 checkin 次数。
- `task_count`：统计挑战周期内状态为 `done` 的任务数。
- `goal_progress`：统计挑战周期内任务完成百分比（返回 0-100 的整数）。

## 收件箱

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/inbox` | 快速录入想法/任务 |
| GET | `/inbox` | 获取当前用户未整理收件箱列表 |
| PATCH | `/inbox/:id` | 更新标题/描述 |
| POST | `/inbox/:id/convert` | 整理到目标/项目/任务，支持 `targetType: goal/project/task` |
| POST | `/inbox/:id/dismiss` | 忽略条目 |

### 整理请求体示例

```json
{
  "targetType": "task",
  "scheduledDate": "2026-08-12",
  "projectId": "...",
  "milestoneId": "..."
}
```

## 日历事件

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/calendar` | 创建日历事件，可关联任务 |
| GET | `/calendar?start=ISO8601&end=ISO8601` | 按时间范围查询事件 |
| PATCH | `/calendar/:id` | 更新事件 |
| DELETE | `/calendar/:id` | 删除事件 |
| POST | `/calendar/import-ics` | 导入 ICS 文本，将 VEVENT 转为日历事件 |
| GET | `/calendar/export-ics` | 导出当前用户日历事件为 ICS 文本（JSON 包裹 `{ icsText }`） |
| POST | `/calendar/sync-external` | 通过外部日历 URL 拉取 ICS 并导入，兼容 Google/Outlook 公开地址 |

## 外部数据

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/external/fitness-import` | 导入运动设备数据，可关联习惯自动生成打卡 |

### 运动数据导入请求体示例

```json
{
  "source": "keep",
  "habitId": "...",
  "activities": [
    {
      "activityType": "run",
      "startedAt": "2026-08-14T07:00:00.000Z",
      "durationSeconds": 1800,
      "distanceKm": 5,
      "calories": 300,
      "note": "晨跑"
    }
  ]
}
```

返回示例：`{ "activitiesImported": 1, "checkinsCreated": 1 }`。

## 数据报表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/reports/execution?period=weekly\|monthly\|yearly&date=YYYY-MM-DD` | 执行报表：任务/习惯/目标统计 |
| GET | `/reports/energy` | 能量曲线分析：精力偏好 + 各能量等级任务完成率 |
| GET | `/reports/best-time` | 最佳完成时段：近 90 天每小时打卡分布 |

### 执行报表返回示例

```json
{
  "period": "weekly",
  "label": "2026-08-10 ~ 2026-08-16",
  "startDate": "2026-08-10T00:00:00.000Z",
  "endDate": "2026-08-16T23:59:59.999Z",
  "taskSummary": { "total": 10, "done": 7, "skipped": 1, "postponed": 2, "completionRate": 70 },
  "habitSummary": { "totalCheckins": 14, "completed": 12, "partial": 1, "skipped": 1, "makeup": 0, "completionRate": 93 },
  "goalCount": { "active": 3, "completed": 1, "archived": 0, "total": 4 }
}
```

## 其他模块（后续迭代）

- `/checkins`

详细实现将在后续迭代中补充。

## 同步事件

### REST 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/sync/events` | 获取当前用户同步事件列表 |
| GET | `/sync/events?after=2026-08-12T07:00:00.000Z` | 增量拉取，返回 `serverTimestamp > after` 的事件 |

返回示例：

```json
[
  {
    "id": "...",
    "userId": "...",
    "eventType": "task.created",
    "targetType": "task",
    "targetId": "...",
    "payload": {
      "title": "...",
      "status": "todo",
      "scheduledDate": "2026-08-12T00:00:00.000Z"
    },
    "deviceId": null,
    "serverTimestamp": "2026-08-12T07:37:52.868Z"
  }
]
```

### WebSocket 实时同步

- 命名空间：`/sync`
- 生产 WebSocket URL：`wss://xutaostudy.xyz/sync`（开发可继续用 `ws://xutaostudy.xyz:3001/sync`）
- 鉴权方式：连接时通过 query `token=<JWT>` 或连接后发送 `auth` 消息携带 JWT。
- 鉴权成功后服务端将客户端加入 `user:{userId}` 房间。
- 当同一用户的资源发生变更时，服务端广播 `sync_event` 事件；提醒到期时广播 `reminder.triggered` 事件（非持久化）。

客户端示例：

```javascript
const socket = io("wss://xutaostudy.xyz/sync", {
  transports: ["websocket"],
  query: { token: "<JWT>" }
});

socket.on("auth_ok", (data) => console.log("auth ok", data));
socket.on("sync_event", (event) => console.log("sync event", event));
```

### 事件类型

| eventType | targetType | 触发场景 |
|-----------|-----------|----------|
| `task.created` | `task` | 创建任务 |
| `task.completed` | `task` | 完成任务 |
| `task.postponed` | `task` | 任务延期 |
| `task.madeup` | `task` | 任务补打卡 |
| `habit.created` | `habit` | 创建习惯 |
| `habit.checkin` | `habit` | 习惯打卡 |
| `goal.created` | `goal` | 创建目标 |
| `reminder.triggered` | `reminder` | 提醒到期触发（WebSocket 实时广播，不入同步事件表） |
