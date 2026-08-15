# 计划型 App 测试阶段文档

> 详细测试计划见 [`docs/testing-plan.md`](./testing-plan.md)。本文档记录测试阶段构建产物、环境、问题修复与测试方法速查。

## 17. 测试阶段：安装包构建（2026-08-14）

### 目标

开发阶段结束后，进入测试阶段。首先完成两端安装包的构建：
- Android APK 安装包
- Windows 桌面 exe 可执行包

### 环境准备

- **Flutter**：`C:/Users/Administrator/flutter`（3.44.9，stable）
- **Android SDK**：`C:/Users/Administrator/android-sdk`
  - 通过 commandlinetools 安装 `platform-tools`、`platforms;android-36`、`build-tools;36.0.0`
- **Visual Studio**：`Visual Studio 生成工具 2026`（已修复安装，Flutter Windows 工具链通过）
- **Firebase C++ SDK**：`C:/Users/Administrator/firebase-sdk/firebase_cpp_sdk_windows`（12.7.0）
  - 因 `cmake_minimum_required(VERSION 3.1)` 与当前 CMake 不兼容，已 patch 为 `3.5`
  - 构建 Windows 时需设置环境变量 `FIREBASE_CPP_SDK_DIR`

### 构建产物

| 平台 | 路径 | 大小 | 说明 |
|------|------|------|------|
| Android APK | `planning-app/releases/planning-app-week27.apk` | ~57 MB | 签名使用 debug key，个人测试使用 |
| Windows exe | `planning-app/releases/windows/planning_app_mobile.exe` + DLL + data | ~37 MB | 需连同整个 `windows/` 目录分发 |

### 构建命令

```bash
# Android APK
cd planning-app/apps/mobile
export PUB_HOSTED_URL=https://mirrors.cloud.tencent.com/dart-pub
export FLUTTER_STORAGE_BASE_URL=https://mirrors.cloud.tencent.com/flutter
flutter build apk --release

# Windows exe
export FIREBASE_CPP_SDK_DIR=/c/Users/Administrator/firebase-sdk/firebase_cpp_sdk_windows
flutter build windows --release
```

### 关键问题与修复

1. **Android：health 插件要求 minSdk 26**
   - 错误：`uses-sdk:minSdkVersion 24 cannot be smaller than version 26 declared in library [:health]`
   - 修复：`android/app/build.gradle.kts` 中 `minSdk = 26`

2. **Android：health 插件依赖 `androidx.health.connect` 要求 compileSdk 35+**
   - 错误：`:health is currently compiled against android-34`
   - 修复：临时 patch Pub Cache 中 `health-12.2.1/android/build.gradle` 的 `compileSdk 34 -> 36` 和 `targetSdkVersion 34 -> 36`
   - 长期建议：升级 `health` 插件到支持 Android 36 的版本，或在项目级 `subprojects` 脚本中强制统一 compileSdk。

3. **Android：`flutter_local_notifications` 需要 core library desugaring**
   - 错误：`Dependency ':flutter_local_notifications' requires core library desugaring to be enabled`
   - 修复：`android/app/build.gradle.kts` 中启用 `isCoreLibraryDesugaringEnabled = true` 并添加 `coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")`

4. **Windows：`firebase_cpp_sdk_windows` CMake 版本不兼容**
   - 错误：`Compatibility with CMake < 3.5 has been removed from CMake`
   - 修复：预下载 Firebase C++ SDK 12.7.0，修改 `CMakeLists.txt` 中 `cmake_minimum_required(VERSION 3.1)` 为 `3.5`，并设置 `FIREBASE_CPP_SDK_DIR` 环境变量避免重复下载。

5. **Windows：`flutter_local_notifications` 不支持 Windows 桌面**
   - 错误：`LateInitializationError: Field '_instance' has not been initialized`
   - 原因：`flutter_local_notifications 17.2.4` 只有 Android / iOS / macOS / Linux 实现，无 Windows 平台目录。
   - 修复：在 `NotificationService` 中对 `Platform.isWindows || Platform.isLinux` 直接返回，跳过插件初始化。

6. **Windows：`firebase_messaging` 不支持 Windows 桌面**
   - 错误：`[core/no-app] No Firebase App '[DEFAULT]' has been created`
   - 原因：`FirebaseMessaging.instance` 在构造函数中即访问 `Firebase.app()`，Windows 无 FirebaseOptions。
   - 修复：将 `FcmService` 中 `_messaging` 改为 `FirebaseMessaging?`，并在 `initialize()` 中判断桌面平台直接返回。

### 验证结果

- `flutter analyze`：No issues found ✅
- Android APK：`build/app/outputs/flutter-apk/app-release.apk` 构建成功 ✅
- Windows exe：`build/windows/x64/runner/Release/planning_app_mobile.exe` 构建成功，启动后无崩溃，进程持续运行 ✅
- 服务部署：`https://xutaostudy.xyz/api/v1/health` 正常 ✅

### 测试阶段后续建议

1. 在 Android 真机/模拟器安装 APK，测试登录、今日页、目标、任务、习惯、AI 计划、复盘等核心流程。
2. 在 Windows 桌面双击 `planning_app_mobile.exe`，测试登录后各页面渲染、网络请求、离线同步（Windows 有 SQLite 支持）。
3. 注意 Windows 版当前缺失：本地通知、FCM 远程推送。这些属于移动端特性，桌面版后续如需支持需更换/补充插件。
4. 如要继续分发，建议为 Windows 包制作安装程序（MSIX / Inno Setup / NSIS），否则需手动复制整个 `windows/` 目录。

### 相关提交

- `0490efe` chore: Windows 桌面构建与安装包打包支持


---

## 18. 测试阶段：测试方法与观察指标

### 测试目标

验证 Week 27 个人使用版本在 Android 真机和 Windows 桌面上的可用性、稳定性与核心功能完整性。

### 测试环境

| 环境 | 地址/路径 | 说明 |
|------|-----------|------|
| 后端 API | `https://xutaostudy.xyz/api/v1` | 已部署 Week 27 版本 |
| Android 包 | `planning-app/releases/planning-app-week27.apk` | 57 MB，debug 签名 |
| Windows 包 | `planning-app/releases/windows/` | 37 MB，需复制整个目录 |
| 健康检查 | `GET https://xutaostudy.xyz/api/v1/health` | 快速验证服务端状态 |

### Android 真机/模拟器测试建议

#### 1. 安装与启动

```bash
# 使用 adb 安装 APK
adb install -r planning-app/releases/planning-app-week27.apk

# 启动应用
adb shell am start -n com.example.planning_app_mobile/.MainActivity
```

#### 2. 必测核心流程（按优先级）

| 优先级 | 测试项 | 预期结果 | 关注指标 |
|--------|--------|----------|----------|
| P0 | 注册 / 登录 | 成功进入今日页，无白屏/无网络错误 | 登录耗时、错误提示 |
| P0 | 今日页加载 | 显示 Top 3 任务、习惯打卡、目标进度、过期任务 | 加载耗时、空状态处理 |
| P0 | 创建目标 + AI 生成计划 | 3 分钟内返回可执行计划，可确认落库 | AI 响应时间、计划质量 |
| P0 | 完成任务 / 习惯打卡 | 进度实时更新，连续天数增加 | 同步状态、离线回退 |
| P0 | 离线后操作再联网 | 操作不丢失，联网后自动同步 | 操作队列、SyncEngine 重试 |
| P1 | 收件箱增删改 | 本地优先，服务端同步 | 离线一致性 |
| P1 | 日历事件 / ICS 导入 | 事件显示正常，导入成功 | 外部日历兼容性 |
| P1 | 设置页保存偏好 | 时区、可用时间、精力曲线保存成功 | 嵌套 DTO 兼容性 |
| P2 | 提醒创建与触发 | 到期后收到本地通知 | 精确闹钟权限 |
| P2 | AI 复盘 / 画像刷新 | 返回总结/建议，不崩溃 | AI 费用、fallback |
| P2 | 社交 / 分享 | 个人版不重点测，能打开不崩溃即可 | — |

#### 3. Android 日志查看方法

应用日志通过 `adb logcat` 输出，Flutter 日志会显示在 `flutter` 标签下。

```bash
# 1. 确保设备已连接
adb devices

# 2. 查看全部日志（实时）
adb logcat

# 3. 只查看 Flutter 相关日志（推荐）
adb logcat -s flutter

# 4. 只查看应用包名日志（推荐，过滤更精确）
adb logcat --pid=$(adb shell pidof -s com.example.planning_app_mobile)

# 5. 将日志保存到文件，便于后续分析
adb logcat -v threadtime > app.log

# 6. 清空旧日志后重新开始记录
adb logcat -c
adb logcat -v threadtime > app.log
```

常见日志关键词：
- `flutter`：Flutter 引擎日志、未捕获异常
- `planning_app_mobile`：Dart 端 logger 输出（如果使用 logger 包）
- `sqflite`：本地数据库操作
- `HttpClient` / `Dio`：网络请求（本项目使用 `http` 包）

#### 4. Android 关键观察指标

- **启动时间**：从点击图标到今日页可交互 < 3 秒
- **崩溃率**：核心流程无崩溃（logcat 中无 `FATAL EXCEPTION`）
- **网络错误**：弱网/离线下操作有 Loading 或失败提示，不白屏
- **AI 响应时间**：`POST /ai/plan-drafts` 在 Wi-Fi 下 < 30 秒（DeepSeek 真实模型）
- **同步一致性**：多端/离线操作后，数据最终与服务器一致
- **电量/内存**：后台运行 30 分钟，无异常 CPU 占用或内存泄漏

### Windows 桌面测试建议

#### 1. 运行方式

复制整个 `releases/windows/` 目录到目标 Windows 电脑，双击 `planning_app_mobile.exe`。

> 注意：Windows 版当前不包含本地通知和 FCM 推送，这些属于移动端特性。

#### 2. 必测核心流程

| 优先级 | 测试项 | 预期结果 |
|--------|--------|----------|
| P0 | 双击启动 | 窗口打开，无崩溃 |
| P0 | 登录 | 成功进入今日页 |
| P0 | 页面切换 | 今日页、目标页、任务页、习惯页、AI 计划页等均可打开 |
| P0 | 创建目标 + AI 生成计划 | 返回计划并确认落库 |
| P1 | 离线操作 | SQLite 本地数据库可用，操作入队 |
| P1 | 窗口缩放 | 不同分辨率下 UI 不溢出 |
| P2 | 后台/前台切换 | 不崩溃，网络恢复后同步 |

#### 3. Windows 日志查看方法

Windows 桌面版日志输出方式：

1. **命令行运行查看 stdout/stderr**：
   ```powershell
   cd releases\windows
   .\planning_app_mobile.exe > app.log 2>&1
   ```

2. **Flutter 热重载/运行模式日志**（开发调试用）：
   ```bash
   cd planning-app/apps/mobile
   flutter run -d windows --release
   ```

3. **Windows 事件查看器**（系统级崩溃）：
   - 运行 `eventvwr.msc`
   - 路径：`Windows 日志` → `应用程序`
   - 查找来源为 `Application Error` 或 `planning_app_mobile` 的条目

常见日志关键词：
- `flutter:`：Flutter 引擎日志
- `ERROR:flutter`：Flutter 未捕获异常
- `LateInitializationError`、`No Firebase App`、`PlatformException`：插件/平台错误

#### 4. Windows 关键观察指标

- **启动时间**：双击后 5 秒内出现窗口
- **内存占用**：静态页面约 100-150 MB，正常
- **崩溃率**：核心流程无崩溃
- **网络连通性**：能正常访问 `https://xutaostudy.xyz/api/v1`
- **UI 适配**：窗口最小化/最大化后布局正常

### 通用问题排查速查表

| 现象 | 排查方向 | 查看位置 |
|------|----------|----------|
| 启动白屏/崩溃 | `main.dart` 初始化插件异常 | `adb logcat -s flutter` / Windows `app.log` |
| 登录失败 | 网络、后端 `/health`、JWT | 后端日志 `journalctl -u planning-api` |
| 数据不同步 | SyncEngine、WebSocket | 客户端日志 + 后端 `/sync/events` |
| AI 无响应 | DeepSeek 余额、网络、后端日志 | 后端日志、AI 用量接口 `/ai/usage` |
| 本地通知不触发 | 权限、精确闹钟、通知渠道 | Android 系统设置 + `adb logcat` |
| Windows 缺少 DLL | 是否复制了整个 `windows/` 目录 | 目录完整性 |

### 测试输出物

测试完成后建议记录：
1. 设备型号 / Windows 版本
2. 网络环境（Wi-Fi / 移动数据 / 离线）
3. 测试用例通过/失败清单
4. 关键日志片段（崩溃、异常、慢请求）
5. 性能数据（启动时间、AI 响应时间、内存占用）

相关文件：
- `planning-app/releases/planning-app-week27.apk`
- `planning-app/releases/windows/`
- 测试日志：`app.log`（Android 用 `adb logcat`，Windows 用命令行重定向）


### 测试账号

已在生产服务器 `xutaostudy.xyz` 上创建公用测试账号，可直接用于 Android / Windows 客户端登录：

| 字段 | 值 |
|------|-----|
| 邮箱 | `planning-test@example.com` |
| 密码 | `Test@123456` |

> ⚠️ 注意：该账号为公开测试账号，任何人都可以看到密码。请勿在测试中录入真实个人信息。测试完成后如需保留个人数据，建议在应用内「设置」或调用 `PATCH /users/me/preferences` 后修改密码，或在注册页面自行创建新账号。

测试账号注册/登录 API 示例：

```bash
# 登录（获取 accessToken / refreshToken）
curl -s -X POST https://xutaostudy.xyz/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"planning-test@example.com","password":"Test@123456"}'

# 如账号失效，可自行注册新账号（密码不少于 8 位）
curl -s -X POST https://xutaostudy.xyz/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"YourPassword123"}'
```


## 测试阶段构建修复记录（Week 27 产物）

本次测试阶段修复了 Android Release APK 与 Windows Release 包的构建问题，并重新生成了发布产物。

### 修复内容

1. **Android 构建：`sqlite3` 包默认下载 GitHub 预编译库超时**
   - 在 `apps/mobile/pubspec.yaml` 中加入 `sqlite3_flutter_libs: ^0.5.0` 提供本地预编译库。
   - 添加 `hooks.user_defines.sqlite3.source: system`，避免 `sqlite3` 构建钩子从 GitHub 下载 `libsqlite3.arm64.android.so`。
2. **Android 插件 compileSdk 版本冲突**
   - 主项目 `android/app/build.gradle.kts` 将 `compileSdk` 显式设置为 `36`。
   - 在 `android/build.gradle.kts` 中通过 `allprojects.afterEvaluate` 统一把所有 Android 子项目（包括 `health` 等第三方插件）的 `compileSdk` 强制设置为 `36`，避免 `:health` 等插件仍编译在 `android-34` 导致 `checkReleaseAarMetadata` 失败。
3. **Windows 构建：CMake 4.x 移除对 `<3.5` 的兼容**
   - 在 `windows/CMakeLists.txt` 顶部加入 `set(CMAKE_POLICY_VERSION_MINIMUM 3.5)`，解决 `firebase_cpp_sdk_windows` 中 `cmake_minimum_required(VERSION 2.8)` 被 CMake 4.x 拒绝的问题。
4. **Windows 安装路径修正**
   - 将 `windows/CMakeLists.txt` 中 `BUILD_BUNDLE_DIR` 从生成器表达式改为实际路径 `${PROJECT_BINARY_DIR}/runner/Release`，并强制 `CMAKE_INSTALL_PREFIX` 指向该目录，避免 `INSTALL` 目标把文件写入 `C:/Program Files/planning_app_mobile/`。

### 构建产物

- Android APK：`planning-app/releases/planning-app-week27.apk`（约 61.4 MB）
   - 构建命令：`flutter build apk --release`
- Windows 桌面包：`planning-app/releases/windows/`（约 28 MB）
   - 构建命令：`flutter build windows --release`
   - 运行方式：复制整个 `releases/windows/` 目录到目标机器，双击 `planning_app_mobile.exe`。

### 已知警告（不影响当前功能）

- `health`、`device_info_plus` 等插件仍使用 Kotlin Gradle Plugin（KGP），Flutter 未来版本可能强制要求迁移到 Built-in Kotlin。当前构建为警告，不影响 APK/EXE 生成。
- Windows 构建出现 `MSVCRT.lib(ehvecdtr.obj) : warning LNK4078` 与 CMake 弃用警告，属于 Firebase C++ SDK 与新版 CMake 的兼容性提示，生成的 exe 可正常启动。


---

## 19. Android 真机日志排查记录（2026-08-15）

### 测试环境

| 项目 | 内容 |
|------|------|
| 应用包名 | `com.example.planning_app_mobile` |
| 测试包 | `planning-app/releases/planning-app-week27.apk` |
| 设备 | vivo 真机（MTK/联发科 SoC，Mali GPU，Android / ARM64） |
| 进程 PID | 4615 |
| 采集命令 | `logcat -d -v threadtime --pid=4615` |
| 采集时段 | 2026-08-15 17:42:25 ~ 17:48:43（约 6 分 18 秒） |
| 原始日志 | `planning_app_mobile_full.log`（1224 行） |
| 分析文档 | `planning_app_mobile_log_analysis.md` |

### 总体结论

- **稳定性达标**：连续 6 分钟运行期间 **`FATAL EXCEPTION` 出现 0 次**，无崩溃、无 ANR。
- **核心功能可运行**：Flutter 引擎（Impeller + Vulkan）、本地化（zh-CN）、输入法弹出/收起、页面切换均正常。
- **内存/GC 健康**：堆约 8.5 MB，原生内存峰值约 74 MB，GC 正常回收，无泄漏迹象。
- **存在 2 个功能缺口 + 2 个可优化项**，需要在 Week 28 修复。

### 发现的问题与影响

| 级别 | 问题 | 现象 | 影响 | 修复优先级 |
|------|------|------|------|------------|
| 🔴 功能缺口 | **Firebase/FCM 推送未配置** | `FirebaseApp failed to initialize because no default options were found` | Android 端无法接收远程推送；后端 `/users/me/fcm-token` 即使收到 token 也无法真正发推送 | Week 28 P0 |
| 🟡 功能缺失 | **HealthPlugin 注册失败** | `GeneratedPluginRegistrant: Error registering plugin health, java.lang.ClassCastException` | Health Connect / 运动数据同步不可用，用户只能手动 JSON 导入 | Week 28 P1 |
| 🟡 低 | **Invalid resource ID 0x00000001** | 用户操作期间偶发 4 次 | 未崩溃，但可能对应图标/图表/动画资源引用异常 | Week 28 P2 |
| 🟢 提示 | **未启用 OnBackInvokedCallback** | `OnBackInvokedCallback is not enabled for the application`（23 次） | Android 13+ 返回手势走旧式逻辑，功能正常但建议启用 | Week 28 P2 |
| 🟢 噪音 | **BLASTBufferQueue 缓冲满载** | 684 次 `acquireNextBufferLocked: Can't acquire next buffer` | 厂商渲染背压，可能导致偶发掉帧，非应用缺陷 | 观察，不修复 |
| 🟢 噪音 | **mali_gralloc Usage not permitted** | 16 次 Mali GPU 格式检查 | 厂商图形栈常规检查，可忽略 | 观察，不修复 |

### 详细分析

#### 1. Firebase/FCM 推送未配置

日志片段：
```log
W FirebaseApp: Default FirebaseApp failed to initialize because no default options were found.
  This usually means that com.google.gms:google-services was not applied to your gradle project.
I FirebaseInitProvider: FirebaseApp initialization unsuccessful
```

说明：
- 项目虽然引入了 `firebase_core`/`firebase_messaging` 并实现了 `FcmService`，但 **Android 工程未应用 `com.google.gms.google-services` 插件**，且缺少 `google-services.json`。
- 后端 `fcm.service.ts` 与 `POST /users/me/fcm-token` 已就绪，但客户端拿不到合法 FCM token，远程推送链路无法闭环。

修复方向：
1. 在 Firebase Console 创建 Android 应用，下载 `google-services.json`。
2. 放置到 `android/app/google-services.json`。
3. 在 `android/build.gradle`（项目级）应用 `com.google.gms:google-services` 插件。
4. 在 `android/app/build.gradle.kts` 底部添加 `apply(plugin = "com.google.gms.google-services")`。
5. 重新构建 APK 并验证 `FirebaseApp initialization successful`。

#### 2. HealthPlugin 注册失败（ClassCastException）

日志片段：
```log
E GeneratedPluginRegistrant: Error registering plugin health, cachet.plugins.health.HealthPlugin
E GeneratedPluginRegistrant: java.lang.ClassCastException
  at a4.c.d(...)
  at k2.l.onAttachedToActivity(...)
  ...
```

说明：
- `health` 插件在 `GeneratedPluginRegistrant.registerWith()` 阶段发生类型转换异常，通常与 **Flutter 嵌入版本、Activity 类型或插件版本不兼容** 有关。
- 该异常被插件注册框架捕获，因此不会崩溃，但依赖 `health` 的 **Health Connect 同步、步数/心率读取功能将不可用**。

修复方向：
1. 检查 `health` 插件版本与当前 Flutter/Android Gradle 插件版本的兼容性矩阵。
2. 尝试升级 `health` 到最新稳定版，或降级到与项目 `compileSdk=36` 兼容的版本。
3. 检查 `MainActivity` 是否继承 `FlutterFragmentActivity` 而非 `FlutterActivity`（部分 health/permission_handler 插件需要 FragmentActivity）。
4. 清理 Pub Cache 与 Gradle Cache 后重新构建，确认 `GeneratedPluginRegistrant` 不再抛异常。

#### 3. Invalid resource ID 0x00000001

日志片段：
```log
E ning_app_mobile: Invalid resource ID 0x00000001.
```

说明：
- 资源 ID `0x00000001` 为无效值，通常出现在代码尝试加载未声明的 drawable/mipmap/asset，或 `AnimationController`/`ImageProvider` 使用了未初始化的资源句柄。
- 出现次数少（4 次/6 分钟），未引发崩溃。

修复方向：
1. 在 Dart 侧检查是否有 `Image.asset('不存在路径')`、`Icon(Icons.??? 错误)` 或动态资源名拼写错误。
2. 检查 `pubspec.yaml` 中 `assets` 声明是否完整（尤其图表、占位图、图标）。
3. 检查第三方包（如图表库）是否依赖了缺失的默认资源。

#### 4. OnBackInvokedCallback 未启用

日志片段：
```log
W WindowOnBackDispatcher: OnBackInvokedCallback is not enabled for the application.
W WindowOnBackDispatcher: Set 'android:enableOnBackInvokedCallback="true"' in the application manifest.
```

修复方向：
- 在 `android/app/src/main/AndroidManifest.xml` 的 `<application>` 标签添加 `android:enableOnBackInvokedCallback="true"`。
- 这是 Android 13+ 推荐属性，启用后可预测性返回手势，不影响旧设备。

### 修复验证 Checklist

- [ ] 应用 `google-services` 插件并放置 `google-services.json` 后，日志中无 `FirebaseApp initialization unsuccessful`。
- [ ] FCM Token 可正常获取并上传到后端 `/users/me/fcm-token`。
- [ ] HealthPlugin 注册无 `ClassCastException`，`FitnessImportScreen` 的「从 Health Connect 同步」按钮可用。
- [ ] `Invalid resource ID 0x00000001` 不再出现。
- [ ] `OnBackInvokedCallback` 警告消失。
- [ ] 重新真机测试 10 分钟，确认无新增崩溃或异常。

### 关联文件

- 原始日志：`planning_app_mobile_full.log`
- 分析文档：`planning_app_mobile_log_analysis.md`
- 构建产物：`planning-app/releases/planning-app-week27.apk`
