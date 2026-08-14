import { Controller, Get, Query } from "@nestjs/common";
import { SyncEventsService } from "./sync-events.service";
import { QuerySyncEventsDto } from "./dto/query-sync-events.dto";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

@Controller("sync")
export class SyncEventsController {
  constructor(private readonly syncEventsService: SyncEventsService) {}

  @Get("events")
  findEvents(
    @Query() dto: QuerySyncEventsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.syncEventsService.findEvents(
      user.userId,
      dto.after,
      dto.limit ? Number(dto.limit) : 100,
      dto.eventType,
    );
  }
}
