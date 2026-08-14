import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:table_calendar/table_calendar.dart';
import '../providers/calendar_provider.dart';

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;
  final _titleController = TextEditingController();
  final _descController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _selectedDay = _focusedDay;
    _loadEvents();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    super.dispose();
  }

  void _loadEvents() {
    final start = DateTime(_focusedDay.year, _focusedDay.month, 1);
    final end = DateTime(_focusedDay.year, _focusedDay.month + 1, 0, 23, 59, 59);
    ref.read(calendarProvider.notifier).fetchEvents(start, end);
  }

  List<_CalendarEvent> _eventsForDay(DateTime day) {
    final events = ref.read(calendarProvider).value ?? [];
    return events
        .where((e) => _isSameDay(e.startAt, day))
        .map((e) => _CalendarEvent(e.id, e.title, e.startAt, e.endAt))
        .toList();
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  @override
  Widget build(BuildContext context) {
    final calendarAsync = ref.watch(calendarProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('日历'),
        actions: [
          PopupMenuButton<String>(
            onSelected: _handleMenuAction,
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'import', child: Text('导入 ICS')),
              const PopupMenuItem(value: 'export', child: Text('导出 ICS')),
              const PopupMenuItem(value: 'sync', child: Text('快速同步外部日历')),
              const PopupMenuItem(value: 'subscriptions', child: Text('管理外部日历订阅')),
            ],
          ),
        ],
      ),
      body: calendarAsync.when(
        data: (_) => Column(
          children: [
            TableCalendar(
              firstDay: DateTime.utc(2020, 1, 1),
              lastDay: DateTime.utc(2030, 12, 31),
              focusedDay: _focusedDay,
              selectedDayPredicate: (day) => _selectedDay != null && _isSameDay(_selectedDay!, day),
              onDaySelected: (selected, focused) {
                setState(() {
                  _selectedDay = selected;
                  _focusedDay = focused;
                });
              },
              onPageChanged: (focused) {
                setState(() {
                  _focusedDay = focused;
                });
                _loadEvents();
              },
              eventLoader: _eventsForDay,
            ),
            const Divider(),
            Expanded(
              child: _buildEventList(),
            ),
          ],
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, st) => Center(child: Text('加载失败: $err')),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreateDialog,
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildEventList() {
    final events = ref.watch(calendarProvider).value ?? [];
    final dayEvents = _selectedDay != null
        ? events.where((e) => _isSameDay(e.startAt, _selectedDay!)).toList()
        : events;

    if (dayEvents.isEmpty) {
      return const Center(child: Text('当日无日程'));
    }

    return ListView.builder(
      itemCount: dayEvents.length,
      itemBuilder: (context, index) {
        final event = dayEvents[index];
        return ListTile(
          title: Text(event.title),
          subtitle: Text(_formatTime(event.startAt, event.endAt)),
          trailing: IconButton(
            icon: const Icon(Icons.delete_outline),
            onPressed: () => ref.read(calendarProvider.notifier).deleteEvent(event.id),
          ),
        );
      },
    );
  }

  String _formatTime(DateTime start, DateTime? end) {
    final startText = '${start.hour.toString().padLeft(2, '0')}:${start.minute.toString().padLeft(2, '0')}';
    if (end == null) return startText;
    final endText = '${end.hour.toString().padLeft(2, '0')}:${end.minute.toString().padLeft(2, '0')}';
    return '$startText - $endText';
  }

  void _showCreateDialog() {
    final day = _selectedDay ?? _focusedDay;
    final start = DateTime(day.year, day.month, day.day, 9, 0);
    final end = start.add(const Duration(hours: 1));

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('新日程'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _titleController,
                decoration: const InputDecoration(labelText: '标题'),
              ),
              TextField(
                controller: _descController,
                decoration: const InputDecoration(labelText: '描述（可选）'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('取消'),
            ),
            TextButton(
              onPressed: () {
                final title = _titleController.text.trim();
                if (title.isEmpty) return;
                Navigator.of(context).pop();
                _createEvent(
                  title: title,
                  description: _descController.text.trim(),
                  startAt: start,
                  endAt: end,
                );
              },
              child: const Text('保存'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _createEvent({
    required String title,
    String? description,
    required DateTime startAt,
    DateTime? endAt,
  }) async {
    _titleController.clear();
    _descController.clear();
    await ref.read(calendarProvider.notifier).createEvent(
          title: title,
          description: description,
          startAt: startAt,
          endAt: endAt,
        );
  }

  void _handleMenuAction(String value) {
    switch (value) {
      case 'import':
        _showImportIcsDialog();
        break;
      case 'export':
        _showExportIcsDialog();
        break;
      case 'sync':
        _showSyncExternalDialog();
        break;
      case 'subscriptions':
        _showSubscriptionsDialog();
        break;
    }
  }

  Future<void> _showImportIcsDialog() async {
    final controller = TextEditingController();
    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('导入 ICS'),
        content: TextField(
          controller: controller,
          maxLines: 6,
          decoration: const InputDecoration(
            hintText: '在此粘贴 ICS 文本',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              final text = controller.text.trim();
              if (text.isEmpty) return;
              Navigator.of(context).pop();
              _importIcs(text);
            },
            child: const Text('导入'),
          ),
        ],
      ),
    );
    controller.dispose();
  }

  Future<void> _showExportIcsDialog() async {
    try {
      final icsText = await ref.read(calendarProvider.notifier).exportIcs();
      if (!mounted) return;
      await showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('导出 ICS'),
          content: SingleChildScrollView(
            child: SelectableText(icsText),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('关闭'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('导出失败: $e')),
      );
    }
  }

  Future<void> _importIcs(String icsText) async {
    try {
      final count = await ref.read(calendarProvider.notifier).importIcs(icsText);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('成功导入 $count 个事件')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('导入失败: $e')),
      );
    }
  }

  Future<void> _syncExternalCalendar(String url) async {
    try {
      final count = await ref.read(calendarProvider.notifier).syncExternalCalendar(url);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('成功同步 $count 个事件')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('同步失败: $e')),
      );
    }
  }

  Future<void> _showSyncExternalDialog() async {
    final controller = TextEditingController();
    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('快速同步外部日历'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: 'Google/Outlook 公开 ICS 地址',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              final url = controller.text.trim();
              if (url.isEmpty) return;
              Navigator.of(context).pop();
              _syncExternalCalendar(url);
            },
            child: const Text('同步'),
          ),
        ],
      ),
    );
    controller.dispose();
  }

  Future<void> _showSubscriptionsDialog() async {
    await showDialog(
      context: context,
      builder: (context) => const _CalendarSubscriptionsDialog(),
    );
  }
}

class _CalendarEvent {
  final String id;
  final String title;
  final DateTime startAt;
  final DateTime? endAt;

  _CalendarEvent(this.id, this.title, this.startAt, this.endAt);
}

class _CalendarSubscriptionsDialog extends ConsumerStatefulWidget {
  const _CalendarSubscriptionsDialog();

  @override
  ConsumerState<_CalendarSubscriptionsDialog> createState() => _CalendarSubscriptionsDialogState();
}

class _CalendarSubscriptionsDialogState extends ConsumerState<_CalendarSubscriptionsDialog> {
  List<Map<String, dynamic>> _subscriptions = [];
  bool _loading = true;
  final _nameController = TextEditingController();
  final _urlController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final items = await ref.read(calendarProvider.notifier).fetchSubscriptions();
      if (mounted) {
        setState(() {
          _subscriptions = items;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('加载失败: $e')),
        );
      }
    }
  }

  Future<void> _addIcsSubscription() async {
    final name = _nameController.text.trim();
    final url = _urlController.text.trim();
    if (name.isEmpty || url.isEmpty) return;
    Navigator.of(context).pop();
    try {
      await ref.read(calendarProvider.notifier).addSubscription(name, url);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ICS 订阅添加成功')),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('添加失败: $e')),
        );
      }
    }
  }

  Future<void> _syncSubscription(String id) async {
    try {
      final count = await ref.read(calendarProvider.notifier).syncSubscription(id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('同步成功，导入 $count 个事件')),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('同步失败: $e')),
        );
      }
    }
  }

  Future<void> _deleteSubscription(String id) async {
    try {
      await ref.read(calendarProvider.notifier).deleteSubscription(id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('订阅已删除')),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('删除失败: $e')),
        );
      }
    }
  }

  Future<void> _connectGoogle() async {
    try {
      await ref.read(calendarProvider.notifier).connectGoogleCalendar();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('已打开浏览器，授权后请下拉刷新')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Google 授权失败: $e')),
        );
      }
    }
  }

  String _formatSyncTime(String? iso) {
    if (iso == null) return '未同步';
    final dt = DateTime.tryParse(iso);
    if (dt == null) return iso;
    return '${dt.month}/${dt.day} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  void _showAddIcsDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('添加 ICS 订阅'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: '名称'),
            ),
            TextField(
              controller: _urlController,
              decoration: const InputDecoration(
                labelText: 'ICS 地址',
                hintText: 'https://calendar.google.com/.../basic.ics',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: _addIcsSubscription,
            child: const Text('添加'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('外部日历订阅'),
      content: SizedBox(
        width: double.maxFinite,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              children: [
                FilledButton(
                  onPressed: _connectGoogle,
                  child: const Text('连接 Google 日历'),
                ),
                OutlinedButton(
                  onPressed: _showAddIcsDialog,
                  child: const Text('添加 ICS'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_subscriptions.isEmpty)
              const Text('暂无订阅')
            else
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _subscriptions.length,
                  itemBuilder: (context, index) {
                    final sub = _subscriptions[index];
                    final source = sub['source'] as String? ?? 'ics';
                    final name = sub['name'] as String? ?? '未命名';
                    final lastSync = _formatSyncTime(sub['lastSyncAt'] as String?);
                    final lastResult = sub['lastSyncResult'] as Map<String, dynamic>?;
                    final imported = lastResult?['imported'] as int?;

                    return ListTile(
                      leading: Icon(
                        source == 'google'
                            ? Icons.cloud
                            : source == 'outlook'
                                ? Icons.calendar_today
                                : Icons.link,
                      ),
                      title: Text(name),
                      subtitle: Text('来源: $source · 上次同步: $lastSync${imported != null ? ' · 导入 $imported 条' : ''}'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.sync),
                            onPressed: () => _syncSubscription(sub['id'] as String),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline),
                            onPressed: () => _deleteSubscription(sub['id'] as String),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('关闭'),
        ),
      ],
    );
  }
}
