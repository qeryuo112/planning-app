import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:logger/logger.dart';
import 'api_client.dart';

/// 封装 Firebase Cloud Messaging (FCM) 的初始化、Token 获取与上传。
///
/// 个人使用版本：若未配置 Firebase（缺少 google-services.json / firebase_options.dart），
/// 初始化会捕获异常并降级为仅使用本地通知，避免应用崩溃。
class FcmService {
  static final FcmService _instance = FcmService._internal();
  factory FcmService() => _instance;
  FcmService._internal();

  final Logger _logger = Logger();
  final ApiClient _apiClient = ApiClient();
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  bool _initialized = false;

  /// 是否已启用 Firebase。若原生未配置 Firebase，则保持 false。
  bool get isEnabled => _initialized;

  /// 初始化 Firebase 并上传 FCM Token。
  /// 在 [main.dart] WidgetsFlutterBinding.ensureInitialized() 之后调用。
  Future<void> initialize() async {
    if (_initialized) return;

    try {
      await Firebase.initializeApp();
      _logger.d('Firebase 初始化成功');
    } catch (e) {
      _logger.w('Firebase 初始化失败，远程推送将不可用：$e');
      return;
    }

    await _requestPermission();
    await _uploadToken();
    _listenTokenRefresh();
    _listenForegroundMessages();

    _initialized = true;
    _logger.d('FCM 服务已初始化');
  }

  Future<void> _requestPermission() async {
    if (Platform.isIOS) {
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      _logger.d('iOS 通知权限状态: ${settings.authorizationStatus}');
    }
  }

  Future<void> _uploadToken() async {
    try {
      final token = await _messaging.getToken();
      if (token == null || token.isEmpty) {
        _logger.w('未获取到 FCM Token');
        return;
      }
      _logger.d('获取到 FCM Token，准备上传');
      await _apiClient.post('/users/me/fcm-token', body: {'token': token});
      _logger.d('FCM Token 已上传');
    } catch (e) {
      _logger.w('上传 FCM Token 失败: $e');
    }
  }

  void _listenTokenRefresh() {
    _messaging.onTokenRefresh.listen((token) async {
      _logger.d('FCM Token 已刷新');
      try {
        await _apiClient.post('/users/me/fcm-token', body: {'token': token});
        _logger.d('刷新后的 FCM Token 已上传');
      } catch (e) {
        _logger.w('上传刷新后的 FCM Token 失败: $e');
      }
    });
  }

  void _listenForegroundMessages() {
    FirebaseMessaging.onMessage.listen((message) {
      _logger.d('收到前台 FCM 消息: ${message.notification?.title}');
      // 个人版：先仅记录日志，后续可接入本地通知展示远程推送内容。
    });
  }

  /// 手动获取当前 FCM Token，供调试或设置页使用。
  Future<String?> getToken() async {
    if (!_initialized) return null;
    try {
      return await _messaging.getToken();
    } catch (e) {
      _logger.w('获取 FCM Token 失败: $e');
      return null;
    }
  }

  /// 删除当前 Token 并通知后端清空。
  Future<void> deleteToken() async {
    if (!_initialized) return;
    try {
      await _messaging.deleteToken();
      await _apiClient.delete('/users/me/fcm-token');
      _logger.d('FCM Token 已删除');
    } catch (e) {
      _logger.w('删除 FCM Token 失败: $e');
    }
  }
}

/// 后台/终止态消息处理入口（必须顶层函数）。
/// 当前个人版仅记录日志，后续可扩展为本地通知触发。
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  final logger = Logger();
  logger.d('收到后台 FCM 消息: ${message.notification?.title}');
}
