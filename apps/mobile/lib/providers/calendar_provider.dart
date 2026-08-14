import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:uuid/uuid.dart';
import '../models/calendar_event_model.dart';
import '../services/api_client.dart';
import '../services/local_database.dart';
import '../services/sync_engine.dart';
import 'auth_provider.dart';

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
    state = const AsyncValue.loading();
    try {
      // 1. 先读本地缓存
      final localEvents = await _db.getCalendarEventsByRange(start, end);
      if (localEvents.isNotEmpty) {
        state = AsyncValue.data(localEvents);
      }

      // 2. 再拉服务端并合并
      final startIso = start.toIso8601String();
      final endIso = end.toIso8601String();
      final res = await _client.get('/calendar?start=$startIso&end=$endIso') as List<dynamic>;
      final serverEvents = res.map((e) => CalendarEventModel.fromJson(e as Map<String, dynamic>)).toList();

      for (final event in serverEvents) {
        await _db.upsertCalendarEvent(event, dirty: false);
      }

      final merged = await _db.getCalendarEventsByRange(start, end);
      state = AsyncValue.data(merged);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<CalendarEventModel?> createEvent({
    required String title,
    String? description,
    required DateTime startAt,
    DateTime? endAt,
    String? taskId,
  }) async {
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

      final current = state.value ?? [];
      state = AsyncValue.data([...current, event]);

      await _sync.pushOperations();
      return event;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
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
    try {
      final current = state.value ?? [];
      final existing = current.firstWhere((e) => e.id == id);
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

      state = AsyncValue.data(
        current.map((e) => e.id == id ? updated : e).toList(),
      );

      await _sync.pushOperations();
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> deleteEvent(String id) async {
    try {
      await _db.deleteCalendarEvent(id);
      await _sync.queueOperation(
        type: 'delete_calendar',
        targetType: 'calendar',
        targetId: id,
        payload: {},
      );

      final current = state.value ?? [];
      state = AsyncValue.data(
        current.where((e) => e.id != id).toList(),
      );

      await _sync.pushOperations();
    } catch (e, st) {
      state = AsyncValue.error(e, st);
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
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      throw Exception('导入 ICS 失败: $e');
    }
  }

  Future<String> exportIcs() async {
    try {
      final res = await _client.get('/calendar/export-ics') as Map<String, dynamic>;
      return res['icsText'] as String;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      throw Exception('导出 ICS 失败: $e');
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
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      throw Exception('订阅外部日历失败: $e');
    }
  }

  Future<List<Map<String, dynamic>>> fetchSubscriptions() async {
    try {
      final res = await _client.get('/calendar/subscriptions') as List<dynamic>;
      return res.cast<Map<String, dynamic>>();
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      throw Exception('获取订阅列表失败: $e');
    }
  }

  Future<Map<String, dynamic>> addSubscription(String name, String url) async {
    try {
      final res = await _client.post('/calendar/subscriptions', body: {'name': name, 'url': url}) as Map<String, dynamic>;
      await fetchEvents(
        DateTime.now().subtract(const Duration(days: 30)),
        DateTime.now().add(const Duration(days: 30)),
      );
      return res;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      throw Exception('添加订阅失败: $e');
    }
  }

  Future<void> deleteSubscription(String id) async {
    try {
      await _client.delete('/calendar/subscriptions/$id');
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      throw Exception('删除订阅失败: $e');
    }
  }

  Future<int> syncSubscription(String id) async {
    try {
      final res = await _client.post('/calendar/subscriptions/$id/sync') as Map<String, dynamic>;
      final imported = (res['imported'] as num?)?.toInt() ?? 0;
      await fetchEvents(
        DateTime.now().subtract(const Duration(days: 30)),
        DateTime.now().add(const Duration(days: 30)),
      );
      return imported;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      throw Exception('同步订阅失败: $e');
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
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      throw Exception('打开 Google 授权失败: $e');
    }
  }

  @override
  void dispose() {
    _syncSub?.cancel();
    super.dispose();
  }
}
