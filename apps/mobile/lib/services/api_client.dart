import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:logger/logger.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// API 客户端
/// 封装基础 URL、JWT Token、通用错误处理与日志。
class ApiClient {
  final String baseUrl;
  final Logger _logger = Logger();

  ApiClient({this.baseUrl = 'https://xutaostudy.xyz/api/v1'});

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_token');
  }

  Future<void> setToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('jwt_token', token);
  }

  Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
  }

  Future<Map<String, String>> _headers() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<dynamic> get(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    _logger.d('GET $uri');
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 15));
    return _handleResponse(response);
  }

  Future<dynamic> post(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    _logger.d('POST $uri body=$body');
    final response = await http
        .post(
          uri,
          headers: await _headers(),
          body: body == null ? null : jsonEncode(body),
        )
        .timeout(const Duration(seconds: 15));
    return _handleResponse(response);
  }

  Future<dynamic> patch(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    _logger.d('PATCH $uri body=$body');
    final response = await http
        .patch(
          uri,
          headers: await _headers(),
          body: body == null ? null : jsonEncode(body),
        )
        .timeout(const Duration(seconds: 15));
    return _handleResponse(response);
  }

  Future<dynamic> delete(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    _logger.d('DELETE $uri');
    final response = await http
        .delete(uri, headers: await _headers())
        .timeout(const Duration(seconds: 15));
    return _handleResponse(response);
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

  dynamic _handleResponse(http.Response response) {
    _logger.d('Response ${response.statusCode}: ${response.body}');
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return null;
      return jsonDecode(response.body);
    }
    throw Exception('HTTP ${response.statusCode}: ${response.body}');
  }
}
