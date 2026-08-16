import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_client.dart';
import 'auth_provider.dart';

final reviewProvider = StateNotifierProvider<ReviewNotifier, AsyncValue<ReviewState>>(
  (ref) => ReviewNotifier(ref.read(apiClientProvider)),
);

class ReviewState {
  final Map<String, dynamic>? review;
  final List<Map<String, dynamic>> messages;

  const ReviewState({this.review, this.messages = const []});

  ReviewState copyWith({
    Map<String, dynamic>? review,
    List<Map<String, dynamic>>? messages,
  }) {
    return ReviewState(
      review: review ?? this.review,
      messages: messages ?? this.messages,
    );
  }
}

class ReviewNotifier extends StateNotifier<AsyncValue<ReviewState>> {
  final ApiClient _client;
  String? _lastSessionId;

  ReviewNotifier(this._client) : super(const AsyncValue.data(ReviewState()));

  Future<void> generateReview(
    String goalId, {
    String period = 'weekly',
    String? endDate,
    String? goalTitle,
  }) async {
    state = const AsyncValue<ReviewState>.loading().copyWithPrevious(state);
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
      final previous = state.value ?? const ReviewState();
      final userMessage = {
        'role': 'user',
        'content': goalTitle ?? '生成${period == 'daily' ? '日' : '周'}复盘',
        'createdAt': DateTime.now().toIso8601String(),
      };
      final assistantMessage = {
        'role': 'assistant',
        'content': res,
        'createdAt': DateTime.now().toIso8601String(),
      };
      state = AsyncValue.data(
        ReviewState(
          review: res,
          messages: [...previous.messages, userMessage, assistantMessage],
        ),
      );
    } catch (e, st) {
      state = AsyncValue<ReviewState>.error(e, st).copyWithPrevious(state);
    }
  }

  Future<void> followUpReview(String followUp) async {
    final current = state.value?.review;
    final previous = state.value ?? const ReviewState();
    if (current == null || _lastSessionId == null) return;

    final goalId = current['goalId'] as String? ?? current['review']?['goalId'] as String?;
    final period = current['period'] as String? ?? 'weekly';
    if (goalId == null) return;

    state = const AsyncValue<ReviewState>.loading().copyWithPrevious(state);
    try {
      final res = await _client.post('/ai/review', body: {
        'goalId': goalId,
        'period': period,
        'sessionId': _lastSessionId,
        'followUp': followUp,
      }) as Map<String, dynamic>;
      _lastSessionId = res['sessionId'] as String? ?? _lastSessionId;
      state = AsyncValue.data(
        ReviewState(
          review: res,
          messages: [
            ...previous.messages,
            {
              'role': 'user',
              'content': followUp,
              'createdAt': DateTime.now().toIso8601String(),
            },
            {
              'role': 'assistant',
              'content': res,
              'createdAt': DateTime.now().toIso8601String(),
            },
          ],
        ),
      );
    } catch (e, st) {
      state = AsyncValue<ReviewState>.error(e, st).copyWithPrevious(state);
    }
  }

  void clear() {
    _lastSessionId = null;
    state = const AsyncValue.data(ReviewState());
  }
}
