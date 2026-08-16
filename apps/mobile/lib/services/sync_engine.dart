import 'dart:async';
import 'dart:convert';
import 'package:logger/logger.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:uuid/uuid.dart';

import 'api_client.dart';
import 'local_database.dart';

/// 同步操作结果事件
sealed class SyncOperationEvent {
  final String type;
  final String targetType;
  final String targetId;
  final String? error;

  SyncOperationEvent({
    required this.type,
    required this.targetType,
    required this.targetId,
    this.error,
  });
}

class SyncOperationSuccessEvent extends SyncOperationEvent {
  SyncOperationSuccessEvent({
    required super.type,
    required super.targetType,
    required super.targetId,
  });
}

class SyncOperationFailedEvent extends SyncOperationEvent {
  SyncOperationFailedEvent({
    required super.type,
    required super.targetType,
    required super.targetId,
    required super.error,
  });
}

/// 同步引擎：操作队列 + 拉取服务端事件 + WebSocket 实时监听。
class SyncEngine {
  final ApiClient _api;
  final LocalDatabase _db;
  final Logger _logger = Logger();
  final Uuid _uuid = const Uuid();

  io.Socket? _socket;
  Timer? _pollTimer;
  bool _initialized = false;

  final _eventController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get syncEvents => _eventController.stream;

  final _operationController = StreamController<SyncOperationEvent>.broadcast();
  Stream<SyncOperationEvent> get operationEvents => _operationController.stream;

  SyncEngine(this._api, this._db);

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    // WebSocket 连接在后台进行，避免阻塞登录/启动流程
    _connectSocket().timeout(const Duration(seconds: 10)).catchError((e, st) {
      _logger.w('WebSocket 连接失败，将使用轮询同步', error: e, stackTrace: st);
    });

    await _pullEvents()
        .timeout(const Duration(seconds: 10))
        .catchError((e, st) => _logger.w('首次拉取同步事件失败', error: e, stackTrace: st));
    await pushOperations()
        .timeout(const Duration(seconds: 10))
        .catchError((e, st) => _logger.w('首次推送操作队列失败', error: e, stackTrace: st));
    _startPolling();
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) async {
      await _pullEvents();
      await pushOperations();
    });
  }

  Future<void> _connectSocket() async {
    final token = await _api.getToken();
    if (token == null) {
      _logger.w('无 JWT Token，跳过 WebSocket 连接');
      return;
    }

    final wsBase = _api.baseUrl.replaceFirst('https://', 'wss://').replaceFirst('/api/v1', '');
    _socket = io.io(
      '$wsBase/sync',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setQuery({'token': token})
          .enableAutoConnect()
          .build(),
    );

    _socket!.on('connect', (_) => _logger.i('WebSocket 已连接'));
    _socket!.on('disconnect', (_) => _logger.i('WebSocket 已断开'));
    _socket!.on('auth_ok', (data) => _logger.i('WebSocket 鉴权成功: $data'));
    _socket!.on('auth_error', (data) => _logger.w('WebSocket 鉴权失败: $data'));
    _socket!.on('sync_event', (data) {
      _logger.i('收到实时同步事件: $data');
      _emitEvent(data as Map<String, dynamic>);
    });
  }

  Future<void> _pullEvents() async {
    try {
      final after = await _db.getLastSyncTimestamp();
      final query = after != null ? '?after=${Uri.encodeComponent(after)}' : '';
      final res = await _api.get('/sync/events$query') as List<dynamic>;

      for (final event in res) {
        _emitEvent(event as Map<String, dynamic>);
      }

      if (res.isNotEmpty) {
        final last = res.last as Map<String, dynamic>;
        final ts = last['serverTimestamp'] as String?;
        if (ts != null) {
          await _db.setLastSyncTimestamp(ts);
        }
      }
    } catch (e, st) {
      _logger.e('拉取同步事件失败', error: e, stackTrace: st);
    }
  }

  void _emitEvent(Map<String, dynamic> event) {
    _logger.i('分发同步事件: ${event['eventType']}');
    _eventController.add(event);
  }

  Future<void> pushOperations() async {
    final ops = await _db.getPendingOperations();
    for (final op in ops) {
      try {
        final type = op['type'] as String;
        final payload = _parsePayload(op['payload'] as String);
        final targetId = op['targetId'] as String;

        switch (type) {
          case 'create_task':
            await _api.post('/tasks', body: payload);
            break;
          case 'complete_task':
            await _api.post('/tasks/$targetId/complete', body: payload);
            break;
          case 'postpone_task':
            await _api.post('/tasks/$targetId/postpone', body: payload);
            break;
          case 'makeup_task':
            await _api.post('/tasks/$targetId/makeup', body: payload);
            break;
          case 'habit_checkin':
            await _api.post('/habits/$targetId/checkin', body: payload);
            break;
          case 'create_inbox':
            await _api.post('/inbox', body: payload);
            break;
          case 'update_inbox':
            await _api.patch('/inbox/$targetId', body: payload);
            break;
          case 'dismiss_inbox':
            await _api.post('/inbox/$targetId/dismiss');
            break;
          case 'convert_inbox':
            await _api.post('/inbox/$targetId/convert', body: payload);
            break;
          case 'create_calendar':
            await _api.post('/calendar', body: payload);
            break;
          case 'update_calendar':
            await _api.patch('/calendar/$targetId', body: payload);
            break;
          case 'delete_calendar':
            await _api.delete('/calendar/$targetId');
            break;
        }

        await _db.markOperationDone(op['id'] as String);
        _operationController.add(SyncOperationSuccessEvent(
          type: type,
          targetType: op['targetType'] as String,
          targetId: targetId,
        ));
      } catch (e, st) {
        _logger.e('同步操作失败: ${op['id']}', error: e, stackTrace: st);
        await _db.incrementRetry(op['id'] as String);
        _operationController.add(SyncOperationFailedEvent(
          type: op['type'] as String,
          targetType: op['targetType'] as String,
          targetId: op['targetId'] as String,
          error: e.toString(),
        ));
      }
    }
  }

  Future<void> queueOperation({
    required String type,
    required String targetType,
    required String targetId,
    required Map<String, dynamic> payload,
  }) async {
    await _db.insertOperation(
      id: _uuid.v4(),
      type: type,
      targetType: targetType,
      targetId: targetId,
      payload: payload,
    );
    _logger.i('操作已入队: $type / $targetId');
  }

  /// 立即尝试推送一次操作队列，失败时按指数退避延迟重试。
  Future<void> pushWithBackoff({int maxRetries = 3}) async {
    for (var attempt = 0; attempt < maxRetries; attempt++) {
      final ops = await _db.getPendingOperations();
      if (ops.isEmpty) return;

      await pushOperations();

      final remaining = await _db.getPendingOperations();
      if (remaining.isEmpty) return;

      final delay = Duration(seconds: 2 << attempt); // 2, 4, 8 秒
      _logger.w('操作队列仍有 ${remaining.length} 条待同步，${delay.inSeconds} 秒后重试');
      await Future.delayed(delay);
    }
  }

  void dispose() {
    _pollTimer?.cancel();
    _socket?.dispose();
    _eventController.close();
    _operationController.close();
  }

  Map<String, dynamic> _parsePayload(String raw) {
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      // 兼容旧版使用 toString() 存储的 payload
      return {};
    }
  }
}
