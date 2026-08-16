import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:table_calendar/table_calendar.dart';
import '../providers/calendar_provider.dart';
import '../providers/calendar_subscriptions_provider.dart';

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
    Future.microtask(() {
      ref.read(calendarSubscriptionsProvider.notifier).refresh();
      ref.read(calendarSubscriptionsProvider.notifier).startAutoRefresh();
    });
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    ref.read(calendarSubscriptionsProvider.notifier).stopAutoRefresh();
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
    final subscriptionsState = ref.watch(calendarSubscriptionsProvider);

    ref.listen(calendarSubscriptionsProvider, (prev, next) {
      final notification = next.lastSyncNotification;
      if (notification != null && notification != prev?.lastSyncNotification) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(notification)),
        );
        ref.read(calendarSubscriptionsProvider.notifier).clearNotification();
      }
    });

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
            _buildSubscriptionStatusCard(subscriptionsState),
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

  Widget _buildSubscriptionStatusCard(CalendarSubscriptionsState state) {
    if (state.subscriptions.isEmpty) return const SizedBox.shrink();

    if (state.hasAnySyncing) {
      return Card(
        margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              SizedBox(
                height: 18,
                width: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: Theme.of(context).colorScheme.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  '正在同步外部日历…',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final latest = state.latestSuccessSync();
    if (latest != null) {
      final diff = DateTime.now().difference(latest.syncAt);
      final timeText = diff.inMinutes < 1
          ? '刚刚'
          : diff.inHours < 1
              ? '${diff.inMinutes} 分钟前'
              : diff.inDays < 1
                  ? '${diff.inHours} 小时前'
                  : '${diff.inDays} 天前';
      return Card(
        margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
        child: InkWell(
          onTap: _showSubscriptionsDialog,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Icon(Icons.cloud_done, color: Theme.of(context).colorScheme.primary),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '「${latest.subscription.name}」$timeText同步完成',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
                      ),
                      Text(
                        '导入 ${latest.imported} 条事件，点击查看详情',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: Colors.grey),
              ],
            ),
          ),
        ),
      );
    }

    // 有订阅但从未成功同步过
    final hasError = state.subscriptions.any((s) => s.lastSyncResult?['error'] != null);
    return Card(
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      child: InkWell(
        onTap: _showSubscriptionsDialog,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Icon(
                hasError ? Icons.cloud_off : Icons.cloud_queue,
                color: hasError ? Theme.of(context).colorScheme.error : Colors.grey,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  hasError ? '外部日历同步失败，点击查看详情' : '外部日历尚未同步，点击查看详情',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.grey),
            ],
          ),
        ),
      ),
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

class _CalendarSubscriptionsDialogState extends ConsumerState<_CalendarSubscriptionsDialog>
    with WidgetsBindingObserver {
  final _nameController = TextEditingController();
  final _urlController = TextEditingController();
  Timer? _autoRefreshTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final notifier = ref.read(calendarSubscriptionsProvider.notifier);
    notifier.refresh();
    notifier.startAutoRefresh(interval: const Duration(seconds: 30));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _autoRefreshTimer?.cancel();
    _nameController.dispose();
    _urlController.dispose();
    ref.read(calendarSubscriptionsProvider.notifier).stopAutoRefresh();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // 从后台返回（如 OAuth 授权后）自动刷新订阅列表
    if (state == AppLifecycleState.resumed) {
      ref.read(calendarSubscriptionsProvider.notifier).refresh();
    }
  }

  Future<void> _addIcsSubscription() async {
    final name = _nameController.text.trim();
    final url = _urlController.text.trim();
    if (name.isEmpty || url.isEmpty) return;
    Navigator.of(context).pop();
    try {
      await ref.read(calendarSubscriptionsProvider.notifier).addSubscription(name, url);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ICS 订阅添加成功')),
        );
      }
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
      final count = await ref.read(calendarSubscriptionsProvider.notifier).syncSubscription(id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('同步成功，导入 $count 个事件')),
        );
      }
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
      await ref.read(calendarSubscriptionsProvider.notifier).deleteSubscription(id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('订阅已删除')),
        );
      }
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
      await ref.read(calendarSubscriptionsProvider.notifier).connectGoogleCalendar();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('已打开浏览器，授权后返回本应用即可自动刷新')),
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
    final state = ref.watch(calendarSubscriptionsProvider);
    final subscriptions = state.subscriptions;

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
            if (state.globalError != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  state.globalError!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 13),
                ),
              ),
            if (subscriptions.isEmpty && state.globalError == null)
              const Text('暂无订阅')
            else
              Flexible(
                child: RefreshIndicator(
                  onRefresh: () => ref.read(calendarSubscriptionsProvider.notifier).refresh(),
                  child: ListView.builder(
                    shrinkWrap: true,
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: subscriptions.length,
                    itemBuilder: (context, index) {
                      final sub = subscriptions[index];
                      final lastSync = _formatSyncTime(sub.lastSyncAt);
                      final imported = sub.lastSyncResult?['imported'] as int?;
                      final error = sub.lastSyncResult?['error'] as String?;
                      final isSyncing = state.isSyncing(sub.id);
                      final syncMessage = state.syncMessage(sub.id);

                      return ListTile(
                        leading: Icon(
                          sub.source == 'google'
                              ? Icons.cloud
                              : sub.source == 'outlook'
                                  ? Icons.calendar_today
                                  : Icons.link,
                        ),
                        title: Text(sub.name),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('来源: ${sub.source} · 上次同步: $lastSync'),
                            if (imported != null) Text('导入 $imported 条事件'),
                            if (error != null)
                              Text(
                                '失败: $error',
                                style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12),
                              ),
                            if (syncMessage != null && error == null)
                              Text(
                                syncMessage,
                                style: TextStyle(color: Theme.of(context).colorScheme.primary, fontSize: 12),
                              ),
                          ],
                        ),
                        isThreeLine: error != null || syncMessage != null || imported != null,
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: isSyncing
                                  ? const SizedBox(
                                      height: 18,
                                      width: 18,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : const Icon(Icons.sync),
                              onPressed: isSyncing ? null : () => _syncSubscription(sub.id),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline),
                              onPressed: () => _deleteSubscription(sub.id),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
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
