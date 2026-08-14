class GoalModel {
  final String id;
  final String title;
  final String horizon;
  final String? description;
  final DateTime? dueDate;
  final String status;

  GoalModel({
    required this.id,
    required this.title,
    required this.horizon,
    this.description,
    this.dueDate,
    this.status = 'active',
  });

  factory GoalModel.fromJson(Map<String, dynamic> json) {
    return GoalModel(
      id: json['id'] as String,
      title: json['title'] as String,
      horizon: json['horizon'] as String,
      description: json['description'] as String?,
      dueDate: json['dueDate'] != null ? DateTime.tryParse(json['dueDate'] as String) : null,
      status: json['status'] as String? ?? 'active',
    );
  }
}
