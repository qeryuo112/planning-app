import {
  Injectable,
  Logger,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import {
  reportCacheEvents,
  ReportCacheEvent,
} from "../../common/events/report-cache.events";

export interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

export interface ExecutionSummary {
  total: number;
  done: number;
  skipped: number;
  postponed: number;
  completionRate: number;
}

export interface HabitSummary {
  totalCheckins: number;
  completed: number;
  partial: number;
  skipped: number;
  makeup: number;
  completionRate: number;
}

@Injectable()
export class ReportsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportsService.name);
  private readonly CACHE_TTL_SECONDS = 3600;

  constructor(
    private readonly prisma: PrismaClient,
    @Inject("REDIS_CLIENT") private readonly redis: Redis,
  ) {}

  onModuleInit(): void {
    reportCacheEvents.on(ReportCacheEvent.INVALIDATE, this.handleInvalidation);
  }

  onModuleDestroy(): void {
    reportCacheEvents.off(ReportCacheEvent.INVALIDATE, this.handleInvalidation);
  }

  private readonly handleInvalidation = async (
    userId: string,
  ): Promise<void> => {
    await this.invalidateCache(userId);
  };

  private cacheKey(
    userId: string,
    reportType: "execution" | "energy" | "best-time",
    suffix: string,
  ): string {
    return `reports:${userId}:${reportType}:${suffix}`;
  }

  private async getCached<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.logger.debug(`缓存命中: ${key}`);
        return JSON.parse(cached) as T;
      }
    } catch (error) {
      this.logger.warn(`读取缓存失败 ${key}: ${error}`);
    }
    return null;
  }

  private async setCached<T>(key: string, value: T): Promise<void> {
    try {
      await this.redis.setex(
        key,
        this.CACHE_TTL_SECONDS,
        JSON.stringify(value),
      );
      this.logger.debug(`缓存写入: ${key}`);
    } catch (error) {
      this.logger.warn(`写入缓存失败 ${key}: ${error}`);
    }
  }

  async invalidateCache(userId: string): Promise<void> {
    const pattern = `reports:${userId}:*`;
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(
          `已清除用户 ${userId} 的报表缓存，共 ${keys.length} 个`,
        );
      }
    } catch (error) {
      this.logger.warn(`清除缓存失败 ${pattern}: ${error}`);
    }
  }

  async getExecutionReport(
    userId: string,
    period: "weekly" | "monthly" | "yearly",
    dateInput: string,
  ) {
    const cacheSuffix = `${period}:${dateInput}`;
    const key = this.cacheKey(userId, "execution", cacheSuffix);

    const cached = await this.getCached<unknown>(key);
    if (cached) return cached as any;

    const result = await this.buildExecutionReport(userId, period, dateInput);
    await this.setCached(key, result);
    return result;
  }

  private async buildExecutionReport(
    userId: string,
    period: "weekly" | "monthly" | "yearly",
    dateInput: string,
  ) {
    const { start, end, label } = this.getPeriodRange(period, dateInput);
    this.logger.debug(
      `执行报表: user=${userId}, period=${period}, label=${label}`,
    );

    const [tasks, checkins, goals] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          userId,
          scheduledDate: { gte: start, lte: end },
        },
        select: { status: true, energyLevel: true },
      }),
      this.prisma.checkin.findMany({
        where: {
          userId,
          date: { gte: start, lte: end },
        },
        select: { result: true, habitId: true },
      }),
      this.prisma.goal.findMany({
        where: { userId },
        select: { id: true, title: true, status: true },
      }),
    ]);

    const taskSummary = this.summarizeTasks(tasks);
    const habitSummary = this.summarizeHabits(checkins);

    return {
      period,
      label,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      taskSummary,
      habitSummary,
      goalCount: {
        active: goals.filter((g) => g.status === "active").length,
        completed: goals.filter((g) => g.status === "completed").length,
        archived: goals.filter((g) => g.status === "archived").length,
        total: goals.length,
      },
    };
  }

  async getEnergyAnalysis(userId: string) {
    const key = this.cacheKey(userId, "energy", "current");

    const cached = await this.getCached<unknown>(key);
    if (cached) return cached as any;

    const result = await this.buildEnergyAnalysis(userId);
    await this.setCached(key, result);
    return result;
  }

  private async buildEnergyAnalysis(userId: string) {
    this.logger.debug(`能量曲线分析: user=${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { energyCurve: true },
    });

    const energyCurve = (user?.energyCurve as Record<string, string>) ?? {};

    const [tasks, checkins] = await Promise.all([
      this.prisma.task.findMany({
        where: { userId, status: { in: ["done", "skipped", "postponed"] } },
        select: { energyLevel: true, status: true },
      }),
      this.prisma.checkin.findMany({
        where: { userId },
        select: { result: true },
      }),
    ]);

    const completionByEnergy: Record<
      string,
      { total: number; done: number; rate: number }
    > = {};
    for (const task of tasks) {
      const bucket = completionByEnergy[task.energyLevel] ?? {
        total: 0,
        done: 0,
        rate: 0,
      };
      bucket.total++;
      if (task.status === "done") bucket.done++;
      bucket.rate =
        bucket.total > 0 ? Math.round((bucket.done / bucket.total) * 100) : 0;
      completionByEnergy[task.energyLevel] = bucket;
    }

    const totalCompleted = checkins.filter((c) =>
      ["completed", "partial", "makeup"].includes(c.result),
    ).length;
    const totalSkipped = checkins.filter((c) => c.result === "skipped").length;

    let suggestion = "暂无足够数据生成能量建议。";
    if (Object.keys(completionByEnergy).length > 0) {
      const best = Object.entries(completionByEnergy).sort(
        (a, b) => b[1].rate - a[1].rate,
      )[0];
      if (best && best[1].rate > 0) {
        suggestion = `在「${this.energyLabel(best[0])}」精力等级的任务上完成率最高（${best[1].rate}%），建议把重要任务安排在该时段。`;
      }
    }

    return {
      energyCurve,
      completionByEnergy,
      checkinSummary: {
        totalCompleted,
        totalSkipped,
      },
      suggestion,
    };
  }

  async getBestTimeReport(userId: string) {
    const key = this.cacheKey(userId, "best-time", "90d");

    const cached = await this.getCached<unknown>(key);
    if (cached) return cached as any;

    const result = await this.buildBestTimeReport(userId);
    await this.setCached(key, result);
    return result;
  }

  private async buildBestTimeReport(userId: string) {
    this.logger.debug(`最佳完成时段: user=${userId}`);

    const since = new Date();
    since.setDate(since.getDate() - 90);

    const checkins = await this.prisma.checkin.findMany({
      where: {
        userId,
        createdAt: { gte: since },
        result: { in: ["completed", "partial", "makeup"] },
      },
      select: { createdAt: true, result: true },
    });

    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: 0,
      completed: 0,
      rate: 0,
    }));

    for (const checkin of checkins) {
      const hour = new Date(checkin.createdAt).getUTCHours();
      hours[hour].count++;
      hours[hour].completed++;
    }

    for (const h of hours) {
      h.rate = h.count > 0 ? Math.round((h.completed / h.count) * 100) : 0;
    }

    const bestHours = hours
      .filter((h) => h.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((h) => h.hour);

    return {
      periodDays: 90,
      hourlyCompletion: hours,
      bestHours,
    };
  }

  private getPeriodRange(
    period: "weekly" | "monthly" | "yearly",
    dateInput: string,
  ): PeriodRange {
    const date = new Date(`${dateInput}T00:00:00.000Z`);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();

    if (period === "weekly") {
      const dow = date.getUTCDay();
      const diff = (dow === 0 ? -6 : 1) - dow;
      const start = new Date(Date.UTC(year, month, day + diff));
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);
      end.setUTCHours(23, 59, 59, 999);
      return {
        start,
        end,
        label: `${this.toDateKey(start)} ~ ${this.toDateKey(end)}`,
      };
    }

    if (period === "monthly") {
      const start = new Date(Date.UTC(year, month, 1));
      const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
      return {
        start,
        end,
        label: `${year}-${String(month + 1).padStart(2, "0")}`,
      };
    }

    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    return { start, end, label: `${year}` };
  }

  private summarizeTasks(tasks: Array<{ status: string }>): ExecutionSummary {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const skipped = tasks.filter((t) => t.status === "skipped").length;
    const postponed = tasks.filter((t) => t.status === "postponed").length;
    return {
      total,
      done,
      skipped,
      postponed,
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }

  private summarizeHabits(
    checkins: Array<{ result: string; habitId: string | null }>,
  ): HabitSummary {
    const totalCheckins = checkins.length;
    const completed = checkins.filter((c) => c.result === "completed").length;
    const partial = checkins.filter((c) => c.result === "partial").length;
    const skipped = checkins.filter((c) => c.result === "skipped").length;
    const makeup = checkins.filter((c) => c.result === "makeup").length;
    const success = completed + partial + makeup;

    return {
      totalCheckins,
      completed,
      partial,
      skipped,
      makeup,
      completionRate:
        totalCheckins > 0 ? Math.round((success / totalCheckins) * 100) : 0,
    };
  }

  private toDateKey(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  private energyLabel(level: string): string {
    const map: Record<string, string> = {
      high: "高",
      medium: "中",
      low: "低",
    };
    return map[level] ?? level;
  }
}
