import 'package:flutter/material.dart';

/// Plan 应用统一主题与视觉常量。
class AppTheme {
  static const Color primaryColor = Color(0xFF2F6FED);
  static const Color secondaryColor = Color(0xFF00BFA6);
  static const Color errorColor = Color(0xFFEF5350);
  static const Color warningColor = Color(0xFFFFA726);
  static const Color successColor = Color(0xFF66BB6A);
  static const Color highEnergy = Color(0xFF66BB6A);
  static const Color mediumEnergy = Color(0xFFFFA726);
  static const Color lowEnergy = Color(0xFFEF5350);

  static const double cardRadius = 16.0;
  static const double buttonRadius = 12.0;
  static const double chipRadius = 8.0;
  static const double pagePadding = 16.0;

  static ThemeData lightTheme() {
    final base = ColorScheme.fromSeed(
      seedColor: primaryColor,
      brightness: Brightness.light,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: base.copyWith(
        primary: primaryColor,
        secondary: secondaryColor,
        error: errorColor,
      ),
      appBarTheme: const AppBarTheme(
        centerTitle: true,
        elevation: 0,
        scrolledUnderElevation: 1,
        backgroundColor: Colors.white,
        foregroundColor: Color(0xFF1A1A2E),
        titleTextStyle: TextStyle(
          color: Color(0xFF1A1A2E),
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
      scaffoldBackgroundColor: const Color(0xFFF8F9FE),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(cardRadius),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(buttonRadius),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primaryColor,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(buttonRadius),
          ),
          side: const BorderSide(color: primaryColor, width: 1.5),
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primaryColor,
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFF1F4F9),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(buttonRadius),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(buttonRadius),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(buttonRadius),
          borderSide: const BorderSide(color: primaryColor, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      chipTheme: ChipThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(chipRadius),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: primaryColor,
        unselectedItemColor: Color(0xFF9E9E9E),
        type: BottomNavigationBarType.fixed,
        elevation: 1,
      ),
      dividerTheme: const DividerThemeData(
        color: Color(0xFFEEF1F6),
        thickness: 1,
      ),
    );
  }

  static Color energyColor(String level) {
    switch (level) {
      case 'high':
        return highEnergy;
      case 'low':
        return lowEnergy;
      case 'medium':
      default:
        return mediumEnergy;
    }
  }

  static String energyLabel(String level) {
    switch (level) {
      case 'high':
        return '高';
      case 'low':
        return '低';
      case 'medium':
      default:
        return '中';
    }
  }
}
