import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_client.dart';
import 'auth_provider.dart';

final reportsProvider = Provider<ReportsApi>((ref) {
  return ReportsApi(ref.read(apiClientProvider));
});

class ReportsApi {
  final ApiClient _client;

  ReportsApi(this._client);

  Future<Map<String, dynamic>> fetchExecutionReport(String period, DateTime date) async {
    final dateStr = date.toIso8601String().split('T').first;
    final res = await _client.get('/reports/execution?period=$period&date=$dateStr') as Map<String, dynamic>;
    return res;
  }

  Future<Map<String, dynamic>> fetchEnergyAnalysis() async {
    final res = await _client.get('/reports/energy') as Map<String, dynamic>;
    return res;
  }

  Future<Map<String, dynamic>> fetchBestTimeReport() async {
    final res = await _client.get('/reports/best-time') as Map<String, dynamic>;
    return res;
  }
}
