import 'package:flutter/material.dart';
import 'settings_screen.dart';
import 'inbox_screen.dart';
import 'calendar_screen.dart';
import 'social_screen.dart';
import 'fitness_import_screen.dart';
import 'reports_screen.dart';
import 'ai_insights_screen.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final items = [
      _MenuItem(
        icon: Icons.people,
        label: '社交',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const SocialScreen()),
        ),
      ),
      _MenuItem(
        icon: Icons.fitness_center,
        label: '运动导入',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const FitnessImportScreen()),
        ),
      ),
      _MenuItem(
        icon: Icons.bar_chart,
        label: '数据报表',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const ReportsScreen()),
        ),
      ),
      _MenuItem(
        icon: Icons.psychology,
        label: 'AI 洞察',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const AiInsightsScreen()),
        ),
      ),
      _MenuItem(
        icon: Icons.inbox,
        label: '收件箱',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const InboxScreen()),
        ),
      ),
      _MenuItem(
        icon: Icons.calendar_month,
        label: '日历',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const CalendarScreen()),
        ),
      ),
      _MenuItem(
        icon: Icons.settings,
        label: '设置',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const SettingsScreen()),
        ),
      ),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('更多')),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
        ),
        itemCount: items.length,
        itemBuilder: (context, index) {
          final item = items[index];
          return Card(
            child: InkWell(
              onTap: item.onTap,
              borderRadius: BorderRadius.circular(12),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(item.icon, size: 32),
                  const SizedBox(height: 8),
                  Text(item.label),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _MenuItem {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  _MenuItem({required this.icon, required this.label, required this.onTap});
}
