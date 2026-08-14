import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'services/notification_service.dart';
import 'screens/login_screen.dart';
import 'screens/today_screen.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationService().initialize();
  NotificationService.onNotificationTap = (payload) {
    _navigateToTodayScreen();
  };
  runApp(const ProviderScope(child: PlanningApp()));
}

void _navigateToTodayScreen() {
  final context = navigatorKey.currentContext;
  if (context == null) return;
  Navigator.of(context).pushAndRemoveUntil(
    MaterialPageRoute(builder: (_) => const TodayScreen()),
    (route) => route.isFirst,
  );
}

class PlanningApp extends StatelessWidget {
  const PlanningApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      title: '计划型 App',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2F6FED)),
        useMaterial3: true,
      ),
      home: const LoginScreen(),
    );
  }
}
