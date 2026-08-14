import { Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { MetricsService } from "../metrics/metrics.service";

export interface TrackEventInput {
  eventType: string;
  userId: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  clientTimestamp?: Date;
}

/**
 * 行为埋点服务
 * 将事件写入 UserEvent 表，用于后续用户画像、AI 推荐与数据报表。
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly metrics: MetricsService,
  ) {}

  async track(input: TrackEventInput) {
    const record = await this.prisma.userEvent.create({
      data: {
        userId: input.userId,
        eventType: input.eventType,
        targetId: input.targetId ?? null,
        metadata: (input.metadata ?? {}) as any,
        clientTimestamp: input.clientTimestamp ?? new Date(),
      },
    });

    this.metrics.analyticsTrackedTotal.labels(record.eventType).inc();
    this.logger.debug(
      `埋点: ${record.eventType}, user=${record.userId}, target=${record.targetId ?? "-"}`,
    );

    return record;
  }

  async trackBatch(inputs: TrackEventInput[]) {
    if (inputs.length === 0) return [];

    const records = await this.prisma.userEvent.createMany({
      data: inputs.map((input) => ({
        userId: input.userId,
        eventType: input.eventType,
        targetId: input.targetId ?? null,
        metadata: (input.metadata ?? {}) as any,
        clientTimestamp: input.clientTimestamp ?? new Date(),
      })),
      skipDuplicates: false,
    });

    this.metrics.analyticsTrackedTotal.inc(inputs.length);
    this.logger.debug(`批量埋点: ${records.count} 条事件`);
    return records;
  }

  async findEvents(
    userId: string,
    options: { eventType?: string; from?: Date; to?: Date; limit?: number; offset?: number } = {},
  ) {
    const { eventType, from, to, limit = 100, offset = 0 } = options;

    return this.prisma.userEvent.findMany({
      where: {
        userId,
        ...(eventType && { eventType }),
        ...(from && { serverTimestamp: { gte: from } }),
        ...(to && { serverTimestamp: { lte: to } }),
      },
      orderBy: { serverTimestamp: "desc" },
      take: limit,
      skip: offset,
    });
  }
}
