import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/habit_provider.dart';
import '../screens/habit_detail_screen.dart';

class HabitScreen extends ConsumerStatefulWidget {
  const HabitScreen({super.key});

  @override
  ConsumerState<HabitScreen> createState() => _HabitScreenState();
}

class _HabitScreenState extends ConsumerState<HabitScreen> {
  String _frequencyFilter = 'all';
  String _energyFilter = 'all';
  String _sortBy = 'createdAt_desc';

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(habitsProvider.notifier).fetchHabits());
  }

  Future<void> _createHabit(String title, String frequency, String energyLevel) async {
    await ref.read(habitsProvider.notifier).createHabit(title, frequency);
    if (!mounted) return;
    Navigator.of(context).pop();
  }

  Future<void> _showCreateDialog() async {
    final titleController = TextEditingController();
    String frequency = 'daily';
    String energyLevel = 'medium';

    if (!mounted) return;
    await showDialog(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('创建习惯'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: titleController,
                    decoration: const InputDecoration(labelText: '习惯名称'),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: frequency,
                    decoration: const InputDecoration(labelText: '频率'),
                    items: const [
                      DropdownMenuItem(value: 'daily', child: Text('每天')),
                      DropdownMenuItem(value: 'weekly', child: Text('每周')),
                      DropdownMenuItem(value: 'weekdays', child: Text('工作日')),
                    ],
                    onChanged: (value) => setState(() => frequency = value!),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: energyLevel,
                    decoration: const InputDecoration(labelText: '能量等级'),
                    items: const [
                      DropdownMenuItem(value: 'high', child: Text('高')),
                      DropdownMenuItem(value: 'medium', child: Text('中')),
                      DropdownMenuItem(value: 'low', child: Text('低')),
                    ],
                    onChanged: (value) => setState(() => energyLevel = value!),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('取消'),
                ),
                TextButton(
                  onPressed: () => _createHabit(titleController.text, frequency, energyLevel),
                  child: const Text('创建'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  List<dynamic> _applyFilterAndSort(List<dynamic> habits) {
    final filtered = habits.where((habit) {
      if (_frequencyFilter != 'all' && habit.frequency != _frequencyFilter) return false;
      if (_energyFilter != 'all' && habit.energyLevel != _energyFilter) return false;
      return true;
    }).toList();

    filtered.sort((a, b) {
      switch (_sortBy) {
        case 'createdAt_desc':
          return b.id.compareTo(a.id);
        case 'createdAt_asc':
          return a.id.compareTo(b.id);
        case 'title_asc':
          return a.title.toLowerCase().compareTo(b.title.toLowerCase());
        case 'title_desc':
          return b.title.toLowerCase().compareTo(a.title.toLowerCase());
        default:
          return 0;
      }
    });

    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final habitsAsync = ref.watch(habitsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('习惯'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: _showFilterSheet,
          ),
        ],
      ),
      body: habitsAsync.when(
        data: (habits) {
          final displayHabits = _applyFilterAndSort(habits);
          if (displayHabits.isEmpty) {
            return const Center(child: Text('没有符合条件的习惯'));
          }
          return ListView.builder(
            itemCount: displayHabits.length,
            itemBuilder: (_, index) {
              final habit = displayHabits[index];
              return ListTile(
                title: Text(habit.title),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${habit.frequency} · 能量 ${habit.energyLevel}'),
                    _HabitStreakSubtitle(habitId: habit.id),
                  ],
                ),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => HabitDetailScreen(habit: habit),
                  ),
                ),
                trailing: ElevatedButton(
                  onPressed: () => ref.read(habitsProvider.notifier).checkin(habit.id),
                  child: const Text('打卡'),
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

  void _showFilterSheet() {
    showModalBottomSheet(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('筛选与排序', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: _frequencyFilter,
                    decoration: const InputDecoration(labelText: '频率'),
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('全部')),
                      DropdownMenuItem(value: 'daily', child: Text('每天')),
                      DropdownMenuItem(value: 'weekly', child: Text('每周')),
                      DropdownMenuItem(value: 'weekdays', child: Text('工作日')),
                    ],
                    onChanged: (v) => setSheetState(() => _frequencyFilter = v ?? 'all'),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _energyFilter,
                    decoration: const InputDecoration(labelText: '能量等级'),
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('全部')),
                      DropdownMenuItem(value: 'high', child: Text('高')),
                      DropdownMenuItem(value: 'medium', child: Text('中')),
                      DropdownMenuItem(value: 'low', child: Text('低')),
                    ],
                    onChanged: (v) => setSheetState(() => _energyFilter = v ?? 'all'),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _sortBy,
                    decoration: const InputDecoration(labelText: '排序'),
                    items: const [
                      DropdownMenuItem(value: 'createdAt_desc', child: Text('创建时间（新→旧）')),
                      DropdownMenuItem(value: 'createdAt_asc', child: Text('创建时间（旧→新）')),
                      DropdownMenuItem(value: 'title_asc', child: Text('标题（A→Z）')),
                      DropdownMenuItem(value: 'title_desc', child: Text('标题（Z→A）')),
                    ],
                    onChanged: (v) => setSheetState(() => _sortBy = v ?? 'createdAt_desc'),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        setState(() {});
                        Navigator.of(context).pop();
                      },
                      child: const Text('应用'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _HabitStreakSubtitle extends ConsumerWidget {
  final String habitId;

  const _HabitStreakSubtitle({required this.habitId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsFuture = ref.read(habitsProvider.notifier).stats(habitId);

    return FutureBuilder<Map<String, dynamic>>(
      future: statsFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Text('加载中...', style: TextStyle(fontSize: 12));
        }
        if (snapshot.hasError || !snapshot.hasData || snapshot.data!.isEmpty) {
          return const Text('');
        }
        final data = snapshot.data!;
        final streak = data['currentStreak'] as int? ?? 0;
        final longest = data['longestStreak'] as int? ?? 0;
        return Text('连续 $streak 天 · 最长 $longest 天');
      },
    );
  }
}
