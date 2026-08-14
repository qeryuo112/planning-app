import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/inbox_provider.dart';

class InboxScreen extends ConsumerStatefulWidget {
  const InboxScreen({super.key});

  @override
  ConsumerState<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends ConsumerState<InboxScreen> {
  final _titleController = TextEditingController();
  final _descController = TextEditingController();

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final inboxAsync = ref.watch(inboxProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('收件箱')),
      body: inboxAsync.when(
        data: (items) => ListView.builder(
          itemCount: items.length,
          itemBuilder: (context, index) {
            final item = items[index];
            return ListTile(
              title: Text(item.title),
              subtitle: item.description != null && item.description!.isNotEmpty
                  ? Text(item.description!)
                  : null,
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.check_circle_outline),
                    tooltip: '整理为任务',
                    onPressed: () => _convert(item.id, 'task'),
                  ),
                  IconButton(
                    icon: const Icon(Icons.flag_outlined),
                    tooltip: '整理为目标',
                    onPressed: () => _convert(item.id, 'goal'),
                  ),
                  IconButton(
                    icon: const Icon(Icons.folder_outlined),
                    tooltip: '整理为项目',
                    onPressed: () => _convert(item.id, 'project'),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline),
                    tooltip: '忽略',
                    onPressed: () => _dismiss(item.id),
                  ),
                ],
              ),
            );
          },
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

  Future<void> _convert(String id, String targetType) async {
    await ref.read(inboxProvider.notifier).convertItem(id, targetType);
  }

  Future<void> _dismiss(String id) async {
    await ref.read(inboxProvider.notifier).dismissItem(id);
  }

  void _showCreateDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('新收件箱条目'),
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
                _createItem(title, _descController.text.trim());
              },
              child: const Text('保存'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _createItem(String title, String description) async {
    _titleController.clear();
    _descController.clear();
    await ref.read(inboxProvider.notifier).createItem(
          title,
          description: description,
        );
  }
}
