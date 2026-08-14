import { Module } from "@nestjs/common";
import { HabitsService } from "./habits.service";
import { HabitsController } from "./habits.controller";
import { SyncModule } from "../sync/sync.module";

@Module({
  imports: [SyncModule],
  controllers: [HabitsController],
  providers: [HabitsService],
})
export class HabitsModule {}
