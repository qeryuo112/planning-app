import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/goal_provider.dart';
import '../providers/social_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/app_ui.dart';
import 'ai_plan_draft_screen.dart';

class GoalScreen extends ConsumerStatefulWidget {
  const GoalScreen({super.key});

  @override
  ConsumerState<GoalScreen> createState() => _GoalScreenState();
}

class _GoalScreenState extends ConsumerState<GoalScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(goalsProvider.notifier).fetchGoals());
  }

  Future<void> _createGoal(String title, String horizon) async {
    await ref.read(goalsProvider.notifier).createGoal(title, horizon);
    if (!mounted) return;
    Navigator.of(context).pop();
  }

  Future<void> _showCreateDialog() async {
    final titleController = TextEditingController();
    String horizon = 'short';

    if (!mounted) return;
    await showDialog(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('创建目标'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: titleController,
                    decoration: const InputDecoration(labelText: '目标名称'),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: horizon,
                    decoration: const InputDecoration(labelText: '目标周期'),
                    items: const [
                      DropdownMenuItem(value: 'short', child: Text('短期')),
                      DropdownMenuItem(value: 'medium', child: Text('中期')),
                      DropdownMenuItem(value: 'long', child: Text('长期')),
                    ],
                    onChanged: (value) => setState(() => horizon = value!),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('取消'),
                ),
                TextButton(
                  onPressed: () => _createGoal(titleController.text, horizon),
                  child: const Text('创建'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _deleteGoal(String goalId, String title) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('删除目标：$title'),
        content: const Text('确认删除该目标及其关联的项目、任务、习惯、打卡与计划版本？此操作不可撤销。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('删除', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    final ok = await ref.read(goalsProvider.notifier).deleteGoal(goalId);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ok ? '目标已删除' : '删除失败')),
      );
    }
  }
  Future<void> _shareGoal(String goalId, String title) async {
    final emailController = TextEditingController();
    await showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('共享目标：$title'),
        content: TextField(
          controller: emailController,
          decoration: const InputDecoration(labelText: '对方邮箱'),
          keyboardType: TextInputType.emailAddress,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () async {
              final email = emailController.text.trim();
              if (email.isEmpty) return;
              Navigator.of(dialogContext).pop();
              final notifier = ref.read(socialProvider.notifier);
              final res = await notifier.shareGoal(goalId, email);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(res != null ? '共享成功' : '共享失败')),
                );
              }
            },
            child: const Text('发送'),
          ),
        ],
      ),
    );
  }

  Future<void> _showGoalStats(String goalId) async {
    final stats = await ref.read(goalsProvider.notifier).stats(goalId);
    if (!mounted) return;
    await showDialog(
      context: context,
      builder: (dialogContext) {
        final progress = (stats['progress'] as num?)?.toDouble() ?? 0.0;
        final streak = stats['currentStreak'] as int? ?? 0;
        final milestones = (stats['milestones'] as List<dynamic>?) ?? [];

        return AlertDialog(
          title: const Text('目标进度'),
          content: SizedBox(
            width: double.maxFinite,
            child: ListView(
              shrinkWrap: true,
              children: [
                LinearProgressIndicator(
                  value: progress,
                  minHeight: 12,
                  borderRadius: BorderRadius.circular(6),
                ),
                const SizedBox(height: 8),
                Text('${(progress * 100).toStringAsFixed(0)}% · 连续 $streak 天'),
                if (milestones.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Text('里程碑', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  ...milestones.map((m) {
                    final mTitle = m['title'] as String? ?? '';
                    final mProgress = (m['progress'] as num?)?.toDouble() ?? 0.0;
                    return ListTile(
                      dense: true,
                      leading: Icon(
                        mProgress >= 1 ? Icons.check_circle : Icons.radio_button_unchecked,
                        color: mProgress >= 1 ? Colors.green : Colors.grey,
                      ),
                      title: Text(mTitle, style: const TextStyle(fontSize: 14)),
                      trailing: Text('${(mProgress * 100).toStringAsFixed(0)}%'),
                    );
                  }),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('关闭'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final goalsAsync = ref.watch(goalsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('目标')),
      body: goalsAsync.when(
        data: (goals) {
          if (goals.isEmpty) {
            return const Center(
              child: EmptyState(
                icon: Icons.flag_outlined,
                title: '暂无目标',
                subtitle: '点击右下角创建第一个目标',
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(AppTheme.pagePadding),
            itemCount: goals.length,
            itemBuilder: (_, index) {
              final goal = goals[index];
              return AppCard(
                onTap: () => _showGoalStats(goal.id),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppTheme.primaryColor.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.flag, color: AppTheme.primaryColor),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                goal.title,
                                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 2),
                              _GoalStatsSubtitle(goalId: goal.id),
                            ],
                          ),
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.share, color: Color(0xFF8B92A8)),
                              tooltip: '共享目标',
                              onPressed: () => _shareGoal(goal.id, goal.title),
                            ),
                            IconButton(
                              icon: const Icon(Icons.auto_awesome, color: AppTheme.secondaryColor),
                              tooltip: 'AI 规划',
                              onPressed: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => AiPlanDraftScreen(goalId: goal.id),
                                ),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, color: AppTheme.errorColor),
                              tooltip: '删除目标',
                              onPressed: () => _deleteGoal(goal.id, goal.title),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F4F9),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        goal.status,
                        style: const TextStyle(fontSize: 12, color: Color(0xFF5B6278), fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('加载失败: $e')),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreateDialog,
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _GoalStatsSubtitle extends ConsumerWidget {
  final String goalId;

  const _GoalStatsSubtitle({required this.goalId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsFuture = ref.read(goalsProvider.notifier).stats(goalId);

    return FutureBuilder<Map<String, dynamic>>(
      future: statsFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Text('加载中...', style: TextStyle(fontSize: 12, color: Color(0xFF8B92A8)));
        }
        if (snapshot.hasError || !snapshot.hasData || snapshot.data!.isEmpty) {
          return const Text('');
        }
        final data = snapshot.data!;
        final progress = (data['progress'] as num?)?.toDouble() ?? 0.0;
        final streak = data['currentStreak'] as int? ?? 0;
        final milestones = (data['milestones'] as List<dynamic>?) ?? [];

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 4,
                backgroundColor: const Color(0xFFEEF1F6),
                valueColor: AlwaysStoppedAnimation<Color>(progress >= 1 ? AppTheme.successColor : AppTheme.primaryColor),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '${(progress * 100).toStringAsFixed(0)}% · 连续 $streak 天 · ${milestones.length} 个里程碑',
              style: const TextStyle(fontSize: 12, color: Color(0xFF8B92A8)),
            ),
          ],
        );
      },
    );
  }
}
