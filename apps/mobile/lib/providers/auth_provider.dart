import 'package:flutter_riverpod/flutter_riverpod.dart';
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

final authStateProvider = StateNotifierProvider<AuthNotifier, AsyncValue<void>>(
  (ref) => AuthNotifier(ref.read(apiClientProvider), ref.read(syncEngineProvider)),
);

class AuthNotifier extends StateNotifier<AsyncValue<void>> {
  final ApiClient _client;
  final SyncEngine _sync;

  AuthNotifier(this._client, this._sync) : super(const AsyncValue.data(null));

  Future<void> login(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final res = await _client.post('/auth/login', body: {
        'email': email,
        'password': password,
      });
      await _client.setToken(res['accessToken'] as String);
      await _sync.initialize();
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
      state = const AsyncValue.data(null);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> logout() async {
    _sync.dispose();
    await _client.clearToken();
    state = const AsyncValue.data(null);
  }
}
