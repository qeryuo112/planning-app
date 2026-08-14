import { Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { SyncEventsGateway } from "./sync-events.gateway";

export type SyncTargetType =
  "task" | "habit" | "goal" | "reminder" | "inbox" | "calendar" | "external";

export interface SyncEventPayload {
  eventType: string;
  targetType: SyncTargetType;
  targetId: string;
  payload: Record<string, unknown>;
  deviceId?: string;
}

export interface BroadcastEventPayload {
  eventType: string;
  targetType?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
  serverTimestamp?: string;
}

/**
 * 同步事件服务
 * 负责持久化同步事件并向用户所有连接广播。
 */
@Injectable()
export class SyncEventsService {
  private readonly logger = new Logger(SyncEventsService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly gateway: SyncEventsGateway,
  ) {}

  async createEvent(userId: string, event: SyncEventPayload) {
    this.logger.debug(
      `创建同步事件: ${event.eventType}, target=${event.targetType}/${event.targetId}, user=${userId}`,
    );

    const record = await this.prisma.syncEvent.create({
      data: {
        userId,
        eventType: event.eventType,
        targetType: event.targetType,
        targetId: event.targetId,
        payload: event.payload as any,
        deviceId: event.deviceId,
      },
    });

    this.gateway.broadcastToUser(userId, {
      eventType: record.eventType,
      targetType: record.targetType,
      targetId: record.targetId,
      payload: record.payload,
      serverTimestamp: record.serverTimestamp.toISOString(),
    });

    return record;
  }

  /**
   * 仅向用户当前连接广播事件，不持久化到 SyncEvent 表。
   * 适用于提醒等不需要多端同步回放的高频/瞬时事件。
   */
  broadcastToUser(userId: string, event: BroadcastEventPayload) {
    this.logger.debug(`广播事件: ${event.eventType}, user=${userId}`);

    this.gateway.broadcastToUser(userId, {
      eventType: event.eventType,
      targetType: event.targetType,
      targetId: event.targetId,
      payload: event.payload,
      serverTimestamp: event.serverTimestamp ?? new Date().toISOString(),
    });
  }

  async findEvents(
    userId: string,
    after?: string,
    limit = 100,
    eventType?: string,
  ) {
    this.logger.debug(
      `查询同步事件: user=${userId}, after=${after}, limit=${limit}, eventType=${eventType}`,
    );

    return this.prisma.syncEvent.findMany({
      where: {
        userId,
        ...(after && {
          serverTimestamp: { gt: new Date(after) },
        }),
        ...(eventType && { eventType }),
      },
      orderBy: { serverTimestamp: "asc" },
      take: limit,
    });
  }
}
