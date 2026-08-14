import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/external_provider.dart';

class FitnessImportScreen extends ConsumerStatefulWidget {
  const FitnessImportScreen({super.key});

  @override
  ConsumerState<FitnessImportScreen> createState() => _FitnessImportScreenState();
}

class _FitnessImportScreenState extends ConsumerState<FitnessImportScreen> {
  final _sourceController = TextEditingController(text: 'keep');
  final _typeController = TextEditingController(text: 'run');
  final _durationController = TextEditingController();
  final _distanceController = TextEditingController();
  final _caloriesController = TextEditingController();
  final _noteController = TextEditingController();
  final _habitIdController = TextEditingController();
  final _jsonController = TextEditingController();
  final _jsonFocusNode = FocusNode();
  final _scrollController = ScrollController();
  DateTime _startedAt = DateTime.now();
  bool _loading = false;
  String? _healthError;

  @override
  void dispose() {
    _sourceController.dispose();
    _typeController.dispose();
    _durationController.dispose();
    _distanceController.dispose();
    _caloriesController.dispose();
    _noteController.dispose();
    _habitIdController.dispose();
    _jsonController.dispose();
    _jsonFocusNode.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _pickDateTime() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _startedAt,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_startedAt),
    );
    if (time == null || !mounted) return;
    setState(() {
      _startedAt = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  Future<void> _submitSingle() async {
    final duration = int.tryParse(_durationController.text.trim());
    final distance = double.tryParse(_distanceController.text.trim());
    final calories = int.tryParse(_caloriesController.text.trim());

    setState(() => _loading = true);
    try {
      final result = await ref.read(externalProvider).importFitnessSingle(
        source: _sourceController.text.trim(),
        activityType: _typeController.text.trim(),
        startedAt: _startedAt,
        durationSeconds: duration,
        distanceKm: distance,
        calories: calories,
        note: _noteController.text.trim().isEmpty ? null : _noteController.text.trim(),
        habitId: _habitIdController.text.trim().isEmpty ? null : _habitIdController.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('导入 ${result['activitiesImported']} 条运动记录')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('导入失败: $e')),
        );
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _submitJson() async {
    final text = _jsonController.text.trim();
    if (text.isEmpty) return;
    setState(() => _loading = true);
    try {
      final decoded = jsonDecode(text);
      final activities = decoded is List ? decoded : [decoded];
      final result = await ref.read(externalProvider).importFitnessJson(
        _sourceController.text.trim(),
        activities.cast<Map<String, dynamic>>(),
        habitId: _habitIdController.text.trim().isEmpty ? null : _habitIdController.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('导入 ${result['activitiesImported']} 条运动记录，生成 ${result['checkinsCreated']} 条打卡')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('JSON 解析或导入失败: $e')),
        );
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _switchToJsonImport() async {
    const sample = '[\n  {"activityType":"run","startedAt":"2026-08-14T07:00:00.000Z","durationSeconds":1800,"distanceKm":5}\n]';
    if (_jsonController.text.trim().isEmpty) {
      _jsonController.text = sample;
    }
    if (!mounted) return;
    _jsonFocusNode.requestFocus();
    _scrollController.animateTo(
      _scrollController.position.maxScrollExtent,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  Future<void> _syncHealthConnect() async {
    setState(() {
      _loading = true;
      _healthError = null;
    });
    try {
      final result = await ref.read(externalProvider).syncHealthConnect(
        habitId: _habitIdController.text.trim().isEmpty ? null : _habitIdController.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Health Connect 导入 ${result['activitiesImported']} 条运动记录，生成 ${result['checkinsCreated']} 条打卡')),
        );
      }
    } catch (e) {
      if (mounted) {
        final message = e.toString();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Health Connect 同步失败: $message')),
        );
        setState(() => _healthError = message);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('运动数据导入')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: _sourceController,
                    decoration: const InputDecoration(labelText: '数据来源（如 keep / garmin / huawei）'),
                  ),
                  TextField(
                    controller: _habitIdController,
                    decoration: const InputDecoration(
                      labelText: '关联习惯 ID（可选，填写后自动生成打卡）',
                      hintText: '在习惯详情页可复制 ID',
                    ),
                  ),
                  const Divider(height: 32),
                  const Text('单条导入', style: TextStyle(fontWeight: FontWeight.bold)),
                  TextField(
                    controller: _typeController,
                    decoration: const InputDecoration(labelText: '运动类型（如 run / cycle / swim）'),
                  ),
                  ListTile(
                    title: const Text('开始时间'),
                    subtitle: Text(_startedAt.toIso8601String()),
                    trailing: const Icon(Icons.calendar_today),
                    onTap: _pickDateTime,
                  ),
                  TextField(
                    controller: _durationController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: '时长（秒，可选）'),
                  ),
                  TextField(
                    controller: _distanceController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: '距离（km，可选）'),
                  ),
                  TextField(
                    controller: _caloriesController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: '卡路里（可选）'),
                  ),
                  TextField(
                    controller: _noteController,
                    decoration: const InputDecoration(labelText: '备注（可选）'),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _submitSingle,
                      child: const Text('提交单条'),
                    ),
                  ),
                  const Divider(height: 48),
                  const Text('批量 JSON 导入', style: TextStyle(fontWeight: FontWeight.bold)),
                  TextField(
                    controller: _jsonController,
                    focusNode: _jsonFocusNode,
                    maxLines: 6,
                    decoration: const InputDecoration(
                      hintText: '[{"activityType":"run","startedAt":"2026-08-14T07:00:00.000Z","durationSeconds":1800,"distanceKm":5}]',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _submitJson,
                      child: const Text('提交 JSON'),
                    ),
                  ),
                  const Divider(height: 48),
                  const Text('Health Connect', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  const Text(
                    '从 Android Health Connect / iOS HealthKit 读取最近 7 天运动记录。若未安装或未授权，可改用下方 JSON 导入。',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.tonal(
                      onPressed: _syncHealthConnect,
                      child: const Text('从 Health Connect 同步'),
                    ),
                  ),
                  if (_healthError != null) ...[
                    const SizedBox(height: 12),
                    Card(
                      color: Colors.orange.shade50,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(Icons.warning_amber, color: Colors.orange.shade800),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Health Connect 不可用',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.orange.shade900,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _healthError!,
                              style: TextStyle(fontSize: 13, color: Colors.orange.shade900),
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton.icon(
                                onPressed: _switchToJsonImport,
                                icon: const Icon(Icons.swap_horiz),
                                label: const Text('改用 JSON 导入'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}
