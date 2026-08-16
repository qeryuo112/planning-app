import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/settings_provider.dart';
import '../providers/reminder_provider.dart';
import '../services/notification_service.dart';

const _weekdays = [
  ('monday', '周一'),
  ('tuesday', '周二'),
  ('wednesday', '周三'),
  ('thursday', '周四'),
  ('friday', '周五'),
  ('saturday', '周六'),
  ('sunday', '周日'),
];

const _energyLabels = {
  'high': ('高', Colors.green),
  'medium': ('中', Colors.orange),
  'low': ('低', Colors.red),
};

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _timezoneController = TextEditingController();
  final _dndStartController = TextEditingController();
  final _dndEndController = TextEditingController();
  final _reminderMinutesController = TextEditingController();

  Map<String, List<Map<String, String>>> _availableTime = {};
  Map<String, String> _energyCurve = {};
  bool _weekendOff = false;
  bool _isSaving = false;
  bool _loadedFromPrefs = false;

  @override
  void dispose() {
    _timezoneController.dispose();
    _dndStartController.dispose();
    _dndEndController.dispose();
    _reminderMinutesController.dispose();
    super.dispose();
  }

  void _loadFromPreferences(UserPreferences prefs) {
    _timezoneController.text = prefs.timezone;

    final at = prefs.availableTime;
    _availableTime = {};
    for (final (key, _) in _weekdays) {
      final slots = at[key];
      if (slots is List) {
        _availableTime[key] = slots
            .whereType<Map<String, dynamic>>()
            .map((s) => {
                  'start': (s['start'] as String?) ?? '09:00',
                  'end': (s['end'] as String?) ?? '17:00',
                })
            .toList();
      } else {
        _availableTime[key] = [];
      }
    }

    final ec = prefs.energyCurve;
    _energyCurve = {};
    for (var i = 0; i < 24; i++) {
      final hour = i.toString();
      final value = ec[hour];
      _energyCurve[hour] = (value is String && _energyLabels.containsKey(value))
          ? value
          : 'medium';
    }

    final ns = prefs.notificationSetting;
    _reminderMinutesController.text =
        (ns['reminderMinutesBefore'] as int?)?.toString() ?? '15';
    _dndStartController.text = (ns['doNotDisturbStart'] as String?) ?? '22:00';
    _dndEndController.text = (ns['doNotDisturbEnd'] as String?) ?? '08:00';
    _weekendOff = (ns['weekendOff'] as bool?) ?? false;
  }

  Future<void> _save() async {
    setState(() => _isSaving = true);
    final reminderMinutes = int.tryParse(_reminderMinutesController.text);
    await ref.read(settingsProvider.notifier).updatePreferences(
          timezone: _timezoneController.text.trim(),
          availableTime: _availableTime,
          energyCurve: _energyCurve,
          notificationSetting: {
            'reminderMinutesBefore': reminderMinutes ?? 15,
            'doNotDisturbStart': _dndStartController.text.trim(),
            'doNotDisturbEnd': _dndEndController.text.trim(),
            'weekendOff': _weekendOff,
          },
        );
    setState(() => _isSaving = false);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('设置已保存')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final settingsAsync = ref.watch(settingsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('设置')),
      body: settingsAsync.when(
        data: (prefs) {
          if (!_loadedFromPrefs) {
            _loadFromPreferences(prefs);
            _loadedFromPrefs = true;
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _buildTimezoneCard(),
              const SizedBox(height: 16),
              _buildAvailableTimeCard(),
              const SizedBox(height: 16),
              _buildEnergyCurveCard(),
              const SizedBox(height: 16),
              _buildNotificationCard(),
              const SizedBox(height: 16),
              _buildLocalReminderToggle(),
              const SizedBox(height: 12),
              _buildExactAlarmCard(),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isSaving ? null : _save,
                child: _isSaving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('保存'),
              ),
              const SizedBox(height: 32),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, st) => Center(child: Text('加载失败: $err')),
      ),
    );
  }

  Widget _buildTimezoneCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('时区', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            TextField(
              controller: _timezoneController,
              decoration: const InputDecoration(
                labelText: '时区',
                hintText: 'Asia/Shanghai',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvailableTimeCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('可用时间', style: Theme.of(context).textTheme.titleMedium),
                TextButton.icon(
                  onPressed: _addSlotToAllDays,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('统一添加'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Text('为每一天添加你通常可投入的时间段。', style: TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 12),
            ..._weekdays.map((entry) {
              final (key, label) = entry;
              return _buildDaySlotRow(key, label);
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildDaySlotRow(String dayKey, String dayLabel) {
    final slots = _availableTime[dayKey] ?? [];

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(dayLabel, style: const TextStyle(fontWeight: FontWeight.w500)),
              IconButton(
                icon: const Icon(Icons.add_circle_outline, size: 20),
                tooltip: '添加时段',
                onPressed: () => _addSlot(dayKey),
              ),
            ],
          ),
          if (slots.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 4),
              child: Text('无固定时段', style: TextStyle(fontSize: 12, color: Colors.grey)),
            ),
          ...slots.asMap().entries.map((entry) {
            final index = entry.key;
            final slot = entry.value;
            return _buildSlotEditor(dayKey, index, slot);
          }),
        ],
      ),
    );
  }

  Widget _buildSlotEditor(String dayKey, int index, Map<String, String> slot) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: TextFormField(
              initialValue: slot['start'],
              decoration: const InputDecoration(
                labelText: '开始',
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              onChanged: (v) => _updateSlot(dayKey, index, 'start', v),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 8),
            child: Text('—'),
          ),
          Expanded(
            child: TextFormField(
              initialValue: slot['end'],
              decoration: const InputDecoration(
                labelText: '结束',
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              onChanged: (v) => _updateSlot(dayKey, index, 'end', v),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, color: Colors.red),
            tooltip: '删除',
            onPressed: () => _removeSlot(dayKey, index),
          ),
        ],
      ),
    );
  }

  void _addSlot(String dayKey) {
    setState(() {
      _availableTime[dayKey] = [...(_availableTime[dayKey] ?? []), {'start': '09:00', 'end': '17:00'}];
    });
  }

  void _addSlotToAllDays() {
    setState(() {
      for (final (key, _) in _weekdays) {
        _availableTime[key] = [...(_availableTime[key] ?? []), {'start': '09:00', 'end': '17:00'}];
      }
    });
  }

  void _removeSlot(String dayKey, int index) {
    setState(() {
      _availableTime[dayKey]!.removeAt(index);
    });
  }

  void _updateSlot(String dayKey, int index, String field, String value) {
    setState(() {
      _availableTime[dayKey]![index][field] = value;
    });
  }

  Widget _buildEnergyCurveCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('精力曲线', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            const Text('点击每个小时选择你 typical 的精力等级。', style: TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: List.generate(24, (i) {
                final hour = i.toString();
                final level = _energyCurve[hour] ?? 'medium';
                final (label, color) = _energyLabels[level]!;
                return InkWell(
                  onTap: () => _cycleEnergy(hour),
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    width: 56,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.15),
                      border: Border.all(color: color),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      children: [
                        Text('$i:00', style: const TextStyle(fontSize: 11)),
                        Text(label, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ],
        ),
      ),
    );
  }

  void _cycleEnergy(String hour) {
    setState(() {
      final levels = ['low', 'medium', 'high'];
      final current = _energyCurve[hour] ?? 'medium';
      final nextIndex = (levels.indexOf(current) + 1) % levels.length;
      _energyCurve[hour] = levels[nextIndex];
    });
  }

  Widget _buildNotificationCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('通知偏好', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            TextField(
              controller: _reminderMinutesController,
              decoration: const InputDecoration(
                labelText: '提醒提前分钟数',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _dndStartController,
                    decoration: const InputDecoration(
                      labelText: '免打扰开始',
                      hintText: '22:00',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: Text('—'),
                ),
                Expanded(
                  child: TextField(
                    controller: _dndEndController,
                    decoration: const InputDecoration(
                      labelText: '免打扰结束',
                      hintText: '08:00',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Checkbox(
                  value: _weekendOff,
                  onChanged: (v) => setState(() => _weekendOff = v ?? false),
                ),
                const Text('周末关闭通知'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLocalReminderToggle() {
    final enabled = ref.watch(remindersEnabledProvider);

    return Card(
      child: ListTile(
        leading: const Icon(Icons.notifications_active),
        title: const Text('本地提醒通知'),
        subtitle: const Text('关闭后将取消所有已调度提醒'),
        trailing: Switch(
          value: enabled,
          onChanged: (value) => ref.read(remindersProvider.notifier).setEnabled(value),
        ),
      ),
    );
  }

  Widget _buildExactAlarmCard() {
    if (!Platform.isAndroid) return const SizedBox.shrink();

    return FutureBuilder<bool>(
      future: NotificationService().canScheduleExactNotifications(),
      builder: (context, snapshot) {
        final granted = snapshot.data ?? false;
        return Card(
          child: ListTile(
            leading: Icon(
              granted ? Icons.alarm_on : Icons.alarm_off,
              color: granted ? Colors.green : Colors.orange,
            ),
            title: const Text('Android 精确闹钟权限'),
            subtitle: Text(granted ? '已获取，可准时触发提醒' : '未获取，提醒可能延迟'),
            trailing: granted
                ? const Icon(Icons.check_circle, color: Colors.green)
                : TextButton(
                    onPressed: () async {
                      final opened = await NotificationService().requestExactAlarmPermission();
                      if (opened && mounted) {
                        // ignore: use_build_context_synchronously
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('已打开系统设置，请手动开启权限')),
                        );
                      }
                    },
                    child: const Text('去开启'),
                  ),
          ),
        );
      },
    );
  }
}
