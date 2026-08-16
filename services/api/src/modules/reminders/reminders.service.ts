import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { CreateReminderDto } from "./dto/create-reminder.dto";
import { UpdateReminderDto } from "./dto/update-reminder.dto";
import { SyncEventsService } from "../sync/sync-events.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { FcmService } from "../notifications/fcm.service";
import { MetricsService } from "../metrics/metrics.service";

/**
 * 提醒服务
 * 负责提醒的创建、查询、更新与删除。
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly syncEvents: SyncEventsService,
    private readonly analytics: AnalyticsService,
    private readonly fcm: FcmService,
    private readonly metrics: MetricsService,
  ) {}

  async create(userId: string, dto: CreateReminderDto) {
    this.logger.debug(
      `创建提醒: target=${dto.targetType}/${dto.targetId}, user=${userId}`,
    );

    await this.ensureTargetExists(userId, dto.targetType, dto.targetId);

    const reminder = await this.prisma.reminder.create({
      data: {
        userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        triggerAt: new Date(dto.triggerAt),
        channel: dto.channel ?? "push",
        repeatRule: dto.repeatRule
          ? (JSON.parse(
              JSON.stringify(dto.repeatRule),
            ) as Prisma.InputJsonValue)
          : undefined,
      },
    });

    void this.analytics.track({
      userId,
      eventType: "reminder.created",
      targetId: reminder.id,
      metadata: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        channel: reminder.channel,
      },
    });

    return reminder;
  }

  async findAll(userId: string) {
    this.logger.debug(`查询提醒列表: user=${userId}`);

    return this.prisma.reminder.findMany({
      where: { userId },
      orderBy: { triggerAt: "asc" },
    });
  }

  async findOne(userId: string, id: string) {
    this.logger.debug(`查询提醒详情: ${id}, user=${userId}`);

    const reminder = await this.prisma.reminder.findFirst({
      where: { id, userId },
    });

    if (!reminder) {
      throw new NotFoundException("提醒不存在");
    }

    return reminder;
  }

  async upcoming(userId: string) {
    this.logger.debug(`查询即将到期提醒: user=${userId}`);

    return this.prisma.reminder.findMany({
      where: {
        userId,
        status: "pending",
        triggerAt: { lte: new Date() },
      },
      orderBy: { triggerAt: "asc" },
    });
  }

  async update(userId: string, id: string, dto: UpdateReminderDto) {
    this.logger.debug(`更新提醒: ${id}, user=${userId}`);

    await this.findOne(userId, id);

    const data: Prisma.ReminderUpdateInput = {};

    if (dto.triggerAt !== undefined) {
      data.triggerAt = new Date(dto.triggerAt);
    }
    if (dto.channel !== undefined) data.channel = dto.channel;
    if (dto.repeatRule !== undefined) {
      data.repeatRule = dto.repeatRule
        ? (JSON.parse(JSON.stringify(dto.repeatRule)) as Prisma.InputJsonValue)
        : null;
    }
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.reminder.update({
      where: { id },
      data,
    });
  }

  async remove(userId: string, id: string) {
    this.logger.debug(`删除提醒: ${id}, user=${userId}`);

    await this.findOne(userId, id);
    await this.prisma.reminder.delete({ where: { id } });

    return { id, deleted: true };
  }

  /**
   * 处理已到期的提醒。
   * 每分钟由定时任务调用一次。
   */
  async processDueReminders() {
    this.logger.debug("扫描到期提醒");

    const now = new Date();
    const due = await this.prisma.reminder.findMany({
      where: {
        status: "pending",
        triggerAt: { lte: now },
      },
      orderBy: { triggerAt: "asc" },
    });

    this.logger.debug(`到期提醒数量: ${due.length}`);

    for (const reminder of due) {
      await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: "sent", snoozeCount: 0 },
      });

      this.syncEvents.broadcastToUser(reminder.userId, {
        eventType: "reminder.triggered",
        targetType: "reminder",
        targetId: reminder.id,
        payload: {
          targetType: reminder.targetType,
          targetId: reminder.targetId,
          triggerAt: reminder.triggerAt.toISOString(),
          channel: reminder.channel,
          snoozeCount: reminder.snoozeCount,
        },
      });

      void this.analytics.track({
        userId: reminder.userId,
        eventType: "reminder.triggered",
        targetId: reminder.id,
        metadata: {
          targetType: reminder.targetType,
          targetId: reminder.targetId,
          channel: reminder.channel,
        },
      });

      if (reminder.channel === "push") {
        this.logger.log(`准备远程推送提醒: reminder=${reminder.id}, user=${reminder.userId}`);
        const title = "计划提醒";
        const body = `你的 ${reminder.targetType} 到期了`;
        void this.fcm
          .sendToUser(reminder.userId, {
            title,
            body,
            data: {
              targetType: reminder.targetType,
              targetId: reminder.targetId,
              reminderId: reminder.id,
            },
          })
          .then((ok) => {
            this.metrics.remindersPushedTotal
              .labels(ok ? "success" : "failed", reminder.channel)
              .inc();
          })
          .catch(() => {
            this.metrics.remindersPushedTotal
              .labels("failed", reminder.channel)
              .inc();
          });
      }
    }

    return { processed: due.length };
  }

  async dismiss(userId: string, id: string) {
    this.logger.debug(`忽略提醒: ${id}, user=${userId}`);

    await this.findOne(userId, id);

    const result = await this.prisma.reminder.update({
      where: { id },
      data: { status: "dismissed" },
    });

    void this.analytics.track({
      userId,
      eventType: "reminder.dismissed",
      targetId: id,
      metadata: { previousStatus: result.status },
    });

    return result;
  }

  async snooze(userId: string, id: string, minutes: number) {
    this.logger.debug(`推迟提醒: ${id}, +${minutes}min, user=${userId}`);

    if (![15, 30, 60].includes(minutes)) {
      throw new BadRequestException("仅支持推迟 15/30/60 分钟");
    }

    const reminder = await this.findOne(userId, id);
    const newTriggerAt = new Date(
      reminder.triggerAt.getTime() + minutes * 60 * 1000,
    );

    const result = await this.prisma.reminder.update({
      where: { id },
      data: {
        triggerAt: newTriggerAt,
        status: "pending",
        snoozeCount: { increment: 1 },
      },
    });

    void this.analytics.track({
      userId,
      eventType: "reminder.snoozed",
      targetId: id,
      metadata: { minutes, newTriggerAt: result.triggerAt.toISOString() },
    });

    return result;
  }

  private async ensureTargetExists(
    userId: string,
    targetType: string,
    targetId: string,
  ) {
    let exists = false;

    if (targetType === "goal") {
      exists = !!(await this.prisma.goal.findFirst({
        where: { id: targetId, userId },
        select: { id: true },
      }));
    } else if (targetType === "task") {
      exists = !!(await this.prisma.task.findFirst({
        where: { id: targetId, userId },
        select: { id: true },
      }));
    } else if (targetType === "habit") {
      exists = !!(await this.prisma.habit.findFirst({
        where: { id: targetId, userId },
        select: { id: true },
      }));
    }

    if (!exists) {
      throw new NotFoundException("提醒目标不存在");
    }
  }
}
