import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../models/calendar_subscription_model.dart';
import '../services/api_client.dart';
import 'auth_provider.dart';
import 'calendar_provider.dart';

final calendarSubscriptionsProvider = StateNotifierProvider<CalendarSubscriptionsNotifier, AsyncValue<List<CalendarSubscriptionModel>>>((ref) {
  return CalendarSubscriptionsNotifier(
    ref.read(apiClientProvider),
    ref.read(calendarProvider.notifier),
  );
});

class CalendarSubscriptionsNotifier extends StateNotifier<AsyncValue<List<CalendarSubscriptionModel>>> {
  final ApiClient _client;
  final CalendarNotifier _calendarNotifier;
  Timer? _autoRefreshTimer;

  CalendarSubscriptionsNotifier(this._client, this._calendarNotifier) : super(const AsyncValue.loading()) {
    refresh();
  }

  Future<void> refresh() async {
    if (state is! AsyncData) {
      state = const AsyncValue.loading();
    }
    try {
      final res = await _client.get('/calendar/subscriptions') as List<dynamic>;
      final items = res.map((e) => CalendarSubscriptionModel.fromJson(e as Map<String, dynamic>)).toList();
      state = AsyncValue.data(items);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  void startAutoRefresh({Duration interval = const Duration(seconds: 30)}) {
    _autoRefreshTimer?.cancel();
    _autoRefreshTimer = Timer.periodic(interval, (_) async {
      await refresh();
    });
  }

  void stopAutoRefresh() {
    _autoRefreshTimer?.cancel();
    _autoRefreshTimer = null;
  }

  Future<Map<String, dynamic>> addSubscription(String name, String url) async {
    try {
      final res = await _client.post('/calendar/subscriptions', body: {'name': name, 'url': url}) as Map<String, dynamic>;
      await refresh();
      await _calendarNotifier.fetchEvents(
        DateTime.now().subtract(const Duration(days: 30)),
        DateTime.now().add(const Duration(days: 30)),
      );
      return res;
    } catch (e) {
      _logger.w('添加日历订阅失败: $e');
      rethrow;
    }
  }

  Future<void> deleteSubscription(String id) async {
    try {
      await _client.delete('/calendar/subscriptions/$id');
      await refresh();
    } catch (e) {
      _logger.w('删除日历订阅失败: $e');
      rethrow;
    }
  }

  Future<int> syncSubscription(String id) async {
    try {
      final res = await _client.post('/calendar/subscriptions/$id/sync') as Map<String, dynamic>;
      final imported = (res['imported'] as num?)?.toInt() ?? 0;
      await refresh();
      await _calendarNotifier.fetchEvents(
        DateTime.now().subtract(const Duration(days: 30)),
        DateTime.now().add(const Duration(days: 30)),
      );
      return imported;
    } catch (e) {
      _logger.w('同步日历订阅失败: $e');
      rethrow;
    }
  }

  Future<void> connectGoogleCalendar() async {
    await _calendarNotifier.connectGoogleCalendar();
  }

  @override
  void dispose() {
    _autoRefreshTimer?.cancel();
    super.dispose();
  }
}

final _logger = Logger();
