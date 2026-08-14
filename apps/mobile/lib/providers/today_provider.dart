import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_client.dart';
import 'auth_provider.dart';

final todayProvider = StateNotifierProvider<TodayNotifier, AsyncValue<Map<String, dynamic>?>>((ref) {
  return TodayNotifier(ref.read(apiClientProvider));
});

class TodayNotifier extends StateNotifier<AsyncValue<Map<String, dynamic>?>> {
  final ApiClient _client;

  TodayNotifier(this._client) : super(const AsyncValue.data(null));

  Future<void> fetchToday({String? date}) async {
    state = const AsyncValue.loading();
    try {
      final path = date != null ? '/today?date=$date' : '/today';
      final res = await _client.get(path) as Map<String, dynamic>;
      state = AsyncValue.data(res);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}
