# 计划型 App 后续开发路线图

> ⚠️ 重要文档：compact 时必须保留本文件内容，作为后续 Week 开发计划的唯一真实来源。
>
> 文档路径：`planning-app/docs/development-roadmap.md`
> 关联文档：
> - `kimiRULES.txt`（根目录）
> - `项目交接文档.md`（根目录）
> - `planning-app/docs/handover-summary.md`
> - `planning-app/docs/development-log.md`
> - `decisions/` 目录下各 Week 决策文件
>
> 生成时间：2026-08-12
> 作者：Kimi Code CLI
> 用途：明确 Week 10 及以后的开发顺序、交付物、验证标准，便于交接与持续迭代。

---

## 1. 当前基线（Week 24 结束 / 2026-08-13）

### 1.1 已完成

- **后端**：NestJS 10 + Prisma + PostgreSQL + Redis 骨架，用户/目标/项目/任务/习惯/打卡/提醒/复盘/AI 计划/同步事件/收件箱/日历事件/提醒定时扫描/社交 全部模块可用。
- **AI 计划**：支持自定义计划时长（7-365 天）、阶段长度（7-30 天）、分阶段展开、`/advance` 进入下一阶段；6 个预置模板、模板匹配/推荐、cheap/strong 多模型路由、AI 每日用量接口。
- **社交**：目标共享邀请、共享列表、接受/拒绝；小组挑战创建/加入；排行榜按 habit_streak / task_count / goal_progress 计分。
- **提醒**：后端每分钟扫描到期提醒，广播 `reminder.triggered` 事件；`dismiss`/`snooze` 接口。
- **同步**：`SyncEvent` + WebSocket `/sync` + REST `/sync/events` 已部署，任务/习惯/目标变更自动广播。
- **外部集成**：ICS 日历导入/导出/订阅、运动数据 JSON 导入。
- **数据报表**：执行报表（周/月/年）、能量曲线分析、最佳完成时段。
- **高级 AI**：基于长期行为的用户画像摘要与个性化计划建议；**Week 24 新增 SSE 流式计划生成、画像快照自动刷新、历史权重模板推荐**。
- **Flutter**：今日/目标/任务/习惯/AI 计划/复盘/更多/社交/日历/报表/AI 洞察 页面、本地通知、Riverpod、API 客户端、本地 SQLite、同步引擎、SSE 客户端已接入，`flutter analyze` 通过。
- **部署**：服务器 `xutaostudy.xyz` 使用 systemd 运行 `planning-api`，Nginx 反向代理 HTTPS，`/api/v1` 与 `/sync` 转发到 3001，数据库每日自动备份。
- **验证**：后端 build/lint/test 全绿；Flutter analyze 无 issues；服务器端到端验证 HTTPS API、AI 模板、提醒、社交、报表、AI 洞察通过。
- **历史 Week 记录**：Week 0-24 详见 `planning-app/docs/development-log.md`。

### 1.2 关键环境信息

- 本地 Flutter 路径：`C:/Users/Administrator/flutter`，命令：`/c/Users/Administrator/flutter/bin/flutter`。
- 服务器项目路径：`/opt/planning-app`。
- 服务器 SSH 密钥：`C:/Users/Administrator/Downloads/ab12.pem`。
- API 前缀：`/api/v1`。
- 新增环境变量：
  - `AI_CHEAP_MODEL`：简单计划/阶段推进使用的模型，如 `deepseek-v4-flash`。
  - `AI_STRONG_MODEL`：复盘/重新规划使用的模型，如 `deepseek-reasoner`。
  - 未配置时回退到 `OPENAI_MODEL`。

---

## 2. 开发原则

1. **每 Week 必须有可交付的 MVP 增量**，不追求大而全。
2. **先 Flutter 展示、后后端增强**，优先让用户可感知。
3. **每 Week 结束必须更新本文档和 `development-log.md`**，记录完成项、验证结果、踩坑。
4. **本地无法跑数据库时，迁移/部署在服务器执行**；本地负责 build/lint/test/analyze。
5. **重大方案选择必须落盘 `decisions/` 文件**。

---

## 3. Week 10：执行与反馈闭环（2026-08-12 起）

### 目标
让“今日页”真正成为用户每天打开的核心页面，完成习惯/目标进度反馈。

### 后端任务
- [x] 实现“今日最重要的 3 件事”排序算法（通过 `TodayService`）：
  - 输入：当天任务（scheduledDate 为今天或未完成的近期任务）。
  - 排序因子：截止日期紧急度、任务权重、能量等级匹配用户精力曲线、是否已延期。
  - 输出：Top 3 任务列表，其余任务按时间线展示。
- [x] 实现连续打卡计算接口：
  - `GET /habits/:id/stats`：返回当前连续天数、最长连续、完成率等。
  - `GET /goals/:id/stats`：基于目标下任务/习惯打卡，返回连续达标天数。
- [x] 实现目标进度聚合接口：
  - `GET /goals/:id/stats`：按里程碑权重计算百分比，返回各里程碑进度。
- [x] 今日数据聚合接口：
  - `GET /today`：返回今日任务、今日习惯、目标进度、连续打卡、过期任务数。

### Flutter 任务
- [x] 改造 `today_screen.dart`：
  - 顶部展示“今天最重要的 3 件事”。
  - 中部展示习惯打卡列表（快速点击打卡）。
  - 底部展示目标进度卡片与过期任务提示。
- [x] 改造 `habit_screen.dart` / `habit_detail_screen.dart`：
  - 显示连续打卡天数（火焰图标 + 数字）。
  - 打卡后即时更新 streak。
- [x] 改造 `goal_screen.dart`：
  - 增加里程碑时间线（点击目标弹窗展示）。
  - 进度条展示总体完成百分比。

### 验证标准
- [x] 创建目标并生成 30 天计划后，今日页正确展示 Top 3 任务。
- [x] 连续完成习惯打卡后，习惯页显示“连续 N 天”。
- [x] 完成若干里程碑任务后，目标页进度条正确上升。
- [x] `flutter analyze` 无 issues，后端 `npm test` 全绿（11 suites / 38 tests）。

### 验证结果
- 后端 `npm run build` 成功，`npm run test` 全绿。
- Flutter `flutter analyze` No issues found。
- 服务器端到端验证通过：`GET /today` 返回 Top 任务、习惯打卡状态、目标进度 66.67%、连续 1 天；`GET /goals/:id/stats` 返回一致的进度与里程碑。

### 风险点
- 今日页排序算法已结合精力等级，但尚未读取用户偏好中的 `energyCurve` 做动态匹配；当前硬编码中等精力时段权重。
- 连续打卡计算已处理 `completed` / `partial`，补打卡和跳过状态边界已在 Week 6 支持。

---

## 4. Week 11：真实 AI 接入与智能复盘

### 目标
AI 不再只是占位降级，能根据真实模型生成计划并生成复盘。

### 后端任务
- [x] 启用 DeepSeek 真实模型调用：
  - 确认服务器 `.env` 中 `AI_PROVIDER`、`OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL` 配置正确。
  - 跑通 `POST /api/v1/ai/plan-drafts`，返回真实 AI 生成的 tasks。
  - 添加失败重试与费用上限（日费用上限，达到后降级为占位）。
- [x] 计划负载检测：
  - 读取用户偏好 `availableTime`。
  - 对比 `estimatedWeeklyLoad.totalMinutes` 与可用时间，超载时返回 `warnings` 与 `assumptions`。
- [x] 接入真实模型到 `POST /api/v1/ai/review`：
  - 输入：goalId + period（daily/weekly）+ 历史打卡/任务完成情况。
  - 输出：总结、洞察、下一步建议。
- [x] 实现 `POST /api/v1/ai/replan`：
  - 基于已有 PlanVersion 和完成/延期任务，重新生成后续阶段计划。

### Flutter 任务
- [x] AI 计划页展示 AI 生成 loading 状态与 fallback 提示。
- [x] 复盘页接入 `/api/v1/ai/review`，展示 AI 总结。
- [x] 计划超载时，给出明确提示（如“当前任务量超出你设置的时间，建议缩短时长或降低频率”）。

### 验证标准
- [x] 配置有效 key 后，创建计划返回真实 AI 生成的 7/30 天任务。
- [x] 故意设置 planDuration=365、stageLength=7，返回真实 AI 生成的 53 阶段计划（超载检测依赖 `availableTime` 设置，当前默认 420 分钟/周；当设置更小可用时间时会触发 `overload: true`）。
- [x] 完成一周后，复盘页展示真实 AI 生成的周总结。
- [x] 后端 `npm test` 全绿（11 suites / 39 tests），Flutter `flutter analyze` 无 issues。

### 验证结果
- 后端 `npm run build`、`npm run lint`、`npm run test` 全过。
- Flutter `flutter analyze`：No issues found。
- 服务器端到端验证通过：
  - `POST /api/v1/ai/plan-drafts` 返回真实 DeepSeek 生成的 30 天英语口语计划。
  - `POST /api/v1/ai/replan` 基于已确认计划生成第 2 阶段真实 AI 任务。
  - `POST /api/v1/ai/review` 返回真实 AI 生成的周复盘总结/洞察/下一步建议。
  - `AIOperation` 记录显示单次 cost 约 $0.00008-$0.0046，累计远低于 `AI_DAILY_COST_LIMIT_USD=1.0`。

### 风险点
- DeepSeek API 延迟较高（单次约 40-150 秒），移动端 loading 提示已到位；后续可考虑 SSE 流式或切换到更快模型。
- token 费用日上限已配置，当前测试量级远低于 1 USD/天。

---

## 5. Week 12：设置、收件箱与日历

### 目标
补齐用户配置入口和任务整理入口，提升日常可用性。

### 后端任务
- [x] 用户偏好设置 API 已存在，补充默认值与校验：
  - `GET /users/me` 返回完整偏好。
  - `PATCH /users/me/preferences` 更新时区、可用时间、精力曲线、通知开关。
- [x] 收件箱（Inbox）：
  - 新增 `InboxItem` 模型。
  - `POST /inbox`：快速录入想法/任务。
  - `GET /inbox`：列出未整理的收件箱。
  - `POST /inbox/:id/convert`：整理到目标/项目/任务。
  - `POST /inbox/:id/dismiss`：忽略条目。
- [x] 日历事件：
  - 实现 `CalendarEvent` Service/Controller。
  - `GET /calendar?start=...&end=...`：返回日期范围内的事件。

### Flutter 任务
- [x] 新增 `settings_screen.dart`：
  - 时区设置已支持。
  - 可用时间、精力曲线、通知开关设置待后续迭代。
- [x] 新增 `inbox_screen.dart`：
  - 快速输入框。
  - 列表展示，支持整理到目标/项目/任务、忽略。
- [x] 新增 `calendar_screen.dart`：
  - 月视图展示有事件的日期。
  - 点击日期展示当天事件。

### 验证标准
- [x] 设置页修改时区后，`GET /users/me` 返回新时区。
- [x] 在收件箱录入条目并整理到任务成功。
- [x] 日历创建事件并按月查询成功。
- [x] `flutter analyze` 无 issues，后端 `npm test` 全绿（13 suites / 52 tests）。

### 验证结果
- 后端 `npm run build` 成功，`npm run lint` 通过，`npm run test`：13 suites / 52 tests 全部通过。
- Flutter `flutter analyze`：No issues found。
- 服务器端到端验证通过：`/users/me`、收件箱 CRUD/convert、日历 CRUD/list 均正常。

### 风险点
- 设置页目前只支持时区，可用时间/精力曲线/通知的复杂 UI 留待后续 Week。
- 收件箱与日历当前依赖在线 API，尚未接入本地 SQLite 缓存与离线同步队列。
- 日历视图性能：30 天计划任务较多时，后续需增加分页或懒加载。

---

## 6. Week 13：提醒推送与生产加固

### 目标
让系统能主动提醒用户，并提升部署稳定性。

### 后端任务
- [x] 定时任务扫描 `Reminder`：
  - 使用 `@nestjs/schedule` + `node-cron`，每分钟扫描一次。
  - 到期 reminder 更新 `status=sent` 并广播 `reminder.triggered` 同步事件。
- [x] 新增 `POST /reminders/:id/dismiss` 忽略接口。
- [x] 新增 `POST /reminders/:id/snooze` 推迟接口（15/30/60 分钟）。
- [x] 后端测试覆盖：新增 `RemindersScheduler` 与 `RemindersService` 扩展用例。

### Flutter 任务
- [x] `pubspec.yaml` 添加 `flutter_local_notifications`、`timezone`。
- [x] 补全 Android 平台目录与通知权限配置。
- [x] 新建 `NotificationService`：初始化、请求权限、调度/取消本地通知。
- [x] 新建 `ReminderModel` 与 `reminder_provider.dart`。
- [x] `TodayScreen` 展示当天提醒列表，支持忽略/推迟。
- [x] `SettingsScreen` 增加本地通知总开关。
- [x] API 与 WebSocket URL 升级为 `https://xutaostudy.xyz/api/v1`、`wss://xutaostudy.xyz/sync`。

### 生产加固
- [x] Nginx 反向代理 + HTTPS：
  - 修复原 nginx 配置因 `cdn.sta1n.cn` 上游解析失败导致的启动失败。
  - 新增 `/api/v1/`、`/sync` 反向代理到 `127.0.0.1:3001`。
  - 使用现有 DigiCert 证书，`https://xutaostudy.xyz/api/v1/health` 可访问。
- [x] 数据库每日备份：
  - 脚本 `/opt/backups/backup-planning-db.sh`，`pg_dump` 生成 dump，保留 7 天。
  - root cron 每日凌晨 3 点执行。

### 验证标准
- [x] 设置 1 分钟后提醒，后端 cron 触发并标记 `sent`。
- [x] `https://xutaostudy.xyz/api/v1/health` 返回 ok。
- [x] 备份文件生成成功。
- [x] `flutter analyze` 无 issues，后端 `npm test` 全绿（14 suites / 58 tests）。

### 验证结果
- 后端 `npm run build` 成功（需先删除 `tsconfig.tsbuildinfo`）。
- 后端 `npm run lint` 通过。
- 后端 `npm run test`：14 suites / 58 tests 全部通过。
- Flutter `flutter analyze`：No issues found。
- 服务器端到端验证通过：HTTPS 健康检查、提醒创建/snooze/dismiss、定时扫描状态变为 `sent`、Nginx 与 systemd 服务 active、数据库备份文件生成。

### 风险点
- 本地通知目前仅配置 Android；iOS 平台目录未生成。
- 精确闹钟权限在部分 Android 设备需手动授予。
- 备份仅保留本地 7 天，未做异地容灾。

---

## 7. Week 14：预置模板与 AI 高级能力

### 目标
降低冷启动成本，提升 AI 输出稳定性，并建立成本控制机制。

### 后端任务
- [x] 预置领域模板：
  - 考研英语、减脂入门、晨间习惯、阅读计划、日语入门、5 公里跑步等 6 个模板。
  - 模板包含：默认提示词、默认里程碑结构、默认任务类型、默认习惯。
- [x] 模板匹配 + AI 微调：
  - 用户输入先匹配模板（关键词/分类）。
  - 用模板填充基础结构，再用模型做个性化微调。
- [x] 多模型路由：
  - 简单计划用 cheap 模型（环境变量 `AI_CHEAP_MODEL`）。
  - 复杂复盘/重新规划用 strong 模型（环境变量 `AI_STRONG_MODEL`）。
- [x] AI 费用上限与降级：
  - 每日费用上限，达到后自动降级为模板/占位。
  - 记录每次调用的费用到 `AIOperation`。

### Flutter 任务
- [x] AI 计划页增加“选择模板”入口与推荐模板 banner。
- [x] 展示模板推荐与匹配结果。
- [x] 展示 AI 使用状态（今日费用、调用次数）。

### 验证标准
- [x] 选择“考研英语”模板生成计划，内容比通用提示更贴合场景。
- [x] 当日 AI 费用达到上限后，后续调用自动降级为模板。
- [x] 复杂复盘使用 strong 模型，简单计划使用 cheap 模型。
- [x] `flutter analyze` 无 issues，后端 `npm run test` 全绿（14 suites / 64 tests）。

### 验证结果
- 后端 `npm run build` 成功（已删除 `tsconfig.tsbuildinfo`）。
- 后端 `npm run lint` 通过。
- 后端 `npm run test`：14 suites / 64 tests 全部通过。
- Flutter `flutter analyze`：No issues found。
- 本地功能验证：模板推荐、模板选择、AI 用量卡片、费用上限降级均正常。

### 风险点
- [ ] 模板匹配准确率需要真实数据调优（已预留关键词扩展空间）。
- [ ] 多模型路由当前依赖同一 provider 与同一 API key；若跨供应商需拆分 ModelAdapter。
- [ ] AIOperation 表未做自动清理，长期运行可能累积大量记录。

---

## 8. Week 15：社交与共享

### 目标
实现目标共享、小组挑战与排行榜，让用户的成长过程可协作、可竞赛。

### 后端任务
- [x] 数据模型扩展：
  - `GoalShare`：目标共享邀请，支持 `pending/accepted/declined` 与 `view/edit` 权限。
  - `Challenge`：挑战定义，支持 `habit_streak/task_count/goal_progress` 类型。
  - `ChallengeParticipant`：记录用户加入与累计得分。
- [x] 社交模块 Service/Controller/Module：
  - `POST /social/goals/:id/share` 分享目标。
  - `GET /social/shares/received` / `GET /social/shares/owned` 查询共享。
  - `POST /social/shares/:id/respond` 接受/拒绝。
  - `POST /social/challenges` 创建挑战。
  - `GET /social/challenges` 列出挑战。
  - `POST /social/challenges/:id/join` 加入挑战。
  - `GET /social/challenges/:id/leaderboard` 排行榜。
- [x] 排行榜计分：
  - `habit_streak`：周期内习惯 checkin 次数。
  - `task_count`：周期内完成任务数。
  - `goal_progress`：周期内任务完成百分比。

### Flutter 任务
- [x] 新增 `SocialScreen`：共享目标、挑战、排行榜 Tab。
- [x] `GoalScreen` 增加分享按钮与邮箱输入框。
- [x] `MoreScreen` 增加「社交」入口。
- [x] 新增 `social_provider.dart` 封装接口。

### 验证标准
- [x] 用户 A 可将目标分享给用户 B，用户 B 收到 pending 邀请并可接受。
- [x] 用户可创建挑战，其他用户可加入并查看排行榜。
- [x] 排行榜根据挑战类型正确排序。
- [x] `flutter analyze` 无 issues，后端 `npm run test` 全绿（15 suites / 70 tests）。

### 验证结果
- 后端 `npm run build` 成功。
- 后端 `npm run lint` 通过。
- 后端 `npm run test`：15 suites / 70 tests 全部通过。
- Flutter `flutter analyze`：No issues found。
- 服务器端到端验证：目标分享、接受邀请、创建/加入挑战、排行榜均正常。

### 风险点
- [ ] 排行榜显示用户邮箱，缺少昵称/头像。
- [ ] 共享目标未完整实现编辑权限控制。
- [ ] 挑战未关联具体目标/习惯，按全局行为计分。
- [ ] 社交页面未接入本地缓存与实时推送。

---

## 9. Week 16：外部集成（2026-08-13）

### 目标
打通外部日历和运动设备，让用户的计划数据不再孤岛。

### 后端任务
- [x] 扩展 `CalendarEvent` 模型：新增 `source` 字段，标记事件来源（ics / google / outlook）。
- [x] 新增 `ExternalActivity` 模型：保存从运动设备导入的原始活动记录。
- [x] ICS 导入：
  - `POST /calendar/import-ics`：接收 ICS 文本，解析 VEVENT，按 `(title, startAt)` 去重后落库。
- [x] ICS 导出：
  - `GET /calendar/export-ics`：将用户日历事件导出为 ICS 文本（JSON 包裹 `{ icsText }`）。
- [x] 外部日历订阅：
  - `POST /calendar/sync-external`：通过 URL 拉取 ICS，兼容 Google/Outlook 公开 ICS 地址。
- [x] 运动数据导入：
  - `POST /external/fitness-import`：接收运动 JSON 数组，保存到 `ExternalActivity`；若提供 `habitId` 则自动生成习惯打卡。

### Flutter 任务
- [x] `CalendarScreen` 增加 AppBar 菜单：导入 ICS、导出 ICS、订阅外部日历。
- [x] 新增 `FitnessImportScreen`：支持单条录入和批量 JSON 导入运动数据。
- [x] `MoreScreen` 增加「运动导入」入口。
- [x] 新增 `external_provider.dart` 封装 `/external/fitness-import`。

### 验证标准
- [x] 粘贴有效 ICS 文本后，日历页出现对应事件。
- [x] 导出 ICS 包含已创建的日历事件。
- [x] 调用 `/external/fitness-import` 成功保存运动记录并可生成打卡。
- [x] 后端 `npm run test`：16 suites / 77 tests 全部通过，`npm run lint`、`npm run build` 通过。
- [x] Flutter `flutter analyze`：No issues found。

### 风险点
- [ ] 未实现 Google/Outlook OAuth，当前仅支持公开 ICS URL / 文件粘贴；私有日历需先获取公开地址。
- [ ] 运动数据未接入真实设备 SDK，仅提供 JSON/CSV 占位接口。
- [ ] 外部日历同步暂无定时轮询，需手动触发或后续增加后台任务。

---

## 10. Week 17：数据报表（2026-08-13）

### 目标
把用户累积的任务、习惯、打卡数据转化为可感知的执行反馈，帮助用户复盘。

### 后端任务
- [x] 新建 `ReportsModule`：
  - `GET /reports/execution?period=weekly|monthly|yearly&date=YYYY-MM-DD`
    - 按周期统计任务完成、习惯打卡、目标数量。
  - `GET /reports/energy`
    - 读取用户 `energyCurve` 偏好。
    - 按任务 `energyLevel` 统计完成率，给出简单建议。
  - `GET /reports/best-time`
    - 基于近 90 天打卡 `createdAt` 小时分布，找出最佳完成时段。
- [x] 不新增数据库表，复用 `Task`、`Checkin`、`Goal`、`User` 聚合计算。

### Flutter 任务
- [x] 新增 `ReportsScreen`：Tab 切换「执行」「能量」「时段」。
- [x] 执行 Tab：周期选择（周/月/年）+ 日期选择 + 任务/习惯/目标卡片。
- [x] 能量 Tab：展示精力曲线偏好与各能量等级完成率。
- [x] 时段 Tab：24 小时柱状图 + 最佳时段提示。
- [x] `MoreScreen` 增加「数据报表」入口。
- [x] 新增 `reports_provider.dart`。

### 验证标准
- [x] `GET /reports/execution?period=weekly&date=2026-08-17` 返回任务/习惯/目标汇总。
- [x] `GET /reports/energy` 返回精力曲线与完成率建议。
- [x] `GET /reports/best-time` 返回 24 小时分布。
- [x] 后端 `npm run test`：17 suites / 80 tests 全部通过，`npm run lint`、`npm run build` 通过。
- [x] Flutter `flutter analyze`：No issues found。

### 风险点
- [ ] 报表目前使用 UTC 周期边界，未按用户 `timezone` 做本地时区转换。
- [ ] 未加入趋势对比（与上一周期比较）。
- [ ] 未缓存报表结果，数据量大时可能较慢。

---

## 11. Week 18：高级 AI（2026-08-13）

### 目标
基于用户长期行为数据，生成用户画像摘要和个性化计划建议。

### 后端任务
- [x] 新建 `AiInsightsService`：
  - 聚合用户历史任务、习惯打卡、目标数据。
  - 计算任务完成率、习惯打卡率、推迟原因分布、活跃天数、常见精力等级。
- [x] `GET /ai/profile-summary`：
  - 使用 strong 模型生成用户画像摘要（summary/strengths/weaknesses/suggestedFocus/riskAreas）。
  - 未配置模型或费用超限时，降级为基于统计规则的摘要。
  - 返回中附带 `stats` 与 `fallback` 标记。
- [x] `GET /ai/personalized-recommendations?goalId=`：
  - 基于用户画像统计和可选目标，给出下一步目标、习惯、排程建议。
  - 规则驱动，无需额外模型调用，保证即时可用。
- [x] 记录 `AIOperation`：profile-summary 调用计入每日 AI 费用上限。

### Flutter 任务
- [x] 新增 `AiInsightsScreen`：展示用户画像摘要、核心数据、个性化建议。
- [x] 新增 `ai_insights_provider.dart` 封装 `/ai/profile-summary` 与 `/ai/personalized-recommendations`。
- [x] `MoreScreen` 增加「AI 洞察」入口。

### 验证标准
- [x] `GET /ai/profile-summary` 返回用户画像与统计数据。
- [x] `GET /ai/personalized-recommendations` 返回目标/习惯/排程建议。
- [x] AI 未配置或费用超限时返回 `fallback: true` 与规则摘要。
- [x] 后端 `npm run test`：18 suites / 83 tests 全部通过，`npm run lint`、`npm run build` 通过。
- [x] Flutter `flutter analyze`：No issues found。

### 风险点
- [ ] profile-summary 依赖 strong 模型，调用成本高于简单计划；已纳入日费用上限控制。
- [ ] 当前分析维度有限，未结合任务实际完成时间与用户精力曲线做深度关联。
- [ ] 未实现周期性自动刷新画像，需用户手动触发。

---

## 12. Week 19：个人多端离线同步补全（已完成）

### 目标
把 Week 12-18 新增的个人核心数据（Inbox、Calendar、Reports、ExternalActivity）纳入多端离线同步体系，让个人在多设备间无网可查看、联网后自动合并。当前为**个人使用版本**，Social 模块（目标分享、挑战、排行榜）的同步事件暂时不做，相关代码保留但仅冻结维护，为未来商业版复用。

### 后端任务
- [x] 扩展 `SyncEvent` 广播范围（个人数据）：
  - `InboxItem` 创建/更新/忽略/整理后广播 `inbox.created` / `inbox.updated` / `inbox.dismissed` / `inbox.converted`。
  - `CalendarEvent` 创建/更新/删除后广播 `calendar.created` / `calendar.updated` / `calendar.deleted`。
  - `ExternalActivity` 导入成功后广播 `external.imported`（可选，用于刷新报表缓存）。
  - 注：`GoalShare` / `Challenge` 等 Social 事件在当前个人版不广播，保留现有代码但不扩展。
- [x] 扩展 `/sync/events` 查询支持 `eventType` 过滤，便于客户端按需拉取个人事件。

### Flutter 任务
- [x] 扩展 `LocalDatabase`（个人数据表）：
  - 新增 `inbox_items`、`calendar_events` 表。
  - 新增对应操作类型：`create_inbox`、`update_inbox`、`dismiss_inbox`、`convert_inbox`、`create_calendar`、`update_calendar`、`delete_calendar`。
  - 不新增 `social_shares`、`challenges` 本地表（个人版暂不启用）。
- [x] 改造 Provider：
  - `inbox_provider` / `calendar_provider` 改为本地优先读取，在线时异步同步。
  - `social_provider` 在个人版中保持在线只读，不接入离线队列。
  - 监听 `SyncEvent` 并更新本地表。
- [x] `SyncEngine.pushOperations` 增加新操作类型的入队/推送/重试。

### 验证标准
- [x] 离线创建收件箱条目，联网后出现在服务器。
- [x] 离线创建日历事件，联网后多端可见。
- [x] 后端 `npm run test` 新增/更新相关测试，Flutter `flutter analyze` 无 issues。

### 风险点
- [x] 冲突解决策略简单（最后写入优先），未实现复杂 CRDT/版本向量。
- [x] 同步事件 payload 增大后，首次拉取可能变慢。

---

## 13. Week 20：个人版设置与体验打磨（计划中）

### 目标
补齐个人使用场景下的用户偏好设置 UI，降低冷启动门槛，提升每日操作效率。当前版本不引入团队/共享相关配置。

### 后端任务
- [ ] 用户偏好默认值与校验补全：
  - 确认 `PATCH /users/me/preferences` 能完整保存/更新 `availableTime`、`energyCurve`、`notificationSetting`。
- [ ] 模板匹配关键词调优：基于模板类别与常见输入扩展同义词。

### Flutter 任务
- [ ] 设置页升级：
  - 可用时间：一周七天、每时段开始/结束时间选择。
  - 精力曲线：24 小时滑动选择高/中/低。
  - 通知偏好：提醒提前分钟数、免打扰时段、周末开关。
- [ ] 登录/注册 UI 完善：表单校验、密码可见切换、错误提示。
- [ ] AI 计划页：模板选择后自动回填默认 `planDuration` / `stageLength`。
- [ ] 任务/习惯列表增加筛选（状态、能量等级、日期）与排序。
- [ ] 今日页增加「明日预览」入口。

### 验证标准
- [ ] 设置保存后，`GET /users/me` 返回一致偏好。
- [ ] 新用户注册流程完整可用。
- [ ] AI 模板选择后默认值自动填充。
- [ ] `flutter analyze` 无 issues。

### 风险点
- [ ] 设置项增多后，首次加载需处理好默认值与向后兼容。
- [ ] 不同 Android/iOS 版本通知权限行为差异大。

---

## 14. Week 21：个人版生产加固与性能优化（已完成）

### 目标
为个人长期自用清理历史债务、提升稳定性与响应速度。备份/日志策略以满足个人数据安全为主，商业化级异地容灾作为可选项保留脚本占位，不强制启用。

### 后端任务
- [ ] `AIOperation` 自动清理：
  - 新增定时任务，删除 30 天前的原始 AIOperation 明细，保留每日汇总。
- [ ] 数据库索引优化：
  - 为 `AIOperation.createdAt`、`Checkin.date`、`Task.scheduledDate`、`Task.status`、`CalendarEvent.startAt` 等高频查询字段增加索引。
- [ ] 报表结果缓存：
  - 使用 Redis 缓存 `/reports/*` 结果，TTL 1 小时；数据变更时失效。
- [ ] 备份与日志：
  - 配置 Nginx 日志轮转。
  - 完善数据库本地备份脚本，并增加上传到对象存储（OSS/S3）的可选占位脚本（个人版不强制启用，为未来商业版/多用户场景预留）。

### Flutter 任务
- [ ] iOS 平台目录与通知配置：
  - 生成 iOS 平台目录、`Info.plist` 通知权限、精确闹钟说明文本。
- [ ] 本地通知点击跳转：点击通知打开今日页/任务详情。
- [ ] Android 精确闹钟权限引导。
- [ ] 引入 `fl_chart` 替换报表页 Container 柱状图。

### 验证标准
- [ ] AIOperation 清理任务运行后，30 天前记录被删除。
- [ ] 报表接口在缓存命中时响应时间 < 100ms。
- [ ] iOS `flutter analyze` / `flutter build ios --no-codesign` 不报错。
- [ ] Nginx 日志按天轮转。

### 风险点
- [ ] 缓存失效策略遗漏会导致报表数据滞后。
- [ ] iOS 推送证书与真机调试需 Apple Developer 账号，当前仅做代码与模拟验证。

---

## 15. Week 24：高级 AI 深化（2026-08-13）

### 目标
解决 AI 计划生成 40–150s 阻塞等待问题；自动刷新用户画像快照；根据历史目标行为优化模板推荐。

### 后端任务
- [x] `ModelAdapter.streamProgress()`：在模型调用前后发送 `progress` / `result` 事件。
- [x] `PlanOrchestrator.generateDraftStream()`：流式编排计划生成并产出阶段进度事件。
- [x] `AiService.createStreamDraft()`：快速创建 pending 草案记录。
- [x] `AiService.streamDraft()`：真正 SSE 流式生成，落库 PlanVersion 与 AIOperation。
- [x] `POST /ai/plan-drafts/stream` + `GET /ai/plan-drafts/:id/stream` 接口。
- [x] `UserProfileSnapshot` 模型与迁移；`refreshProfileSnapshot()`；`autoRefreshProfiles()` 每周日 03:00 cron。
- [x] `GET /ai/profile-summary?useSnapshot=true` 支持读快照/强制刷新。
- [x] 模板推荐 `recommendTemplate()` 增加 `UserHistoryHint` 历史权重。
- [x] `GET /ai/templates/recommend` 读取当前用户目标标题/状态构造历史权重。

### Flutter 任务
- [x] 新建 `SseClient` 消费 SSE 事件流。
- [x] `ai_provider.dart` 新增 `createDraftStream()` 与事件类型。
- [x] `ai_plan_draft_screen.dart` 流式生成 UI：阶段进度条 + 最终草案展示。
- [x] `ai_insights_provider.dart` 新增 `refreshProfileSummary()`。
- [x] `ai_insights_screen.dart` 显示最后刷新时间，支持手动刷新。

### 验证标准
- [x] 后端 `npm run test`：19 suites / 92 tests 通过。
- [x] 后端 `npm run build` 通过。
- [x] Flutter `flutter analyze` 无 issues。
- [x] 服务器部署成功，`/health`、SSE 流式接口、画像快照接口均验证通过。

### 风险点
- [x] SSE 在 Nginx 下被缓冲：已确认 `/etc/nginx/sites-enabled/xutaostudy.xyz` 配置 `proxy_buffering off; proxy_cache off; proxy_read_timeout 300s;`。
- [x] 自动刷新 cron 对个人用户成本可控；后续若扩展需加开关 `AI_AUTO_PROFILE_REFRESH_ENABLED`。

---

## 16. Week 25：外部集成深化（2026-08-13）

### 目标
支持 OAuth2 私有日历同步、外部日历订阅自动轮询、Health Connect 运动数据导入。

### 后端任务
- [x] Prisma schema 新增 `CalendarSubscription` 模型与迁移。
- [x] 新增 `CalendarOAuthService`：Google OAuth 授权、回调、token 加密、主日历事件导入。
- [x] Outlook OAuth scaffold（个人版未实现）。
- [x] 新增 `CalendarSyncService`：ICS/Google/Outlook 来源分发同步，每 6 小时 cron 轮询。
- [x] `CalendarController` 新增订阅 CRUD、手动同步、OAuth 路由与回调页。
- [x] `CalendarService` 新增订阅管理，`importIcs` 支持 `source` 参数。
- [x] 新增 `calendar-oauth.service.spec.ts`、`calendar-sync.service.spec.ts`。

### Flutter 任务
- [x] 新增 `health`、`url_launcher` 依赖。
- [x] `ExternalApi` 新增 `syncHealthConnect()`，读取 workouts 并导入。
- [x] `FitnessImportScreen` 新增「从 Health Connect 同步」按钮。
- [x] `CalendarNotifier` 新增订阅管理、Google OAuth 外部浏览器打开。
- [x] `CalendarScreen` 新增「管理外部日历订阅」弹窗。

### 验证标准
- [x] 后端 `npm run test`：21 suites / 99 tests 通过。
- [x] 后端 `npm run build` 通过。
- [x] Flutter `flutter analyze` 无 issues。

### 风险点
- [x] Google OAuth 需用户自行注册应用并配置 redirect URI；未配置时接口返回友好提示。
- [x] Health Connect 在部分国产 Android 不存在，失败时提示回退 JSON 导入。
- [x] token 加密使用 AES + 环境密钥，商业版可升级 KMS。

---

## 17. Week 28：真机问题修复与推送闭环（2026-08-15 起）

### 目标

修复 2026-08-15 Android 真机日志排查中发现的 P0/P1/P2 问题，完成 FCM 远程推送闭环，恢复 Health Connect 运动数据同步能力，并消除资源与兼容性警告。

### 背景

Week 27 APK 在 vivo 真机运行 6 分钟无崩溃，但日志暴露出 4 个待修复项：
- **P0**：Firebase/FCM 未真正初始化（Android 工程未应用 `google-services` 插件）。
- **P1**：`health` 插件注册失败（`ClassCastException`），Health Connect 同步不可用。
- **P2**：`Invalid resource ID 0x00000001` 出现 4 次。
- **P2**：`OnBackInvokedCallback` 未启用，Android 13+ 返回手势兼容性警告。

详见 `docs/testing-phase.md` 第 19 节与 `docs/testing-plan.md` 第 7 节。

### Flutter 任务

- [ ] **Firebase Android 工程配置**
  - 在 Firebase Console 创建 Android 应用并下载 `google-services.json`。
  - 放置到 `apps/mobile/android/app/google-services.json`。
  - 在 `android/build.gradle` 项目级添加 `com.google.gms:google-services` 插件依赖。
  - 在 `android/app/build.gradle.kts` 底部 `apply(plugin = "com.google.gms.google-services")`。
  - 重新构建 APK，验证日志输出 `FirebaseApp initialization successful`。

- [ ] **修复 HealthPlugin 注册失败**
  - 检查 `health` 插件版本与当前 Flutter/Android Gradle/compileSdk 36 的兼容性矩阵。
  - 确认 `MainActivity` 是否继承 `FlutterFragmentActivity`（部分权限插件需要）。
  - 清理 Pub Cache 与 Gradle Cache 后重新构建。
  - 验证 `GeneratedPluginRegistrant.registerWith()` 不再抛 `ClassCastException`。

- [ ] **排查 Invalid resource ID**
  - 检查 `pubspec.yaml` 中 `assets` 声明是否完整。
  - 检查 Dart 代码中 `Image.asset`、`Icon`、`AnimationController` 是否引用了未声明资源。
  - 检查第三方图表/图标库是否依赖缺失默认资源。

- [ ] **启用预测性返回手势**
  - 在 `AndroidManifest.xml` 的 `<application>` 标签添加 `android:enableOnBackInvokedCallback="true"`。

### 后端任务

- [ ] 确认 `fcm.service.ts` 在收到合法 FCM token 后可调用 Firebase Admin SDK 发送测试消息。
- [ ] 验证 `POST /users/me/fcm-token` 在客户端正确初始化后可正常接收并保存 token。

### 验证标准

- [ ] 真机启动日志无 `FirebaseApp initialization unsuccessful`。
- [ ] 登录后 FCM token 成功上传，后端 `users.fcmToken` 字段有值。
- [ ] HealthPlugin 注册无异常，`FitnessImportScreen`「从 Health Connect 同步」按钮可用。
- [ ] 真机测试 10 分钟，无 `Invalid resource ID 0x00000001`。
- [ ] 真机日志无 `OnBackInvokedCallback is not enabled` 警告。
- [ ] `flutter analyze` 无 issues，APK 构建成功。

### 风险点

- [ ] 配置 Firebase 需要访问 Firebase Console 并下载 `google-services.json`；若网络受限需提前准备。
- [ ] `health` 插件版本兼容性问题可能需要升级/降级或等待上游修复。
- [ ] `Invalid resource ID` 可能是第三方库问题，定位耗时。

---

## 18. 未来更新计划（Week 29+）

| Week | 方向 | 说明 |
|---|---|---|
| Week 26 | 稳定性与规模化 | 已完成：初始化 Git 仓库、本地通知真机体验改进 |
| Week 27 | 个人版多端离线同步 | 已完成：Inbox/Calendar 本地优先、SyncEngine 重试、日历订阅自动刷新、FCM 后端 |
| Week 28 | 真机问题修复与推送闭环 | 修复 Android FCM 初始化、HealthPlugin 注册、资源 ID、OnBackInvokedCallback |
| Week 29+ | 商业化与社交深度 | 订阅/会员、团队版入口、数据导出、昵称/头像、共享目标编辑权限、实时排行榜推送 |

---

## 19. 文档维护约定

1. 每个 Week 开始和结束时，必须更新本文档对应章节的 checkbox 状态。
2. 每个 Week 结束时，必须更新 `planning-app/docs/development-log.md` 增加该 Week 章节。
3. 必须同步更新 `planning-app/docs/handover-summary.md` 中的进度与风险点。
4. 重大方案选择必须写入 `decisions/YYYY-MM-DD-WeekX主题决策.md`。

---

## 20. 下一步行动（当前待执行）

Week 27 已完成本地代码与测试阶段初期构建。2026-08-15 Android 真机测试发现 FCM 未初始化、HealthPlugin 注册失败、资源 ID 无效等可修复问题。当前优先进入 **Week 28：真机问题修复与推送闭环**：

1. **Week 28 修复任务**
   - 配置 Firebase Android 工程（`google-services.json` + `com.google.gms.google-services` 插件）。
   - 修复 `health` 插件 `ClassCastException`（版本/Activity 类型/compileSdk 兼容性）。
   - 排查并修复 `Invalid resource ID 0x00000001`。
   - 在 `AndroidManifest.xml` 启用 `android:enableOnBackInvokedCallback="true"`。
   - 重新构建 APK 并在真机复测，确认日志干净、推送 token 可上传。

2. **Week 28 结束后可选方向**
   - 继续执行 `docs/testing-plan.md` 中剩余用例，输出完整测试报告。
   - 将 Windows 安装包制作为 MSI/NSIS 安装程序，便于分发。
   - 评估是否接入 iOS 推送/HealthKit（需 Apple Developer 账号）。

完整商业化/社交/团队版计划已保留在 **未来更新计划（Week 29+）** 中，作为后续商业版本的开发备份，当前不执行。
