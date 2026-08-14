class InboxItemModel {
  final String id;
  final String title;
  final String? description;
  final String status;
  final String? convertedToType;
  final String? convertedToId;
  final DateTime createdAt;
  final DateTime updatedAt;

  InboxItemModel({
    required this.id,
    required this.title,
    this.description,
    this.status = 'pending',
    this.convertedToType,
    this.convertedToId,
    required this.createdAt,
    required this.updatedAt,
  });

  factory InboxItemModel.fromJson(Map<String, dynamic> json) {
    return InboxItemModel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      status: json['status'] as String? ?? 'pending',
      convertedToType: json['convertedToType'] as String?,
      convertedToId: json['convertedToId'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'status': status,
      'convertedToType': convertedToType,
      'convertedToId': convertedToId,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}
