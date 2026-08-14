class TaskModel {
  final String id;
  final String title;
  final String? description;
  final DateTime? scheduledDate;
  final String status;
  final int? durationMinutes;
  final String energyLevel;
  final String? projectId;
  final String? milestoneId;

  TaskModel({
    required this.id,
    required this.title,
    this.description,
    this.scheduledDate,
    this.status = 'todo',
    this.durationMinutes,
    this.energyLevel = 'medium',
    this.projectId,
    this.milestoneId,
  });

  factory TaskModel.fromJson(Map<String, dynamic> json) {
    return TaskModel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      scheduledDate: json['scheduledDate'] != null
          ? DateTime.tryParse(json['scheduledDate'] as String)
          : null,
      status: json['status'] as String? ?? 'todo',
      durationMinutes: json['durationMinutes'] as int?,
      energyLevel: json['energyLevel'] as String? ?? 'medium',
      projectId: json['projectId'] as String?,
      milestoneId: json['milestoneId'] as String?,
    );
  }

  bool get isDone => status == 'done';
}
