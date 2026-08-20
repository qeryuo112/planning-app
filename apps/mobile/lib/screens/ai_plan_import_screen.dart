import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import '../providers/ai_provider.dart';
import '../providers/goal_provider.dart';

class AiPlanImportScreen extends ConsumerStatefulWidget {
  const AiPlanImportScreen({super.key});

  @override
  ConsumerState<AiPlanImportScreen> createState() => _AiPlanImportScreenState();
}

class _AiPlanImportScreenState extends ConsumerState<AiPlanImportScreen> {
  String _scope = 'master';
  String? _fileName;
  String? _fileContent;
  String? _selectedGoalId;
  final _requirementsController = TextEditingController();
  final _planDurationController = TextEditingController(text: '30');
  final _stageLengthController = TextEditingController(text: '7');
  bool _importing = false;
  bool _approving = false;
  Map<String, dynamic>? _draftResult;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(goalsProvider.notifier).fetchGoals());
  }

  @override
  void dispose() {
    _requirementsController.dispose();
    _planDurationController.dispose();
    _stageLengthController.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['txt', 'md', 'json'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    final bytes = file.bytes;
    if (bytes == null) return;

    setState(() {
      _fileName = file.name;
      _fileContent = String.fromCharCodes(bytes);
    });
  }

  Future<void> _import() async {
    if (_fileContent == null || _fileContent!.trim().isEmpty) {
      _showSnack('请先选择文件');
      return;
    }
    if (_scope == 'weekly' && _selectedGoalId == null) {
      _showSnack('周/日计划需要选择一个已有目标');
      return;
    }

    setState(() => _importing = true);
    final res = await ref.read(aiDraftProvider.notifier).importFromFile(
      _fileContent!,
      scope: _scope,
      parentGoalId: _scope == 'weekly' ? _selectedGoalId : null,
      requirements: _requirementsController.text.trim().isEmpty ? null : _requirementsController.text.trim(),
      fileName: _fileName,
      planDuration: int.tryParse(_planDurationController.text) ?? 30,
      stageLength: int.tryParse(_stageLengthController.text) ?? 7,
    );
    setState(() => _importing = false);
    if (res != null) {
      setState(() => _draftResult = res);
      _showSnack('草案生成成功');
    } else {
      _showSnack('生成失败');
    }
  }

  Future<void> _approve() async {
    final draftId = _draftResult?['draftId'] as String?;
    if (draftId == null) return;

    setState(() => _approving = true);
    final res = await ref.read(aiDraftProvider.notifier).approveDraft(draftId);
    setState(() => _approving = false);
    if (res != null) {
      _showSnack('计划已落库');
      if (mounted) Navigator.of(context).pop();
    } else {
      _showSnack('落库失败');
    }
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final goalsState = ref.watch(goalsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('计划文件导入')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '选择计划文件',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _pickFile,
              icon: const Icon(Icons.upload_file),
              label: Text(_fileName ?? '选择 .txt / .md / .json'),
            ),
            const SizedBox(height: 24),
            Text(
              '导入层级',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'master', label: Text('总/月计划')),
                ButtonSegment(value: 'weekly', label: Text('周/日计划')),
              ],
              selected: {_scope},
              onSelectionChanged: (set) {
                if (set.isNotEmpty) setState(() => _scope = set.first);
              },
            ),
            if (_scope == 'weekly') ...[
              const SizedBox(height: 24),
              Text(
                '关联已有目标',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              goalsState.when(
                data: (goals) {
                  final activeGoals = goals.where((g) => g.status == 'active').toList();
                  return DropdownButtonFormField<String>(
                    initialValue: _selectedGoalId,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      labelText: '选择目标',
                    ),
                    items: activeGoals.map((goal) {
                      return DropdownMenuItem<String>(
                        value: goal.id,
                        child: Text(goal.title),
                      );
                    }).toList(),
                    onChanged: (v) => setState(() => _selectedGoalId = v),
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Text('加载目标失败: $e'),
              ),
            ],
            const SizedBox(height: 24),
            Text(
              '补充要求（可选）',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _requirementsController,
              decoration: const InputDecoration(
                hintText: '例如：请重点关注第一周',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _planDurationController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: '总天数',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: TextField(
                    controller: _stageLengthController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: '阶段长度',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _importing ? null : _import,
                child: _importing
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('AI 解析并生成草案'),
              ),
            ),
            if (_draftResult != null) ...[
              const SizedBox(height: 24),
              const Divider(),
              const SizedBox(height: 16),
              Text(
                '草案预览',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              _buildDraftPreview(_draftResult!['plan'] as Map<String, dynamic>? ?? {}),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _approving ? null : _approve,
                  child: _approving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('确认落库'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDraftPreview(Map<String, dynamic> plan) {
    final goal = plan['goal'] as Map<String, dynamic>? ?? {};
    final tasks = (plan['tasks'] as List<dynamic>? ?? []);
    final habits = (plan['habits'] as List<dynamic>? ?? []);
    final milestones = (plan['milestones'] as List<dynamic>? ?? []);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('目标：${goal['title'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.bold)),
        if (goal['dueDate'] != null) Text('截止日期：${goal['dueDate']}'),
        const SizedBox(height: 8),
        Text('里程碑：${milestones.length} 个'),
        Text('任务：${tasks.length} 个'),
        Text('习惯：${habits.length} 个'),
        if (tasks.isNotEmpty) ...[
          const SizedBox(height: 8),
          const Text('前 5 项任务：', style: TextStyle(fontWeight: FontWeight.bold)),
          ...tasks.take(5).map((t) => Text('• ${t['title']} (${t['date'] ?? '未安排'})')),
        ],
      ],
    );
  }
}
