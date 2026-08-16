import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_client.dart';
import 'auth_provider.dart';

final reviewProvider = StateNotifierProvider<ReviewNotifier, AsyncValue<Map<String, dynamic>?>>((ref) {
  return ReviewNotifier(ref.read(apiClientProvider));
});

class ReviewNotifier extends StateNotifier<AsyncValue<Map<String, dynamic>?>> {
  final ApiClient _client;
  String? _lastSessionId;

  ReviewNotifier(this._client) : super(const AsyncValue.data(null));

  Future<void> generateReview(
    String goalId, {
    String period = 'weekly',
    String? endDate,
  }) async {
    state = const AsyncValue.loading();
    try {
      final body = <String, dynamic>{
        'goalId': goalId,
        'period': period,
      };
      if (endDate != null) {
        body['endDate'] = endDate;
      }
      final res = await _client.post('/ai/review', body: body) as Map<String, dynamic>;
      _lastSessionId = res['sessionId'] as String?;
      state = AsyncValue.data(res);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> followUpReview(String followUp) async {
    final current = state.value;
    if (current == null || _lastSessionId == null) return;

    final goalId = current['goalId'] as String? ?? current['review']?['goalId'] as String?;
    final period = current['period'] as String? ?? 'weekly';
    if (goalId == null) return;

    state = const AsyncValue.loading();
    try {
      final res = await _client.post('/ai/review', body: {
        'goalId': goalId,
        'period': period,
        'sessionId': _lastSessionId,
        'followUp': followUp,
      }) as Map<String, dynamic>;
      _lastSessionId = res['sessionId'] as String? ?? _lastSessionId;
      state = AsyncValue.data(res);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  void clear() {
    _lastSessionId = null;
    state = const AsyncValue.data(null);
  }
}
