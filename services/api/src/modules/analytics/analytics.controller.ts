import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from "@nestjs/common";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { AnalyticsService } from "./analytics.service";
import { TrackEventBatchDto, TrackEventDto } from "./dto/track-event.dto";

export class QueryEventsDto {
  eventType?: string;
  from?: string;
  to?: string;
  limit?: string;
  offset?: string;
}

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post("events")
  trackEvent(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: TrackEventDto,
  ) {
    return this.analyticsService.track({
      userId: user.userId,
      eventType: dto.eventType,
      targetId: dto.targetId,
      metadata: dto.metadata,
      clientTimestamp: dto.clientTimestamp
        ? new Date(dto.clientTimestamp)
        : new Date(),
    });
  }

  @Post("events/batch")
  trackEventBatch(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: TrackEventBatchDto,
  ) {
    return this.analyticsService.trackBatch(
      dto.events.map((e) => ({
        userId: user.userId,
        eventType: e.eventType,
        targetId: e.targetId,
        metadata: e.metadata,
        clientTimestamp: e.clientTimestamp
          ? new Date(e.clientTimestamp)
          : new Date(),
      })),
    );
  }

  @Get("events")
  findEvents(
    @CurrentUser() user: CurrentUserPayload,
    @Query() dto: QueryEventsDto,
  ) {
    const limit = dto.limit ? Number(dto.limit) : 100;
    const offset = dto.offset ? Number(dto.offset) : 0;
    const from = dto.from ? new Date(dto.from) : undefined;
    const to = dto.to ? new Date(dto.to) : undefined;

    return this.analyticsService.findEvents(user.userId, {
      eventType: dto.eventType,
      from,
      to,
      limit: Math.min(limit, 500),
      offset,
    });
  }
}
