class ReminderModel {
  final String id;
  final String targetType;
  final String targetId;
  final String? targetTitle;
  final DateTime triggerAt;
  final String channel;
  final String status;
  final int snoozeCount;

  ReminderModel({
    required this.id,
    required this.targetType,
    required this.targetId,
    this.targetTitle,
    required this.triggerAt,
    this.channel = 'push',
    this.status = 'pending',
    this.snoozeCount = 0,
  });

  factory ReminderModel.fromJson(Map<String, dynamic> json) {
    return ReminderModel(
      id: json['id'] as String,
      targetType: json['targetType'] as String,
      targetId: json['targetId'] as String,
      targetTitle: json['targetTitle'] as String?,
      triggerAt: DateTime.parse(json['triggerAt'] as String),
      channel: json['channel'] as String? ?? 'push',
      status: json['status'] as String? ?? 'pending',
      snoozeCount: json['snoozeCount'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'targetType': targetType,
      'targetId': targetId,
      'targetTitle': targetTitle,
      'triggerAt': triggerAt.toIso8601String(),
      'channel': channel,
      'status': status,
      'snoozeCount': snoozeCount,
    };
  }

  String get targetTypeLabel {
    switch (targetType) {
      case 'goal':
        return '目标';
      case 'task':
        return '任务';
      case 'habit':
        return '习惯';
      default:
        return '目标';
    }
  }
}
