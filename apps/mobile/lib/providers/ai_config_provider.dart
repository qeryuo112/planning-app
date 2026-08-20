import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_client.dart';
import 'auth_provider.dart';

final aiConfigProvider = StateNotifierProvider<AiConfigNotifier, AsyncValue<Map<String, dynamic>?>>
(
  (ref) => AiConfigNotifier(ref.read(apiClientProvider)),
);

class AiConfigNotifier extends StateNotifier<AsyncValue<Map<String, dynamic>?>> {
  final ApiClient _client;

  AiConfigNotifier(this._client) : super(const AsyncValue.data(null));

  Future<void> fetchConfig() async {
    state = const AsyncValue.loading();
    try {
      final res = await _client.get('/users/me/ai-config');
      state = AsyncValue.data(res);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<Map<String, dynamic>?> updateConfig({
    String? aiProvider,
    String? aiModel,
    String? aiBaseUrl,
    String? aiApiKey,
  }) async {
    state = const AsyncValue.loading();
    try {
      final res = await _client.patch('/users/me/ai-config', body: {
        if (aiProvider != null) 'aiProvider': aiProvider,
        if (aiModel != null) 'aiModel': aiModel,
        if (aiBaseUrl != null) 'aiBaseUrl': aiBaseUrl,
        if (aiApiKey != null) 'aiApiKey': aiApiKey,
      });
      state = AsyncValue.data(res);
      return res;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }
}
