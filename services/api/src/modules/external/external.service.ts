import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { ImportFitnessDataDto } from "./dto/import-fitness-data.dto";
import { SyncEventsService } from "../sync/sync-events.service";

@Injectable()
export class ExternalService {
  private readonly logger = new Logger(ExternalService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly syncEvents: SyncEventsService,
  ) {}

  async importFitnessData(userId: string, dto: ImportFitnessDataDto) {
    this.logger.debug(
      `导入运动数据: source=${dto.source}, activities=${dto.activities.length}`,
    );

    if (dto.habitId) {
      const habit = await this.prisma.habit.findFirst({
        where: { id: dto.habitId, userId },
      });
      if (!habit) {
        throw new NotFoundException("关联习惯不存在或无权访问");
      }
    }

    const activities = dto.activities.map((a) => ({
      userId,
      source: dto.source,
      sourceId: a.sourceId ?? null,
      activityType: a.activityType,
      startedAt: new Date(a.startedAt),
      durationSeconds: a.durationSeconds ?? null,
      distanceKm: a.distanceKm ?? null,
      calories: a.calories ?? null,
      note: a.note ?? null,
      rawData: a as any,
    }));

    await this.prisma.externalActivity.createMany({
      data: activities,
      skipDuplicates: true,
    });

    let checkinsCreated = 0;
    if (dto.habitId) {
      for (const activity of dto.activities) {
        await this.prisma.checkin.create({
          data: {
            userId,
            habitId: dto.habitId,
            date: new Date(activity.startedAt),
            result: "completed",
            actualMinutes: activity.durationSeconds
              ? Math.round(activity.durationSeconds / 60)
              : null,
            note:
              activity.note ??
              `${activity.activityType} ${activity.distanceKm ? activity.distanceKm + "km" : ""}`,
          },
        });
        checkinsCreated++;
      }
    }

    if (activities.length > 0) {
      await this.syncEvents.createEvent(userId, {
        eventType: "external.imported",
        targetType: "external",
        targetId: userId,
        payload: {
          activitiesImported: activities.length,
          checkinsCreated,
          source: dto.source,
        },
      });
    }

    return {
      activitiesImported: activities.length,
      checkinsCreated,
    };
  }
}
