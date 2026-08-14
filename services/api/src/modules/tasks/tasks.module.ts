import { Module } from "@nestjs/common";
import { TasksService } from "./tasks.service";
import { TasksController } from "./tasks.controller";
import { SyncModule } from "../sync/sync.module";
import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
  imports: [SyncModule, AnalyticsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
