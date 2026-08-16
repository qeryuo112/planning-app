import 'dart:async';
import 'dart:convert';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import 'api_client.dart';
import 'package:logger/logger.dart';

/// 客户端行为埋点服务。
///
/// 个人使用版本：轻量批量上传 + 失败缓存重试。
/// - 事件先进入内存队列，达到阈值或定时后批量上传。
/// - 上传失败时持久化到 SharedPreferences，下次启动/后台/主动 flush 时重试。
/// - 不阻塞业务路径，所有异常内部捕获。
class AnalyticsService with WidgetsBindingObserver {
  static final AnalyticsService _instance = AnalyticsService._internal();
  factory AnalyticsService() => _instance;
  AnalyticsService._internal();

  static const _prefsKey = 'analytics_pending_events';
  static const _batchSize = 10;
  static const _flushInterval = Duration(seconds: 30);
  static const _maxRetries = 3;

  final _logger = Logger();
  final _uuid = const Uuid();
  final List<Map<String, dynamic>> _buffer = [];
  Timer? _flushTimer;
  ApiClient? _apiClient;
  SharedPreferences? _prefs;
  bool _initialized = false;

  /// 初始化。应在 [ApiClient] 可用后调用一次，通常在登录成功后。
  Future<void> initialize(ApiClient apiClient) async {
    if (_initialized) return;
    _apiClient = apiClient;
    _prefs = await SharedPreferences.getInstance();
    WidgetsBinding.instance.addObserver(this);
    _startTimer();
    _initialized = true;
    _logger.d('AnalyticsService 已初始化');

    // 启动时尝试 flush 之前失败缓存的事件
    unawaited(_flushFromStorage());
  }

  void _startTimer() {
    _flushTimer?.cancel();
    _flushTimer = Timer.periodic(_flushInterval, (_) => flush());
  }

  /// 记录单条事件。不会立即上传，而是进入批量队列。
  void trackEvent(
    String eventType, {
    String? targetId,
    Map<String, dynamic>? metadata,
    DateTime? clientTimestamp,
  }) {
    if (!_initialized) {
      _logger.w('AnalyticsService 未初始化，事件丢弃: $eventType');
      return;
    }

    final event = {
      'id': _uuid.v4(),
      'eventType': eventType,
      if (targetId != null) 'targetId': targetId,
      if (metadata != null) 'metadata': metadata,
      'clientTimestamp': (clientTimestamp ?? DateTime.now()).toUtc().toIso8601String(),
      'retries': 0,
    };

    _buffer.add(event);
    _logger.d('埋点入队: $eventType');

    if (_buffer.length >= _batchSize) {
      unawaited(flush());
    }
  }

  /// 立即尝试上传内存队列中的事件。
  Future<void> flush() async {
    if (_buffer.isEmpty) return;

    final batch = List<Map<String, dynamic>>.from(_buffer);
    _buffer.clear();

    await _sendBatch(batch);
  }

  Future<void> _sendBatch(List<Map<String, dynamic>> batch) async {
    final client = _apiClient;
    if (client == null) {
      await _persist(batch);
      return;
    }

    try {
      await client.trackEvents(batch);
      _logger.d('批量埋点上传成功: ${batch.length} 条');
    } catch (e) {
      _logger.w('批量埋点上传失败: $e，缓存 ${batch.length} 条');
      await _persist(batch.map((e) {
        final retries = (e['retries'] as int? ?? 0) + 1;
        return {...e, 'retries': retries};
      }).toList());
    }
  }

  Future<void> _persist(List<Map<String, dynamic>> events) async {
    final prefs = _prefs;
    if (prefs == null) return;

    final pending = _loadPendingFromPrefs(prefs);
    pending.addAll(events.where((e) => (e['retries'] as int? ?? 0) <= _maxRetries));

    // 限制缓存数量，避免无限增长
    while (pending.length > 100) {
      pending.removeAt(0);
    }

    await prefs.setString(_prefsKey, jsonEncode(pending));
  }

  List<Map<String, dynamic>> _loadPendingFromPrefs(SharedPreferences prefs) {
    final raw = prefs.getString(_prefsKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw) as List<dynamic>;
      return decoded.cast<Map<String, dynamic>>();
    } catch (e) {
      _logger.w('读取缓存埋点失败: $e');
      return [];
    }
  }

  /// 从 SharedPreferences 中读取并尝试上传之前失败的事件。
  Future<void> _flushFromStorage() async {
    final prefs = _prefs;
    if (prefs == null) return;

    final pending = _loadPendingFromPrefs(prefs);
    if (pending.isEmpty) return;

    await prefs.remove(_prefsKey);
    await _sendBatch(pending);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      // 进入后台前强制 flush
      unawaited(flush().then((_) => _flushFromStorage()));
    } else if (state == AppLifecycleState.resumed) {
      // 回到前台时尝试重试缓存
      unawaited(_flushFromStorage());
    }
  }

  void dispose() {
    _flushTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
  }
}
