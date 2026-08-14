import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaClient } from "@prisma/client";

/**
 * AI 操作记录清理服务
 * 每天凌晨 3 点执行：
 * 1. 汇总 30 天前的 AIOperation 为每日成本摘要（AIDailyCostSummary）。
 * 2. 删除 30 天前的原始 AIOperation 明细。
 */
@Injectable()
export class AiCleanupService {
  private readonly logger = new Logger(AiCleanupService.name);
  private readonly RETENTION_DAYS = 30;

  constructor(private readonly prisma: PrismaClient) {}

  @Cron("0 3 * * *")
  async runCleanup(): Promise<void> {
    this.logger.log("开始清理过期 AIOperation 记录");

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.RETENTION_DAYS);
    cutoff.setHours(0, 0, 0, 0);

    try {
      const aggregated = await this.aggregateOldOperations(cutoff);
      this.logger.log(`待汇总记录: ${aggregated.length} 天`);

      for (const row of aggregated) {
        await this.prisma.aIDailyCostSummary.upsert({
          where: {
            userId_date: {
              userId: row.userId,
              date: row.date,
            },
          },
          update: {
            totalCost: { increment: row.totalCost },
            callCount: { increment: row.callCount },
          },
          create: {
            userId: row.userId,
            date: row.date,
            totalCost: row.totalCost,
            callCount: row.callCount,
          },
        });
      }

      const deleteResult = await this.prisma.aIOperation.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });

      this.logger.log(
        `AIOperation 清理完成：汇总 ${aggregated.length} 条日记录，删除 ${deleteResult.count} 条原始记录`,
      );
    } catch (error) {
      this.logger.error("AIOperation 清理失败", error);
      throw error;
    }
  }

  private async aggregateOldOperations(
    cutoff: Date,
  ): Promise<
    Array<{ userId: string; date: Date; totalCost: number; callCount: number }>
  > {
    // 使用原始查询按 userId + DATE(createdAt) 汇总，避免内存中聚合大数据量
    const result = await this.prisma.$queryRaw<
      Array<{
        userId: string;
        date: Date;
        totalCost: number;
        callCount: bigint;
      }>
    >`
      SELECT
        "userId",
        DATE("createdAt") AS "date",
        COALESCE(SUM("cost"), 0) AS "totalCost",
        COUNT(*) AS "callCount"
      FROM "ai_operations"
      WHERE "createdAt" < ${cutoff}
      GROUP BY "userId", DATE("createdAt")
    `;

    return result.map((row) => ({
      userId: row.userId,
      date: row.date,
      totalCost: Number(row.totalCost),
      callCount: Number(row.callCount),
    }));
  }
}
