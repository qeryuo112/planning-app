import { Module } from "@nestjs/common";
import { HabitsService } from "./habits.service";
import { HabitsController } from "./habits.controller";
import { SyncModule } from "../sync/sync.module";
import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
  imports: [SyncModule, AnalyticsModule],
  controllers: [HabitsController],
  providers: [HabitsService],
})
export class HabitsModule {}
