import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { PrismaClient } from "@prisma/client";
import { ModelAdapter } from "./model-adapter.service";

export interface ProfileStats {
  totalTasks: number;
  doneTasks: number;
  skippedTasks: number;
  postponedTasks: number;
  completionRate: number;
  totalHabits: number;
  totalCheckins: number;
  completedCheckins: number;
  checkinRate: number;
  activeGoals: number;
  completedGoals: number;
  topPostponeReasons: Array<{ reason: string; count: number }>;
  topEnergyLevel: string | null;
  recentActivityDays: number;
}

export interface UserProfileSummary {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestedFocus: string;
  riskAreas: string[];
}

export interface PersonalizedRecommendations {
  nextGoals: string[];
  habitSuggestions: string[];
  scheduleTips: string[];
}

@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);
  private readonly promptVersion = "insights-v1";

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaClient,
    private readonly modelAdapter: ModelAdapter,
  ) {}

  async getProfileSummary(userId: string, useSnapshot = false) {
    this.logger.debug(
      `获取用户画像摘要: user=${userId}, useSnapshot=${useSnapshot}`,
    );

    if (useSnapshot) {
      const snapshot = await this.getLatestProfileSnapshot(userId);
      if (snapshot) {
        this.logger.debug(`命中用户画像快照: user=${userId}`);
        return snapshot;
      }
    }

    const result = await this.generateProfileSummary(userId);

    // 实时生成成功后写入快照，供后续读取与 cron 使用。
    if (!result.fallback && !result.error) {
      await this.saveProfileSnapshot(userId, result);
    }

    return result;
  }

  private async generateProfileSummary(userId: string) {
    this.logger.debug(`实时生成用户画像摘要: user=${userId}`);
    const stats = await this.computeProfileStats(userId);

    const model = this.resolveModel();
    const config = this.modelAdapter.getConfig(model);
    const costCheck = await this.checkDailyCostLimit(userId, model);

    let fallbackReason: string | null = null;
    let summary: UserProfileSummary;
    let latency = 0;
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    if (!config.apiKey || costCheck.exceeded) {
      fallbackReason = costCheck.exceeded
        ? `日费用上限已触发（当前 $${costCheck.current.toFixed(4)} / $${costCheck.limit.toFixed(2)} USD）`
        : "AI 模型未配置";
      this.logger.warn(fallbackReason);
      summary = this.buildFallbackSummary(stats);
    } else {
      const start = Date.now();
      const response =
        await this.modelAdapter.generateStructured<UserProfileSummary>(
          this.buildProfilePrompt(stats),
          {
            type: "object",
            properties: {
              summary: { type: "string" },
              strengths: { type: "array", items: { type: "string" } },
              weaknesses: { type: "array", items: { type: "string" } },
              suggestedFocus: { type: "string" },
              riskAreas: { type: "array", items: { type: "string" } },
            },
            required: [
              "summary",
              "strengths",
              "weaknesses",
              "suggestedFocus",
              "riskAreas",
            ],
          },
          model,
        );
      latency = Date.now() - start;
      usage = response.usage ?? usage;

      if (response.data) {
        summary = response.data;
      } else {
        fallbackReason = response.error ?? "模型输出解析失败，已降级";
        summary = this.buildFallbackSummary(stats);
      }
    }

    const actualCost = this.estimateCost(
      config.model,
      usage.promptTokens,
      usage.completionTokens,
    );

    if (actualCost !== null && !fallbackReason?.includes("未配置")) {
      await this.prisma.aIOperation.create({
        data: {
          userId,
          model: config.model,
          promptVersion: this.promptVersion,
          inputTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
          latencyMs: latency,
          cost: actualCost,
          result: {
            type: "profile-summary",
            fallback: !!fallbackReason,
            error: fallbackReason ?? undefined,
            dailyCostAtCall: Number(
              (costCheck.current + (actualCost ?? 0)).toFixed(6),
            ),
          } as any,
        },
      });
    }

    return {
      ...summary,
      stats,
      fallback: !!fallbackReason,
      error: fallbackReason ?? undefined,
    };
  }

  async getPersonalizedRecommendations(userId: string, goalId?: string) {
    this.logger.debug(
      `个性化计划推荐: user=${userId}, goalId=${goalId ?? "n/a"}`,
    );
    const stats = await this.computeProfileStats(userId);
    const activeGoal = goalId
      ? await this.prisma.goal.findFirst({
          where: { id: goalId, userId },
          select: { id: true, title: true, horizon: true },
        })
      : null;

    const recommendations: PersonalizedRecommendations = {
      nextGoals: [],
      habitSuggestions: [],
      scheduleTips: [],
    };

    if (stats.completionRate >= 80) {
      recommendations.scheduleTips.push(
        "你当前的任务完成率很高，可以考虑在计划中增加挑战性目标。",
      );
    } else if (stats.completionRate < 50) {
      recommendations.scheduleTips.push(
        "任务完成率偏低，建议把大任务拆成 25 分钟以内的小任务，并减少并行目标。",
      );
    }

    if (stats.checkinRate >= 80) {
      recommendations.habitSuggestions.push(
        "习惯打卡稳定，可以尝试叠加一个新习惯（如每周 3 次复盘）。",
      );
    } else {
      recommendations.habitSuggestions.push(
        "习惯连续性不足，建议优先保留 1-2 个核心习惯，固定在同一时段触发。",
      );
    }

    if (stats.topPostponeReasons.length > 0) {
      const top = stats.topPostponeReasons[0];
      recommendations.scheduleTips.push(
        `最近推迟原因最多的是「${top.reason}」，建议在计划时预留缓冲时间。`,
      );
    }

    if (activeGoal) {
      recommendations.nextGoals.push(
        `继续推进「${activeGoal.title}」，按当前节奏拆分下一阶段任务。`,
      );
    } else if (stats.activeGoals === 0) {
      recommendations.nextGoals.push(
        "当前没有进行中目标，建议从 7 天短期目标开始，快速获得正反馈。",
      );
    }

    if (stats.topEnergyLevel === "high") {
      recommendations.scheduleTips.push(
        "你在高精力时段表现最好，把最难的任务安排在该时段。",
      );
    }

    return {
      goalId: activeGoal?.id,
      recommendations,
      stats,
    };
  }

  /**
   * 刷新并保存用户画像快照。
   * 供 cron 与前端「立即刷新」调用。
   */
  async refreshProfileSnapshot(userId: string) {
    this.logger.debug(`刷新用户画像快照: user=${userId}`);
    const result = await this.generateProfileSummary(userId);
    await this.saveProfileSnapshot(userId, result);
    return result;
  }

  /**
   * 每周日 03:00 自动刷新所有活跃用户画像快照。
   * 当前应用为个人使用，循环用户列表串行执行，避免并发费用突增。
   */
  @Cron("0 3 * * 0")
  async autoRefreshProfiles() {
    const enabled =
      this.configService.get<string>("AI_AUTO_PROFILE_REFRESH_ENABLED") !==
      "false";
    if (!enabled) {
      this.logger.debug("用户画像自动刷新已关闭，跳过");
      return;
    }

    this.logger.debug("开始自动刷新用户画像快照");
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const users = await this.prisma.user.findMany({
      where: { updatedAt: { gte: since } },
      select: { id: true },
    });

    for (const user of users) {
      try {
        await this.refreshProfileSnapshot(user.id);
      } catch (err) {
        this.logger.error(
          `自动刷新用户画像失败: user=${user.id}, error=${(err as Error).message}`,
        );
      }
    }

    this.logger.debug(`用户画像自动刷新完成，共 ${users.length} 个用户`);
  }

  private async saveProfileSnapshot(
    userId: string,
    result: UserProfileSummary & {
      stats: ProfileStats;
      fallback: boolean;
      error?: string;
    },
  ) {
    await this.prisma.userProfileSnapshot.create({
      data: {
        userId,
        summary: result as any,
        stats: result.stats as any,
        fallback: result.fallback,
        error: result.error ?? null,
        refreshedAt: new Date(),
      },
    });
  }

  private async getLatestProfileSnapshot(userId: string) {
    const snapshot = await this.prisma.userProfileSnapshot.findFirst({
      where: { userId },
      orderBy: { refreshedAt: "desc" },
    });

    if (!snapshot) return null;

    return {
      ...(snapshot.summary as unknown as UserProfileSummary),
      stats: snapshot.stats as unknown as ProfileStats,
      fallback: snapshot.fallback,
      error: snapshot.error ?? undefined,
      refreshedAt: snapshot.refreshedAt.toISOString(),
    };
  }

  private async computeProfileStats(userId: string): Promise<ProfileStats> {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const [tasks, habits, checkins, goals, recentCheckins] = await Promise.all([
      this.prisma.task.findMany({
        where: { userId },
        select: { status: true, energyLevel: true },
      }),
      this.prisma.habit.count({ where: { userId } }),
      this.prisma.checkin.findMany({
        where: { userId },
        select: { result: true, blockReasonTag: true },
      }),
      this.prisma.goal.findMany({
        where: { userId },
        select: { status: true },
      }),
      this.prisma.checkin.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ]);

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === "done").length;
    const skippedTasks = tasks.filter((t) => t.status === "skipped").length;
    const postponedTasks = tasks.filter((t) => t.status === "postponed").length;

    const totalCheckins = checkins.length;
    const completedCheckins = checkins.filter((c) =>
      ["completed", "partial", "makeup"].includes(c.result),
    ).length;

    const energyCounts: Record<string, number> = {};
    for (const task of tasks) {
      energyCounts[task.energyLevel] =
        (energyCounts[task.energyLevel] ?? 0) + 1;
    }
    const topEnergyLevel =
      Object.entries(energyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const reasonCounts: Record<string, number> = {};
    for (const checkin of checkins) {
      if (checkin.blockReasonTag) {
        reasonCounts[checkin.blockReasonTag] =
          (reasonCounts[checkin.blockReasonTag] ?? 0) + 1;
      }
    }
    const topPostponeReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const activeDays = new Set(
      recentCheckins.map((c) => c.createdAt.toISOString().split("T")[0]),
    ).size;

    return {
      totalTasks,
      doneTasks,
      skippedTasks,
      postponedTasks,
      completionRate:
        totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
      totalHabits: habits,
      totalCheckins,
      completedCheckins,
      checkinRate:
        totalCheckins > 0
          ? Math.round((completedCheckins / totalCheckins) * 100)
          : 0,
      activeGoals: goals.filter((g) => g.status === "active").length,
      completedGoals: goals.filter((g) => g.status === "completed").length,
      topPostponeReasons,
      topEnergyLevel,
      recentActivityDays: activeDays,
    };
  }

  private buildProfilePrompt(stats: ProfileStats): string {
    return `请根据以下用户行为数据生成一段用户画像摘要（中文）：

- 总任务数: ${stats.totalTasks}, 完成: ${stats.doneTasks}, 跳过: ${stats.skippedTasks}, 推迟: ${stats.postponedTasks}, 完成率: ${stats.completionRate}%
- 习惯数: ${stats.totalHabits}, 总打卡: ${stats.totalCheckins}, 成功打卡: ${stats.completedCheckins}, 打卡率: ${stats.checkinRate}%
- 进行中目标: ${stats.activeGoals}, 已完成目标: ${stats.completedGoals}
- 近 90 天活跃天数: ${stats.recentActivityDays}
- 最常见的任务精力等级: ${stats.topEnergyLevel ?? "未知"}
- 最常见的推迟原因: ${stats.topPostponeReasons.map((r) => `${r.reason}(${r.count}次)`).join("、") || "无"}

请输出 strengths/weaknesses/suggestedFocus/riskAreas 各 2-4 条，summary 100 字以内。`;
  }

  private buildFallbackSummary(stats: ProfileStats): UserProfileSummary {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const riskAreas: string[] = [];

    if (stats.completionRate >= 70) {
      strengths.push("任务完成率较高，执行力强。");
    } else {
      weaknesses.push("任务完成率有待提升。");
      riskAreas.push("任务堆积可能导致目标延期。");
    }

    if (stats.checkinRate >= 70) {
      strengths.push("习惯打卡稳定，自律性较好。");
    } else {
      weaknesses.push("习惯坚持度不足。");
      riskAreas.push("习惯中断可能影响长期目标。");
    }

    if (stats.recentActivityDays >= 7) {
      strengths.push("近 90 天保持活跃。");
    } else {
      weaknesses.push("近期活跃度较低。");
      riskAreas.push("长期未使用可能导致计划脱轨。");
    }

    return {
      summary: `你当前完成率 ${stats.completionRate}%，打卡率 ${stats.checkinRate}%，共 ${stats.activeGoals} 个进行中目标。`,
      strengths,
      weaknesses,
      suggestedFocus:
        stats.completionRate < 60
          ? "优先减少并行任务，确保核心目标推进。"
          : "在稳定执行的基础上，尝试挑战更高难度目标。",
      riskAreas,
    };
  }

  private resolveModel(): string {
    return (
      this.configService.get<string>("AI_STRONG_MODEL") ??
      this.configService.get<string>("OPENAI_MODEL", "gpt-4o-mini")
    );
  }

  private estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number | null {
    const prices: Record<string, { input: number; output: number }> = {
      "gpt-4o-mini": { input: 0.15, output: 0.6 },
      "gpt-4o": { input: 5.0, output: 15.0 },
      "deepseek-chat": { input: 0.14, output: 0.28 },
      "deepseek-reasoner": { input: 0.55, output: 2.19 },
      "deepseek-v4-flash": { input: 0.1, output: 0.2 },
    };
    const price = prices[model];
    if (!price) return null;
    return (
      (inputTokens * price.input + outputTokens * price.output) / 1_000_000
    );
  }

  private estimateMaxCallCost(model: string): number {
    return this.estimateCost(model, 2000, 4000) ?? 1.0;
  }

  private getDailyCostLimit(): number {
    const raw = this.configService.get<string>("AI_DAILY_COST_LIMIT_USD");
    const parsed = raw ? parseFloat(raw) : NaN;
    return !isNaN(parsed) && parsed > 0 ? parsed : 1.0;
  }

  private async getDailyCostSoFar(userId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const agg = await this.prisma.aIOperation.aggregate({
      _sum: { cost: true },
      where: {
        userId,
        createdAt: { gte: startOfDay },
      },
    });
    return (agg._sum?.cost as number) ?? 0;
  }

  private async checkDailyCostLimit(
    userId: string,
    model: string,
  ): Promise<{ exceeded: boolean; current: number; limit: number }> {
    const limit = this.getDailyCostLimit();
    const current = await this.getDailyCostSoFar(userId);
    const estimated = this.estimateMaxCallCost(model);
    return {
      exceeded: current + estimated > limit,
      current,
      limit,
    };
  }
}
