import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { RedisModule } from "../redis.module";

@Module({
  imports: [RedisModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
