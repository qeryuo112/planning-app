import { Module } from "@nestjs/common";
import { GoalsService } from "./goals.service";
import { GoalsController } from "./goals.controller";
import { SyncModule } from "../sync/sync.module";
import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
  imports: [SyncModule, AnalyticsModule],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
