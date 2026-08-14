import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:health/health.dart';
import '../services/api_client.dart';
import 'auth_provider.dart';

final externalProvider = Provider<ExternalApi>((ref) {
  return ExternalApi(ref.read(apiClientProvider));
});

class ExternalApi {
  final ApiClient _client;
  final Health _health = Health();

  ExternalApi(this._client) {
    if (Platform.isAndroid || Platform.isIOS) {
      _health.configure();
    }
  }

  Future<Map<String, dynamic>> importFitnessJson(String source, List<dynamic> activities, {String? habitId}) async {
    final body = <String, dynamic>{
      'source': source,
      'activities': activities,
      if (habitId != null && habitId.isNotEmpty) 'habitId': habitId,
    };
    final res = await _client.post('/external/fitness-import', body: body) as Map<String, dynamic>;
    return {
      'activitiesImported': (res['activitiesImported'] as num?)?.toInt() ?? 0,
      'checkinsCreated': (res['checkinsCreated'] as num?)?.toInt() ?? 0,
    };
  }

  Future<Map<String, dynamic>> importFitnessSingle({
    required String source,
    required String activityType,
    required DateTime startedAt,
    int? durationSeconds,
    double? distanceKm,
    int? calories,
    String? note,
    String? sourceId,
    String? habitId,
  }) async {
    final activity = <String, dynamic>{
      'activityType': activityType,
      'startedAt': startedAt.toIso8601String(),
      if (durationSeconds != null) 'durationSeconds': durationSeconds,
      if (distanceKm != null) 'distanceKm': distanceKm,
      if (calories != null) 'calories': calories,
      if (note != null && note.isNotEmpty) 'note': note,
      if (sourceId != null && sourceId.isNotEmpty) 'sourceId': sourceId,
    };
    return importFitnessJson(source, [activity], habitId: habitId);
  }

  /// 从 Health Connect（Android）/ HealthKit（iOS）读取运动记录并导入。
  /// 失败时抛出明确异常，调用方负责展示友好提示。
  Future<Map<String, dynamic>> syncHealthConnect({
    DateTime? start,
    DateTime? end,
    String? habitId,
  }) async {
    if (!Platform.isAndroid && !Platform.isIOS) {
      throw UnsupportedError('Health Connect 仅支持 Android/iOS');
    }

    final startTime = start ?? DateTime.now().subtract(const Duration(days: 7));
    final endTime = end ?? DateTime.now();

    const types = [HealthDataType.WORKOUT];
    const permissions = [HealthDataAccess.READ];

    bool authorized;
    try {
      authorized = await _health.requestAuthorization(
        types,
        permissions: permissions,
      );
    } catch (e) {
      final msg = e.toString().toLowerCase();
      if (msg.contains('not installed') || msg.contains('health connect') || msg.contains('provider')) {
        throw Exception('Health Connect 未安装或未启用。请先安装 Health Connect 应用，再返回同步。');
      }
      throw Exception('Health Connect 授权异常: $e');
    }

    if (!authorized) {
      throw Exception('未获得 Health Connect 授权。请在系统弹窗中允许读取运动数据，或改用 JSON 导入。');
    }

    List<HealthDataPoint> data;
    try {
      data = await _health.getHealthDataFromTypes(
        types: types,
        startTime: startTime,
        endTime: endTime,
      );
    } catch (e) {
      throw Exception('Health Connect 读取运动数据失败: $e');
    }

    if (data.isEmpty) {
      return {'activitiesImported': 0, 'checkinsCreated': 0};
    }

    final activities = <Map<String, dynamic>>[];
    for (final point in data) {
      final value = point.value;
      if (value is! WorkoutHealthValue) continue;

      final durationSeconds = point.dateTo.difference(point.dateFrom).inSeconds;
      final distanceMeters = value.totalDistance;
      final distanceKm = distanceMeters != null ? distanceMeters / 1000.0 : null;

      activities.add({
        'sourceId': point.uuid,
        'activityType': _mapWorkoutType(value.workoutActivityType),
        'startedAt': point.dateFrom.toIso8601String(),
        'durationSeconds': durationSeconds > 0 ? durationSeconds : null,
        'distanceKm': distanceKm,
        'calories': value.totalEnergyBurned,
        'note': 'Health Connect ${value.workoutActivityType.name}',
      });
    }

    return importFitnessJson('health_connect', activities, habitId: habitId);
  }

  String _mapWorkoutType(HealthWorkoutActivityType type) {
    switch (type) {
      case HealthWorkoutActivityType.RUNNING:
        return 'run';
      case HealthWorkoutActivityType.WALKING:
        return 'walk';
      case HealthWorkoutActivityType.BIKING:
      case HealthWorkoutActivityType.HAND_CYCLING:
        return 'cycle';
      case HealthWorkoutActivityType.SWIMMING:
        return 'swim';
      case HealthWorkoutActivityType.HIKING:
        return 'hike';
      case HealthWorkoutActivityType.ROWING:
        return 'row';
      case HealthWorkoutActivityType.YOGA:
        return 'yoga';
      default:
        return 'other';
    }
  }
}
