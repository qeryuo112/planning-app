import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:logger/logger.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// API 客户端
/// 封装基础 URL、JWT Token、通用错误处理与日志，支持 access token 过期自动刷新。
class ApiClient {
  final String baseUrl;
  final Logger _logger = Logger();
  final http.Client _http = http.Client();

  /// 防止多个并发请求同时触发 refresh。
  Future<bool>? _refreshFuture;

  ApiClient({this.baseUrl = 'https://xutaostudy.xyz/api/v1'});

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_token');
  }

  Future<String?> getRefreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_refresh_token');
  }

  Future<void> setTokens(String accessToken, String refreshToken) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('jwt_token', accessToken);
    await prefs.setString('jwt_refresh_token', refreshToken);
  }

  Future<void> setToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('jwt_token', token);
  }

  Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
    await prefs.remove('jwt_refresh_token');
  }

  Future<Map<String, String>> _headers() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<dynamic> get(String path) async {
    return _requestWithRetry((headers) async {
      final uri = Uri.parse('$baseUrl$path');
      _logger.d('GET $uri');
      final response = await _http
          .get(uri, headers: headers)
          .timeout(const Duration(seconds: 15));
      return response;
    });
  }

  Future<dynamic> post(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    return _requestWithRetry((headers) async {
      final uri = Uri.parse('$baseUrl$path');
      _logger.d('POST $uri body=$body');
      final response = await _http
          .post(
            uri,
            headers: headers,
            body: body == null ? null : jsonEncode(body),
          )
          .timeout(const Duration(seconds: 15));
      return response;
    });
  }

  Future<dynamic> patch(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    return _requestWithRetry((headers) async {
      final uri = Uri.parse('$baseUrl$path');
      _logger.d('PATCH $uri body=$body');
      final response = await _http
          .patch(
            uri,
            headers: headers,
            body: body == null ? null : jsonEncode(body),
          )
          .timeout(const Duration(seconds: 15));
      return response;
    });
  }

  Future<dynamic> delete(String path) async {
    return _requestWithRetry((headers) async {
      final uri = Uri.parse('$baseUrl$path');
      _logger.d('DELETE $uri');
      final response = await _http
          .delete(uri, headers: headers)
          .timeout(const Duration(seconds: 15));
      return response;
    });
  }

  /// 上报单条客户端埋点事件。
  Future<dynamic> trackEvent(String eventType, {
    String? targetId,
    Map<String, dynamic>? metadata,
    DateTime? clientTimestamp,
  }) async {
    return post('/analytics/events', body: {
      'eventType': eventType,
      if (targetId != null) 'targetId': targetId,
      if (metadata != null) 'metadata': metadata,
      'clientTimestamp': (clientTimestamp ?? DateTime.now()).toUtc().toIso8601String(),
    });
  }

  /// 批量上报客户端埋点事件。
  Future<dynamic> trackEvents(List<Map<String, dynamic>> events) async {
    return post('/analytics/events/batch', body: {
      'events': events.map((e) => {
        ...e,
        'clientTimestamp': (e['clientTimestamp'] as DateTime? ?? DateTime.now()).toUtc().toIso8601String(),
      }).toList(),
    });
  }

  /// 统一处理请求、401 自动刷新与重试。
  Future<dynamic> _requestWithRetry(
    Future<http.Response> Function(Map<String, String>) request,
  ) async {
    final headers = await _headers();
    var response = await request(headers);

    if (response.statusCode == 401) {
      final refreshed = await _tryRefreshToken();
      if (refreshed) {
        final newHeaders = await _headers();
        response = await request(newHeaders);
      }
    }

    return _handleResponse(response);
  }

  /// 尝试用 refresh token 换取新的 token pair。
  /// 返回 true 表示刷新成功，调用方应使用新 token 重试原请求。
  Future<bool> _tryRefreshToken() async {
    if (_refreshFuture != null) {
      await _refreshFuture;
      final token = await getToken();
      return token != null && token.isNotEmpty;
    }

    _refreshFuture = _doRefresh();
    try {
      return await _refreshFuture!;
    } finally {
      _refreshFuture = null;
    }
  }

  Future<bool> _doRefresh() async {
    final refreshToken = await getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      await clearToken();
      return false;
    }

    try {
      final uri = Uri.parse('$baseUrl/auth/refresh');
      _logger.d('POST $uri (refresh token)');
      final response = await _http
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'refreshToken': refreshToken}),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final accessToken = body['accessToken'] as String?;
        final newRefreshToken = body['refreshToken'] as String?;
        if (accessToken != null && accessToken.isNotEmpty) {
          await setTokens(
            accessToken,
            newRefreshToken ?? refreshToken,
          );
          return true;
        }
      }

      _logger.w('Refresh token 失败: ${response.statusCode} ${response.body}');
    } catch (e, st) {
      _logger.w('Refresh token 异常: $e\n$st');
    }

    await clearToken();
    return false;
  }

  dynamic _handleResponse(http.Response response) {
    _logger.d('Response ${response.statusCode}: ${response.body}');
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return null;
      return jsonDecode(response.body);
    }
    throw Exception('HTTP ${response.statusCode}: ${response.body}');
  }

  void dispose() {
    _http.close();
  }
}
