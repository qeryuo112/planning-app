import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/habit_model.dart';
import '../providers/auth_provider.dart';

class HabitDetailScreen extends ConsumerStatefulWidget {
  final HabitModel habit;

  const HabitDetailScreen({super.key, required this.habit});

  @override
  ConsumerState<HabitDetailScreen> createState() => _HabitDetailScreenState();
}

class _HabitDetailScreenState extends ConsumerState<HabitDetailScreen> {
  int _days = 30;
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _stats;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => _loadStats(_days));
  }

  Future<void> _loadStats(int days) async {
    setState(() {
      _days = days;
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.get('/habits/${widget.habit.id}/stats?days=$days') as Map<String, dynamic>;
      setState(() {
        _stats = res;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = '加载统计失败: $e';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final habit = widget.habit;
    final heatmap = _stats?['heatmap'] as List<dynamic>?;
    final completionRate = ((_stats?['completionRate'] as num?) ?? 0.0).toDouble();
    final currentStreak = (_stats?['currentStreak'] as int?) ?? 0;
    final longestStreak = (_stats?['longestStreak'] as int?) ?? 0;
    final doneCount = (_stats?['doneCount'] as int?) ?? 0;

    return Scaffold(
      appBar: AppBar(title: Text(habit.title)),
      body: RefreshIndicator(
        onRefresh: () => _loadStats(_days),
        child: ListView(
          padding: const EdgeInsets.all(16.0),
          children: [
            _buildInfoCard(habit),
            const SizedBox(height: 16),
            _buildPeriodSelector(),
            const SizedBox(height: 16),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_error != null)
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))
            else ...[
              _buildStatSummary(completionRate, currentStreak, longestStreak, doneCount),
              const SizedBox(height: 16),
              _buildHeatmap(heatmap ?? []),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildInfoCard(HabitModel habit) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(habit.title, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text('频率: ${habit.frequency}'),
            if (habit.preferredTime != null) Text('偏好时间: ${habit.preferredTime}'),
            if (habit.minimumStandard != null) Text('最低标准: ${habit.minimumStandard}'),
          ],
        ),
      ),
    );
  }

  Widget _buildPeriodSelector() {
    return SegmentedButton<int>(
      segments: const [
        ButtonSegment(value: 7, label: Text('7 天')),
        ButtonSegment(value: 30, label: Text('30 天')),
      ],
      selected: {_days},
      onSelectionChanged: (value) {
        if (value.isNotEmpty) {
          _loadStats(value.first);
        }
      },
    );
  }

  Widget _buildStatSummary(double completionRate, int currentStreak, int longestStreak, int doneCount) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('统计概览', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildStatItem('完成率', '${(completionRate * 100).toStringAsFixed(1)}%'),
                _buildStatItem('当前连续', '$currentStreak 天'),
                _buildStatItem('最长连续', '$longestStreak 天'),
                _buildStatItem('完成天数', '$doneCount 天'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Column(
      children: [
        Text(value, style: Theme.of(context).textTheme.titleLarge),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }

  Widget _buildHeatmap(List<dynamic> heatmap) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('打卡热力图', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: heatmap.map((day) {
                final status = (day['status'] as String?) ?? 'none';
                final date = (day['date'] as String?) ?? '';
                return Tooltip(
                  message: '$date: ${_statusText(status)}',
                  child: Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: _statusColor(status),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'done':
        return Colors.green;
      case 'skipped':
        return Colors.orange;
      default:
        return Colors.grey.shade300;
    }
  }

  String _statusText(String status) {
    switch (status) {
      case 'done':
        return '已完成';
      case 'skipped':
        return '跳过';
      default:
        return '未打卡';
    }
  }
}
