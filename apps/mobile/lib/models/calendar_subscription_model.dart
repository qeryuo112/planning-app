class CalendarSubscriptionModel {
  final String id;
  final String name;
  final String source;
  final String? url;
  final String? lastSyncAt;
  final Map<String, dynamic>? lastSyncResult;

  CalendarSubscriptionModel({
    required this.id,
    required this.name,
    required this.source,
    this.url,
    this.lastSyncAt,
    this.lastSyncResult,
  });

  factory CalendarSubscriptionModel.fromJson(Map<String, dynamic> json) {
    return CalendarSubscriptionModel(
      id: json['id'] as String,
      name: json['name'] as String,
      source: json['source'] as String,
      url: json['url'] as String?,
      lastSyncAt: json['lastSyncAt'] as String?,
      lastSyncResult: json['lastSyncResult'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'source': source,
      if (url != null) 'url': url,
      if (lastSyncAt != null) 'lastSyncAt': lastSyncAt,
      if (lastSyncResult != null) 'lastSyncResult': lastSyncResult,
    };
  }

  CalendarSubscriptionModel copyWith({
    String? id,
    String? name,
    String? source,
    String? url,
    String? lastSyncAt,
    Map<String, dynamic>? lastSyncResult,
  }) {
    return CalendarSubscriptionModel(
      id: id ?? this.id,
      name: name ?? this.name,
      source: source ?? this.source,
      url: url ?? this.url,
      lastSyncAt: lastSyncAt ?? this.lastSyncAt,
      lastSyncResult: lastSyncResult ?? this.lastSyncResult,
    );
  }
}
