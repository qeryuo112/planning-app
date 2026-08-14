import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { TodayService } from "./today.service";
import { TodayController } from "./today.controller";

@Module({
  imports: [PrismaModule],
  controllers: [TodayController],
  providers: [TodayService],
  exports: [TodayService],
})
export class TodayModule {}
