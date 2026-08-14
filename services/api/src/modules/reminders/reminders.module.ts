import { Module } from "@nestjs/common";
import { RemindersService } from "./reminders.service";
import { RemindersController } from "./reminders.controller";
import { RemindersScheduler } from "./reminders.scheduler";
import { SyncModule } from "../sync/sync.module";

@Module({
  imports: [SyncModule],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersScheduler],
})
export class RemindersModule {}
