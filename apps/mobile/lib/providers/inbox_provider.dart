import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:uuid/uuid.dart';
import '../models/inbox_item_model.dart';
import '../services/api_client.dart';
import '../services/local_database.dart';
import '../services/sync_engine.dart';
import 'auth_provider.dart';

final inboxProvider = StateNotifierProvider<InboxNotifier, AsyncValue<List<InboxItemModel>>>((ref) {
  return InboxNotifier(
    ref.read(apiClientProvider),
    ref.read(localDbProvider),
    ref.read(syncEngineProvider),
  );
});

class InboxNotifier extends StateNotifier<AsyncValue<List<InboxItemModel>>> {
  final ApiClient _client;
  final LocalDatabase _db;
  final SyncEngine _sync;
  StreamSubscription? _syncSub;
  bool _hasLoadedLocal = false;

  InboxNotifier(this._client, this._db, this._sync) : super(const AsyncValue.loading()) {
    _listenSync();
    _loadLocalThenServer();
  }

  void _listenSync() {
    _syncSub = _sync.syncEvents.listen((event) {
      final type = event['eventType'] as String?;
      if (type?.startsWith('inbox.') == true) {
        _loadLocalThenServer();
      }
    });
  }

  /// 离线优先：先读本地缓存展示，再异步拉取服务端合并。
  Future<void> _loadLocalThenServer() async {
    if (!_hasLoadedLocal) {
      final localItems = await _db.getInboxItems(status: 'pending');
      if (localItems.isNotEmpty) {
        state = AsyncValue.data(localItems);
        _hasLoadedLocal = true;
      }
    }

    try {
      final res = await _client.get('/inbox') as List<dynamic>;
      final serverItems = res.map((i) => InboxItemModel.fromJson(i as Map<String, dynamic>)).toList();

      for (final item in serverItems) {
        await _db.upsertInboxItem(item, dirty: false);
      }

      final merged = await _db.getInboxItems(status: 'pending');
      if (mounted) {
        state = AsyncValue.data(merged);
        _hasLoadedLocal = true;
      }
    } catch (e) {
      // 离线或请求失败时，保持本地缓存，不覆盖为错误状态。
      if (mounted && state is! AsyncData) {
        final localItems = await _db.getInboxItems(status: 'pending');
        state = AsyncValue.data(localItems);
      }
      _logger.w('拉取收件箱失败，已使用本地缓存: $e');
    }
  }

  Future<void> refresh() => _loadLocalThenServer();

  Future<InboxItemModel?> createItem(String title, {String? description}) async {
    final previous = state.value ?? [];
    try {
      final id = const Uuid().v4();
      final now = DateTime.now();
      final item = InboxItemModel(
        id: id,
        title: title,
        description: description,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      );

      await _db.upsertInboxItem(item, dirty: true);
      await _sync.queueOperation(
        type: 'create_inbox',
        targetType: 'inbox',
        targetId: id,
        payload: {
          'title': title,
          if (description != null) 'description': description,
        },
      );

      state = AsyncValue.data([item, ...previous]);
      _sync.pushOperations();
      return item;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<void> updateItem(String id, String title, {String? description}) async {
    final previous = state.value ?? [];
    final existing = previous.firstWhere((i) => i.id == id);
    final updated = InboxItemModel(
      id: id,
      title: title,
      description: description ?? existing.description,
      status: existing.status,
      convertedToType: existing.convertedToType,
      convertedToId: existing.convertedToId,
      createdAt: existing.createdAt,
      updatedAt: DateTime.now(),
    );

    final optimisticState = previous.map((i) => i.id == id ? updated : i).toList();
    state = AsyncValue.data(optimisticState);

    try {
      await _db.upsertInboxItem(updated, dirty: true);
      await _sync.queueOperation(
        type: 'update_inbox',
        targetType: 'inbox',
        targetId: id,
        payload: {
          'title': title,
          if (description != null) 'description': description,
        },
      );
      _sync.pushOperations();
    } catch (e) {
      // 失败时回退到之前状态
      state = AsyncValue.data(previous);
      rethrow;
    }
  }

  Future<void> convertItem(String id, String targetType, {String? scheduledDate, String? projectId, String? milestoneId}) async {
    final previous = state.value ?? [];
    final optimisticState = previous.where((i) => i.id != id).toList();
    state = AsyncValue.data(optimisticState);

    try {
      await _db.updateInboxItemStatus(id, 'converted');

      final body = <String, dynamic>{'targetType': targetType};
      if (scheduledDate != null) body['scheduledDate'] = scheduledDate;
      if (projectId != null) body['projectId'] = projectId;
      if (milestoneId != null) body['milestoneId'] = milestoneId;

      await _sync.queueOperation(
        type: 'convert_inbox',
        targetType: 'inbox',
        targetId: id,
        payload: body,
      );
      _sync.pushOperations();
    } catch (e) {
      state = AsyncValue.data(previous);
      rethrow;
    }
  }

  Future<void> dismissItem(String id) async {
    final previous = state.value ?? [];
    final optimisticState = previous.where((i) => i.id != id).toList();
    state = AsyncValue.data(optimisticState);

    try {
      await _db.updateInboxItemStatus(id, 'dismissed');
      await _sync.queueOperation(
        type: 'dismiss_inbox',
        targetType: 'inbox',
        targetId: id,
        payload: {},
      );
      _sync.pushOperations();
    } catch (e) {
      state = AsyncValue.data(previous);
      rethrow;
    }
  }

  @override
  void dispose() {
    _syncSub?.cancel();
    super.dispose();
  }
}

final _logger = Logger();
