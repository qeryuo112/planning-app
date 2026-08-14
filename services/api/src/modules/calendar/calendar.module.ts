import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CalendarService } from "./calendar.service";
import { CalendarController } from "./calendar.controller";
import { CalendarOAuthService } from "./calendar-oauth.service";
import { CalendarSyncService } from "./calendar-sync.service";
import { SyncModule } from "../sync/sync.module";

@Module({
  imports: [SyncModule, ConfigModule],
  controllers: [CalendarController],
  providers: [CalendarService, CalendarOAuthService, CalendarSyncService],
  exports: [CalendarSyncService],
})
export class CalendarModule {}
