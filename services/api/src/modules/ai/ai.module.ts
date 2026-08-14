import { Module } from "@nestjs/common";
import { AiService } from "./ai.service";
import { AiController } from "./ai.controller";
import { AiInsightsService } from "./ai-insights.service";
import { AiCleanupService } from "./ai-cleanup.service";
import { ModelAdapter } from "./model-adapter.service";
import { PlanOrchestrator } from "./plan-orchestrator.service";
import { PlanExecutor } from "./plan-executor.service";
import { SyncModule } from "../sync/sync.module";

@Module({
  imports: [SyncModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiInsightsService,
    AiCleanupService,
    ModelAdapter,
    PlanOrchestrator,
    PlanExecutor,
  ],
  exports: [AiService, AiInsightsService, AiCleanupService],
})
export class AiModule {}
