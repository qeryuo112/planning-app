import 'package:flutter/material.dart';
import 'today_screen.dart';
import 'goal_screen.dart';
import 'task_screen.dart';
import 'habit_screen.dart';
import 'ai_plan_draft_screen.dart';
import 'more_screen.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;

  final _screens = const [
    TodayScreen(),
    GoalScreen(),
    TaskScreen(),
    HabitScreen(),
    AiPlanDraftScreen(),
    MoreScreen(),
  ];

  final _items = const [
    BottomNavigationBarItem(icon: Icon(Icons.today), label: '今日'),
    BottomNavigationBarItem(icon: Icon(Icons.flag), label: '目标'),
    BottomNavigationBarItem(icon: Icon(Icons.check_box), label: '任务'),
    BottomNavigationBarItem(icon: Icon(Icons.loop), label: '习惯'),
    BottomNavigationBarItem(icon: Icon(Icons.auto_awesome), label: 'AI'),
    BottomNavigationBarItem(icon: Icon(Icons.more_horiz), label: '更多'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        type: BottomNavigationBarType.fixed,
        items: _items,
      ),
    );
  }
}
