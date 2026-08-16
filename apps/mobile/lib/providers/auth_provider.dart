import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/analytics_service.dart';
import '../services/api_client.dart';
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

  AuthNotifier(this._client, this._sync, this._analytics) : super(const AsyncValue.data(null));

  Future<void> login(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final res = await _client.post('/auth/login', body: {
        'email': email,
        'password': password,
      });
      await _client.setToken(res['accessToken'] as String);
      await _sync.initialize();
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
      await _sync.initialize();
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
