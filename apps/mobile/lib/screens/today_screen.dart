import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../providers/today_provider.dart';
import '../providers/task_provider.dart';
import '../providers/habit_provider.dart';
import '../providers/reminder_provider.dart';
import '../models/reminder_model.dart';
import '../theme/app_theme.dart';
import '../widgets/app_ui.dart';

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
      ref.read(analyticsServiceProvider).trackEvent('today.view');
    });
  }

  Future<void> _completeTask(String taskId) async {
    final date = DateFormat('yyyy-MM-dd').format(DateTime.now());
    await ref.read(tasksProvider(date).notifier).completeTask(taskId);
    await ref.read(todayProvider.notifier).fetchToday();
    ref.read(analyticsServiceProvider).trackEvent('task.completed', targetId: taskId);
  }

  Future<void> _checkinHabit(String habitId) async {
    await ref.read(habitsProvider.notifier).checkin(habitId);
    await ref.read(todayProvider.notifier).fetchToday();
    ref.read(analyticsServiceProvider).trackEvent('habit.checkin', targetId: habitId);
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

    return AppCard(
      color: AppTheme.primaryColor.withValues(alpha: 0.06),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.insights, color: AppTheme.primaryColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '今日概览',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    Text(
                      '$done / $total 任务 · ${(rate * 100).toStringAsFixed(0)}%',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: const Color(0xFF8B92A8)),
                    ),
                  ],
                ),
              ),
              if (done == total && total > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.successColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle, color: AppTheme.successColor, size: 14),
                      SizedBox(width: 4),
                      Text('完成', style: TextStyle(color: AppTheme.successColor, fontWeight: FontWeight.w600, fontSize: 12)),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: rate.toDouble(),
              minHeight: 10,
              backgroundColor: const Color(0xFFEEF1F6),
              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primaryColor),
            ),
          ),
          if (overdue > 0) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.warning_amber, color: AppTheme.warningColor, size: 18),
                const SizedBox(width: 6),
                Text('有 $overdue 个过期任务', style: const TextStyle(color: AppTheme.warningColor, fontWeight: FontWeight.w500)),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTomorrowPreviewCard() {
    return AppCard(
      onTap: _showTomorrowPreview,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppTheme.secondaryColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.calendar_today, color: AppTheme.secondaryColor),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('明日预览', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                Text('查看 ${_tomorrowDateString()} 的待办任务', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: const Color(0xFF8B92A8))),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: Color(0xFF8B92A8)),
        ],
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
          return const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionHeader(title: '今日提醒', subtitle: '没有即将到来的提醒'),
              AppCard(
                child: EmptyState(
                  icon: Icons.notifications_off_outlined,
                  title: '今天没有提醒',
                ),
              ),
            ],
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(title: '今日提醒', subtitle: '${todayReminders.length} 个提醒'),
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

    return AppCard(
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: (isPending ? AppTheme.primaryColor : const Color(0xFF8B92A8)).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isPending ? Icons.notifications_active : Icons.notifications_off,
              color: isPending ? AppTheme.primaryColor : const Color(0xFF8B92A8),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(r.targetTitle ?? r.targetTypeLabel, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                Text('预定时间: $timeText · ${r.snoozeCount > 0 ? "已推迟 ${r.snoozeCount} 次" : "未推迟"}', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: const Color(0xFF8B92A8))),
              ],
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isPending)
                PopupMenuButton<int>(
                  icon: const Icon(Icons.snooze, color: AppTheme.primaryColor),
                  tooltip: '推迟',
                  onSelected: (minutes) => _snoozeReminder(r.id, minutes),
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 15, child: Text('15 分钟后')),
                    const PopupMenuItem(value: 30, child: Text('30 分钟后')),
                    const PopupMenuItem(value: 60, child: Text('1 小时后')),
                  ],
                ),
              IconButton(
                icon: const Icon(Icons.clear, color: Color(0xFF8B92A8)),
                tooltip: '忽略',
                onPressed: () => _dismissReminder(r.id),
              ),
            ],
          ),
        ],
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
      return const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: '今日最重要的 3 件事', subtitle: '从目标拆解而来'),
          AppCard(
            child: EmptyState(
              icon: Icons.task_alt,
              title: '暂无任务',
              subtitle: '去目标页创建一个目标，让 AI 帮你拆解',
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: '今日最重要的 3 件事', subtitle: '优先完成高精力任务'),
        ...tasks.map((t) {
          final title = t['title'] as String? ?? '';
          final energy = t['energyLevel'] as String? ?? 'medium';
          final duration = t['durationMinutes'] as int?;
          final isOverdue = t['isOverdue'] as bool? ?? false;
          final milestone = t['milestoneTitle'] as String?;
          final project = t['projectTitle'] as String?;
          final taskId = t['id'] as String? ?? '';
          final isDone = t['status'] == 'done';

          return AppCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Transform.scale(
                  scale: 1.15,
                  child: Checkbox(
                    value: isDone,
                    onChanged: isDone ? null : (_) => _completeTask(taskId),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w600,
                              decoration: isDone ? TextDecoration.lineThrough : null,
                              color: isDone ? const Color(0xFF8B92A8) : const Color(0xFF1A1A2E),
                            ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          EnergyChip(level: energy),
                          _metaChip(icon: Icons.timer_outlined, text: '${duration ?? '-'} 分钟'),
                          if (milestone != null) _metaChip(icon: Icons.flag_outlined, text: milestone),
                          if (project != null) _metaChip(icon: Icons.folder_outlined, text: project),
                        ],
                      ),
                    ],
                  ),
                ),
                if (isOverdue)
                  const Padding(
                    padding: EdgeInsets.only(left: 8),
                    child: Icon(Icons.warning, color: AppTheme.warningColor, size: 20),
                  ),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _metaChip({required IconData icon, required String text}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F4F9),
        borderRadius: BorderRadius.circular(AppTheme.chipRadius),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: const Color(0xFF8B92A8)),
          const SizedBox(width: 4),
          Text(text, style: const TextStyle(fontSize: 12, color: Color(0xFF8B92A8))),
        ],
      ),
    );
  }

  Widget _buildHabits(List<dynamic> habits) {
    if (habits.isEmpty) {
      return const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: '习惯打卡', subtitle: '每天一小步'),
          AppCard(
            child: EmptyState(
              icon: Icons.loop,
              title: '暂无习惯',
              subtitle: '建立一个小习惯，持续打卡',
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: '习惯打卡', subtitle: '今天已完成 ${habits.where((h) => h['checkedToday'] == true).length} / ${habits.length}'),
        ...habits.map((h) {
          final title = h['title'] as String? ?? '';
          final checked = h['checkedToday'] as bool? ?? false;
          final streak = h['currentStreak'] as int? ?? 0;
          final habitId = h['id'] as String? ?? '';

          return AppCard(
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: (checked ? AppTheme.warningColor : const Color(0xFFF1F4F9)).withValues(alpha: checked ? 0.16 : 1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    checked ? Icons.local_fire_department : Icons.local_fire_department_outlined,
                    color: checked ? AppTheme.warningColor : const Color(0xFF8B92A8),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                      ),
                      Text(
                        '连续 $streak 天',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: const Color(0xFF8B92A8)),
                      ),
                    ],
                  ),
                ),
                ElevatedButton(
                  onPressed: checked ? null : () => _checkinHabit(habitId),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: checked ? const Color(0xFFF1F4F9) : AppTheme.warningColor,
                    foregroundColor: checked ? const Color(0xFF8B92A8) : Colors.white,
                    disabledBackgroundColor: const Color(0xFFF1F4F9),
                    disabledForegroundColor: const Color(0xFF8B92A8),
                  ),
                  child: Text(checked ? '已打卡' : '打卡'),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _buildGoals(List<dynamic> goals) {
    if (goals.isEmpty) {
      return const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: '目标进度', subtitle: '长期目标拆解为每日行动'),
          AppCard(
            child: EmptyState(
              icon: Icons.flag_outlined,
              title: '暂无目标',
              subtitle: '在 AI 页或目标页创建第一个目标',
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: '目标进度', subtitle: '点击查看详情'),
        ...goals.map((g) {
          final title = g['title'] as String? ?? '';
          final progress = (g['progress'] as num?)?.toDouble() ?? 0.0;
          final streak = g['currentStreak'] as int? ?? 0;
          final milestones = (g['milestones'] as List<dynamic>?) ?? [];

          return AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                      ),
                    ),
                    if (streak > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.warningColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.local_fire_department, color: AppTheme.warningColor, size: 14),
                            const SizedBox(width: 4),
                            Text('$streak', style: const TextStyle(color: AppTheme.warningColor, fontWeight: FontWeight.w700, fontSize: 12)),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 8,
                    backgroundColor: const Color(0xFFEEF1F6),
                    valueColor: AlwaysStoppedAnimation<Color>(progress >= 1 ? AppTheme.successColor : AppTheme.primaryColor),
                  ),
                ),
                const SizedBox(height: 8),
                Text('${(progress * 100).toStringAsFixed(0)}% 完成', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: const Color(0xFF8B92A8))),
                if (milestones.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Divider(height: 1),
                  const SizedBox(height: 12),
                  ...milestones.map((m) {
                    final mTitle = m['title'] as String? ?? '';
                    final mProgress = (m['progress'] as num?)?.toDouble() ?? 0.0;
                    return Padding(
                      padding: const EdgeInsets.only(top: 8.0),
                      child: Row(
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: mProgress >= 1 ? AppTheme.successColor : const Color(0xFFCCD2E3),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(child: Text(mTitle, style: const TextStyle(fontSize: 13, color: Color(0xFF5B6278)))),
                          Text('${(mProgress * 100).toStringAsFixed(0)}%', style: const TextStyle(fontSize: 12, color: Color(0xFF8B92A8), fontWeight: FontWeight.w600)),
                        ],
                      ),
                    );
                  }),
                ],
              ],
            ),
          );
        }),
      ],
    );
  }
}
