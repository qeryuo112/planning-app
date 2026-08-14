import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:logger/logger.dart';
import 'api_client.dart';

/// SSE 事件基类
sealed class SseEvent {
  final String type;
  SseEvent(this.type);
}

/// 进度事件
class SseProgressEvent extends SseEvent {
  final String stage;
  final String? message;

  SseProgressEvent({required this.stage, this.message}) : super('progress');
}

/// 草案生成完成事件
class SseDraftEvent extends SseEvent {
  final Map<String, dynamic> draft;

  SseDraftEvent(this.draft) : super('draft');
}

/// 完成事件
class SseDoneEvent extends SseEvent {
  SseDoneEvent() : super('done');
}

/// 错误事件
class SseErrorEvent extends SseEvent {
  final String error;

  SseErrorEvent(this.error) : super('error');
}

/// Server-Sent Events 客户端
/// 基于 `package:http` 的流式读取，自动解析 `data:` 前缀并分发事件。
class SseClient {
  final ApiClient _apiClient;
  final Logger _logger = Logger();

  SseClient(this._apiClient);

  /// 监听指定路径的 SSE 流。
  /// [path] 为相对于 baseUrl 的路径，例如 `/ai/plan-drafts/pv1/stream`。
  Stream<SseEvent> listen(String path) {
    final controller = StreamController<SseEvent>();

    Future<void> connect() async {
      try {
        final token = await _apiClient.getToken();
        final uri = Uri.parse('${_apiClient.baseUrl}$path');
        final request = http.Request('GET', uri);
        request.headers['Accept'] = 'text/event-stream';
        request.headers['Cache-Control'] = 'no-cache';
        if (token != null) {
          request.headers['Authorization'] = 'Bearer $token';
        }

        _logger.d('SSE GET $uri');
        final response = await http.Client().send(request);

        if (response.statusCode >= 300) {
          final body = await response.stream.bytesToString();
          controller.add(SseErrorEvent('HTTP ${response.statusCode}: $body'));
          controller.close();
          return;
        }

        response.stream
            .transform(utf8.decoder)
            .transform(const LineSplitter())
            .listen(
              (line) => _handleLine(line, controller),
              onDone: () {
                if (!controller.isClosed) controller.close();
              },
              onError: (e) {
                _logger.e('SSE stream error: $e');
                controller.add(SseErrorEvent(e.toString()));
                controller.close();
              },
              cancelOnError: true,
            );
      } catch (e) {
        _logger.e('SSE connect error: $e');
        controller.add(SseErrorEvent(e.toString()));
        controller.close();
      }
    }

    connect();
    return controller.stream;
  }

  void _handleLine(String line, StreamController<SseEvent> controller) {
    _logger.d('SSE line: $line');
    if (!line.startsWith('data:')) return;

    final raw = line.substring(5).trim();
    if (raw.isEmpty) return;

    try {
      final payload = jsonDecode(raw) as Map<String, dynamic>;
      final type = payload['type'] as String?;

      switch (type) {
        case 'progress':
          controller.add(SseProgressEvent(
            stage: payload['stage'] as String? ?? 'unknown',
            message: payload['message'] as String?,
          ));
        case 'draft':
          controller.add(SseDraftEvent(payload));
        case 'done':
          controller.add(SseDoneEvent());
        case 'error':
          controller.add(SseErrorEvent(
            payload['error'] as String? ?? '未知错误',
          ));
        default:
          _logger.w('未知 SSE 事件类型: $type');
      }
    } catch (e) {
      _logger.w('SSE 事件解析失败: $raw, error=$e');
    }
  }
}
