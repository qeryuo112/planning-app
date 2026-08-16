import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../models/calendar_subscription_model.dart';
import '../services/api_client.dart';
import 'auth_provider.dart';
import 'calendar_provider.dart';

final _logger = Logger();

/// 日历订阅聚合状态：订阅列表 + 每个订阅的同步状态 + 全局提示。
class CalendarSubscriptionsState {
  final List<CalendarSubscriptionModel> subscriptions;
  final Map<String, bool> syncing;
  final Map<String, String?> syncMessages;
  final String? globalError;
  final String? lastSyncNotification;

  const CalendarSubscriptionsState({
    this.subscriptions = const [],
    this.syncing = const {},
    this.syncMessages = const {},
    this.globalError,
    this.lastSyncNotification,
  });

  CalendarSubscriptionsState copyWith({
    List<CalendarSubscriptionModel>? subscriptions,
    Map<String, bool>? syncing,
    Map<String, String?>? syncMessages,
    String? globalError,
    String? lastSyncNotification,
  }) {
    return CalendarSubscriptionsState(
      subscriptions: subscriptions ?? this.subscriptions,
      syncing: syncing ?? this.syncing,
      syncMessages: syncMessages ?? this.syncMessages,
      globalError: globalError ?? this.globalError,
      lastSyncNotification: lastSyncNotification ?? this.lastSyncNotification,
    );
  }

  bool get hasAnySyncing => syncing.values.any((v) => v);
  bool isSyncing(String id) => syncing[id] ?? false;
  String? syncMessage(String id) => syncMessages[id];

  /// 最近一条成功同步的订阅及其导入数量，用于主页面状态提示。
  ({CalendarSubscriptionModel subscription, int imported, DateTime syncAt})? latestSuccessSync() {
    CalendarSubscriptionModel? latest;
    DateTime? latestAt;
    int latestImported = 0;
    for (final sub in subscriptions) {
      final result = sub.lastSyncResult;
      if (result == null) continue;
      final imported = (result['imported'] as num?)?.toInt() ?? 0;
      final error = result['error'] as String?;
      if (error != null || imported < 0) continue;
      final syncAt = sub.lastSyncAt == null ? null : DateTime.tryParse(sub.lastSyncAt!);
      if (syncAt == null) continue;
      if (latestAt == null || syncAt.isAfter(latestAt)) {
        latest = sub;
        latestAt = syncAt;
        latestImported = imported;
      }
    }
    if (latest == null || latestAt == null) return null;
    return (subscription: latest, imported: latestImported, syncAt: latestAt);
  }
}

final calendarSubscriptionsProvider = StateNotifierProvider<CalendarSubscriptionsNotifier, CalendarSubscriptionsState>((ref) {
  return CalendarSubscriptionsNotifier(
    ref.read(apiClientProvider),
    ref.read(calendarProvider.notifier),
  );
});

class CalendarSubscriptionsNotifier extends StateNotifier<CalendarSubscriptionsState> {
  final ApiClient _client;
  final CalendarNotifier _calendarNotifier;
  Timer? _autoRefreshTimer;

  CalendarSubscriptionsNotifier(this._client, this._calendarNotifier) : super(const CalendarSubscriptionsState()) {
    refresh();
  }

  Future<void> refresh() async {
    if (state.subscriptions.isEmpty) {
      state = state.copyWith(globalError: null);
    }
    try {
      final res = await _client.get('/calendar/subscriptions') as List<dynamic>;
      final items = res.map((e) => CalendarSubscriptionModel.fromJson(e as Map<String, dynamic>)).toList();
      state = state.copyWith(subscriptions: items, globalError: null);
    } catch (e, st) {
      state = state.copyWith(globalError: '加载订阅失败: $e');
      _logger.w('加载日历订阅失败: $e', stackTrace: st);
    }
  }

  void startAutoRefresh({Duration interval = const Duration(seconds: 30)}) {
    _autoRefreshTimer?.cancel();
    _autoRefreshTimer = Timer.periodic(interval, (_) async {
      await refresh();
      final notification = _notifyIfSynced();
      if (notification != null) {
        state = state.copyWith(lastSyncNotification: notification);
      }
    });
  }

  void clearNotification() {
    state = state.copyWith(lastSyncNotification: null);
  }

  void stopAutoRefresh() {
    _autoRefreshTimer?.cancel();
    _autoRefreshTimer = null;
  }

  /// 自动刷新后，若发现刚有订阅同步完成，返回该订阅的提示信息。
  String? _notifyIfSynced() {
    final latest = state.latestSuccessSync();
    if (latest == null) return null;
    final diff = DateTime.now().difference(latest.syncAt);
    if (diff <= const Duration(minutes: 2)) {
      final msg = '「${latest.subscription.name}」同步完成，导入 ${latest.imported} 条事件';
      return msg;
    }
    return null;
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
    state = state.copyWith(
      syncing: {...state.syncing, id: true},
      syncMessages: {...state.syncMessages, id: null},
    );
    try {
      final res = await _client.post('/calendar/subscriptions/$id/sync') as Map<String, dynamic>;
      final imported = (res['imported'] as num?)?.toInt() ?? 0;
      await refresh();
      await _calendarNotifier.fetchEvents(
        DateTime.now().subtract(const Duration(days: 30)),
        DateTime.now().add(const Duration(days: 30)),
      );
      state = state.copyWith(
        syncing: {...state.syncing, id: false},
        syncMessages: {...state.syncMessages, id: '导入 $imported 条事件'},
      );
      return imported;
    } catch (e) {
      state = state.copyWith(
        syncing: {...state.syncing, id: false},
        syncMessages: {...state.syncMessages, id: '同步失败: $e'},
      );
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
