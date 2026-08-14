import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_client.dart';
import 'auth_provider.dart';

class UserPreferences {
  final String timezone;
  final Map<String, dynamic> availableTime;
  final Map<String, dynamic> energyCurve;
  final Map<String, dynamic> notificationSetting;

  UserPreferences({
    this.timezone = 'Asia/Shanghai',
    this.availableTime = const {},
    this.energyCurve = const {},
    this.notificationSetting = const {},
  });

  factory UserPreferences.fromJson(Map<String, dynamic> json) {
    return UserPreferences(
      timezone: json['timezone'] as String? ?? 'Asia/Shanghai',
      availableTime: _asMap(json['availableTime']),
      energyCurve: _asMap(json['energyCurve']),
      notificationSetting: _asMap(json['notificationSetting']),
    );
  }

  static Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.map((k, v) => MapEntry(k.toString(), v));
    return {};
  }
}

final settingsProvider = StateNotifierProvider<SettingsNotifier, AsyncValue<UserPreferences>>((ref) {
  return SettingsNotifier(ref.read(apiClientProvider));
});

class SettingsNotifier extends StateNotifier<AsyncValue<UserPreferences>> {
  final ApiClient _client;

  SettingsNotifier(this._client) : super(const AsyncValue.loading()) {
    fetchPreferences();
  }

  Future<void> fetchPreferences() async {
    state = const AsyncValue.loading();
    try {
      final res = await _client.get('/users/me');
      final prefs = UserPreferences.fromJson(res as Map<String, dynamic>);
      state = AsyncValue.data(prefs);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> updatePreferences({
    String? timezone,
    Map<String, dynamic>? availableTime,
    Map<String, dynamic>? energyCurve,
    Map<String, dynamic>? notificationSetting,
  }) async {
    try {
      final body = <String, dynamic>{
        if (timezone != null) 'timezone': timezone,
        if (availableTime != null) 'availableTime': availableTime,
        if (energyCurve != null) 'energyCurve': energyCurve,
        if (notificationSetting != null) 'notificationSetting': notificationSetting,
      };
      final res = await _client.patch('/users/me/preferences', body: body);
      final prefs = UserPreferences.fromJson(res as Map<String, dynamic>);
      state = AsyncValue.data(prefs);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}
