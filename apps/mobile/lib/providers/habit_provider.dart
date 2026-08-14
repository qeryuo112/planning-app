import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/habit_model.dart';
import '../services/api_client.dart';
import '../services/local_database.dart';
import '../services/sync_engine.dart';
import 'auth_provider.dart';

final habitsProvider = StateNotifierProvider<HabitsNotifier, AsyncValue<List<HabitModel>>>((ref) {
  return HabitsNotifier(
    ref.read(apiClientProvider),
    ref.read(localDbProvider),
    ref.read(syncEngineProvider),
  );
});

class HabitsNotifier extends StateNotifier<AsyncValue<List<HabitModel>>> {
  final ApiClient _client;
  final LocalDatabase _db;
  final SyncEngine _sync;
  StreamSubscription? _syncSub;

  HabitsNotifier(this._client, this._db, this._sync) : super(const AsyncValue.loading()) {
    _listenSync();
  }

  void _listenSync() {
    _syncSub = _sync.syncEvents.listen((event) {
      final type = event['eventType'] as String?;
      if (type == 'habit.checkin' || type == 'habit.created') {
        fetchHabits();
      }
    });
  }

  Future<void> fetchHabits() async {
    state = const AsyncValue.loading();
    try {
      // 1. 先读本地缓存
      final localHabits = await _db.getHabits();
      if (localHabits.isNotEmpty) {
        state = AsyncValue.data(localHabits);
      }

      // 2. 再拉服务端并合并
      final res = await _client.get('/habits') as List<dynamic>;
      final serverHabits = res.map((h) => HabitModel.fromJson(h as Map<String, dynamic>)).toList();

      for (final habit in serverHabits) {
        await _db.upsertHabit(habit);
      }

      final merged = await _db.getHabits();
      state = AsyncValue.data(merged);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<HabitModel?> createHabit(String title, String frequency) async {
    // 习惯创建 Week 5 仍要求联网
    try {
      final res = await _client.post('/habits', body: {
        'title': title,
        'frequency': frequency,
      });
      final habit = HabitModel.fromJson(res as Map<String, dynamic>);
      await _db.upsertHabit(habit);
      final current = state.value ?? [];
      state = AsyncValue.data([...current, habit]);
      return habit;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<void> checkin(String id) async {
    try {
      await _sync.queueOperation(
        type: 'habit_checkin',
        targetType: 'habit',
        targetId: id,
        payload: {'result': 'completed'},
      );

      await _sync.pushOperations();
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<Map<String, dynamic>> stats(String id) async {
    try {
      final res = await _client.get('/habits/$id/stats?days=30');
      return res as Map<String, dynamic>;
    } catch (e) {
      return {};
    }
  }

  @override
  void dispose() {
    _syncSub?.cancel();
    super.dispose();
  }
}
