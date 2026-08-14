import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ical = require("node-ical");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const icalGenerator = require("ical-generator");
import { CreateCalendarEventDto } from "./dto/create-calendar-event.dto";
import { UpdateCalendarEventDto } from "./dto/update-calendar-event.dto";
import { CreateCalendarSubscriptionDto } from "./dto/create-calendar-subscription.dto";
import { SyncEventsService } from "../sync/sync-events.service";
import { emitReportCacheInvalidation } from "../../common/events/report-cache.events";

/**
 * 日历服务
 * 管理用户的日程事件，支持关联到任务。
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly syncEvents: SyncEventsService,
  ) {}

  async create(userId: string, dto: CreateCalendarEventDto) {
    this.logger.debug(`创建日历事件: ${dto.title}`);

    if (dto.endAt && new Date(dto.startAt) > new Date(dto.endAt)) {
      throw new BadRequestException("开始时间不能晚于结束时间");
    }

    if (dto.taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: dto.taskId, userId },
      });
      if (!task) {
        throw new NotFoundException("关联任务不存在");
      }
    }

    const event = await this.prisma.calendarEvent.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        startAt: new Date(dto.startAt),
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        taskId: dto.taskId,
      },
    });

    await this.syncEvents.createEvent(userId, {
      eventType: "calendar.created",
      targetType: "calendar",
      targetId: event.id,
      payload: {
        title: event.title,
        startAt: (event.startAt ?? new Date(dto.startAt)).toISOString(),
        endAt:
          event.endAt?.toISOString() ??
          (dto.endAt ? new Date(dto.endAt).toISOString() : undefined),
      },
    });

    emitReportCacheInvalidation(userId);
    return event;
  }

  async findByRange(userId: string, start: string, end: string) {
    this.logger.debug(`查询日历范围: ${start} ~ ${end}`);

    return this.prisma.calendarEvent.findMany({
      where: {
        userId,
        startAt: {
          gte: new Date(start),
          lte: new Date(end),
        },
      },
      orderBy: { startAt: "asc" },
    });
  }

  async update(userId: string, id: string, dto: UpdateCalendarEventDto) {
    const event = await this.findOne(userId, id);

    const startAt = dto.startAt ? new Date(dto.startAt) : event.startAt;
    const endAt =
      dto.endAt !== undefined
        ? dto.endAt
          ? new Date(dto.endAt)
          : null
        : event.endAt;

    if (endAt && startAt > endAt) {
      throw new BadRequestException("开始时间不能晚于结束时间");
    }

    if (dto.taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: dto.taskId, userId },
      });
      if (!task) {
        throw new NotFoundException("关联任务不存在");
      }
    }

    const updatedEvent = await this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.startAt !== undefined && { startAt }),
        ...(dto.endAt !== undefined && { endAt }),
        ...(dto.taskId !== undefined && { taskId: dto.taskId }),
      },
    });

    await this.syncEvents.createEvent(userId, {
      eventType: "calendar.updated",
      targetType: "calendar",
      targetId: updatedEvent.id,
      payload: {
        title: updatedEvent.title,
        startAt: (updatedEvent.startAt ?? startAt).toISOString(),
        endAt: updatedEvent.endAt?.toISOString() ?? endAt?.toISOString(),
      },
    });

    emitReportCacheInvalidation(userId);
    return updatedEvent;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    const event = await this.prisma.calendarEvent.delete({
      where: { id },
    });

    await this.syncEvents.createEvent(userId, {
      eventType: "calendar.deleted",
      targetType: "calendar",
      targetId: id,
      payload: { title: event.title },
    });

    emitReportCacheInvalidation(userId);
    return event;
  }

  private async findOne(userId: string, id: string) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id, userId },
    });

    if (!event) {
      throw new NotFoundException("日历事件不存在");
    }

    return event;
  }

  /**
   * 导入 ICS 文本，将 VEVENT 转为 CalendarEvent。
   * 按 (title, startAt) 去重，避免重复导入。
   * @param source 事件来源标识，如 ics / google / outlook
   */
  async importIcs(userId: string, icsText: string, source = "ics") {
    this.logger.debug(`导入 ICS，长度: ${icsText.length}, source=${source}`);

    let parsed: any;
    try {
      parsed = ical.parseICS(icsText);
    } catch (err) {
      this.logger.error(`ICS 解析失败: ${(err as Error).message}`);
      throw new BadRequestException("ICS 格式解析失败");
    }

    const events = Object.values(parsed).filter(
      (item: any) => item && item.type === "VEVENT",
    );

    const existing = await this.prisma.calendarEvent.findMany({
      where: { userId },
      select: { title: true, startAt: true },
    });
    const existingKeys = new Set(
      existing.map((e) => `${e.title}|${e.startAt.toISOString()}`),
    );

    let imported = 0;
    for (const event of events as any[]) {
      const title = event.summary || "(无标题)";
      const startAt = this.parseIcsDate(event.start);
      const endAt = event.end ? this.parseIcsDate(event.end) : null;

      if (!startAt) {
        this.logger.warn(`跳过无开始时间的事件: ${title}`);
        continue;
      }

      const key = `${title}|${startAt.toISOString()}`;
      if (existingKeys.has(key)) {
        continue;
      }

      await this.prisma.calendarEvent.create({
        data: {
          userId,
          title,
          description: event.description || null,
          startAt,
          endAt,
          source,
        },
      });

      existingKeys.add(key);
      imported++;
    }

    this.logger.debug(`ICS 导入完成: ${imported}/${events.length}`);

    if (imported > 0) {
      await this.syncEvents.createEvent(userId, {
        eventType: "calendar.imported",
        targetType: "calendar",
        targetId: userId,
        payload: { imported, total: events.length, source: "ics" },
      });
      emitReportCacheInvalidation(userId);
    }

    return { imported, total: events.length };
  }

  /**
   * 导出当前用户的日历事件为 ICS 文本。
   */
  async exportIcs(userId: string, start?: string, end?: string) {
    this.logger.debug(`导出 ICS: ${start} ~ ${end}`);

    const where: any = { userId };
    if (start || end) {
      where.startAt = {};
      if (start) where.startAt.gte = new Date(start);
      if (end) where.startAt.lte = new Date(end);
    }

    const events = await this.prisma.calendarEvent.findMany({
      where,
      orderBy: { startAt: "asc" },
    });

    const cal = icalGenerator.default({ name: "计划型 App 日历" });

    for (const event of events) {
      cal.createEvent({
        start: event.startAt,
        end: event.endAt ?? undefined,
        summary: event.title,
        description: event.description ?? undefined,
        uid: event.id,
      });
    }

    return { icsText: cal.toString() };
  }

  /**
   * 通过外部日历 URL 拉取 ICS 并导入。
   * 兼容 Google Calendar / Outlook 等支持公开 ICS 地址的服务。
   */
  async syncExternalCalendar(userId: string, url: string) {
    this.logger.debug(`同步外部日历: ${url}`);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: "text/calendar" },
      });
    } catch (err) {
      this.logger.error(`拉取外部日历失败: ${(err as Error).message}`);
      throw new BadRequestException("无法访问外部日历地址");
    }

    if (!response.ok) {
      throw new BadRequestException(`外部日历返回状态码 ${response.status}`);
    }

    const icsText = await response.text();
    return this.importIcs(userId, icsText, "ics");
  }

  /**
   * 查询用户的所有日历订阅（隐藏敏感 token）。
   */
  async findSubscriptions(userId: string) {
    const subscriptions = await this.prisma.calendarSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return subscriptions.map((sub) => ({
      id: sub.id,
      name: sub.name,
      source: sub.source,
      url: sub.url,
      calendarId: sub.calendarId,
      lastSyncAt: sub.lastSyncAt,
      lastSyncResult: sub.lastSyncResult,
      isActive: sub.isActive,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    }));
  }

  /**
   * 创建 ICS 日历订阅。
   */
  async createSubscription(userId: string, dto: CreateCalendarSubscriptionDto) {
    const subscription = await this.prisma.calendarSubscription.create({
      data: {
        userId,
        name: dto.name,
        source: "ics",
        url: dto.url,
      },
    });

    return {
      id: subscription.id,
      name: subscription.name,
      source: subscription.source,
      url: subscription.url,
      isActive: subscription.isActive,
    };
  }

  /**
   * 删除日历订阅。
   */
  async removeSubscription(userId: string, id: string) {
    const subscription = await this.prisma.calendarSubscription.findFirst({
      where: { id, userId },
    });

    if (!subscription) {
      throw new NotFoundException("订阅不存在");
    }

    await this.prisma.calendarSubscription.delete({ where: { id } });
    return { id };
  }

  private parseIcsDate(value: Date | string | undefined): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
}
