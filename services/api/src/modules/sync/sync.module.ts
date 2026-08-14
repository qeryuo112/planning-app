import { Module } from "@nestjs/common";
import { SyncEventsGateway } from "./sync-events.gateway";
import { SyncEventsService } from "./sync-events.service";
import { SyncEventsController } from "./sync-events.controller";

@Module({
  providers: [SyncEventsGateway, SyncEventsService],
  controllers: [SyncEventsController],
  exports: [SyncEventsService],
})
export class SyncModule {}
