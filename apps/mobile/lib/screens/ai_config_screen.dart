import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/ai_config_provider.dart';

class AiConfigScreen extends ConsumerStatefulWidget {
  const AiConfigScreen({super.key});

  @override
  ConsumerState<AiConfigScreen> createState() => _AiConfigScreenState();
}

class _AiConfigScreenState extends ConsumerState<AiConfigScreen> {
  final _providerController = TextEditingController();
  final _modelController = TextEditingController();
  final _baseUrlController = TextEditingController();
  final _apiKeyController = TextEditingController();
  bool _obscureKey = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(aiConfigProvider.notifier).fetchConfig());
  }

  @override
  void dispose() {
    _providerController.dispose();
    _modelController.dispose();
    _baseUrlController.dispose();
    _apiKeyController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(aiConfigProvider);

    state.whenData((config) {
      if (config == null) return;
      if (_providerController.text.isEmpty && config['aiProvider'] != null) {
        _providerController.text = config['aiProvider'].toString();
      }
      if (_modelController.text.isEmpty && config['aiModel'] != null) {
        _modelController.text = config['aiModel'].toString();
      }
      if (_baseUrlController.text.isEmpty && config['aiBaseUrl'] != null) {
        _baseUrlController.text = config['aiBaseUrl'].toString();
      }
      if (_apiKeyController.text.isEmpty && config['aiApiKey'] != null) {
        _apiKeyController.text = config['aiApiKey'].toString();
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('AI 设置'),
        actions: [
          if (_saving)
            const Center(
              child: Padding(
                padding: EdgeInsets.only(right: 16),
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            )
          else
            TextButton(
              onPressed: _save,
              child: const Text('保存'),
            ),
        ],
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '自定义 AI 接口',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '留空则使用服务端默认配置。支持 OpenAI 兼容接口（DeepSeek、Kimi、Claude 代理等）。',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey),
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _providerController,
                    decoration: const InputDecoration(
                      labelText: 'Provider',
                      hintText: 'openai / deepseek / kimi',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _modelController,
                    decoration: const InputDecoration(
                      labelText: 'Model',
                      hintText: '例如 deepseek-chat / gpt-4o-mini',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _baseUrlController,
                    decoration: const InputDecoration(
                      labelText: 'Base URL（可选）',
                      hintText: 'https://api.deepseek.com/v1',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _apiKeyController,
                    obscureText: _obscureKey,
                    decoration: InputDecoration(
                      labelText: 'API Key',
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        icon: Icon(_obscureKey ? Icons.visibility_off : Icons.visibility),
                        onPressed: () => setState(() => _obscureKey = !_obscureKey),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _saving ? null : _save,
                      child: const Text('保存配置'),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final res = await ref.read(aiConfigProvider.notifier).updateConfig(
      aiProvider: _providerController.text.trim().isEmpty ? null : _providerController.text.trim(),
      aiModel: _modelController.text.trim().isEmpty ? null : _modelController.text.trim(),
      aiBaseUrl: _baseUrlController.text.trim().isEmpty ? null : _baseUrlController.text.trim(),
      aiApiKey: _apiKeyController.text.trim().isEmpty ? null : _apiKeyController.text.trim(),
    );
    setState(() => _saving = false);
    if (!mounted) return;
    if (res != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('AI 配置已保存')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('保存失败')),
      );
    }
  }
}
