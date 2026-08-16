import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/goal_provider.dart';
import '../providers/review_provider.dart';
import 'package:intl/intl.dart';

class ReviewScreen extends ConsumerStatefulWidget {
  const ReviewScreen({super.key});

  @override
  ConsumerState<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends ConsumerState<ReviewScreen> {
  String? _selectedGoalId;
  String _period = 'weekly';
  final _followUpController = TextEditingController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(goalsProvider.notifier).fetchGoals());
  }

  @override
  void dispose() {
    _followUpController.dispose();
    super.dispose();
  }

  Future<void> _generateReview() async {
    if (_selectedGoalId == null) return;
    final endDate = DateFormat('yyyy-MM-dd').format(DateTime.now());
    await ref.read(reviewProvider.notifier).generateReview(
          _selectedGoalId!,
          period: _period,
          endDate: endDate,
        );
  }

  Future<void> _sendFollowUp() async {
    final text = _followUpController.text.trim();
    if (text.isEmpty) return;
    _followUpController.clear();
    await ref.read(reviewProvider.notifier).followUpReview(text);
  }

  @override
  Widget build(BuildContext context) {
    final goalsAsync = ref.watch(goalsProvider);
    final reviewAsync = ref.watch(reviewProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('复盘')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            goalsAsync.when(
              data: (goals) {
                if (goals.isEmpty) {
                  return const Text('暂无目标，请先创建目标');
                }
                return DropdownButtonFormField<String>(
                  initialValue: _selectedGoalId ?? goals.first.id,
                  decoration: const InputDecoration(labelText: '选择目标'),
                  items: goals.map((g) => DropdownMenuItem(
                    value: g.id,
                    child: Text(g.title, overflow: TextOverflow.ellipsis),
                  )).toList(),
                  onChanged: (v) => setState(() => _selectedGoalId = v),
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Text('加载目标失败: $e'),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'daily', label: Text('日复盘')),
                      ButtonSegment(value: 'weekly', label: Text('周复盘')),
                    ],
                    selected: {_period},
                    onSelectionChanged: (set) {
                      if (set.isNotEmpty) {
                        setState(() => _period = set.first);
                      }
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: reviewAsync.isLoading ? null : _generateReview,
                child: reviewAsync.isLoading
                    ? const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          SizedBox(width: 8),
                          Text('AI 生成中…'),
                        ],
                      )
                    : const Text('生成 AI 复盘'),
              ),
            ),
            const SizedBox(height: 24),
            Expanded(
              child: reviewAsync.when(
                data: (review) {
                  if (review == null) {
                    return const Center(child: Text('选择目标后生成复盘'));
                  }
                  return _buildReviewContent(review);
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('生成失败: $e')),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReviewContent(Map<String, dynamic> review) {
    final summary = review['summary'] as String? ?? '';
    final insights = (review['insights'] as List<dynamic>?) ?? [];
    final nextActions = (review['nextActions'] as List<dynamic>?) ?? [];
    final fallback = review['fallback'] == true;
    final error = review['error'] as String?;

    return ListView(
      children: [
        if (fallback) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.orange.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.warning_amber, color: Colors.orange, size: 18),
                    SizedBox(width: 8),
                    Text('当前使用占位复盘', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.orange)),
                  ],
                ),
                if (error != null && error.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(error, style: const TextStyle(fontSize: 12, color: Colors.orange)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('总结', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Text(summary),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (insights.isNotEmpty) ...[
          Text('洞察', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          ...insights.map((i) => Card(
                child: ListTile(
                  dense: true,
                  leading: const Icon(Icons.lightbulb_outline),
                  title: Text(i as String),
                ),
              )),
          const SizedBox(height: 16),
        ],
        if (nextActions.isNotEmpty) ...[
          Text('下一步', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          ...nextActions.map((a) => Card(
                child: ListTile(
                  dense: true,
                  leading: const Icon(Icons.arrow_forward),
                  title: Text(a as String),
                ),
              )),
        ],
        const SizedBox(height: 24),
        _buildFollowUpInput(),
      ],
    );
  }

  Widget _buildFollowUpInput() {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _followUpController,
            decoration: const InputDecoration(
              hintText: '补充问题或调整要求…',
              isDense: true,
              border: OutlineInputBorder(),
            ),
            onSubmitted: (_) => _sendFollowUp(),
          ),
        ),
        const SizedBox(width: 8),
        Consumer(builder: (context, ref, _) {
          final isLoading = ref.watch(reviewProvider).isLoading;
          return IconButton(
            onPressed: isLoading ? null : _sendFollowUp,
            icon: isLoading
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.send),
          );
        }),
      ],
    );
  }
}
