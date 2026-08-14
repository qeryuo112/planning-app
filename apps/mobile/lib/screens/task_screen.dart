import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../models/task_model.dart';
import '../providers/task_provider.dart';

class TaskScreen extends ConsumerStatefulWidget {
  const TaskScreen({super.key});

  @override
  ConsumerState<TaskScreen> createState() => _TaskScreenState();
}

class _TaskScreenState extends ConsumerState<TaskScreen> {
  String _statusFilter = 'all';
  String _energyFilter = 'all';
  String _dateFilter = 'all';
  String _sortBy = 'createdAt_desc';

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(tasksProvider(null).notifier).fetchTasks());
  }

  Future<void> _showPostponeDialog(TaskModel task) async {
    final dateController = TextEditingController(
      text: task.scheduledDate != null
          ? DateFormat('yyyy-MM-dd').format(task.scheduledDate!)
          : DateFormat('yyyy-MM-dd').format(DateTime.now()),
    );
    final reasonController = TextEditingController();

    if (!mounted) return;
    await showDialog(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('延期任务'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: dateController,
                decoration: const InputDecoration(labelText: '重新排期 (yyyy-MM-dd)'),
              ),
              TextField(
                controller: reasonController,
                decoration: const InputDecoration(labelText: '原因（可选）'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('取消'),
            ),
            TextButton(
              onPressed: () async {
                final date = DateTime.tryParse(dateController.text);
                if (date == null) return;
                final notifier = ref.read(tasksProvider(null).notifier);
                await notifier.postponeTask(
                  task.id,
                  newScheduledDate: dateController.text,
                  reason: reasonController.text.isEmpty ? null : reasonController.text,
                );
                if (dialogContext.mounted) Navigator.of(dialogContext).pop();
              },
              child: const Text('确认延期'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _createTask(String title) async {
    final date = DateFormat('yyyy-MM-dd').format(DateTime.now());
    await ref.read(tasksProvider(null).notifier).createTask(
          title,
          scheduledDate: date,
        );
    if (!mounted) return;
    Navigator.of(context).pop();
  }

  Future<void> _showCreateDialog() async {
    final titleController = TextEditingController();

    if (!mounted) return;
    await showDialog(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('创建任务'),
          content: TextField(
            controller: titleController,
            decoration: const InputDecoration(labelText: '任务名称'),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('取消'),
            ),
            TextButton(
              onPressed: () => _createTask(titleController.text),
              child: const Text('创建'),
            ),
          ],
        );
      },
    );
  }

  List<TaskModel> _applyFilterAndSort(List<TaskModel> tasks) {
    final filtered = tasks.where((task) {
      if (_statusFilter != 'all' && task.status != _statusFilter) return false;
      if (_energyFilter != 'all' && task.energyLevel != _energyFilter) return false;
      if (_dateFilter != 'all' && task.scheduledDate != null) {
        final now = DateTime.now();
        final today = DateTime(now.year, now.month, now.day);
        final date = DateTime(task.scheduledDate!.year, task.scheduledDate!.month, task.scheduledDate!.day);
        if (_dateFilter == 'today' && date != today) return false;
        if (_dateFilter == 'week') {
          final weekEnd = today.add(const Duration(days: 7));
          if (date.isBefore(today) || date.isAfter(weekEnd)) return false;
        }
        if (_dateFilter == 'overdue' && !date.isBefore(today)) return false;
      }
      return true;
    }).toList();

    filtered.sort((a, b) {
      switch (_sortBy) {
        case 'createdAt_desc':
          return b.id.compareTo(a.id);
        case 'createdAt_asc':
          return a.id.compareTo(b.id);
        case 'date_asc':
          final aDate = a.scheduledDate ?? DateTime(9999);
          final bDate = b.scheduledDate ?? DateTime(9999);
          return aDate.compareTo(bDate);
        case 'date_desc':
          final aDate = a.scheduledDate ?? DateTime(0);
          final bDate = b.scheduledDate ?? DateTime(0);
          return bDate.compareTo(aDate);
        case 'energy_desc':
          final order = {'high': 3, 'medium': 2, 'low': 1};
          return (order[b.energyLevel] ?? 0).compareTo(order[a.energyLevel] ?? 0);
        default:
          return 0;
      }
    });

    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final tasksAsync = ref.watch(tasksProvider(null));

    return Scaffold(
      appBar: AppBar(
        title: const Text('任务'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: _showFilterSheet,
          ),
        ],
      ),
      body: tasksAsync.when(
        data: (tasks) {
          final displayTasks = _applyFilterAndSort(tasks);
          if (displayTasks.isEmpty) {
            return const Center(child: Text('没有符合条件的任务'));
          }
          return ListView.builder(
            itemCount: displayTasks.length,
            itemBuilder: (_, index) {
              final task = displayTasks[index];
              return ListTile(
                title: Text(
                  task.title,
                  style: TextStyle(
                    decoration: task.isDone ? TextDecoration.lineThrough : null,
                  ),
                ),
                subtitle: Text('${task.energyLevel} · ${task.status} · ${_formatDate(task.scheduledDate)}'),
                trailing: _buildTaskActions(task),
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

  String _formatDate(DateTime? date) {
    if (date == null) return '未排期';
    return DateFormat('MM-dd').format(date);
  }

  Widget _buildTaskActions(TaskModel task) {
    final notifier = ref.read(tasksProvider(null).notifier);
    if (task.isDone) {
      return const Icon(Icons.check_circle, color: Colors.green);
    }
    if (task.status == 'skipped') {
      return IconButton(
        icon: const Icon(Icons.replay, color: Colors.blue),
        tooltip: '补打卡',
        onPressed: () => notifier.makeupTask(task.id),
      );
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          icon: const Icon(Icons.schedule, color: Colors.orange),
          tooltip: '延期',
          onPressed: () => _showPostponeDialog(task),
        ),
        IconButton(
          icon: const Icon(Icons.check_circle_outline, color: Colors.green),
          tooltip: '完成',
          onPressed: () => notifier.completeTask(task.id),
        ),
      ],
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
                    initialValue: _statusFilter,
                    decoration: const InputDecoration(labelText: '状态'),
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('全部')),
                      DropdownMenuItem(value: 'todo', child: Text('待办')),
                      DropdownMenuItem(value: 'done', child: Text('已完成')),
                      DropdownMenuItem(value: 'skipped', child: Text('已跳过')),
                    ],
                    onChanged: (v) => setSheetState(() => _statusFilter = v ?? 'all'),
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
                    initialValue: _dateFilter,
                    decoration: const InputDecoration(labelText: '日期'),
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('全部')),
                      DropdownMenuItem(value: 'today', child: Text('今天')),
                      DropdownMenuItem(value: 'week', child: Text('未来 7 天')),
                      DropdownMenuItem(value: 'overdue', child: Text('已逾期')),
                    ],
                    onChanged: (v) => setSheetState(() => _dateFilter = v ?? 'all'),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _sortBy,
                    decoration: const InputDecoration(labelText: '排序'),
                    items: const [
                      DropdownMenuItem(value: 'createdAt_desc', child: Text('创建时间（新→旧）')),
                      DropdownMenuItem(value: 'createdAt_asc', child: Text('创建时间（旧→新）')),
                      DropdownMenuItem(value: 'date_asc', child: Text('日期（近→远）')),
                      DropdownMenuItem(value: 'date_desc', child: Text('日期（远→近）')),
                      DropdownMenuItem(value: 'energy_desc', child: Text('能量等级（高→低）')),
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
