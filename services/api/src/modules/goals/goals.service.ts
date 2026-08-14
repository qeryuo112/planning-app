import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { CreateGoalDto } from "./dto/create-goal.dto";
import { UpdateGoalDto } from "./dto/update-goal.dto";
import { SyncEventsService } from "../sync/sync-events.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { emitReportCacheInvalidation } from "../../common/events/report-cache.events";

export interface GoalProgress {
  goalId: string;
  progress: number;
  milestones: Array<{ id: string; title: string; progress: number }>;
}

/**
 * 目标服务
 * 负责目标与里程碑的 CRUD，以及基于任务完成情况的目标进度重算。
 */
@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly syncEvents: SyncEventsService,
    private readonly analytics: AnalyticsService,
  ) {}

  async create(userId: string, dto: CreateGoalDto) {
    this.logger.debug(`创建目标: ${dto.title}`);

    const defaultWeight = 1 / Math.max(1, dto.milestones?.length || 1);
    const milestones =
      dto.milestones?.map((m) => ({
        title: m.title,
        dueDate: m.dueDate ? new Date(m.dueDate) : null,
        weight: m.weight ?? defaultWeight,
      })) || [];

    const goal = await this.prisma.goal.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        horizon: dto.horizon,
        parentId: dto.parentId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        successCriteria: dto.successCriteria || [],
        milestones: { create: milestones },
      },
      include: { milestones: true },
    });

    await this.syncEvents.createEvent(userId, {
      eventType: "goal.created",
      targetType: "goal",
      targetId: goal.id,
      payload: {
        title: goal.title,
        horizon: goal.horizon,
      },
    });

    void this.analytics.track({
      userId,
      eventType: "goal.created",
      targetId: goal.id,
      metadata: {
        title: goal.title,
        horizon: goal.horizon,
        milestoneCount: milestones.length,
      },
    });

    emitReportCacheInvalidation(userId);
    return goal;
  }

  async findAll(userId: string) {
    this.logger.debug(`查询目标列表: user=${userId}`);

    return this.prisma.goal.findMany({
      where: { userId },
      include: { milestones: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(userId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, userId },
      include: {
        milestones: true,
        children: true,
        projects: { include: { tasks: true } },
      },
    });

    if (!goal) {
      throw new NotFoundException("目标不存在");
    }

    return goal;
  }

  async update(userId: string, id: string, dto: UpdateGoalDto) {
    await this.findOne(userId, id);

    const goal = await this.prisma.goal.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.horizon && { horizon: dto.horizon }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
        ...(dto.successCriteria && { successCriteria: dto.successCriteria }),
      },
      include: { milestones: true },
    });

    emitReportCacheInvalidation(userId);
    return goal;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.goal.delete({ where: { id } });
    emitReportCacheInvalidation(userId);
    return { id, deleted: true };
  }

  async stats(userId: string, id: string) {
    this.logger.debug(`目标统计: ${id}`);

    const goal = await this.prisma.goal.findFirst({
      where: { id, userId },
      include: {
        milestones: { include: { tasks: { include: { checkins: true } } } },
        projects: { include: { tasks: { include: { checkins: true } } } },
        goalLinks: { include: { habit: { include: { checkins: true } } } },
      },
    });

    if (!goal) {
      throw new NotFoundException("目标不存在");
    }

    const milestoneProgresses = goal.milestones.map((milestone) => {
      const tasks = milestone.tasks;
      if (tasks.length === 0) {
        return { id: milestone.id, title: milestone.title, progress: 0 };
      }
      const totalWeight = tasks.reduce(
        (sum, task) => sum + (task.weight || 1),
        0,
      );
      const doneWeight = tasks
        .filter((task) => task.status === "done")
        .reduce((sum, task) => sum + (task.weight || 1), 0);
      return {
        id: milestone.id,
        title: milestone.title,
        progress: totalWeight === 0 ? 0 : doneWeight / totalWeight,
      };
    });

    const totalMilestoneWeight = goal.milestones.reduce(
      (sum, m) => sum + (m.weight || 1),
      0,
    );
    const progress =
      totalMilestoneWeight === 0
        ? 0
        : goal.milestones.reduce((sum, milestone, index) => {
            const milestoneProgress = milestoneProgresses[index]?.progress || 0;
            return sum + milestoneProgress * (milestone.weight || 1);
          }, 0) / totalMilestoneWeight;

    const allCheckins = [
      ...goal.milestones.flatMap((m) => m.tasks.flatMap((t) => t.checkins)),
      ...goal.projects.flatMap((p) => p.tasks.flatMap((t) => t.checkins)),
      ...goal.goalLinks.flatMap((l) => l.habit.checkins),
    ];

    const dateMap = new Map<string, boolean>();
    for (const c of allCheckins) {
      const key = c.date.toISOString().split("T")[0];
      const done = c.result === "completed" || c.result === "partial";
      if (done) dateMap.set(key, true);
    }

    const today = new Date();
    const todayKey = today.toISOString().split("T")[0];
    let currentStreak = 0;
    for (let d = new Date(today); ; d.setDate(d.getDate() - 1)) {
      const key = d.toISOString().split("T")[0];
      if (dateMap.get(key)) {
        currentStreak += 1;
      } else if (key === todayKey) {
        continue;
      } else {
        break;
      }
    }

    return {
      goalId: goal.id,
      title: goal.title,
      horizon: goal.horizon,
      progress: Number(progress.toFixed(4)),
      currentStreak,
      milestones: milestoneProgresses.map((m) => ({
        ...m,
        progress: Number(m.progress.toFixed(4)),
      })),
    };
  }

  async recalculate(userId: string, id: string): Promise<GoalProgress> {
    this.logger.debug(`重算目标进度: ${id}`);

    const goal = await this.prisma.goal.findFirst({
      where: { id, userId },
      include: {
        milestones: { include: { tasks: true } },
      },
    });

    if (!goal) {
      throw new NotFoundException("目标不存在");
    }

    const milestoneProgresses = goal.milestones.map((milestone) => {
      const tasks = milestone.tasks;
      if (tasks.length === 0) {
        return { id: milestone.id, title: milestone.title, progress: 0 };
      }

      const totalWeight = tasks.reduce(
        (sum, task) => sum + (task.weight || 1),
        0,
      );
      const doneWeight = tasks
        .filter((task) => task.status === "done")
        .reduce((sum, task) => sum + (task.weight || 1), 0);

      const progress = totalWeight === 0 ? 0 : doneWeight / totalWeight;
      return { id: milestone.id, title: milestone.title, progress };
    });

    const totalMilestoneWeight = goal.milestones.reduce(
      (sum, m) => sum + (m.weight || 1),
      0,
    );
    const goalProgress =
      totalMilestoneWeight === 0
        ? 0
        : goal.milestones.reduce((sum, milestone, index) => {
            const progress = milestoneProgresses[index]?.progress || 0;
            return sum + progress * (milestone.weight || 1);
          }, 0) / totalMilestoneWeight;

    await this.prisma.$transaction([
      ...goal.milestones.map((milestone, index) =>
        this.prisma.milestone.update({
          where: { id: milestone.id },
          data: { progress: milestoneProgresses[index].progress },
        }),
      ),
      this.prisma.goal.update({
        where: { id: goal.id },
        data: { status: goalProgress >= 1 ? "completed" : "active" },
      }),
    ]);

    const result = {
      goalId: goal.id,
      progress: Number(goalProgress.toFixed(4)),
      milestones: milestoneProgresses.map((m) => ({
        ...m,
        progress: Number(m.progress.toFixed(4)),
      })),
    };

    emitReportCacheInvalidation(userId);
    return result;
  }
}
