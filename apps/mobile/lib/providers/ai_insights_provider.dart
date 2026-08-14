import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_client.dart';
import 'auth_provider.dart';

final aiInsightsProvider = Provider<AiInsightsApi>((ref) {
  return AiInsightsApi(ref.read(apiClientProvider));
});

class AiInsightsApi {
  final ApiClient _client;

  AiInsightsApi(this._client);

  Future<Map<String, dynamic>> fetchProfileSummary({bool useSnapshot = true}) async {
    final res = await _client.get('/ai/profile-summary?useSnapshot=$useSnapshot') as Map<String, dynamic>;
    return res;
  }

  /// 强制实时刷新用户画像并生成快照。
  Future<Map<String, dynamic>> refreshProfileSummary() async {
    return fetchProfileSummary(useSnapshot: false);
  }

  Future<Map<String, dynamic>> fetchPersonalizedRecommendations({String? goalId}) async {
    final path = goalId == null || goalId.isEmpty
        ? '/ai/personalized-recommendations'
        : '/ai/personalized-recommendations?goalId=$goalId';
    final res = await _client.get(path) as Map<String, dynamic>;
    return res;
  }
}
