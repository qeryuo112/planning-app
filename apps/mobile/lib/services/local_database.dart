import 'dart:async';
import 'dart:convert';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

import '../models/task_model.dart';
import '../models/habit_model.dart';
import '../models/goal_model.dart';
import '../models/inbox_item_model.dart';
import '../models/calendar_event_model.dart';

/// 本地数据库持久化目标、任务、习惯与待同步操作。
class LocalDatabase {
  static final LocalDatabase _instance = LocalDatabase._internal();
  static Database? _db;

  factory LocalDatabase() => _instance;

  LocalDatabase._internal();

  Future<Database> get database async {
    _db ??= await _init();
    return _db!;
  }

  Future<Database> _init() async {
    final databasesPath = await getDatabasesPath();
    final path = join(databasesPath, 'planning_app.db');
    return openDatabase(
      path,
      version: 2,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
    );
  }

  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      await _createInboxTable(db);
      await _createCalendarTable(db);
    }
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE goals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        horizon TEXT NOT NULL,
        description TEXT,
        dueDate TEXT,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        dirty INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        scheduledDate TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        durationMinutes INTEGER,
        energyLevel TEXT NOT NULL DEFAULT 'medium',
        projectId TEXT,
        milestoneId TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        dirty INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE habits (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        frequency TEXT NOT NULL,
        preferredTime TEXT,
        energyLevel TEXT NOT NULL DEFAULT 'medium',
        minimumStandard TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        dirty INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE operations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        targetType TEXT NOT NULL,
        targetId TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retries INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    ''');

    await _createInboxTable(db);
    await _createCalendarTable(db);
  }

  Future<void> _createInboxTable(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS inbox_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        convertedToType TEXT,
        convertedToId TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        dirty INTEGER NOT NULL DEFAULT 0
      )
    ''');
  }

  Future<void> _createCalendarTable(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        startAt TEXT NOT NULL,
        endAt TEXT,
        taskId TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        dirty INTEGER NOT NULL DEFAULT 0
      )
    ''');
  }

  Future<void> close() async {
    await _db?.close();
    _db = null;
  }

  // ==================== Sync Meta ====================

  Future<String?> getLastSyncTimestamp() async {
    final db = await database;
    final rows = await db.query(
      'sync_meta',
      where: 'key = ?',
      whereArgs: ['last_sync_timestamp'],
    );
    if (rows.isEmpty) return null;
    return rows.first['value'] as String?;
  }

  Future<void> setLastSyncTimestamp(String value) async {
    final db = await database;
    await db.insert(
      'sync_meta',
      {'key': 'last_sync_timestamp', 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // ==================== Goals ====================

  Future<void> upsertGoal(GoalModel goal) async {
    final db = await database;
    await db.insert(
      'goals',
      {
        'id': goal.id,
        'title': goal.title,
        'horizon': goal.horizon,
        'description': goal.description,
        'dueDate': goal.dueDate?.toIso8601String(),
        'status': goal.status,
        'createdAt': DateTime.now().toIso8601String(),
        'updatedAt': DateTime.now().toIso8601String(),
        'dirty': 0,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<GoalModel>> getGoals() async {
    final db = await database;
    final rows = await db.query('goals', orderBy: 'createdAt DESC');
    return rows.map((r) => _rowToGoal(r)).toList();
  }

  Future<void> clearGoals() async {
    final db = await database;
    await db.delete('goals');
  }

  Future<void> deleteGoal(String id) async {
    final db = await database;
    await db.delete('goals', where: 'id = ?', whereArgs: [id]);
  }

  // ==================== Tasks ====================

  Future<void> upsertTask(TaskModel task, {bool dirty = false}) async {
    final db = await database;
    await db.insert(
      'tasks',
      {
        'id': task.id,
        'title': task.title,
        'description': task.description,
        'scheduledDate': task.scheduledDate?.toIso8601String().substring(0, 10),
        'status': task.status,
        'durationMinutes': task.durationMinutes,
        'energyLevel': task.energyLevel,
        'projectId': task.projectId,
        'milestoneId': task.milestoneId,
        'createdAt': DateTime.now().toIso8601String(),
        'updatedAt': DateTime.now().toIso8601String(),
        'dirty': dirty ? 1 : 0,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<TaskModel>> getTasksByDate(String date) async {
    final db = await database;
    final rows = await db.query(
      'tasks',
      where: 'scheduledDate = ?',
      whereArgs: [date],
      orderBy: 'createdAt DESC',
    );
    return rows.map((r) => _rowToTask(r)).toList();
  }

  Future<List<TaskModel>> getAllTasks() async {
    final db = await database;
    final rows = await db.query('tasks', orderBy: 'createdAt DESC');
    return rows.map((r) => _rowToTask(r)).toList();
  }

  Future<void> updateTaskStatus(String id, String status) async {
    final db = await database;
    await db.update(
      'tasks',
      {
        'status': status,
        'updatedAt': DateTime.now().toIso8601String(),
        'dirty': 1,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> postponeTask(String id, String status, String? scheduledDate) async {
    final db = await database;
    await db.update(
      'tasks',
      {
        'status': status,
        'scheduledDate': scheduledDate,
        'updatedAt': DateTime.now().toIso8601String(),
        'dirty': 1,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> clearTasks() async {
    final db = await database;
    await db.delete('tasks');
  }

  // ==================== Habits ====================

  Future<void> upsertHabit(HabitModel habit) async {
    final db = await database;
    await db.insert(
      'habits',
      {
        'id': habit.id,
        'title': habit.title,
        'frequency': habit.frequency,
        'preferredTime': habit.preferredTime,
        'energyLevel': habit.energyLevel,
        'minimumStandard': habit.minimumStandard,
        'createdAt': DateTime.now().toIso8601String(),
        'updatedAt': DateTime.now().toIso8601String(),
        'dirty': 0,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<HabitModel>> getHabits() async {
    final db = await database;
    final rows = await db.query('habits', orderBy: 'createdAt DESC');
    return rows.map((r) => _rowToHabit(r)).toList();
  }

  Future<void> clearHabits() async {
    final db = await database;
    await db.delete('habits');
  }

  // ==================== Inbox Items ====================

  Future<void> upsertInboxItem(InboxItemModel item, {bool dirty = false}) async {
    final db = await database;
    await db.insert(
      'inbox_items',
      {
        'id': item.id,
        'title': item.title,
        'description': item.description,
        'status': item.status,
        'convertedToType': item.convertedToType,
        'convertedToId': item.convertedToId,
        'createdAt': item.createdAt.toIso8601String(),
        'updatedAt': item.updatedAt.toIso8601String(),
        'dirty': dirty ? 1 : 0,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<InboxItemModel>> getInboxItems({String? status}) async {
    final db = await database;
    final rows = status != null
        ? await db.query('inbox_items', where: 'status = ?', whereArgs: [status], orderBy: 'createdAt DESC')
        : await db.query('inbox_items', orderBy: 'createdAt DESC');
    return rows.map((r) => _rowToInboxItem(r)).toList();
  }

  Future<void> updateInboxItemStatus(String id, String status) async {
    final db = await database;
    await db.update(
      'inbox_items',
      {
        'status': status,
        'updatedAt': DateTime.now().toIso8601String(),
        'dirty': 1,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> clearInboxItems() async {
    final db = await database;
    await db.delete('inbox_items');
  }

  // ==================== Calendar Events ====================

  Future<void> upsertCalendarEvent(CalendarEventModel event, {bool dirty = false}) async {
    final db = await database;
    await db.insert(
      'calendar_events',
      {
        'id': event.id,
        'title': event.title,
        'description': event.description,
        'startAt': event.startAt.toIso8601String(),
        'endAt': event.endAt?.toIso8601String(),
        'taskId': event.taskId,
        'createdAt': event.createdAt.toIso8601String(),
        'updatedAt': event.updatedAt.toIso8601String(),
        'dirty': dirty ? 1 : 0,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<CalendarEventModel>> getCalendarEventsByRange(DateTime start, DateTime end) async {
    final db = await database;
    final rows = await db.query(
      'calendar_events',
      where: 'startAt >= ? AND startAt <= ?',
      whereArgs: [start.toIso8601String(), end.toIso8601String()],
      orderBy: 'startAt ASC',
    );
    return rows.map((r) => _rowToCalendarEvent(r)).toList();
  }

  Future<List<CalendarEventModel>> getAllCalendarEvents() async {
    final db = await database;
    final rows = await db.query('calendar_events', orderBy: 'startAt ASC');
    return rows.map((r) => _rowToCalendarEvent(r)).toList();
  }

  Future<void> deleteCalendarEvent(String id) async {
    final db = await database;
    await db.delete('calendar_events', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> clearCalendarEvents() async {
    final db = await database;
    await db.delete('calendar_events');
  }

  // ==================== Operations ====================

  Future<void> insertOperation({
    required String id,
    required String type,
    required String targetType,
    required String targetId,
    required Map<String, dynamic> payload,
  }) async {
    final db = await database;
    await db.insert('operations', {
      'id': id,
      'type': type,
      'targetType': targetType,
      'targetId': targetId,
      'payload': jsonEncode(payload),
      'status': 'pending',
      'retries': 0,
      'createdAt': DateTime.now().toIso8601String(),
    });
  }

  Future<List<Map<String, dynamic>>> getPendingOperations() async {
    final db = await database;
    return db.query(
      'operations',
      where: 'status = ?',
      whereArgs: ['pending'],
      orderBy: 'createdAt ASC',
    );
  }

  Future<void> markOperationDone(String id) async {
    final db = await database;
    await db.delete('operations', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> incrementRetry(String id) async {
    final db = await database;
    await db.rawUpdate(
      'UPDATE operations SET retries = retries + 1 WHERE id = ?',
      [id],
    );
  }

  Future<void> removeOperation(String id) async {
    final db = await database;
    await db.delete('operations', where: 'id = ?', whereArgs: [id]);
  }

  // ==================== Mappers ====================

  GoalModel _rowToGoal(Map<String, dynamic> r) {
    return GoalModel(
      id: r['id'] as String,
      title: r['title'] as String,
      horizon: r['horizon'] as String,
      description: r['description'] as String?,
      dueDate: r['dueDate'] != null ? DateTime.tryParse(r['dueDate'] as String) : null,
      status: r['status'] as String,
    );
  }

  TaskModel _rowToTask(Map<String, dynamic> r) {
    return TaskModel(
      id: r['id'] as String,
      title: r['title'] as String,
      description: r['description'] as String?,
      scheduledDate: r['scheduledDate'] != null
          ? DateTime.tryParse(r['scheduledDate'] as String)
          : null,
      status: r['status'] as String,
      durationMinutes: r['durationMinutes'] as int?,
      energyLevel: r['energyLevel'] as String,
      projectId: r['projectId'] as String?,
      milestoneId: r['milestoneId'] as String?,
    );
  }

  HabitModel _rowToHabit(Map<String, dynamic> r) {
    return HabitModel(
      id: r['id'] as String,
      title: r['title'] as String,
      frequency: r['frequency'] as String,
      preferredTime: r['preferredTime'] as String?,
      energyLevel: r['energyLevel'] as String,
      minimumStandard: r['minimumStandard'] as String?,
    );
  }

  InboxItemModel _rowToInboxItem(Map<String, dynamic> r) {
    return InboxItemModel(
      id: r['id'] as String,
      title: r['title'] as String,
      description: r['description'] as String?,
      status: r['status'] as String,
      convertedToType: r['convertedToType'] as String?,
      convertedToId: r['convertedToId'] as String?,
      createdAt: DateTime.parse(r['createdAt'] as String),
      updatedAt: DateTime.parse(r['updatedAt'] as String),
    );
  }

  CalendarEventModel _rowToCalendarEvent(Map<String, dynamic> r) {
    return CalendarEventModel(
      id: r['id'] as String,
      title: r['title'] as String,
      description: r['description'] as String?,
      startAt: DateTime.parse(r['startAt'] as String),
      endAt: r['endAt'] != null ? DateTime.tryParse(r['endAt'] as String) : null,
      taskId: r['taskId'] as String?,
      createdAt: DateTime.parse(r['createdAt'] as String),
      updatedAt: DateTime.parse(r['updatedAt'] as String),
    );
  }
}
