import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_client.dart';
import 'auth_provider.dart';

final socialProvider = StateNotifierProvider<SocialNotifier, AsyncValue<Map<String, dynamic>>>(
  (ref) => SocialNotifier(ref.read(apiClientProvider)),
);

class SocialNotifier extends StateNotifier<AsyncValue<Map<String, dynamic>>> {
  final ApiClient _client;

  SocialNotifier(this._client) : super(const AsyncValue.data({}));

  Future<List<dynamic>> fetchReceivedShares({String? status}) async {
    try {
      final path = status != null
          ? '/social/shares/received?status=$status'
          : '/social/shares/received';
      final res = await _client.get(path);
      return res as List<dynamic>;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return [];
    }
  }

  Future<List<dynamic>> fetchOwnedShares() async {
    try {
      final res = await _client.get('/social/shares/owned');
      return res as List<dynamic>;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return [];
    }
  }

  Future<dynamic> shareGoal(String goalId, String email) async {
    try {
      final res = await _client.post('/social/goals/$goalId/share', body: {
        'sharedWithEmail': email,
        'permission': 'view',
      });
      return res;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<dynamic> respondToShare(String shareId, String status) async {
    try {
      final res = await _client.post('/social/shares/$shareId/respond', body: {
        'status': status,
      });
      return res;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<List<dynamic>> fetchChallenges({String? status}) async {
    try {
      final path = status != null
          ? '/social/challenges?status=$status'
          : '/social/challenges';
      final res = await _client.get(path);
      return res as List<dynamic>;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return [];
    }
  }

  Future<dynamic> createChallenge(Map<String, dynamic> body) async {
    try {
      final res = await _client.post('/social/challenges', body: body);
      return res;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<dynamic> joinChallenge(String challengeId) async {
    try {
      final res = await _client.post('/social/challenges/$challengeId/join');
      return res;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<Map<String, dynamic>?> fetchLeaderboard(String challengeId) async {
    try {
      final res = await _client.get('/social/challenges/$challengeId/leaderboard');
      return res as Map<String, dynamic>;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }
}
