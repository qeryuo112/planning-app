import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../services/app_navigator.dart';
import '../services/fcm_service.dart';
import '../services/notification_service.dart';
import 'login_screen.dart';
import 'main_screen.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    await NotificationService().initialize();
    await FcmService().initialize();

    NotificationService.onNotificationTap = (payload) {
      navigateToTodayScreen();
    };

    final launchPayload = await NotificationService().getLaunchNotificationPayload();
    final shouldOpenToday = launchPayload != null;

    final api = ref.read(apiClientProvider);
    final sync = ref.read(syncEngineProvider);
    final token = await api.getToken();

    if (token != null && token.isNotEmpty) {
      try {
        await api.get('/users/me').timeout(const Duration(seconds: 10));
        // 同步引擎在后台初始化，避免启动/登录阻塞
        Future.microtask(() async {
          await sync
              .initialize()
              .timeout(const Duration(seconds: 15))
              .catchError((e) {});
        });
        if (mounted) {
          await Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const MainScreen()),
          );
          if (shouldOpenToday) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              navigateToTodayScreen();
            });
          }
          return;
        }
      } catch (e) {
        await api.clearToken();
      }
    }

    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
