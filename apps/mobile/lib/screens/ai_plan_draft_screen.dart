import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/ai_provider.dart';
import '../providers/auth_provider.dart';

class AiPlanDraftScreen extends ConsumerStatefulWidget {
  final String? goalId;

  const AiPlanDraftScreen({super.key, this.goalId});

  @override
  ConsumerState<AiPlanDraftScreen> createState() => _AiPlanDraftScreenState();
}

class _AiPlanDraftScreenState extends ConsumerState<AiPlanDraftScreen> {
  final _inputController = TextEditingController(
    text: '我想3个月通过英语四级，每天40分钟',
  );
  final _followUpController = TextEditingController();
  final _planDurationController = TextEditingController(text: '30');
  final _stageLengthController = TextEditingController(text: '7');
  String? _selectedFeedback;
  bool _approving = false;
  int get _planDuration => int.tryParse(_planDurationController.text) ?? 30;
  int get _stageLength => int.tryParse(_stageLengthController.text) ?? 7;
  bool _advancing = false;
  bool _deleting = false;
  bool _isStreaming = false;
  String? _progressMessage;
  List<dynamic> _templates = [];
  String? _selectedTemplateId;
  Map<String, dynamic>? _usage;
  bool _loadingTemplates = true;
  Map<String, dynamic>? _recommendedTemplate;
  String? _sessionId;
  bool _showFollowUp = false;
  final List<Map<String, dynamic>> _messages = [];

  @override
  void initState() {
    super.initState();
    _loadTemplates();
    _loadUsage();
  }

  Future<void> _loadTemplates() async {
    final templates = await ref.read(aiDraftProvider.notifier).fetchTemplates();
    if (mounted) {
      setState(() {
        _templates = templates;
        _loadingTemplates = false;
      });
    }
  }

  Future<void> _loadUsage() async {
    final usage = await ref.read(aiDraftProvider.notifier).fetchUsage();
    if (mounted) {
      setState(() => _usage = usage);
    }
  }

  Future<void> _recommendTemplate() async {
    final input = _inputController.text;
    if (input.trim().isEmpty) return;
    final recommendation = await ref
        .read(aiDraftProvider.notifier)
        .recommendTemplate(input);
    if (mounted) {
      setState(() => _recommendedTemplate = recommendation);
    }
  }

  Future<void> _generate({String? followUp}) async {
    _selectedFeedback = null;
    setState(() {
      _isStreaming = true;
      _progressMessage = '正在连接 AI…';
      if (followUp != null) {
        _messages.add({'role': 'user', 'content': followUp});
      }
    });

    try {
      final stream = ref.read(aiDraftProvider.notifier).createDraftStream(
            followUp ?? _inputController.text,
            goalId: widget.goalId,
            templateId: _selectedTemplateId,
            planDuration: _planDuration,
            stageLength: _stageLength,
            sessionId: _sessionId,
            followUp: followUp,
          );

      await for (final event in stream) {
        if (!mounted) return;
        switch (event) {
          case AiDraftProgressEvent():
            setState(() => _progressMessage = event.message ?? 'AI 生成中…');
          case AiDraftResultEvent():
            setState(() {
              _isStreaming = false;
              _progressMessage = null;
              _sessionId = event.draft['sessionId'] as String?;
              _showFollowUp = true;
              _messages.add({
                'role': 'assistant',
                'content': event.draft['plan']?['goal']?['title'] ?? '已生成计划草案',
              });
            });
            await _loadUsage();
          case AiDraftDoneEvent():
            setState(() {
              _isStreaming = false;
              _progressMessage = null;
            });
          case AiDraftErrorEvent():
            setState(() {
              _isStreaming = false;
              _progressMessage = null;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('生成失败: ${event.error}')),
            );
        }
      }
      _trackDraftGenerated(followUp != null);
    } catch (e) {
      if (mounted) {
        setState(() {
          _isStreaming = false;
          _progressMessage = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('生成失败: $e')),
        );
      }
    }
  }

  @override
  void dispose() {
    _inputController.dispose();
    _followUpController.dispose();
    _planDurationController.dispose();
    _stageLengthController.dispose();
    super.dispose();
  }

  bool _isDurationValid() {
    final planDuration = int.tryParse(_planDurationController.text);
    final stageLength = int.tryParse(_stageLengthController.text);
    if (planDuration == null || stageLength == null) return false;
    if (planDuration < 1 || planDuration > 365) return false;
    if (stageLength < 1 || stageLength > 365) return false;
    if (stageLength > planDuration) return false;
    return true;
  }

  void _trackDraftGenerated(bool isFollowUp) {
    final analytics = ref.read(analyticsServiceProvider);
    final draft = ref.read(aiDraftProvider).value;
    analytics.trackEvent(
      isFollowUp ? 'ai.draft.follow_up_generated' : 'ai.draft.generated',
      targetId: draft?['draftId'] as String?,
      metadata: {
        'fallback': draft?['fallback'] == true,
        'sessionId': _sessionId,
      },
    );
  }

  Future<void> _sendFollowUp() async {
    final text = _followUpController.text.trim();
    if (text.isEmpty) return;
    _followUpController.clear();
    await _generate(followUp: text);
  }

  Future<void> _advance(String draftId) async {
    setState(() => _advancing = true);
    try {
      final advanced = await ref.read(aiDraftProvider.notifier).advanceStage(draftId);
      if (advanced != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('已进入第 ${advanced['plan']?['currentStage'] ?? '?'} 阶段')),
        );
      }
    } finally {
      if (mounted) setState(() => _advancing = false);
    }
  }

  Future<void> _approve(String draftId) async {
    setState(() => _approving = true);
    try {
      final approved = await ref.read(aiDraftProvider.notifier).approveDraft(
            draftId,
            feedback: _selectedFeedback,
          );
      if (approved != null && mounted) {
        ref.read(analyticsServiceProvider).trackEvent('ai.draft.approved', targetId: draftId);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('计划已确认，请切换到「今日」页查看任务')),
        );
      }
    } finally {
      if (mounted) setState(() => _approving = false);
    }
  }

  Future<void> _delete(String draftId) async {
    setState(() => _deleting = true);
    try {
      final deleted = await ref.read(aiDraftProvider.notifier).deleteApprovedDraft(draftId);
      if (deleted != null && mounted) {
        ref.read(analyticsServiceProvider).trackEvent('ai.draft.deleted', targetId: draftId);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('计划已删除并清空数据')),
        );
      }
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final draftAsync = ref.watch(aiDraftProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('AI 生成计划')),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_usage != null) _buildUsageCard(),
              const SizedBox(height: 12),
            TextField(
              controller: _inputController,
              decoration: const InputDecoration(
                labelText: '描述你的目标',
                hintText: '例如：我想3个月通过英语四级，每天40分钟',
              ),
              maxLines: 3,
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: _recommendTemplate,
                icon: const Icon(Icons.auto_awesome, size: 18),
                label: const Text('帮我推荐模板'),
              ),
            ),
            _buildRecommendationBanner(),
            _buildTemplateChips(),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _planDurationController,
                    decoration: const InputDecoration(
                      labelText: '计划总时长（天）',
                      hintText: '例如 30',
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _stageLengthController,
                    decoration: const InputDecoration(
                      labelText: '每阶段长度（天）',
                      hintText: '例如 7',
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ],
            ),
            if (!_isDurationValid()) ...[
              const SizedBox(height: 8),
              Text(
                '阶段时长不能大于计划总时长，且两者都应为 1~365 的正整数',
                style: TextStyle(
                  fontSize: 12,
                  color: Theme.of(context).colorScheme.error,
                ),
              ),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: (_isStreaming || draftAsync.isLoading || !_isDurationValid()) ? null : _generate,
                child: _isStreaming
                    ? const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          SizedBox(width: 8),
                          Text('AI 流式生成中…'),
                        ],
                      )
                    : const Text('生成计划草案'),
              ),
            ),
            if (_isStreaming && _progressMessage != null) ...[
              const SizedBox(height: 16),
              LinearProgressIndicator(
                borderRadius: BorderRadius.circular(4),
              ),
              const SizedBox(height: 8),
              Text(
                _progressMessage!,
                style: TextStyle(
                  fontSize: 13,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
            ],
            if (_showFollowUp) ...[
              const SizedBox(height: 16),
              ..._buildConversationThread(),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _followUpController,
                      decoration: const InputDecoration(
                        hintText: '继续补充或调整要求…',
                        isDense: true,
                        border: OutlineInputBorder(),
                      ),
                      onSubmitted: (_) => _sendFollowUp(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: _isStreaming ? null : _sendFollowUp,
                    icon: _isStreaming
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 24),
            _buildDraftPreviewArea(draftAsync),
          ],
        ),
      ),
      ),
    );
  }

  Widget _buildDraftPreviewArea(AsyncValue<Map<String, dynamic>?> draftAsync) {
    return draftAsync.when(
      data: (draft) {
        if (draft == null) {
          return const Center(child: Text('输入目标后点击生成'));
        }
        final plan = draft['plan'] as Map<String, dynamic>?;
        if (plan == null) {
          return const Center(child: Text('暂无草案内容'));
        }
        final goalTitle = plan['goal']?['title'] as String?;
        final draftId = draft['draftId'] as String?;
        final currentStage = plan['currentStage'] as int? ?? 1;
        final totalStages = plan['totalStages'] as int? ?? 1;
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  goalTitle ?? '已生成计划草案',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  '阶段 $currentStage / $totalStages · 点击预览详情并确认落库',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => _showPlanDialog(draft),
                        icon: const Icon(Icons.preview, size: 18),
                        label: const Text('查看计划详情'),
                      ),
                    ),
                  ],
                ),
                if (draftId != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    '草案 ID: $draftId',
                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                ],
              ],
            ),
          ),
        );
      },
      loading: () => _isStreaming
          ? const SizedBox.shrink()
          : const Center(child: CircularProgressIndicator()),
      error: (e, _) => Text('生成失败: $e'),
    );
  }

  void _showPlanDialog(Map<String, dynamic> draft) {
    final plan = draft['plan'] as Map<String, dynamic>?;
    if (plan == null) return;

    showDialog(
      context: context,
      builder: (dialogContext) => _buildPlanDialog(dialogContext, draft),
    );
  }

  Widget _buildPlanDialog(BuildContext dialogContext, Map<String, dynamic> draft) {
    final plan = draft['plan'] as Map<String, dynamic>;
    final draftId = draft['draftId'] as String?;
    final currentStage = plan['currentStage'] as int? ?? 1;
    final totalStages = plan['totalStages'] as int? ?? 1;

    return StatefulBuilder(
      builder: (context, setDialogState) {
        return AlertDialog(
          title: const Text('计划详情'),
          contentPadding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          content: SizedBox(
            width: double.maxFinite,
            height: MediaQuery.of(context).size.height * 0.65,
            child: _buildPlanContent(draft, onRefresh: () => setDialogState(() {})),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('关闭'),
            ),
            if (currentStage < totalStages)
              TextButton(
                onPressed: (_advancing || draftId == null)
                    ? null
                    : () async {
                        Navigator.of(dialogContext).pop();
                        await _advance(draftId);
                      },
                child: _advancing
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('进入下一阶段'),
              ),
            TextButton(
              onPressed: (_deleting || draftId == null)
                  ? null
                  : () async {
                      final nav = Navigator.of(dialogContext);
                      final confirmed = await showDialog<bool>(
                        context: dialogContext,
                        builder: (ctx) => AlertDialog(
                          title: const Text('删除计划'),
                          content: const Text('确认删除该计划及其已落库数据？此操作不可撤销。'),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.of(ctx).pop(false),
                              child: const Text('取消'),
                            ),
                            TextButton(
                              onPressed: () => Navigator.of(ctx).pop(true),
                              child: const Text('删除', style: TextStyle(color: Colors.red)),
                            ),
                          ],
                        ),
                      );
                      if (confirmed == true) {
                        nav.pop();
                        await _delete(draftId);
                      }
                    },
              child: _deleting
                  ? const SizedBox(
                      height: 16,
                      width: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('删除计划', style: TextStyle(color: Colors.red)),
            ),
            TextButton(
              onPressed: (_approving || draftId == null)
                  ? null
                  : () async {
                      Navigator.of(dialogContext).pop();
                      await _approve(draftId);
                    },
              child: _approving
                  ? const SizedBox(
                      height: 16,
                      width: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('确认落库'),
            ),
          ],
        );
      },
    );
  }

  Widget _buildUsageCard() {
    final dailyCost = (_usage?['dailyCost'] as num?)?.toDouble() ?? 0.0;
    final dailyLimit = (_usage?['dailyLimit'] as num?)?.toDouble() ?? 1.0;
    final callCount = (_usage?['callCount'] as num?)?.toInt() ?? 0;
    final percent = dailyLimit > 0 ? (dailyCost / dailyLimit).clamp(0.0, 1.0) : 0.0;
    final color = percent > 0.8 ? Colors.red : (percent > 0.5 ? Colors.orange : Colors.green);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.trending_up, color: color, size: 20),
                const SizedBox(width: 8),
                Text('AI 今日用量', style: Theme.of(context).textTheme.titleSmall),
              ],
            ),
            const SizedBox(height: 8),
            LinearProgressIndicator(
              value: percent,
              backgroundColor: Colors.grey.shade200,
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
            const SizedBox(height: 4),
            Text(
              '今日调用 $callCount 次，费用 \$${dailyCost.toStringAsFixed(4)} / \$${dailyLimit.toStringAsFixed(2)} USD',
              style: const TextStyle(fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecommendationBanner() {
    if (_recommendedTemplate == null) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.blue.shade200),
      ),
      child: Row(
        children: [
          Icon(Icons.lightbulb, color: Colors.blue.shade700, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '为你推荐模板：${_recommendedTemplate!['name']}',
              style: TextStyle(color: Colors.blue.shade700, fontWeight: FontWeight.w500),
            ),
          ),
          TextButton(
            onPressed: () => setState(() {
              _selectedTemplateId = _recommendedTemplate!['id'] as String?;
              final defaultPlanDuration = _recommendedTemplate!['defaultPlanDuration'] as int?;
              final defaultStageLength = _recommendedTemplate!['defaultStageLength'] as int?;
              if (defaultPlanDuration != null) {
                _planDurationController.text = defaultPlanDuration.toString();
              }
              if (defaultStageLength != null) {
                _stageLengthController.text = defaultStageLength.toString();
              }
            }),
            child: const Text('选用'),
          ),
        ],
      ),
    );
  }

  Widget _buildTemplateChips() {
    if (_loadingTemplates) {
      return const Center(
        child: SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    if (_templates.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _templates.map<Widget>((t) {
        final id = t['id'] as String?;
        final name = t['name'] as String? ?? '模板';
        final selected = _selectedTemplateId == id;
        return ChoiceChip(
          label: Text(name),
          selected: selected,
          onSelected: (_) => setState(() {
            if (selected) {
              _selectedTemplateId = null;
            } else {
              _selectedTemplateId = id;
              final defaultPlanDuration = t['defaultPlanDuration'] as int?;
              final defaultStageLength = t['defaultStageLength'] as int?;
              if (defaultPlanDuration != null) {
                _planDurationController.text = defaultPlanDuration.toString();
              }
              if (defaultStageLength != null) {
                _stageLengthController.text = defaultStageLength.toString();
              }
            }
          }),
        );
      }).toList(),
    );
  }

  Widget _buildPlanContent(Map<String, dynamic> draft, {VoidCallback? onRefresh}) {
    final plan = draft['plan'] as Map<String, dynamic>;
    final fallback = draft['fallback'] == true;
    final error = draft['error'] as String?;
    final overload = draft['overload'] == true;
    final availableWeeklyMinutes = (draft['availableWeeklyMinutes'] as num?)?.toInt();

    final goal = plan['goal'] as Map<String, dynamic>?;
    final stages = (plan['stages'] as List<dynamic>?) ?? [];
    final habits = (plan['habits'] as List<dynamic>?) ?? [];
    final assumptions = (plan['assumptions'] as List<dynamic>?) ?? [];
    final warnings = (plan['warnings'] as List<dynamic>?) ?? [];
    final load = plan['estimatedWeeklyLoad'] as Map<String, dynamic>?;
    final currentStage = plan['currentStage'] as int? ?? 1;
    final totalStages = plan['totalStages'] as int? ?? 1;
    final planDuration = plan['planDuration'] as int? ?? 7;
    final stageLength = plan['stageLength'] as int? ?? 7;

    final children = <Widget>[
      if (fallback) ...[
        Container(
          width: double.infinity,
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
                  Text('当前使用占位草案', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.orange)),
                ],
              ),
              if (error != null && error.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(error, style: const TextStyle(fontSize: 12, color: Colors.orange)),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
      ],
      if (overload) ...[
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.red.shade50,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.red.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.error_outline, color: Colors.red, size: 18),
                  SizedBox(width: 8),
                  Text('计划负载偏高', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red)),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '当前阶段每周预计 ${load?['totalMinutes'] ?? '-'} 分钟，超过你每周 ${availableWeeklyMinutes ?? '-'} 分钟的可用时间。建议缩短计划时长或降低任务频率。',
                style: const TextStyle(fontSize: 12, color: Colors.red),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
      ],
      if (goal != null) ...[
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('目标：${goal['title']}', style: Theme.of(context).textTheme.titleMedium),
                Text('周期：${goal['horizon']}'),
                if (goal['startDate'] != null) Text('开始：${goal['startDate']}'),
                if (goal['dueDate'] != null) Text('截止：${goal['dueDate']}'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
      ],
      Card(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('阶段概览', style: Theme.of(context).textTheme.titleSmall),
              Text('总时长：$planDuration 天 · 每阶段：$stageLength 天'),
              Text('当前阶段：第 $currentStage / $totalStages 阶段'),
            ],
          ),
        ),
      ),
      const SizedBox(height: 12),
      ...stages.map<Widget>((s) {
        final stageNo = s['stageNo'] as int? ?? 0;
        final isDetailed = s['isDetailed'] as bool? ?? false;
        final stageMilestones = (s['milestones'] as List<dynamic>?) ?? [];
        final stageTasks = (s['tasks'] as List<dynamic>?) ?? [];
        final tasksByDate = <String, List<dynamic>>{};
        for (final t in stageTasks) {
          final date = (t['date'] as String?) ?? '未排期';
          tasksByDate.putIfAbsent(date, () => []).add(t);
        }
        final sortedDates = tasksByDate.keys.toList()..sort();

        return Card(
          child: Padding(
            padding: const EdgeInsets.all(12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '第 $stageNo 阶段 ${isDetailed ? "（当前详细）" : "（待展开）"}',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                    ),
                    if (isDetailed) const Icon(Icons.expand_less, size: 18),
                    if (!isDetailed) const Icon(Icons.expand_more, size: 18),
                  ],
                ),
                if (s['startDate'] != null && s['endDate'] != null)
                  Text('${s['startDate']} 至 ${s['endDate']}'),
                ...stageMilestones.map((m) => ListTile(
                      dense: true,
                      leading: const Icon(Icons.flag_outlined, size: 20),
                      title: Text(m['title'] as String, style: const TextStyle(fontSize: 14)),
                      subtitle: Text('截止：${m['dueDate'] ?? '-'}', style: const TextStyle(fontSize: 12)),
                    )),
                if (isDetailed && sortedDates.isNotEmpty) ...[
                  const Divider(),
                  ...sortedDates.map((date) {
                    final displayDate = DateFormat('MM-dd EEEE').format(DateTime.tryParse(date) ?? DateTime.now());
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
                          child: Text(displayDate, style: Theme.of(context).textTheme.bodySmall),
                        ),
                        ...tasksByDate[date]!.map((t) => ListTile(
                              dense: true,
                              title: Text(t['title'] as String, style: const TextStyle(fontSize: 14)),
                              subtitle: Text(
                                '${t['durationMinutes'] ?? '-'} 分钟 · ${t['energyLevel']} · ${t['minimumStandard'] ?? ''}',
                                style: const TextStyle(fontSize: 12),
                              ),
                            )),
                      ],
                    );
                  }),
                ],
              ],
            ),
          ),
        );
      }),
      const SizedBox(height: 12),
      if (habits.isNotEmpty) ...[
        Text('习惯', style: Theme.of(context).textTheme.titleSmall),
        ...habits.map((h) => ListTile(
              dense: true,
              leading: const Icon(Icons.loop),
              title: Text(h['title'] as String),
              subtitle: Text('${h['frequency']} · ${h['preferredTime'] ?? '任意时间'} · ${h['energyLevel']}'),
            )),
        const SizedBox(height: 16),
      ],
      if (load != null) ...[
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('预计每周负载', style: Theme.of(context).textTheme.titleSmall),
                Text('总时长：${load['totalMinutes']} 分钟'),
                Text('高精力时段：${load['highEnergyMinutes']} 分钟'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
      ],
      if (assumptions.isNotEmpty) ...[
        Text('假设', style: Theme.of(context).textTheme.titleSmall),
        ...assumptions.map((a) => ListTile(
              dense: true,
              leading: const Icon(Icons.lightbulb_outline),
              title: Text(a as String),
            )),
        const SizedBox(height: 16),
      ],
      if (warnings.isNotEmpty) ...[
        Text('警告', style: Theme.of(context).textTheme.titleSmall),
        ...warnings.map((w) => ListTile(
              dense: true,
              leading: const Icon(Icons.warning_amber, color: Colors.orange),
              title: Text(w as String, style: const TextStyle(color: Colors.orange)),
            )),
        const SizedBox(height: 16),
      ],
      Text('对草案的反馈（可选）', style: Theme.of(context).textTheme.titleSmall),
      Wrap(
        spacing: 8,
        children: [
          '太难',
          '时间不合适',
          '帮我再简单点',
        ].map((label) {
          final selected = _selectedFeedback == label;
          return ChoiceChip(
            label: Text(label),
            selected: selected,
            onSelected: (_) {
              setState(() => _selectedFeedback = selected ? null : label);
              onRefresh?.call();
            },
          );
        }).toList(),
      ),
      const SizedBox(height: 16),
    ];

    return ListView(children: children);
  }

  List<Widget> _buildConversationThread() {
    return _messages.map<Widget>((m) {
      final isUser = m['role'] == 'user';
      return Container(
        alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
        margin: const EdgeInsets.only(bottom: 8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: isUser
                ? Theme.of(context).colorScheme.primaryContainer
                : Colors.grey.shade200,
            borderRadius: BorderRadius.circular(12),
          ),
          constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.75,
          ),
          child: Text(
            m['content'] as String? ?? '',
            style: TextStyle(
              color: isUser
                  ? Theme.of(context).colorScheme.onPrimaryContainer
                  : Colors.black87,
            ),
          ),
        ),
      );
    }).toList();
  }
}
