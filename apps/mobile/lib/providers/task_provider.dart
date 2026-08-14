import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../models/task_model.dart';
import '../services/api_client.dart';
import '../services/local_database.dart';
import '../services/sync_engine.dart';
import 'auth_provider.dart';

final tasksProvider = StateNotifierProvider.family<TasksNotifier, AsyncValue<List<TaskModel>>, String?>((ref, date) {
  return TasksNotifier(
    ref.read(apiClientProvider),
    ref.read(localDbProvider),
    ref.read(syncEngineProvider),
    date,
  );
});

class TasksNotifier extends StateNotifier<AsyncValue<List<TaskModel>>> {
  final ApiClient _client;
  final LocalDatabase _db;
  final SyncEngine _sync;
  final String? _date;
  StreamSubscription? _syncSub;

  TasksNotifier(this._client, this._db, this._sync, this._date) : super(const AsyncValue.loading()) {
    _listenSync();
  }

  void _listenSync() {
    _syncSub = _sync.syncEvents.listen((event) {
      final type = event['eventType'] as String?;
      if (type == 'task.created' || type == 'task.completed' || type == 'task.postponed' || type == 'task.madeup') {
        fetchTasks();
      }
    });
  }

  Future<void> fetchTasks() async {
    state = const AsyncValue.loading();
    try {
      // 1. 先读本地缓存
      final localDate = _date ?? DateTime.now().toIso8601String().substring(0, 10);
      final localTasks = await _db.getTasksByDate(localDate);
      if (localTasks.isNotEmpty) {
        state = AsyncValue.data(localTasks);
      }

      // 2. 再拉服务端并合并
      final path = _date != null ? '/tasks?date=$_date' : '/tasks';
      final res = await _client.get(path) as List<dynamic>;
      final serverTasks = res.map((t) => TaskModel.fromJson(t as Map<String, dynamic>)).toList();

      for (final task in serverTasks) {
        await _db.upsertTask(task, dirty: false);
      }

      final merged = await _db.getTasksByDate(localDate);
      state = AsyncValue.data(merged);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<TaskModel?> createTask(String title, {String? scheduledDate, String energyLevel = 'medium'}) async {
    try {
      final id = const Uuid().v4();
      final task = TaskModel(
        id: id,
        title: title,
        scheduledDate: scheduledDate != null ? DateTime.tryParse(scheduledDate) : null,
        energyLevel: energyLevel,
        status: 'todo',
      );

      await _db.upsertTask(task, dirty: true);
      await _sync.queueOperation(
        type: 'create_task',
        targetType: 'task',
        targetId: id,
        payload: {
          'title': title,
          if (scheduledDate != null) 'scheduledDate': scheduledDate,
          'energyLevel': energyLevel,
        },
      );

      final current = state.value ?? [];
      state = AsyncValue.data([...current, task]);

      await _sync.pushOperations();
      return task;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<void> completeTask(String id) async {
    try {
      await _db.updateTaskStatus(id, 'done');
      await _sync.queueOperation(
        type: 'complete_task',
        targetType: 'task',
        targetId: id,
        payload: {'result': 'completed'},
      );

      await fetchTasks();
      await _sync.pushOperations();
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  /// 延期任务：本地状态置为 skipped 并重新排期，入队 postpone_task 操作。
  Future<void> postponeTask(String id, {String? newScheduledDate, String? reason}) async {
    try {
      await _db.postponeTask(id, 'skipped', newScheduledDate);
      await _sync.queueOperation(
        type: 'postpone_task',
        targetType: 'task',
        targetId: id,
        payload: {
          if (newScheduledDate != null) 'newScheduledDate': newScheduledDate,
          if (reason != null) 'reason': reason,
        },
      );

      await fetchTasks();
      await _sync.pushOperations();
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  /// 补打卡：本地状态置为 done，入队 makeup_task 操作。
  Future<void> makeupTask(String id, {int? actualMinutes, int? qualityRating, String? note}) async {
    try {
      await _db.updateTaskStatus(id, 'done');
      await _sync.queueOperation(
        type: 'makeup_task',
        targetType: 'task',
        targetId: id,
        payload: {
          if (actualMinutes != null) 'actualMinutes': actualMinutes,
          if (qualityRating != null) 'qualityRating': qualityRating,
          if (note != null) 'note': note,
        },
      );

      await fetchTasks();
      await _sync.pushOperations();
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  @override
  void dispose() {
    _syncSub?.cancel();
    super.dispose();
  }
}
