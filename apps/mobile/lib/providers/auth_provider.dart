import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../services/analytics_service.dart';
import '../services/api_client.dart';
import '../services/fcm_service.dart';
import '../services/local_database.dart';
import '../services/sync_engine.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

final localDbProvider = Provider<LocalDatabase>((ref) => LocalDatabase());

final syncEngineProvider = Provider<SyncEngine>((ref) {
  final api = ref.read(apiClientProvider);
  final db = ref.read(localDbProvider);
  return SyncEngine(api, db);
});

final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  final api = ref.read(apiClientProvider);
  final service = AnalyticsService();
  service.initialize(api);
  return service;
});

final authStateProvider = StateNotifierProvider<AuthNotifier, AsyncValue<void>>(
  (ref) => AuthNotifier(
    ref.read(apiClientProvider),
    ref.read(syncEngineProvider),
    ref.read(analyticsServiceProvider),
  ),
);

class AuthNotifier extends StateNotifier<AsyncValue<void>> {
  final ApiClient _client;
  final SyncEngine _sync;
  final AnalyticsService _analytics;
  final Logger _logger = Logger();

  AuthNotifier(this._client, this._sync, this._analytics) : super(const AsyncValue.data(null));

  Future<void> login(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final res = await _client.post('/auth/login', body: {
        'email': email,
        'password': password,
      });
      await _client.setToken(res['accessToken'] as String);
      // 同步与 FCM Token 上传在后台执行，不阻塞登录进入主界面
      Future.microtask(() async {
        await _sync
            .initialize()
            .timeout(const Duration(seconds: 15))
            .catchError((e) => _logger.w('登录后同步初始化失败: $e'));
        await FcmService()
            .uploadToken()
            .timeout(const Duration(seconds: 10))
            .catchError((e) => _logger.w('登录后 FCM Token 上传失败: $e'));
      });
      _analytics.trackEvent('user.logged_in', metadata: {'email': email});
      state = const AsyncValue.data(null);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> register(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final res = await _client.post('/auth/register', body: {
        'email': email,
        'password': password,
      });
      await _client.setToken(res['accessToken'] as String);
      // 同步与 FCM Token 上传在后台执行，不阻塞注册进入主界面
      Future.microtask(() async {
        await _sync
            .initialize()
            .timeout(const Duration(seconds: 15))
            .catchError((e) => _logger.w('注册后同步初始化失败: $e'));
        await FcmService()
            .uploadToken()
            .timeout(const Duration(seconds: 10))
            .catchError((e) => _logger.w('注册后 FCM Token 上传失败: $e'));
      });
      _analytics.trackEvent('user.registered', metadata: {'email': email});
      state = const AsyncValue.data(null);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> logout() async {
    _sync.dispose();
    _analytics.dispose();
    await _client.clearToken();
    state = const AsyncValue.data(null);
  }
}
