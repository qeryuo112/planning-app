class HabitModel {
  final String id;
  final String title;
  final String frequency;
  final String? preferredTime;
  final String energyLevel;
  final String? minimumStandard;

  HabitModel({
    required this.id,
    required this.title,
    required this.frequency,
    this.preferredTime,
    this.energyLevel = 'medium',
    this.minimumStandard,
  });

  factory HabitModel.fromJson(Map<String, dynamic> json) {
    return HabitModel(
      id: json['id'] as String,
      title: json['title'] as String,
      frequency: json['frequency'] as String,
      preferredTime: json['preferredTime'] as String?,
      energyLevel: json['energyLevel'] as String? ?? 'medium',
      minimumStandard: json['minimumStandard'] as String?,
    );
  }
}
