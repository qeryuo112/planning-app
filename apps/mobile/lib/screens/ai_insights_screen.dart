import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/ai_insights_provider.dart';

class AiInsightsScreen extends ConsumerStatefulWidget {
  const AiInsightsScreen({super.key});

  @override
  ConsumerState<AiInsightsScreen> createState() => _AiInsightsScreenState();
}

class _AiInsightsScreenState extends ConsumerState<AiInsightsScreen> {
  Map<String, dynamic>? _profile;
  Map<String, dynamic>? _recommendations;
  bool _loadingProfile = false;
  bool _loadingRecommendations = false;

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadRecommendations();
  }

  Future<void> _loadProfile({bool refresh = false}) async {
    setState(() => _loadingProfile = true);
    try {
      final api = ref.read(aiInsightsProvider);
      final data = refresh
          ? await api.refreshProfileSummary()
          : await api.fetchProfileSummary();
      if (mounted) setState(() => _profile = data);
    } catch (e) {
      if (mounted) _showSnack('画像摘要加载失败: $e');
    } finally {
      if (mounted) setState(() => _loadingProfile = false);
    }
  }

  Future<void> _loadRecommendations() async {
    setState(() => _loadingRecommendations = true);
    try {
      final data = await ref.read(aiInsightsProvider).fetchPersonalizedRecommendations();
      if (mounted) setState(() => _recommendations = data);
    } catch (e) {
      if (mounted) _showSnack('推荐加载失败: $e');
    } finally {
      if (mounted) setState(() => _loadingRecommendations = false);
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI 洞察'),
        actions: [
          IconButton(
            icon: const Icon(Icons.auto_fix_high),
            tooltip: '立即刷新画像',
            onPressed: () {
              _loadProfile(refresh: true);
              _loadRecommendations();
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: '重新加载',
            onPressed: () {
              _loadProfile();
              _loadRecommendations();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await _loadProfile();
          await _loadRecommendations();
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildProfileSection(),
              const SizedBox(height: 24),
              _buildRecommendationsSection(),
              const SizedBox(height: 24),
              _buildStatsSection(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfileSection() {
    if (_loadingProfile) return const Center(child: CircularProgressIndicator());
    if (_profile == null) return const Text('无法加载画像摘要');

    final fallback = _profile!['fallback'] == true;
    final summary = _profile!['summary'] as String? ?? '';
    final strengths = (_profile!['strengths'] as List<dynamic>?)?.cast<String>() ?? <String>[];
    final weaknesses = (_profile!['weaknesses'] as List<dynamic>?)?.cast<String>() ?? <String>[];
    final riskAreas = (_profile!['riskAreas'] as List<dynamic>?)?.cast<String>() ?? <String>[];
    final suggestedFocus = _profile!['suggestedFocus'] as String? ?? '';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(child: Text('用户画像摘要', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16))),
                if (fallback)
                  Chip(label: Text('降级', style: TextStyle(color: Theme.of(context).colorScheme.onError)), backgroundColor: Theme.of(context).colorScheme.error),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '最后刷新：${_profile!['refreshedAt'] ?? '未知'}',
              style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.outline),
            ),
            const SizedBox(height: 12),
            Text(summary),
            const SizedBox(height: 16),
            _buildBulletList('优势', strengths, Icons.thumb_up),
            _buildBulletList('待改进', weaknesses, Icons.trending_down),
            _buildBulletList('风险区', riskAreas, Icons.warning_amber),
            if (suggestedFocus.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.lightbulb, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(width: 8),
                  Expanded(child: Text('建议聚焦: $suggestedFocus')),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildRecommendationsSection() {
    if (_loadingRecommendations) return const Center(child: CircularProgressIndicator());
    if (_recommendations == null) return const Text('无法加载推荐');

    final recs = _recommendations!['recommendations'] as Map<String, dynamic>? ?? {};
    final nextGoals = (recs['nextGoals'] as List<dynamic>?)?.cast<String>() ?? <String>[];
    final habitSuggestions = (recs['habitSuggestions'] as List<dynamic>?)?.cast<String>() ?? <String>[];
    final scheduleTips = (recs['scheduleTips'] as List<dynamic>?)?.cast<String>() ?? <String>[];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('个性化建议', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            _buildBulletList('下一步目标', nextGoals, Icons.flag),
            _buildBulletList('习惯建议', habitSuggestions, Icons.repeat),
            _buildBulletList('排程技巧', scheduleTips, Icons.schedule),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsSection() {
    final stats = (_profile?['stats'] ?? _recommendations?['stats']) as Map<String, dynamic>?;
    if (stats == null) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('核心数据', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _buildStatChip('任务完成率', '${stats['completionRate'] ?? 0}%'),
                _buildStatChip('习惯打卡率', '${stats['checkinRate'] ?? 0}%'),
                _buildStatChip('活跃天数(90天)', '${stats['recentActivityDays'] ?? 0}'),
                _buildStatChip('进行中目标', '${stats['activeGoals'] ?? 0}'),
                _buildStatChip('已完成目标', '${stats['completedGoals'] ?? 0}'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBulletList(String title, List<String> items, IconData icon) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
          ...items.map((item) => Padding(
            padding: const EdgeInsets.only(left: 8, top: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, size: 16),
                const SizedBox(width: 6),
                Expanded(child: Text(item)),
              ],
            ),
          )),
        ],
      ),
    );
  }

  Widget _buildStatChip(String label, String value) {
    return Chip(
      avatar: CircleAvatar(backgroundColor: Theme.of(context).colorScheme.primaryContainer, child: Text(value, style: const TextStyle(fontSize: 10))),
      label: Text(label),
    );
  }
}
