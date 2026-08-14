import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_client.dart';
import '../services/sse_client.dart';
import 'auth_provider.dart';

final aiDraftProvider = StateNotifierProvider<AiDraftNotifier, AsyncValue<Map<String, dynamic>?>>
(
  (ref) => AiDraftNotifier(ref.read(apiClientProvider)),
);

/// 流式生成事件
sealed class AiDraftStreamEvent {
  final String type;
  AiDraftStreamEvent(this.type);
}

class AiDraftProgressEvent extends AiDraftStreamEvent {
  final String stage;
  final String? message;
  AiDraftProgressEvent({required this.stage, this.message}) : super('progress');
}

class AiDraftResultEvent extends AiDraftStreamEvent {
  final Map<String, dynamic> draft;
  AiDraftResultEvent(this.draft) : super('draft');
}

class AiDraftDoneEvent extends AiDraftStreamEvent {
  AiDraftDoneEvent() : super('done');
}

class AiDraftErrorEvent extends AiDraftStreamEvent {
  final String error;
  AiDraftErrorEvent(this.error) : super('error');
}

class AiDraftNotifier extends StateNotifier<AsyncValue<Map<String, dynamic>?>> {
  final ApiClient _client;

  AiDraftNotifier(this._client) : super(const AsyncValue.data(null));

  Future<void> createDraft(
    String userInput, {
    String? goalId,
    String? templateId,
    int planDuration = 7,
    int stageLength = 7,
  }) async {
    state = const AsyncValue.loading();
    try {
      final res = await _client.post('/ai/plan-drafts', body: {
        'userInput': userInput,
        if (goalId != null) 'goalId': goalId,
        if (templateId != null) 'templateId': templateId,
        'planDuration': planDuration,
        'stageLength': stageLength,
      });
      state = AsyncValue.data(res as Map<String, dynamic>);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  /// 流式生成计划草案。
  /// 先创建 pending 草案记录，再通过 SSE 获取进度与最终结果。
  Stream<AiDraftStreamEvent> createDraftStream(
    String userInput, {
    String? goalId,
    String? templateId,
    int planDuration = 7,
    int stageLength = 7,
  }) async* {
    state = const AsyncValue.loading();

    final initRes = await _client.post('/ai/plan-drafts/stream', body: {
      'userInput': userInput,
      if (goalId != null) 'goalId': goalId,
      if (templateId != null) 'templateId': templateId,
      'planDuration': planDuration,
      'stageLength': stageLength,
    });

    final draftId = (initRes as Map<String, dynamic>)['draftId'] as String?;
    if (draftId == null) {
      state = AsyncValue.error('流式草案创建失败：未返回 draftId', StackTrace.current);
      yield AiDraftErrorEvent('流式草案创建失败：未返回 draftId');
      return;
    }

    final sseClient = SseClient(_client);
    await for (final event in sseClient.listen('/ai/plan-drafts/$draftId/stream')) {
      switch (event) {
        case SseProgressEvent():
          yield AiDraftProgressEvent(stage: event.stage, message: event.message);
        case SseDraftEvent():
          state = AsyncValue.data(event.draft);
          yield AiDraftResultEvent(event.draft);
        case SseDoneEvent():
          yield AiDraftDoneEvent();
          return;
        case SseErrorEvent():
          state = AsyncValue.error(event.error, StackTrace.current);
          yield AiDraftErrorEvent(event.error);
          return;
      }
    }
  }

  Future<List<dynamic>> fetchTemplates() async {
    try {
      final res = await _client.get('/ai/templates');
      return res as List<dynamic>;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return [];
    }
  }

  Future<Map<String, dynamic>?> fetchUsage() async {
    try {
      final res = await _client.get('/ai/usage');
      return res as Map<String, dynamic>;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<Map<String, dynamic>?> recommendTemplate(String input) async {
    try {
      final res = await _client.get(
        '/ai/templates/recommend?input=${Uri.encodeComponent(input)}',
      );
      return res as Map<String, dynamic>?;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<Map<String, dynamic>?> approveDraft(String draftId, {String? feedback}) async {
    try {
      final res = await _client.post('/ai/plan-drafts/$draftId/approve', body: {
        'confirmed': true,
        if (feedback != null) 'feedback': feedback,
      });
      state = AsyncValue.data({...(state.value ?? {}), 'approved': res});
      return res as Map<String, dynamic>;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<Map<String, dynamic>?> advanceStage(String draftId) async {
    try {
      final res = await _client.post('/ai/plan-drafts/$draftId/advance');
      state = AsyncValue.data(res as Map<String, dynamic>);
      return res;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  void clear() {
    state = const AsyncValue.data(null);
  }
}
