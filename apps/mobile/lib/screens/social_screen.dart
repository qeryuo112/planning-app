import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/social_provider.dart';

class SocialScreen extends ConsumerStatefulWidget {
  const SocialScreen({super.key});

  @override
  ConsumerState<SocialScreen> createState() => _SocialScreenState();
}

class _SocialScreenState extends ConsumerState<SocialScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('社交'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: '共享目标'),
            Tab(text: '挑战'),
            Tab(text: '排行榜'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          _SharedGoalsTab(),
          _ChallengesTab(),
          _LeaderboardPlaceholder(),
        ],
      ),
    );
  }
}

class _SharedGoalsTab extends StatefulWidget {
  const _SharedGoalsTab();

  @override
  State<_SharedGoalsTab> createState() => _SharedGoalsTabState();
}

class _SharedGoalsTabState extends State<_SharedGoalsTab> {
  List<dynamic> _received = [];
  List<dynamic> _owned = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final notifier = ProviderScope.containerOf(context).read(socialProvider.notifier);
    final received = await notifier.fetchReceivedShares();
    final owned = await notifier.fetchOwnedShares();
    if (mounted) {
      setState(() {
        _received = received;
        _owned = owned;
        _loading = false;
      });
    }
  }

  Future<void> _respond(String shareId, String status) async {
    final notifier = ProviderScope.containerOf(context).read(socialProvider.notifier);
    await notifier.respondToShare(shareId, status);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('收到的共享', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (_received.isEmpty)
            const Text('暂无收到的目标共享', style: TextStyle(color: Colors.grey)),
          ..._received.map((s) {
            final goal = s['goal'] as Map<String, dynamic>? ?? {};
            final ownerEmail = goal['user']?['email'] ?? s['owner']?['email'] ?? '未知';
            final status = s['status'] as String? ?? 'pending';
            return Card(
              child: ListTile(
                title: Text(goal['title'] ?? '未知目标'),
                subtitle: Text('来自：$ownerEmail · 状态：$status'),
                trailing: status == 'pending'
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          TextButton(
                            onPressed: () => _respond(s['id'], 'accepted'),
                            child: const Text('接受'),
                          ),
                          TextButton(
                            onPressed: () => _respond(s['id'], 'declined'),
                            child: const Text('忽略'),
                          ),
                        ],
                      )
                    : null,
              ),
            );
          }),
          const SizedBox(height: 24),
          Text('我发出的共享', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (_owned.isEmpty)
            const Text('暂未共享目标', style: TextStyle(color: Colors.grey)),
          ..._owned.map((s) {
            final goal = s['goal'] as Map<String, dynamic>? ?? {};
            final sharedWith = s['sharedWith'] as Map<String, dynamic>?;
            return Card(
              child: ListTile(
                title: Text(goal['title'] ?? '未知目标'),
                subtitle: Text('共享给：${sharedWith?['email'] ?? s['sharedWithEmail']} · 状态：${s['status']}'),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _ChallengesTab extends StatefulWidget {
  const _ChallengesTab();

  @override
  State<_ChallengesTab> createState() => _ChallengesTabState();
}

class _ChallengesTabState extends State<_ChallengesTab> {
  List<dynamic> _challenges = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final notifier = ProviderScope.containerOf(context).read(socialProvider.notifier);
    final challenges = await notifier.fetchChallenges(status: 'active');
    if (mounted) {
      setState(() {
        _challenges = challenges;
        _loading = false;
      });
    }
  }

  Future<void> _createChallenge() async {
    final notifier = ProviderScope.containerOf(context).read(socialProvider.notifier);
    final now = DateTime.now();
    final end = now.add(const Duration(days: 7));
    final created = await notifier.createChallenge({
      'title': '7 天习惯打卡挑战',
      'description': '每天坚持至少一个习惯打卡',
      'type': 'habit_streak',
      'targetValue': 7,
      'startDate': now.toIso8601String().split('T')[0],
      'endDate': end.toIso8601String().split('T')[0],
    });
    if (created != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('挑战已创建')),
      );
      await _load();
    }
  }

  Future<void> _join(String id) async {
    final notifier = ProviderScope.containerOf(context).read(socialProvider.notifier);
    await notifier.joinChallenge(id);
    await _load();
  }

  Future<void> _showLeaderboard(String challengeId) async {
    final notifier = ProviderScope.containerOf(context).read(socialProvider.notifier);
    final board = await notifier.fetchLeaderboard(challengeId);
    if (board == null || !mounted) return;
    showModalBottomSheet(
      context: context,
      builder: (_) => _LeaderboardSheet(board: board),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _challenges.length,
                itemBuilder: (context, index) {
                  final c = _challenges[index] as Map<String, dynamic>;
                  final count = c['_count']?['participants'] ?? 0;
                  final joined = (c['participants'] as List<dynamic>? ?? []).isNotEmpty;
                  return Card(
                    child: ListTile(
                      title: Text(c['title'] ?? '挑战'),
                      subtitle: Text('${c['type']} · $count 人参与'),
                      trailing: joined
                          ? OutlinedButton(
                              onPressed: () => _showLeaderboard(c['id'] as String),
                              child: const Text('排行榜'),
                            )
                          : TextButton(
                              onPressed: () => _join(c['id'] as String),
                              child: const Text('加入'),
                            ),
                    ),
                  );
                },
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _createChallenge,
        icon: const Icon(Icons.add),
        label: const Text('创建挑战'),
      ),
    );
  }
}

class _LeaderboardPlaceholder extends StatelessWidget {
  const _LeaderboardPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Text('选择挑战后查看排行榜', style: TextStyle(color: Colors.grey)),
    );
  }
}

class _LeaderboardSheet extends StatelessWidget {
  final Map<String, dynamic> board;

  const _LeaderboardSheet({required this.board});

  @override
  Widget build(BuildContext context) {
    final entries = (board['entries'] as List<dynamic>? ?? []);
    final myRank = board['myRank'];
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(board['title'] ?? '排行榜', style: Theme.of(context).textTheme.titleLarge),
          if (myRank != null)
            Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 12),
              child: Text('我的排名：第 $myRank 名'),
            ),
          const Divider(),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: entries.length,
              itemBuilder: (context, index) {
                final e = entries[index] as Map<String, dynamic>;
                return ListTile(
                  leading: CircleAvatar(child: Text('${e['rank']}')),
                  title: Text(e['email'] ?? '未知用户'),
                  trailing: Text('${e['score']} 分'),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
