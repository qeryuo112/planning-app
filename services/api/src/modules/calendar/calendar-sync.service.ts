import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaClient } from "@prisma/client";
import { CalendarService } from "./calendar.service";
import { CalendarOAuthService } from "./calendar-oauth.service";

/**
 * 日历订阅同步服务
 * 负责周期性轮询 ICS / Google / Outlook 订阅并导入事件。
 */
@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly calendarService: CalendarService,
    private readonly oauthService: CalendarOAuthService,
  ) {}

  /**
   * 同步单个订阅。
   */
  async syncSubscription(subscriptionId: string): Promise<void> {
    const subscription = await this.prisma.calendarSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || !subscription.isActive) {
      this.logger.warn(`订阅不存在或已停用: ${subscriptionId}`);
      return;
    }

    this.logger.debug(
      `开始同步订阅: ${subscriptionId} (${subscription.source})`,
    );

    try {
      switch (subscription.source) {
        case "ics":
          await this.syncIcs(subscription);
          break;
        case "google":
          await this.oauthService.syncGoogleSubscription(subscriptionId);
          break;
        case "outlook":
          this.logger.warn("Outlook 订阅同步尚未实现");
          await this.prisma.calendarSubscription.update({
            where: { id: subscriptionId },
            data: {
              lastSyncAt: new Date(),
              lastSyncResult: { imported: 0, error: "Outlook 未实现" },
            },
          });
          break;
        default:
          this.logger.warn(`未知订阅来源: ${subscription.source}`);
      }
    } catch (err) {
      this.logger.error(
        `订阅同步失败: ${subscriptionId}, ${(err as Error).message}`,
      );
      await this.prisma.calendarSubscription.update({
        where: { id: subscriptionId },
        data: {
          lastSyncAt: new Date(),
          lastSyncResult: { error: (err as Error).message },
        },
      });
    }
  }

  /**
   * 轮询所有活跃订阅。
   * 每 6 小时执行一次，串行处理避免外部 API 限流。
   */
  @Cron("0 */6 * * *")
  async syncAllActiveSubscriptions(): Promise<void> {
    this.logger.log("开始轮询日历订阅");

    const subscriptions = await this.prisma.calendarSubscription.findMany({
      where: {
        isActive: true,
      },
      orderBy: { lastSyncAt: "asc" },
    });

    for (const subscription of subscriptions) {
      await this.syncSubscription(subscription.id);
    }

    this.logger.log(`日历订阅轮询完成: ${subscriptions.length} 个`);
  }

  /**
   * 触发手动同步（Controller 用）。
   */
  async triggerSync(
    subscriptionId: string,
    userId: string,
  ): Promise<{ imported: number }> {
    const subscription = await this.prisma.calendarSubscription.findFirst({
      where: { id: subscriptionId, userId },
    });
    if (!subscription) {
      throw new Error("订阅不存在或无权限");
    }

    if (subscription.source === "ics") {
      return this.syncIcs(subscription);
    }

    if (subscription.source === "google") {
      await this.oauthService.syncGoogleSubscription(subscriptionId);
      const updated = await this.prisma.calendarSubscription.findUnique({
        where: { id: subscriptionId },
        select: { lastSyncResult: true },
      });
      const result = (updated?.lastSyncResult ?? {}) as {
        imported?: number;
      };
      return { imported: result.imported ?? 0 };
    }

    throw new Error("不支持的订阅来源");
  }

  private async syncIcs(subscription: {
    id: string;
    userId: string;
    url: string | null;
  }): Promise<{ imported: number }> {
    if (!subscription.url) {
      throw new Error("ICS 订阅缺少 URL");
    }

    const result = await this.calendarService.syncExternalCalendar(
      subscription.userId,
      subscription.url,
    );

    await this.prisma.calendarSubscription.update({
      where: { id: subscription.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncResult: result as any,
      },
    });

    return result;
  }
}
