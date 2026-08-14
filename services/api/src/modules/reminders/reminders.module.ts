import { Module } from "@nestjs/common";
import { RemindersService } from "./reminders.service";
import { RemindersController } from "./reminders.controller";
import { RemindersScheduler } from "./reminders.scheduler";
import { SyncModule } from "../sync/sync.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [SyncModule, AnalyticsModule, NotificationsModule],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersScheduler],
})
export class RemindersModule {}
