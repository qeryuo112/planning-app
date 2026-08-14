import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { CreateHabitDto } from "./dto/create-habit.dto";
import { UpdateHabitDto } from "./dto/update-habit.dto";
import { HabitCheckinDto } from "./dto/habit-checkin.dto";
import { SyncEventsService } from "../sync/sync-events.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { emitReportCacheInvalidation } from "../../common/events/report-cache.events";

/**
 * 习惯服务
 * 负责习惯的 CRUD、可选关联目标、以及习惯打卡。
 */
@Injectable()
export class HabitsService {
  private readonly logger = new Logger(HabitsService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly syncEvents: SyncEventsService,
    private readonly analytics: AnalyticsService,
  ) {}

  async create(userId: string, dto: CreateHabitDto) {
    this.logger.debug(`创建习惯: ${dto.title}, user=${userId}`);

    if (dto.goalIds?.length) {
      await this.ensureGoalsExist(userId, dto.goalIds);
    }

    const habit = await this.prisma.habit.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        frequency: dto.frequency,
        preferredTime: dto.preferredTime,
        energyLevel: dto.energyLevel ?? "medium",
        minimumStandard: dto.minimumStandard,
        goalLinks: {
          create: dto.goalIds?.map((goalId) => ({ goalId })) || [],
        },
      },
      include: { goalLinks: { include: { goal: true } }, checkins: true },
    });

    await this.syncEvents.createEvent(userId, {
      eventType: "habit.created",
      targetType: "habit",
      targetId: habit.id,
      payload: {
        title: habit.title,
        frequency: habit.frequency,
      },
    });

    void this.analytics.track({
      userId,
      eventType: "habit.created",
      targetId: habit.id,
      metadata: {
        title: habit.title,
        frequency: habit.frequency,
        energyLevel: habit.energyLevel,
      },
    });

    emitReportCacheInvalidation(userId);
    return habit;
  }

  async findAll(userId: string) {
    this.logger.debug(`查询习惯列表: user=${userId}`);

    return this.prisma.habit.findMany({
      where: { userId },
      include: { goalLinks: { include: { goal: true } }, checkins: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(userId: string, id: string) {
    this.logger.debug(`查询习惯详情: ${id}, user=${userId}`);

    const habit = await this.prisma.habit.findFirst({
      where: { id, userId },
      include: { goalLinks: { include: { goal: true } }, checkins: true },
    });

    if (!habit) {
      throw new NotFoundException("习惯不存在");
    }

    return habit;
  }

  async update(userId: string, id: string, dto: UpdateHabitDto) {
    this.logger.debug(`更新习惯: ${id}, user=${userId}`);

    await this.findOne(userId, id);

    if (dto.goalIds?.length) {
      await this.ensureGoalsExist(userId, dto.goalIds);
    }

    const habit = await this.prisma.habit.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.preferredTime !== undefined && {
          preferredTime: dto.preferredTime,
        }),
        ...(dto.energyLevel !== undefined && { energyLevel: dto.energyLevel }),
        ...(dto.minimumStandard !== undefined && {
          minimumStandard: dto.minimumStandard,
        }),
        ...(dto.goalIds !== undefined && {
          goalLinks: {
            deleteMany: {},
            create: dto.goalIds.map((goalId) => ({ goalId })),
          },
        }),
      },
      include: { goalLinks: { include: { goal: true } }, checkins: true },
    });

    emitReportCacheInvalidation(userId);
    return habit;
  }

  async remove(userId: string, id: string) {
    this.logger.debug(`删除习惯: ${id}, user=${userId}`);

    await this.findOne(userId, id);
    await this.prisma.habit.delete({ where: { id } });

    emitReportCacheInvalidation(userId);
    return { id, deleted: true };
  }

  async checkin(userId: string, id: string, dto: HabitCheckinDto) {
    this.logger.debug(`习惯打卡: ${id}, user=${userId}`);

    await this.findOne(userId, id);

    const date = dto.date ? new Date(`${dto.date}T00:00:00.000Z`) : new Date();

    const checkin = await this.prisma.checkin.create({
      data: {
        userId,
        habitId: id,
        date,
        result: dto.result ?? "completed",
        actualMinutes: dto.actualMinutes,
        qualityRating: dto.qualityRating,
        isMakeup: dto.isMakeup ?? false,
        blockReasonTag: dto.blockReasonTag,
        note: dto.note,
      },
    });

    await this.syncEvents.createEvent(userId, {
      eventType: "habit.checkin",
      targetType: "habit",
      targetId: id,
      payload: {
        result: checkin.result,
        date: checkin.date.toISOString(),
      },
    });

    void this.analytics.track({
      userId,
      eventType: "habit.checkin",
      targetId: id,
      metadata: {
        result: checkin.result,
        actualMinutes: dto.actualMinutes,
        qualityRating: dto.qualityRating,
        date: checkin.date.toISOString(),
      },
    });

    emitReportCacheInvalidation(userId);
    return checkin;
  }

  async stats(userId: string, id: string, days = 30) {
    this.logger.debug(`习惯统计: ${id}, days=${days}, user=${userId}`);

    await this.findOne(userId, id);

    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const checkins = await this.prisma.checkin.findMany({
      where: {
        habitId: id,
        userId,
        date: { gte: start, lte: end },
      },
      orderBy: { date: "asc" },
    });

    const dateMap = new Map<string, string>();
    for (const c of checkins) {
      const key = c.date.toISOString().split("T")[0];
      const status =
        c.result === "completed" || c.result === "partial" ? "done" : "skipped";
      // 同一天多次打卡，以完成状态优先
      if (status === "done" || !dateMap.has(key)) {
        dateMap.set(key, status);
      }
    }

    const heatmap: Array<{ date: string; status: string }> = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0];
      heatmap.push({ date: key, status: dateMap.get(key) ?? "none" });
    }

    const statuses = heatmap.map((h) => h.status);
    const doneCount = statuses.filter((s) => s === "done").length;
    const completionRate = days > 0 ? doneCount / days : 0;

    let currentStreak = 0;
    let longestStreak = 0;
    let streak = 0;

    for (const status of statuses) {
      if (status === "done") {
        streak += 1;
        longestStreak = Math.max(longestStreak, streak);
      } else {
        streak = 0;
      }
    }

    // 当前连续打卡从最近一天往前算
    for (let i = statuses.length - 1; i >= 0; i--) {
      if (statuses[i] === "done") {
        currentStreak += 1;
      } else {
        break;
      }
    }

    return {
      habitId: id,
      days,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      heatmap,
      doneCount,
      skippedCount: statuses.filter((s) => s === "skipped").length,
      completionRate: Number(completionRate.toFixed(4)),
      currentStreak,
      longestStreak,
    };
  }

  private async ensureGoalsExist(userId: string, goalIds: string[]) {
    const goals = await this.prisma.goal.findMany({
      where: { id: { in: goalIds }, userId },
      select: { id: true },
    });

    if (goals.length !== goalIds.length) {
      throw new NotFoundException("部分关联目标不存在");
    }
  }
}
