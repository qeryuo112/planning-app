import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'services/notification_service.dart';
import 'services/fcm_service.dart';
import 'screens/login_screen.dart';
import 'screens/today_screen.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Windows/Linux/macOS 桌面端使用 sqflite FFI 实现本地数据库
  if (Platform.isWindows || Platform.isLinux || Platform.isMacOS) {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  }

  await NotificationService().initialize();
  // 初始化 Firebase 与远程推送；若未配置 Firebase 原生文件会优雅降级。
  await FcmService().initialize();

  // 设置通知点击回调（应用存活时点击通知）
  NotificationService.onNotificationTap = (payload) {
    _navigateToTodayScreen();
  };

  // 处理冷启动：用户点击通知启动 App 时，获取 payload 并跳转今日页
  final launchPayload = await NotificationService().getLaunchNotificationPayload();
  final shouldOpenToday = launchPayload != null;

  runApp(const ProviderScope(child: PlanningApp()));

  if (shouldOpenToday) {
    // 等待首帧渲染后再跳转
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _navigateToTodayScreen();
    });
  }
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
