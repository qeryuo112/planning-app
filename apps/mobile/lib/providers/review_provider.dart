import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_client.dart';
import 'auth_provider.dart';

final reviewProvider = StateNotifierProvider<ReviewNotifier, AsyncValue<Map<String, dynamic>?>>((ref) {
  return ReviewNotifier(ref.read(apiClientProvider));
});

class ReviewNotifier extends StateNotifier<AsyncValue<Map<String, dynamic>?>> {
  final ApiClient _client;

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
      final res = await _client.post('/ai/review', body: body);
      state = AsyncValue.data(res as Map<String, dynamic>);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  void clear() {
    state = const AsyncValue.data(null);
  }
}
