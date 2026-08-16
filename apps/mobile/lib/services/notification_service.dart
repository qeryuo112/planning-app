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
  final Logger _logger = Logger(filter: ProductionFilter());
  bool _initialized = false;

  /// 外部可设置通知点击后的跳转回调，payload 为 reminder.id。
  static void Function(String? payload)? onNotificationTap;

  Future<void> initialize() async {
    if (_initialized) {
      _logger.i('NotificationService 已初始化，跳过');
      return;
    }

    if (Platform.isWindows || Platform.isLinux) {
      _logger.i('桌面平台暂不初始化本地通知插件');
      _initialized = true;
      return;
    }

    _logger.i('NotificationService 初始化开始');
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
        _logger.i('通知点击: payload=${details.payload}');
        onNotificationTap?.call(details.payload);
      },
    );
    _logger.i('FlutterLocalNotificationsPlugin 初始化完成');

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
        _logger.i('Android 通知渠道 reminder_channel 已创建');
      } else {
        _logger.w('Android 通知插件未找到，无法创建渠道');
      }
    }

    _initialized = true;
    _logger.i('NotificationService 初始化完成');
  }

  /// 获取因点击通知而冷启动应用时的 payload。
  /// 非通知启动返回 null。
  Future<String?> getLaunchNotificationPayload() async {
    if (Platform.isWindows || Platform.isLinux) return null;
    if (!_initialized) await initialize();
    final launchDetails = await _plugin.getNotificationAppLaunchDetails();
    final payload = launchDetails?.notificationResponse?.payload;
    _logger.i('冷启动通知 payload: $payload');
    return payload;
  }

  Future<bool> requestPermissions() async {
    if (Platform.isAndroid) {
      final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      if (android == null) {
        _logger.w('Android 通知插件未找到，无法请求权限');
        return false;
      }
      final granted = await android.requestNotificationsPermission() ?? false;
      _logger.i('Android 通知权限请求结果: $granted');
      return granted;
    }
    if (Platform.isIOS) {
      final result = await _plugin
          .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()
          ?.requestPermissions(alert: true, badge: true, sound: true);
      _logger.i('iOS 通知权限请求结果: $result');
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

    _logger.i('准备调度本地通知: id=$id, reminderId=${reminder.id}, body=$body, triggerAt=${reminder.triggerAt}');
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
      _logger.i('已调度通知: ${reminder.id} at ${reminder.triggerAt}');
    } on PlatformException catch (e) {
      // Android 12+ 未授权精确闹钟时常见错误码
      final message = e.message ?? '';
      if (message.contains('exact') || message.contains('SCHEDULE_EXACT_ALARM') || (e.code == 'exact_alarms_not_permitted')) {
        _logger.w('精确闹钟权限不足，无法调度提醒: ${reminder.id}');
        throw Exception('需要 Android 精确闹钟权限。请到「设置」开启后再试。');
      }
      rethrow;
    }
  }

  Future<void> cancelReminder(String reminderId) async {
    if (Platform.isWindows || Platform.isLinux) return;
    if (!_initialized) await initialize();
    await _plugin.cancel(_notificationId(reminderId));
    _logger.i('已取消通知: $reminderId');
  }

  Future<void> cancelAll() async {
    if (Platform.isWindows || Platform.isLinux) return;
    if (!_initialized) await initialize();
    await _plugin.cancelAll();
    _logger.i('已取消全部通知');
  }

  Future<void> showInstant(String title, String body, {String? payload}) async {
    if (Platform.isWindows || Platform.isLinux) return;
    if (!_initialized) await initialize();

    _logger.i('准备弹出即时通知: title=$title, body=$body, payload=$payload');
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

    try {
      await _plugin.show(
        Random().nextInt(1 << 30),
        title,
        body,
        details,
        payload: payload,
      );
      _logger.i('即时通知已弹出: title=$title, body=$body');
    } catch (e, st) {
      _logger.e('即时通知弹出失败: $e', error: e, stackTrace: st);
      rethrow;
    }
  }
}
