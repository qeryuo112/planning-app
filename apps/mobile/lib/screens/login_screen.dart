import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import 'main_screen.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _isRegister = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  String? _emailError;
  String? _passwordError;
  String? _confirmPasswordError;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  bool _validate() {
    setState(() {
      _emailError = null;
      _passwordError = null;
      _confirmPasswordError = null;
    });

    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (email.isEmpty) {
      _emailError = '请输入邮箱';
    } else if (!RegExp(r'^[^@]+@[^@]+\.[^@]+').hasMatch(email)) {
      _emailError = '邮箱格式不正确';
    }

    if (password.isEmpty) {
      _passwordError = '请输入密码';
    } else if (password.length < 8) {
      _passwordError = '密码至少需要 8 位';
    }

    if (_isRegister && password != confirmPassword) {
      _confirmPasswordError = '两次输入的密码不一致';
    }

    setState(() {});
    return _emailError == null && _passwordError == null && _confirmPasswordError == null;
  }

  Future<void> _submit() async {
    if (!_validate()) return;

    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final notifier = ref.read(authStateProvider.notifier);

    if (_isRegister) {
      await notifier.register(email, password);
    } else {
      await notifier.login(email, password);
    }

    if (!mounted) return;

    final state = ref.read(authStateProvider);
    if (state.hasError) {
      final message = state.error?.toString() ?? '操作失败';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_isRegister ? '注册失败: $message' : '登录失败: $message')),
      );
    } else {
      final client = ref.read(apiClientProvider);
      await client.trackEvent(_isRegister ? 'user.registered' : 'user.logged_in');
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const MainScreen()),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authStateProvider);

    return Scaffold(
      appBar: AppBar(title: Text(_isRegister ? '注册' : '登录')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 24),
            Text(
              _isRegister ? '创建新账号' : '欢迎回来',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 32),
            TextField(
              controller: _emailController,
              decoration: InputDecoration(
                labelText: '邮箱',
                prefixIcon: const Icon(Icons.email_outlined),
                border: const OutlineInputBorder(),
                errorText: _emailError,
              ),
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _passwordController,
              decoration: InputDecoration(
                labelText: '密码',
                prefixIcon: const Icon(Icons.lock_outline),
                suffixIcon: IconButton(
                  icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                ),
                border: const OutlineInputBorder(),
                errorText: _passwordError,
              ),
              obscureText: _obscurePassword,
              textInputAction: _isRegister ? TextInputAction.next : TextInputAction.done,
              onSubmitted: (_) => _isRegister ? null : _submit(),
            ),
            if (_isRegister) ...[
              const SizedBox(height: 16),
              TextField(
                controller: _confirmPasswordController,
                decoration: InputDecoration(
                  labelText: '确认密码',
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    icon: Icon(_obscureConfirmPassword ? Icons.visibility_off : Icons.visibility),
                    onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                  ),
                  border: const OutlineInputBorder(),
                  errorText: _confirmPasswordError,
                ),
                obscureText: _obscureConfirmPassword,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
              ),
            ],
            const SizedBox(height: 8),
            Text(
              '密码至少 8 位字符',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: state.isLoading ? null : _submit,
                child: state.isLoading
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(_isRegister ? '注册' : '登录'),
              ),
            ),
            const SizedBox(height: 16),
            Center(
              child: TextButton(
                onPressed: () => setState(() {
                  _isRegister = !_isRegister;
                  _emailError = null;
                  _passwordError = null;
                  _confirmPasswordError = null;
                }),
                child: Text(_isRegister ? '已有账号？去登录' : '还没有账号？去注册'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
