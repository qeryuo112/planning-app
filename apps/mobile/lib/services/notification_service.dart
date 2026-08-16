import 'dart:math';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:android_intent_plus/android_intent.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:logger/logger.dart';
import '../models/reminder_model.dart';

/// 本地通知服务封装
/// 负责初始化、请求权限、调度/取消提醒通知，以及处理通知点击跳转。
class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  final Logger _logger = Logger();
  bool _initialized = false;

  /// 外部可设置通知点击后的跳转回调，payload 为 reminder.id。
  static void Function(String? payload)? onNotificationTap;

  Future<void> initialize() async {
    if (_initialized) return;

    if (Platform.isWindows || Platform.isLinux) {
      _logger.i('桌面平台暂不初始化本地通知插件');
      _initialized = true;
      return;
    }

    tz_data.initializeTimeZones();

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _plugin.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (details) {
        _logger.d('通知点击: ${details.payload}');
        onNotificationTap?.call(details.payload);
      },
    );

    // Android 8+ 需要显式创建通知渠道，否则 FCM/本地通知可能静默不显示。
    if (Platform.isAndroid) {
      final androidPlugin = _plugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      if (androidPlugin != null) {
        const channel = AndroidNotificationChannel(
          'reminder_channel',
          '计划提醒',
          description: '目标、任务与习惯提醒',
          importance: Importance.high,
          playSound: true,
          enableVibration: true,
        );
        await androidPlugin.createNotificationChannel(channel);
        _logger.d('Android 通知渠道 reminder_channel 已创建');
      }
    }

    _initialized = true;
    _logger.d('本地通知服务已初始化');
  }

  /// 获取因点击通知而冷启动应用时的 payload。
  /// 非通知启动返回 null。
  Future<String?> getLaunchNotificationPayload() async {
    if (Platform.isWindows || Platform.isLinux) return null;
    if (!_initialized) await initialize();
    final launchDetails = await _plugin.getNotificationAppLaunchDetails();
    return launchDetails?.notificationResponse?.payload;
  }

  Future<bool> requestPermissions() async {
    if (Platform.isAndroid) {
      final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      if (android == null) return false;
      return await android.requestNotificationsPermission() ?? false;
    }
    if (Platform.isIOS) {
      final result = await _plugin
          .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()
          ?.requestPermissions(alert: true, badge: true, sound: true);
      return result ?? false;
    }
    return false;
  }

  /// 检查 Android 精确闹钟权限（Android 12+）。
  Future<bool> canScheduleExactNotifications() async {
    final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    if (android == null) return false;
    return await android.canScheduleExactNotifications() ?? false;
  }

  /// 打开 Android 系统设置请求精确闹钟权限。
  /// 返回是否成功打开设置页（不保证用户授予权限）。
  Future<bool> requestExactAlarmPermission() async {
    if (!Platform.isAndroid) return false;
    try {
      const intent = AndroidIntent(
        action: 'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
      );
      await intent.launch();
      return true;
    } catch (e) {
      _logger.w('请求精确闹钟权限失败: $e');
      return false;
    }
  }

  int _notificationId(String reminderId) {
    // UUID 字符串转 32 位整数，保证同一 reminder ID 对应同一通知 ID
    int hash = 0;
    for (final codeUnit in reminderId.codeUnits) {
      hash = ((hash << 5) - hash + codeUnit) & 0x7FFFFFFF;
    }
    return hash == 0 ? 1 : hash;
  }

  Future<void> scheduleReminder(ReminderModel reminder) async {
    if (Platform.isWindows || Platform.isLinux) return;
    if (!_initialized) await initialize();

    final id = _notificationId(reminder.id);
    const title = '计划提醒';
    final body = reminder.targetTitle ?? reminder.targetTypeLabel;

    final androidDetails = AndroidNotificationDetails(
      'reminder_channel',
      '计划提醒',
      channelDescription: '目标、任务与习惯提醒',
      importance: Importance.high,
      priority: Priority.high,
      ticker: body,
    );
    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );
    final details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    try {
      await _plugin.zonedSchedule(
        id,
        title,
        body,
        tz.TZDateTime.from(reminder.triggerAt, tz.local),
        details,
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
        payload: reminder.id,
      );
    } on PlatformException catch (e) {
      // Android 12+ 未授权精确闹钟时常见错误码
      final message = e.message ?? '';
      if (message.contains('exact') || message.contains('SCHEDULE_EXACT_ALARM') || (e.code == 'exact_alarms_not_permitted')) {
        _logger.w('精确闹钟权限不足，无法调度提醒: ${reminder.id}');
        throw Exception('需要 Android 精确闹钟权限。请到「设置」开启后再试。');
      }
      rethrow;
    }

    _logger.d('已调度通知: ${reminder.id} at ${reminder.triggerAt}');
  }

  Future<void> cancelReminder(String reminderId) async {
    if (Platform.isWindows || Platform.isLinux) return;
    if (!_initialized) await initialize();
    await _plugin.cancel(_notificationId(reminderId));
    _logger.d('已取消通知: $reminderId');
  }

  Future<void> cancelAll() async {
    if (Platform.isWindows || Platform.isLinux) return;
    if (!_initialized) await initialize();
    await _plugin.cancelAll();
    _logger.d('已取消全部通知');
  }

  Future<void> showInstant(String title, String body, {String? payload}) async {
    if (Platform.isWindows || Platform.isLinux) return;
    if (!_initialized) await initialize();

    const androidDetails = AndroidNotificationDetails(
      'reminder_channel',
      '计划提醒',
      channelDescription: '目标、任务与习惯提醒',
      importance: Importance.high,
      priority: Priority.high,
    );
    const iosDetails = DarwinNotificationDetails();
    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _plugin.show(
      Random().nextInt(1 << 30),
      title,
      body,
      details,
      payload: payload,
    );
  }
}
