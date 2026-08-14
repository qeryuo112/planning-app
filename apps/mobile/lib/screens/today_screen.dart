import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/today_provider.dart';
import '../providers/task_provider.dart';
import '../providers/habit_provider.dart';
import '../providers/reminder_provider.dart';
import '../models/reminder_model.dart';

class TodayScreen extends ConsumerStatefulWidget {
  const TodayScreen({super.key});

  @override
  ConsumerState<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends ConsumerState<TodayScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(todayProvider.notifier).fetchToday();
      ref.read(remindersProvider.notifier).fetchReminders();
      ref.read(remindersProvider.notifier).requestPermission();
    });
  }

  Future<void> _completeTask(String taskId) async {
    final date = DateFormat('yyyy-MM-dd').format(DateTime.now());
    await ref.read(tasksProvider(date).notifier).completeTask(taskId);
    await ref.read(todayProvider.notifier).fetchToday();
  }

  Future<void> _checkinHabit(String habitId) async {
    await ref.read(habitsProvider.notifier).checkin(habitId);
    await ref.read(todayProvider.notifier).fetchToday();
  }

  String _tomorrowDateString() {
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    return DateFormat('yyyy-MM-dd').format(tomorrow);
  }

  void _showTomorrowPreview() {
    final date = _tomorrowDateString();
    ref.read(tasksProvider(date).notifier).fetchTasks();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        return Consumer(
          builder: (context, ref, child) {
            final tasksAsync = ref.watch(tasksProvider(date));
            return DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.6,
              minChildSize: 0.3,
              maxChildSize: 0.9,
              builder: (_, scrollController) {
                return tasksAsync.when(
                  data: (tasks) {
                    final displayTasks = tasks.where((t) => t.status != 'done').toList();
                    return Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text(
                            '明日预览 ($date)',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                        ),
                        Expanded(
                          child: displayTasks.isEmpty
                              ? const Center(child: Text('明天没有待办任务'))
                              : ListView.builder(
                                  controller: scrollController,
                                  itemCount: displayTasks.length,
                                  itemBuilder: (_, index) {
                                    final task = displayTasks[index];
                                    return ListTile(
                                      title: Text(task.title),
                                      subtitle: Text('${task.energyLevel} · ${_formatDate(task.scheduledDate)}'),
                                    );
                                  },
                                ),
                        ),
                      ],
                    );
                  },
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Center(child: Text('加载失败: $e')),
                );
              },
            );
          },
        );
      },
    );
  }

  String _formatDate(DateTime? date) {
    if (date == null) return '未排期';
    return DateFormat('MM-dd').format(date);
  }

  @override
  Widget build(BuildContext context) {
    final todayAsync = ref.watch(todayProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('今日')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(todayProvider.notifier).fetchToday(),
        child: todayAsync.when(
          data: (data) {
            if (data == null) {
              return const Center(child: Text('暂无数据'));
            }
            return ListView(
              padding: const EdgeInsets.all(16.0),
              children: [
                _buildSummaryCard(data),
                const SizedBox(height: 12),
                _buildTomorrowPreviewCard(),
                const SizedBox(height: 16),
                _buildReminders(),
                const SizedBox(height: 16),
                _buildTopTasks(data['topTasks'] as List<dynamic>? ?? []),
                const SizedBox(height: 24),
                _buildHabits(data['habits'] as List<dynamic>? ?? []),
                const SizedBox(height: 24),
                _buildGoals(data['goals'] as List<dynamic>? ?? []),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('加载失败: $e')),
        ),
      ),
    );
  }

  Widget _buildSummaryCard(Map<String, dynamic> data) {
    final total = data['totalTasks'] as int? ?? 0;
    final done = data['doneTasks'] as int? ?? 0;
    final overdue = data['overdueTasks'] as int? ?? 0;
    final rate = total > 0 ? done / total : 0.0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('今日概览', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            LinearProgressIndicator(
              value: rate.toDouble(),
              minHeight: 12,
              borderRadius: BorderRadius.circular(6),
            ),
            const SizedBox(height: 8),
            Text('$done / $total 任务 · ${(rate * 100).toStringAsFixed(0)}%'),
            if (overdue > 0)
              Padding(
                padding: const EdgeInsets.only(top: 8.0),
                child: Text('有 $overdue 个过期任务', style: const TextStyle(color: Colors.orange)),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildTomorrowPreviewCard() {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.calendar_today, color: Colors.blue),
        title: const Text('明日预览'),
        subtitle: Text('查看 ${_tomorrowDateString()} 的待办任务'),
        trailing: const Icon(Icons.chevron_right),
        onTap: _showTomorrowPreview,
      ),
    );
  }

  Widget _buildReminders() {
    final remindersAsync = ref.watch(remindersProvider);

    return remindersAsync.when(
      data: (reminders) {
        final today = DateTime.now();
        final todayReminders = reminders.where((r) {
          return r.triggerAt.year == today.year &&
              r.triggerAt.month == today.month &&
              r.triggerAt.day == today.day;
        }).toList();

        if (todayReminders.isEmpty) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildSectionTitle('今日提醒'),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12.0),
                child: Center(child: Text('今天没有提醒')),
              ),
            ],
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSectionTitle('今日提醒'),
            ...todayReminders.map((r) => _buildReminderCard(r)),
          ],
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (e, _) => const SizedBox.shrink(),
    );
  }

  Widget _buildReminderCard(ReminderModel r) {
    final timeText = DateFormat('HH:mm').format(r.triggerAt);
    final isPending = r.status == 'pending';

    return Card(
      child: ListTile(
        leading: Icon(
          isPending ? Icons.notifications_active : Icons.notifications_off,
          color: isPending ? Colors.blue : Colors.grey,
        ),
        title: Text(r.targetTitle ?? r.targetTypeLabel),
        subtitle: Text('预定时间: $timeText · ${r.snoozeCount > 0 ? "已推迟 ${r.snoozeCount} 次" : "未推迟"}'),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isPending)
              PopupMenuButton<int>(
                icon: const Icon(Icons.snooze),
                tooltip: '推迟',
                onSelected: (minutes) => _snoozeReminder(r.id, minutes),
                itemBuilder: (_) => [
                  const PopupMenuItem(value: 15, child: Text('15 分钟后')),
                  const PopupMenuItem(value: 30, child: Text('30 分钟后')),
                  const PopupMenuItem(value: 60, child: Text('1 小时后')),
                ],
              ),
            IconButton(
              icon: const Icon(Icons.clear),
              tooltip: '忽略',
              onPressed: () => _dismissReminder(r.id),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _dismissReminder(String id) async {
    await ref.read(remindersProvider.notifier).dismissReminder(id);
    await ref.read(remindersProvider.notifier).fetchReminders();
  }

  Future<void> _snoozeReminder(String id, int minutes) async {
    await ref.read(remindersProvider.notifier).snoozeReminder(id, minutes);
    await ref.read(remindersProvider.notifier).fetchReminders();
  }

  Widget _buildTopTasks(List<dynamic> tasks) {
    if (tasks.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionTitle('今日最重要的 3 件事'),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24.0),
            child: Center(child: Text('暂无任务')),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('今日最重要的 3 件事'),
        ...tasks.map((t) {
          final title = t['title'] as String? ?? '';
          final energy = t['energyLevel'] as String? ?? 'medium';
          final duration = t['durationMinutes'] as int?;
          final isOverdue = t['isOverdue'] as bool? ?? false;
          final milestone = t['milestoneTitle'] as String?;
          final project = t['projectTitle'] as String?;
          final taskId = t['id'] as String? ?? '';

          return Card(
            child: ListTile(
              leading: Checkbox(
                value: t['status'] == 'done',
                onChanged: t['status'] == 'done'
                    ? null
                    : (_) => _completeTask(taskId),
              ),
              title: Text(title),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('$energy · ${duration ?? '-'} 分钟'),
                  if (milestone != null) Text('里程碑：$milestone', style: const TextStyle(fontSize: 12)),
                  if (project != null) Text('项目：$project', style: const TextStyle(fontSize: 12)),
                ],
              ),
              trailing: isOverdue
                  ? const Icon(Icons.warning, color: Colors.orange)
                  : null,
            ),
          );
        }),
      ],
    );
  }

  Widget _buildHabits(List<dynamic> habits) {
    if (habits.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionTitle('习惯打卡'),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24.0),
            child: Center(child: Text('暂无习惯')),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('习惯打卡'),
        ...habits.map((h) {
          final title = h['title'] as String? ?? '';
          final checked = h['checkedToday'] as bool? ?? false;
          final streak = h['currentStreak'] as int? ?? 0;
          final longest = h['longestStreak'] as int? ?? 0;
          final habitId = h['id'] as String? ?? '';

          return Card(
            child: ListTile(
              leading: Icon(
                checked ? Icons.local_fire_department : Icons.local_fire_department_outlined,
                color: checked ? Colors.orange : Colors.grey,
              ),
              title: Text(title),
              subtitle: Text('连续 $streak 天 · 最长 $longest 天'),
              trailing: ElevatedButton(
                onPressed: checked ? null : () => _checkinHabit(habitId),
                child: Text(checked ? '已打卡' : '打卡'),
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildGoals(List<dynamic> goals) {
    if (goals.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionTitle('目标进度'),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24.0),
            child: Center(child: Text('暂无目标')),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('目标进度'),
        ...goals.map((g) {
          final title = g['title'] as String? ?? '';
          final progress = (g['progress'] as num?)?.toDouble() ?? 0.0;
          final streak = g['currentStreak'] as int? ?? 0;
          final milestones = (g['milestones'] as List<dynamic>?) ?? [];

          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium)),
                      Text('连续 $streak 天'),
                    ],
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: progress,
                    minHeight: 8,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  const SizedBox(height: 4),
                  Text('${(progress * 100).toStringAsFixed(0)}%'),
                  if (milestones.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    const Divider(),
                    ...milestones.map((m) {
                      final mTitle = m['title'] as String? ?? '';
                      final mProgress = (m['progress'] as num?)?.toDouble() ?? 0.0;
                      return Padding(
                        padding: const EdgeInsets.only(top: 4.0),
                        child: Row(
                          children: [
                            Expanded(child: Text(mTitle, style: const TextStyle(fontSize: 12))),
                            Text('${(mProgress * 100).toStringAsFixed(0)}%', style: const TextStyle(fontSize: 12)),
                          ],
                        ),
                      );
                    }),
                  ],
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Text(title, style: Theme.of(context).textTheme.titleLarge),
    );
  }
}
