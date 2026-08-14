import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/goal_model.dart';
import '../services/api_client.dart';
import '../services/local_database.dart';
import '../services/sync_engine.dart';
import 'auth_provider.dart';

final goalsProvider = StateNotifierProvider<GoalsNotifier, AsyncValue<List<GoalModel>>>((ref) {
  return GoalsNotifier(
    ref.read(apiClientProvider),
    ref.read(localDbProvider),
    ref.read(syncEngineProvider),
  );
});

class GoalsNotifier extends StateNotifier<AsyncValue<List<GoalModel>>> {
  final ApiClient _client;
  final LocalDatabase _db;
  final SyncEngine _sync;
  StreamSubscription? _syncSub;

  GoalsNotifier(this._client, this._db, this._sync) : super(const AsyncValue.loading()) {
    _listenSync();
  }

  void _listenSync() {
    _syncSub = _sync.syncEvents.listen((event) {
      final type = event['eventType'] as String?;
      if (type == 'goal.created') {
        fetchGoals();
      }
    });
  }

  Future<void> fetchGoals() async {
    state = const AsyncValue.loading();
    try {
      final localGoals = await _db.getGoals();
      if (localGoals.isNotEmpty) {
        state = AsyncValue.data(localGoals);
      }

      final res = await _client.get('/goals') as List<dynamic>;
      final goals = res.map((g) => GoalModel.fromJson(g as Map<String, dynamic>)).toList();

      await _db.clearGoals();
      for (final goal in goals) {
        await _db.upsertGoal(goal);
      }

      state = AsyncValue.data(goals);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<GoalModel?> createGoal(String title, String horizon) async {
    // 目标创建 Week 5 仍要求联网
    try {
      final res = await _client.post('/goals', body: {
        'title': title,
        'horizon': horizon,
      });
      final goal = GoalModel.fromJson(res as Map<String, dynamic>);
      await _db.upsertGoal(goal);
      final current = state.value ?? [];
      state = AsyncValue.data([...current, goal]);
      return goal;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<Map<String, dynamic>> stats(String id) async {
    try {
      final res = await _client.get('/goals/$id/stats');
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
