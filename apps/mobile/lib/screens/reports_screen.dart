import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../providers/reports_provider.dart';

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  String _period = 'weekly';
  DateTime _selectedDate = DateTime.now();
  Map<String, dynamic>? _executionReport;
  Map<String, dynamic>? _energyReport;
  Map<String, dynamic>? _bestTimeReport;
  bool _loadingExecution = false;
  bool _loadingEnergy = false;
  bool _loadingBestTime = false;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    await Future.wait([
      _loadExecutionReport(),
      _loadEnergyReport(),
      _loadBestTimeReport(),
    ]);
  }

  Future<void> _loadExecutionReport() async {
    setState(() => _loadingExecution = true);
    try {
      final report = await ref.read(reportsProvider).fetchExecutionReport(_period, _selectedDate);
      if (mounted) setState(() => _executionReport = report);
    } catch (e) {
      if (mounted) _showSnack('执行报表加载失败: $e');
    } finally {
      if (mounted) setState(() => _loadingExecution = false);
    }
  }

  Future<void> _loadEnergyReport() async {
    setState(() => _loadingEnergy = true);
    try {
      final report = await ref.read(reportsProvider).fetchEnergyAnalysis();
      if (mounted) setState(() => _energyReport = report);
    } catch (e) {
      if (mounted) _showSnack('能量分析加载失败: $e');
    } finally {
      if (mounted) setState(() => _loadingEnergy = false);
    }
  }

  Future<void> _loadBestTimeReport() async {
    setState(() => _loadingBestTime = true);
    try {
      final report = await ref.read(reportsProvider).fetchBestTimeReport();
      if (mounted) setState(() => _bestTimeReport = report);
    } catch (e) {
      if (mounted) _showSnack('最佳时段加载失败: $e');
    } finally {
      if (mounted) setState(() => _loadingBestTime = false);
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (date != null && mounted) {
      setState(() => _selectedDate = date);
      await _loadExecutionReport();
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('数据报表'),
          bottom: const TabBar(
            tabs: [
              Tab(text: '执行', icon: Icon(Icons.assessment)),
              Tab(text: '能量', icon: Icon(Icons.bolt)),
              Tab(text: '时段', icon: Icon(Icons.access_time)),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _buildExecutionTab(),
            _buildEnergyTab(),
            _buildBestTimeTab(),
          ],
        ),
      ),
    );
  }

  Widget _buildExecutionTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'weekly', label: Text('周')),
                    ButtonSegment(value: 'monthly', label: Text('月')),
                    ButtonSegment(value: 'yearly', label: Text('年')),
                  ],
                  selected: {_period},
                  onSelectionChanged: (set) {
                    setState(() => _period = set.first);
                    _loadExecutionReport();
                  },
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: _pickDate,
                child: Text(_selectedDate.toIso8601String().split('T').first),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_loadingExecution) const Center(child: CircularProgressIndicator()),
          if (!_loadingExecution && _executionReport != null) ...[
            Text('周期: ${_executionReport!['label']}', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            _buildSectionTitle('任务执行'),
            _buildSummaryGrid([
              _SummaryItem('总任务', '${_executionReport!['taskSummary']['total']}'),
              _SummaryItem('已完成', '${_executionReport!['taskSummary']['done']}'),
              _SummaryItem('完成率', '${_executionReport!['taskSummary']['completionRate']}%'),
              _SummaryItem('跳过', '${_executionReport!['taskSummary']['skipped']}'),
            ]),
            const SizedBox(height: 24),
            _buildSectionTitle('习惯打卡'),
            _buildSummaryGrid([
              _SummaryItem('总打卡', '${_executionReport!['habitSummary']['totalCheckins']}'),
              _SummaryItem('完成', '${_executionReport!['habitSummary']['completed']}'),
              _SummaryItem('完成率', '${_executionReport!['habitSummary']['completionRate']}%'),
              _SummaryItem('补打卡', '${_executionReport!['habitSummary']['makeup']}'),
            ]),
            const SizedBox(height: 24),
            _buildSectionTitle('目标状态'),
            _buildSummaryGrid([
              _SummaryItem('进行中', '${_executionReport!['goalCount']['active']}'),
              _SummaryItem('已完成', '${_executionReport!['goalCount']['completed']}'),
              _SummaryItem('已归档', '${_executionReport!['goalCount']['archived']}'),
              _SummaryItem('总计', '${_executionReport!['goalCount']['total']}'),
            ]),
          ],
        ],
      ),
    );
  }

  Widget _buildEnergyTab() {
    final curve = _energyReport?['energyCurve'] as Map<String, dynamic>? ?? {};
    final completionByEnergy = _energyReport?['completionByEnergy'] as Map<String, dynamic>? ?? {};

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_loadingEnergy) const Center(child: CircularProgressIndicator()),
          if (!_loadingEnergy) ...[
            _buildSectionTitle('精力曲线偏好'),
            if (curve.isEmpty)
              const Text('未设置精力曲线，可在设置页配置。')
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: curve.entries.map((e) {
                  return Chip(label: Text('${e.key}:00 → ${_energyLabel(e.value as String)}'));
                }).toList(),
              ),
            const SizedBox(height: 24),
            _buildSectionTitle('按精力等级的任务完成率'),
            if (completionByEnergy.isEmpty)
              const Text('暂无足够任务数据。')
            else
              Column(
                children: completionByEnergy.entries.map((e) {
                  final data = e.value as Map<String, dynamic>;
                  return ListTile(
                    title: Text(_energyLabel(e.key)),
                    trailing: Text('${data['done']}/${data['total']} (${data['rate']}%)'),
                  );
                }).toList(),
              ),
            const SizedBox(height: 24),
            if (_energyReport?['suggestion'] != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('AI 建议', style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      Text('${_energyReport!['suggestion']}'),
                    ],
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildBestTimeTab() {
    final hours = (_bestTimeReport?['hourlyCompletion'] as List<dynamic>? ?? [])
        .map((e) => e as Map<String, dynamic>)
        .toList();
    final bestHours = (_bestTimeReport?['bestHours'] as List<dynamic>? ?? [])
        .map((e) => e as int)
        .toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_loadingBestTime) const Center(child: CircularProgressIndicator()),
          if (!_loadingBestTime) ...[
            _buildSectionTitle('最佳完成时段'),
            if (bestHours.isEmpty)
              const Text('暂无打卡数据。')
            else
              Text('近 90 天完成次数最多的时段：${bestHours.map((h) => '$h:00').join('、')}'),
            const SizedBox(height: 24),
            _buildSectionTitle('每小时完成分布'),
            if (hours.isEmpty)
              const Text('暂无数据。')
            else
              SizedBox(
                height: 220,
                child: _buildBestTimeBarChart(hours, bestHours),
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildSummaryGrid(List<_SummaryItem> items) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      childAspectRatio: 2.5,
      children: items.map((item) => Card(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(item.value, style: Theme.of(context).textTheme.titleLarge),
              Text(item.label, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      )).toList(),
    );
  }

  Widget _buildBestTimeBarChart(List<Map<String, dynamic>> hours, List<int> bestHours) {
    final maxCount = hours.isEmpty
        ? 0
        : hours.map((h) => (h['count'] as num).toInt()).reduce((a, b) => a > b ? a : b);

    return BarChart(
      BarChartData(
        maxY: maxCount == 0 ? 1 : maxCount.toDouble(),
        barGroups: hours.map((h) {
          final hour = h['hour'] as int;
          final count = (h['count'] as num).toInt();
          final isBest = bestHours.isNotEmpty && hour == bestHours.first;
          return BarChartGroupData(
            x: hour,
            barRods: [
              BarChartRodData(
                toY: count.toDouble(),
                color: isBest
                    ? Theme.of(context).colorScheme.primary
                    : Theme.of(context).colorScheme.primaryContainer,
                width: 10,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
              ),
            ],
          );
        }).toList(),
        titlesData: FlTitlesData(
          leftTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: true, reservedSize: 28),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (value, meta) {
                if (value.toInt() % 4 != 0) return const SizedBox.shrink();
                return Text('${value.toInt()}', style: const TextStyle(fontSize: 10));
              },
              reservedSize: 22,
            ),
          ),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        borderData: FlBorderData(show: false),
        gridData: const FlGridData(show: true, drawVerticalLine: false),
        barTouchData: BarTouchData(
          touchTooltipData: BarTouchTooltipData(
            getTooltipItem: (group, groupIndex, rod, rodIndex) {
              return BarTooltipItem(
                '${group.x}:00\n${rod.toY.toInt()} 次',
                const TextStyle(color: Colors.white),
              );
            },
          ),
        ),
      ),
    );
  }

  String _energyLabel(String level) {
    const map = {'high': '高', 'medium': '中', 'low': '低'};
    return map[level] ?? level;
  }
}

class _SummaryItem {
  final String label;
  final String value;
  _SummaryItem(this.label, this.value);
}
