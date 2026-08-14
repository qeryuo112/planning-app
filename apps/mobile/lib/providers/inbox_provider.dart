import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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

  InboxNotifier(this._client, this._db, this._sync) : super(const AsyncValue.loading()) {
    _listenSync();
    fetchItems();
  }

  void _listenSync() {
    _syncSub = _sync.syncEvents.listen((event) {
      final type = event['eventType'] as String?;
      if (type?.startsWith('inbox.') == true) {
        fetchItems();
      }
    });
  }

  Future<void> fetchItems() async {
    state = const AsyncValue.loading();
    try {
      // 1. 先读本地缓存
      final localItems = await _db.getInboxItems(status: 'pending');
      if (localItems.isNotEmpty) {
        state = AsyncValue.data(localItems);
      }

      // 2. 再拉服务端并合并
      final res = await _client.get('/inbox') as List<dynamic>;
      final serverItems = res.map((i) => InboxItemModel.fromJson(i as Map<String, dynamic>)).toList();

      for (final item in serverItems) {
        await _db.upsertInboxItem(item, dirty: false);
      }

      final merged = await _db.getInboxItems(status: 'pending');
      state = AsyncValue.data(merged);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<InboxItemModel?> createItem(String title, {String? description}) async {
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

      final current = state.value ?? [];
      state = AsyncValue.data([item, ...current]);

      await _sync.pushOperations();
      return item;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<void> updateItem(String id, String title, {String? description}) async {
    try {
      final current = state.value ?? [];
      final existing = current.firstWhere((i) => i.id == id);
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

      state = AsyncValue.data(
        current.map((i) => i.id == id ? updated : i).toList(),
      );

      await _sync.pushOperations();
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> convertItem(String id, String targetType, {String? scheduledDate, String? projectId, String? milestoneId}) async {
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

      final current = state.value ?? [];
      state = AsyncValue.data(
        current.where((i) => i.id != id).toList(),
      );

      await _sync.pushOperations();
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> dismissItem(String id) async {
    try {
      await _db.updateInboxItemStatus(id, 'dismissed');
      await _sync.queueOperation(
        type: 'dismiss_inbox',
        targetType: 'inbox',
        targetId: id,
        payload: {},
      );

      final current = state.value ?? [];
      state = AsyncValue.data(
        current.where((i) => i.id != id).toList(),
      );

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
