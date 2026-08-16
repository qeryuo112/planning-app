import 'dart:io';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:logger/logger.dart';
import 'api_client.dart';
import 'notification_service.dart';

/// 封装 Firebase Cloud Messaging (FCM) 的初始化、Token 获取与上传。
///
/// 个人使用版本：若未配置 Firebase（缺少 google-services.json / firebase_options.dart），
/// 初始化会捕获异常并降级为仅使用本地通知，避免应用崩溃。
class FcmService {
  static final FcmService _instance = FcmService._internal();
  factory FcmService() => _instance;
  FcmService._internal();

  final Logger _logger = Logger(filter: ProductionFilter());
  final ApiClient _apiClient = ApiClient();
  FirebaseMessaging? _messaging;
  bool _initialized = false;

  /// 是否已启用 Firebase。若原生未配置 Firebase，则保持 false。
  bool get isEnabled => _initialized;

  /// 初始化 Firebase 并上传 FCM Token。
  /// 在 [main.dart] WidgetsFlutterBinding.ensureInitialized() 之后调用。
  /// Windows/Linux 桌面端不支持 Firebase Messaging，直接跳过。
  Future<void> initialize() async {
    if (_initialized) {
      _logger.i('FCM 已初始化，跳过');
      return;
    }

    if (Platform.isWindows || Platform.isLinux || Platform.isMacOS) {
      _logger.i('桌面平台暂不初始化 FCM');
      return;
    }

    _logger.i('FCM 初始化开始');
    try {
      await Firebase.initializeApp();
      _messaging = FirebaseMessaging.instance;
      _logger.i('Firebase 初始化成功');
    } catch (e, st) {
      _logger.e('Firebase 初始化失败，远程推送将不可用：$e', error: e, stackTrace: st);
      return;
    }

    await _requestPermission();
    _listenTokenRefresh();
    _listenForegroundMessages();

    _initialized = true;
    _logger.i('FCM 服务已初始化，准备后台上传 token');

    // 获取并上传 FCM Token 可能依赖网络与 Firebase Installations，
    // 放在后台执行，避免阻塞应用启动导致白屏。
    Future.microtask(() => uploadToken());
  }

  /// 手动获取并上传当前 FCM Token。登录成功后应调用一次，确保后端保存最新 token。
  Future<void> uploadToken() async {
    final messaging = _messaging;
    if (messaging == null) {
      _logger.w('uploadToken: messaging 为空');
      return;
    }
    try {
      final token = await messaging.getToken();
      _logger.i('获取到 FCM Token: ${token != null && token.length > 20 ? "${token.substring(0, 20)}..." : token}');
      if (token == null || token.isEmpty) {
        _logger.w('未获取到 FCM Token');
        return;
      }
      final resp = await _apiClient.post('/users/me/fcm-token', body: {'token': token});
      _logger.i('FCM Token 上传成功: ${resp?.toString()}');
    } catch (e, st) {
      _logger.e('上传 FCM Token 失败: $e', error: e, stackTrace: st);
    }
  }

  Future<void> _requestPermission() async {
    if (Platform.isIOS) {
      final messaging = _messaging;
      if (messaging == null) return;
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      _logger.i('iOS 通知权限状态: ${settings.authorizationStatus}');
    } else {
      _logger.i('Android 不需要在初始化时请求通知权限（目标 SDK 33+ 在运行时请求）');
    }
  }

  void _listenTokenRefresh() {
    final messaging = _messaging;
    if (messaging == null) return;
    messaging.onTokenRefresh.listen((token) async {
      _logger.i('FCM Token 已刷新: ${token.length > 20 ? "${token.substring(0, 20)}..." : token}');
      try {
        await _apiClient.post('/users/me/fcm-token', body: {'token': token});
        _logger.i('刷新后的 FCM Token 已上传');
      } catch (e, st) {
        _logger.e('上传刷新后的 FCM Token 失败: $e', error: e, stackTrace: st);
      }
    });
  }

  void _listenForegroundMessages() {
    final messaging = _messaging;
    if (messaging == null) return;
    _logger.i('注册前台 FCM 消息监听');
    FirebaseMessaging.onMessage.listen((message) async {
      _logger.i('收到前台 FCM 消息: messageId=${message.messageId}, title=${message.notification?.title}, body=${message.notification?.body}, data=${message.data}');
      final notification = message.notification;
      if (notification == null) {
        _logger.w('前台 FCM 消息无 notification 字段，不弹通知');
        return;
      }
      final payload = message.data['reminderId'] ?? message.data['targetId'];
      try {
        await NotificationService().showInstant(
          notification.title ?? '计划提醒',
          notification.body ?? '你有新的提醒',
          payload: payload,
        );
        _logger.i('前台通知已弹出: title=${notification.title}, body=${notification.body}');
      } catch (e, st) {
        _logger.e('前台通知弹出失败: $e', error: e, stackTrace: st);
      }
    });
  }

  /// 手动获取当前 FCM Token，供调试或设置页使用。
  Future<String?> getToken() async {
    if (!_initialized) return null;
    final messaging = _messaging;
    if (messaging == null) return null;
    try {
      return await messaging.getToken();
    } catch (e, st) {
      _logger.e('获取 FCM Token 失败: $e', error: e, stackTrace: st);
      return null;
    }
  }

  /// 删除当前 Token 并通知后端清空。
  Future<void> deleteToken() async {
    if (!_initialized) return;
    final messaging = _messaging;
    if (messaging == null) return;
    try {
      await messaging.deleteToken();
      await _apiClient.delete('/users/me/fcm-token');
      _logger.i('FCM Token 已删除');
    } catch (e, st) {
      _logger.e('删除 FCM Token 失败: $e', error: e, stackTrace: st);
    }
  }
}

/// 后台/终止态消息处理入口（必须顶层函数）。
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  WidgetsFlutterBinding.ensureInitialized();
  final logger = Logger(filter: ProductionFilter());
  logger.i('后台 FCM 消息入口被调用: messageId=${message.messageId}, title=${message.notification?.title}, body=${message.notification?.body}, data=${message.data}');
  try {
    await NotificationService().initialize();
    logger.i('后台 NotificationService 已初始化');
    final notification = message.notification;
    if (notification == null) {
      logger.w('后台 FCM 消息无 notification 字段，仅展示本地通知兜底');
      await NotificationService().showInstant(
        '计划提醒',
        '你有新的提醒',
        payload: message.data['reminderId'] ?? message.data['targetId'],
      );
      logger.i('后台兜底通知已弹出');
      return;
    }
    final payload = message.data['reminderId'] ?? message.data['targetId'];
    await NotificationService().showInstant(
      notification.title ?? '计划提醒',
      notification.body ?? '你有新的提醒',
      payload: payload,
    );
    logger.i('后台通知已弹出: title=${notification.title}, body=${notification.body}');
  } catch (e, st) {
    logger.e('后台 FCM 处理失败: $e', error: e, stackTrace: st);
  }
}
