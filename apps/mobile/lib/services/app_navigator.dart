import 'package:flutter/material.dart';
import '../screens/today_screen.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void navigateToTodayScreen() {
  final context = navigatorKey.currentContext;
  if (context == null) return;
  Navigator.of(context).pushAndRemoveUntil(
    MaterialPageRoute(builder: (_) => const TodayScreen()),
    (route) => route.isFirst,
  );
}
