import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/reminder_model.dart';
import '../services/api_client.dart';
import '../services/notification_service.dart';
import '../services/sync_engine.dart';
import 'auth_provider.dart';

final notificationServiceProvider = Provider<NotificationService>((ref) => NotificationService());

final remindersEnabledProvider = StateProvider<bool>((ref) => true);

final remindersProvider = StateNotifierProvider<RemindersNotifier, AsyncValue<List<ReminderModel>>>((ref) {
  return RemindersNotifier(
    ref.read(apiClientProvider),
    ref.read(notificationServiceProvider),
    ref.read(syncEngineProvider),
    ref.read(remindersEnabledProvider.notifier),
  );
});

class RemindersNotifier extends StateNotifier<AsyncValue<List<ReminderModel>>> {
  final ApiClient _client;
  final NotificationService _notificationService;
  final SyncEngine _sync;
  final StateController<bool> _enabledController;
  StreamSubscription? _syncSub;

  RemindersNotifier(
    this._client,
    this._notificationService,
    this._sync,
    this._enabledController,
  ) : super(const AsyncValue.loading()) {
    _listenSync();
  }

  void _listenSync() {
    _syncSub = _sync.syncEvents.listen((event) {
      final type = event['eventType'] as String?;
      if (type == 'reminder.triggered') {
        final payload = event['payload'] as Map<String, dynamic>?;
        final targetType = payload?['targetType'] as String? ?? 'reminder';
        final targetId = payload?['targetId'] as String? ?? '';
        _notificationService.showInstant(
          '计划提醒',
          '你的 $targetType 到期了',
          payload: targetId,
        );
      }
    });
  }

  Future<void> fetchReminders() async {
    state = const AsyncValue.loading();
    try {
      final res = await _client.get('/reminders') as List<dynamic>;
      final reminders = res.map((r) => ReminderModel.fromJson(r as Map<String, dynamic>)).toList();
      state = AsyncValue.data(reminders);
      await _rescheduleAll(reminders);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<ReminderModel?> createReminder({
    required String targetType,
    required String targetId,
    required DateTime triggerAt,
    String? targetTitle,
  }) async {
    try {
      final body = <String, dynamic>{
        'targetType': targetType,
        'targetId': targetId,
        'triggerAt': triggerAt.toIso8601String(),
      };
      final res = await _client.post('/reminders', body: body);
      final reminder = ReminderModel.fromJson(res as Map<String, dynamic>);
      final current = state.value ?? [];
      state = AsyncValue.data([...current, reminder]);
      if (_enabledController.state) {
        await _notificationService.scheduleReminder(reminder.copyWith(targetTitle: targetTitle));
      }
      return reminder;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<void> dismissReminder(String id) async {
    try {
      await _client.post('/reminders/$id/dismiss');
      await _notificationService.cancelReminder(id);
      final current = state.value ?? [];
      state = AsyncValue.data(current.where((r) => r.id != id).toList());
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> snoozeReminder(String id, int minutes) async {
    try {
      final res = await _client.post('/reminders/$id/snooze', body: {'minutes': minutes});
      final updated = ReminderModel.fromJson(res as Map<String, dynamic>);
      await _notificationService.cancelReminder(id);
      if (_enabledController.state) {
        await _notificationService.scheduleReminder(updated);
      }
      final current = state.value ?? [];
      state = AsyncValue.data(current.map((r) => r.id == id ? updated : r).toList());
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> setEnabled(bool enabled) async {
    _enabledController.state = enabled;
    if (!enabled) {
      await _notificationService.cancelAll();
    } else {
      await _rescheduleAll(state.value ?? []);
    }
  }

  Future<void> _rescheduleAll(List<ReminderModel> reminders) async {
    if (!_enabledController.state) return;
    await _notificationService.cancelAll();
    final now = DateTime.now();
    for (final reminder in reminders) {
      if (reminder.status == 'pending' && reminder.triggerAt.isAfter(now)) {
        await _notificationService.scheduleReminder(reminder);
      }
    }
  }

  Future<void> requestPermission() async {
    await _notificationService.initialize();
    await _notificationService.requestPermissions();
  }

  @override
  void dispose() {
    _syncSub?.cancel();
    super.dispose();
  }
}

extension _ReminderCopy on ReminderModel {
  ReminderModel copyWith({String? targetTitle}) {
    return ReminderModel(
      id: id,
      targetType: targetType,
      targetId: targetId,
      targetTitle: targetTitle ?? this.targetTitle,
      triggerAt: triggerAt,
      channel: channel,
      status: status,
      snoozeCount: snoozeCount,
    );
  }
}
