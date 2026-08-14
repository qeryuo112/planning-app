import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:uuid/uuid.dart';
import '../models/calendar_event_model.dart';
import '../services/api_client.dart';
import '../services/local_database.dart';
import '../services/sync_engine.dart';
import 'auth_provider.dart';

final _logger = Logger();

final calendarProvider = StateNotifierProvider<CalendarNotifier, AsyncValue<List<CalendarEventModel>>>((ref) {
  return CalendarNotifier(
    ref.read(apiClientProvider),
    ref.read(localDbProvider),
    ref.read(syncEngineProvider),
  );
});

class CalendarNotifier extends StateNotifier<AsyncValue<List<CalendarEventModel>>> {
  final ApiClient _client;
  final LocalDatabase _db;
  final SyncEngine _sync;
  StreamSubscription? _syncSub;
  DateTime? _lastStart;
  DateTime? _lastEnd;

  CalendarNotifier(this._client, this._db, this._sync) : super(const AsyncValue.loading()) {
    _listenSync();
  }

  void _listenSync() {
    _syncSub = _sync.syncEvents.listen((event) {
      final type = event['eventType'] as String?;
      if (type?.startsWith('calendar.') == true && _lastStart != null && _lastEnd != null) {
        fetchEvents(_lastStart!, _lastEnd!);
      }
    });
  }

  Future<void> fetchEvents(DateTime start, DateTime end) async {
    _lastStart = start;
    _lastEnd = end;

    // 本地优先：先展示缓存
    final localEvents = await _db.getCalendarEventsByRange(start, end);
    if (localEvents.isNotEmpty && state is! AsyncData) {
      state = AsyncValue.data(localEvents);
    }

    try {
      final startIso = start.toIso8601String();
      final endIso = end.toIso8601String();
      final res = await _client.get('/calendar?start=$startIso&end=$endIso') as List<dynamic>;
      final serverEvents = res.map((e) => CalendarEventModel.fromJson(e as Map<String, dynamic>)).toList();

      for (final event in serverEvents) {
        await _db.upsertCalendarEvent(event, dirty: false);
      }

      final merged = await _db.getCalendarEventsByRange(start, end);
      if (mounted) {
        state = AsyncValue.data(merged);
      }
    } catch (e) {
      if (mounted && state is! AsyncData) {
        state = AsyncValue.data(localEvents);
      }
      _logger.w('拉取日历事件失败，已使用本地缓存: $e');
    }
  }

  Future<CalendarEventModel?> createEvent({
    required String title,
    String? description,
    required DateTime startAt,
    DateTime? endAt,
    String? taskId,
  }) async {
    final previous = state.value ?? [];
    try {
      final id = const Uuid().v4();
      final now = DateTime.now();
      final event = CalendarEventModel(
        id: id,
        title: title,
        description: description,
        startAt: startAt,
        endAt: endAt,
        taskId: taskId,
        createdAt: now,
        updatedAt: now,
      );

      await _db.upsertCalendarEvent(event, dirty: true);
      await _sync.queueOperation(
        type: 'create_calendar',
        targetType: 'calendar',
        targetId: id,
        payload: {
          'title': title,
          'startAt': startAt.toIso8601String(),
          if (description != null) 'description': description,
          if (endAt != null) 'endAt': endAt.toIso8601String(),
          if (taskId != null) 'taskId': taskId,
        },
      );

      state = AsyncValue.data([...previous, event]);
      _sync.pushOperations();
      return event;
    } catch (e) {
      state = AsyncValue.data(previous);
      return null;
    }
  }

  Future<void> updateEvent(
    String id, {
    String? title,
    String? description,
    DateTime? startAt,
    DateTime? endAt,
    String? taskId,
  }) async {
    final previous = state.value ?? [];
    final existing = previous.firstWhere((e) => e.id == id);
    final updated = CalendarEventModel(
      id: id,
      title: title ?? existing.title,
      description: description ?? existing.description,
      startAt: startAt ?? existing.startAt,
      endAt: endAt ?? existing.endAt,
      taskId: taskId ?? existing.taskId,
      createdAt: existing.createdAt,
      updatedAt: DateTime.now(),
    );

    final optimisticState = previous.map((e) => e.id == id ? updated : e).toList();
    state = AsyncValue.data(optimisticState);

    try {
      await _db.upsertCalendarEvent(updated, dirty: true);
      final body = <String, dynamic>{
        if (title != null) 'title': title,
        if (description != null) 'description': description,
        if (startAt != null) 'startAt': startAt.toIso8601String(),
        if (endAt != null) 'endAt': endAt.toIso8601String(),
        if (taskId != null) 'taskId': taskId,
      };

      await _sync.queueOperation(
        type: 'update_calendar',
        targetType: 'calendar',
        targetId: id,
        payload: body,
      );
      _sync.pushOperations();
    } catch (e) {
      state = AsyncValue.data(previous);
      rethrow;
    }
  }

  Future<void> deleteEvent(String id) async {
    final previous = state.value ?? [];
    final optimisticState = previous.where((e) => e.id != id).toList();
    state = AsyncValue.data(optimisticState);

    try {
      await _db.deleteCalendarEvent(id);
      await _sync.queueOperation(
        type: 'delete_calendar',
        targetType: 'calendar',
        targetId: id,
        payload: {},
      );
      _sync.pushOperations();
    } catch (e) {
      state = AsyncValue.data(previous);
      rethrow;
    }
  }

  Future<int> importIcs(String icsText) async {
    try {
      final res = await _client.post('/calendar/import-ics', body: {'icsText': icsText}) as Map<String, dynamic>;
      final imported = (res['imported'] as num).toInt();
      await fetchEvents(
        DateTime.now().subtract(const Duration(days: 30)),
        DateTime.now().add(const Duration(days: 30)),
      );
      return imported;
    } catch (e) {
      _logger.w('导入 ICS 失败: $e');
      rethrow;
    }
  }

  Future<String> exportIcs() async {
    try {
      final res = await _client.get('/calendar/export-ics') as Map<String, dynamic>;
      return res['icsText'] as String;
    } catch (e) {
      _logger.w('导出 ICS 失败: $e');
      rethrow;
    }
  }

  Future<int> syncExternalCalendar(String url) async {
    try {
      final res = await _client.post('/calendar/sync-external', body: {'url': url}) as Map<String, dynamic>;
      final imported = (res['imported'] as num).toInt();
      await fetchEvents(
        DateTime.now().subtract(const Duration(days: 30)),
        DateTime.now().add(const Duration(days: 30)),
      );
      return imported;
    } catch (e) {
      _logger.w('同步外部日历失败: $e');
      rethrow;
    }
  }

  Future<void> connectGoogleCalendar() async {
    try {
      final res = await _client.get('/calendar/oauth/google') as Map<String, dynamic>;
      if (res['enabled'] == false) {
        throw Exception(res['message'] as String? ?? 'Google OAuth 未配置');
      }
      final url = res['url'] as String?;
      if (url == null || url.isEmpty) {
        throw Exception('Google 授权链接为空');
      }
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        throw Exception('无法打开浏览器: $url');
      }
    } catch (e) {
      _logger.w('打开 Google 授权失败: $e');
      rethrow;
    }
  }

  @override
  void dispose() {
    _syncSub?.cancel();
    super.dispose();
  }
}
