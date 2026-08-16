import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/app_ui.dart';
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
        color: const Color(0xFF7C4DFF),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const SocialScreen()),
        ),
      ),
      _MenuItem(
        icon: Icons.fitness_center,
        label: '运动导入',
        color: const Color(0xFF00BFA6),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const FitnessImportScreen()),
        ),
      ),
      _MenuItem(
        icon: Icons.bar_chart,
        label: '数据报表',
        color: const Color(0xFFFFA726),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const ReportsScreen()),
        ),
      ),
      _MenuItem(
        icon: Icons.psychology,
        label: 'AI 洞察',
        color: const Color(0xFFEF5350),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const AiInsightsScreen()),
        ),
      ),
      _MenuItem(
        icon: Icons.inbox,
        label: '收件箱',
        color: const Color(0xFF42A5F5),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const InboxScreen()),
        ),
      ),
      _MenuItem(
        icon: Icons.calendar_month,
        label: '日历',
        color: const Color(0xFFAB47BC),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const CalendarScreen()),
        ),
      ),
      _MenuItem(
        icon: Icons.settings,
        label: '设置',
        color: const Color(0xFF78909C),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const SettingsScreen()),
        ),
      ),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('更多')),
      body: GridView.builder(
        padding: const EdgeInsets.all(AppTheme.pagePadding),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.15,
        ),
        itemCount: items.length,
        itemBuilder: (context, index) {
          final item = items[index];
          return AppCard(
            onTap: item.onTap,
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: item.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(item.icon, color: item.color, size: 28),
                ),
                const SizedBox(height: 16),
                Text(
                  item.label,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ],
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
  final Color color;
  final VoidCallback onTap;

  _MenuItem({required this.icon, required this.label, required this.color, required this.onTap});
}
