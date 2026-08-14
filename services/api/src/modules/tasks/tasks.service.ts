import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { CompleteTaskDto } from "./dto/complete-task.dto";
import { PostponeTaskDto } from "./dto/postpone-task.dto";
import { MakeupTaskDto } from "./dto/makeup-task.dto";
import { SyncEventsService } from "../sync/sync-events.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { emitReportCacheInvalidation } from "../../common/events/report-cache.events";

/**
 * 任务服务
 * 负责任务的 CRUD、按日期查询、完成任务与延期处理。
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly syncEvents: SyncEventsService,
    private readonly analytics: AnalyticsService,
  ) {}

  async create(userId: string, dto: CreateTaskDto) {
    this.logger.debug(`创建任务: ${dto.title}, user=${userId}`);

    if (dto.projectId) {
      await this.ensureProjectExists(userId, dto.projectId);
    }
    if (dto.milestoneId) {
      await this.ensureMilestoneBelongsToUser(userId, dto.milestoneId);
    }

    const data: Prisma.TaskCreateInput = {
      user: { connect: { id: userId } },
      title: dto.title,
      description: dto.description,
      scheduledDate: dto.scheduledDate
        ? new Date(`${dto.scheduledDate}T00:00:00.000Z`)
        : null,
      energyLevel: dto.energyLevel ?? "medium",
      durationMinutes: dto.durationMinutes,
      weight: dto.weight ?? 1,
      repeatRule: dto.repeatRule
        ? (JSON.parse(JSON.stringify(dto.repeatRule)) as Prisma.InputJsonValue)
        : undefined,
      minimumStandard: dto.minimumStandard,
    };

    if (dto.projectId) {
      data.project = { connect: { id: dto.projectId } };
    }
    if (dto.milestoneId) {
      data.milestone = { connect: { id: dto.milestoneId } };
    }

    const task = await this.prisma.task.create({
      data,
      include: { project: true, milestone: true, checkins: true },
    });

    await this.syncEvents.createEvent(userId, {
      eventType: "task.created",
      targetType: "task",
      targetId: task.id,
      payload: {
        title: task.title,
        scheduledDate: task.scheduledDate?.toISOString(),
        status: task.status,
      },
    });

    void this.analytics.track({
      userId,
      eventType: "task.created",
      targetId: task.id,
      metadata: {
        title: task.title,
        scheduledDate: task.scheduledDate?.toISOString(),
        energyLevel: task.energyLevel,
      },
    });

    emitReportCacheInvalidation(userId);
    return task;
  }

  async findByDate(userId: string, date?: string) {
    this.logger.debug(`查询任务: user=${userId}, date=${date}`);

    const where: Record<string, unknown> = { userId };

    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(`${date}T23:59:59.999Z`);
      where.scheduledDate = { gte: start, lte: end };
    } else {
      where.scheduledDate = null;
    }

    return this.prisma.task.findMany({
      where,
      include: { project: true, milestone: true, checkins: true },
      orderBy: [{ energyLevel: "desc" }, { createdAt: "desc" }],
    });
  }

  async findOne(userId: string, id: string) {
    this.logger.debug(`查询任务详情: ${id}, user=${userId}`);

    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: { project: true, milestone: true, checkins: true },
    });

    if (!task) {
      throw new NotFoundException("任务不存在");
    }

    return task;
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    this.logger.debug(`更新任务: ${id}, user=${userId}`);

    await this.findOne(userId, id);

    if (dto.projectId) {
      await this.ensureProjectExists(userId, dto.projectId);
    }
    if (dto.milestoneId) {
      await this.ensureMilestoneBelongsToUser(userId, dto.milestoneId);
    }

    const data: Prisma.TaskUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.projectId !== undefined) {
      data.project = dto.projectId
        ? { connect: { id: dto.projectId } }
        : { disconnect: true };
    }
    if (dto.milestoneId !== undefined) {
      data.milestone = dto.milestoneId
        ? { connect: { id: dto.milestoneId } }
        : { disconnect: true };
    }
    if (dto.scheduledDate !== undefined) {
      data.scheduledDate = dto.scheduledDate
        ? new Date(`${dto.scheduledDate}T00:00:00.000Z`)
        : null;
    }
    if (dto.energyLevel !== undefined) data.energyLevel = dto.energyLevel;
    if (dto.durationMinutes !== undefined)
      data.durationMinutes = dto.durationMinutes;
    if (dto.weight !== undefined) data.weight = dto.weight;
    if (dto.repeatRule !== undefined) {
      data.repeatRule = dto.repeatRule
        ? (JSON.parse(JSON.stringify(dto.repeatRule)) as Prisma.InputJsonValue)
        : null;
    }
    if (dto.minimumStandard !== undefined)
      data.minimumStandard = dto.minimumStandard;
    if (dto.status !== undefined) data.status = dto.status;

    const task = await this.prisma.task.update({
      where: { id },
      data,
      include: { project: true, milestone: true, checkins: true },
    });

    emitReportCacheInvalidation(userId);
    return task;
  }

  async remove(userId: string, id: string) {
    this.logger.debug(`删除任务: ${id}, user=${userId}`);

    await this.findOne(userId, id);
    await this.prisma.task.delete({ where: { id } });

    emitReportCacheInvalidation(userId);
    return { id, deleted: true };
  }

  async complete(userId: string, id: string, dto: CompleteTaskDto) {
    this.logger.debug(`完成任务: ${id}, user=${userId}`);

    const task = await this.findOne(userId, id);

    const result = dto.result ?? "completed";
    const date = task.scheduledDate ?? new Date();

    const [updatedTask, checkin] = await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id },
        data: { status: "done" },
        include: { project: true, milestone: true, checkins: true },
      }),
      this.prisma.checkin.create({
        data: {
          userId,
          taskId: id,
          date,
          result,
          actualMinutes: dto.actualMinutes,
          qualityRating: dto.qualityRating,
          note: dto.note,
        },
      }),
    ]);

    await this.syncEvents.createEvent(userId, {
      eventType: "task.completed",
      targetType: "task",
      targetId: updatedTask.id,
      payload: {
        status: updatedTask.status,
        actualMinutes: dto.actualMinutes,
        qualityRating: dto.qualityRating,
      },
    });

    void this.analytics.track({
      userId,
      eventType: "task.completed",
      targetId: updatedTask.id,
      metadata: {
        actualMinutes: dto.actualMinutes,
        qualityRating: dto.qualityRating,
        result,
      },
    });

    emitReportCacheInvalidation(userId);
    return { task: updatedTask, checkin };
  }

  async postpone(userId: string, id: string, dto: PostponeTaskDto) {
    this.logger.debug(`延期任务: ${id}, user=${userId}`);

    const task = await this.findOne(userId, id);

    const originalDate = task.scheduledDate ?? new Date();
    const newDate = dto.newScheduledDate
      ? new Date(`${dto.newScheduledDate}T00:00:00.000Z`)
      : null;

    const [updatedTask] = await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id },
        data: {
          status: newDate ? "todo" : "postponed",
          scheduledDate: newDate,
        },
        include: { project: true, milestone: true, checkins: true },
      }),
      this.prisma.checkin.create({
        data: {
          userId,
          taskId: id,
          date: originalDate,
          result: "skipped",
          blockReasonTag: dto.reason ?? null,
          note: dto.reason ? `延期原因: ${dto.reason}` : undefined,
        },
      }),
    ]);

    await this.syncEvents.createEvent(userId, {
      eventType: "task.postponed",
      targetType: "task",
      targetId: updatedTask.id,
      payload: {
        status: updatedTask.status,
        scheduledDate: updatedTask.scheduledDate?.toISOString(),
        reason: dto.reason ?? null,
      },
    });

    void this.analytics.track({
      userId,
      eventType: "task.postponed",
      targetId: updatedTask.id,
      metadata: {
        reason: dto.reason ?? null,
        newScheduledDate: updatedTask.scheduledDate?.toISOString(),
      },
    });

    emitReportCacheInvalidation(userId);
    return { task: updatedTask, checkinSkipped: true };
  }

  async makeup(userId: string, id: string, dto: MakeupTaskDto) {
    this.logger.debug(`补完成任务: ${id}, user=${userId}`);

    const task = await this.findOne(userId, id);

    const date = task.scheduledDate ?? new Date();

    const [updatedTask, checkin] = await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id },
        data: { status: "done" },
        include: { project: true, milestone: true, checkins: true },
      }),
      this.prisma.checkin.create({
        data: {
          userId,
          taskId: id,
          date,
          result: "completed",
          actualMinutes: dto.actualMinutes,
          qualityRating: dto.qualityRating,
          note: dto.note,
          isMakeup: true,
        },
      }),
    ]);

    await this.syncEvents.createEvent(userId, {
      eventType: "task.madeup",
      targetType: "task",
      targetId: updatedTask.id,
      payload: {
        status: updatedTask.status,
        actualMinutes: dto.actualMinutes,
        qualityRating: dto.qualityRating,
      },
    });

    void this.analytics.track({
      userId,
      eventType: "task.madeup",
      targetId: updatedTask.id,
      metadata: {
        actualMinutes: dto.actualMinutes,
        qualityRating: dto.qualityRating,
      },
    });

    emitReportCacheInvalidation(userId);
    return { task: updatedTask, checkin };
  }

  private async ensureProjectExists(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException("关联项目不存在");
    }
  }

  private async ensureMilestoneBelongsToUser(
    userId: string,
    milestoneId: string,
  ) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, goal: { userId } },
      select: { id: true },
    });

    if (!milestone) {
      throw new NotFoundException("关联里程碑不存在");
    }
  }
}
