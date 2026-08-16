# Flutter / Firebase ProGuard rules

# Keep Flutter classes
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class com.shockwave.** { *; }

# Firebase: 防止 R8 移除 Firebase component registrars / Ktx 扩展的无参构造器
-keep class com.google.firebase.** { *; }
-keepclassmembers class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Play Core Split / Deferred Components（Flutter 引擎引用，但个人版不使用动态功能模块）
-dontwarn com.google.android.play.core.**

# 保持注解与泛型签名，避免组件发现时反射失败
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes EnclosingMethod
-keepattributes InnerClasses
